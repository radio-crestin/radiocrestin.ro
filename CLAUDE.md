# CLAUDE.md

Rules for the whole Radio Crestin monorepo. Open it first; then open the `CLAUDE.md` of the app you change.

## Where things are

| Folder | App | Its rules |
|---|---|---|
| `web/` | radiocrestin.ro website (Astro + React) | [`web/CLAUDE.md`](web/CLAUDE.md) |
| `mobile/` | Radio Crestin app (Flutter) | [`mobile/CLAUDE.md`](mobile/CLAUDE.md) |
| `backend/` | API, admin, streaming (Django) | [`backend/CLAUDE.md`](backend/CLAUDE.md) |

Each app runs, tests and releases on its own: run commands from inside its folder. Setup steps for
people are in each folder's `README.md`; the overview is the root [`README.md`](README.md).

## Rules that apply everywhere

- **A change that needs one app stays in that app.** CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
  checks only the folders a change touches; `ci-ok` is the check `main` requires.
- **A feature that spans apps ships in one PR.** When a feature needs changes in `backend/`, `web/` and/or
  `mobile/`, make them all on **one branch, in one pull request**, so the API and its clients merge and release
  together. CI still checks every folder the PR touches.
- **`main` is protected** (two rulesets): no force pushes, no deletion, merges need `ci-ok` to pass, and only
  the org's `maintainers` team can merge a pull request into it. Work on a branch and open a pull request.
- **One version for every app**: `VERSION`, mirrored in `web/package.json` and `mobile/pubspec.yaml`; change it
  only with `make bump-patch|bump-minor|bump-major` at the root. Releases are tagged `vX.Y.Z` (never per app).
  A release is "latest" only with the app's downloads attached (`make promote` checks): the app's download
  links use `/releases/latest`. How to release: the root [`README.md`](README.md#-releases).
- **API contract changes cross folders.** A change to what `backend/api` returns must keep the website
  and the app versions already in the stores working.
- **Never commit secrets.** `.env` files are ignored; production config and secrets live in the private `bringes-infrastructure` repo ([backend/README.md#-deploying](backend/README.md#-deploying)).
