const json=(b,status=200)=>Response.json(b,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCode=c=>typeof c==="string"&&/^DEMO-[A-Za-z0-9-]{1,64}$/.test(c);
const roster=new Set(["Alan Star","Billie Pieper","Brandy Toksvig","C3-Pie0","Camilla Mixing-Bowls","Crustia Winkleman","Crustin Hoffman","Crusty Springfield","Dave Grohlling Pin","Dr Choux","Greggs Davies","Icing Charles","Jasmin Pieris","Kevin Pietersen","Linford Crusty","Luke Piewalker","Miley Pyrus","Mince Pyson","Mr Feast","Oscar Pastry","Piela Radcliffe","Pieman Cowell","Pieter Schmeichel","Princess Pieanna","R2-D-Licious","Shortcrustney Dauwalter","Stephen Pie","The Sultana of Brunei"]);
export async function battle(request,env){
 try{
 const url=new URL(request.url);
 if(request.method==="GET"){
 const code=url.searchParams.get("code");if(!validCode(code))return json({error:"Use a DEMO- practice code"},400);
 const pair=await env.DB.prepare("SELECT * FROM battle_pairs WHERE code=?").bind(code).first();
 if(!pair)return json({error:"Battle not found"},404);
 const q=await env.DB.prepare("SELECT judge_id,revision,winner,notes,action FROM current_judges WHERE code=? ORDER BY seq").bind(code).all();
 const votes=q.results.filter(v=>v.action!=="remove");const redVotes=votes.filter(v=>v.winner===pair.red).length;
 return json({pair,votes,redVotes,whiteVotes:votes.length-redVotes,redScore:votes.length?redVotes/votes.length:0,whiteScore:votes.length?(votes.length-redVotes)/votes.length:0});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(request.headers.get("Origin")!==url.origin||!request.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"Same-origin JSON required"},403);
 const raw=await request.text();if(raw.length>12000)return json({error:"Too large"},413);
 let p;try{p=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 if(!p||!validCode(p.code)||!uuid.test(p.operationId||"")||!uuid.test(p.judgeId||"")||!["add","edit","remove"].includes(p.action)||!Number.isSafeInteger(p.revision)||p.revision<1||typeof p.notes!=="string"||p.notes.length>4000||!roster.has(p.red)||!roster.has(p.white)||p.red===p.white||![p.red,p.white].includes(p.winner)||(p.action==="add"&&p.revision!==1)||(p.action!=="add"&&p.revision<2))return json({error:"Invalid operation"},400);
 const same=e=>e.code===p.code&&e.judge_id===p.judgeId&&e.revision===p.revision&&e.action===p.action&&e.winner===p.winner&&e.notes===p.notes;
 const previous=await env.DB.prepare("SELECT e.*,b.red,b.white FROM judge_events e JOIN battle_pairs b ON b.code=e.code WHERE operation_id=?").bind(p.operationId).first();
 if(previous)return same(previous)&&previous.red===p.red&&previous.white===p.white?json({success:true,operationId:p.operationId}):json({error:"Operation ID conflict"},409);
 // Atomic conditional append; competing edits at the same revision cannot both succeed.
 const statements=[];
 if(p.action==="add")statements.push(env.DB.prepare("INSERT INTO battle_pairs(code,red,white) VALUES(?,?,?) ON CONFLICT(code) DO NOTHING").bind(p.code,p.red,p.white));
 statements.push(env.DB.prepare("INSERT INTO judge_events(operation_id,code,judge_id,revision,action,winner,notes) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM battle_pairs WHERE code=? AND red=? AND white=?) AND ((?='add' AND NOT EXISTS(SELECT 1 FROM judge_events WHERE code=? AND judge_id=?)) OR (?<>'add' AND EXISTS(SELECT 1 FROM current_judges WHERE code=? AND judge_id=? AND revision=? AND action<>'remove'))) ON CONFLICT DO NOTHING").bind(p.operationId,p.code,p.judgeId,p.revision,p.action,p.winner,p.notes,p.code,p.red,p.white,p.action,p.code,p.judgeId,p.action,p.code,p.judgeId,p.revision-1));
 await env.DB.batch(statements);
 const saved=await env.DB.prepare("SELECT * FROM judge_events WHERE operation_id=?").bind(p.operationId).first();
 if(!saved||!same(saved))return json({error:"Battle pairing or revision conflict; reload results"},409);
 return json({success:true,operationId:p.operationId});
 }catch(e){console.error("Battle API unavailable",e);return json({error:"Battle database unavailable; migration may be required"},503)}
}
