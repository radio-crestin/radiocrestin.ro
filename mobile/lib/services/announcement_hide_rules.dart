/// When an announcement stops showing on this device, as
/// `backend/docs/announcement-hide-rules.md` sets out: the API sends the
/// rules, the device counts per slug and hides it here. A copy of the
/// backend's reference (`services/announcement_hide_rules.py`), checked
/// against the same cases (`announcement-hide-rules.cases.json`).
library;

/// Which clicks count toward `hide_after_clicks` (`hide_click_target`).
enum HideClickTarget {
  /// The main button, or the card when the whole card is the button.
  main,

  /// Every click: also a link in the description.
  any;

  /// [main] unless [value] is `any` (absent in older lists).
  static HideClickTarget parse(Object? value) => value == 'any' ? any : main;
}

/// Why an announcement no longer shows: the first rule that hides it.
enum HideReason {
  dismissed,
  maxImpressions,
  clicks,
  impressionsAfterClick;

  /// The name the backend's reference and the shared cases use.
  String get apiName => switch (this) {
        maxImpressions => 'max_impressions',
        impressionsAfterClick => 'impressions_after_click',
        _ => name,
      };
}

/// An announcement's hide rules, as the API sends them; absent keys are
/// null and leave it showing as it did before.
class AnnouncementHideRules {
  const AnnouncementHideRules({
    this.dismissible = true,
    this.maxImpressions,
    this.hideAfterClicks,
    this.impressionsAfterClick,
    this.clickTarget = HideClickTarget.main,
  });

  final bool dismissible;
  final int? maxImpressions;

  /// Hide it after this many counted clicks on the device.
  final int? hideAfterClicks;

  /// After those clicks, show it this many more times, then hide it.
  final int? impressionsAfterClick;
  final HideClickTarget clickTarget;

  static AnnouncementHideRules fromJson(Map<Object?, Object?> json) =>
      AnnouncementHideRules(
        dismissible: json['dismissible'] != false,
        maxImpressions: _positive(json['max_impressions']),
        hideAfterClicks: _positive(json['hide_after_clicks']),
        impressionsAfterClick: _positive(json['impressions_after_click']),
        clickTarget: HideClickTarget.parse(json['hide_click_target']),
      );

  /// Whether a `clicked` event with [target] (`button`, `card`, `link`,
  /// or null from older clients) counts toward [hideAfterClicks].
  bool countsClick(String? target) =>
      clickTarget == HideClickTarget.any ||
      target == null ||
      target == 'button' ||
      target == 'card';

  /// Whether the device's counted clicks reached [hideAfterClicks].
  bool clicksReached(int clicks) {
    final limit = hideAfterClicks;
    return limit != null && clicks >= limit;
  }

  /// Whether reaching [hideAfterClicks] hides it at once (no reminders).
  bool get hidesAtClick =>
      hideAfterClicks != null && impressionsAfterClick == null;

  /// Why it no longer shows with [counts], or null when it still shows.
  HideReason? hideReason(AnnouncementCounts counts) {
    if (dismissible && counts.dismissed) return HideReason.dismissed;
    final max = maxImpressions;
    if (max != null && counts.impressions >= max) {
      return HideReason.maxImpressions;
    }
    if (!clicksReached(counts.clicks)) return null;
    final reminders = impressionsAfterClick;
    if (reminders == null) return HideReason.clicks;
    return counts.impressionsAfterClicks >= reminders
        ? HideReason.impressionsAfterClick
        : null;
  }

  /// Only counts of 1 or more are rules; 0 and junk are "not set".
  static int? _positive(Object? value) {
    final number = value is num ? value.toInt() : null;
    return number != null && number >= 1 ? number : null;
  }
}

/// What this device remembers about one announcement.
class AnnouncementCounts {
  const AnnouncementCounts({
    this.impressions = 0,
    this.clicks = 0,
    this.impressionsAfterClicks = 0,
    this.dismissed = false,
  });

  final int impressions;

  /// The clicks that counted, per the rules' click target.
  final int clicks;

  /// Impressions after the click that reached `hide_after_clicks`.
  final int impressionsAfterClicks;
  final bool dismissed;
}
