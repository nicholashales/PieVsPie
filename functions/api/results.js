const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export async function onRequestPost({request,env}) {
 if (env.ENABLE_PRACTICE !== "true") return json({error:"Not found"},404);
 try {
  if(request.headers.get("Origin")!==new URL(request.url).origin) return json({error:"Origin not allowed"},403);
  if(!request.headers.get("Content-Type")?.startsWith("application/json")) return json({error:"JSON required"},415);
  const raw=await request.text(); if(raw.length>16000) return json({error:"Request too large"},413);
  let b; try {b=JSON.parse(raw)} catch {return json({error:"Invalid JSON"},400)}
  if(!b || typeof b!=="object") return json({error:"Invalid request"},400);
  const keys=["requestId","competition","pieCode","redFighter","whiteFighter","winner","loser","tastingNotes"];
  if(keys.some(k=>typeof b[k]!=="string")) return json({error:"Missing fields"},400);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId) || !["pie","log"].includes(b.competition) || !b.pieCode.trim() || b.pieCode.length>100 || b.tastingNotes.length>4000 || [b.redFighter,b.whiteFighter,b.winner,b.loser].some(s=>!s.trim()||s.length>200) || b.redFighter===b.whiteFighter || !((b.winner===b.redFighter&&b.loser===b.whiteFighter)||(b.winner===b.whiteFighter&&b.loser===b.redFighter))) return json({error:"Invalid result"},400);
  if (b.competition!=="pie" || !/^(TEST-|ARENA-TEST-)/.test(b.pieCode)) return json({error:"Practice submissions only"},400);
  const values=keys.map(k=>b[k]);
  await env.DB.prepare("INSERT INTO fight_results (request_id,competition,fight_code,red_fighter,white_fighter,winner,loser,tasting_notes) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING").bind(...values).run();
  const row=await env.DB.prepare("SELECT * FROM fight_results WHERE request_id=?").bind(b.requestId).first();
  const columns=["request_id","competition","fight_code","red_fighter","white_fighter","winner","loser","tasting_notes"];
  if(!row) return json({error:"Result not confirmed; retry"},503);
  if(columns.some((k,i)=>row[k]!==values[i])) return json({error:"Request ID conflict"},409);
  return json({success:true,requestId:row.request_id,createdAt:row.created_at});
 } catch(e) { console.error("Result storage failed",e); return json({error:"Result not confirmed; retry"},503); }
}
