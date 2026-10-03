const p=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));
const BAN=[/what are you buying/i,/what'?s your move/i,/everyone'?s watching/i,/are you ready/i,/don'?t miss/i,/\bLFG\b/i,/to the moon/i,/starts here/i,/altseason (is )?(coming|here|loading)/i,/undefined|NaN/];
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const e=[];pg.on('pageerror',x=>e.push(x.message));const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);console.log((c?'PASS ':'FAIL ')+m)};
await pg.goto(process.env.URL||'http://localhost:8765/index.html');
await pg.waitForFunction(()=>TAB==='today'&&SIG&&SIG.length&&MK&&DV&&MAC.items,{timeout:120000});await W(5000);
// ---- Today
const FEEDS=await require('./feeds.js')();console.log('feeds:',FEEDS.up?'up':'DOWN',FEEDS.why);if(FEEDS.up){await pg.waitForFunction(()=>D.news.length>0,{timeout:120000}).catch(()=>{});await pg.evaluate(()=>{try{paintToday()}catch(e){}});await W(1500)}
const T=await pg.evaluate(()=>({alt:document.querySelector('#altToday')?.innerText,clus:[...document.querySelectorAll('#todayBox .cl')].map(c=>c.innerText.replace(/\n/g,' | ')),
  news:[...document.querySelectorAll('#todayBox [data-nsb]')].map(b=>b.textContent),deriv:SIG.filter(s=>/^(fund|oicap)/.test(s.id)).map(s=>s.id+' '+s.score+' '+s.why),dvStale:typeof STALEM==='object'?Object.keys(STALEM).filter(k=>/^(BTC|ETH) (funding|oi)$/.test(k)):[]}));
// stale gate: when data/derivs.json is past its limit (data job late), the right behaviour is 'data stale' in the cluster and no funding/OI cards
if(T.dvStale.length)console.log('NOTE derivs.json stale in this run: '+T.dvStale.join(', ')+' -> checking the stale behaviour instead');
console.log(JSON.stringify(T,null,1));
ok(/B90/.test(T.alt||'')&&/B30/.test(T.alt||'')&&/ETH\/BTC/.test(T.alt||''),'Today altseason card shows B90, B30, ETH/BTC');
ok(/confidence \d+%/.test(T.alt||''),'Today alt card shows confidence');
ok(T.dvStale.includes('BTC oi')?T.clus.some(c=>/Open interest \(BTC\) \| data stale \(cache \d+[hd], /.test(c)):T.clus.some(c=>/Open interest rising/.test(c)&&!/derivs.json loading/.test(c)),'OI rising input filled in clusters (or data stale label when derivs.json is past its limit)');
ok(T.dvStale.length?(!T.deriv.some(x=>/^fundBTC/.test(x))||!T.dvStale.includes('BTC funding'))&&(!T.deriv.some(x=>/^oicapBTC/.test(x))||!T.dvStale.includes('BTC oi')):T.deriv.some(x=>/^fundBTC/.test(x))&&T.deriv.some(x=>/^oicapBTC/.test(x)),'funding and OI/market-cap signals in the engine (absent when their data is stale)');
const newsLive=T.news.length>=1||FEEDS.up;if(!newsLive)console.log('SKIP: feeds unreachable ('+FEEDS.why+') — news scores on Today / breakdown on tap; news scoring covered by tnewsfx');
if(newsLive)ok(T.news.length>=1,'news scores shown on Today');
await pg.screenshot({path:'c-today.png'});
// news breakdown on tap
await pg.evaluate(()=>document.querySelector('#todayBox [data-nsb]')?.click());await W(400);
const nb=await pg.evaluate(()=>document.querySelector('#todayBox .sbx.on')?.innerText||'');if(newsLive)ok(/Freshness/.test(nb)&&/Pickup/.test(nb)&&/Price reaction/.test(nb),'news score breakdown on tap');
// ---- alt full view
await pg.evaluate(()=>document.querySelector('#altToday').click());await W(1500);
const A=await pg.evaluate(()=>({tab:TAB,txt:document.querySelector('#altCard')?.innerText,cv:!!document.querySelector('#altCv'),A:(()=>{const a=altCalc();return{state:a.L.state,b90:a.L.b90,b30:a.L.b30,eb:a.L.eb,eb30:a.L.eb30,dma:a.L.dma,st30:a.L.st30,conf:a.conf,since:a.L.since,n:a.L.n,dom:a.domDays}})(),
  hist:(()=>{const a=altCalc(),c={};a.rows.forEach(r=>c[r.state]=(c[r.state]||0)+1);return c})(),exp:typeof exportPNG==='function'&&!!document.querySelector('[data-ax="4k"]')}));
console.log(JSON.stringify(A,null,1));
ok(A.tab==='markets'&&A.cv,'tap opens full altseason view in Markets with chart');
ok(['Altseason','Broadening','Early rotation','Weakening','BTC-led'].every(s=>A.txt.includes(s)),'all five states listed with checks');
ok(/✓|✗/.test(A.txt)&&/B90 ≥ 75% on 5 of the last 7 days/.test(A.txt),'thresholds and ✓/✗ shown');
ok(A.exp,'4K export available');
await pg.evaluate(()=>{const c=document.querySelector('#altCard');scrollTo(0,c.getBoundingClientRect().top+scrollY-56)});await W(500);await pg.screenshot({path:'c-alt.png'});
const AU=await pg.evaluate(async()=>(await auditAlt()).map(r=>r[0]+': '+r[1]));console.log(AU.join('\n'));ok(AU.length>=4&&!AU.some(x=>/^bad/.test(x)),'alt audit runs clean');
// ---- captions: alt, dd, perf, flows streak, vol; lint
const C=await pg.evaluate(()=>{const out={};const fam=(F)=>STY.map(([st])=>CAPT[F.fam][st].map(t=>tidy(t(F))).filter(Boolean));
  for(const [k,F] of [['alt',altFacts()],['dd',ddFacts('BTC')],['perf',perfFacts('BTC')],['etfbtc',NX.etf?etfFacts('btc'):null]])if(F)out[k]=fam(F);
  out.sigs=SIG.slice(0,6).map(s=>capFirst({kind:'sig',id:s.id},s));out.lead=capFirst({kind:'mac',id:'lead'});
  out.lint1=lintBanned('Altseason starts here.');out.lint2=lintBanned('BTC daily close at $77k',null,true);out.lint3=lintBanned('BTC daily close at $77k',null,false);out.eb=SIG.find(s=>s.id==='ethbtc')?.cap;return out});
console.log(JSON.stringify(C,null,1));
const all=[C.alt,C.dd,C.perf,C.etfbtc,C.sigs,[C.lead]].filter(Boolean).flat(2).filter(x=>typeof x==='string');
ok(C.alt&&C.alt.every(a=>a.length>=4),'alt family: 4 templates per style');ok(C.dd&&C.dd.every(a=>a.length>=4),'drawdown family: 4 per style');ok(C.perf&&C.perf.every(a=>a.length>=4),'performance family: 4 per style');
{const bad=all.filter(t=>BAN.some(r=>r.test(t)));if(bad.length)console.log('BANNED HIT',bad);ok(!bad.length,'no banned phrases / calls in generated captions')}
ok(C.lint1.length>0,'lint blocks "starts here"');ok(C.lint2.some(x=>/unfinished/.test(x))&&!C.lint3.some(x=>/unfinished/.test(x)),'open-candle "close" rule');
ok(/^BTC is [\d.]+% below its \$[\d.]+k all-time high/.test(C.dd[0][0]),'drawdown caption in reference style');
// ---- Macro
await pg.evaluate(()=>tab('macro'));await pg.waitForFunction(()=>document.querySelector('#forceCard'),{timeout:60000});await W(2500);
const M=await pg.evaluate(()=>({tiles:[...document.querySelectorAll('#macTiles .stat .k')].map(x=>x.textContent),cards:MAC.cards.map(c=>c.id),force:[...document.querySelectorAll('#forceCard .rec')].map(r=>r.innerText.replace(/\n/g,' | ')),
  ll:MAC.ll&&{crit:MAC.ll.crit,best:MAC.ll.best,bestC:MAC.ll.bestC,verdict:MAC.ll.verdict,cc:!!MAC.ll.llc},leadTxt:document.querySelector('[data-mcard="lead"]')?.innerText,chip:marketStates().find(m=>m.k==='Macro')?.why,real:(MAC.items||[]).find(i=>i.id==='real')?.why}));
console.log(JSON.stringify(M,null,1));
ok(['TGA','ON RRP','US 2Y yield','2s10s spread','US net liquidity'].every(k=>M.tiles.some(t=>t.toLowerCase().includes(k.toLowerCase()))),'TGA/RRP/2Y/2s10s/net liquidity tiles');
ok(['netliq','tgarrp','curve'].every(k=>M.cards.includes(k)),'net liquidity vs BTC, TGA/RRP and curve cards');
ok(M.force.length>=5,'forces card ranks ≥5 forces');
await pg.evaluate(()=>document.querySelector('#forceCard [data-tg="force|m"]').click());await W(300);ok(await pg.evaluate(()=>document.querySelector('[data-tgx="force|m"]').classList.contains('on')),'forces methodology on tap');
ok(M.ll&&M.ll.cc&&M.ll.crit>0.18&&M.ll.crit<0.23,'lead-lag shows constant FX and computed Bonferroni threshold');
ok(/Const FX/.test(M.leadTxt||'')&&/Bonferroni/.test(M.leadTxt||''),'lead-lag card table + threshold text');
ok(/constant FX/.test(M.chip||''),'Macro chip uses constant-FX M2');
ok(/since (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(M.real||''),'real yield item names its window start');
await pg.evaluate(()=>scrollTo(0,0));await W(300);await pg.screenshot({path:'c-macro.png'});
await pg.evaluate(()=>{const c=document.querySelector('[data-mcard="lead"]');scrollTo(0,c.getBoundingClientRect().top+scrollY-56)});await W(400);await pg.screenshot({path:'c-lead.png'});
// studio dd/perf
await pg.evaluate(()=>{tab('studio');$('#stType').value='perf';$('#stType').onchange()});await W(1500);const sp=await pg.evaluate(()=>$('#draft')?.value);console.log('perf caption:',sp);ok(/Q3 2026|September 2026/.test(sp||''),'studio perf caption');
await pg.evaluate(()=>{$('#stType').value='dd';$('#stType').onchange()});await W(1200);const sd=await pg.evaluate(()=>$('#draft')?.value);console.log('dd caption:',sd);ok(/all-time high|ATH|off/.test(sd||''),'studio drawdown caption');
console.log('\npageerrors:',e);ok(!e.length,'no page errors');console.log('\nFAILS:',fails.length,JSON.stringify(fails));await b.close()})();
