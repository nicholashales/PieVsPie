export async function onRequestGet({env}) {
  const headers = {'Cache-Control': 'no-store'};
  try {
    const results = await env.DB.batch([
      env.DB.prepare('SELECT request_id FROM fight_results LIMIT 1'),
      env.DB.prepare('SELECT fight_code FROM registered_fights LIMIT 1'),
      env.DB.prepare('SELECT restored_from_seq FROM current_judges LIMIT 1'),
      env.DB.prepare("SELECT CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS fixed_pair FROM sqlite_master WHERE type='trigger' AND name IN ('registered_fights_fixed_pair','registered_fights_no_delete')")
    ]);
    if (results[3].results[0].fixed_pair !== 1) return new Response('Unavailable', {status: 503, headers});
    return new Response('OK', {headers});
  } catch {
    return new Response('Unavailable', {status: 503, headers});
  }
}
