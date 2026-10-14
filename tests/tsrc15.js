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
 const mk=(fAge,pAge)=>{const x=JSON.parse(JSON.stringify(keep));for(const A of Object.values(x.assets)){const P=A.funding?.points;if(P?.length){const d=now-pAge-P.at(-1)[0];P.forEach(q=>q[0]+=d)}if(A.latest){A.latest.funding_t=now-fAge}}return x};
 try{
  // C2: funding fetched 7h ago, last settled print 12h02m ago -> inside 12h, card stays a reading; _runs.json missing -> dataStale falls back to derivs funding time (no false stale)
  DVRAW=mk(7*H,12*H+2*6e4);DV=gateDV(DVRAW);let L=staleSweep(derivSignals());o.c2={inSig:L.map(s=>s.id).filter(i=>/^fund/.test(i)),stale:SIGSTALE.filter(s=>/^fund/.test(s.id)).map(s=>s.id),ds:dataStale()};
  // C3 still holds: funding 12h10m old -> stale, and the fallback reports it with the 12h limit
  DVRAW=mk(12*H+10*6e4,12*H+10*6e4);DV=gateDV(DVRAW);L=staleSweep(derivSignals());o.c3={inSig:L.map(s=>s.id).filter(i=>/^fund/.test(i)),ds:dataStale()};
 }finally{DVRAW=keep;DV=gateDV(keep)}
 o.glob={src:D.glob?._src??null,btc:D.glob?.market_cap_percentage?.btc??null};o.gtxt=(document.querySelector('#gUpd')?.textContent||'');
 o.today=JSON.stringify(marketStates()).match(/BTC dominance \d[^"]{0,40}/g)||[];
 return o});
ok(r.runs==null,'fixture: _runs.json missing',r.runs);
ok(r.c2.inSig.includes('fundBTC')&&r.c2.inSig.includes('fundETH')&&!r.c2.stale.length,'C2: funding 7h old (print 12h02m) stays a reading/caption source when _runs.json is missing',r.c2);
ok(!r.c2.ds.some(x=>/derivs/.test(x)),'C2: missing _runs.json does not mark fresh funding stale',r.c2.ds);
ok(!r.c3.inSig.length&&r.c3.ds.some(x=>/derivs\.json funding \(_runs\.json missing\) 12\.\dh old \(limit 12h\)/.test(x)),'C3: funding past 12h still stale with the _runs.json fallback',r.c3);
ok(!req.some(u=>/coingecko\.com\/api\/v3\/global/.test(u)),'totals/dominance never fetched from CoinGecko /global',req.filter(u=>/global/.test(u)));
ok(r.glob.src==null||/^CoinPaprika/.test(r.glob.src),'Global totals source is CoinPaprika',r.glob);
ok(!r.gtxt||/CoinPaprika/.test(r.gtxt),'Global card label names CoinPaprika',r.gtxt);
ok(r.today.every(t=>/CoinPaprika/.test(t)),'every dominance reading names CoinPaprika',r.today);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
