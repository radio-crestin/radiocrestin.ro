# Announcement show and hide rules

When an announcement shows and stops showing on a device. Open it when you change the rules in the backend, or apply them
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
| `count_on` | `visits` (default) / `impressions` / `playbacks` | Sent with any wait below. What the waits count on the device: `visits` app opens and website page loads where announcements load; `impressions` other announcements seen; `playbacks` station playbacks. |
| `count_station_slugs` | absent or a list of slugs | Only with `count_on: playbacks`: count only playbacks of these stations. Absent: any station. |
| `show_after` | absent or ≥ 1 | Wait: before its first showing on a device, wait this many `count_on` events. |
| `show_again_times` | absent or ≥ 1 | Sent with `show_again_after`. After max impressions or the click rules hid it, it comes back this many times. Never after closing. |
| `show_again_after` | absent or ≥ 1 | Wait: how many `count_on` events it stays hidden before each return. |

The hide rules (`max_impressions`, the clicks, closing) count this card's own impressions and clicks; the waits
(`show_after`, `show_again_after`) count `count_on` events, which happen while the card isn't showing.

### Share the app

`button.action.type: share` opens the system share sheet (the app) or the Web Share API, else copies the link
(the website). `action.url` is the link to share and `action.share_text` the text; either absent: the client's
own. Released apps don't know this action, so the admin requires `filters.min_app_version` on a share
announcement. The app prefers a share announcement from the API over its built-in share card and keeps the
built-in one when the API sends none.

`hide_after_seconds` is not a hide rule per device: it only takes the card out of the current view after that
many seconds on screen.

## What a device counts, per slug

- `impressions`: times it was shown (the same impression the client already reports and counts for `max_impressions`).
- `clicks`: clicks that count per `hide_click_target`.
- `impressions_after_clicks`: impressions after the click that reached `hide_after_clicks`. The impression that
  was on screen during that click is not one of them; clicks after that don't restart the count.
- `dismissed`: closed.
- `started`: shown at least once.
- `returns`: times it already came back.
- `waited`: `count_on` events while it waits: before its first showing (`show_after`), or hidden by a round's
  rules with show again set. Events while it shows, or after closing, don't count. For `playbacks` with
  `count_station_slugs`, only those stations' playbacks count.

`impressions`, `clicks`, `impressions_after_clicks` and `waited` count the current **round**: when it comes back they start
again from 0, so the same rules hide it again (seen 3 more times, clicked once more...).

## When it is hidden

Every rule that is set can hide it, whichever matches first, checked in this order:

1. `dismissible` and closed.
2. `show_after` set, not `started`, and `waited < show_after`.
3. `max_impressions` set and `impressions >= max_impressions`.
4. `hide_after_clicks` set and `clicks >= hide_after_clicks`, and then:
   - no `impressions_after_click`: hidden right away, also taken out of the current view at that click;
   - `impressions_after_click` set: hidden once `impressions_after_clicks >= impressions_after_click`.

### Show it again

At each visit, while max impressions or the click rules (not closing) hide it: when `returns < show_again_times`
and `waited >= show_again_after`, it comes back: a new round starts (`returns + 1`, the other counts back to 0)
and it shows. A visit where it doesn't show counts as one event when `count_on` is `visits`.

`count_on: visits, max_impressions: 3, show_again_times: 2, show_again_after: 3`, one impression per visit:

```
visit  1 2 3 | 4 5 6 | 7 8 9 | 10 11 12 | 13 14 15 | 16 ...
       v v v | - - - | v v v |  -  -  - |  v  v  v |  -  (gone for good)
```

The share prompt, `count_on: playbacks, show_after: 40, max_impressions: 1, show_again_times: 3,
show_again_after: 150`: after 40 playbacks it shows at the next visit, once; then 3 more times, each after 150
more playbacks.

The reference steps are `on_visit`, `on_impression`, `on_click`, `on_other_impression` and `on_playback`
(both `on_event`); the cases file has whole timelines to replay.

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
- `show_after`, `show_again_times` and `show_again_after` are at least 1; `count_on` is one of the three.
- `show_again_times` and `show_again_after` go together and need `max_impressions` or `hide_after_clicks`.
- A `share` action needs `min_app_version`.
