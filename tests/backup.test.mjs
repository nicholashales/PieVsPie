import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync, backup } from 'node:sqlite';
import { startWorker } from './local-worker.mjs';

test('consistent SQLite backup restores into a separate local D1 with exact votes and audit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pvp-backup-'));
  const original = join(root, 'original');
  const destination = join(root, 'restored');
  const code = 'BACKUP-01';
  const operation = {code, judgeId: crypto.randomUUID(), operationId: crypto.randomUUID(), revision: 1,
    winner: 'Alan Star', action: 'add', notes: 'Exact "quotes", newline\n and Unicode: café'};
  let active;
  try {
    active = await startWorker({persist: original});
    await active.db.prepare('INSERT INTO registered_fights(fight_code,red_fighter,white_fighter) VALUES (?,?,?)')
      .bind(code, 'Alan Star', 'Billie Pieper').run();
    for (const event of [operation, {...operation, operationId: crypto.randomUUID(), revision: 2, action: 'remove'}]) {
      const response = await fetch(active.base + '/api/battle', {
        method: 'POST', headers: {Origin: active.base, 'Content-Type': 'application/json'}, body: JSON.stringify(event)
      });
      assert.equal(response.status, 200);
    }
    const before = await active.db.prepare('SELECT * FROM judge_events ORDER BY seq').run();
    await active.worker.dispose();
    active = null;

    const files = (await readdir(original, {recursive: true})).filter(name => name.endsWith('.sqlite'));
    assert.ok(files.length > 0, "expected a persisted SQLite database");
    for (const file of files) {
      const db = new DatabaseSync(join(original, file), {readOnly: true});
      const target = join(destination, file);
      await mkdir(dirname(target), {recursive: true});
      try { await backup(db, target); } finally { db.close(); }
      const copy = new DatabaseSync(target, {readOnly: true});
      try { assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); }
      finally { copy.close(); }
    }

    active = await startWorker({persist: destination, migrate: false});
    assert.equal((await fetch(active.base + '/api/health')).status, 200);
    const after = await active.db.prepare('SELECT * FROM judge_events ORDER BY seq').run();
    assert.equal(after.results.length, 2);
    assert.deepEqual(after.results, before.results);
    assert.equal(after.results[0].notes, operation.notes);
    const battle = await (await fetch(active.base + '/api/battle?code=' + code)).json();
    assert.deepEqual(battle.pair, {code, red: 'Alan Star', white: 'Billie Pieper'});
    assert.deepEqual(battle.votes, []);
  } finally {
    await active?.worker.dispose();
    await rm(root, {recursive: true, force: true});
  }
});
