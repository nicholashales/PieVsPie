# 2026 Cloudflare migration (not production ready)

Keep main and production DNS unchanged. The existing root index is a static final standings page; the React comparison app and logvslog page use different Google submission formats. Identify the actual 2026 voting entry point before wiring the API.

## Provisioning
In Cloudflare create a Pages project connected to this repository, with a preview deployment of this branch. Verify static asset paths and sizes before choosing the publish directory; do not assume the Vite output includes all legacy pages. Create a separate preview D1 database and bind it as DB in Pages settings. Apply migrations/0001_results.sql using Wrangler D1 migrations or the dashboard. Test GET /api/health. Use separate production database and binding later.

## API
POST /api/results accepts JSON: requestId (UUID v4), competition (pie or log), pieCode, redFighter, whiteFighter, winner, loser, tastingNotes. Same-origin only. Return success only after persisted row is read and matched. Reuse the exact request ID and payload on retry. Each request ID is unique, but separate IDs can submit the same fight code; establish competition-specific eligibility rules and server-side validation before public deployment.

## Release blockers
- Confirm live voting page and legacy export schema; archive all existing raw results and verify imported row counts.
- Implement persistent client outbox, retry and confirmed-success UI; remove Google dependencies.
- Establish fight-code and roster validation, rate limits, and authenticated admin/export tools.
- Test concurrent writes, retries, timeout after commit, conflicting IDs, invalid inputs, backup restore, and corporate network access.
- Upgrade Workers plan when required; confirm billing and quotas.
- Only after preview acceptance attach production domain, preserve DNS/email records, and retain rollback route. Do not run two independent voting backends during cutover; reconcile pending submissions.
