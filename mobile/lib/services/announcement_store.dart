import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'announcement_hide_rules.dart';

/// What this device remembers about announcements, in the
/// SharedPreferences keys the announcements spec names: which were closed,
/// how often each was seen and clicked, where rotation is,
/// which station announcements were opened, the device's country, a
/// preview token, and the last list with its ETag.
class AnnouncementStore {
  AnnouncementStore(this._prefs);

  static const dismissedKey = 'announcements_dismissed';
  static const impressionsKey = 'announcements_impressions';
  static const clicksKey = 'announcements_clicks';
  static const impressionsAfterClicksKey =
      'announcements_impressions_after_clicks';
  static const returnsKey = 'announcements_returns';
  static const startedKey = 'announcements_started';
  static const waitedKey = 'announcements_waited';
  static const rotationCursorKey = 'announcements_rotation_cursor';
  static const seenKey = 'announcements_seen';
  static const countryKey = 'announcements_country';
  static const previewTokenKey = 'announcements_preview_token';
  static const feedKey = 'announcements_feed';
  static const feedEtagKey = 'announcements_feed_etag';

  final SharedPreferences _prefs;

  /// Keys of features that are gone: the "later" button's snoozes, and
  /// the visits counted before waits counted any `count_on` events.
  static const _retiredKeys = [
    'announcements_snoozed',
    'announcements_visits_while_hidden',
  ];

  /// Drops what removed features left on the device.
  Future<void> forgetRetired() async {
    for (final key in _retiredKeys) {
      if (_prefs.containsKey(key)) await _prefs.remove(key);
    }
  }

  /// The station announcements whose sheet was opened on this device.
  Set<String> get seen => (_prefs.getStringList(seenKey) ?? const []).toSet();

  Future<void> markSeen(Iterable<String> slugs) async {
    final all = seen..addAll(slugs);
    await _prefs.setStringList(seenKey, all.toList());
  }

  /// The device's country (ISO-2) as the API last saw it, or null.
  String? get country => _prefs.getString(countryKey);

  Future<void> saveCountry(String? country) async {
    if (country == null || country.isEmpty || country == this.country) return;
    await _prefs.setString(countryKey, country.toUpperCase());
  }

  /// The token of an admin's preview link, which shows unpublished
  /// announcements; null when not previewing.
  String? get previewToken => _prefs.getString(previewTokenKey);

  Future<void> savePreviewToken(String? token) => token == null || token.isEmpty
      ? _prefs.remove(previewTokenKey)
      : _prefs.setString(previewTokenKey, token);

  /// The last list the API sent (its JSON body), or null.
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

  /// The slugs closed for good on this device.
  Set<String> get dismissed =>
      (_prefs.getStringList(dismissedKey) ?? const []).toSet();

  Future<void> dismiss(String slug) async {
    final slugs = dismissed..add(slug);
    await _prefs.setStringList(dismissedKey, slugs.toList());
  }

  /// How many times [slug] was seen on this device.
  int impressions(String slug) => _count(impressionsKey, slug);

  Future<void> countImpression(String slug) => _increment(impressionsKey, slug);

  /// The clicks on [slug] that counted toward its `hide_after_clicks`.
  int clicks(String slug) => _count(clicksKey, slug);

  Future<void> countClick(String slug) => _increment(clicksKey, slug);

  /// Impressions of [slug] after the click that reached its
  /// `hide_after_clicks`.
  int impressionsAfterClicks(String slug) =>
      _count(impressionsAfterClicksKey, slug);

  Future<void> countImpressionAfterClicks(String slug) =>
      _increment(impressionsAfterClicksKey, slug);

  /// The slugs shown at least once on this device (`show_after` is over).
  Set<String> get started =>
      (_prefs.getStringList(startedKey) ?? const []).toSet();

  /// Marks [slug] shown for the first time: its `show_after` wait is over
  /// and what it waited is spent.
  Future<void> markStarted(String slug) => Future.wait([
        _prefs.setStringList(startedKey, [...started, slug]),
        _set(waitedKey, slug, 0),
      ]);

  /// Everything this device counted for [slug], for its rules. One seen
  /// before `started` was kept (an older version) has started too.
  AnnouncementCounts counts(String slug) {
    final impressions = this.impressions(slug);
    final returns = _count(returnsKey, slug);
    return AnnouncementCounts(
      impressions: impressions,
      clicks: clicks(slug),
      impressionsAfterClicks: impressionsAfterClicks(slug),
      dismissed: dismissed.contains(slug),
      started: impressions > 0 || returns > 0 || started.contains(slug),
      returns: returns,
      waited: _count(waitedKey, slug),
    );
  }

  /// Saves [counts] as [slug]'s (a visit's or an event's: a wait counted,
  /// a first showing, or a new round as it comes back). Closing is saved
  /// by [dismiss] alone. Every count changes before the first await, so a
  /// read never sees half a round.
  Future<void> saveCounts(String slug, AnnouncementCounts counts) {
    final values = {
      impressionsKey: counts.impressions,
      clicksKey: counts.clicks,
      impressionsAfterClicksKey: counts.impressionsAfterClicks,
      returnsKey: counts.returns,
      waitedKey: counts.waited,
    };
    return Future.wait([
      if (counts.started && !started.contains(slug))
        _prefs.setStringList(startedKey, [...started, slug]),
      for (final MapEntry(:key, :value) in values.entries)
        if (_count(key, slug) != value) _set(key, slug, value),
    ]);
  }

  int _count(String key, String slug) =>
      (_readMap(key)[slug] as num?)?.toInt() ?? 0;

  Future<void> _increment(String key, String slug) =>
      _set(key, slug, _count(key, slug) + 1);

  /// Sets [slug]'s count under [key]; 0 drops it.
  Future<void> _set(String key, String slug, int value) {
    final counts = _readMap(key);
    if (value == 0) {
      counts.remove(slug);
    } else {
      counts[slug] = value;
    }
    return _prefs.setString(key, jsonEncode(counts));
  }

  int get rotationCursor => _prefs.getInt(rotationCursorKey) ?? 0;

  Future<void> advanceRotationCursor() =>
      _prefs.setInt(rotationCursorKey, rotationCursor + 1);

  Map<String, Object?> _readMap(String key) {
    try {
      final decoded = jsonDecode(_prefs.getString(key) ?? '{}');
      return decoded is Map ? decoded.cast<String, Object?>() : {};
    } on FormatException {
      return {};
    }
  }
}
