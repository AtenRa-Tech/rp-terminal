// tfresh.js (15 Oct P0): ONE monthly freshness limit (shared/freshness.json, 100 days from month start, age <= limit ok) for app, runs_log.py and smoke at limit-1/limit/limit+1.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const ROOT=path.join(__dirname,'..'),FR=JSON.parse(fs.readFileSync(path.join(ROOT,'shared/freshness.json'),'utf8')),LIM=FR.monthly_days,DAY=864e5;
const ld=a=>{const t=Date.now()-a*DAY;return new Date(t).toISOString().slice(0,10)};// last_date exactly a days (+ a few hours of today) ago
(async()=>{
 // smoke
 const sm=require('./tsmoke.js');ok(sm.MONTHLY_DAYS===LIM&&sm.monthlyOk(LIM-1)&&sm.monthlyOk(LIM)&&!sm.monthlyOk(LIM+1),'smoke: limit from shared/freshness.json; ok at limit-1 and limit, fails at limit+1',{L:sm.MONTHLY_DAYS});
 // runs_log.py
 const P={lim:JSON.parse(execFileSync('python3',['-c',`import sys;sys.path.insert(0,'${ROOT}/scripts');import runs_log as r;print(r.CAD['Monthly'])`]).toString())};
 // midnight k days ago gives age k + today's hours: shift 'now' so age is exactly k for the boundary cases
 const py2=JSON.parse(execFileSync('python3',['-c',`import sys,json,datetime as d;sys.path.insert(0,'${ROOT}/scripts');import runs_log as r
D=86400000;base=int(d.datetime(2026,8,1,tzinfo=d.timezone.utc).timestamp()*1000)
print(json.dumps({str(k):r.macro_fresh({"series":{"M2SL":{"last_date":"2026-08-01","points":[[0,1]],"freq":"Monthly"}}},base+k*D)["M2SL"]["ok"] for k in (${LIM-1},${LIM},${LIM+1})}))`]).toString());
 ok(P.lim===LIM&&py2[LIM-1]===true&&py2[LIM]===true&&py2[LIM+1]===false,'runs_log.py: limit from shared/freshness.json; ok at limit-1 and limit, stale at limit+1',{lim:P.lim,py2});
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return MAC.M&&MAC.cards&&MAC.cards.length}catch(e){return false}},{timeout:150000}).catch(()=>{});await new Promise(r=>setTimeout(r,5000));
 const r=await pg.evaluate((LIM,FRtxt)=>{const o={inl:JSON.stringify(FRESHNESS)===JSON.stringify(JSON.parse(FRtxt)),cad:CAD.Monthly},D=864e5,real=Date.now,base=Date.UTC(2026,7,1);
  o.app={};for(const k of [LIM-1,LIM,LIM+1]){Date.now=()=>base+k*D;try{const M={...MAC.M,series:{...MAC.M.series,M2SL:{...MAC.M.series.M2SL,last_date:'2026-08-01'}}};o.app[k]=!fresh('M2SL',M).st}finally{Date.now=real}}
  return o},LIM,JSON.stringify(FR));
 ok(r.inl&&r.cad===LIM,'app: inline FRESHNESS equals shared/freshness.json and drives CAD.Monthly',r);
 ok(r.app[LIM-1]===true&&r.app[LIM]===true&&r.app[LIM+1]===false,'app: M2SL fresh at limit-1 and limit, stale at limit+1',r.app);
 ok(!errs.length,'no page errors',errs.slice(0,3));await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
