// P0 freshness (14 Oct): every card whose feed is stale stays visible in SIGSTALE (date + 'stale', '—'), out of SIG: no score, no POST NOW, no caption.
// Funding BTC/ETH (12h), ETH 30d vol (daily closes), and every other card. URL=... node tests/tstale.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:1280,height:900});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length>5&&SIGD&&SIGD.P&&DVRAW&&typeof staleSweep==='function'}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5,H=36e5;if(typeof staleSweep!=='function')return{missing:true};
 const keepSIG=SIG,keepST=SIGSTALE,keepDVR=DVRAW,keepDV=DV,keepD=SIGD;
 const excl=id=>{let caps=0;try{caps=(SIG||[]).filter(x=>x.id===id).length}catch(e){}return{inSIG:SIG.some(x=>x.id===id),today:todayItems().some(x=>x.id===id),post:todayItems().filter(postNow).some(x=>x.id===id)}};
 const card=id=>{const c=SIGSTALE.find(x=>x.id===id);return c?{stale:c.stale,score:c.score,read:c.read,used:c.usedDate,why:c.staleWhy}:null};
 try{
 // 1) funding BTC/ETH: newest print 13h old
 const raw=JSON.parse(JSON.stringify(keepDVR));for(const a of ['BTC','ETH']){const A=raw.assets[a];if(!A?.funding?.points?.length)continue;const d=Date.now()-13*H-A.funding.points.at(-1)[0];A.funding.points=A.funding.points.map(p=>[p[0]+d,p[1]]);if(A.latest){A.latest.funding_t=A.funding.points.at(-1)[0]}}
 DVRAW=raw;DV=gateDV(raw);SIG=[...buildSignals(SIGD),...derivSignals()];SIG.forEach(s=>{try{prepSig(s)}catch(e){}});SIG=staleSweep(SIG);
 o.fund={BTC:{card:card('fundBTC'),...excl('fundBTC')},ETH:{card:card('fundETH'),...excl('fundETH')}};
 // 2) ETH 30d vol: ETH closes end 3 days ago (feed stale); last 40 closes flat so the volatility card exists
 DVRAW=keepDVR;DV=gateDV(keepDVR);
 {const E=SIGD.CL.ETH,n=E.t.length-3,v=E.v.slice(0,n),b0=v[n-41];for(let i=n-40;i<n;i++)v[i]=b0*(1+(i%2?1e-4:-1e-4));const d={...SIGD,CL:{...SIGD.CL,ETH:{...E,t:E.t.slice(0,n),v}}};d.EB=alignR(d.CL.ETH,d.CL.BTC);
  SIGSTALE=[];SIG=buildSignals(d);SIG.forEach(s=>{try{prepSig(s)}catch(e){}});const rvAll=[...SIG].filter(x=>/^rv\d+ETH$/.test(x.id)).map(x=>x.id);SIG=staleSweep(SIG);
  const id=rvAll[0]||'rv30ETH';o.vol={built:rvAll,card:card(id),...excl(id)}}
 // 3) every other card: clock 20 days ahead (past the weekly limit too) -> every card stale, none left in SIG
 SIGSTALE=[];SIG=[...buildSignals(SIGD),...derivSignals()];SIG.forEach(s=>{try{prepSig(s)}catch(e){}});const ids=SIG.map(s=>s.id);
 const left=staleSweep(SIG,Date.now()+20*DAYm);o.all={ids,left:left.map(s=>s.id),stale:SIGSTALE.filter(x=>ids.includes(x.id)).map(x=>({id:x.id,ok:x.stale===true&&x.score===null&&x.read==='—'&&/^\d{4}-\d\d-\d\d$/.test(x.usedDate||'')&&/^Stale: last data \d{1,2} [A-Z][a-z]{2} \d{4}/.test(x.staleWhy||'')}))};
 // render: stale cards are visible with date + 'stale'
 SIG=left;await renderSignals().catch(()=>{});await new Promise(r=>setTimeout(r,300));
 o.render=[...document.querySelectorAll('[data-stale="1"]')].map(e=>({id:e.dataset.sid,t:e.innerText.replace(/\s+/g,' ').slice(0,200)}));
 // captions: no stale card yields a caption (captions iterate SIG only)
 o.capIds=(SIG||[]).map(s=>s.id);
 }finally{SIG=keepSIG;SIGSTALE=keepST;DVRAW=keepDVR;DV=keepDV;SIGD=keepD}
 return o});
if(r.missing){ok(false,'staleSweep exists');}else{
for(const a of ['BTC','ETH']){const x=r.fund[a];ok(x.card&&x.card.stale===true&&x.card.score===null&&x.card.read==='—'&&/^\d{4}-\d\d-\d\d$/.test(x.card.used||'')&&/Stale: last 8h print \d{1,2} [A-Z][a-z]{2} \d{4} \d\d:\d\d UTC/.test(x.card.why||'')&&!x.inSIG&&!x.today&&!x.post,`funding ${a} 13h old: card stays in SIGSTALE ('—', date, stale), out of SIG/Today/POST NOW`,x)}
ok(r.vol.built.length&&r.vol.card&&r.vol.card.stale===true&&r.vol.card.read==='—'&&/Stale: last data/.test(r.vol.card.why||'')&&!r.vol.inSIG&&!r.vol.today&&!r.vol.post,'ETH 30d vol on 3-day-old closes: card in SIGSTALE with date + stale, out of SIG/Today/POST NOW',r.vol);
ok(r.all.ids.length>5&&!r.all.left.length&&r.all.stale.length===r.all.ids.length&&r.all.stale.every(x=>x.ok),'every card past its limit (clock +20 days) moves to SIGSTALE with date + stale + score null; none left in SIG',r.all);
ok(r.render.length===r.all.ids.length&&r.render.every(x=>/STALE/.test(x.t)&&/—/.test(x.t)&&/Stale: last data \d{1,2} [A-Z][a-z]{2} \d{4}/.test(x.t)),'every stale card is rendered (visible) with STALE, — and its date',{n:r.render.length,want:r.all.ids.length,bad:r.render.filter(x=>!/Stale: last data/.test(x.t)).slice(0,3)});
ok(!r.capIds.length,'no stale card is a caption source (SIG empty when every card is stale)',r.capIds)}
ok(!errs.length,'no page errors',errs.slice(0,3));
console.log('FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
