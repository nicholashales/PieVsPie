import { fighterNames } from './roster.mjs';

export const demoCode = code => typeof code === 'string' && /^DEMO-[A-Za-z0-9-]{1,64}$/.test(code);
export const registeredCode = code => typeof code === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(code) && !/^(DEMO-|TEST-|ARENA-TEST-)/i.test(code);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUUID = value => typeof value === 'string' && uuid.test(value);
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
const conflict = () => json({error: 'Battle pairing or revision changed. Reload and review the current votes.'}, 409);
const receipt = operationId => json({success: true, operationId});

export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}

async function pairFor(db, code, demo) {
  const sql = demo ? 'SELECT code,red,white FROM battle_pairs WHERE code=?' :
    'SELECT fight_code AS code,red_fighter AS red,white_fighter AS white FROM registered_fights WHERE fight_code=? AND active=1';
  return db.prepare(sql).bind(code).first();
}

async function operation(db, id) {
  return db.prepare('SELECT * FROM judge_events WHERE operation_id=?').bind(id).first();
}

async function readBattle(db, code, demo) {
  const pair = await pairFor(db, code, demo);
  if (!pair) return json({error: 'Battle not found'}, 404);
  const {results: votes} = await db.prepare(
    "SELECT judge_id,revision,winner,notes FROM current_judges WHERE code=? AND action<>'remove' ORDER BY seq"
  ).bind(code).all();
  const redVotes = votes.filter(vote => vote.winner === pair.red).length;
  const whiteVotes = votes.length - redVotes;
  return json({pair, votes, redVotes, whiteVotes, redScore: votes.length ? redVotes / votes.length : 0,
    whiteScore: votes.length ? whiteVotes / votes.length : 0});
}

async function appendVote(db, p, demo) {
  const matches = event => event && event.code === p.code && event.judge_id === p.judgeId &&
    event.revision === p.revision && event.action === p.action && event.winner === p.winner && event.notes === p.notes;
  async function acknowledge(event) {
    if (!matches(event)) return conflict();
    if (demo) {
      const pair = await pairFor(db, p.code, true);
      if (pair?.red !== p.red || pair?.white !== p.white) return conflict();
    }
    return receipt(p.operationId);
  }
  const previous = await operation(db, p.operationId);
  if (previous) return acknowledge(previous);

  const pair = await pairFor(db, p.code, demo);
  if (!pair && (!demo || p.action !== 'add')) return json({error: 'Battle not found'}, 404);
  if (demo && (!fighterNames.has(p.red) || !fighterNames.has(p.white) || p.red === p.white)) {
    return json({error: 'Choose two different practice fighters'}, 400);
  }
  if (demo && pair && (p.red !== pair.red || p.white !== pair.white)) return conflict();
  const {red, white} = pair ?? p;
  if (![red, white].includes(p.winner)) return json({error: 'Winner must belong to the registered battle'}, 400);

  const eligible = demo ? '' :
    'AND EXISTS(SELECT 1 FROM registered_fights WHERE fight_code=? AND red_fighter=? AND white_fighter=? AND active=1)';
  const eligibility = demo ? [] : [p.code, red, white];
  const statements = [];
  if (p.action === 'add') {
    statements.push(db.prepare(`
      INSERT INTO battle_pairs(code,red,white) SELECT ?,?,?
      WHERE NOT EXISTS(SELECT 1 FROM judge_events WHERE operation_id=?) ${eligible}
      ON CONFLICT(code) DO NOTHING
    `).bind(p.code, red, white, p.operationId, ...eligibility));
  }
  statements.push(db.prepare(`
    INSERT INTO judge_events(operation_id,code,judge_id,revision,action,winner,notes)
    SELECT ?,?,?,?,?,?,?
    WHERE EXISTS(SELECT 1 FROM battle_pairs WHERE code=? AND red=? AND white=?) ${eligible}
    AND (
      (?='add' AND NOT EXISTS(SELECT 1 FROM judge_events WHERE code=? AND judge_id=?))
      OR (?<>'add' AND EXISTS(SELECT 1 FROM current_judges WHERE code=? AND judge_id=? AND revision=? AND action<>'remove'
        AND (?<>'remove' OR (winner=? AND notes=?))))
    )
    ON CONFLICT DO NOTHING
  `).bind(p.operationId, p.code, p.judgeId, p.revision, p.action, p.winner, p.notes,
    p.code, red, white, ...eligibility, p.action, p.code, p.judgeId, p.action, p.code, p.judgeId, p.revision - 1, p.action, p.winner, p.notes));
  await db.batch(statements);
  return acknowledge(await operation(db, p.operationId));
}

export async function battle(request, env) {
  const url = new URL(request.url);
  const canUseDemo = env.ENABLE_PRACTICE === 'true';
  const accepts = code => registeredCode(code) || (canUseDemo && demoCode(code));
  try {
    if (request.method === 'GET') {
      const code = url.searchParams.get('code');
      return accepts(code) ? await readBattle(env.DB, code, demoCode(code)) : json({error: 'Invalid fight code'}, 400);
    }
    if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
    if (!sameOrigin(request)) return json({error: 'Same-origin request required'}, 403);
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({error: 'JSON required'}, 415);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 24000) return json({error: 'Request too large'}, 413);
    let p;
    try { p = JSON.parse(raw); } catch { return json({error: 'Invalid JSON'}, 400); }
    if (!p || !accepts(p.code) || !isUUID(p.operationId) || !isUUID(p.judgeId) ||
        !['add', 'edit', 'remove'].includes(p.action) || !Number.isSafeInteger(p.revision) ||
        (p.action === 'add' ? p.revision !== 1 : p.revision < 2) ||
        typeof p.winner !== 'string' || typeof p.notes !== 'string' || p.notes.length > 4000) {
      return json({error: 'Invalid operation'}, 400);
    }
    return await appendVote(env.DB, p, demoCode(p.code));
  } catch (error) {
    console.error('Battle API unavailable', error);
    return json({error: 'Battle database unavailable'}, 503);
  }
}

export async function restoreVote(db, {operationId, seq, revision}) {
  if (!isUUID(operationId) || !Number.isSafeInteger(seq) || seq < 1 ||
      !Number.isSafeInteger(revision) || revision < 2) return 400;
  await db.prepare(`
    INSERT INTO judge_events(operation_id,code,judge_id,revision,action,winner,notes,restored_from_seq)
    SELECT ?,source.code,source.judge_id,?,'restore',source.winner,source.notes,source.seq
    FROM judge_events source JOIN current_judges current
      ON current.code=source.code AND current.judge_id=source.judge_id
    WHERE source.seq=? AND source.action<>'remove'
      AND current.action='remove' AND current.revision=?
    ON CONFLICT DO NOTHING
  `).bind(operationId, revision, seq, revision - 1).run();
  const saved = await operation(db, operationId);
  return saved?.action === 'restore' && saved.revision === revision && saved.restored_from_seq === seq ? 200 : 409;
}
