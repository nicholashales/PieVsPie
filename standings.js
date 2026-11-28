const lambda = 0.1;

// Accelerated gradient descent on the L2-regularized log-strength likelihood.
export function standings(battles) {
  const stats = new Map();
  const edges = [];
  function fighter(name) {
    if (!stats.has(name)) stats.set(name, {name, played: 0, judges: 0, wins: 0, losses: 0, log: 0, probe: 0});
    return stats.get(name);
  }
  for (const battle of [...battles].sort((a, b) => a.code < b.code ? -1 : Number(a.code > b.code))) {
    const total = Number(battle.red_votes) + Number(battle.white_votes);
    if (!total) continue;
    const red = fighter(battle.red);
    const white = fighter(battle.white);
    const share = Number(battle.red_votes) / total;
    for (const item of [red, white]) {
      item.played++;
      item.judges += total;
    }
    red.wins += share;
    red.losses += 1 - share;
    white.wins += 1 - share;
    white.losses += share;
    edges.push({red, white, share});
  }
  if (!edges.length) return [];
  const rows = [...stats.values()];
  // The logistic Hessian is bounded by one quarter of the matchup graph Laplacian.
  const lipschitz = lambda + Math.max(...rows.map(row => row.played)) / 2;
  const ratio = Math.sqrt(lambda / lipschitz);
  const momentum = (1 - ratio) / (1 + ratio);
  let converged = false;
  for (let iteration = 0; iteration < 10000; iteration++) {
    for (const row of rows) row.gradient = -lambda * row.probe;
    for (const {red, white, share} of edges) {
      const gradient = share - 1 / (1 + Math.exp(white.probe - red.probe));
      red.gradient += gradient;
      white.gradient -= gradient;
    }
    if (rows.every(row => Math.abs(row.gradient) < 1e-11)) {
      converged = true;
      break;
    }
    for (const row of rows) {
      const next = row.probe + row.gradient / lipschitz;
      row.probe = next + momentum * (next - row.log);
      row.log = next;
    }
  }
  if (!converged) throw new Error('BTL did not converge');
  return rows.map(({name, played, judges, wins, losses, probe: log}) => ({
    name, played, judges, wins, losses, log, winPct: 100 * wins / played, btl: Math.exp(log)
  })).sort((a, b) => b.log - a.log || a.name.localeCompare(b.name));
}

export function battleWeights(rows) {
  return rows.map(row => {
    const judges = row.red_votes + row.white_votes;
    return {...row, judges, red_weight: judges ? row.red_votes / judges : 0,
      white_weight: judges ? row.white_votes / judges : 0, total_weight: judges ? 1 : 0};
  });
}

export const battleQuery = (demo = false) => `
  SELECT b.code,b.red,b.white,
    SUM(CASE WHEN j.winner=b.red THEN 1 ELSE 0 END) AS red_votes,
    SUM(CASE WHEN j.winner=b.white THEN 1 ELSE 0 END) AS white_votes
  FROM (${demo ? "SELECT code,red,white FROM battle_pairs WHERE code GLOB 'DEMO-*'" :
    'SELECT fight_code AS code,red_fighter AS red,white_fighter AS white FROM registered_fights'}) b
  LEFT JOIN current_judges j ON j.code=b.code AND j.action<>'remove'
  GROUP BY b.code,b.red,b.white ORDER BY b.code
`;
