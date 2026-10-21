// 21 Oct (approved): BTC history and ETH/BTC when BOTH Coinbase and Binance fail. Load 1 (live) stores the daily closes on this device (rp_sigd);
// load 2 blocks every Coinbase and Binance request: the cards must show the last STORED close with its date, marked stale (unscored, out of POST NOW), never blank.
// Also: the 0.1% cross-checks (BTC history vs Binance, ETH/BTC vs the direct ETHBTC pair) are reported on load 1. URL=... node tests/tkeptfb.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const go=u=>u+(u.includes('?')?'&':'?')+'v='+Date.now();
const EX=/coinbase\.com|binance\.(com|vision)/;
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const ctx=await b.createBrowserContext();
 let pg=await ctx.newPage();await pg.goto(go(URL),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return SIG&&SIG.length>5&&localStorage.rp_sigd&&SIGD?.P?.t?.length&&SIGD?.EB?.t?.length}catch(e){return false}},{timeout:180000}).catch(()=>{});
 const A=await pg.evaluate(()=>({sv:!!localStorage.rp_sigd,P:SIGD?.P?{src:SIGD.P.src,last:SIGD.P.t.at(-1),checks:SIGD.P.checks}:null,EB:SIGD?.EB?{last:SIGD.EB.t.at(-1),v:SIGD.EB.v.at(-1),checks:SIGD.EB.checks}:null,CLB:SIGD?.CL?.BTC?{last:SIGD.CL.BTC.t.at(-1),v:SIGD.CL.BTC.v.at(-1)}:null}));
 ok(A.sv&&A.P&&A.EB&&A.CLB,'load 1: BTC history, ETH/BTC and BTC closes loaded and stored on this device',A);
 const pc=A.P?.checks||{};ok(Object.values(pc).some(c=>c&&c.ok&&c.med<=0.1),'load 1: BTC history cross-check within 0.1% (median) on overlapping close dates',pc);
 const ec=A.EB?.checks||{};ok(Object.keys(ec).length>0&&Object.values(ec).every(c=>c==null||typeof c.med==='number'),'load 1: ETH/BTC cross-check vs the direct ETHBTC pair is computed',ec);
 await pg.close();
 pg=await ctx.newPage();await pg.setRequestInterception(true);let blocked=0;pg.on('request',r=>{if(EX.test(r.url())){blocked++;return r.abort()}r.continue()});
 await pg.goto(go(URL),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return !SIGP&&SIG&&SIGSTALE.length}catch(e){return false}},{timeout:180000}).catch(()=>{});await new Promise(r=>setTimeout(r,1500));
 const R=await pg.evaluate(()=>{const f=id=>{const c=SIGSTALE.find(x=>x.id===id)||SIG.find(x=>x.id===id);return c?{id,stale:!!c.stale,kept:!!c.kept,score:c.score,read:c.read,kc:c.keptClose||null,why:c.staleWhy||null}:null};
  const ms=marketStates().filter(x=>['BTC','ETH'].includes(x.k)).map(x=>({k:x.k,st:x.st,why:x.why}));return{ethbtc:f('ethbtc'),mayer:f('mayer'),rainbow:f('rainbow'),ms,inSig:SIG.filter(x=>/^(ethbtc|mayer|rainbow|pi|2y|dd|halv)$/.test(x.id)).map(x=>x.id),postNow:SIG.filter(x=>x.kept&&postNow(x)).length}});
 ok(blocked>0,`load 2: Coinbase and Binance requests failed (${blocked} blocked)`);
 const dated=s=>/\d{1,2} [A-Z][a-z]{2} \d{4}/.test(s||'');
 for(const id of ['ethbtc','mayer','rainbow']){const c=R[id];
  ok(c&&c.stale&&c.kept&&c.score==null&&c.read==='—',`load 2: ${id} card is stale and unscored (saved copy), not dropped`,c);
  ok(c&&c.kc&&isFinite(c.kc.v)&&c.kc.v>0&&dated(c.why)&&/last stored daily close/.test(c.why),`load 2: ${id} shows the stored close with its date`,c)}
 ok(R.ethbtc?.kc?.t===A.EB?.last,'load 2: ETH/BTC stored close is the last close stored on load 1',{kc:R.ethbtc?.kc,stored:A.EB?.last});
 ok(R.ethbtc&&/BTC\)?/.test(R.ethbtc.why)&&!/\$/.test(R.ethbtc.why.split('close')[1]||''),'load 2: ETH/BTC stored close is shown as a BTC ratio, not dollars',R.ethbtc?.why);
 ok(!R.inSig.length&&R.postNow===0,'load 2: saved-copy cards are out of SIG and POST NOW',R.inSig);
 for(const k of ['BTC','ETH']){const m=R.ms.find(x=>x.k===k);ok(m&&m.st==='Stale'&&dated(m.why)&&/last stored daily close \$/.test(m.why),`load 2: Today ${k} row is Stale with the stored close and its date (not Loading/No data)`,m)}
 await b.close();console.log('FAILS:',F.length,F);process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
