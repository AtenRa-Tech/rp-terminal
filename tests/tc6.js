// C6 (#27): one-day step-back rule for DAILY cards + ETH/BTC and gold 'unavailable' follow-up (blocking). URL=... node tests/tc6.js
// Daily cards: fresh while the last point is the last closed UTC day or ONE day before it (FRESHNESS.signal_cards.daily_lag_days = 1); two days back = stale.
// If every source fails, ETH/BTC and BTC-in-gold stay listed as '—' UNAVAILABLE with the reason: never dropped, never 0, no score, out of POST NOW.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const FR=JSON.parse(fs.readFileSync(path.join(__dirname,'../shared/freshness.json'),'utf8'));
ok(FR.signal_cards&&FR.signal_cards.daily_lag_days===1,'C6 shared/freshness.json: daily_lag_days = 1 (one-day step-back)',FR.signal_cards);
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:390,height:844});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await require('./hermetic').hermetic(pg);await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length>5&&SIGD&&SIGD.P&&typeof staleSweep==='function'}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5;if(typeof staleSweep!=='function'||typeof sigUnavail!=='function')return{missing:true};
 const keepSIG=SIG,keepST=SIGSTALE,keepD=SIGD;
 try{
 o.lag=SIGLAG.daily;o.inline=FRESHNESS.signal_cards.daily_lag_days;
 // C6 step-back: a fixed clock (12:00 UTC) so the test does not depend on run time
 const now=Date.UTC(2026,9,15,12),cd=Date.UTC(2026,9,14),mk=T=>({id:'mayer',title:'t',score:50,closed:T,read:'x'});
 const run=T=>{SIGSTALE=[];const c=mk(T),k=staleSweep([c],now);return{fresh:k.includes(c),stale:c.stale===true,score:c.score,read:c.read,used:c.usedDate,why:c.staleWhy||''}};
 o.d0=run(cd);o.d1=run(cd-DAYm);o.d1end=run(cd-DAYm+DAYm-1);o.d2=run(cd-2*DAYm);o.d2late=run(cd-DAYm-1);
 // a day boundary: just after 00:00 UTC the newly closed day moves the window forward by exactly one day
 {SIGSTALE=[];const c=mk(cd-DAYm),k=staleSweep([c],Date.UTC(2026,9,16,0,0,1));o.roll={fresh:k.includes(c),stale:c.stale===true}}
 // weekly and funding cards are NOT on the daily rule
 {SIGSTALE=[];const w={id:'wrsi',title:'w',score:50,closed:cd-7*DAYm},k=staleSweep([w],now);o.weekly=k.includes(w)}
 // macro: fresh checked_at/updated never hide an old last_date
 {const nowI=new Date().toISOString(),old=new Date(Date.now()-30*DAYm).toISOString().slice(0,10),M={updated:nowI,checked_at:nowI,failed:[],series:{DGS10:{freq:'Daily',last_date:old,points:[[old,4.1]]}}};const f=fresh('DGS10',M);o.mac={st:f.st,over:f.over,last:f.last,ser:ser('DGS10',M)===null}}
 // unavailable: every source failed for ETH/BTC, PAXG and BTC pairs
 const d={...keepD,EB:null,PG:null,BT:null};SIGSTALE=[];SIG=buildSignals(d);SIG.forEach(s=>{try{prepSig(s)}catch(e){}});SIG=staleSweep(SIG);sigUnavail(SIG,d);
 const u=id=>{const c=SIGSTALE.find(x=>x.id===id);return c?{un:c.unavailable===true,stale:c.stale===true,score:c.score,read:c.read,m:c.m,why:c.staleWhy}:null};
 o.un={eb:u('ethbtc'),gold:u('gold'),inSIG:SIG.filter(x=>x.id==='ethbtc'||x.id==='gold').length,post:todayItems().filter(postNow).filter(x=>x.id==='ethbtc'||x.id==='gold').length,dup:SIGSTALE.filter(x=>x.id==='ethbtc').length};
 sigUnavail(SIG,d);o.un.dup2=SIGSTALE.filter(x=>x.id==='ethbtc').length;
 await renderSignals().catch(()=>{});await new Promise(r=>setTimeout(r,300));
 o.dom=['ethbtc','gold'].map(id=>{const e=document.querySelector(`#sigList [data-sid="${id}"]`);return e?{txt:e.innerText,v:e.querySelector('.stv')?.innerText}:null});
 // data present: no unavailable card is added
 SIGSTALE=[];SIG=buildSignals(keepD);SIG.forEach(s=>{try{prepSig(s)}catch(e){}});SIG=staleSweep(SIG);sigUnavail(SIG,keepD);o.present=SIGSTALE.filter(x=>x.unavailable).map(x=>x.id);
 }catch(e){o.err=String(e.stack||e)}finally{SIG=keepSIG;SIGSTALE=keepST;SIGD=keepD}return o});
ok(!r.missing&&!r.err,'C6 harness ran',r);
ok(r.lag===1&&r.inline===1,'C6 app daily lag = 1 day, read from inlined FRESHNESS',r);
ok(r.d0&&r.d0.fresh&&!r.d0.stale,'C6 daily card on the last closed UTC day: fresh, full score',r.d0);
ok(r.d1&&r.d1.fresh&&!r.d1.stale&&r.d1.score===50,'C6 daily card ONE day behind (step-back): still fresh, score kept',r.d1);
ok(r.d1end&&r.d1end.fresh,'C6 one day back, any time in that day: fresh',r.d1end);
ok(r.d2&&!r.d2.fresh&&r.d2.stale&&r.d2.score===null&&r.d2.read==='—'&&r.d2.used==='2026-10-12'&&/one day publishing lag allowed/.test(r.d2.why),'C6 daily card TWO days behind: stale, no score, —, names date and rule',r.d2);
ok(r.d2late&&r.d2late.stale,'C6 one millisecond before the step-back window: stale',r.d2late);
ok(r.roll&&!r.roll.fresh&&r.roll.stale,'C6 after 00:00 UTC rollover the window moves one day',r.roll);
ok(r.weekly===true,'C6 weekly card (wrsi) is not judged by the daily rule',r.weekly);
ok(r.mac&&r.mac.st&&r.mac.over&&r.mac.ser,'macro: fresh checked_at + old last_date still shows stale (app uses last_date)',r.mac);
const U=r.un||{};
for(const[k,lab]of[['eb','ETH/BTC'],['gold','BTC in gold']]){const c=U[k];ok(c&&c.un&&c.stale&&c.score===null&&c.read==='—'&&c.m===null&&/^Unavailable: every source failed for /.test(c.why||''),`UNAVAILABLE ${lab}: listed as — with the reason, score null (not 0)`,c)}
ok(U.inSIG===0&&U.post===0,'UNAVAILABLE cards are out of SIG and POST NOW',U);
ok(U.dup===1&&U.dup2===1,'UNAVAILABLE card listed once (idempotent)',U);
for(const[i,lab]of[[0,'ETH/BTC'],[1,'gold']]){const e=(r.dom||[])[i];ok(e&&/UNAVAILABLE/.test(e.txt)&&e.v==='—'&&/every source failed/.test(e.txt)&&!/\b0(\.0+)?\b/.test(e.v),`UNAVAILABLE ${lab} card rendered with — and the reason`,e)}
ok(Array.isArray(r.present)&&r.present.length===0,'data present: no unavailable card added',r.present);
ok(!errs.length,'no page errors',errs);
await b.close();console.log('FAILS:',F.length,F);process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
