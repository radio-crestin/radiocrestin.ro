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
    this.showAgainTimes,
    this.showAgainAfterVisits,
  });

  final bool dismissible;
  final int? maxImpressions;

  /// Hide it after this many counted clicks on the device.
  final int? hideAfterClicks;

  /// After those clicks, show it this many more times, then hide it.
  final int? impressionsAfterClick;
  final HideClickTarget clickTarget;

  /// After max impressions or the click rules hid it, it comes back this
  /// many times (`show_again_times`); never after closing.
  final int? showAgainTimes;

  /// How many visits it stays hidden before it comes back
  /// (`show_again_after_visits`).
  final int? showAgainAfterVisits;

  static AnnouncementHideRules fromJson(Map<Object?, Object?> json) =>
      AnnouncementHideRules(
        dismissible: json['dismissible'] != false,
        maxImpressions: _positive(json['max_impressions']),
        hideAfterClicks: _positive(json['hide_after_clicks']),
        impressionsAfterClick: _positive(json['impressions_after_click']),
        clickTarget: HideClickTarget.parse(json['hide_click_target']),
        showAgainTimes: _positive(json['show_again_times']),
        showAgainAfterVisits: _positive(json['show_again_after_visits']),
      );

  /// Whether an event of [type] (`clicked`, `secondary_clicked`, ...)
  /// on [target] (`button`, `card`, `link`, or null from older clients)
  /// counts toward [hideAfterClicks].
  bool countsClick(String type, String? target) => switch (type) {
        'secondary_clicked' => clickTarget == HideClickTarget.any,
        'clicked' => clickTarget == HideClickTarget.any ||
            target == null ||
            target == 'button' ||
            target == 'card',
        _ => false,
      };

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

  /// Whether it can come back after a round's rules hid it.
  bool get showsAgain => showAgainTimes != null && showAgainAfterVisits != null;

  /// Whether, at this visit, it comes back: max impressions or the click
  /// rules (not closing) hide it, it came back fewer than [showAgainTimes]
  /// and it stayed hidden [showAgainAfterVisits] visits. The device then
  /// starts a new round ([AnnouncementCounts.nextRound]) and shows it.
  bool comesBack(AnnouncementCounts counts) {
    final times = showAgainTimes;
    final visits = showAgainAfterVisits;
    if (times == null || visits == null) return false;
    final reason = hideReason(counts);
    return reason != null &&
        reason != HideReason.dismissed &&
        counts.returns < times &&
        counts.visitsWhileHidden >= visits;
  }

  /// Whether it is hidden at this visit with [counts].
  bool isHidden(AnnouncementCounts counts) =>
      hideReason(counts) != null && !comesBack(counts);

  // ── What the device does, step by step (the backend's on_visit,
  // on_impression and on_click) ──────────────────────────────────────────

  /// A visit (an app launch) where it could show: whether it shows, and
  /// the counts after it. A card that can come back counts the visits it
  /// stays hidden; once enough passed, it starts a new round and shows.
  ({bool shown, AnnouncementCounts counts}) onVisit(AnnouncementCounts counts) {
    if (comesBack(counts)) return (shown: true, counts: counts.nextRound());
    final reason = hideReason(counts);
    if (reason == null) return (shown: true, counts: counts);
    if (reason != HideReason.dismissed && showAgainTimes != null) {
      counts = counts.copyWith(visitsWhileHidden: counts.visitsWhileHidden + 1);
    }
    return (shown: false, counts: counts);
  }

  /// It was shown: one more impression, and one more after the clicks once
  /// they reached [hideAfterClicks].
  AnnouncementCounts onImpression(AnnouncementCounts counts) =>
      counts.copyWith(
        impressions: counts.impressions + 1,
        impressionsAfterClicks: counts.impressionsAfterClicks +
            (clicksReached(counts.clicks) ? 1 : 0),
      );

  /// A click that counts per [clickTarget]. The impression on screen
  /// during it is not one of the impressions after the click.
  AnnouncementCounts onClick(AnnouncementCounts counts,
          {String type = 'clicked', String? target = 'button'}) =>
      countsClick(type, target)
          ? counts.copyWith(clicks: counts.clicks + 1)
          : counts;

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
    this.returns = 0,
    this.visitsWhileHidden = 0,
  });

  final int impressions;

  /// The clicks that counted, per the rules' click target.
  final int clicks;

  /// Impressions after the click that reached `hide_after_clicks`.
  final int impressionsAfterClicks;
  final bool dismissed;

  /// Times it already came back (`show_again_times`).
  final int returns;

  /// Visits since the current round's rules hid it; counted only when it
  /// can come back.
  final int visitsWhileHidden;

  /// The counts as it comes back: [impressions], [clicks] and
  /// [impressionsAfterClicks] start again from 0, so the same rules hide it
  /// again; one more return.
  AnnouncementCounts nextRound() =>
      AnnouncementCounts(dismissed: dismissed, returns: returns + 1);

  AnnouncementCounts copyWith({
    int? impressions,
    int? clicks,
    int? impressionsAfterClicks,
    bool? dismissed,
    int? returns,
    int? visitsWhileHidden,
  }) =>
      AnnouncementCounts(
        impressions: impressions ?? this.impressions,
        clicks: clicks ?? this.clicks,
        impressionsAfterClicks:
            impressionsAfterClicks ?? this.impressionsAfterClicks,
        dismissed: dismissed ?? this.dismissed,
        returns: returns ?? this.returns,
        visitsWhileHidden: visitsWhileHidden ?? this.visitsWhileHidden,
      );
}
