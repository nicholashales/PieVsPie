# Production release gates

- Configure ADMIN_PASSWORD in Worker Secrets, never in GitHub. Use a randomly generated 24+ character ASCII password. Test no secret -> 503, wrong password -> 401, correct password -> page and CSV. Add rate limiting or Cloudflare Access before production.
- CSV is a spreadsheet-safe export (formula-like fields are escaped); use D1 SQL export for exact backups. CSV deliberately fails above 10,000 rows. Admin is read-only.
- Apply migration 0002 in the test database. Decide whether a Mince Meet code accepts one result or several judges, whether QR links fix the fighter pairing, and how corrections work. Registered fight table is not yet enforced. Do not turn on production voting until server-side validation and transactional eligibility are tested.
- Separate test and production D1 databases. Never promote synthetic results into production.
- Export an exact SQL backup of the test database using Cloudflare D1 export. Import into a separate disposable database; verify row counts and sample receipt IDs, winners, notes and timestamps. Check Cloudflare Time Travel recovery window in dashboard and practise restore only on disposable data. Record results. Never restore over the live competition as a test.
- Test closing the arena while a vote is queued offline, then reconnecting and reopening. Verify receipt and one stored row. Test multiple tabs; one-slot local queue is not yet safe for simultaneous tabs.
- Test from corporate network. No Google requests should occur from arena. Test final custom domain separately.
- Restrict or remove synthetic test endpoints and restrict vote writes to registered codes before launch. Confirm billing, quotas, monitoring, and rollback. 
