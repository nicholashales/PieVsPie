# Production release runbook

Release and remote configuration are owner-operated. Keep the 2025 site and DNS in place throughout local development. Pause if a proposed Cloudflare change would incur charges. Keep test databases, previews and synthetic data isolated from production.

## Prepare and verify

1. Obtain final stable roster IDs, alias artwork and roughly 200 owner-approved ordered fight pairings. Generate the SQL and print proof using [the card workflow](fight-cards.md). Establish the canonical QR route before distributing cards.
2. Protect the 2025 archive. Take an independent snapshot of the static site, image paths and available original result exports. Arrange an archive URL or a route to the unchanged legacy origin and verify it independently before cutover. Record current DNS, TLS and legacy routing settings so they can be restored. Keep email and unrelated records intact.
3. Verify the existing test database's D1 migration ledger against files 0001–0005. The earlier handover reports 0001 and 0003 applied to test; verify 0002 explicitly. If a migration was applied outside Wrangler, reconcile the actual schema and ledger before applying it again. Confirm case-insensitive uniqueness of existing fight codes before 0005. Back up first.
4. Use an empty, separate production D1 database and explicit production Worker configuration. Double-check database ID, binding `DB`, assets, compatible runtime date and admin rate-limit binding. Leave `ENABLE_PRACTICE` unset in production and configure the strong admin secret through Cloudflare. Review plan entitlements, request and D1 quotas and monitoring within the approved budget. If Workers Builds is enabled, verify which branches and PRs trigger it before publishing the development branch.
5. Apply migrations in order and confirm the ledger, fixed-pair triggers, append-only triggers, restored source column and healthy endpoint on the intended environment. Import the reviewed registrations. Reconcile counts with the manifest, check samples of both ordered corners and verify there are zero pre-existing judge, demo and synthetic results in the clean production database.
6. Run staging acceptance using a separate test database and dummy pairs. From phones and a corporate network check QR scan, artwork, rules, two judges, note edits, removal, rescan, reconnect and receipt recovery. Confirm no third-party requests from the arena. Check admin authentication, rate limiting, CSV contents and restoration. Compare weighted reports for a 3–1 matchup and for a battle with no current votes. Scan printed QR proofs before distributing the final batch.

## Backup and recovery

- Before cutover and at agreed intervals, export an exact D1 SQL backup into approved private storage. Include the database identity, timestamp, schema version, counts and a checksum. CSV is for analysis and is not a substitute for exact backup.
- Rehearse importing the backup into a disposable isolated database. Verify migrations and triggers, row counts, code and pairing samples, operation IDs, revision chains, restore provenance, exact notes and timestamps. Test an API read against the disposable copy and record the result. Verify the applicable D1 Time Travel window and recovery mechanism in the dashboard. Keep the live database out of drills.
- Record the last good Worker version and configuration. For Worker rollback, use a version compatible with the current schema and preserve all D1 rows and the audit trail. An older build that cannot understand the current schema is unsuitable. For traffic rollback, restore prior routing to the archive, suspend 2026 intake as a separate action, and retain confirmed 2026 rows. Keep connection details and browser-origin changes in mind when recovering pending votes. Avoid two active voting backends.
- For data recovery, restore to a separate database first. Reconcile against later acknowledged events and receipts before proposing an explicit owner-approved rebind. Never overwrite live data as a rollback shortcut.

## Owner-authorised cutover

1. Freeze config changes and obtain owner sign-off for deployment, routing, backup and rollback. Confirm the old site is still reachable at its archive route. Check certificates and HTTPS redirects on the production hostname including the exact QR path.
2. Apply only the approved site routing changes. Verify the domain and archive from a desktop, phone and independent/corporate network. Check external and internal DNS resolution and certificate status without changing unrelated records.
3. Smoke-test production read paths with an actual printed code. Verify pairing, rules, assets, admin authentication and CSV accessibility. Keep synthetic writes in staging. Confirm the first authorised real vote is acknowledged, appears once, and contributes to the correct official standings. Check production health and error rates after launch.
