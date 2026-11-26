import 'story.dart';

/// What this device remembers about one story.
class StoryHistory {
  const StoryHistory({
    this.shows = 0,
    this.lastShownAt,
    this.actionsAtLastShow = 0,
    this.seenSlides = const {},
  });

  static const none = StoryHistory();

  /// How many times the viewer opened it: by a tap or by itself.
  final int shows;
  final DateTime? lastShownAt;

  /// [StorySchedule]'s action count at the last show.
  final int actionsAtLastShow;

  /// The ids of the slides that were on screen.
  final Set<String> seenSlides;

  /// The history after a show at [now], with [actions] counted so far.
  StoryHistory shown(DateTime now, int actions) => StoryHistory(
        shows: shows + 1,
        lastShownAt: now,
        actionsAtLastShow: actions,
        seenSlides: seenSlides,
      );

  StoryHistory withSeenSlide(String id) => seenSlides.contains(id)
      ? this
      : StoryHistory(
          shows: shows,
          lastShownAt: lastShownAt,
          actionsAtLastShow: actionsAtLastShow,
          seenSlides: {...seenSlides, id},
        );

  Map<String, Object?> toJson() => {
        'shows': shows,
        'last_shown_at': lastShownAt?.toUtc().toIso8601String(),
        'actions': actionsAtLastShow,
        'seen': seenSlides.toList(),
      };

  static StoryHistory fromJson(Object? json) {
    if (json is! Map) return none;
    final shows = json['shows'], actions = json['actions'];
    final at = json['last_shown_at'];
    return StoryHistory(
      shows: shows is int ? shows : 0,
      lastShownAt: at is String ? DateTime.tryParse(at) : null,
      actionsAtLastShow: actions is int ? actions : 0,
      seenSlides: {
        for (final id in json['seen'] as List? ?? const [])
          if (id is String) id,
      },
    );
  }
}

/// When a story shows in the bar, has its coloured ring, and opens by
/// itself, per the stories API's display rules
/// (`backend/docs/stories-api.md`, "Display rules").
///
/// A **show** is the viewer opening the story, by a tap or by itself. A
/// story is **due** when it was never shown, or when `every_days` or
/// `every_actions` (whichever comes first) passed since its last show.
/// **Actions** are app opens and station playbacks started.
class StorySchedule {
  const StorySchedule({required this.now, required this.actions});

  final DateTime now;

  /// The actions counted on this device so far.
  final int actions;

  /// Whether [story] is in the bar: live, and not past its `max_shows`.
  bool isListed(Story story, StoryHistory history) {
    final max = story.display.maxShows;
    return story.isLiveAt(now) && (max == null || history.shows < max);
  }

  /// Whether [story] is due to be shown again.
  bool isDue(Story story, StoryHistory history) {
    if (history.shows == 0) return true;
    final last = history.lastShownAt;
    final days = story.display.everyDays;
    final everyActions = story.display.everyActions;
    final daysPassed = days != null &&
        last != null &&
        !now.isBefore(last.add(Duration(days: days)));
    final actionsPassed = everyActions != null &&
        actions - history.actionsAtLastShow >= everyActions;
    return daysPassed || actionsPassed;
  }

  /// Whether the bubble has its coloured ring: the story is due, or has
  /// a slide this device never saw (one the admin added since).
  bool isHighlighted(Story story, StoryHistory history) =>
      isDue(story, history) ||
      story.slides.any((slide) => !history.seenSlides.contains(slide.id));

  /// The bar's stories: listed ones, the highlighted first, each group
  /// in the API's order.
  List<Story> bar(
    List<Story> stories,
    StoryHistory Function(String slug) historyOf,
  ) {
    final listed = [
      for (final story in stories)
        if (isListed(story, historyOf(story.slug))) story,
    ];
    bool lit(Story story) => isHighlighted(story, historyOf(story.slug));
    return [...listed.where(lit), ...listed.where((s) => !lit(s))];
  }

  /// The story to open by itself now, or null.
  ///
  /// One per app open ([openedThisLaunch]), and only once [gapActions]
  /// actions passed since the last auto-open of any story
  /// ([actionsAtLastAutoOpen], null when none ever did).
  Story? autoOpen(
    List<Story> stories,
    StoryHistory Function(String slug) historyOf, {
    required bool openedThisLaunch,
    required int? actionsAtLastAutoOpen,
    required int gapActions,
  }) {
    if (openedThisLaunch) return null;
    final last = actionsAtLastAutoOpen;
    if (last != null && actions - last < gapActions) return null;
    for (final story in stories) {
      final history = historyOf(story.slug);
      if (story.display.autoOpen &&
          isListed(story, history) &&
          isDue(story, history)) {
        return story;
      }
    }
    return null;
  }
}
