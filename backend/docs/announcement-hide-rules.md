# Announcement hide rules

When an announcement stops showing on a device. Open it when you change the rules in the backend, or apply them
on the website (`web/`) or in the app (`mobile/`). The server only sends the rules; each client counts per device,
per announcement `slug`, and hides it there.

- Reference implementation: [`api/superapp/apps/radio_crestin/services/announcement_hide_rules.py`](../api/superapp/apps/radio_crestin/services/announcement_hide_rules.py)
- Shared test cases (copy them into the web and app tests): [`announcement-hide-rules.cases.json`](announcement-hide-rules.cases.json)

## The rules (API keys)

Sent on every announcement in `GET /api/v1/announcements/` and `GET /api/v1/announcements/<slug>/`. A key that
is not set is left out, so older clients see exactly what they saw before.

| Key | Values | Meaning |
|---|---|---|
| `dismissible` | `true` / `false` | Can be closed; closing hides it for good on that device. |
| `max_impressions` | absent or ≥ 1 | Hide it once it was shown this many times on the device. |
| `hide_after_clicks` | absent or ≥ 1 | Hide it once it was clicked this many times on the device (1: after the first click). |
| `impressions_after_click` | absent or ≥ 1 | Only with `hide_after_clicks`: after those clicks, show it this many more times as a reminder, then hide it. Absent: hide right after the click. |
| `hide_click_target` | `main` (default) / `any` | Only sent with `hide_after_clicks`. Which clicks count: `main` the main button, or the card when the whole card is the button (`clicked` events with target `button`, `card`, or none); `any` every click (also `clicked` with target `link`, and `secondary_clicked`). |

| `show_again_times` | absent or ≥ 1 | Sent with `show_again_after_visits`. After max impressions or the click rules hid it, it comes back this many times. Never after closing. |
| `show_again_after_visits` | absent or ≥ 1 | How many visits it stays hidden before it comes back. |

`hide_after_seconds` is not a hide rule per device: it only takes the card out of the current view after that
many seconds on screen.

## What a device counts, per slug

- `impressions`: times it was shown (the same impression the client already reports and counts for `max_impressions`).
- `clicks`: clicks that count per `hide_click_target`.
- `impressions_after_clicks`: impressions after the click that reached `hide_after_clicks`. The impression that
  was on screen during that click is not one of them; clicks after that don't restart the count.
- `dismissed`: closed.
- `returns`: times it already came back.
- `visits_while_hidden`: visits (an app open, a website page load where announcements load) since the current
  round's rules hid it. Counted only when `show_again_times` is set.

`impressions`, `clicks` and `impressions_after_clicks` count the current **round**: when it comes back they start
again from 0, so the same rules hide it again (seen 3 more times, clicked once more...).

## When it is hidden

Every rule that is set can hide it, whichever matches first, checked in this order:

1. `dismissible` and closed.
2. `max_impressions` set and `impressions >= max_impressions`.
3. `hide_after_clicks` set and `clicks >= hide_after_clicks`, and then:
   - no `impressions_after_click`: hidden right away, also taken out of the current view at that click;
   - `impressions_after_click` set: hidden once `impressions_after_clicks >= impressions_after_click`.

### Show it again

At each visit, while max impressions or the click rules (not closing) hide it: when `returns < show_again_times`
and `visits_while_hidden >= show_again_after_visits`, it comes back: a new round starts (`returns + 1`, the other
counts back to 0) and it shows. Otherwise the visit adds 1 to `visits_while_hidden`.

`max_impressions: 3, show_again_times: 2, show_again_after_visits: 3`, one impression per visit:

```
visit  1 2 3 | 4 5 6 | 7 8 9 | 10 11 12 | 13 14 15 | 16 ...
       v v v | - - - | v v v |  -  -  - |  v  v  v |  -  (gone for good)
```

The reference steps are `on_visit`, `on_impression` and `on_click`; the cases file has whole timelines to replay.

Changing the slug in the admin starts every count again (as it already did for closing).

## Examples

| Admin preset | Rules | Device | Shows? |
|---|---|---|---|
| Never (default) | none | 50 impressions, 9 clicks | yes |
| After one click | `hide_after_clicks: 1` | 7 impressions, 0 clicks | yes |
| After one click | `hide_after_clicks: 1` | 1 click | no (`clicks`) |
| After X clicks | `hide_after_clicks: 3` | 2 clicks | yes |
| After X clicks | `hide_after_clicks: 3` | 3 clicks | no (`clicks`) |
| After X clicks + Y impressions | `hide_after_clicks: 1, impressions_after_click: 2` | 1 click, 1 impression since | yes |
| After X clicks + Y impressions | `hide_after_clicks: 1, impressions_after_click: 2` | 1 click, 2 impressions since | no (`impressions_after_click`) |
| After X clicks + Y impressions | `hide_after_clicks: 2, impressions_after_click: 3` | 1 click, 9 impressions | yes (not 2 clicks yet) |
| + max impressions | `max_impressions: 5, hide_after_clicks: 1, impressions_after_click: 10` | 5 impressions, 1 click, 2 since | no (`max_impressions`) |
| Can't be closed | `dismissible: false` | closed earlier | yes |

| `hide_click_target` | Event | Counts? |
|---|---|---|
| `main` | `clicked`, target `button` or `card` or none | yes |
| `main` | `clicked`, target `link`; `secondary_clicked` | no |
| `any` | any `clicked` or `secondary_clicked` | yes |
| any | `dismissed`, `page_viewed`, `impression` | no |

The full list, with the expected reason, is in the cases file.

## Validation (admin and `Announcement.clean`)

- `hide_after_clicks` and `impressions_after_click` are at least 1.
- `impressions_after_click` needs `hide_after_clicks`.
- `hide_click_target: main` with `hide_after_clicks` needs a button (an action other than "No button").
- `show_again_times` and `show_again_after_visits` go together, are at least 1, and need `max_impressions` or `hide_after_clicks`.
