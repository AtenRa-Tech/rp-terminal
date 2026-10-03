// Stale-derivatives caption + export test v2 (Crypto News GOD). Usage: node qa/stale-captions.js [URL]. Exit 1 = block.
// repo copy (team v2, 3 Oct): require via NODE_PATH, fixture in qa/fixtures, output to tmpdir
// Ruling 3 Oct: each metric's own limit decides (funding 12h; open interest and basis 3h).
// Builds fixtures at run time from fixtures/derivs-stale.json (timestamps shifted relative to now), blocks live derivatives feeds,
// then generates every caption template (3 styles), the picked caption, Studio draft text and export images (fillText log). Cases:
//  C1 stale4d:   whole file 4 days old  -> no funding and no OI readings in any caption/draft/export
//  C2 late:      file 3h10m old, funding 7h old -> funding captions MUST appear, OI captions must not
//  C3 fund_past: file 30m old, funding 12h10m old -> no funding readings; OI captions must appear
//  C4 status:    ruling 3 Oct: ages are XhYm under 48h, whole days above; age past limit never rounded into it;
//                format "Funding: stale, 12h10m old, past 12h limit (OKX)". Also fails any text that says "Xh old (limit Yh)" with X <= Y (contradictory status)
const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/derivs-stale.json'),'utf8'));
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i,H=36e5;
function lastT(o){let m=0;(function w(x){if(Array.isArray(x)){if(typeof x[0]==='number'&&x[0]>1.7e12)m=Math.max(m,x[0]);x.forEach(w)}else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if((k==='last'||/_t$/.test(k))&&typeof v==='number')m=Math.max(m,v);w(v)}})(o);return m}
function shift(o,d){if(Array.isArray(o)){if(typeof o[0]==='number'&&o[0]>1.7e12)o[0]+=d;o.forEach(x=>shift(x,d))}else if(o&&typeof o==='object')for(const k of Object.keys(o)){if((k==='last'||/_t$/.test(k))&&typeof o[k]==='number'&&o[k]>1.7e12)o[k]+=d;else shift(o[k],d)}return o}
function aged(ms){const f=JSON.parse(JSON.stringify(BASE)),now=Date.now();shift(f,now-ms-lastT(BASE));f.updated=new Date(now-ms).toISOString();return f}
function fundAge(f,age){const now=Date.now();for(const a of Object.values(f.assets)){if(a.funding)shift(a.funding,now-age-lastT(a.funding));if(a.latest?.funding_t)a.latest.funding_t=now-age}return f}
const FUND=[/funding[^|\n]{0,40}(neutral|positive|negative|elevated|flat)/i,/neutral band/i,/funding[^|\n]{0,25}[-+]?\d+\.\d+ ?%/i];
const OI=[/\bopen interest[^|\n]{0,30}[-+]?\d/i,/\bOI [-+−]?\d+(\.\d+)?%/];
const hits=(rows,res)=>{const o=[];for(const [w,t] of rows)for(const re of res){const m=t.match(re);if(m)o.push(w+': "'+m[0]+'"')}return [...new Set(o)]};
async function run(b,body){const p=await b.newPage({viewport:{width:412,height:915}});
 await p.route('**/*',r=>{const u=r.request().url();if(BLOCK.test(u))return r.abort();if(/derivs\.json/.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});r.continue()});
 await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(8000);
 for(const t of ['signals','macro','markets','chart','studio','today']){await p.evaluate(t=>{try{tab(t)}catch(e){}},t);await p.waitForTimeout(4000)}
 const rows=await p.evaluate(()=>{const rows=[];const ctxs=[];
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
  P.fillText=of;rows.push(['page text',document.body.innerText]);return rows});
 await p.close();return rows}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const R={stale4d:await run(b,aged(4*24*H)),late:await run(b,fundAge(aged(3*H+10*60e3),7*H)),fund_past:await run(b,fundAge(aged(30*60e3),12*H+10*60e3))};await b.close();
 const cap=rows=>rows.filter(r=>r[0]!=='page text');const fails=[];
 hits(cap(R.stale4d),FUND.concat(OI)).forEach(h=>fails.push('C1 stale4d reading '+h));
 if(!hits(cap(R.late),FUND).length)fails.push('C2 late file: funding 7h old (inside 12h) produced no funding captions');
 hits(cap(R.late),OI).forEach(h=>fails.push('C2 late file: OI 3h10m old (past 3h) still in '+h));
 hits(cap(R.fund_past),FUND).forEach(h=>fails.push('C3 funding 12h10m old (past 12h) still in '+h));
 if(!hits(cap(R.fund_past),OI).length)fails.push('C3 fresh OI (30m) produced no OI captions');
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)for(const x of (t.match(/(\d+(?:\.\d+)?)h old \(limit (\d+)h\)/g)||[])){const [,a,l]=x.match(/([\d.]+)h old \(limit (\d+)h\)/);if(+a<=+l)fails.push(`C4 ${k} ${w}: contradictory status "${x}"`)}
 const ageH=a=>{let m;if(m=a.match(/^(\d+)d$/))return +m[1]*24;m=a.match(/^(\d+)h(?:(\d+)m)?$/);return m?+m[1]+(+(m[2]||0))/60:NaN};
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)for(const x of (t.match(/\b(\d+d|\d+h(?:\d+m)?) old, past (\d+)h limit/g)||[])){const [,a,l]=x.match(/(\d+d|\d+h(?:\d+m)?) old, past (\d+)h limit/);const h=ageH(a);
  if(!(h>+l))fails.push(`C4 ${k} ${w}: age not past limit "${x}"`);if(/d$/.test(a)&&h<48)fails.push(`C4 ${k} ${w}: days used under 48h "${x}"`);if(/h/.test(a)&&h>=48)fails.push(`C4 ${k} ${w}: use whole days at 48h+ "${x}"`)}
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)if(/stale/i.test(t)&&/Funding/.test(t)){const m=t.match(/Funding: stale[^|\n]{0,60}/);if(m&&!/^Funding: stale, (\d+d|\d+h(\d+m)?) old, past 12h limit \([A-Za-z]+\)/.test(m[0]))fails.push(`C4 ${k} ${w}: status format "${m[0]}" (want "Funding: stale, 12h10m old, past 12h limit (OKX)")`)}
 const u=[...new Set(fails)];console.log(`stale-captions v2: ${Object.values(R).reduce((n,r)=>n+r.length,0)} texts over 3 cases, ${u.length} failures`);u.forEach(f=>console.log('FAIL '+f));process.exit(u.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
