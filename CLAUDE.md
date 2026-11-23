# CLAUDE.md

Rules for the whole Radio Crestin monorepo. Open it first; then open the `CLAUDE.md` of the app you change.

## Where things are

| Folder | App | Its rules |
|---|---|---|
| `web/` | radiocrestin.ro website (Astro + React) | [`web/CLAUDE.md`](web/CLAUDE.md) |
| `mobile/` | Radio Crestin app (Flutter) | [`mobile/CLAUDE.md`](mobile/CLAUDE.md) |
| `backend/` | API, admin, streaming (Django) | [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| `backend/deploy/` | Kubernetes deploy: a **private** submodule (radio-crestin-deploy) with git-crypt secrets | its own `CLAUDE.md` |

Each app runs, tests and releases on its own: run commands from inside its folder. Setup steps for
people are in each folder's `README.md`; the overview is the root [`README.md`](README.md).

## Rules that apply everywhere

- **One change, one app, where possible.** CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
  checks only the folders a change touches; `ci-ok` is the check `main` requires.
- **`main` is protected**: no force pushes, no deletion, and merges need `ci-ok` to pass. Work on a branch
  and open a pull request.
- **Tags are per app**: `web/vX.Y.Z`, `backend/vX.Y.Z`, `mobile/vX.Y.Z`. Never create an unprefixed tag.
  Only mobile releases may be marked "latest" (the app's download links use `/releases/latest`).
- **API contract changes cross folders.** A change to what `backend/api` returns must keep the website
  and the app versions already in the stores working.
- **Never commit secrets.** `.env` files are ignored; production secrets live only in `backend/deploy`.
