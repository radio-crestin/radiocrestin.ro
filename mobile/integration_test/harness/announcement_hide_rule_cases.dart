// A copy of backend/docs/announcement-hide-rules.cases.json, the cases the
// backend, the website and the app check their hide rules against. Copy it
// again when that file changes.

/// The shared hide rule cases, as JSON.
const announcementHideRuleCases = r'''
{
  "about": "Shared test cases for the announcement hide rules (announcement-hide-rules.md). The backend tests them against services/announcement_hide_rules.py; the website and the app copy them as their own tests. rules: the API's keys (absent = not set). counts: what the device remembers for the slug. hidden_by: the first rule that hides it, or null when it still shows.",
  "hide_cases": [
    {"name": "no rules: always shows", "rules": {}, "counts": {"impressions": 50, "clicks": 9}, "hidden_by": null},
    {"name": "closed", "rules": {"dismissible": true}, "counts": {"dismissed": true}, "hidden_by": "dismissed"},
    {"name": "closed, but it can't be closed (an old close is ignored)", "rules": {"dismissible": false}, "counts": {"dismissed": true}, "hidden_by": null},
    {"name": "max impressions not reached", "rules": {"max_impressions": 3}, "counts": {"impressions": 2}, "hidden_by": null},
    {"name": "max impressions reached", "rules": {"max_impressions": 3}, "counts": {"impressions": 3}, "hidden_by": "max_impressions"},
    {"name": "after one click: not clicked yet", "rules": {"hide_after_clicks": 1}, "counts": {"impressions": 7, "clicks": 0}, "hidden_by": null},
    {"name": "after one click: clicked once", "rules": {"hide_after_clicks": 1}, "counts": {"impressions": 1, "clicks": 1}, "hidden_by": "clicks"},
    {"name": "after 3 clicks: 2 clicks", "rules": {"hide_after_clicks": 3}, "counts": {"impressions": 4, "clicks": 2}, "hidden_by": null},
    {"name": "after 3 clicks: 3 clicks", "rules": {"hide_after_clicks": 3}, "counts": {"impressions": 4, "clicks": 3}, "hidden_by": "clicks"},
    {"name": "after 3 clicks: more clicks still hidden", "rules": {"hide_after_clicks": 3}, "counts": {"clicks": 5}, "hidden_by": "clicks"},
    {"name": "1 click + 2 impressions: clicked, none since", "rules": {"hide_after_clicks": 1, "impressions_after_click": 2}, "counts": {"impressions": 3, "clicks": 1, "impressions_after_clicks": 0}, "hidden_by": null},
    {"name": "1 click + 2 impressions: one since", "rules": {"hide_after_clicks": 1, "impressions_after_click": 2}, "counts": {"impressions": 4, "clicks": 1, "impressions_after_clicks": 1}, "hidden_by": null},
    {"name": "1 click + 2 impressions: two since", "rules": {"hide_after_clicks": 1, "impressions_after_click": 2}, "counts": {"impressions": 5, "clicks": 1, "impressions_after_clicks": 2}, "hidden_by": "impressions_after_click"},
    {"name": "2 clicks + 3 impressions: one click is not enough", "rules": {"hide_after_clicks": 2, "impressions_after_click": 3}, "counts": {"impressions": 9, "clicks": 1, "impressions_after_clicks": 0}, "hidden_by": null},
    {"name": "2 clicks + 3 impressions: a third click doesn't restart the count", "rules": {"hide_after_clicks": 2, "impressions_after_click": 3}, "counts": {"clicks": 3, "impressions_after_clicks": 3}, "hidden_by": "impressions_after_click"},
    {"name": "max impressions hides before the click rule", "rules": {"max_impressions": 5, "hide_after_clicks": 2}, "counts": {"impressions": 5, "clicks": 1}, "hidden_by": "max_impressions"},
    {"name": "max impressions cuts the reminders short", "rules": {"max_impressions": 5, "hide_after_clicks": 1, "impressions_after_click": 10}, "counts": {"impressions": 5, "clicks": 1, "impressions_after_clicks": 2}, "hidden_by": "max_impressions"},
    {"name": "closing hides it before the reminders end", "rules": {"hide_after_clicks": 1, "impressions_after_click": 3}, "counts": {"clicks": 1, "impressions_after_clicks": 1, "dismissed": true}, "hidden_by": "dismissed"}
  ],
  "click_cases": [
    {"name": "main: the button", "hide_click_target": "main", "event": {"type": "clicked", "target": "button"}, "counts": true},
    {"name": "main: the card (hidden button style)", "hide_click_target": "main", "event": {"type": "clicked", "target": "card"}, "counts": true},
    {"name": "main: a link in the description", "hide_click_target": "main", "event": {"type": "clicked", "target": "link"}, "counts": false},
    {"name": "main: the second button", "hide_click_target": "main", "event": {"type": "secondary_clicked"}, "counts": false},
    {"name": "main: a click with no target (older clients)", "hide_click_target": "main", "event": {"type": "clicked"}, "counts": true},
    {"name": "main is the default when absent", "hide_click_target": null, "event": {"type": "clicked", "target": "link"}, "counts": false},
    {"name": "any: a link in the description", "hide_click_target": "any", "event": {"type": "clicked", "target": "link"}, "counts": true},
    {"name": "any: the second button", "hide_click_target": "any", "event": {"type": "secondary_clicked"}, "counts": true},
    {"name": "any: a click with no target (older clients)", "hide_click_target": "any", "event": {"type": "clicked"}, "counts": true},
    {"name": "closing is not a click", "hide_click_target": "any", "event": {"type": "dismissed"}, "counts": false},
    {"name": "a page view is not a click", "hide_click_target": "any", "event": {"type": "page_viewed"}, "counts": false}
  ]
}
''';
