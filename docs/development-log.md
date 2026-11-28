# Pie vs Pie 2026 development log

## 28 November 2026

Started from the owner handover on `2026-codex-development` (`daec026`), based on `2026-cloudflare-migration` (`b03238d`). Read `AGENTS.md`, the release gates, and the existing Worker, database migrations, arena, and reports.

### Backlog work

1. Added repeatable tests against local D1, SQLite and Chromium. The Worker uses the same compatibility date in the tests and in Wrangler. Tested upgrades with missing or partially applied migrations, input and method validation, same-origin guards, replay after lost acknowledgements, simultaneous edits, removed votes, report isolation, fractional scoring and convergence of the regularized BTL solution.
2. Replaced the legacy submission form and separate practice panel with one multi-judge workflow in the original arena. Registered codes resolve server-authoritative ordered pairs. Added winner and note corrections, confirmed removal, per-operation local storage, retry and confirmation states, and a review flow for conflicting edits. A rejected change can be reviewed against the latest vote before explicitly reapplying it. Reloading the arena after browser restart needs a connection. Once loaded, the voting form can queue work offline.
3. Added admin restoration from an explicit historical revision. The new event stores its source sequence and preserves all prior events. Added rate-limited Basic authentication, same-origin restore checks, and paginated audit and raw vote reports with CSV exports for history, votes, weights, standings, and legacy rows. Practised an exact local SQLite backup and independent D1 restore, including notes, revisions, timestamps and integrity checks.
4. Added versioned manifest validation, a repeatable local SQL import and printable QR cards. The manifest refers to the existing stable roster IDs. The database retains the legacy alias columns and enforces permanent ordered corners and case-insensitive code uniqueness. The final roster and production pairings were unavailable, so only disposable test fixtures were generated. Historical website files remain in the checkout.
5. Updated local setup, test deployment, card workflow and release documentation. The owner runbook covers clean separate D1, migration verification, exact backups, legacy archive, corporate network acceptance, HTTPS/DNS and rollback.

### Verification and resumption

- Run `npm ci`, `npm test`, `npm run build`, and `git diff --check` from the root. The final run passed all 13 tests and the legacy build.
- No remote deployment, database writes, DNS changes, or charges were made. The remote test D1 migration ledger remains unverified, particularly migration 0002. Use the [release runbook](production-release-checklist.md) with the owner before deployment.
- The final owner-approved roster, ordered pairings, physical QR proof and corporate network tests remain release inputs. The historical workbook was unavailable. BTL was verified against analytic and synthetic cases without needing the workbook.
- Resume on the development branch and target `2026-cloudflare-migration` for review. Confirm the Workers Builds trigger configuration before publishing a branch or opening a PR if either action can create a remote deployment.

### Local command results

- `npm ci --cache /workspace/.npm-cache --no-audit --no-fund` installed the locked dependencies on Node 24. npm printed lifecycle coverage warnings for esbuild and workerd. Both binaries ran successfully in the builds and tests.
- `npm test` validates the Worker asset build and runs the Chromium, local D1, SQLite backup and scoring suites. The volume test imports 200 disposable codes, generates 200 QR cards, and checks 1,000 acknowledged votes and 200 battle weights.
- `npm run build` built the unchanged legacy Vite root. `git diff --check` checks whitespace in the changes.
- `npm run fight-cards -- "$pvp_check/manifest.json" "$pvp_check/cards"` generated one local card and SQL file. `npx wrangler d1 migrations apply DB --local --persist-to "$pvp_check/state"` applied all five migrations. `npx wrangler d1 execute DB --local --persist-to "$pvp_check/state" --file "$pvp_check/cards/register.sql"` succeeded twice and the registration query returned one matching pair.
- `npx wrangler dev --local --ip 127.0.0.1 --port 8792 --persist-to "$pvp_check/state"` served the local health check, sample pair, arena and JavaScript with the expected content type. The first smoke run found that static asset HEAD requests returned 404. The route now handles HEAD and the repeat smoke passed.
- The browser restore form failed when the admin response used a no-referrer policy. Changing that policy to same-origin allowed Chromium to submit the form while preserving the exact same-origin POST check. The final browser run passed.

### Review handoff

- Implementation commit: `a10d27f`. The review destination is `2026-cloudflare-migration`. Native Git read and a dry-run push worked, but GitHub CLI authentication was unavailable for opening the PR. No remote branch was updated. Confirm the Workers Builds preview triggers before publishing.
