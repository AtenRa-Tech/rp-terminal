// tsrc15.js (15 Oct rulings): C2 funding freshness without _runs.json, and CoinPaprika-only totals/dominance.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
const errs=[],req=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('request',r=>req.push(r.url()));
await pg.setRequestInterception(true);pg.on('request',r=>/_runs\.json/.test(r.url())?r.respond({status:404,body:'nf'}):r.continue());
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length&&DV&&DVRAW&&MK}catch(e){return false}},{timeout:150000}).catch(()=>{});await new Promise(r=>setTimeout(r,4000));
const r=await pg.evaluate(()=>{const o={},H=36e5,now=Date.now(),keep=DVRAW;
 o.runs=DF['_runs']?.v?.last_run??null;
 const mk=(fAge)=>{const x=JSON.parse(JSON.stringify(keep));for(const A of Object.values(x.assets)){const P=A.funding?.points;if(P?.length){const d=now-fAge-P.at(-1)[0];P.forEach(q=>q[0]+=d);A.latest={...(A.latest||{}),funding_t:P.at(-1)[0],funding:P.at(-1)[1]}}}return x};
 try{
  // C2: latest settled print 7h ago -> inside 12h, card stays a reading; _runs.json missing -> dataStale falls back to derivs funding time (no false stale)
  DVRAW=mk(7*H);DV=gateDV(DVRAW);let L=staleSweep(derivSignals());o.c2={inSig:L.map(s=>s.id).filter(i=>/^fund/.test(i)),stale:SIGSTALE.filter(s=>/^fund/.test(s.id)).map(s=>s.id),ds:dataStale()};
  // C3 still holds: funding 12h10m old -> stale, and the fallback reports it with the 12h limit
  DVRAW=mk(12*H+10*6e4);DV=gateDV(DVRAW);L=staleSweep(derivSignals());o.c3={inSig:L.map(s=>s.id).filter(i=>/^fund/.test(i)),ds:dataStale()};
 // one-entry rule: displayed rate/age/as-of/caption/Data line == latest.funding at latest.funding_t (a settled print)
  {DVRAW=mk(5*H);const BL=DVRAW.assets.BTC.latest;DVRAW.assets.BTC.funding.points.at(-1)[1]=BL.funding;DVRAW.assets.BTC.funding.points.splice(-1,0,[BL.funding_t-8*H,BL.funding*3]);DV=gateDV(DVRAW);const L=staleSweep(derivSignals()),c=L.find(s=>s.id==='fundBTC'),bf=btcFund(),T=hmU2(BL.funding_t),pc=(BL.funding*100).toFixed(4);
   const ms=marketStates().find(x=>x.k==='Derivatives');o.one={T,pc,bf,read:c?.read,src:c?.src,freshT:c?.freshT,t:BL.funding_t,why:ms?.why,st:ms?.st,settled:DVRAW.assets.BTC.funding.points.some(p=>p[0]===BL.funding_t&&p[1]===BL.funding)}}
  // latest not a settled print (time not in funding.points) -> no derivs.json reading
  {DVRAW=mk(5*H);DVRAW.assets.BTC.latest.funding_t+=37*6e4;DV=gateDV(DVRAW);o.uns={latest:DV.assets.BTC.latest.funding,fl:fundLatest(DVRAW.assets.BTC)}}
 }finally{DVRAW=keep;DV=gateDV(keep)}
 o.glob={src:D.glob?._src??null,btc:D.glob?.market_cap_percentage?.btc??null};o.gtxt=(document.querySelector('#gUpd')?.textContent||'');
 o.today=JSON.stringify(marketStates()).match(/BTC dominance \d[^"]{0,40}/g)||[];
 return o});
ok(r.one.settled&&r.one.bf&&r.one.bf.f===r.one.bf.f&&Math.abs(r.one.bf.f*100-+r.one.pc)<5e-5&&r.one.bf.t===r.one.t,'one entry: btcFund rate/time == latest.funding/funding_t (settled print)',r.one);
ok(r.one.read&&r.one.read.startsWith(r.one.pc+'% per 8h (settled '+r.one.T+')')&&r.one.src.endsWith('as of '+r.one.T)&&r.one.freshT===r.one.t,'one entry: card reading, as-of and age come from latest.funding at latest.funding_t',r.one);
ok(r.one.why&&r.one.why.includes(r.one.pc)&&r.one.why.includes('settled '+r.one.T)&&r.one.st.includes(r.one.pc),'one entry: Today caption/Data line rate and time == latest',r.one);
ok(r.uns.fl===null&&r.uns.latest==null,'latest that is not a settled print gives no reading',r.uns);
ok(r.runs==null,'fixture: _runs.json missing',r.runs);
ok(r.c2.inSig.includes('fundBTC')&&r.c2.inSig.includes('fundETH')&&!r.c2.stale.length,'C2: settled funding print 7h old stays a reading/caption source when _runs.json is missing',r.c2);
ok(!r.c2.ds.some(x=>/derivs/.test(x)),'C2: missing _runs.json does not mark fresh funding stale',r.c2.ds);
ok(!r.c3.inSig.length&&r.c3.ds.some(x=>/derivs\.json funding \(_runs\.json missing\) 12\.\dh old \(limit 12h\)/.test(x)),'C3: funding past 12h still stale with the _runs.json fallback',r.c3);
ok(!req.some(u=>/coingecko\.com\/api\/v3\/global/.test(u)),'totals/dominance never fetched from CoinGecko /global',req.filter(u=>/global/.test(u)));
ok(r.glob.src==null||/^CoinPaprika/.test(r.glob.src),'Global totals source is CoinPaprika',r.glob);
ok(!r.gtxt||/CoinPaprika/.test(r.gtxt),'Global card label names CoinPaprika',r.gtxt);
ok(r.today.every(t=>/CoinPaprika/.test(t)),'every dominance reading names CoinPaprika',r.today);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
