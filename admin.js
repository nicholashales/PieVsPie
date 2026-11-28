import { demoCode, restoreVote, sameOrigin } from './battle.js';
import { standings, battleQuery, battleWeights } from './standings.js';

const legacyFields = ['request_id', 'competition', 'fight_code', 'red_fighter', 'white_fighter', 'winner',
  'loser', 'tasting_notes', 'created_at'];
const voteFields = ['seq', 'operation_id', 'code', 'judge_id', 'revision', 'action', 'winner', 'notes', 'created_at',
  'restored_from_seq'];
const weightFields = ['code', 'red', 'white', 'red_votes', 'white_votes', 'judges', 'red_weight', 'white_weight', 'total_weight'];
const standingsFields = ['name', 'played', 'judges', 'wins', 'losses', 'winPct', 'btl'];
const headers = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]
));
const plain = (body, status) => new Response(body, {status, headers});
const html = body => new Response(body, {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
const dateOrder = 'created_at DESC,request_id DESC';
const reports = {
  '/admin': 'Legacy results',
  '/admin/audit': 'Audit history',
  '/admin/votes': 'Raw current votes',
  '/admin/weights': 'Battle weights',
  '/admin/standings': 'Weighted standings'
};

async function equal(a, b) {
  const enc = new TextEncoder();
  const x = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(a)));
  const y = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(b)));
  let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x[i] ^ y[i];
  return mismatch === 0;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function download(fields, rows, name) {
  if (rows.length > 10000) return plain('Export exceeds 10,000 rows. Use a SQL backup for the full export.', 413);
  const text = '\uFEFF' + [fields.join(','), ...rows.map(row => fields.map(key => csvCell(row[key])).join(','))].join('\r\n');
  return new Response(text, {headers: {...headers, 'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="pievspie-' + name + '.csv"'}});
}

function restoreForm(row) {
  if (row.action === 'remove' || row.current_action !== 'remove') return '';
  return '<form method="post" action="/admin/restore">' +
    '<input type="hidden" name="seq" value="' + row.seq + '">' +
    '<input type="hidden" name="revision" value="' + (row.current_revision + 1) + '">' +
    '<input type="hidden" name="operationId" value="' + crypto.randomUUID() + '">' +
    '<button>Restore this revision</button></form>';
}

function report({path, fields, rows, page, scope, practice, paged, message}) {
  const restore = path === '/admin/audit';
  const query = scope ? '?scope=' + scope : '';
  const pageUrl = n => path + query + (query ? '&amp;' : '?') + 'page=' + n;
  const csvPath = path === '/admin' ? '/admin/results.csv' : path + '.csv';
  const shown = paged ? rows.slice(0, 100) : rows;
  const headings = fields.map(key => '<th scope="col">' + esc(key) + '</th>').join('');
  const content = shown.map(row => '<tr>' + fields.map(key => {
    const value = row[key];
    return '<td>' + esc(typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(4) : value) + '</td>';
  }).join('') + (restore ? '<td>' + restoreForm(row) + '</td>' : '') + '</tr>').join('');
  const nav = Object.entries(reports).map(([url, label]) => '<a href="' + url +
    (url !== '/admin' && scope === 'demo' ? '?scope=demo' : '') + '">' + label + '</a>').join('');
  const scopes = path === '/admin' ? '<a href="/admin">All legacy</a><a href="/admin?scope=practice">Arena practice</a><a href="/admin?scope=load">Load tests</a>' :
    practice ? '<a href="' + path + '">Registered battles</a><a href="' + path + '?scope=demo">Demo battles</a>' : '';
  return html(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Pie vs Pie admin</title>
<style>body{background:#1a1a2e;color:#f4e4c1;font:16px Arial;padding:16px}a{color:#f4e4c1;margin-right:12px}
.table{overflow:auto}table{border-collapse:collapse;background:#f4e4c1;color:#1a1a2e;width:100%}
td,th{padding:10px;border-bottom:1px solid #aaa;text-align:left;overflow-wrap:anywhere}th{background:#a00000;color:white}</style>
<h1>PIE VS PIE — ${reports[path]}</h1><nav>${nav}</nav>
<p>${scopes}<a href="${csvPath + query}">Download CSV</a></p>${message ? '<p role="status">' + esc(message) + '</p>' : ''}
<p>${path === '/admin' ? 'Historical and synthetic legacy results' : scope === 'demo' ? 'Demo battles' : 'Registered battles'}
${paged ? ' · Page ' + page : ''}</p>
<div class="table"><table><thead><tr>${headings}${restore ? '<th scope="col">Action</th>' : ''}</tr></thead>
<tbody>${content}</tbody></table></div><p>${paged && page > 1 ? '<a href="' + pageUrl(page - 1) + '">Previous</a>' : ''}
${paged && rows.length > 100 ? '<a href="' + pageUrl(page + 1) + '">Next</a>' : ''}</p></html>`);
}

async function restore(request, env) {
  if (!sameOrigin(request)) return plain('Same-origin request required', 403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    return plain('Form data required', 415);
  }
  const raw = await request.text();
  if (raw.length > 1024) return plain('Request too large', 413);
  const form = new URLSearchParams(raw);
  const seq = Number(form.get('seq'));
  const source = await env.DB.prepare('SELECT code FROM judge_events WHERE seq=?').bind(Number.isSafeInteger(seq) ? seq : 0).first();
  const demo = source && demoCode(source.code);
  if (demo && env.ENABLE_PRACTICE !== 'true') return plain('Not found', 404);
  const status = await restoreVote(env.DB, {operationId: form.get('operationId'), seq, revision: Number(form.get('revision'))});
  if (status !== 200) return plain(status === 409 ? 'Vote changed. Reload the audit before retrying.' : 'Invalid restoration', status);
  const location = '/admin/audit?restored=1' + (demo ? '&scope=demo' : '');
  return new Response(null, {status: 303, headers: {...headers, Location: location}});
}

export async function admin(request, env) {
  if (typeof env.ADMIN_PASSWORD !== 'string' || !/^[!-~]{24,}$/.test(env.ADMIN_PASSWORD) || !env.ADMIN_RATE_LIMITER) {
    return plain('Administration is disabled. Configure authentication and the rate limiter.', 503);
  }
  let supplied = '';
  try {
    const authorization = request.headers.get('Authorization') || '';
    if (authorization.startsWith('Basic ') && authorization.length < 1024) supplied = atob(authorization.slice(6));
  } catch { /* Malformed Basic credentials. */ }
  const url = new URL(request.url);
  const path = url.pathname === '/admin/results.csv' ? '/admin' : url.pathname.replace(/\.csv$/, '');
  try {
    if (!await equal(supplied, 'admin:' + env.ADMIN_PASSWORD)) {
      const key = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!(await env.ADMIN_RATE_LIMITER.limit({key})).success) {
        return new Response('Too many attempts', {status: 429, headers: {...headers, 'Retry-After': '60'}});
      }
      return new Response('Authentication required', {status: 401,
        headers: {...headers, 'WWW-Authenticate': 'Basic realm="Pie vs Pie admin", charset="UTF-8"'}});
    }
    if (url.pathname === '/admin/restore') {
      return request.method === 'POST' ? await restore(request, env) : plain('Method not allowed', 405);
    }
    if (!Object.hasOwn(reports, path)) return plain('Not found', 404);
    if (request.method !== 'GET') return plain('Method not allowed', 405);

    const csv = url.pathname.endsWith('.csv');
    const page = Math.min(10000, Math.max(1, Number.parseInt(url.searchParams.get('page'), 10) || 1));
    const practice = env.ENABLE_PRACTICE === 'true';
    const selected = url.searchParams.get('scope');
    const scope = path === '/admin' && ['practice', 'load'].includes(selected) ? selected :
      path !== '/admin' && practice && selected === 'demo' ? 'demo' : '';
    const filter = column => column + (scope === 'demo' ? " GLOB 'DEMO-*'" : " NOT GLOB 'DEMO-*'");
    let fields;
    let sql;
    let rows;
    if (path === '/admin') {
      fields = legacyFields;
      const where = scope ? " WHERE fight_code LIKE '" + (scope === 'load' ? 'TEST-' : 'ARENA-TEST-') + "%'" : '';
      sql = 'SELECT ' + fields.join(',') + ' FROM fight_results' + where + ' ORDER BY ' + dateOrder;
    } else if (path === '/admin/audit' || path === '/admin/votes') {
      fields = voteFields;
      const audit = path === '/admin/audit';
      sql = 'SELECT ' + fields.map(key => 'e.' + key).join(',') +
        (audit ? ',c.action AS current_action,c.revision AS current_revision FROM judge_events e JOIN current_judges c ON c.code=e.code AND c.judge_id=e.judge_id' :
          ' FROM current_judges e') + ' WHERE ' + filter('e.code') + ' ORDER BY e.seq DESC';
    } else {
      const result = await env.DB.prepare(battleQuery(scope === 'demo')).all();
      fields = path === '/admin/weights' ? weightFields : standingsFields;
      rows = path === '/admin/weights' ? battleWeights(result.results) : standings(result.results);
    }
    if (sql) {
      const result = await env.DB.prepare(sql + ' LIMIT ? OFFSET ?').bind(csv ? 10001 : 101, csv ? 0 : (page - 1) * 100).all();
      rows = result.results;
    }
    if (csv) return download(fields, rows, (scope ? scope + '-' : '') + (path.split('/')[2] ?? 'legacy'));
    return report({path, fields, rows, page, scope, practice, paged: Boolean(sql),
      message: url.searchParams.has('restored') ? 'Vote restored.' : ''});
  } catch (error) {
    console.error('Admin request failed', error);
    return plain('Administration unavailable', 503);
  }
}
