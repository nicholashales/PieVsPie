# Pie vs Pie 2026 Worker

The Worker is the voting application. Its entry point is `/arena/?code=<registered-code>` and `/rules` contains the approved rules. The root of the Worker sends users to the arena. The old static site at the repository root, its assets, and historical results are archived separately. Vite still builds the legacy root page.

## Local development

Use Node.js 24 and run `npm ci` and `npm test` from the repository root. Tests use a disposable Miniflare Worker, local D1 and Chromium. If Chromium is not installed, run `npx playwright install chromium`. To select a browser binary, set `PVP_CHROMIUM` to its full path. The suite never reads Cloudflare credentials or contacts remote D1. `npm run build:arena` copies the arena and artwork into the Worker's assets directory. `npm run build` independently checks the legacy Vite page.

For interactive development, build the assets, then run `npx wrangler d1 migrations apply DB --local` followed by `npx wrangler dev --local`. Use a clearly disposable manifest and apply its generated SQL with `npx wrangler d1 execute DB --local --file /path/to/register.sql`. Keep `--local` for each command. For local admin use Wrangler's ignored `.dev.vars` with a local-only printable ASCII `ADMIN_PASSWORD` of at least 24 characters. `ENABLE_PRACTICE=true` enables DEMO codes and the synthetic load routes. Leave it absent in production.

## Voting and audit

Public battle reads take a code. The server gets the ordered corners from `registered_fights`, and the arena ignores any extra pairing values in a QR URL. The code grants access to the current judges and their notes as well as add, edit and remove. Share codes with participants and tell judges to leave personal information out of tasting notes. There are no brand or product mappings in the public payload.

A same-origin JSON POST to `/api/battle` submits `operationId`, `judgeId`, `revision`, `code`, `action`, `winner` and `notes`. A retry uses exactly the same operation ID and event data. Adds start at revision 1. Edits and removals compare the submitted revision to the current record and append at the next revision. A removal must match the current vote and leaves its history intact. A 409 asks the client to refresh and review the change. The browser retains pending writes across navigation, tabs and restart, and retries temporary failures. Reopening the arena after a restart needs a connection to load the page and pairing. Keep site data until receipts arrive. Queued votes are scoped to the browser profile and site origin.

Admin pages use Basic authentication over HTTPS and a Worker rate-limit binding on failed authentication. Set `ADMIN_PASSWORD` in Worker Secrets. Keep the `ADMIN_RATE_LIMITER` binding, with 10 failed attempts per minute per connecting IP at a Cloudflare location. Where available, place the admin paths behind an additional operator access policy. Restoration uses an authenticated same-origin POST and appends a new revision with the historical source sequence. Restore buttons appear for historical content when the judge's latest event is a removal.

- `/admin/audit.csv` exports every revision, including restoration provenance.
- `/admin/votes.csv` exports each judge's latest raw event, including removal markers.
- `/admin/weights.csv` exports red/white vote counts and fractional weights. With zero active judges the total is zero. Every other battle contributes exactly one unit of total weight.
- `/admin/standings.csv` exports BTL and aggregate standings. BTL uses regularization of 0.1 on log strengths. Rankings use full precision.
- `/admin/results.csv` exports old and synthetic legacy rows. When practice is enabled, `?scope=demo` selects demo data for the new reports. Registered reports exclude these rows.

CSV is spreadsheet-safe and capped at 10,000 rows per export. Use an exact SQL export for backups, keeping notes and audit material in private storage.
