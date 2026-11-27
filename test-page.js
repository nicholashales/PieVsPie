export const testPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pie vs Pie — reliability test</title><style>body{background:#1a1a2e;color:#f4e4c1;font:16px Arial;padding:24px;max-width:700px;margin:auto}button{padding:14px;background:#f4e4c1;color:#1a1a2e;border:0;border-radius:8px;font-weight:bold}pre{white-space:pre-wrap;line-height:1.6}h1{color:#f4e4c1;text-shadow:2px 2px #dc143c}</style><h1>PIE VS PIE — TEST LAB</h1><p>Test database only. Synthetic results are marked TEST- and retained for verification. No real votes.</p><button id="run">Run reliability checks</button> <button id="copy" disabled>Copy report</button><pre id="out" aria-live="polite"></pre><script>
const out=document.querySelector('#out'), run=document.querySelector('#run'), copy=document.querySelector('#copy');
const line=s=>out.textContent+=s+'\\n';
let pass=0,fail=0;
async function check(name,fn){try{await fn();pass++;line('PASS — '+name)}catch(e){fail++;line('FAIL — '+name+': '+e.message)}}
function assert(v,m){if(!v)throw Error(m)}
async function post(payload){const r=await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()}}
function confirmed(r,p){assert(r.status===200&&r.body.success===true&&r.body.requestId===p.requestId&&r.body.createdAt,'Not confirmed: '+JSON.stringify(r))}
run.onclick=async()=>{run.disabled=true;copy.disabled=true;out.textContent='';pass=fail=0;
const code='TEST-'+crypto.randomUUID();line('Run: '+code);
const make=()=>({requestId:crypto.randomUUID(),competition:'pie',pieCode:code,redFighter:'TEST Red',whiteFighter:'TEST White',winner:'TEST Red',loser:'TEST White',tastingNotes:'Synthetic reliability test'});
const p=make();let first;
await check('Database health',async()=>{const r=await fetch('/api/health',{cache:'no-store'});assert(r.ok&&(await r.text())==='OK','Health check failed')});
await check('New vote committed',async()=>{first=await post(p);confirmed(first,p)});
await check('Identical retry returns original receipt',async()=>{const r=await post(p);confirmed(r,p);assert(first&&r.body.createdAt===first.body.createdAt,'Receipt changed')});
await check('Conflicting retry rejected',async()=>{const r=await post({...p,tastingNotes:'Changed'});assert(r.status===409,'Expected 409, got '+r.status)});
await check('Invalid winner rejected',async()=>{const r=await post({...make(),winner:'Unknown'});assert(r.status===400,'Expected 400, got '+r.status)});
await check('10 concurrent duplicate requests',async()=>{const q=make();const rs=await Promise.all(Array.from({length:10},()=>post(q)));rs.forEach(r=>confirmed(r,q));assert(new Set(rs.map(r=>r.body.createdAt)).size===1,'Receipts differ')});
await check('50 distinct concurrent votes',async()=>{const qs=Array.from({length:50},make);const rs=await Promise.all(qs.map(post));rs.forEach((r,i)=>confirmed(r,qs[i]))});
await check('Exactly 52 persisted rows',async()=>{const r=await fetch('/api/test-count?code='+encodeURIComponent(code),{cache:'no-store'});const b=await r.json();assert(r.ok&&b.count===52,'Expected 52, got '+JSON.stringify(b))});
line('RESULT: '+pass+' passed, '+fail+' failed');run.disabled=false;copy.disabled=false;};
copy.onclick=async()=>{try{await navigator.clipboard.writeText(out.textContent)}catch{line('Select and copy the report manually.')}};
</script></html>`;
