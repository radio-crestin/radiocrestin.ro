"""The announcement hide rules, as the website and the apps apply them per device.

The server never hides an announcement per device: it sends the rules (announcement_feed.serialize) and the
clients count. This is the reference the clients copy, tested against the shared cases in
backend/docs/announcement-hide-rules.cases.json; the semantics are in backend/docs/announcement-hide-rules.md.
"""
from dataclasses import dataclass, replace
from typing import Optional

MAIN = 'main'
ANY = 'any'

# The click targets of the main action: the button, or the card itself (the hidden button style makes the whole
# card the button). A click with no target (clients from before targets) is the main action too.
MAIN_CLICK_TARGETS = ('button', 'card', '', None)


@dataclass(frozen=True)
class HideRules:
    """The rules as the API sends them; absent keys are None (and `hide_click_target` then 'main')."""
    dismissible: bool = True
    max_impressions: Optional[int] = None
    hide_after_clicks: Optional[int] = None
    impressions_after_click: Optional[int] = None
    hide_click_target: str = MAIN
    show_again_times: Optional[int] = None
    show_again_after_visits: Optional[int] = None

    @classmethod
    def from_payload(cls, payload: dict) -> 'HideRules':
        return cls(
            dismissible=payload.get('dismissible', True),
            max_impressions=payload.get('max_impressions'),
            hide_after_clicks=payload.get('hide_after_clicks'),
            impressions_after_click=payload.get('impressions_after_click'),
            hide_click_target=payload.get('hide_click_target') or MAIN,
            show_again_times=payload.get('show_again_times'),
            show_again_after_visits=payload.get('show_again_after_visits'),
        )


@dataclass(frozen=True)
class DeviceCounts:
    """What a device remembers per announcement slug.

    impressions, clicks and impressions_after_clicks count the current round: they start again from 0 each time
    the announcement comes back (show_again_times).
    """
    impressions: int = 0
    clicks: int = 0  # the clicks that count, per the rules' hide_click_target
    impressions_after_clicks: int = 0  # impressions counted after the click that reached hide_after_clicks
    dismissed: bool = False
    returns: int = 0  # times it already came back
    visits_while_hidden: int = 0  # visits (app opens, page loads) since the current round's rules hid it


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
    """Why the announcement is hidden on this device, or None when it still shows. The first rule that matches."""
    if rules.dismissible and counts.dismissed:
        return 'dismissed'
    if rules.max_impressions is not None and counts.impressions >= rules.max_impressions:
        return 'max_impressions'
    if clicks_reached(rules, counts):
        if not rules.impressions_after_click:
            return 'clicks'
        if counts.impressions_after_clicks >= rules.impressions_after_click:
            return 'impressions_after_click'
    return None


def comes_back(rules: HideRules, counts: DeviceCounts) -> bool:
    """Whether, at this visit, a round's rules no longer hide it: the client then starts a new round
    (impressions, clicks, impressions_after_clicks and visits_while_hidden back to 0, returns + 1) and shows it.
    Closing it is never undone."""
    reason = hide_reason(rules, counts)
    return (
        reason in ('max_impressions', 'clicks', 'impressions_after_click')
        and rules.show_again_times is not None and rules.show_again_after_visits is not None
        and counts.returns < rules.show_again_times
        and counts.visits_while_hidden >= rules.show_again_after_visits
    )


def new_round(counts: DeviceCounts) -> DeviceCounts:
    return DeviceCounts(dismissed=counts.dismissed, returns=counts.returns + 1)


def is_hidden(rules: HideRules, counts: DeviceCounts) -> bool:
    return hide_reason(rules, counts) is not None and not comes_back(rules, counts)


# ---------------------------------------------------------------- what a client does, step by step

def on_visit(rules: HideRules, counts: DeviceCounts) -> tuple:
    """An app open or page load where the card could show: (shown, new counts). A hidden card that can come
    back counts the visit; once enough visits passed, it starts a new round and shows."""
    if comes_back(rules, counts):
        return True, new_round(counts)
    reason = hide_reason(rules, counts)
    if reason is None:
        return True, counts
    if reason != 'dismissed' and rules.show_again_times is not None:
        counts = replace(counts, visits_while_hidden=counts.visits_while_hidden + 1)
    return False, counts


def on_impression(rules: HideRules, counts: DeviceCounts) -> DeviceCounts:
    """The card was shown: one more impression, and one more after the clicks once they reached the threshold."""
    after = counts.impressions_after_clicks + (1 if clicks_reached(rules, counts) else 0)
    return replace(counts, impressions=counts.impressions + 1, impressions_after_clicks=after)


def on_click(rules: HideRules, counts: DeviceCounts, event_type: str = 'clicked', target: Optional[str] = 'button'):
    """A click that counts per hide_click_target. The impression on screen during it is not one of the
    impressions after the click."""
    return replace(counts, clicks=counts.clicks + 1) if counts_click(rules, event_type, target) else counts
