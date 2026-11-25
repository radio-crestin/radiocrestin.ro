import 'announcement.dart' show AnnouncementFilters;

/// What a slide shows (`slides[].type` in the stories API).
enum StorySlideType {
  image,
  video,
  youtube,
  instagram;

  static StorySlideType? parse(Object? value) =>
      values.where((type) => type.name == value).firstOrNull;
}

/// How a slide asks for its call to action (`cta.style`).
enum StoryCtaStyle {
  /// An animated "swipe up" hint; swiping up runs the action.
  swipeUp,

  /// A labelled button.
  button,

  /// Both the hint and the button.
  both;

  bool get hasSwipeUp => this != button;
  bool get hasButton => this != swipeUp;

  static StoryCtaStyle parse(Object? value) => switch (value) {
        'swipe_up' => swipeUp,
        'both' => both,
        _ => button,
      };
}

/// Where a call to action leads (`cta.target.type`).
enum StoryCtaTargetType {
  /// A web page, in the browser or the in-app browser.
  url,

  /// A native app (YouTube, Instagram, …): its universal link, else its
  /// scheme, else the web page.
  appLink,

  /// A page of this app: a station, a song, an announcement, the settings.
  inApp,

  /// Another story.
  story;

  String get apiName => switch (this) {
        appLink => 'app_link',
        inApp => 'in_app',
        _ => name,
      };

  static StoryCtaTargetType? parse(Object? value) =>
      values.where((type) => type.apiName == value).firstOrNull;
}

/// The pages of this app a call to action can open (`target.route`).
enum StoryInAppRoute {
  station,
  song,
  announcement,
  settings,
  form,

  /// Shares the app, like the announcements' `share` action.
  share;

  /// Whether the route names its page by [StoryCtaTarget.slug].
  bool get needsSlug => this != settings && this != share;

  static StoryInAppRoute? parse(Object? value) =>
      values.where((route) => route.name == value).firstOrNull;
}

/// Where a call to action leads, as the API sends it; each type sends
/// only its own keys (`backend/docs/stories-api.md`, "CTA").
class StoryCtaTarget {
  const StoryCtaTarget({
    required this.type,
    this.url,
    this.appUrl,
    this.androidIntentUri,
    this.fallbackUrl,
    this.inAppBrowser = false,
    this.route,
    this.slug,
    this.stationSlug,
    this.songTitle,
    this.shareText,
    this.storySlug,
  });

  final StoryCtaTargetType type;

  /// The web page of a [StoryCtaTargetType.url].
  final String? url;

  /// The app's universal link (`https://…`) or own scheme
  /// (`spotify:track:…`), of a [StoryCtaTargetType.appLink].
  final String? appUrl;

  /// An Android intent tried first on Android, as the announcements'
  /// `android_intent` action does.
  final String? androidIntentUri;

  /// The web page opened when no app takes the link, or for a route this
  /// app does not know.
  final String? fallbackUrl;

  /// Whether a [StoryCtaTargetType.url] opens inside the app
  /// (`open_in: in_app_browser`).
  final bool inAppBrowser;

  final StoryInAppRoute? route;

  /// The station, announcement or form slug, or the song id, of [route].
  final String? slug;

  /// The station a [StoryInAppRoute.song] plays on, when set.
  final String? stationSlug;

  /// "Artist - Name" of a [StoryInAppRoute.song], when sent.
  final String? songTitle;

  /// The text a [StoryInAppRoute.share] sends with the link.
  final String? shareText;
  final String? storySlug;

  /// Whether this app can run it: a target type or route newer than the
  /// app, or one missing what it needs, can only open [fallbackUrl].
  bool get isRunnable => switch (type) {
        StoryCtaTargetType.url => url != null,
        StoryCtaTargetType.appLink => appUrl != null || fallbackUrl != null,
        StoryCtaTargetType.inApp =>
          route != null && (!route!.needsSlug || slug != null),
        StoryCtaTargetType.story => storySlug != null,
      };

  /// Parses a target; one this app can't run becomes a link to its
  /// `fallback_url`, and without one it is null (the CTA hides).
  static StoryCtaTarget? fromJson(Object? json) {
    if (json is! Map) return null;
    final fallback = _string(json['fallback_url']);
    final type = StoryCtaTargetType.parse(json['type']);
    final song = json['song'] is Map ? json['song'] as Map : const {};
    final target = type == null
        ? null
        : StoryCtaTarget(
            type: type,
            url: _string(json['url']),
            appUrl: _string(json['app_url']),
            androidIntentUri: _string(json['android_intent_uri']),
            fallbackUrl: fallback,
            inAppBrowser: json['open_in'] == 'in_app_browser',
            route: StoryInAppRoute.parse(json['route']),
            slug: _string(json['slug']),
            stationSlug: _string(json['station_slug']),
            songTitle: _songTitle(song),
            shareText: _string(json['share_text']),
            storySlug: _string(json['story_slug']),
          );
    if (target != null && target.isRunnable) return target;
    if (fallback == null) return null;
    return StoryCtaTarget(type: StoryCtaTargetType.url, url: fallback);
  }

  static String? _songTitle(Map song) {
    final name = _string(song['name']);
    final artist = _string(song['artist']);
    if (name == null) return null;
    return artist == null ? name : '$artist - $name';
  }
}

/// A slide's call to action: how it asks, what it says, where it leads.
class StoryCta {
  const StoryCta({
    required this.style,
    required this.label,
    required this.target,
  });

  final StoryCtaStyle style;
  final String label;
  final StoryCtaTarget target;

  /// The label shown when the admin left it empty.
  static const defaultLabel = 'Vezi mai mult';

  static StoryCta? fromJson(Object? json) {
    if (json is! Map) return null;
    final target = StoryCtaTarget.fromJson(json['target']);
    if (target == null) return null;
    return StoryCta(
      style: StoryCtaStyle.parse(json['style']),
      label: _string(json['label']) ?? defaultLabel,
      target: target,
    );
  }
}

/// An Instagram post or reel, with what the backend stored about it.
class StoryInstagram {
  const StoryInstagram({
    required this.url,
    this.isReel = false,
    this.thumbnailUrl,
    this.authorName,
    this.caption,
    this.mediaUrl,
    this.mediaIsVideo = false,
    String? embedUrl,
  }) : _embedUrl = embedUrl;

  final String url;
  final bool isReel;
  final String? thumbnailUrl;
  final String? authorName;
  final String? caption;

  /// The post's own media, when Instagram gave it.
  final String? mediaUrl;
  final bool mediaIsVideo;

  final String? _embedUrl;

  /// Instagram's embed page for [url], which plays the post in a web view.
  String get embedUrl {
    final given = _embedUrl;
    if (given != null) return given;
    final uri = Uri.tryParse(url);
    if (uri == null) return url;
    final path = uri.path.endsWith('/') ? uri.path : '${uri.path}/';
    return uri.replace(path: '${path}embed/', query: '').toString()
        .replaceFirst(RegExp(r'\?$'), '');
  }

  static StoryInstagram? fromJson(Object? json) {
    if (json is! Map) return null;
    final map = json;
    final link = _string(map['url']);
    if (link == null) return null;
    return StoryInstagram(
      url: link,
      isReel: map['kind'] == 'reel' || link.contains('/reel/'),
      thumbnailUrl: _string(map['thumbnail_url']),
      authorName: _string(map['author_name']),
      caption: _string(map['caption']),
      mediaUrl: _string(map['media_url']),
      mediaIsVideo: map['media_type'] == 'video',
      embedUrl: _string(map['embed_url']),
    );
  }
}

/// One slide of a story.
class StorySlide {
  const StorySlide({
    required this.id,
    required this.type,
    this.mediaUrl,
    this.posterUrl,
    this.duration = defaultDuration,
    this.landscape = false,
    this.hasSound = false,
    this.youtubeUrl,
    this.instagram,
    this.cta,
  });

  final String id;
  final StorySlideType type;

  /// The image, or the video file.
  final String? mediaUrl;

  /// A still shown while the media loads: the video's poster frame, the
  /// YouTube or Instagram thumbnail.
  final String? posterUrl;

  /// How long the slide shows; a video's own length once it is known.
  final Duration duration;
  final bool landscape;

  /// Whether the video plays with sound, which ducks the radio.
  final bool hasSound;
  final String? youtubeUrl;
  final StoryInstagram? instagram;
  final StoryCta? cta;

  /// The call to action the viewer shows: the slide's own; without one,
  /// an Instagram post or a YouTube video offers to open in its app.
  StoryCta? get effectiveCta {
    final own = cta;
    if (own != null) return own;
    final link = switch (type) {
      StorySlideType.instagram => instagram?.url,
      StorySlideType.youtube => youtubeUrl,
      _ => null,
    };
    if (link == null) return null;
    return StoryCta(
      style: StoryCtaStyle.button,
      label: type == StorySlideType.instagram
          ? 'Deschide în Instagram'
          : 'Deschide în YouTube',
      target: StoryCtaTarget(
        type: StoryCtaTargetType.appLink,
        appUrl: link,
        fallbackUrl: link,
      ),
    );
  }

  static const defaultDuration = Duration(seconds: 6);

  /// The shortest and longest a slide's timer runs.
  static const minDuration = Duration(seconds: 2);
  static const maxDuration = Duration(seconds: 60);

  /// Whether a player decides when the slide ends (a video, YouTube, a
  /// reel), rather than its timer.
  bool get isPlayable => switch (type) {
        StorySlideType.image => false,
        StorySlideType.video || StorySlideType.youtube => true,
        StorySlideType.instagram => instagram?.isReel ?? false,
      };

  /// Whether the radio steps back while this slide shows.
  bool get ducksRadio => switch (type) {
        StorySlideType.image => false,
        StorySlideType.video => hasSound,
        StorySlideType.youtube => true,
        StorySlideType.instagram => instagram?.isReel ?? false,
      };

  static StorySlide? fromJson(Object? json) {
    if (json is! Map) return null;
    final type = StorySlideType.parse(json['type']);
    final id = json['id'];
    if (type == null || id == null) return null;
    final slide = StorySlide(
      id: '$id',
      type: type,
      mediaUrl: _string(json['media_url']),
      posterUrl: _string(json['poster_url']),
      duration: _duration(json['duration_seconds']),
      landscape: json['orientation'] == 'landscape',
      hasSound: json['has_sound'] == true,
      youtubeUrl: _string(json['youtube_url']),
      instagram: type == StorySlideType.instagram
          ? StoryInstagram.fromJson(json['instagram'])
          : null,
      cta: StoryCta.fromJson(json['cta']),
    );
    return slide._isComplete ? slide : null;
  }

  bool get _isComplete => switch (type) {
        StorySlideType.image || StorySlideType.video => mediaUrl != null,
        StorySlideType.youtube => youtubeUrl != null,
        StorySlideType.instagram => instagram != null,
      };

  static Duration _duration(Object? seconds) {
    if (seconds is! num || seconds <= 0) return defaultDuration;
    final duration = Duration(milliseconds: (seconds * 1000).round());
    if (duration < minDuration) return minDuration;
    if (duration > maxDuration) return maxDuration;
    return duration;
  }
}

/// When a story opens by itself (`display` in the API).
///
/// A story opens by itself the first time it is due, then again every
/// [everyDays] days or [everyActions] user actions, whichever comes
/// first, at most [maxShows] times. Without either interval it opens by
/// itself once.
class StoryDisplay {
  const StoryDisplay({
    this.autoOpen = false,
    this.everyDays,
    this.everyActions,
    this.maxShows,
  });

  final bool autoOpen;
  final int? everyDays;
  final int? everyActions;
  final int? maxShows;

  bool get repeats => everyDays != null || everyActions != null;

  static StoryDisplay fromJson(Object? json) {
    if (json is! Map) return const StoryDisplay();
    return StoryDisplay(
      autoOpen: json['auto_open'] == true,
      everyDays: _positive(json['every_days']),
      everyActions: _positive(json['every_actions']),
      maxShows: _positive(json['max_shows']),
    );
  }
}

/// A story: a few slides shown one after the other, full screen.
class Story {
  const Story({
    required this.slug,
    required this.title,
    required this.slides,
    this.coverUrl,
    this.shareUrl,
    this.startsAt,
    this.endsAt,
    this.likeCount = 0,
    this.filters = const AnnouncementFilters(),
    this.display = const StoryDisplay(),
  });

  final String slug;
  final String title;
  final List<StorySlide> slides;

  /// The bubble's picture; the first slide's image or poster without one.
  final String? coverUrl;

  /// The story's page on radiocrestin.ro, which the share sheet sends.
  final String? shareUrl;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final int likeCount;
  final AnnouncementFilters filters;
  final StoryDisplay display;

  /// The bubble's picture, falling back to the first slide's.
  String? get bubbleImageUrl {
    if (coverUrl != null) return coverUrl;
    for (final slide in slides) {
      final url = switch (slide.type) {
        StorySlideType.image => slide.mediaUrl,
        _ => slide.posterUrl ?? slide.instagram?.thumbnailUrl,
      };
      if (url != null) return url;
    }
    return null;
  }

  bool isLiveAt(DateTime now) =>
      (startsAt == null || !startsAt!.isAfter(now)) &&
      (endsAt == null || endsAt!.isAfter(now));

  /// Parses one story, or null without a slug or a slide the app can
  /// show (slide types newer than this app are left out).
  static Story? fromJson(Object? json) {
    if (json is! Map) return null;
    final slug = _string(json['slug']);
    final slides = (json['slides'] as List? ?? const [])
        .map(StorySlide.fromJson)
        .whereType<StorySlide>()
        .toList();
    if (slug == null || slides.isEmpty) return null;
    final likes = json['like_count'];
    return Story(
      slug: slug,
      title: _string(json['title']) ?? '',
      slides: slides,
      coverUrl: _string(json['cover_url']),
      shareUrl: _string(json['share_url']),
      startsAt: _date(json['starts_at']),
      endsAt: _date(json['ends_at']),
      likeCount: likes is int && likes > 0 ? likes : 0,
      filters: AnnouncementFilters.fromJson(json['filters']),
      display: StoryDisplay.fromJson(json['display']),
    );
  }

  Story copyWith({int? likeCount}) => Story(
        slug: slug,
        title: title,
        slides: slides,
        coverUrl: coverUrl,
        shareUrl: shareUrl,
        startsAt: startsAt,
        endsAt: endsAt,
        likeCount: likeCount ?? this.likeCount,
        filters: filters,
        display: display,
      );
}

String? _string(Object? value) =>
    value is String && value.trim().isNotEmpty ? value.trim() : null;

int? _positive(Object? value) => value is int && value > 0 ? value : null;

DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
