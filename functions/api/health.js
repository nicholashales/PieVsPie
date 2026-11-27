export async function onRequestGet({env}) {
 try {await env.DB.prepare("SELECT request_id FROM fight_results LIMIT 1").first();return new Response("OK",{headers:{"Cache-Control":"no-store"}})}
 catch {return new Response("Unavailable",{status:503,headers:{"Cache-Control":"no-store"}})}
}
