import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startWorker, applyMigrations, basic } from './local-worker.mjs';
import { registerSQL, validateFights, printCards } from '../scripts/fight-cards.mjs';
import { standings } from '../standings.js';

let runtime;
before(async () => {
  runtime = await startWorker({practice: true});
  await runtime.db.prepare(registerSQL(validateFights({version: 1, fights: [
    {code: 'LOCAL-01', redId: 1, whiteId: 2},
    {code: 'LOCAL-02', redId: 1, whiteId: 3},
    {code: 'LOCAL-03', redId: 2, whiteId: 3}
  ]}))).run();
});
after(() => runtime?.worker.dispose());

const get = path => fetch(runtime.base + path);
const json = {'Content-Type': 'application/json'};
const post = (operation, headers = {}) => fetch(runtime.base + '/api/battle', {
  method: 'POST', headers: {Origin: runtime.base, ...json, ...headers}, body: JSON.stringify(operation)
});
const vote = (extra = {}) => ({operationId: crypto.randomUUID(), judgeId: crypto.randomUUID(), revision: 1,
  code: 'LOCAL-01', action: 'add', winner: 'Alan Star', notes: '', ...extra});
const change = (prior, action, fields = {}) => ({...prior, operationId: crypto.randomUUID(),
  revision: prior.revision + 1, action, ...fields});
const read = async code => (await get('/api/battle?code=' + code)).json();
const admin = (path, options) => fetch(runtime.base + path, {
  ...options, headers: {Authorization: basic, ...options?.headers}
});

test('migration gates and routes work with a registered code', async () => {
  assert.equal((await get('/api/health')).status, 200);
  assert.equal((await get('/rules')).status, 200);
  assert.equal((await get('/arena/?code=LOCAL-01')).status, 200);
  assert.match(await (await get('/arena/arena.js')).text(), /Awaiting confirmation/);
  assert.equal((await fetch(runtime.base + '/arena/arena.js', {method: 'HEAD'})).status, 200);
  const empty = await read('LOCAL-01&red=3&white=2');
  assert.deepEqual(empty.pair, {code: 'LOCAL-01', red: 'Alan Star', white: 'Billie Pieper'});
  assert.deepEqual(empty.votes, []);
  assert.equal(empty.redScore + empty.whiteScore, 0);
  assert.equal((await get('/api/battle?code=unknown')).status, 404);
  assert.equal((await get('/api/battle?code=TEST-123')).status, 400);
});

test('legacy-only or partially migrated databases are unhealthy until all migrations run', async () => {
  const {worker, base, db} = await startWorker({migrate: false});
  try {
    const health = async () => (await fetch(base + '/api/health')).status;
    await applyMigrations(db, ['0001_results.sql', '0003_judge_events.sql']);
    assert.equal(await health(), 503);
    await applyMigrations(db, ['0002_fight_codes.sql', '0004_audit_restore.sql']);
    assert.equal(await health(), 503);
    await applyMigrations(db, ['0005_fixed_fight_pair.sql']);
    assert.equal(await health(), 200);
    assert.equal((await fetch(base + '/api/battle?code=DEMO-01')).status, 400);
    assert.equal((await fetch(base + '/api/results', {method: 'POST'})).status, 404);
    assert.equal((await fetch(base + '/test')).status, 404);
  } finally {
    await worker.dispose();
  }
});

test('write validation enforces method, origin, media type, canonical pair and revisions', async () => {
  assert.equal((await post(vote(), {Origin: 'https://example.invalid'})).status, 403);
  assert.equal((await post(vote(), {'Content-Type': 'application/jsonp'})).status, 415);
  assert.equal((await fetch(runtime.base + '/api/battle', {method: 'PUT'})).status, 405);
  assert.equal((await fetch(runtime.base + '/api/battle', {method: 'POST', headers: {Origin: runtime.base, ...json}, body: '{'})).status, 400);
  for (const bad of [
    vote({action: 'restore'}), vote({revision: 2}), vote({judgeId: [crypto.randomUUID()]}),
    vote({notes: 'x'.repeat(4001)}), vote({winner: 'Brandy Toksvig', red: 'Brandy Toksvig', white: 'Billie Pieper'})
  ]) assert.equal((await post(bad)).status, 400);
  assert.equal((await post(vote({notes: 'x'.repeat(25000)}))).status, 413);
  assert.equal((await post(vote({code: 'UNREGISTERED'}))).status, 404);
  await runtime.db.prepare("UPDATE registered_fights SET active=0 WHERE fight_code='LOCAL-03'").run();
  assert.equal((await post(vote({code: 'LOCAL-03', winner: 'Billie Pieper'}))).status, 404);
});

test('lost acknowledgment, simultaneous replay, weighted votes and edit/remove conflicts', async () => {
  const first = vote({red: 'wrong', white: 'ignored', notes: '=1+1'});
  await post(first); // Simulate a caller that never consumed the first acknowledgment.
  const replays = await Promise.all(Array.from({length: 10}, () => post(first)));
  for (const res of replays) {
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {success: true, operationId: first.operationId});
  }
  assert.equal((await post({...first, notes: 'altered'})).status, 409);
  assert.equal((await read(first.code)).votes.length, 1);
  const second = vote();
  const third = vote({winner: 'Billie Pieper'});
  assert.deepEqual((await Promise.all([post(second), post(third)])).map(res => res.status), [200, 200]);
  const shared = await read(first.code);
  assert.equal(shared.redScore, 2 / 3);
  assert.equal(shared.whiteScore, 1 / 3);
  const a = change(first, 'edit', {winner: 'Billie Pieper', notes: '<script>first</script>'});
  const b = change(first, 'edit', {notes: 'other correction'});
  const outcomes = await Promise.all([post(a), post(b)]);
  assert.deepEqual(outcomes.map(res => res.status).sort(), [200, 409]);
  const edited = outcomes[0].ok ? a : b;
  const removed = change(edited, 'remove');
  assert.equal((await post({...removed, notes: 'tampered snapshot'})).status, 409);
  assert.equal((await post(removed)).status, 200);
  assert.equal((await post(removed)).status, 200);
  assert.equal((await post(change(removed, 'edit'))).status, 409);
  assert.equal((await read(first.code)).votes.length, 2);
  await assert.rejects(runtime.db.prepare('DELETE FROM judge_events WHERE operation_id=?').bind(first.operationId).run(), /immutable/);
  await assert.rejects(runtime.db.prepare("UPDATE judge_events SET notes='changed' WHERE operation_id=?").bind(first.operationId).run(), /immutable/);
});

test('DEMO pairing creation is atomic and its raw votes, reports and legacy practice stay isolated', async () => {
  const demo = vote({code: 'DEMO-LOCAL', red: 'Alan Star', white: 'Billie Pieper'});
  const other = vote({code: demo.code, red: 'Alan Star', white: 'Brandy Toksvig'});
  const attempts = await Promise.all([post(demo), post(other)]);
  assert.deepEqual(attempts.map(res => res.status).sort(), [200, 409]);
  assert.equal((await read(demo.code)).votes.length, 1);
  assert.doesNotMatch(await (await admin('/admin/weights.csv')).text(), /DEMO-LOCAL/);
  assert.match(await (await admin('/admin/weights.csv?scope=demo')).text(), /DEMO-LOCAL/);
  const request = {requestId: crypto.randomUUID(), competition: 'pie', pieCode: 'TEST-123',
    redFighter: 'TEST Red', whiteFighter: 'TEST White', winner: 'TEST Red', loser: 'TEST White', tastingNotes: ''};
  const legacy = data => fetch(runtime.base + '/api/results', {method: 'POST',
    headers: {Origin: runtime.base, ...json}, body: JSON.stringify(data)});
  assert.equal((await legacy(request)).status, 200);
  assert.equal((await legacy(request)).status, 200);
  assert.equal((await legacy({...request, pieCode: 'LOCAL-01'})).status, 400);
  assert.match(await (await admin('/admin/results.csv?scope=load')).text(), /TEST-123/);
});

test('admin credentials, rate limit, same-origin restore, sanitized CSV and exact audit trail', async () => {
  assert.equal((await get('/admin/audit.csv')).status, 401);
  for (let i = 0; i < 10; i++) await get('/admin/audit.csv');
  assert.equal((await get('/admin/audit.csv')).status, 429);
  const original = vote({code: 'LOCAL-02', notes: '=1+1\n"<script>alert(1)</script>"'});
  assert.equal((await post(original)).status, 200);
  assert.equal((await post(change(original, 'remove'))).status, 200);
  assert.equal((await read(original.code)).votes.length, 0);
  assert.match(await (await admin('/admin/weights.csv')).text(), /"LOCAL-02","Alan Star","Brandy Toksvig","0","0","0","0","0","0"/);
  const audit = await (await admin('/admin/audit')).text();
  assert.match(audit, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(audit, /Restore this revision/);
  const row = await runtime.db.prepare('SELECT seq FROM judge_events WHERE operation_id=?').bind(original.operationId).first();
  const operationId = crypto.randomUUID();
  const body = new URLSearchParams({operationId, seq: row.seq, revision: 3});
  const restore = (origin, data = body) => admin('/admin/restore', {method: 'POST', redirect: 'manual',
    body: data, headers: {Origin: origin}});
  assert.equal((await restore('https://example.invalid')).status, 403);
  assert.equal((await restore(runtime.base)).status, 303);
  assert.equal((await restore(runtime.base)).status, 303);
  assert.equal((await restore(runtime.base, new URLSearchParams({...Object.fromEntries(body), operationId: crypto.randomUUID()}))).status, 409);
  const restored = (await read(original.code)).votes[0];
  assert.equal(restored.notes, original.notes);
  assert.equal(restored.revision, 3);
  assert.match(await (await admin('/admin/audit.csv')).text(), /"'=1\+1\n""<script>/);
  assert.match(await (await admin('/admin/votes.csv')).text(), /"3","restore"/);
  assert.match(await (await admin('/admin/standings.csv')).text(), /"Alan Star"/);
  const disabled = await startWorker({admin: false, migrate: false});
  try { assert.equal((await fetch(disabled.base + '/admin')).status, 503); }
  finally { await disabled.worker.dispose(); }
});

test('registration import validates stable IDs and rolls back a conflicting batch', async () => {
  const spec = fights => ({version: 1, fights});
  for (const candidate of [
    [{code: 'TEST-improper', redId: 1, whiteId: 2}],
    [{code: 'simple', redId: 1, whiteId: 999}],
    [{code: 'simple', redId: 1, whiteId: 1}],
    [{code: 'simple', redId: 1, whiteId: 2}, {code: 'SIMPLE', redId: 2, whiteId: 3}]
  ]) assert.throws(() => validateFights(spec(candidate)));
  const fights = validateFights(spec([{code: 'LOCAL-01', redId: 1, whiteId: 2}]));
  await runtime.db.prepare(registerSQL(fights)).run();
  const caseVariant = validateFights(spec([{code: 'local-01', redId: 1, whiteId: 2}]));
  await assert.rejects(runtime.db.prepare(registerSQL(caseVariant)).run(), /permanent/);
  const conflicting = validateFights(spec([{code: 'ROLLBACK-01', redId: 1, whiteId: 2}, {code: 'LOCAL-01', redId: 2, whiteId: 1}]));
  await assert.rejects(runtime.db.prepare(registerSQL(conflicting)).run(), /permanent/);
  assert.equal((await get('/api/battle?code=ROLLBACK-01')).status, 404);
  await assert.rejects(runtime.db.prepare("DELETE FROM registered_fights WHERE fight_code='LOCAL-01'").run(), /Deactivate/);
  const html = await printCards(fights);
  assert.match(html, /https:\/\/pievspie\.online\/arena\/\?code=LOCAL-01/);
  assert.match(html, /<svg/);
});

test('BTL converges, uses equal battle weight, excludes empty fights and is invariant to input order', () => {
  const outcomes = [
    {code: 'a', red: 'A', white: 'B', red_votes: 9, white_votes: 3},
    {code: 'b', red: 'A', white: 'B', red_votes: 0, white_votes: 1},
    {code: 'c', red: 'X', white: 'Y', red_votes: 0, white_votes: 0},
    {code: 'd', red: 'C', white: 'D', red_votes: 1, white_votes: 1}
  ];
  const ranked = standings(outcomes);
  assert.deepEqual(ranked, standings(outcomes.toReversed()));
  assert.deepEqual(ranked.map(row => row.name), ['B', 'C', 'D', 'A']);
  const a = ranked.find(row => row.name === 'A');
  const b = ranked[0];
  assert.equal(a.wins, .75);
  assert.equal(a.judges, 13);
  assert.ok(Math.abs(.75 - 2 / (1 + Math.exp(b.log - a.log)) - .1 * a.log) < 1e-10);
  const sweep = standings(Array.from({length: 200}, (_, i) => ({code: String(i), red: 'A', white: 'B', red_votes: 1, white_votes: 0})));
  assert.ok(sweep[0].log > 2 && Number.isFinite(sweep[0].btl));
});

test('200 card registrations and 1,000 concurrent-batch submissions preserve receipt counts and weights', {timeout: 20000}, async () => {
  const fights = validateFights({version: 1, fights: Array.from({length: 200}, (_, i) => ({
    code: 'VOLUME-' + String(i).padStart(3, '0'), redId: 1, whiteId: 2
  }))});
  await runtime.db.prepare(registerSQL(fights)).run();
  const cards = await printCards(fights);
  assert.equal((cards.match(/<svg/g) ?? []).length, 200);
  for (let offset = 0; offset < fights.length; offset += 10) {
    const operations = fights.slice(offset, offset + 10).flatMap(({code}) =>
      Array.from({length: 5}, (_, judge) => vote({code, winner: judge < 3 ? 'Alan Star' : 'Billie Pieper'})));
    await Promise.all(operations.map(async op => {
      const response = await post(op);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).operationId, op.operationId);
    }));
  }
  const {n} = await runtime.db.prepare("SELECT COUNT(*) AS n FROM judge_events WHERE code GLOB 'VOLUME-*'").first();
  assert.equal(n, 1000);
  const weights = await (await admin('/admin/weights.csv')).text();
  const lines = weights.split('\r\n').filter(line => line.startsWith('"VOLUME-'));
  assert.equal(lines.length, 200);
  assert.ok(lines.every(line => line.endsWith(',"3","2","5","0.6","0.4","1"')));
});
