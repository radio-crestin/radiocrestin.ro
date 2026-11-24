/// When an announcement shows and stops showing on this device, as
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

/// What an announcement's waits count on the device (`count_on`).
enum CountOn {
  /// App launches where announcements load (the default).
  visits,

  /// Other announcements seen.
  impressions,

  /// Station playbacks, optionally only some stations'.
  playbacks;

  /// [visits] unless [value] names another (absent in older lists).
  static CountOn parse(Object? value) =>
      values.firstWhere((kind) => kind.name == value, orElse: () => visits);
}

/// Why an announcement doesn't show: the first rule that hides it.
enum HideReason {
  dismissed,

  /// Still waiting before its first showing (`show_after`).
  showAfter,
  maxImpressions,
  clicks,
  impressionsAfterClick;

  /// Whether a round's rules hide it: [AnnouncementHideRules.showAgainTimes]
  /// can bring it back (never after closing).
  bool get endsRound =>
      this == maxImpressions || this == clicks || this == impressionsAfterClick;

  /// The name the backend's reference and the shared cases use.
  String get apiName => switch (this) {
        showAfter => 'show_after',
        maxImpressions => 'max_impressions',
        impressionsAfterClick => 'impressions_after_click',
        _ => name,
      };
}

/// An announcement's show and hide rules, as the API sends them; absent
/// keys are null and leave it showing as it did before.
///
/// The hide rules count the card's own impressions and clicks; the waits
/// ([showAfter], [showAgainAfter]) count [countOn] events, which happen
/// while the card isn't showing.
class AnnouncementHideRules {
  const AnnouncementHideRules({
    this.dismissible = true,
    this.maxImpressions,
    this.hideAfterClicks,
    this.impressionsAfterClick,
    this.clickTarget = HideClickTarget.main,
    this.countOn = CountOn.visits,
    this.countStationSlugs = const [],
    this.showAfter,
    this.showAgainTimes,
    this.showAgainAfter,
  });

  final bool dismissible;
  final int? maxImpressions;

  /// Hide it after this many counted clicks on the device.
  final int? hideAfterClicks;

  /// After those clicks, show it this many more times, then hide it.
  final int? impressionsAfterClick;
  final HideClickTarget clickTarget;

  /// What [showAfter] and [showAgainAfter] count.
  final CountOn countOn;

  /// With [CountOn.playbacks]: only these stations' playbacks count; empty
  /// counts any station.
  final List<String> countStationSlugs;

  /// Before its first showing, wait this many [countOn] events
  /// (`show_after`).
  final int? showAfter;

  /// After max impressions or the click rules hid it, it comes back this
  /// many times (`show_again_times`); never after closing.
  final int? showAgainTimes;

  /// How many [countOn] events it stays hidden before each return
  /// (`show_again_after`).
  final int? showAgainAfter;

  static AnnouncementHideRules fromJson(Map<Object?, Object?> json) =>
      AnnouncementHideRules(
        dismissible: json['dismissible'] != false,
        maxImpressions: _positive(json['max_impressions']),
        hideAfterClicks: _positive(json['hide_after_clicks']),
        impressionsAfterClick: _positive(json['impressions_after_click']),
        clickTarget: HideClickTarget.parse(json['hide_click_target']),
        countOn: CountOn.parse(json['count_on']),
        countStationSlugs: [
          for (final slug in json['count_station_slugs'] as List? ?? const [])
            if (slug is String) slug,
        ],
        showAfter: _positive(json['show_after']),
        showAgainTimes: _positive(json['show_again_times']),
        showAgainAfter: _positive(json['show_again_after']),
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
    final wait = showAfter;
    if (!counts.started && wait != null && counts.waited < wait) {
      return HideReason.showAfter;
    }
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
  bool get showsAgain => showAgainTimes != null && showAgainAfter != null;

  /// Whether it has a wait, so the device counts [countOn] events for it.
  bool get waits => showAfter != null || showsAgain;

  /// Whether [counts] wait for [countOn] events: before its first showing,
  /// or hidden by a round's rules with show again set.
  bool isWaiting(AnnouncementCounts counts) {
    final reason = hideReason(counts);
    return reason == HideReason.showAfter ||
        (reason != null && reason.endsRound && showsAgain);
  }

  /// Whether, at this visit, it comes back: max impressions or the click
  /// rules (not closing) hide it, it came back fewer than [showAgainTimes]
  /// and it waited [showAgainAfter] events. The device then starts a new
  /// round ([AnnouncementCounts.nextRound]) and shows it.
  bool comesBack(AnnouncementCounts counts) {
    final times = showAgainTimes;
    final after = showAgainAfter;
    if (times == null || after == null) return false;
    final reason = hideReason(counts);
    return reason != null &&
        reason.endsRound &&
        counts.returns < times &&
        counts.waited >= after;
  }

  /// Whether it is hidden at this visit with [counts].
  bool isHidden(AnnouncementCounts counts) =>
      hideReason(counts) != null && !comesBack(counts);

  // ── What the device does, step by step (the backend's on_visit,
  // on_event, on_impression and on_click) ────────────────────────────────

  /// A visit (an app launch) where it could show: whether it shows, and
  /// the counts after it. A card that waits counts the visit (when it
  /// counts visits); once it waited enough, it shows (a new round when it
  /// comes back).
  ({bool shown, AnnouncementCounts counts}) onVisit(AnnouncementCounts counts) {
    if (comesBack(counts)) return (shown: true, counts: counts.nextRound());
    if (hideReason(counts) == null) {
      if (counts.started) return (shown: true, counts: counts);
      return (shown: true, counts: counts.copyWith(started: true, waited: 0));
    }
    return (shown: false, counts: onEvent(counts, CountOn.visits));
  }

  /// A device event of [kind] ([station]: the station of a playback):
  /// while the card waits, the events it counts on add to `waited`.
  AnnouncementCounts onEvent(AnnouncementCounts counts, CountOn kind,
      {String? station}) {
    if (kind != countOn || !isWaiting(counts)) return counts;
    if (kind == CountOn.playbacks &&
        countStationSlugs.isNotEmpty &&
        !countStationSlugs.contains(station)) {
      return counts;
    }
    return counts.copyWith(waited: counts.waited + 1);
  }

  /// Another announcement was shown on the device.
  AnnouncementCounts onOtherImpression(AnnouncementCounts counts) =>
      onEvent(counts, CountOn.impressions);

  /// The station [station] was played on the device.
  AnnouncementCounts onPlayback(AnnouncementCounts counts, String station) =>
      onEvent(counts, CountOn.playbacks, station: station);

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
    this.started = false,
    this.returns = 0,
    this.waited = 0,
  });

  final int impressions;

  /// The clicks that counted, per the rules' click target.
  final int clicks;

  /// Impressions after the click that reached `hide_after_clicks`.
  final int impressionsAfterClicks;
  final bool dismissed;

  /// Shown at least once: `show_after` no longer applies.
  final bool started;

  /// Times it already came back (`show_again_times`).
  final int returns;

  /// `count_on` events while it waits: before its first showing, or hidden
  /// by the current round's rules before a return.
  final int waited;

  /// The counts as it comes back: [impressions], [clicks],
  /// [impressionsAfterClicks] and [waited] start again from 0, so the same
  /// rules hide it again; one more return.
  AnnouncementCounts nextRound() => AnnouncementCounts(
      dismissed: dismissed, started: true, returns: returns + 1);

  AnnouncementCounts copyWith({
    int? impressions,
    int? clicks,
    int? impressionsAfterClicks,
    bool? dismissed,
    bool? started,
    int? returns,
    int? waited,
  }) =>
      AnnouncementCounts(
        impressions: impressions ?? this.impressions,
        clicks: clicks ?? this.clicks,
        impressionsAfterClicks:
            impressionsAfterClicks ?? this.impressionsAfterClicks,
        dismissed: dismissed ?? this.dismissed,
        started: started ?? this.started,
        returns: returns ?? this.returns,
        waited: waited ?? this.waited,
      );
}
