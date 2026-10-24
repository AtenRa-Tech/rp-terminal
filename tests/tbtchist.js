// 21 Oct: BTC long history. Coinbase BTC-USD daily candles primary, Binance BTCUSDT cross-check, blockchain.com backfill shifted to close date (day D -> close of D-1),
// splice only if overlapping closes match within 0.1% (median), every point carries its source. A source with no new points for 2+ days makes its cards
// stale + unscored (listed in SIGSTALE, '—', out of SIG and POST NOW), never a crash or a reading. URL=... node tests/tbtchist.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,600):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await require('./hermetic').hermetic(pg);await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length>5&&SIGD&&SIGD.P&&typeof spliceHist==='function'}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(()=>{const o={},D0=Math.floor(Date.now()/DAY)*DAY,LC=D0-DAY;if(typeof spliceHist!=='function')return{missing:true};
 // 1) date shift: blockchain.com stamps D 00:00 with the price at that instant = close of D-1
 const bx=[{x:(LC)/1000,y:100},{x:(LC-DAY)/1000,y:99}].reverse(),sh=bcShift(bx);o.shift={t:sh.t.map(t=>new Date(t).toISOString().slice(0,10)),want:[new Date(LC-2*DAY).toISOString().slice(0,10),new Date(LC-DAY).toISOString().slice(0,10)]};
 // synthetic series: Coinbase closes for the last 400 days, blockchain.com for 3000 days, stamped one day LATER (its D = our close of D-1)
 const N=3000,close=i=>+(20000*(1+0.03*Math.sin(i*1.3))+i*10).toFixed(2),day=i=>LC-(N-1-i)*DAY;
 const cb={t:[],v:[],src:'Coinbase'};for(let i=N-400;i<N;i++){cb.t.push(day(i));cb.v.push(close(i))}
 const bn={t:cb.t.slice(),v:cb.v.map(v=>v*1.0004),src:'Binance'};
 const bcRaw=[];for(let i=0;i<N;i++)bcRaw.push({x:(day(i)+DAY)/1000,y:close(i)});
 const h=spliceHist(cb,bcShift(bcRaw),bn);
 o.splice={n:h.t.length,first:h.source[0],last:h.source.at(-1),cut:h.source.indexOf('Coinbase'),cutT:h.t[h.source.indexOf('Coinbase')]===cb.t[0],srcLen:h.source.length===h.t.length,
  sorted:h.t.every((t,i)=>!i||t-h.t[i-1]===DAY),bcMed:h.checks['blockchain.com']?.med,bcOk:h.checks['blockchain.com']?.ok,bnOk:h.checks.Binance?.ok,bnMed:h.checks.Binance?.med,backfill:h.backfill||null,
  valAtCut:h.v[h.source.indexOf('Coinbase')-1]===close(N-401)};
 // without the shift the same data would NOT pass the 0.1% check (proves the shift is what aligns the two)
 const unshift={t:bcRaw.map(p=>p.x*1000),v:bcRaw.map(p=>p.y),src:'blockchain.com'},h2=spliceHist(cb,unshift,bn);o.noShift={ok:h2.checks['blockchain.com']?.ok,rej:!!h2.backfill,bcPts:h2.source.filter(s=>s==='blockchain.com').length};
 // 0.5% off -> backfill rejected, Coinbase only
 const bad=bcShift(bcRaw.map(p=>({x:p.x,y:p.y*1.005}))),h3=spliceHist(cb,bad,bn);o.bad={rej:!!h3.backfill,bcPts:h3.source.filter(s=>s==='blockchain.com').length,n:h3.t.length};
 // Coinbase down -> Binance primary is reported as Binance
 const h4=spliceHist(bn,bcShift(bcRaw),null);o.bnPri={src:h4.src,last:h4.source.at(-1)};
 // live app: P built from Coinbase with source per point
 o.live={src:SIGD.P.src,hasSource:Array.isArray(SIGD.P.source)&&SIGD.P.source.length===SIGD.P.t.length,lastSrc:SIGD.P.source?.at(-1)};
 // 2) a source goes quiet: P (and hashrate) stop 3 days before the last closed day
 const keepSIG=SIG,keepST=SIGSTALE,keepD=SIGD;try{
  const cutQ=(s,k)=>{const n=s.t.filter(t=>t<=LC-k*DAY).length;return{...s,t:s.t.slice(0,n),v:s.v.slice(0,n),...(s.source?{source:s.source.slice(0,n)}:{})}};
  const d={...SIGD,P:cutQ(SIGD.P,3),H:SIGD.H?cutQ(SIGD.H,3):SIGD.H};SIGD=d;SIGSTALE=[];let L=buildSignals(d);L.forEach(s=>{try{prepSig(s)}catch(e){}});L=staleSweep(L);sigUnavail(L,d);SIG=L;
  const ids=['rainbow','pi','halv','hash'];o.quiet={};for(const id of ids){const c=SIGSTALE.find(x=>x.id===id);o.quiet[id]=c?{stale:c.stale,score:c.score,read:c.read,why:(c.staleWhy||'').slice(0,60),inSig:L.some(x=>x.id===id),post:postNow(c)}:null}
  // the other cards (other sources still fresh) keep scoring
  o.quietOthers=L.filter(s=>s.score!=null).map(s=>s.id);
  // 1 day quiet = still inside the one-day publishing lag: not stale
  SIGD={...keepD,P:cutQ(keepD.P,1)};SIGSTALE=[];let L1=buildSignals(SIGD);L1.forEach(s=>{try{prepSig(s)}catch(e){}});L1=staleSweep(L1);o.oneDay={rainbow:L1.find(s=>s.id==='rainbow')?.score??null,stale:SIGSTALE.some(c=>c.id==='rainbow')};
 }finally{SIG=keepSIG;SIGSTALE=keepST;SIGD=keepD}
 return o});
if(r.missing){ok(false,'spliceHist/bcShift exist in the app');}else{
 ok(JSON.stringify(r.shift.t)===JSON.stringify(r.shift.want),'blockchain.com day D moves to the close of D-1',r.shift);
 const s=r.splice;ok(s.first==='blockchain.com'&&s.last==='Coinbase'&&s.cutT&&s.srcLen,'backfill: blockchain.com before Coinbase starts, Coinbase after, one source per point',s);
 ok(s.sorted,'spliced series is one point per UTC day with no gap or duplicate at the join',s);ok(s.valAtCut,'backfilled value at the join is the shifted close of that day',s);
 ok(s.bcOk&&s.bcMed<=0.1,'overlap check: shifted blockchain.com matches Coinbase within 0.1%',s);ok(s.bnOk&&s.bnMed<=0.1,'Binance cross-check recorded and within 0.1%',s);
 ok(r.noShift.ok===false&&r.noShift.rej&&r.noShift.bcPts===0,'unshifted blockchain.com fails the 0.1% check and is not spliced',r.noShift);
 ok(r.bad.rej&&r.bad.bcPts===0&&r.bad.n===400,'blockchain.com 0.5% off: backfill rejected, Coinbase-only history',r.bad);
 ok(r.bnPri.src==='Binance'&&r.bnPri.last==='Binance','Coinbase down: Binance primary, labelled Binance',r.bnPri);
 ok(r.live.src==='Coinbase'&&r.live.hasSource&&r.live.lastSrc==='Coinbase','live app: BTC history primary is Coinbase with a source on every point',r.live);
 for(const [id,c] of Object.entries(r.quiet))ok(c&&c.stale&&c.score==null&&c.read==='—'&&/^Stale/.test(c.why)&&!c.inSig&&!c.post,`source quiet 3 days: ${id} stale, unscored, labelled, out of SIG and POST NOW`,c);
 ok(r.quietOthers.length>=3,'cards on other (fresh) sources keep their scores',r.quietOthers);
 ok(r.oneDay.rainbow!=null&&!r.oneDay.stale,'source quiet 1 day (publishing lag): still scored',r.oneDay)}
ok(!errs.length,'no page errors',errs);await b.close();console.log(F.length?`FAILS: ${F.length}`:'ALL PASS');process.exit(F.length?1:0)})();
