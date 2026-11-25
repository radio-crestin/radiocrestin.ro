# Stories API

Stories are full-screen slides (images, short videos, YouTube and Instagram posts) shown in a bar at the top of
the app, like the stories of social apps. The admin creates them under **Stories** in the portal. This is the
contract between the backend and its clients (the app's stories viewer; the website's share page).

Everything here is **new and additive**: the stations and announcements APIs are unchanged, so app versions
already in the stores keep working. Clients must ignore keys they don't know, and skip what they can't show
(see [Unknown values](#unknown-values)).

| Endpoint | What |
|---|---|
| `GET /api/v1/stories/` | Every listed story with its slides, the same for everyone (cached by Cloudflare) |
| `GET /api/v1/stories/<slug>/` | One story in its time window (a share link, a CTA to another story) |
| `GET /api/v1/stories/liked/?device_id=<id>` | The slugs this device liked (after a reinstall) |
| `POST /api/v1/stories/events/` | Views, likes, CTA taps and shares, reported by the device |

`?preview=<token>` on the two GETs also returns the stories in **Preview** status, uncached; it is the same
token as the announcements' preview link (Announcement settings), and a wrong token gets `403`.

## The list

`GET /api/v1/stories/` returns `{"stories": [...]}`, ordered by `position` (lowest first). It has an `ETag`
and answers `304` to `If-None-Match`, like `/api/v1/announcements/`.

It lists the stories that are **active, not ended, and started or starting within 7 days**: the client shows a
story only while `starts_at <= now < ends_at` (no `ends_at`: no end), and only when its `filters` match the
device. Each story has at least one slide.

```json
{
  "stories": [
    {
      "id": 12,
      "slug": "concert-craciun-2026",
      "title": "Concert de Crăciun",
      "position": 0,
      "cover_url": "https://cdn.radiocrestin.ro/stories/covers/concert.webp",
      "starts_at": "2026-12-01T08:00:00Z",
      "ends_at": "2026-12-26T00:00:00Z",
      "updated_at": "2026-11-25T10:12:03Z",
      "share_url": "https://www.radiocrestin.ro/poveste/concert-craciun-2026/",
      "likes": 152,
      "display": { "every_days": 3, "every_actions": 10, "count_on": "visits", "max_shows": 5 },
      "filters": {
        "platforms": ["android", "ios"],
        "countries_include": [],
        "countries_exclude": [],
        "locales": [],
        "min_app_version": "1.9.0",
        "max_app_version": null
      },
      "slides": [
        {
          "id": 40,
          "type": "image",
          "orientation": "portrait",
          "duration_seconds": 6,
          "image": { "url": "https://cdn.radiocrestin.ro/stories/slides/afis.webp", "width": 1080, "height": 1920 },
          "cta": {
            "style": "button",
            "label": "Ascultă acum",
            "target": { "type": "in_app", "route": "station", "station_slug": "radio-vocea-evangheliei" }
          }
        },
        {
          "id": 41,
          "type": "video",
          "orientation": "portrait",
          "duration_seconds": 14.5,
          "video": {
            "url": "https://cdn.radiocrestin.ro/stories/videos/teaser.mp4",
            "poster_url": "https://cdn.radiocrestin.ro/stories/posters/teaser.jpg",
            "duration_seconds": 14.5,
            "width": 1080,
            "height": 1920,
            "size_bytes": 4812345,
            "mime_type": "video/mp4"
          },
          "cta": {
            "style": "both",
            "label": "Vezi tot concertul",
            "target": {
              "type": "app_link",
              "app": "youtube",
              "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              "fallback_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            }
          }
        },
        {
          "id": 42,
          "type": "youtube",
          "orientation": "portrait",
          "duration_seconds": 30,
          "youtube": {
            "url": "https://www.youtube.com/shorts/aBcDeFgHiJk",
            "provider": "youtube",
            "kind": "short",
            "video_id": "aBcDeFgHiJk",
            "title": "Colind",
            "thumbnail": "https://i.ytimg.com/vi/aBcDeFgHiJk/hqdefault.jpg"
          }
        },
        {
          "id": 43,
          "type": "instagram",
          "orientation": "portrait",
          "duration_seconds": 10,
          "instagram": {
            "url": "https://www.instagram.com/reel/C1a2B3c4D5e/",
            "kind": "reel",
            "shortcode": "C1a2B3c4D5e",
            "embed_url": "https://www.instagram.com/reel/C1a2B3c4D5e/embed/",
            "author_name": "radiocrestin",
            "author_url": "https://www.instagram.com/radiocrestin/",
            "caption": "Repetiții pentru concert",
            "thumbnail": "https://scontent.cdninstagram.com/v/t51.../thumb.jpg",
            "thumbnail_width": 640,
            "thumbnail_height": 1136
          },
          "cta": {
            "style": "swipe_up",
            "label": "Deschide în Instagram",
            "target": {
              "type": "app_link",
              "app": "instagram",
              "url": "https://www.instagram.com/reel/C1a2B3c4D5e/",
              "fallback_url": "https://www.instagram.com/reel/C1a2B3c4D5e/"
            }
          }
        }
      ]
    }
  ]
}
```

### Story

| Key | Type | Notes |
|---|---|---|
| `id` | int | Stable. |
| `slug` | string | `[a-z0-9-]{1,100}`; what events, likes and the share URL use. |
| `title` | string | Shown under the cover in the bar and on top of the viewer. |
| `position` | int | Order in the bar, lowest first. |
| `cover_url` | string? | The round picture in the bar. Absent: use the first slide's image, poster or thumbnail. |
| `starts_at`, `ends_at` | ISO 8601 UTC | `ends_at` absent: no end. |
| `updated_at` | ISO 8601 UTC | Changes when the admin edits the story or its slides. |
| `share_url` | string | The page to share (a landing page on radiocrestin.ro that opens the app or offers it). |
| `likes` | int | Total likes, as of the list's cache (up to a few minutes old); events return fresher counts. |
| `display` | object? | When the device shows it; absent: always (see [Display rules](#display-rules)). |
| `filters` | object | Same keys and meaning as the announcements' `filters`; every rule set must match. |
| `slides` | array | In order; at least one. |

### Slide

| Key | Type | Notes |
|---|---|---|
| `id` | int | Stable; events name slides by it. |
| `type` | string | `image`, `video`, `youtube` or `instagram`. The slide carries the object of the same name. |
| `orientation` | string | `portrait`, `landscape` or `square`: how the media is framed (landscape is letterboxed). |
| `duration_seconds` | number | How long the slide stays before the next one. For `video`: the video's length. For `youtube` and `instagram`: how long to show it before moving on (the user can pause or open it). |
| `image` | object | `url`, and `width`/`height` when known. |
| `video` | object | An uploaded short video: `url`, `poster_url` (a frame to show while it loads), `duration_seconds`, `width`, `height`, `size_bytes`, `mime_type` (`video/mp4`). At most 60 s and 50 MB (checked in the admin). Plays muted until the user unmutes. |
| `youtube` | object | The announcements' embed item: `url`, `provider`, `kind` (`video`, `short`, `playlist`), `video_id`, `list_id`, `start`, `title`, `thumbnail`. |
| `instagram` | object | See [Instagram](#instagram). |
| `cta` | object? | The call to action; absent: none. |

### Instagram

`instagram.url` and `kind` (`post`, `reel` or `tv`), `shortcode` and `embed_url` are always there. The rest
is fetched from Instagram's oEmbed when the admin saves the slide and stored with it (the API never waits on
Instagram), so each is **optional**:

`author_name`, `author_url`, `caption`, `thumbnail` (an image URL), `thumbnail_width`, `thumbnail_height`,
`media_url` and `media_type` (`image` or `video`, when Instagram gives a direct media URL).

How to show it, best first:
1. `media_url` with `media_type`: play or show it like an `image` / `video` slide.
2. `thumbnail`: show it full screen, with `author_name` and `caption`, and an "Open in Instagram" button
   (the slide's `cta`, or `url` when it has none).
3. Neither: load `embed_url` in a web view (Instagram's own embed page).

Instagram's CDN thumbnail URLs expire after some days; the backend refreshes them, but a client that fails to
load `thumbnail` should fall back to step 3.

### CTA

```json
{ "style": "swipe_up", "label": "Vezi tot clipul", "target": { "type": "url", "url": "https://...", "open_in": "in_app_browser" } }
```

| Key | Notes |
|---|---|
| `style` | `swipe_up` (a "swipe up" hint with the label; swiping up opens the target), `button` (a labelled button), or `both` (the button, and swiping up also opens it). |
| `label` | The hint's or the button's text. Always set. |
| `target` | What it opens, below. |

`target.type`, and the keys each one carries:

| `type` | Keys | Opens |
|---|---|---|
| `url` | `url` (https/http), `open_in`: `in_app_browser` or `external` | A web page. |
| `app_link` | `app` (`youtube`, `instagram`, `spotify`, `facebook`, `whatsapp`, `tiktok` or `other`), `url`, `fallback_url`, optional `android_intent_uri` | A native app. `url` is its universal/app link (`https://...`) or custom scheme (`spotify:track:...`). Open `url`; when no app handles it (or it is a custom scheme and the app isn't installed), open `fallback_url` in the browser. On Android, `android_intent_uri` when present is tried first, exactly like the announcements' `android_intent` action. |
| `in_app` | `route`, the route's keys, optional `fallback_url` | A screen of our app, below. |
| `story` | `story_slug` | Another story: open it in the viewer (`GET /api/v1/stories/<slug>/` when it isn't in the list). |

`in_app` routes:

| `route` | Keys | Screen |
|---|---|---|
| `station` | `station_slug` | Play the station and open it. |
| `song` | `song`: `{ "id", "name", "artist" }`, `station_slug`? | The song (e.g. its station's history); `fallback_url` is a YouTube search for it. |
| `announcement` | `announcement_slug` | The announcement's page (as from a push notification). |
| `form` | `form_slug` | The form, like the announcements' `form` action. |
| `share` | `share_text`? | Share the app, like the announcements' `share` action. |
| `settings` | | The settings screen. |

Links are validated in the admin with the announcements' checks: `url` and `fallback_url` are `https://` or
`http://` only; `app_link.url` may also be a custom scheme, never `javascript:`, `data:`, `file:`,
`vbscript:`, `about:`, `blob:`, `content:` or `intent:` (intents go in `android_intent_uri`).

### Display rules

`display` holds only the rules the admin set; every key is optional.

| Key | Meaning |
|---|---|
| `max_shows` | After the device opened the story this many times, don't show it any more. |
| `every_days` | After the device opened it, hide it until this many days have passed. |
| `every_actions` | After the device opened it, hide it until this many `count_on` events happened on the device. |
| `count_on` | What `every_actions` counts: `visits` (app opens) or `playbacks` (station playbacks). Always sent with `every_actions`. |

With both `every_days` and `every_actions`, it comes back at whichever is reached first. A "show" is the
device opening the story in the viewer (the `view` event). Without `display`, the story is always in the bar;
the client may move stories the device has seen to the end, with a grey ring.

### Unknown values

- A slide with an unknown `type`, or without its media object: skip the slide.
- A story with no slide left: skip the story.
- A CTA with an unknown `style`: show it as `button`. An unknown `target.type` or `route`: open
  `target.fallback_url` when there is one, otherwise hide the CTA.

## One story

`GET /api/v1/stories/<slug>/`: one story object as in the list (no wrapper), only while it is active and
inside its time window (`starts_at <= now < ends_at`); otherwise `404 {"error": "not found"}`. The app uses it
for a share link or a CTA to a story that isn't in its list. The share page on the website reads it too.

## Liked stories of a device

`GET /api/v1/stories/liked/?device_id=<id>` → `{"liked": ["concert-craciun-2026"]}`: the slugs of listed
stories this device liked. Not cached. The device keeps its own liked state; this restores it after a
reinstall.

## Events

`POST /api/v1/stories/events/`, JSON body (any Content-Type; `text/plain` works for `sendBeacon`):

```json
{
  "device_id": "4f3c2a...",
  "platform": "android",
  "app_version": "1.9.0",
  "locale": "ro-RO",
  "events": [
    { "type": "view", "story": "concert-craciun-2026", "at": "2026-12-02T18:01:02Z" },
    { "type": "slide_view", "story": "concert-craciun-2026", "slide": 41, "at": "2026-12-02T18:01:08Z" },
    { "type": "like", "story": "concert-craciun-2026", "at": "2026-12-02T18:01:10Z" },
    { "type": "cta_click", "story": "concert-craciun-2026", "slide": 41, "target": "swipe_up", "at": "2026-12-02T18:01:12Z" }
  ]
}
```

`device_id` is the same id the app registers (`/api/v1/devices/register/`) and sends with announcement events.

| `type` | Extra keys | Meaning |
|---|---|---|
| `view` | | The device opened the story (a "show"). |
| `slide_view` | `slide` | A slide was on screen. |
| `complete` | | The device watched to the end of the last slide. |
| `like` | | The device likes the story. Once per device: repeats change nothing. |
| `unlike` | | Takes the device's like back. |
| `cta_click` | `slide`, `target`: `button` or `swipe_up` | The CTA was used. |
| `share` | | The device shared the story. |

The answer:

```json
{ "status": "ok", "accepted": 4, "likes": { "concert-craciun-2026": 153 }, "liked": ["concert-craciun-2026"] }
```

- `accepted`: how many events were stored.
- `likes`: the current like count of each story named in the request.
- `liked`: which of those the device likes now.

Like the announcements' events: at most 100 events and 10 stories per request; unknown types, slugs and
slides are skipped; `at` (optional) more than 24 h old or 5 min ahead is skipped; repeats from the same device
are dropped (views for 30 minutes, slide views, CTA taps, completions and shares for 1 minute); rate limits are
600 requests a minute per IP and 30 per device (`429`).

## Stats in the admin

Each story shows its views, unique viewers, completions, likes, CTA taps and shares, in total and per day, and
per slide. Raw events are kept 180 days; the daily totals and the like counts stay.
