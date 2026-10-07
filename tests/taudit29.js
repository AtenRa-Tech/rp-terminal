// taudit29.js: regression tests for items from RP's 7 Oct list of "already fixed" bugs that had no test (and, in this repo, no fix).
// Each drives the app's own functions with crafted data; each fails on b479fff-era code. URL=... node tests/taudit29.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,500):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return typeof buildSignals==='function'&&typeof klines==='function'&&MAC&&MAC.M&&MAC.M.series&&SIG&&SIGD}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5,H4=4*36e5;
 // #1 #2 candle fallback: Binance down, CoinGecko OHLC up
 {const keepJ=window.J,closeT=Date.UTC(2026,9,6,4);window.J=async u=>{if(/binance/.test(u))throw new Error('down');if(/\/ohlc/.test(u))return Array.from({length:10},(_,i)=>[closeT+i*H4,100+i,101+i,99+i,100.5+i]);return keepJ(u)};D.kl={};
  const c={id:'bitcoin',sym:'btc'};let d1=null,e1=null;try{d1=await klines(c,'1d',10)}catch(e){e1=String(e)}let d4=null;try{d4=await klines(c,'4h',10)}catch(e){}window.J=keepJ;D.kl={};
  o.cg={d1src:d1?.src||null,e1,t0:d4?.t?.[0],want:closeT-H4,v:d4?.v?.slice(0,3),src:d4?.src}}
 // #4 stale chart request: an older, slower response must not overwrite a newer one
 {try{tab('chart')}catch(e){}const keep=window.klinesH,mk=tag=>{const t=Array.from({length:60},(_,i)=>Date.UTC(2026,8,1)+i*DAYm),c=t.map((_,i)=>100+i);return{t,o:c,h:c.map(x=>x+1),l:c.map(x=>x-1),c,v:c.map(()=>1),src:tag,pair:'BTC/USDT',complete:true,pages:1}};
  let n=0;window.klinesH=async()=>{const k=++n;if(k===1){await new Promise(r=>setTimeout(r,700));return mk('OLD')}return mk('NEW')};
  const a=loadChart(),b2=loadChart();await Promise.allSettled([a,b2]);await new Promise(r=>setTimeout(r,200));o.race=CH.d?.src;window.klinesH=keep;try{await loadChart()}catch(e){}}
 // #9 signal cache across UTC midnight: ensureSig() the next UTC day must rebuild from fresh data
 {const keepL=window.loadSigData,keepN=Date.now;let calls=0;window.loadSigData=async()=>{calls++;return SIGD};Date.now=()=>keepN()+DAYm;try{await ensureSig()}catch(e){}Date.now=keepN;window.loadSigData=keepL;o.midnight=calls}
 // #17 macro freshness: invalid observation date is stale
 {const M=JSON.parse(JSON.stringify(MAC.M));M.series.DGS10.last_date='not-a-date';M.series.DTWEXBGS&&(M.series.DTWEXBGS.last_date='');let f1,f2;try{f1=fresh('DGS10',M)}catch(e){f1={err:String(e)}}try{f2=M.series.DTWEXBGS?fresh('DTWEXBGS',M):{st:true}}catch(e){f2={err:String(e)}}o.mf=[f1?.st,f2?.st,f1?.why]}
 // #20 stablecoin 30d by calendar date: one missing day inside the window
 {const keep=SIGD.ST,end=Date.UTC(2026,9,6),t=[],v=[];for(let i=0;i<=40;i++){if(i===25)continue;t.push(end-(40-i)*DAYm);v.push(300e9+i*1e9)}SIGD.ST={t,v,src:'test'};const got=st30(),j=t.findIndex(x=>x===end-30*DAYm);o.st30=[got,(v.at(-1)/v[j]-1)*100];SIGD.ST=keep}
 // #22 ETF totals as numeric strings
 {const E={datasets:{btc:{days:[{date:'2026-10-01',total:'100'},{date:'2026-10-02',total:'50.5'},{date:'2026-10-05',total:'-20'}]}}};let s;try{s=etfStats(E,'btc')}catch(e){s={err:String(e)}}o.etf=[s?.s7,s?.s30,typeof s?.s7]}
 // #28 halving: history starting after the 2012 halving must not use a later price as that cycle's base
 {const t=[],v=[];for(let x=Date.UTC(2013,0,1);x<=Date.UTC(2026,9,6);x+=DAYm){t.push(x);v.push(13*Math.exp((x-Date.UTC(2013,0,1))/DAYm/1200))}let s;try{s=buildSignals({P:{t,v,src:'Binance'},CL:{BTC:{t,v}}}).find(x=>/halv/.test(x.id))}catch(e){s={err:String(e)}}o.halv=[s?.id,s?.cap]}
 return o});
ok(!r.cg.d1src&&!!r.cg.e1,"candle fallback: no CoinGecko candles stand in for 1d (its OHLC granularity would be 4-day)",r.cg);
ok(r.cg.src==='CoinGecko'&&r.cg.t0===r.cg.want,'candle fallback: CoinGecko close-time stamps shifted to candle open (4h)',r.cg);
ok(Array.isArray(r.cg.v)&&r.cg.v.every(x=>x===null),'volume: missing fallback volume is null, never 0',r.cg.v);
ok(r.race==='NEW','chart: an older, slower request does not overwrite the newer coin/interval',r.race);
ok(r.midnight===1,'signals: cache rebuilt after UTC midnight (completed daily closes change)',r.midnight);
ok(r.mf[0]===true&&r.mf[1]===true,'macro freshness: invalid or empty observation date is stale',r.mf);
ok(r.st30[0]!=null&&Math.abs(r.st30[0]-r.st30[1])<1e-9,'stablecoin 30d: compares with the exact calendar date 30 days earlier',r.st30);
ok(r.etf[0]===130.5&&r.etf[2]==='number','ETF: numeric-string totals are converted before summing (130.5, not string concat)',r.etf);
ok(r.halv[1]&&!/2012 cycle/.test(r.halv[1]),'halving: a cycle whose halving day is not in the history is left out (no later price as its base)',r.halv);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
