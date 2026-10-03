// Stale-derivatives caption + export test (Crypto News GOD). Usage: node qa/stale-captions.js [URL]. Exit 1 = block.
// Blocks live derivatives feeds, serves fixtures/derivs-stale.json (>=4 days old), then generates every caption template,
// Optional: DERIVS_FIXTURE=/path/to/fixture.json to run the boundary or mixed-case fixtures through the caption check.
// the picked caption, the Studio X draft text and all export images (fillText log). PASS only if no funding/OI reading appears.
const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const FIX=process.env.DERIVS_FIXTURE||path.join(__dirname,'fixtures/derivs-stale.json');const STALE=fs.readFileSync(FIX,'utf8');
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i;
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.route('**/*',r=>{const u=r.request().url();if(BLOCK.test(u))return r.abort();if(/derivs\.json/.test(u))return r.fulfill({status:200,contentType:'application/json',body:STALE});r.continue()});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(8000);
for(const t of ['signals','macro','markets','chart','studio','today']){await p.evaluate(t=>{try{tab(t)}catch(e){}},t);await p.waitForTimeout(4000)}
const out=await p.evaluate(()=>{const rows=[];const ctxs=[];
 (SIG||[]).forEach(s=>ctxs.push([{kind:'sig',id:s.id},s]));(MAC.cards||[]).forEach(s=>ctxs.push([{kind:'mac',id:s.id}]));
 ['btc','eth'].forEach(a=>ctxs.push([{kind:'etf',a}]));ctxs.push([{kind:'alt'}]);ctxs.push([{kind:'dd',a:'BTC'}]);ctxs.push([{kind:'perf',a:'BTC'}]);ctxs.push([{kind:'studio',t:'pulse'}]);
 for(const [c,o] of ctxs){const id=c.kind+':'+(c.id||c.a||c.t||'');let F;try{F=capFacts(c,o)}catch(e){continue}if(!F)continue;
  for(const [st] of STY){(CAPT[F.fam][st]||[]).forEach((fn,i)=>{try{rows.push(['caption '+id+' '+st+'#'+i,String(tidy(fn(F))||'')])}catch(e){}});
   try{let pk=capPick(F,st,-1,()=>.5);rows.push(['picked '+id+' '+st,typeof pk==='string'?pk:JSON.stringify(pk)])}catch(e){}}}
 document.querySelectorAll('textarea').forEach((t,i)=>rows.push(['textarea#'+(t.id||i),t.value||'']));
 const P=CanvasRenderingContext2D.prototype,of=P.fillText;let log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
 const jobs=[];(S.watch||[]).slice(0,4).forEach(c=>jobs.push(['insight-'+c.sym,(x,W,H)=>drawCard(x,W,H,'insight',c)]));
 jobs.push(['pulse',(x,W,H)=>drawCard(x,W,H,'pulse')]);try{jobs.push(['chart',(x,W,H)=>drawChart(x,W,H,{...CH,cross:null})])}catch(e){}
 for(const [nm,fn] of jobs){log=[];try{render8k(fn,1920,1080)}catch(e){}rows.push(['export '+nm,log.join(' | ')])}
 const sel=document.querySelector('#stType'),rat=document.querySelector('#stRatio');
 for(const ty of ['price','insight','pulse','chart','dd','perf']){sel.value=ty;rat.value='16:9';log=[];try{render8k(drawStudio,1920,1080)}catch(e){}rows.push(['studio '+ty,log.join(' | ')])}
 P.fillText=of;return rows});
await b.close();
const BAD=[/funding[^|\n]{0,40}(neutral|positive|negative|elevated|flat)/i,/neutral band/i,/funding[^|\n]{0,25}[-+]?\d+\.\d+ ?%/i,/0\.0063/,/\bopen interest[^|\n]{0,30}[-+]?\d/i,/\bOI [-+−]?\d+(\.\d+)?%/];
const fails=[];for(const [w,t] of out)for(const re of BAD){const m=t.match(re);if(m)fails.push(w+': "'+m[0]+'"')}
const u=[...new Set(fails)];console.log(`stale-captions: ${out.length} texts checked, ${u.length} readings from stale derivatives file`);u.forEach(f=>console.log('FAIL '+f));process.exit(u.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
