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
| `GET /api/v1/stories/<slug>/comments/` | A page of the story's public comments (see [Comments](#comments)) |
| `POST /api/v1/stories/<slug>/comments/` | A listener writes a comment |
| `DELETE /api/v1/stories/<slug>/comments/<id>/` | The author's device deletes its comment |

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
      "comments": { "enabled": true, "placeholder": "Scrie un gând", "count": 12 },
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
| `comments` | object | `{"enabled": bool, "placeholder": string\|null, "count": int}`. Always present. `enabled`: the viewer shows the comments ("Comentarii") and lets the listener write one; `false` by default, ticked per story in the admin. `placeholder`: the hint in the empty comment box; `null`: the app's own. `count`: visible comments (0 while `enabled` is false), as fresh as `like_count`. See [Comments](#comments). |
| `filters` | object | Same keys and meaning as the announcements' `filters`; every rule set must match. |
| `display` | object | When the device shows it, see [Display rules](#display-rules). Always present. |
| `author` | object\|null | The account row under the CTA: the story's [profile](#profiles), `{"name": string, "avatar_url": absolute URL\|null}`. `null`: show "Radio Creștin" with its logo. `avatar_url` `null`: the name without a picture (or the app's placeholder). |
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
| `color`, `text_color` | The button's background and text colours, each set on its own in the admin: `#RRGGBB`, or `#AARRGGBB` with the opacity first (Android's order; CSS writes it `#RRGGBBAA`), upper case. `null`: the app's colours. Always present. |
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

## Profiles

A profile is a public identity: a name and an avatar. Only the team creates them, in the portal under
**Profiles**; there is no API to create or edit one. A profile is shown on a story's author row (the
story's `author`) and on the comments it writes. A profile can be linked to one of the app's users (the
`app_users` row a device registers with `/api/v1/devices/register/`, by its `device_id`): that device then
writes comments under the profile's name and avatar.

## Comments

Public comments under a story, shown in the viewer as "Comentarii". They are plain text, newest first. A
story takes them only while its `comments.enabled` is `true` (ticked per story in the admin; off by
default). Each comment belongs to one of the app's users, found by its `device_id` (the same `app_users`
rows as listening sessions, reviews and share links), and is shown under that user's [profile](#profiles).

**Who writes them:** with **Only profiles comment** on (Story Settings; on by default), only a device
linked to a profile can write a comment; any other device gets `403`, and the list tells the app with
`can_comment: false` so it can hide the comment box. With it off, every device can, and those without a
profile show as "Ascultător". The admin can hide a comment (no listener sees it any more) or delete it. Device ids are never
returned: `mine` says whether a comment was written from the asking device. These answers are per device,
so they are never cached (`Cache-Control: private, no-store`, by the backend and by Cloudflare).

The website calls them too, like the events endpoint: POST bodies are JSON whatever the Content-Type
(`text/plain` avoids a CORS preflight), `platform` is `"web"` there, and every answer, OPTIONS included,
carries `Access-Control-Allow-Origin: *` (`DELETE` is preflighted: OPTIONS allows `GET, POST, DELETE`).

The story must be listed (active, or in Preview) and inside its time window; otherwise every comment
endpoint answers `404 {"error": "not found"}`.

A comment:

```json
{ "id": 812, "author_name": "Radio Vocea Evangheliei", "author_avatar_url": "https://cdn.radiocrestin.ro/profiles/vocea.webp",
  "text": "Doamne ajută!", "created_at": "2026-12-02T18:01:10Z", "mine": true }
```

| Key | Notes |
|---|---|
| `id` | int; pages and deletes use it. |
| `author_name` | The profile's name, or `"Ascultător"` for a comment without a profile (filled in by the backend). |
| `author_avatar_url` | The profile's avatar (absolute URL), or `null`. |
| `text` | Plain text, 1 to 500 characters, may hold line breaks (at most one blank line in a row). |
| `created_at` | ISO 8601 UTC. |
| `mine` | Written from the `device_id` in the request. |

### List

`GET /api/v1/stories/<slug>/comments/?device_id=<id>&before=<id>`

```json
{ "count": 12, "comments": [ { "id": 812, "author_name": "...", "author_avatar_url": null, "text": "...", "created_at": "...", "mine": true } ],
  "next_before": 790, "can_comment": true, "profile": { "name": "Radio Vocea Evangheliei", "avatar_url": "https://..." } }
```

Visible comments only, newest first, 30 a page. `count` is every visible comment of the story. For the next
page, send `before=<next_before>`; `next_before` is `null` on the last page. Without `device_id`, `mine` is
`false` everywhere. While comments are off: `{"count": 0, "comments": [], "next_before": null, ...}`.

`can_comment`: this device may write a comment now (comments on, and a profile when only profiles
comment). `profile`: the device's profile, `{"name", "avatar_url"}`, or `null`: what its comments will show.

### Write

`POST /api/v1/stories/<slug>/comments/`, JSON body (any Content-Type, `text/plain` included):

```json
{ "device_id": "4f3c2a...", "platform": "android", "app_version": "1.9.0", "locale": "ro-RO",
  "slide": 41, "text": "Doamne ajută!" }
```

| Key | Notes |
|---|---|
| `device_id` | Required: the app's user. The comment is written as this device's profile. |
| `text` | 1 to 500 characters, counted after HTML tags and control characters are removed and the ends trimmed. |
| `slide` | The slide on screen, or `null`. An id that isn't one of the story's slides is stored as `null`. |
| `platform`, `app_version`, `locale` | Like the events' (`platform`: `android`, `ios`, `web`, ...); shown to the admin with the comment. |

| Answer | When |
|---|---|
| `201 {"comment": {..., "mine": true}}` | Stored and visible. |
| `400 {"error": "text is empty"}` | `text` missing, not a string, or nothing left once cleaned. |
| `400 {"error": "text is longer than 500 characters"}` | |
| `403 {"error": "only profiles can comment"}` | Only profiles comment, and this device has no profile. |
| `400 {"error": "comments are off for this story"}` | |
| `400 {"error": "device_id is required"}`, `{"error": "invalid json"}`, `{"error": "expected a json object"}` | |
| `404 {"error": "not found"}` | The story isn't listed or is outside its window. |
| `429 {"error": "rate limited"}` | More than 5 requests a minute from one device, or 60 from one IP. Nothing stored. |

The `error` texts are for logs; the app shows its own words.

### Delete

`DELETE /api/v1/stories/<slug>/comments/<id>/?device_id=<id>`: `204` when the comment was written from that
device (hidden ones too). `403 {"error": "not your comment"}` for another device's comment or no
`device_id`; `404` when the story has no such comment.

### Moderation

In the portal, **Story Comments** lists every comment (text, profile, story, slide, date, platform, app user),
filtered by story from the Comments column of the Stories list, with the actions "Hide from listeners" and
"Show to listeners again", and Delete. A story's Comments tab shows its latest 20, hidden ones greyed.

## Stats in the admin

Each story shows its views, auto-opens, unique viewers, completions, likes, CTA taps and shares, in total and
per day, and per slide. Raw events are kept 180 days; the daily totals and the likes stay.
