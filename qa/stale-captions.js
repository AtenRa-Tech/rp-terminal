// Stale-derivatives caption + export test v2 (Crypto News GOD). Usage: node qa/stale-captions.js [URL]. Exit 1 = block.
// 25 Oct: fixture ages are measured from the page's clock: under the frozen gate the page clock is the constant T0 (FREEZE_T0) while Node's clock advances, so building ages from Node's Date.now() made a 12h10m-old case look <12h after ~10 min of run time.
const PAGE_NOW=()=>process.env.FREEZE_T0?+process.env.FREEZE_T0:Date.now();
// Ruling 3 Oct: each metric's own limit decides (funding 12h; open interest and basis 3h).
// Builds fixtures at run time from fixtures/derivs-stale.json (timestamps shifted relative to now), blocks live derivatives feeds,
// then generates every caption template (3 styles), the picked caption, Studio draft text and export images (fillText log). Cases:
//  C1 stale4d:   whole file 4 days old  -> no funding and no OI readings in any caption/draft/export
//  C2 late:      file 3h10m old, funding 7h old -> funding captions MUST appear, OI captions must not
//  C3 fund_past: file 30m old, funding 12h10m old -> no funding readings; OI captions must appear; oicap not stale (hourly OI aligned to latest)
//  C6 oi_1d:     hourly OI ends 23:00 UTC yesterday (one close back) -> oicap FRESH in SIG, label names that close
//  C5 oi_old:    file 30m old, latest OI fresh, hourly OI ends 2d16h ago -> SIGSTALE card id oicapBTC/oicapETH stale:true, score null, usedDate<wantDate, out of SIG, no oicap value anywhere
//  C4 status:    ruling 3 Oct: ages are XhYm under 48h, whole days above; age past limit never rounded into it;
//                format "Funding: stale, 12h10m old, past 12h limit (OKX)". Also fails any text that says "Xh old (limit Yh)" with X <= Y (contradictory status)
const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const BASE=JSON.parse(fs.readFileSync(process.env.DERIVS_FIXTURE||path.join(__dirname,'../fixtures/derivs-stale.json'),'utf8'));
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i,H=36e5;
function lastT(o){let m=0;(function w(x){if(Array.isArray(x)){if(typeof x[0]==='number'&&x[0]>1.7e12)m=Math.max(m,x[0]);x.forEach(w)}else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if((k==='last'||/_t$/.test(k))&&typeof v==='number')m=Math.max(m,v);w(v)}})(o);return m}
function shift(o,d){if(Array.isArray(o)){if(typeof o[0]==='number'&&o[0]>1.7e12)o[0]+=d;o.forEach(x=>shift(x,d))}else if(o&&typeof o==='object')for(const k of Object.keys(o)){if((k==='last'||/_t$/.test(k))&&typeof o[k]==='number'&&o[k]>1.7e12)o[k]+=d;else shift(o[k],d)}return o}
function aged(ms){const f=align(JSON.parse(JSON.stringify(BASE))),now=PAGE_NOW();shift(f,now-ms-lastT(f));f.updated=new Date(now-ms).toISOString();return f}
// align (8 Oct ruling a): each asset's hourly series end where its latest block says, so the fixture is internally consistent.
function align(f){for(const a of Object.values(f.assets||{})){const L=a.latest||{},end=L.oi_t||lastT(L);if(!end)continue;for(const k of ['oi_hourly','basis_hourly']){if(a[k]&&lastT(a[k]))shift(a[k],Math.floor(end/36e5)*36e5-lastT(a[k]))}}return f}
// oiOld: hourly OI ends ms ago while latest.oi_t stays fresh -> no 00:00 UTC point for the last closed day -> oicap stale.
// 15 Oct one-entry rule: latest = the last SETTLED print (same time and rate), age measured on that print
function oiOld(f,ms){const now=PAGE_NOW();for(const a of Object.values(f.assets||{}))if(a.oi_hourly)shift(a.oi_hourly,now-ms-lastT(a.oi_hourly));return f}
function fundAge(f,age){const now=PAGE_NOW();for(const a of Object.values(f.assets)){const P=a.funding?.points;if(P?.length){shift(a.funding,now-age-P.at(-1)[0]);a.latest={...(a.latest||{}),funding_t:P.at(-1)[0],funding:P.at(-1)[1]}}}return f}
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
 const st=await p.evaluate(()=>({sigtx:Object.fromEntries((SIG||[]).filter(c=>/^oicap/.test(c.id)).map(c=>[c.id,[c.title,c.read,c.src,c.cap,(typeof SIGT!=='undefined'&&SIGT[c.id]||[]).join(' ')].join(' | ')])),sig:(SIG||[]).map(c=>c.id),stale:typeof SIGSTALE==='undefined'?null:Object.fromEntries((Array.isArray(SIGSTALE)?SIGSTALE.map(c=>[c.id,c]):Object.entries(SIGSTALE)).map(([k,c])=>[k,{stale:c.stale,usedDate:c.usedDate,wantDate:c.wantDate,staleWhy:c.staleWhy,score:c.score}]))}));
 rows.state=st;await p.close();return rows}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const R={stale4d:await run(b,aged(4*24*H)),late:await run(b,fundAge(aged(3*H+10*60e3),7*H)),fund_past:await run(b,fundAge(aged(30*60e3),12*H+10*60e3)),oi_old:await run(b,oiOld(fundAge(aged(30*60e3),7*H),(2*24+16)*H)),oi_1d:await run(b,oiOld(fundAge(aged(30*60e3),7*H),Date.now()-(Math.floor(Date.now()/(24*H))*24*H-H)))};await b.close();
 const cap=rows=>rows.filter(r=>r[0]!=='page text');const fails=[];
 hits(cap(R.stale4d),FUND.concat(OI)).forEach(h=>fails.push('C1 stale4d reading '+h));
 if(!hits(cap(R.late),FUND).length)fails.push('C2 late file: funding 7h old (inside 12h) produced no funding captions');
 hits(cap(R.late),OI).forEach(h=>fails.push('C2 late file: OI 3h10m old (past 3h) still in '+h));
 hits(cap(R.fund_past),FUND).forEach(h=>fails.push('C3 funding 12h10m old (past 12h) still in '+h));
 if(!hits(cap(R.fund_past),OI).length)fails.push('C3 fresh OI (30m) produced no OI captions');
 const OIC=[/open interest[^|\n]{0,40}÷ ?(market cap|circulating supply)[^|\n]{0,40}\d/i,/\d\.\d+% of (market cap|circulating supply)/i];
 const stOf=(r,k)=>r.state&&r.state.stale&&(r.state.stale[k]||r.state.stale['oicap'+k.split(' ')[0]]);
 for(const a of ['BTC','ETH']){if(stOf(R.fund_past,a+' oicap'))fails.push('C3 '+a+' oicap marked stale although hourly OI runs to 30m ago: '+JSON.stringify(stOf(R.fund_past,a+' oicap')));
  if(!R.fund_past.state.sig.includes('oicap'+a))fails.push('C3 oicap'+a+' missing from signal cards with fresh hourly OI');
  const s5=stOf(R.oi_old,a+' oicap');if(!s5)fails.push('C5 hourly OI 2d16h old: no oicap'+a+' card in SIGSTALE');
  else{if(s5.stale!==true)fails.push('C5 '+a+' oicap: stale is not true');if(s5.score!==null)fails.push('C5 '+a+' oicap: score '+s5.score+', want null');
   if(!(s5.usedDate&&s5.wantDate&&String(s5.usedDate)<String(s5.wantDate)))fails.push('C5 '+a+' oicap: usedDate '+s5.usedDate+' not before wantDate '+s5.wantDate);if(!s5.staleWhy)fails.push('C5 '+a+' oicap: empty staleWhy')}
  if(R.oi_old.state.sig.includes('oicap'+a))fails.push('C5 oicap'+a+' still in SIG (readings, scores, POST NOW) while stale')}
 // C6 (15 Oct ruling): hourly OI ends 23:00 UTC yesterday -> newest 00:00 point is one close back -> FRESH, in SIG, label names that close.
 {const D0=Math.floor(Date.now()/(24*H))*24*H,MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],dm=t=>{const d=new Date(t);return d.getUTCDate()+' '+MO[d.getUTCMonth()]};
  const want='('+dm(D0-2*24*H),bad='('+dm(D0-24*H)+' close';
  for(const a of ['BTC','ETH']){const id='oicap'+a,st=R.oi_1d.state;
   if(!st.sig.includes(id))fails.push('C6 '+id+' one close back: missing from SIG (should be fresh)');
   else{const tx=st.sigtx[id]||'';if(!tx.includes(want))fails.push('C6 '+id+': label does not name '+want+' close)');if(tx.includes(bad))fails.push('C6 '+id+': label claims '+bad+')')}
   if(st.stale&&st.stale[id]&&st.stale[id].stale)fails.push('C6 '+id+' one close back marked stale')}}
 hits(cap(R.oi_old),OIC).forEach(h=>fails.push('C5 stale oicap value still in '+h));
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)for(const x of (t.match(/(\d+(?:\.\d+)?)h old \(limit (\d+)h\)/g)||[])){const [,a,l]=x.match(/([\d.]+)h old \(limit (\d+)h\)/);if(+a<=+l)fails.push(`C4 ${k} ${w}: contradictory status "${x}"`)}
 const ageH=a=>{let m;if(m=a.match(/^(\d+)d$/))return +m[1]*24;m=a.match(/^(\d+)h(?:(\d+)m)?$/);return m?+m[1]+(+(m[2]||0))/60:NaN};
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)for(const x of (t.match(/\b(\d+d|\d+h(?:\d+m)?) old, past (\d+)h limit/g)||[])){const [,a,l]=x.match(/(\d+d|\d+h(?:\d+m)?) old, past (\d+)h limit/);const h=ageH(a);
  if(!(h>+l))fails.push(`C4 ${k} ${w}: age not past limit "${x}"`);if(/d$/.test(a)&&h<48)fails.push(`C4 ${k} ${w}: days used under 48h "${x}"`);if(/h/.test(a)&&h>=48)fails.push(`C4 ${k} ${w}: use whole days at 48h+ "${x}"`)}
 for(const [k,rows] of Object.entries(R))for(const [w,t] of rows)if(/stale/i.test(t)&&/Funding/.test(t)){const m=t.match(/Funding: stale[^|\n]{0,60}/);if(m&&!/^Funding: stale, (\d+d|\d+h(\d+m)?) old, past 12h limit \([A-Za-z]+\)/.test(m[0]))fails.push(`C4 ${k} ${w}: status format "${m[0]}" (want "Funding: stale, 12h10m old, past 12h limit (OKX)")`)}
 const u=[...new Set(fails)];console.log(`stale-captions v3: ${Object.values(R).reduce((n,r)=>n+r.length,0)} texts over ${Object.keys(R).length} cases, ${u.length} failures`);u.forEach(f=>console.log('FAIL '+f));process.exit(u.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
