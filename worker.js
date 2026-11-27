import {admin} from "./admin.js";
import {testPage} from "./test-page.js";
import {onRequestPost} from "./functions/api/results.js";
import {onRequestGet} from "./functions/api/health.js";
export default {async fetch(request,env){
 const url=new URL(request.url);
 const path=url.pathname;
 if(path==="/admin"||path==="/admin/results.csv"){
  if(url.hostname!=="pievspie.nhales.workers.dev")return new Response("Not found",{status:404});
  return admin(request,env);
 }
 if(path==="/api/health" && request.method==="GET") return onRequestGet({request,env});
 if(path==="/api/results" && request.method==="POST") return onRequestPost({request,env});
 if(new URL(request.url).hostname==="pievspie.nhales.workers.dev" && request.method==="GET"){
  if(path==="/test") return new Response(testPage,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
  if(path==="/api/test-count"){
   const code=new URL(request.url).searchParams.get("code")||"";
   if(!/^TEST-[0-9a-f-]{36}$/i.test(code)) return new Response("Invalid code",{status:400});
   try{const row=await env.DB.prepare("SELECT COUNT(*) AS count FROM fight_results WHERE competition='pie' AND fight_code=? AND red_fighter='TEST Red' AND white_fighter='TEST White'").bind(code).first();return Response.json({count:row.count},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"Database unavailable"},{status:503})}
  }
 }
 if(new URL(request.url).hostname==="pievspie.nhales.workers.dev" && request.method==="GET" && (path==="/arena"||path==="/arena/"||path.startsWith("/images/"))){
  if(path==="/arena")return Response.redirect(new URL("/arena/"+new URL(request.url).search,request.url),302);
  return env.ASSETS.fetch(request);
 }
 if(path.startsWith("/api/")) return new Response("Not found",{status:404});
 return new Response("Pie vs Pie 2026 — test backend. Voting interface not yet connected.",{headers:{"Content-Type":"text/plain; charset=utf-8"}});
}};
