import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'story_schedule.dart';

/// What this device remembers about stories, in SharedPreferences: the
/// last list with its ETag, each story's shows and seen slides, the liked
/// stories, and the actions its display rules count.
class StoryStore {
  StoryStore(this._prefs);

  static const feedKey = 'stories_feed';
  static const feedEtagKey = 'stories_feed_etag';
  static const historyKey = 'stories_history';
  static const likedKey = 'stories_liked';
  static const likesRestoredKey = 'stories_likes_restored';
  static const actionsKey = 'stories_actions';
  static const lastAutoOpenKey = 'stories_last_auto_open_actions';
  static const lastActiveKey = 'stories_last_active';

  final SharedPreferences _prefs;

  String? get feed => _prefs.getString(feedKey);
  String? get feedEtag => _prefs.getString(feedEtagKey);

  Future<void> saveFeed(String body, String? etag) async {
    await _prefs.setString(feedKey, body);
    if (etag == null) {
      await _prefs.remove(feedEtagKey);
    } else {
      await _prefs.setString(feedEtagKey, etag);
    }
  }

  Map<String, StoryHistory>? _histories;

  Map<String, StoryHistory> get _all => _histories ??= _readHistories();

  Map<String, StoryHistory> _readHistories() {
    final raw = _prefs.getString(historyKey);
    if (raw == null) return {};
    try {
      final json = jsonDecode(raw);
      if (json is! Map) return {};
      return {
        for (final entry in json.entries)
          '${entry.key}': StoryHistory.fromJson(entry.value),
      };
    } on FormatException {
      return {};
    }
  }

  StoryHistory history(String slug) => _all[slug] ?? StoryHistory.none;

  Future<void> saveHistory(String slug, StoryHistory history) async {
    _all[slug] = history;
    await _prefs.setString(
      historyKey,
      jsonEncode({
        for (final entry in _all.entries) entry.key: entry.value.toJson(),
      }),
    );
  }

  /// Drops the histories of stories no longer listed, so the key does not
  /// grow with every story ever shown.
  Future<void> forgetExcept(Set<String> slugs) async {
    final gone = _all.keys.where((slug) => !slugs.contains(slug)).toList();
    if (gone.isEmpty) return;
    for (final slug in gone) {
      _all.remove(slug);
    }
    await _prefs.setString(
      historyKey,
      jsonEncode({
        for (final entry in _all.entries) entry.key: entry.value.toJson(),
      }),
    );
  }

  Set<String> get liked =>
      (_prefs.getStringList(likedKey) ?? const []).toSet();

  Future<void> saveLiked(Set<String> slugs) =>
      _prefs.setStringList(likedKey, slugs.toList());

  /// Whether the likes were asked from the API once (after an install).
  bool get likesRestored => _prefs.getBool(likesRestoredKey) ?? false;

  Future<void> markLikesRestored() => _prefs.setBool(likesRestoredKey, true);

  /// App opens and station playbacks, as the display rules count them.
  int get actions => _prefs.getInt(actionsKey) ?? 0;

  Future<void> countAction() => _prefs.setInt(actionsKey, actions + 1);

  /// [actions] at the last auto-open of any story; null when none did.
  int? get actionsAtLastAutoOpen => _prefs.getInt(lastAutoOpenKey);

  Future<void> saveAutoOpen() => _prefs.setInt(lastAutoOpenKey, actions);

  /// When the app was last opened or left; a return long after it is an
  /// app open.
  DateTime? get lastActive {
    final ms = _prefs.getInt(lastActiveKey);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> saveLastActive(DateTime at) =>
      _prefs.setInt(lastActiveKey, at.millisecondsSinceEpoch);
}
