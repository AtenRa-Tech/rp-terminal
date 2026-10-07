// tclosed.js: forming-candle rule across EVERY signal card (generic). Every daily series gets a row for today (the unfinished UTC day);
// rebuilt cards must still read the last CLOSED day (settled 8h funding prints excepted). Plus the OI ÷ market cap pairing ruling (7 Oct):
// latest day = OI at the 00:00 UTC close (oi_hourly) ÷ that same day's market cap; either side missing -> no reading; never cross-date.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length&&SIGD&&DV&&MK}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const OCL=a=>typeof oiCapLatest==='function'?oiCapLatest(a):{v:'n/a: no oiCapLatest'};const DAYm=864e5,day0=Math.floor(Date.now()/DAYm)*DAYm,D=day0-DAYm,o={};
 const today=t=>t!=null&&t>=day0;const dS=x=>new Date(x).toISOString().slice(0,10);
 const check=list=>list.map(s=>{let F={};try{F=sigFacts(s)}catch(e){}return{id:s.id,settled:!!s.settled,open:!!F.open,lastT:s.lastT??s.closed??null,today:today(s.lastT??s.closed),date:F.date}}).filter(x=>!x.settled&&(x.open||x.today));
 // 1) the cards on the page now
 o.live=check(SIG||[]);o.n=(SIG||[]).length;
 // 2) every daily series with an extra row for today: price/coin histories + derivs daily OI + market file
 const keepD=SIGD,keepDV=DVRAW,keepMK=MK;try{
  const add=S=>S&&S.t?{...S,t:[...S.t,day0],v:[...S.v,S.v.at(-1)*1.37]}:S;const d={...SIGD};for(const k of ['P','H','EB','PG','BT','ST'])d[k]=add(SIGD[k]);d.CL={};for(const k in SIGD.CL)d.CL[k]=add(SIGD.CL[k]);
  const raw=JSON.parse(JSON.stringify(DVRAW));for(const a in raw.assets){const A=raw.assets[a];if(A.oi_daily?.points?.length){const l=A.oi_daily.points.at(-1);if(l[0]<day0)A.oi_daily.points.push([day0,l[1]*1.37,l[2]*1.37])}}
  DVRAW=raw;DV=gateDV(raw);const list=[...buildSignals(d),...derivSignals()];list.forEach(s=>{try{prepSig(s)}catch(e){}});o.fixture=check(list);o.fn=list.length;
  const oc=list.find(s=>s.id==='oicapBTC');const L=OCL('BTC');o.oc={has:!!oc,lastT:oc?.lastT,D,v:L.v,oi:L.oi,mc:L.mc,m:oc?.msPre?.a?.at(-1)};
  // 3) mismatched dates: market cap row for D missing -> no reading (no division by another day's market cap)
  MK={...keepMK,totals_proxy:{...keepMK.totals_proxy,points:keepMK.totals_proxy.points.filter(x=>x[0]!==dS(D))}};o.noMC={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC')};MK=keepMK;
  // 4) OI at the 00:00 UTC close missing (only the 16:00 daily bucket) -> no reading
  const raw2=JSON.parse(JSON.stringify(keepDV));raw2.assets.BTC.oi_hourly.points=raw2.assets.BTC.oi_hourly.points.filter(p=>p[0]!==D+DAYm);DVRAW=raw2;DV=gateDV(raw2);o.noOI={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC')};
 }finally{SIGD=keepD;DVRAW=keepDV;DV=gateDV(keepDV);MK=keepMK}
 return o});
ok(r.n>5&&!r.live.length,'every signal card on the page reads the last closed day (no forming reading)',r.live);
ok(r.fn>5&&!r.fixture.length,"every signal card still reads the last closed day when every daily series has a row for today",r.fixture);
ok(r.oc.has&&r.oc.lastT===r.oc.D&&r.oc.v!=null&&Math.abs(r.oc.m-r.oc.v)<1e-9,"OI ÷ market cap: latest day D = OI at D's 00:00 UTC close ÷ D's market cap",r.oc);
ok(r.noMC.v==null&&!r.noMC.card,"OI ÷ market cap: D's market cap missing -> no reading (never another day's market cap)",r.noMC);
ok(r.noOI.v==null&&!r.noOI.card,"OI ÷ market cap: OI at D's 00:00 UTC close missing -> no reading (no 16:00-bucket stand-in)",r.noOI);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
