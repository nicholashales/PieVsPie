import {onRequestPost} from "./functions/api/results.js";
import {onRequestGet} from "./functions/api/health.js";
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==="/api/health" && request.method==="GET") return onRequestGet({request,env});
 if(path==="/api/results" && request.method==="POST") return onRequestPost({request,env});
 if(path.startsWith("/api/")) return new Response("Not found",{status:404});
 return new Response("Pie vs Pie 2026 — test backend. Voting interface not yet connected.",{headers:{"Content-Type":"text/plain; charset=utf-8"}});
}};
