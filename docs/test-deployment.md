# Test deployment

The owner controls remote test deployment at `pievspie.nhales.workers.dev`. Use a dedicated test D1 database. Review and reconcile migrations 0001–0005 before relying on a test deployment. Set `ENABLE_PRACTICE=true` only in test if DEMO codes and the legacy load page are needed. Protected reports and restoration also require `ADMIN_PASSWORD` in Worker Secrets and the configured `ADMIN_RATE_LIMITER` binding.

Start with [local verification](cloudflare-migration.md). Remote smoke checks, corporate network acceptance and the cutover are described in the [production runbook](production-release-checklist.md).
