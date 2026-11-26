import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io' show Platform;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:rxdart/rxdart.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants.dart';
import '../globals.dart' as globals;
import 'analytics_service.dart';
import 'announcement_store.dart';
import 'story.dart';
import 'story_schedule.dart';
import 'story_store.dart';

/// What happened to a story, as `POST /stories/events/` names it.
enum StoryEvent {
  view,
  autoOpen,
  slideView,
  complete,
  like,
  unlike,
  ctaClick,
  share;

  String get apiName => switch (this) {
        autoOpen => 'auto_open',
        slideView => 'slide_view',
        ctaClick => 'cta_click',
        _ => name,
      };
}

/// How posting a comment went.
enum StoryCommentResult {
  posted,

  /// Too many comments from this phone lately (`429`): later.
  tooMany,

  /// Only profiles comment on this story, and this phone has none (`403`).
  notAllowed,
  failed,
}

/// A page of a story's comments, newest first.
class StoryCommentPage {
  const StoryCommentPage({
    required this.comments,
    this.count,
    this.nextBefore,
  });

  final List<StoryComment> comments;

  /// All the story's visible comments, when the API said.
  final int? count;

  /// The id to ask the next page [before]; null on the last page.
  final String? nextBefore;
}

/// One bubble of the stories bar.
class StoryBubble {
  const StoryBubble(this.story, {required this.highlighted});

  final Story story;

  /// Due, or with a slide never seen: the bubble's ring is coloured.
  final bool highlighted;
}

/// Loads the stories, keeps what this device remembers about them, and
/// reports what the listener does with them
/// (`backend/docs/stories-api.md`).
///
/// Like the announcements: the list is the same for everyone (Cloudflare
/// caches it), the last one is kept for the next launch, and events are
/// sent in batches.
class StoriesService with WidgetsBindingObserver {
  StoriesService({
    required SharedPreferences prefs,
    http.Client? client,
    DateTime Function()? clock,
  })  : _prefs = prefs,
        _store = StoryStore(prefs),
        _client = client ?? http.Client(),
        _clock = clock ?? DateTime.now {
    WidgetsBinding.instance.addObserver(this);
    _feed = _Feed.parse(_store.feed);
    liked = BehaviorSubject.seeded(_store.liked);
    _publish();
  }

  final SharedPreferences _prefs;
  final StoryStore _store;
  final http.Client _client;
  final DateTime Function() _clock;

  /// The bar's bubbles, highlighted first; empty when there are none.
  final BehaviorSubject<List<StoryBubble>> bubbles =
      BehaviorSubject.seeded(const []);

  /// The stories this device likes.
  late final BehaviorSubject<Set<String>> liked;

  /// The freshest like counts the events answer gave, by slug.
  final BehaviorSubject<Map<String, int>> likeCounts =
      BehaviorSubject.seeded(const {});

  _Feed _feed = _Feed.empty;

  /// Stories fetched one by one (a CTA to a story not in the list).
  final Map<String, Story> _single = {};

  bool _autoOpenedThisLaunch = false;

  static const _timeout = Duration(seconds: 8);
  static const _flushInterval = Duration(seconds: 5);
  static const _maxEventsPerRequest = 100;
  static const _maxQueuedEvents = 500;

  /// A return to the app after this long counts as an app open.
  static const appOpenGap = Duration(minutes: 30);

  final List<Map<String, Object?>> _queue = [];
  Timer? _flushTimer;
  bool _flushing = false;
  bool _disposed = false;

  static String get platform => Platform.isIOS ? 'ios' : 'android';

  static String get _locale =>
      ui.PlatformDispatcher.instance.locale.toLanguageTag();

  String? get _previewToken =>
      _prefs.getString(AnnouncementStore.previewTokenKey);

  StorySchedule get _schedule =>
      StorySchedule(now: _clock(), actions: _store.actions);

  /// The settings' gap between two auto-opens, in actions.
  int get autoOpenGapActions => _feed.autoOpenGapActions;

  /// Every story the API listed that this device may see, in its order.
  List<Story> get stories => _feed.stories
      .where((story) => story.filters.matches(
            platform: platform,
            locale: _locale,
            appVersion: globals.appVersion,
            country: _prefs.getString(AnnouncementStore.countryKey),
          ))
      .toList();

  StoryHistory historyOf(String slug) => _store.history(slug);

  /// The story [slug], from the list or fetched one by one; null when it
  /// is gone.
  Future<Story?> find(String slug) async {
    final listed = _feed.stories.where((s) => s.slug == slug).firstOrNull;
    if (listed != null) return listed;
    final cached = _single[slug];
    if (cached != null) return cached;
    try {
      final response = await _client
          .get(_withPreview(
              Uri.parse('${CONSTANTS.STORIES_URL}/${Uri.encodeComponent(slug)}/')))
          .timeout(_timeout);
      if (response.statusCode != 200) return null;
      final story = Story.fromJson(jsonDecode(utf8.decode(response.bodyBytes)));
      if (story != null) _single[slug] = story;
      return story;
    } catch (e) {
      developer.log('Stories: $slug not fetched: $e');
      return null;
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────

  /// Counts this launch as an app open and fetches the list; the kept one
  /// shows meanwhile. Never holds the first frame.
  Future<void> loadAtStartup() async {
    await _countAppOpen();
    _publish();
    unawaited(refresh());
    unawaited(_restoreLikes());
  }

  Future<void>? _inFlight;

  /// Fetches the list (304 when unchanged), keeps it and shows it.
  Future<void> refresh() =>
      _inFlight ??= _refresh().whenComplete(() => _inFlight = null);

  Future<void> _refresh() async {
    final preview = _previewToken;
    final etag = _store.feedEtag;
    try {
      final response = await _client.get(
        _withPreview(Uri.parse('${CONSTANTS.STORIES_URL}/')),
        headers: {
          if (preview == null && etag != null && _store.feed != null)
            'If-None-Match': etag,
        },
      ).timeout(_timeout);
      if (response.statusCode == 304 || _disposed) return;
      if (response.statusCode != 200) return;
      final body = utf8.decode(response.bodyBytes);
      _feed = _Feed.parse(body);
      if (preview == null) {
        await _store.saveFeed(body, response.headers['etag']);
      }
      await _store.forgetExcept(_feed.stories.map((s) => s.slug).toSet());
      _publish();
    } catch (e) {
      developer.log('Stories: list not fetched: $e');
    }
  }

  Uri _withPreview(Uri uri) {
    final token = _previewToken;
    return token == null
        ? uri
        : uri.replace(queryParameters: {'preview': token});
  }

  /// After a reinstall the device's likes are on the server only: asks
  /// for them once.
  Future<void> _restoreLikes() async {
    if (_store.likesRestored || globals.deviceId.isEmpty) return;
    try {
      final response = await _client
          .get(Uri.parse('${CONSTANTS.STORIES_URL}/liked/')
              .replace(queryParameters: {'device_id': globals.deviceId}))
          .timeout(_timeout);
      if (response.statusCode != 200) return;
      final json = jsonDecode(response.body);
      final slugs = json is Map ? json['liked'] : null;
      if (slugs is! List) return;
      await _saveLiked({...liked.value, ...slugs.whereType<String>()});
      await _store.markLikesRestored();
    } catch (e) {
      developer.log('Stories: likes not restored: $e');
    }
  }

  /// Shows the bar as the list and this device's history make it now.
  void _publish() {
    final schedule = _schedule;
    bubbles.add([
      for (final story in schedule.bar(stories, _store.history))
        StoryBubble(story,
            highlighted:
                schedule.isHighlighted(story, _store.history(story.slug))),
    ]);
  }

  // ── Actions and auto-open ──────────────────────────────────────────────

  /// A cold start, or a return after [appOpenGap] away: one action.
  Future<void> _countAppOpen() async {
    await _store.saveLastActive(_clock());
    await _store.countAction();
  }

  /// A station playback started: one action for the display rules.
  Future<void> onPlayback() async {
    await _store.countAction();
    _publish();
  }

  /// The story to open by itself now, or null: at most one per app open,
  /// [autoOpenGapActions] actions after the last.
  Story? autoOpenCandidate() => _schedule.autoOpen(
        stories,
        _store.history,
        openedThisLaunch: _autoOpenedThisLaunch,
        actionsAtLastAutoOpen: _store.actionsAtLastAutoOpen,
        gapActions: autoOpenGapActions,
      );

  // ── What the listener does ─────────────────────────────────────────────

  /// The viewer opened [story]: a show, by a tap or by itself.
  Future<void> recordShow(Story story, {required bool auto}) async {
    if (auto) {
      _autoOpenedThisLaunch = true;
      await _store.saveAutoOpen();
    }
    final history = _store.history(story.slug);
    await _store.saveHistory(
        story.slug, history.shown(_clock(), _store.actions));
    report(auto ? StoryEvent.autoOpen : StoryEvent.view, story);
  }

  /// [slide] of [story] was on screen.
  Future<void> recordSlideView(Story story, StorySlide slide) async {
    final history = _store.history(story.slug);
    final seen = history.withSeenSlide(slide.id);
    if (!identical(seen, history)) {
      await _store.saveHistory(story.slug, seen);
    }
    report(StoryEvent.slideView, story, slide: slide);
  }

  /// The viewer closed: the bar shows the stories' new state.
  void viewerClosed() => _publish();

  bool isLiked(String slug) => liked.value.contains(slug);

  /// The like count to show for [story]: the freshest known.
  int likeCountOf(Story story) =>
      likeCounts.value[story.slug] ?? story.likeCount;

  /// Likes or unlikes [story] at once; the API hears it right away.
  Future<void> toggleLike(Story story) async {
    final wasLiked = isLiked(story.slug);
    final count = likeCountOf(story);
    likeCounts.add({
      ...likeCounts.value,
      story.slug: wasLiked ? (count - 1).clamp(0, 1 << 31) : count + 1,
    });
    final next = {...liked.value};
    wasLiked ? next.remove(story.slug) : next.add(story.slug);
    await _saveLiked(next);
    report(wasLiked ? StoryEvent.unlike : StoryEvent.like, story);
  }

  Future<void> _saveLiked(Set<String> slugs) async {
    liked.add(slugs);
    await _store.saveLiked(slugs);
  }

  /// The longest comment.
  static const maxCommentLength = 500;

  /// Whether this phone may comment on a story, and as whom, by slug: what
  /// its comments list said last ([loadCommentAccess]).
  final BehaviorSubject<Map<String, StoryCommentAccess>> commentAccess =
      BehaviorSubject.seeded(const {});

  /// Null until the story's comments list answered.
  StoryCommentAccess? commentAccessOf(Story story) =>
      story.comments.enabled ? commentAccess.value[story.slug] : null;

  /// Asks whether this phone may comment on [story] (a story shown in the
  /// viewer); the first page of its comments says, and its count.
  Future<void> loadCommentAccess(Story story) async {
    if (story.comments.enabled) await fetchComments(story);
  }

  void _setCommentAccess(Story story, StoryCommentAccess access) =>
      commentAccess.add({...commentAccess.value, story.slug: access});

  /// The comment counts this phone knows better than the list (its own
  /// comments added at once), by slug.
  final BehaviorSubject<Map<String, int>> commentCounts =
      BehaviorSubject.seeded(const {});

  int commentCountOf(Story story) =>
      commentCounts.value[story.slug] ?? story.comments.count;

  Uri _commentsUri(Story story, [String? id]) => Uri.parse(
      '${CONSTANTS.STORIES_URL}/${Uri.encodeComponent(story.slug)}/comments/'
      '${id == null ? '' : '${Uri.encodeComponent(id)}/'}');

  /// A page of [story]'s comments, newest first, [before] the comment id
  /// given; null when they could not be had.
  Future<StoryCommentPage?> fetchComments(Story story, {String? before}) async {
    try {
      final response = await _client
          .get(_commentsUri(story).replace(queryParameters: {
            'device_id': globals.deviceId,
            if (before != null) 'before': before,
          }))
          .timeout(_timeout);
      if (response.statusCode != 200) return null;
      final json = jsonDecode(utf8.decode(response.bodyBytes));
      if (json is! Map) return null;
      final page = StoryCommentPage(
        comments: (json['comments'] as List? ?? const [])
            .map(StoryComment.fromJson)
            .whereType<StoryComment>()
            .toList(),
        count: json['count'] is int ? json['count'] as int : null,
        nextBefore: json['next_before'] == null ? null : '${json['next_before']}',
      );
      final count = page.count;
      if (count != null && before == null) {
        commentCounts.add({...commentCounts.value, story.slug: count});
      }
      if (before == null) {
        _setCommentAccess(story, StoryCommentAccess.fromJson(json));
      }
      return page;
    } catch (e) {
      developer.log('Stories: comments not fetched: $e');
      return null;
    }
  }

  /// Posts [text] as a public comment on [story], under this phone's
  /// profile, once: a refused one (429) counts toward the limit, so it is
  /// never retried.
  Future<(StoryCommentResult, StoryComment?)> postComment(
    Story story,
    StorySlide? slide,
    String text,
  ) async {
    final comment = text.trim();
    if (comment.isEmpty || !story.comments.enabled) {
      return (StoryCommentResult.failed, null);
    }
    AnalyticsService.instance.capture('story_comment_posted', {
      'story_slug': story.slug,
      if (slide != null) 'slide_id': slide.id,
      'length': comment.length,
      'platform': platform,
    });
    try {
      final response = await _client
          .post(
            _commentsUri(story),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'device_id': globals.deviceId,
              'platform': platform,
              'app_version': globals.appVersion,
              'locale': _locale,
              if (slide != null) 'slide': int.tryParse(slide.id) ?? slide.id,
              'text': comment.length > maxCommentLength
                  ? comment.substring(0, maxCommentLength)
                  : comment,
            }),
          )
          .timeout(_timeout);
      if (response.statusCode == 429) return (StoryCommentResult.tooMany, null);
      if (response.statusCode == 403) {
        // Only profiles comment here: the field goes away.
        _setCommentAccess(story, const StoryCommentAccess(canComment: false));
        return (StoryCommentResult.notAllowed, null);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return (StoryCommentResult.failed, null);
      }
      commentCounts.add({
        ...commentCounts.value,
        story.slug: commentCountOf(story) + 1,
      });
      StoryComment? posted;
      try {
        final json = jsonDecode(utf8.decode(response.bodyBytes));
        posted = json is Map ? StoryComment.fromJson(json['comment']) : null;
      } on FormatException {
        posted = null;
      }
      return (
        StoryCommentResult.posted,
        posted ??
            StoryComment(
              id: 'local-${DateTime.now().microsecondsSinceEpoch}',
              authorName: commentAccessOf(story)?.profile?.name ??
                  StoryComment.anonymousName,
              authorAvatarUrl: commentAccessOf(story)?.profile?.avatarUrl,
              text: comment,
              createdAt: DateTime.now(),
              mine: true,
            ),
      );
    } catch (e) {
      developer.log('Stories: comment not posted: $e');
      return (StoryCommentResult.failed, null);
    }
  }

  /// Deletes this phone's own [comment]; false when it could not.
  Future<bool> deleteComment(Story story, StoryComment comment) async {
    try {
      final response = await _client
          .delete(_commentsUri(story, comment.id)
              .replace(queryParameters: {'device_id': globals.deviceId}))
          .timeout(_timeout);
      final ok = response.statusCode >= 200 && response.statusCode < 300;
      if (ok) {
        commentCounts.add({
          ...commentCounts.value,
          story.slug: (commentCountOf(story) - 1).clamp(0, 1 << 31),
        });
      }
      return ok;
    } catch (e) {
      developer.log('Stories: comment not deleted: $e');
      return false;
    }
  }

  /// Queues [event] for the API and sends it to PostHog. Likes and CTA
  /// taps go at once: a CTA may take the listener out of the app.
  void report(
    StoryEvent event,
    Story story, {
    StorySlide? slide,
    String? target,
  }) {
    AnalyticsService.instance.capture('story_${event.apiName}', {
      'story_slug': story.slug,
      if (slide != null) 'slide_id': slide.id,
      if (slide != null) 'slide_type': slide.type.name,
      if (target != null) 'target': target,
      'platform': platform,
    });
    if (_queue.length >= _maxQueuedEvents) _queue.removeAt(0);
    _queue.add({
      'type': event.apiName,
      'story': story.slug,
      if (slide != null) 'slide': int.tryParse(slide.id) ?? slide.id,
      if (target != null) 'target': target,
      'at': _clock().toUtc().toIso8601String(),
    });
    final urgent = event == StoryEvent.like ||
        event == StoryEvent.unlike ||
        event == StoryEvent.ctaClick ||
        event == StoryEvent.share;
    if (urgent) {
      unawaited(flush());
    } else {
      _flushTimer ??= Timer(_flushInterval, flush);
    }
  }

  /// Sends the queued events; those that fail wait for the next flush.
  /// The answer carries fresh like counts.
  Future<void> flush() async {
    _flushTimer?.cancel();
    _flushTimer = null;
    if (_flushing || _queue.isEmpty) return;
    _flushing = true;
    final batch = _queue.take(_maxEventsPerRequest).toList();
    _queue.removeRange(0, batch.length);
    try {
      final response = await _client
          .post(
            Uri.parse(CONSTANTS.STORY_EVENTS_URL),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'device_id': globals.deviceId,
              'platform': platform,
              'app_version': globals.appVersion,
              'locale': _locale,
              'events': batch,
            }),
          )
          .timeout(_timeout);
      if (response.statusCode >= 500 || response.statusCode == 429) {
        _queue.insertAll(0, batch);
      }
      if (response.statusCode == 200) _readAnswer(response.body);
    } catch (e) {
      developer.log('Stories: events not sent: $e');
      _queue.insertAll(0, batch);
    } finally {
      _flushing = false;
    }
    if (_queue.isNotEmpty) _flushTimer ??= Timer(_flushInterval, flush);
  }

  /// Takes the answer's like counts. Its `liked` is not applied: a tap
  /// made while the request was on its way would be undone.
  void _readAnswer(String body) {
    try {
      final json = jsonDecode(body);
      final counts = json is Map ? json['like_counts'] : null;
      if (counts is! Map) return;
      likeCounts.add({
        ...likeCounts.value,
        for (final entry in counts.entries)
          if (entry.value is int) '${entry.key}': entry.value as int,
      });
    } on FormatException {
      // No counts in an empty answer.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        unawaited(_store.saveLastActive(_clock()));
        unawaited(flush());
      case AppLifecycleState.resumed:
        unawaited(_onResumed());
      default:
        break;
    }
  }

  Future<void> _onResumed() async {
    final last = _store.lastActive;
    if (last != null && _clock().difference(last) < appOpenGap) return;
    _autoOpenedThisLaunch = false;
    await _countAppOpen();
    await refresh();
    _publish();
  }

  void dispose() {
    _disposed = true;
    _flushTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }
}

/// A list as the API sends it.
class _Feed {
  const _Feed(this.stories, this.autoOpenGapActions);

  static const empty = _Feed([], 0);

  final List<Story> stories;
  final int autoOpenGapActions;

  static _Feed parse(String? body) {
    if (body == null) return empty;
    try {
      final json = jsonDecode(body);
      if (json is! Map) return empty;
      final settings = json['settings'];
      final gap = settings is Map ? settings['auto_open_gap_actions'] : null;
      return _Feed(
        (json['stories'] as List? ?? const [])
            .map(Story.fromJson)
            .whereType<Story>()
            .toList(),
        gap is int && gap > 0 ? gap : 0,
      );
    } on FormatException {
      return empty;
    }
  }
}
