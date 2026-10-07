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
  const oc=list.find(s=>s.id==='oicapBTC');const L=OCL('BTC');o.oc={has:!!oc,lastT:oc?.lastT,D:L.D,v:L.v,oi:L.oi,mc:L.mc,m:oc?.msPre?.a?.at(-1)};
  // 3) mismatched dates: D's market cap missing -> the reading moves to D-1 with BOTH sides from D-1 (OI at D 00:00 UTC = D-1's close), never D's OI ÷ D-1's cap
  MK={...keepMK,totals_proxy:{...keepMK.totals_proxy,points:keepMK.totals_proxy.points.filter(x=>x[0]!==dS(D))}};{const L=OCL('BTC'),ci=keepMK.totals_proxy.columns.indexOf('btc'),row=keepMK.totals_proxy.points.find(x=>x[0]===dS(D-DAYm));o.noMC={D:L.D,want:D-DAYm,oiT:L.oiT,mc:L.mc,mcWant:row?row[ci]:null}}
  MK={...keepMK,totals_proxy:{...keepMK.totals_proxy,points:[]}};o.noMCall={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC')};MK=keepMK;
  // 4) OI at D's 00:00 UTC close missing -> D-1 (its own close OI); no hourly OI at all -> no reading (the 16:00 daily bucket is never a stand-in)
  const raw2=JSON.parse(JSON.stringify(keepDV));raw2.assets.BTC.oi_hourly.points=raw2.assets.BTC.oi_hourly.points.filter(p=>Math.abs(p[0]-(D+DAYm))>30*60000);DVRAW=raw2;DV=gateDV(raw2);{const L=OCL('BTC');o.noOI={D:L.D,want:D-DAYm,oiT:L.oiT}}
  raw2.assets.BTC.oi_hourly.points=[];DV=gateDV(raw2);o.noOIall={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC')};
 }finally{SIGD=keepD;DVRAW=keepDV;DV=gateDV(keepDV);MK=keepMK}
 return o});
ok(r.n>5&&!r.live.length,'every signal card on the page reads the last closed day (no forming reading)',r.live);
ok(r.fn>5&&!r.fixture.length,"every signal card still reads the last closed day when every daily series has a row for today",r.fixture);
ok(r.oc.has&&r.oc.lastT===r.oc.D&&r.oc.v!=null&&Math.abs(r.oc.m-r.oc.v)<1e-9,"OI ÷ market cap: latest day D = OI at D's 00:00 UTC close ÷ D's market cap",r.oc);
ok(r.noMC.D===r.noMC.want&&Math.abs(r.noMC.oiT-(r.noMC.want+864e5))<=18e5&&r.noMC.mc===r.noMC.mcWant,"OI ÷ market cap: D's market cap missing -> D-1 with D-1's OI and D-1's market cap (never cross-date)",r.noMC);
ok(r.noMCall.v==null&&!r.noMCall.card,"OI ÷ market cap: no same-day market cap at all -> no reading",r.noMCall);
ok(r.noOI.D===r.noOI.want&&Math.abs(r.noOI.oiT-(r.noOI.want+864e5))<=18e5,"OI ÷ market cap: OI at D's close missing -> D-1 with its own 00:00 UTC OI",r.noOI);
ok(r.noOIall.v==null&&!r.noOIall.card,"OI ÷ market cap: no hourly OI -> no reading (no 16:00-bucket stand-in)",r.noOIall);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
