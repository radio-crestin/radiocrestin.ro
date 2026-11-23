<p align="center">
  <img src="mobile/assets/icons/ic_logo_filled.png" alt="Radio Crestin logo" width="110" />
</p>

<h1 align="center">Radio Crestin</h1>

<p align="center">
  Romanian Christian radio in one place: 60+ stations, the song playing now and how many people listen,
  on the web, on your phone, in the car and on the TV.
</p>

<p align="center">
  <a href="https://github.com/radio-crestin/radiocrestin.ro/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/radio-crestin/radiocrestin.ro/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.radiocrestin.ro"><img alt="Website" src="https://img.shields.io/website?url=https%3A%2F%2Fwww.radiocrestin.ro&label=radiocrestin.ro" /></a>
  <a href="https://github.com/radio-crestin/radiocrestin.ro/releases/latest"><img alt="Latest app release" src="https://img.shields.io/github/v/release/radio-crestin/radiocrestin.ro?label=app&display_name=release" /></a>
</p>

<p align="center">
  <a href="https://www.radiocrestin.ro"><b>🌐 radiocrestin.ro</b></a>
  &nbsp;·&nbsp;
  <a href="https://apps.apple.com/app/6451270471"><b>📱 App Store</b></a>
  &nbsp;·&nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin"><b>🤖 Google Play</b></a>
</p>

<p align="center">
  <img src="web/docs/screenshots/desktop-light.jpg" alt="The radiocrestin.ro website" width="560" />
  &nbsp;
  <img src="mobile/docs/readme/screenshots/home-dark.jpg" alt="The app: every station with the song playing now" width="150" />
  &nbsp;
  <img src="mobile/docs/readme/screenshots/player-dark.jpg" alt="The app's full player" width="150" />
</p>

## 📦 What's in this repository

One repository, three apps. Each folder has its own README with setup steps, screenshots and conventions.

| Folder | What it is | Built with | Ships to |
|---|---|---|---|
| [`web/`](web/) | The **radiocrestin.ro** website: every station, live song, reviews, listening stats | Astro + React, TypeScript | Cloudflare Pages, on every push to `main` |
| [`mobile/`](mobile/) | The **Radio Crestin app** for iPhone, Android, CarPlay, Android Auto, Apple TV, Android TV, Mac and Windows | Flutter (+ SwiftUI on Apple TV) | App Store, Google Play, [GitHub releases](https://github.com/radio-crestin/radiocrestin.ro/releases/latest) |
| [`backend/`](backend/) | The **API and admin**: station list, song on air, listeners, reviews, announcements, and every station re-streamed as HLS | Django, GraphQL + REST, Celery, FFmpeg | Kubernetes, via [`backend/deploy`](backend/README.md#-deploying) |

## ⚙️ How it fits together

```mermaid
flowchart LR
    S("📻 <b>Radio stations</b><br/>60+ live streams")
    subgraph backend ["backend/"]
      ST("🎚️ <b>streaming</b><br/>re-streams each station<br/>as HLS")
      API("🎙️ <b>api</b><br/>stations · song on air<br/>listeners · admin")
    end
    WEB("🌐 <b>web/</b><br/>radiocrestin.ro")
    APP("📱 <b>mobile/</b><br/>Radio Crestin app")
    L("🎧 <b>Listeners</b>")

    S --> ST --> API
    S -.song titles.-> API
    API -- api.radiocrestin.ro --> WEB & APP
    WEB & APP --> L

    classDef source fill:#2B2B2B,stroke:#555555,color:#FFFFFF
    classDef backend fill:#8F0133,stroke:#8F0133,color:#FFFFFF
    classDef client fill:#E91E63,stroke:#E91E63,color:#FFFFFF
    classDef out fill:#FCE4EC,stroke:#E91E63,color:#5A0A26
    class S source
    class ST,API backend
    class WEB,APP client
    class L out
```

- 🎚️ **Streaming** (`backend/streaming`) pulls each station's stream once and re-serves it as HLS, so a
  slow station server never stalls thousands of listeners.
- 🎙️ **The API** (`backend/api`) keeps the station list, reads the song each station plays, counts
  listeners and serves it all at `api.radiocrestin.ro`. Station owners and admins manage everything in its
  admin portal.
- 🌐 **The website** and 📱 **the app** read that API and play the streams, HLS first, then the station's
  own stream if HLS fails.

## 🛠️ Quick start for developers

```bash
git clone https://github.com/radio-crestin/radiocrestin.ro.git
cd radiocrestin.ro
```

Then pick the app you want to work on. None of them needs the others running: the website and the app
use the production API by default.

| | Needs | Run it |
|---|---|---|
| 🌐 **Website** | Node 24 | `cd web && npm ci && npm run dev` → http://localhost:3005 |
| 📱 **App** | [FVM](https://fvm.app), Xcode / Android Studio | `cd mobile && fvm install && fvm flutter run` |
| 🎙️ **Backend** | Docker | `cd backend && cp .env.example .env && make start-docker` → http://localhost:8080 |

Full setup, tests and conventions: [`web/README.md`](web/README.md) ·
[`mobile/README.md`](mobile/README.md) · [`backend/README.md`](backend/README.md).

## 🚀 Releases

Each app is versioned and released on its own, with tags named after its folder:

| App | Tag | How |
|---|---|---|
| 🌐 Website | `web/v1.2.3` | Deploys continuously from `main`. Push a tag to mark a milestone: [CI](.github/workflows/release.yml) writes the release notes from `web/` commits. |
| 🎙️ Backend | `backend/v1.1.187` | `make create-new-release` in `backend/` builds the images and tags them; pushing the tag publishes the [release](.github/workflows/release.yml). |
| 📱 App | `mobile/v1.6.3` | `make release` in `mobile/` builds, signs and publishes with the downloads attached ([guide](mobile/docs/releasing.md)). |

The repository's **latest** release is always the app's, so
`https://github.com/radio-crestin/radiocrestin.ro/releases/latest/download/radio-crestin-android.apk`
(and the `.dmg`, `.ipa`, Windows `.zip`) always points at the newest app build.

## 🤝 Contributing

1. Branch from `main` and open a pull request. `main` is protected: a PR merges once **CI** passes, and CI
   checks only the apps your change touches.
2. Keep commits small, each with a message that says what changed and why.
3. Each app's `CLAUDE.md` holds its conventions (for people and for AI assistants alike).

Questions, ideas or a station to add: **contact@radio-crestin.com**, or
[open an issue](https://github.com/radio-crestin/radiocrestin.ro/issues).

## 📜 License

This project may be used only by Christian organizations, for non-commercial purposes, in projects the
owner has approved. See [LICENSE](LICENSE).

<details>
<summary>History</summary>

Until November 2026 the three apps lived in separate repositories, now archived:
[radio-crestin-web](https://github.com/radio-crestin/radio-crestin-web),
[radio-crestin-mobile-app](https://github.com/radio-crestin/radio-crestin-mobile-app) and the backend,
which was this repository. Their full history is preserved here: `git log -- web/` shows the website's.
</details>
