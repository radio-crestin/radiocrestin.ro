# Stories API

Stories are full-screen slides (images, short videos, YouTube and Instagram posts) shown in a bar at the top of
the app, like the stories of social apps. The admin creates them under **Stories** in the portal. This is the
contract between the backend and its clients (the app's stories viewer; the website's share page).

Everything here is **new and additive**: the stations and announcements APIs are unchanged, so app versions
already in the stores keep working. Clients must ignore keys they don't know, and skip what they can't show
(see [Unknown values](#unknown-values)). Keys marked *extra* are optional details a client may use or ignore.

| Endpoint | What |
|---|---|
| `GET /api/v1/stories/` | Every listed story with its slides, the same for everyone (cached by Cloudflare) |
| `GET /api/v1/stories/<slug>/` | One story in its time window (a share link, a CTA to another story) |
| `GET /api/v1/stories/liked/?device_id=<id>` | The slugs this device liked (after a reinstall) |
| `POST /api/v1/stories/events/` | Views, likes, CTA taps, shares and auto-opens, reported by the device |
| `POST /api/v1/stories/messages/` | A listener's message under a story that takes messages (see [Messages](#messages)) |

`?preview=<token>` on the two story GETs also returns the stories in **Preview** status, uncached; it is the
same token as the announcements' preview link (Announcement settings), and a wrong token gets `403`.

## The list

`GET /api/v1/stories/` returns `{"settings": {...}, "stories": [...]}`, stories ordered by `position`
(lowest first). It has an `ETag` and answers `304` to `If-None-Match`, like `/api/v1/announcements/`.

It lists the stories that are **active, not ended, and started or starting within 7 days**: the client shows a
story only while `starts_at <= now < ends_at` (`null`: no limit on that side), and only when its `filters`
match the device. Each listed story has at least one slide.

```json
{
  "settings": { "auto_open_gap_actions": 20 },
  "stories": [
    {
      "id": 12,
      "slug": "concert-craciun-2026",
      "title": "Concert de Crăciun",
      "position": 0,
      "cover_url": "https://cdn.radiocrestin.ro/stories/covers/concert.webp",
      "share_url": "https://www.radiocrestin.ro/poveste/concert-craciun-2026/",
      "starts_at": "2026-12-01T08:00:00Z",
      "ends_at": "2026-12-26T00:00:00Z",
      "updated_at": "2026-11-25T10:12:03Z",
      "like_count": 152,
      "filters": {
        "platforms": ["android", "ios"],
        "countries_include": [],
        "countries_exclude": [],
        "locales": [],
        "min_app_version": "1.9.0",
        "max_app_version": null
      },
      "display": { "auto_open": true, "every_days": 3, "every_actions": 10, "max_shows": 5 },
      "messages": { "enabled": true, "placeholder": "Scrie-ne o cerere de rugăciune" },
      "author": { "name": "Radio Vocea Evangheliei", "avatar_url": "https://cdn.radiocrestin.ro/stories/authors/vocea.webp" },
      "slides": [
        {
          "id": 40,
          "type": "image",
          "media_url": "https://cdn.radiocrestin.ro/stories/slides/afis.webp",
          "poster_url": null,
          "duration_seconds": 6,
          "orientation": "portrait",
          "has_sound": false,
          "youtube_url": null,
          "instagram": null,
          "width": 1080,
          "height": 1920,
          "caption": "Concert de Crăciun, 24 decembrie, la Arad",
          "cta": {
            "style": "button",
            "label": "Ascultă acum",
            "color": "#FFC107",
            "text_color": "#000000",
            "target": { "type": "in_app", "route": "station", "slug": "radio-vocea-evangheliei" }
          }
        },
        {
          "id": 41,
          "type": "video",
          "media_url": "https://cdn.radiocrestin.ro/stories/videos/teaser.mp4",
          "poster_url": "https://cdn.radiocrestin.ro/stories/posters/teaser.jpg",
          "duration_seconds": 14.5,
          "orientation": "portrait",
          "has_sound": true,
          "youtube_url": null,
          "instagram": null,
          "width": 1080,
          "height": 1920,
          "size_bytes": 4812345,
          "mime_type": "video/mp4",
          "cta": {
            "style": "both",
            "label": "Vezi tot concertul",
            "target": {
              "type": "app_link",
              "app": "youtube",
              "app_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              "fallback_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            }
          }
        },
        {
          "id": 42,
          "type": "youtube",
          "media_url": null,
          "poster_url": "https://i.ytimg.com/vi/aBcDeFgHiJk/hqdefault.jpg",
          "duration_seconds": 30,
          "orientation": "portrait",
          "has_sound": true,
          "youtube_url": "https://www.youtube.com/shorts/aBcDeFgHiJk",
          "youtube": {
            "url": "https://www.youtube.com/shorts/aBcDeFgHiJk",
            "provider": "youtube",
            "kind": "short",
            "video_id": "aBcDeFgHiJk",
            "title": "Colind",
            "thumbnail": "https://i.ytimg.com/vi/aBcDeFgHiJk/hqdefault.jpg"
          },
          "instagram": null,
          "cta": null
        },
        {
          "id": 43,
          "type": "instagram",
          "media_url": null,
          "poster_url": "https://scontent.cdninstagram.com/v/t51.../thumb.jpg",
          "duration_seconds": 10,
          "orientation": "portrait",
          "has_sound": false,
          "youtube_url": null,
          "instagram": {
            "url": "https://www.instagram.com/reel/C1a2B3c4D5e/",
            "kind": "reel",
            "thumbnail_url": "https://scontent.cdninstagram.com/v/t51.../thumb.jpg",
            "author_name": "radiocrestin",
            "caption": "Repetiții pentru concert",
            "media_url": null,
            "media_type": null,
            "shortcode": "C1a2B3c4D5e",
            "embed_url": "https://www.instagram.com/reel/C1a2B3c4D5e/embed/",
            "author_url": "https://www.instagram.com/radiocrestin/"
          },
          "cta": {
            "style": "swipe_up",
            "label": "Deschide în Instagram",
            "target": {
              "type": "app_link",
              "app": "instagram",
              "app_url": "https://www.instagram.com/reel/C1a2B3c4D5e/",
              "fallback_url": "https://www.instagram.com/reel/C1a2B3c4D5e/"
            }
          }
        }
      ]
    }
  ]
}
```

### Settings

| Key | Meaning |
|---|---|
| `auto_open_gap_actions` | At least this many [actions](#actions) between two auto-opens of any stories on a device (0: no gap). |

### Story

| Key | Type | Notes |
|---|---|---|
| `slug` | string | `[a-z0-9-]{1,100}`; what events, likes and the share URL use. |
| `title` | string | Shown under the cover in the bar and on top of the viewer. |
| `cover_url` | string\|null | The round picture in the bar. `null`: use the first slide's `media_url` (image) or `poster_url`. |
| `share_url` | string | The page to share: a landing page on radiocrestin.ro that opens the app or offers it. |
| `starts_at`, `ends_at` | ISO 8601 UTC\|null | `null`: no limit on that side. |
| `updated_at` | ISO 8601 UTC | Changes when the admin edits the story or its slides. |
| `like_count` | int | Total likes. Read fresh on every request the backend answers (the rest of the body is cached for up to 5 minutes and dropped on every admin change); Cloudflare may keep a copy for up to 60 s (`max-age=60`). The events answer has the counts right after a like. |
| `filters` | object | Same keys and meaning as the announcements' `filters`; every rule set must match. |
| `display` | object | When the device shows it, see [Display rules](#display-rules). Always present. |
| `messages` | object | `{"enabled": bool, "placeholder": string\|null}`. Always present. `enabled`: the viewer offers a message box (sent to [Messages](#messages)); `false` by default. `placeholder`: the hint in the empty box, set in the admin; `null`: the app's own. |
| `author` | object\|null | The account row under the CTA: `{"name": string, "avatar_url": absolute URL\|null}`. `null`: show "Radio Creștin" with its logo. `avatar_url` `null`: the name without a picture (or the app's placeholder). |
| `slides` | array | In order; at least one. |
| `id`, `position` | int | *extra*: the story's id; its order (the list is already sorted). |

### Slide

| Key | Type | Notes |
|---|---|---|
| `id` | int | Stable; events name slides by it. |
| `type` | string | `image`, `video`, `youtube` or `instagram`. |
| `media_url` | string\|null | `image`: the picture. `video`: the uploaded short video (mp4, at most 60 s and 50 MB, checked in the admin). `null` for `youtube` and `instagram`. |
| `poster_url` | string\|null | A still to show while the media loads: the video's poster frame, the YouTube thumbnail, the Instagram thumbnail. |
| `duration_seconds` | number | How long the slide stays before the next one. `video`: the video's length. `youtube`/`instagram`: how long to show it before moving on (the user can pause, or open it). |
| `orientation` | string | `portrait` or `landscape`: how the media is framed (landscape is letterboxed). |
| `has_sound` | bool | The video has an audio track (`video`, `youtube`); the viewer offers mute/unmute. |
| `youtube_url` | string\|null | `youtube`: the video's canonical URL. |
| `instagram` | object\|null | `instagram`: see [Instagram](#instagram). |
| `caption` | string\|null | Text over the bottom of the slide, like a Reels caption (at most 500 characters, may hold line breaks). `null`: none. |
| `cta` | object\|null | The call to action, see [CTA](#cta). |
| `width`, `height` | int | *extra*, `image` and `video`, when known. |
| `size_bytes`, `mime_type` | | *extra*, `video`. |
| `youtube` | object | *extra*, `youtube`: the announcements' embed item: `url`, `provider`, `kind` (`video`, `short`, `playlist`), `video_id`, `list_id`, `start`, `title`, `thumbnail`. |

### Instagram

`url` (the post or reel) and `kind` (`post` or `reel`) are always set. The rest is fetched from Instagram's
oEmbed when the admin saves the slide and stored with it (the API never waits on Instagram); each may be
`null`: `thumbnail_url`, `author_name`, `caption`, `media_url` and `media_type` (`image` or `video`, when
Instagram gives a direct media URL). *extra*: `shortcode`, `embed_url` (Instagram's embed page), `author_url`.

The details need a Meta app token in the backend's environment, `INSTAGRAM_OEMBED_TOKEN` (`<app id>|<client
token>`). Until it is set, Instagram slides carry only `url`, `kind`, `shortcode` and `embed_url`. Once it is
set, saving a slide fetches its details, and `python manage.py refresh_story_embeds` (or the story admin's
"Fetch YouTube and Instagram details again") fetches them for the slides saved before. A daily task fetches the
listed slides again, since the thumbnail links expire.

How to show it, best first:
1. `media_url` with `media_type`: show or play it like an `image` / `video` slide.
2. `thumbnail_url`: show it full screen with `author_name` and `caption`, and an "Open in Instagram" action
   (the slide's `cta`, or `url` when it has none).
3. Neither: load `embed_url` (or `url` + `embed/`) in a web view.

Instagram's CDN thumbnail URLs expire after some days (the backend refreshes them); when `thumbnail_url` fails
to load, fall back to step 3.

### CTA

```json
{ "style": "swipe_up", "label": "Vezi tot clipul", "target": { "type": "url", "url": "https://...", "open_in": "in_app_browser" } }
```

| Key | Notes |
|---|---|
| `style` | `swipe_up` (a "swipe up" hint with the label; swiping up opens the target), `button` (a labelled button), or `both` (the button, and swiping up also opens it). |
| `label` | The hint's or the button's text. Always set. |
| `color`, `text_color` | The button's background and text colours, `#RRGGBB` (upper case), each set on its own in the admin. `null`: the app's colours. Always present. |
| `target` | What it opens. Only the keys its `type` uses are sent. |

| `target.type` | Keys | Opens |
|---|---|---|
| `url` | `url` (https/http), `open_in`: `browser` or `in_app_browser` | A web page. |
| `app_link` | `app_url`, `fallback_url`; *extra*: `app` (`youtube`, `instagram`, `spotify`, `facebook`, `whatsapp`, `tiktok`, `other`), `android_intent_uri` | A native app. `app_url` is its universal/app link (`https://...`) or custom scheme (`spotify:track:...`). Open `app_url`; when no app handles it, open `fallback_url` in the browser. On Android, `android_intent_uri`, when present, may be tried first, exactly like the announcements' `android_intent` action. |
| `in_app` | `route`, `slug` (for the routes below that take one), optional `fallback_url` | A screen of our app. |
| `story` | `story_slug` | Another story, opened in the viewer (`GET /api/v1/stories/<slug>/` when it isn't in the list). |

`in_app` routes:

| `route` | `slug` | Screen |
|---|---|---|
| `station` | the station's slug | Play the station and open it. |
| `song` | the song's id, as a string; *extra* `song`: `{"id", "name", "artist"}` and `station_slug` when set | The song; `fallback_url` is a YouTube search for it. |
| `announcement` | the announcement's slug | The announcement's page (as from a push notification). |
| `settings` | | The settings screen. |
| `form` | the form's slug | *extra route*: the form, like the announcements' `form` action. |
| `share` | | *extra route*: share the app, like the announcements' `share` action; *extra* `share_text`. |

Links are validated in the admin with the announcements' checks: `url` and `fallback_url` are `https://` or
`http://` only; `app_url` may also be a custom scheme, never `javascript:`, `data:`, `file:`, `vbscript:`,
`about:`, `blob:`, `content:` or `intent:` (intents go in `android_intent_uri`).

### Display rules

`display` is always sent; its rules are `null` when not set.

| Key | Meaning |
|---|---|
| `auto_open` | The app opens the story by itself (full screen) when it is due, at most once per app open, and only when `settings.auto_open_gap_actions` actions passed since the last auto-open of any story. Otherwise it waits in the bar for a tap. |
| `every_days` | After a show, the story is due again after this many days. |
| `every_actions` | After a show, the story is due again after this many [actions](#actions). |
| `max_shows` | After this many shows on the device, the story leaves the bar for good. |

- A **show** is the device opening the story in the viewer: by a tap (`view` event) or by itself (`auto_open`).
- A story is **due** when it was never shown on the device, or when `every_days` or `every_actions` (whichever
  is set and reached first) passed since its last show. Neither set: due only until its first show.
- In the bar, due stories have a coloured ring and come first; the others keep a grey ring.

#### Actions

What `every_actions` and `auto_open_gap_actions` count on the device: each **app open** (cold start or return
to the foreground after 30 minutes) and each **station playback** started.

### Unknown values

- A slide with an unknown `type`, or without what its type needs (`media_url`, `youtube_url`, `instagram`):
  skip the slide. A story with no slide left: skip the story.
- A CTA with an unknown `style`: show it as `button`. An unknown `target.type` or `route`: open
  `target.fallback_url` when there is one, otherwise hide the CTA.

## One story

`GET /api/v1/stories/<slug>/`: one story object as in the list (no wrapper), only while it is active and
inside its time window; otherwise `404 {"error": "not found"}`. For share links and CTAs to a story that isn't
in the device's list. The website's share page reads it too.

## Liked stories of a device

`GET /api/v1/stories/liked/?device_id=<id>` → `{"liked": ["concert-craciun-2026"]}`: the slugs of listed
stories this device liked. Not cached. The device keeps its own liked state; this restores it after a reinstall.

## Events

`POST /api/v1/stories/events/`, JSON body (any Content-Type; `text/plain` works for `sendBeacon`):

```json
{
  "device_id": "4f3c2a...",
  "platform": "android",
  "app_version": "1.9.0",
  "locale": "ro-RO",
  "events": [
    { "type": "auto_open", "story": "concert-craciun-2026", "at": "2026-12-02T18:01:02Z" },
    { "type": "slide_view", "story": "concert-craciun-2026", "slide": 41, "at": "2026-12-02T18:01:08Z" },
    { "type": "like", "story": "concert-craciun-2026", "at": "2026-12-02T18:01:10Z" },
    { "type": "cta_click", "story": "concert-craciun-2026", "slide": 41, "target": "swipe_up", "at": "2026-12-02T18:01:12Z" }
  ]
}
```

`device_id` is the id the app registers (`/api/v1/devices/register/`) and sends with announcement events.
`slide` and `at` are optional on every event.

| `type` | Meaning |
|---|---|
| `view` | The user opened the story (a show). |
| `auto_open` | The app opened it by itself (a show). |
| `slide_view` | A slide was on screen (`slide`). |
| `complete` | The device watched to the end of the last slide. |
| `like` | The device likes the story. Idempotent per device and story. |
| `unlike` | Takes the device's like back. Idempotent. |
| `cta_click` | The CTA was used (`slide`; optional `target`: `button` or `swipe_up`). |
| `share` | The device shared the story. |

The answer:

```json
{ "status": "ok", "accepted": 4, "like_counts": { "concert-craciun-2026": 153 }, "liked": ["concert-craciun-2026"] }
```

- `accepted`: how many events were stored.
- `like_counts`: the current like count of each story named in the request.
- `liked`: which of those the device likes now.

Like the announcements' events: at most 100 events and 10 stories per request; unknown types, slugs and
slides are skipped; an `at` more than 24 h old or 5 min ahead is skipped; repeats from the same device are
dropped (views and auto-opens for 30 minutes; slide views, CTA taps, completions and shares for 1 minute);
rate limits are 600 requests a minute per IP and 30 per device (`429`, nothing stored).

## Messages

`POST /api/v1/stories/messages/`, JSON body (any Content-Type), only for a story whose `messages.enabled` is
`true`:

```json
{
  "device_id": "4f3c2a...",
  "platform": "android",
  "app_version": "1.9.0",
  "locale": "ro-RO",
  "story": "concert-craciun-2026",
  "slide": 41,
  "text": "Vă rog să vă rugați pentru mama mea."
}
```

| Key | Notes |
|---|---|
| `device_id` | Required: the rate limit counts per device. |
| `story` | The story's slug. |
| `slide` | The slide on screen, or `null`. An id that isn't one of the story's slides is stored as `null`. |
| `text` | 1 to 1000 characters once trimmed of surrounding spaces and line breaks. |
| `platform`, `app_version`, `locale` | Like the events'; shown to the admin with the message. |

| Answer | When |
|---|---|
| `201 {"status": "ok"}` | Stored. |
| `400 {"error": "text is empty"}` | `text` missing, not a string, or only spaces. |
| `400 {"error": "text is longer than 1000 characters"}` | |
| `400 {"error": "this story does not take messages"}` | Unknown slug, messages off, or the story isn't active (or in Preview) inside its window. |
| `400 {"error": "device_id is required"}`, `{"error": "invalid json"}`, `{"error": "expected a json object"}` | |
| `429 {"error": "rate limited"}` | More than 5 requests a minute from one device, or 60 from one IP. Nothing stored. |

The `error` texts are for logs; the app shows its own words. Messages are never shown to other listeners: the
admin reads them under **Story Messages** (text, date, slide, platform and app version, device), filtered by
story from the Messages column of the Stories list, and the latest 20 on the story's Messages tab.

## Stats in the admin

Each story shows its views, auto-opens, unique viewers, completions, likes, CTA taps and shares, in total and
per day, and per slide. Raw events are kept 180 days; the daily totals and the likes stay.
