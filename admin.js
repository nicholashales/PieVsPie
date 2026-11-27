const cols=["request_id","competition","fight_code","red_fighter","white_fighter","winner","loser","tasting_notes","created_at"];
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function equal(a,b){const enc=new TextEncoder();const x=await crypto.subtle.digest("SHA-256",enc.encode(a));const y=await crypto.subtle.digest("SHA-256",enc.encode(b));return crypto.subtle.timingSafeEqual(x,y)}
function csv(v){let s=String(v??"");if(/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export async function admin(request,env){
 if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<24)return new Response("Administration disabled: configure ADMIN_PASSWORD secret (24+ characters).",{status:503,headers});
 let supplied="";try{const a=request.headers.get("Authorization")||"";if(a.startsWith("Basic "))supplied=atob(a.slice(6))}catch{}
 if(!await equal(supplied,"admin:"+env.ADMIN_PASSWORD))return new Response("Authentication required",{status:401,headers:{...headers,"WWW-Authenticate":'Basic realm="Pie vs Pie admin", charset="UTF-8"'}});
 if(request.method!=="GET")return new Response("Method not allowed",{status:405,headers});
 const u=new URL(request.url),scope=u.searchParams.get("scope")==="practice"?"practice":u.searchParams.get("scope")==="load"?"load":"all";
 const where=scope==="practice"?" WHERE fight_code LIKE 'ARENA-TEST-%'":scope==="load"?" WHERE fight_code LIKE 'TEST-%'":"";
 try{
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM fight_results"+where).first();
 if(u.pathname==="/admin/results.csv"){
  if(count.n>10000)return new Response("Export exceeds 10,000 rows; use D1 SQL export for full backup.",{status:413,headers});
  const q=await env.DB.prepare("SELECT "+cols.join(",")+" FROM fight_results"+where+" ORDER BY created_at,request_id LIMIT 10001").all();
  if(q.results.length>10000)return new Response("Export exceeds limit",{status:413,headers});
  return new Response("\uFEFF"+[cols.join(","),...q.results.map(r=>cols.map(k=>csv(r[k])).join(","))].join("\r\n"),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="pievspie-'+scope+'-results.csv"'}});
 }
 const page=Math.min(10000,Math.max(1,Number.parseInt(u.searchParams.get("page")||"1",10)||1));
 const rows=await env.DB.prepare("SELECT "+cols.join(",")+" FROM fight_results"+where+" ORDER BY created_at DESC,request_id DESC LIMIT 100 OFFSET ?").bind((page-1)*100).all();
 const link=(p)=>"/admin?scope="+scope+"&page="+p;
 return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pie vs Pie admin</title><style>body{background:#1a1a2e;color:#f4e4c1;font:16px Arial;padding:16px}a{color:#f4e4c1;margin-right:12px}h1{color:#f4e4c1;text-shadow:2px 2px #dc143c}.table{overflow:auto}table{border-collapse:collapse;background:#f4e4c1;color:#1a1a2e;width:100%}td,th{padding:10px;border-bottom:1px solid #aaa;text-align:left;overflow-wrap:anywhere}th{background:#a00000;color:white}</style><h1>PIE VS PIE — ADMIN</h1><p>TEST DATABASE · Read only</p><nav><a href="/admin">All results</a><a href="/admin?scope=practice">Arena practice</a><a href="/admin?scope=load">Load tests</a><a href="/admin/results.csv?scope='+scope+'">Download CSV</a></nav><p>'+esc(count.n)+' results · Page '+page+'</p><div class="table"><table><thead><tr>'+cols.map(k=>'<th>'+esc(k)+'</th>').join("")+'</tr></thead><tbody>'+rows.results.map(r=>'<tr>'+cols.map(k=>'<td>'+esc(r[k])+'</td>').join("")+'</tr>').join("")+'</tbody></table></div><p>'+(page>1?'<a href="'+link(page-1)+'">Previous</a>':"")+(page*100<count.n?'<a href="'+link(page+1)+'">Next</a>':"")+'</p></html>',{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
 }catch(e){console.error("Admin query failed",e);return new Response("Database unavailable",{status:503,headers})}
}
