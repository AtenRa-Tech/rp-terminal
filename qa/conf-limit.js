// Supervisor 15 Oct: ONE limit for stale AND confidence, read from shared/freshness.json (+ data/_runs.json for funding).
// 25 Oct: fixture ages are measured from the page's clock: under the frozen gate the page clock is the constant T0 (FREEZE_T0) while Node's clock advances, so building ages from Node's Date.now() made a 12h10m-old case look <12h after ~10 min of run time.
const PAGE_NOW=()=>process.env.FREEZE_T0?+process.env.FREEZE_T0:Date.now();
// Per scored signal: last point at (limit - 1 min) => fresh, score kept, FULL confidence (100 multi-source / 85 single-source);
// (limit + 1 min) => stale: no score, no confidence, out of POST NOW. Also: no card is ever both stale and scored/full confidence.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.argv[2]||'http://localhost:8765/index.html';
const ROOT=path.join(__dirname,'..'),FR=JSON.parse(fs.readFileSync(path.join(ROOT,'shared/freshness.json'),'utf8')),SC=FR.signal_cards,CF=FR.confidence,DAY=864e5;
const RUNS=JSON.parse(fs.readFileSync(path.join(ROOT,'data/_runs.json'),'utf8'));
const F=[];const ok=(c,m)=>{if(!c)F.push(m)};

const fundLim=Object.entries(RUNS.runs?.at?.(-1)?.feeds||{}).filter(([k])=>/funding/.test(k)).map(([,v])=>v.lim_h);
ok(fundLim.every(x=>x===SC.funding_h),`funding limit: freshness.json ${SC.funding_h}h vs _runs.json ${fundLim}`);
function expLimit(s,now){const cd=Math.floor(now/DAY)*DAY-DAY;if(s.settled)return now-SC.funding_h*36e5;if(s.id==='wrsi')return cd-SC.weekly_lag_days*DAY;return cd-SC.daily_lag_days*DAY}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
 await pg.goto(URL,{waitUntil:'networkidle2',timeout:120000});await pg.waitForFunction(()=>typeof SIG!=='undefined'&&SIG&&SIG.filter(s=>s.score!=null).length>=8,{timeout:120000});
 const R=await pg.evaluate(()=>{const now=Date.now(),out=[]; // in-page: Date.now() IS the page clock (T0 when frozen)
  const one=(s0,T)=>{const s=Object.assign({},s0);delete s.audit;s.closed=T;s.lastT=T;delete s.stale;const ss=SIGSTALE.slice();const keep=staleSweep([s],now);SIGSTALE.length=0;SIGSTALE.push(...ss);
    if(keep.length)oppScore(s);return{stale:!!s.stale,score:keep.length?s.score:s.score,conf:keep.length?s.opp?.conf?.[0]:null,inSIG:keep.length===1}};
  for(const s0 of SIG){if(s0.kind==='mac')continue;const lim=staleLimit(s0,now).t;out.push({id:s0.id,single:!!s0.single,fix:!!s0.confFix,settled:!!s0.settled,lim,now,in:one(s0,lim+6e4),out:one(s0,lim-6e4)})}
  const live={scored:SIG.map(s=>({id:s.id,stale:!!s.stale,score:s.score,conf:s.opp?.conf?.[0],single:!!s.single,fix:!!s.confFix})),stale:SIGSTALE.map(s=>({id:s.id,score:s.score,conf:s.opp?.conf?.[0]??null}))};
  return{out,live,post:(document.body.innerText.match(/(\d+) of (\d+) charts are POST NOW/)||[])[0]||''}});
 await b.close();
 for(const r of R.out){const full=(r.single||r.fix)?CF.fresh_single_source:CF.fresh_multi_source,e=expLimit(r,r.now);
  ok(Math.abs(r.lim-e)<1,`${r.id}: app limit ${new Date(r.lim).toISOString()} != freshness.json ${new Date(e).toISOString()}`);
  ok(!r.in.stale&&r.in.inSIG&&r.in.score!=null&&r.in.conf===full,`${r.id}: limit-1min must be fresh with full confidence ${full}, got ${JSON.stringify(r.in)}`);
  ok(r.out.stale&&!r.out.inSIG&&r.out.score==null&&r.out.conf==null,`${r.id}: limit+1min must be stale with no score/confidence, got ${JSON.stringify(r.out)}`)}
 for(const s of R.live.scored){ok(!s.stale,`${s.id}: in SIG but stale`);ok(s.conf===((s.single||s.fix)?CF.fresh_single_source:CF.fresh_multi_source),`${s.id}: scored with confidence ${s.conf}, not full`)}
 for(const s of R.live.stale)ok(s.score==null,`${s.id}: stale but has score ${s.score}`);
 ok(R.out.length>=8,`only ${R.out.length} signals checked`);
 console.log(R.out.map(r=>`${r.id}: limit-1m ${r.in.stale?'STALE':'fresh'} conf ${r.in.conf} score ${r.in.score}; limit+1m ${r.out.stale?'STALE':'fresh'} score ${r.out.score}`).join('\n'));
 console.log(`live: ${R.live.scored.length} scored (all full confidence), ${R.live.stale.length} stale (no score)`);
 console.log(F.length?'FAIL\n- '+F.join('\n- '):`PASS ${R.out.length} signals: ONE limit (shared/freshness.json) - full confidence at limit-1min, stale/no score at limit+1min`);process.exit(F.length?1:0)})();
