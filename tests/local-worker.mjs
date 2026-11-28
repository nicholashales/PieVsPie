import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
export const password = 'local-only-test-password-123';
export const basic = 'Basic ' + Buffer.from('admin:' + password).toString('base64');

export async function startWorker({practice = false, admin = true, persist, migrate = true} = {}) {
  const token = crypto.randomUUID();
  const worker = new Miniflare(convertV4MiniflareOptions({
    name: 'pvp-local',
    host: '127.0.0.1',
    modules: [
      'tests/fixture-worker.mjs', 'worker.js', 'battle.js', 'roster.mjs', 'rules-page.js',
      'admin.js', 'standings.js', 'test-page.js', 'functions/api/results.js', 'functions/api/health.js'
    ].map(path => ({type: 'ESModule', path})),
    cf: false,
    compatibilityDate: config.compatibility_date,
    assets: {directory: 'arena-assets', binding: 'ASSETS', routerConfig: {has_user_worker: true, invoke_user_worker_ahead_of_assets: true}},
    d1Databases: {DB: 'local-tests-only'},
    resourcePersistencePath: persist,
    bindings: {...(admin ? {ADMIN_PASSWORD: password} : {}), ENABLE_PRACTICE: String(practice), LOCAL_TEST_TOKEN: token},
    ratelimits: {ADMIN_RATE_LIMITER: {namespace_id: '1001', simple: {limit: 10, period: 60}}}
  }));
  try {
    const base = (await worker.ready).origin;
    async function batch(statements) {
      const response = await fetch(base + '/__local-test-sql', {
        method: 'POST', headers: {'X-Test-Token': token}, body: JSON.stringify(statements.map(s => s.query)),
        signal: AbortSignal.timeout(5000)
      });
      const body = await response.text();
      if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error(body);
      const result = JSON.parse(body);
      if (!response.ok) throw new Error(result.error);
      return result;
    }
    function prepare(sql, args = []) {
      return {
        query: {sql, args},
        bind: (...values) => prepare(sql, values),
        run: async () => (await batch([prepare(sql, args)]))[0],
        first: async () => (await batch([prepare(sql, args)]))[0].results[0] ?? null
      };
    }
    const db = {batch, prepare};
    if (migrate) await applyMigrations(db);
    return {worker, base, db};
  } catch (error) {
    await worker.dispose();
    throw error;
  }
}

export async function applyMigrations(db, names = null) {
  const files = (names ?? await readdir('migrations')).sort();
  for (const file of files) {
    const sql = (await readFile('migrations/' + file, 'utf8')).replace(/^\s*--.*$/gm, '');
    // These migrations contain simple statements and trigger bodies ending in END;.
    const statements = sql.trim().split(/;\s*\n(?=\s*(?:CREATE|ALTER|$))/i).filter(s => s.trim());
    await db.batch(statements.map(statement => db.prepare(statement)));
  }
}
