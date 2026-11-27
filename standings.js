// Each completed battle contributes one unit of weight. Regularized BTL on log strengths.
export function standings(battles){
 const stats=new Map(),edges=[];
 function get(n){if(!stats.has(n))stats.set(n,{name:n,played:0,judges:0,wins:0,losses:0,log:0});return stats.get(n)}
 for(const b of battles){const total=Number(b.red_votes)+Number(b.white_votes);if(!total)continue;const a=get(b.red),c=get(b.white),w=Number(b.red_votes)/total;for(const s of [a,c]){s.played++;s.judges+=total}a.wins+=w;a.losses+=1-w;c.wins+=1-w;c.losses+=w;edges.push([a,c,w]);}
 const rows=[...stats.values()];const degree=Math.max(1,...rows.map(r=>r.played));const step=1/(degree+1),lambda=0.1;
 for(let i=0;i<10000;i++){const g=new Map(rows.map(r=>[r,-lambda*r.log]));for(const [a,b,w] of edges){const p=1/(1+Math.exp(b.log-a.log));g.set(a,g.get(a)+w-p);g.set(b,g.get(b)-w+p)}let delta=0;for(const r of rows){const d=step*g.get(r);r.log+=d;delta=Math.max(delta,Math.abs(d))}if(delta<1e-9)break;}
 return rows.map(r=>({...r,winPct:100*r.wins/r.played,btl:Math.exp(r.log)})).sort((a,b)=>b.btl-a.btl||a.name.localeCompare(b.name));
}
export const battleQuery="SELECT b.code,b.red,b.white,SUM(CASE WHEN j.winner=b.red THEN 1 ELSE 0 END) AS red_votes,SUM(CASE WHEN j.winner=b.white THEN 1 ELSE 0 END) AS white_votes FROM battle_pairs b LEFT JOIN current_judges j ON j.code=b.code AND j.action<>'remove' GROUP BY b.code,b.red,b.white ORDER BY b.code";
