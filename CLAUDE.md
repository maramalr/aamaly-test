# ELM Team Hub — project notes for Claude

Static single-page web app for the owner's daily work at ELM: handovers, test URLs,
team status, notes and a daily to-do list. The owner opens `index.html` directly
from a local folder (file://), so keep it working with no server and no build step.

## Structure
- `index.html` — layout shell (sidebar, top bar, modal, toast)
- `css/styles.css` — all styling; colors are CSS variables on `:root`, dark theme via `[data-theme="dark"]` and `prefers-color-scheme`
- `js/app.js` — all logic in one IIFE:
  - `SCHEMAS` defines each collection's form fields (handovers, urls, team, todos, notes); the modal form is generated from it
  - `VIEWS` holds one render function per page; event handling is delegated via `data-act` attributes
  - data is stored in `localStorage` under `elm-team-hub-v1`; Export/Import writes/reads JSON `{ app, version, exported, data }`
  - optional data file (Chrome/Edge, File System Access API): `save()` also writes the same JSON to a file the user linked; the file handle is kept in IndexedDB (`elm-team-hub` / `kv` / `dataFile`); `elm-team-hub-sync` tracks `localChanged` vs `fileSynced` so edits made while disconnected prompt before being overwritten; the "Reconnect" banner re-requests permission
- `assets/elm-logo.svg` — official ELM logo uploaded by the owner (wide wordmark, dark-navy text)

## Conventions
- No frameworks or external libraries; plain HTML/CSS/JS only
- Escape all user content with `esc()`; only allow http(s) links via `safeUrl()`
- When adding a field, add it to `SCHEMAS` and to the view's render; keep old saved data compatible (missing fields must not break rendering)
- Test in a headless browser at desktop and 390px phone width (no horizontal scroll), then check there are no console errors
- Don't commit screenshots or test output (`*.png` is gitignored outside `assets/`)

## Status / ideas not done yet
- Data is per-user (browser or linked file); a shared backend would be needed for team-wide data
- Logo's navy text is hard to read in dark mode (could add a light badge behind it)
