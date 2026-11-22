# Pie vs Pie refresh — initial technical audit and roadmap

Inspected GitHub `main` on 22 November 2026. Keep live site and original files untouched while preparing v2.

## Current structure
- `images/fighters/original/` contains 28 character identities × 3 poses (84 images).
- `images/fighters/LabelPoses/` holds label versions; `images/fighters/800h/` stores resized art.
- `fighter-cards.html` has hard-coded fighter list/print layout.
- `index.html` hard-codes final standings.
- `src/MincePieVote.jsx` uses Google Apps Script/Sheets with full-array update writes, vulnerable to simultaneous voting overwrites.
- Static HTML coexists with React/Vite; migration needs to account for both.

## Proposed architecture
Managed PostgreSQL (Supabase is candidate) for fighter IDs and art metadata, season-specific pie entries, matches, atomic vote events, competition standings and admin audit. Browser voting via a narrow rate-limited server-side endpoint; never expose admin credentials. Public read-only results; authenticated administration; backups, CSV exports and historical provenance.

## Work sequence
1. Sign off art bible and common canvas, plus cross-roster relative-scale lineup.
2. Build PNG validation and six-image manifest; test arena anchor.
3. Agree vote eligibility and voting frequency; design database permissions and schema.
4. Import source match history from an actual export, reconcile totals and BTL; do not invent individual votes from static aggregates.
5. Implement atomic API voting, admin workflows, live standings and migrated fighter cards.
6. Parallel test, verify responsiveness, deploy with rollback.

## Security follow-up
The public repo contains a file named `mykey` beside `mykey.pub`. Its contents have **not** been accessed here. If it is a live private key, revoke/rotate immediately and remove all public Git history exposure; deletion alone is insufficient.
