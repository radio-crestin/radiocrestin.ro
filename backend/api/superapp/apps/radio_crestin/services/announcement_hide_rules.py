"""The announcement show and hide rules, as the website and the apps apply them per device.

The server never hides an announcement per device: it sends the rules (announcement_feed.serialize) and the
clients count. This is the reference the clients copy, tested against the shared cases in
backend/docs/announcement-hide-rules.cases.json; the semantics are in backend/docs/announcement-hide-rules.md.

Two kinds of rules:
- hide rules count this card's own impressions and clicks: max_impressions, hide_after_clicks,
  impressions_after_click (and closing it);
- waits count `count_on` events on the device (other announcements seen, visits, or station playbacks):
  show_after before the first showing, show_again_after before each of the show_again_times returns.
"""
from dataclasses import dataclass, replace
from typing import Optional

MAIN = 'main'
ANY = 'any'

IMPRESSIONS = 'impressions'  # other announcements seen on the device
VISITS = 'visits'  # app opens, website page loads where announcements load
PLAYBACKS = 'playbacks'  # station playbacks, optionally only count_station_slugs

# The click targets of the main action: the button, or the card itself (the hidden button style makes the whole
# card the button). A click with no target (clients from before targets) is the main action too.
MAIN_CLICK_TARGETS = ('button', 'card', '', None)

# Reasons a round's hide rules give; show_again_times can bring the card back after them (never after closing).
ROUND_REASONS = ('max_impressions', 'clicks', 'impressions_after_click')


@dataclass(frozen=True)
class HideRules:
    """The rules as the API sends them; absent keys are None (`hide_click_target` 'main', `count_on` 'visits')."""
    dismissible: bool = True
    max_impressions: Optional[int] = None
    hide_after_clicks: Optional[int] = None
    impressions_after_click: Optional[int] = None
    hide_click_target: str = MAIN
    count_on: str = VISITS
    count_station_slugs: tuple = ()
    show_after: Optional[int] = None
    show_again_times: Optional[int] = None
    show_again_after: Optional[int] = None

    @classmethod
    def from_payload(cls, payload: dict) -> 'HideRules':
        return cls(
            dismissible=payload.get('dismissible', True),
            max_impressions=payload.get('max_impressions'),
            hide_after_clicks=payload.get('hide_after_clicks'),
            impressions_after_click=payload.get('impressions_after_click'),
            hide_click_target=payload.get('hide_click_target') or MAIN,
            count_on=payload.get('count_on') or VISITS,
            count_station_slugs=tuple(payload.get('count_station_slugs') or ()),
            show_after=payload.get('show_after'),
            show_again_times=payload.get('show_again_times'),
            show_again_after=payload.get('show_again_after'),
        )


@dataclass(frozen=True)
class DeviceCounts:
    """What a device remembers per announcement slug.

    impressions, clicks, impressions_after_clicks and waited count the current round: they start again from 0
    each time the announcement comes back.
    """
    impressions: int = 0
    clicks: int = 0  # the clicks that count, per the rules' hide_click_target
    impressions_after_clicks: int = 0  # impressions counted after the click that reached hide_after_clicks
    dismissed: bool = False
    started: bool = False  # shown at least once
    returns: int = 0  # times it already came back
    waited: int = 0  # count_on events while it waits: before its first showing, or hidden before a return


def counts_click(rules: HideRules, event_type: str, target: Optional[str]) -> bool:
    """Whether a click event counts toward hide_after_clicks."""
    if event_type == 'secondary_clicked':
        return rules.hide_click_target == ANY
    if event_type != 'clicked':
        return False
    return rules.hide_click_target == ANY or target in MAIN_CLICK_TARGETS


def clicks_reached(rules: HideRules, counts: DeviceCounts) -> bool:
    return rules.hide_after_clicks is not None and counts.clicks >= rules.hide_after_clicks


def hide_reason(rules: HideRules, counts: DeviceCounts) -> Optional[str]:
    """Why the announcement is hidden on this device, or None when it shows. The first rule that matches."""
    if rules.dismissible and counts.dismissed:
        return 'dismissed'
    if not counts.started and rules.show_after is not None and counts.waited < rules.show_after:
        return 'show_after'
    if rules.max_impressions is not None and counts.impressions >= rules.max_impressions:
        return 'max_impressions'
    if clicks_reached(rules, counts):
        if not rules.impressions_after_click:
            return 'clicks'
        if counts.impressions_after_clicks >= rules.impressions_after_click:
            return 'impressions_after_click'
    return None


def can_come_back(rules: HideRules) -> bool:
    return rules.show_again_times is not None and rules.show_again_after is not None


def waiting(rules: HideRules, counts: DeviceCounts) -> bool:
    """Waiting for count_on events: before its first showing, or hidden by a round's rules with show again set."""
    reason = hide_reason(rules, counts)
    return reason == 'show_after' or (reason in ROUND_REASONS and can_come_back(rules))


def comes_back(rules: HideRules, counts: DeviceCounts) -> bool:
    """Whether, at this visit, a round's rules no longer hide it: the client then starts a new round
    (every count back to 0 but returns, which goes up by 1) and shows it. Closing it is never undone."""
    return (
        hide_reason(rules, counts) in ROUND_REASONS and can_come_back(rules)
        and counts.returns < rules.show_again_times
        and counts.waited >= rules.show_again_after
    )


def new_round(counts: DeviceCounts) -> DeviceCounts:
    return DeviceCounts(dismissed=counts.dismissed, started=True, returns=counts.returns + 1)


def is_hidden(rules: HideRules, counts: DeviceCounts) -> bool:
    return hide_reason(rules, counts) is not None and not comes_back(rules, counts)


# ---------------------------------------------------------------- what a client does, step by step

def on_event(rules: HideRules, counts: DeviceCounts, kind: str, station_slug: Optional[str] = None) -> DeviceCounts:
    """A device event (IMPRESSIONS: another announcement seen, VISITS, PLAYBACKS of station_slug): while the card
    waits, the events it counts on add to `waited`."""
    if kind != rules.count_on or not waiting(rules, counts):
        return counts
    if kind == PLAYBACKS and rules.count_station_slugs and station_slug not in rules.count_station_slugs:
        return counts
    return replace(counts, waited=counts.waited + 1)


def on_visit(rules: HideRules, counts: DeviceCounts) -> tuple:
    """An app open or page load where the card could show: (shown, new counts). A card that waits counts the
    visit (when it counts visits); once it waited enough, it shows (a new round when it comes back)."""
    if comes_back(rules, counts):
        return True, new_round(counts)
    if hide_reason(rules, counts) is None:
        return True, counts if counts.started else replace(counts, started=True, waited=0)
    return False, on_event(rules, counts, VISITS)


def on_other_impression(rules: HideRules, counts: DeviceCounts) -> DeviceCounts:
    """Another announcement was shown on the device."""
    return on_event(rules, counts, IMPRESSIONS)


def on_playback(rules: HideRules, counts: DeviceCounts, station_slug: str) -> DeviceCounts:
    """A station started playing on the device."""
    return on_event(rules, counts, PLAYBACKS, station_slug)


def on_impression(rules: HideRules, counts: DeviceCounts) -> DeviceCounts:
    """The card was shown: one more impression, and one more after the clicks once they reached the threshold."""
    after = counts.impressions_after_clicks + (1 if clicks_reached(rules, counts) else 0)
    return replace(counts, impressions=counts.impressions + 1, impressions_after_clicks=after)


def on_click(rules: HideRules, counts: DeviceCounts, event_type: str = 'clicked', target: Optional[str] = 'button'):
    """A click that counts per hide_click_target. The impression on screen during it is not one of the
    impressions after the click."""
    return replace(counts, clicks=counts.clicks + 1) if counts_click(rules, event_type, target) else counts
