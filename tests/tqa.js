// tqa.js — hostile QA regression: team findings, USD-only, numbers, captions, failure modes, a11y, perf
const p=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));const fs=require('fs');
const URL=process.env.URL||'http://localhost:8765/index.html';const DATA=process.env.DATA||'/workspace/rp-terminal/data';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x&&!c?' :: '+JSON.stringify(x).slice(0,600):''));if(!c)F.push(n)};
const TABS=['today','markets','chart','signals','macro','news','studio'];
const ready=pg=>pg.waitForFunction(()=>{try{return SIG&&SIG.length&&MK&&MAC.items&&NX.etf}catch(e){return false}},{timeout:150000});
async function newPage(b,vp=[412,915]){const pg=await b.newPage();await pg.setViewport({width:vp[0],height:vp[1],isMobile:vp[0]<700,hasTouch:true});const E={page:[],rej:[]};pg.on('pageerror',x=>E.page.push(x.message));
  await pg.evaluateOnNewDocument(()=>{window.__rej=[];addEventListener('unhandledrejection',e=>__rej.push(String(e.reason&&e.reason.stack||e.reason).slice(0,200)))});pg.E=E;return pg}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const FEEDS=await require('./feeds.js')();console.log('feeds:',FEEDS.up?'up':'DOWN',FEEDS.why);const J=f=>JSON.parse(fs.readFileSync(`${DATA}/${f}.json`));const mac=J('macro'),etf=J('etf');

// ---------- 1. USD-only migration: saved INR settings become USD, no toggle
{const pg=await newPage(b);await pg.evaluateOnNewDocument(()=>{if(!sessionStorage.x){sessionStorage.x=1;localStorage.rpt=JSON.stringify({cur:'inr',theme:'neo'})}});await pg.goto(URL);await ready(pg);await W(2500);
 const r=await pg.evaluate(()=>({cur:S.cur,saved:JSON.parse(localStorage.rpt).cur,btn:!!document.getElementById('curBtn'),cs:CS(),loc:LOC(),R:R(),tk:document.getElementById('tkIn').innerText}));
 ok(r.cur==='usd'&&r.saved==='usd','saved INR setting migrated to USD',r);ok(!r.btn,'currency toggle removed',r);ok(r.cs==='$'&&r.R===1&&r.loc==='en-US','money helpers USD-only',r);ok(!/₹|INR/.test(r.tk),'ticker has no rupee prices',r.tk.slice(0,80));
 const net=await pg.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/vs_currency=inr|open\.er-api|frankfurter/i.test(u)));ok(!net.length,'app makes no INR price/FX requests',net);await pg.close()}

const pg=await newPage(b);await pg.evaluateOnNewDocument(()=>{window.__lt=[];try{new PerformanceObserver(l=>l.getEntries().forEach(e=>__lt.push(Math.round(e.duration)))).observe({type:'longtask',buffered:true})}catch(e){}
  const si=window.setInterval,ci=window.clearInterval;window.__iv=new Set();window.setInterval=function(f,t,...a){const id=si(f,t,...a);__iv.add(id);return id};window.clearInterval=function(id){__iv.delete(id);return ci(id)}});
const t0=Date.now();await pg.goto(URL);const tDom=Date.now()-t0;await ready(pg);const tReady=Date.now()-t0;await W(3000);

// ---------- 2. Team findings: lint
{const r=await pg.evaluate(()=>{const L=(t,o)=>lintBanned(t,'',o);const must=['Altseason has begun','altseason is here','BTC will hit $150k','ETH will reach 10k','Our price target is 120k','The bottom is in','This is the top','Going parabolic','Send it','WAGMI','Last chance to buy','A generational entry','Up 5% today. NFA 🚀','Altseason starts here'];
  const allow=['Altseason index is at 41','alt season indicators are mixed','BTC is close to $90k','Getting closer to the high','BTC +3% in Q3'];
  return{must:must.filter(t=>!L(t).length),allow:allow.filter(t=>L(t,true).length).map(t=>[t,L(t,true)]),closeOpen:L('BTC daily close at $84k',true).length>0}});
 ok(!r.must.length,'lint blocks every listed call phrase',r.must);ok(!r.allow.length,"lint allows 'alt season' and 'close to'/'closer'",r.allow);ok(r.closeOpen,'lint still flags "close" on the unfinished candle')}

// ---------- 3. Team findings: highest/lowest since (strict, ties)
{const r=await pg.evaluate(()=>{const d=i=>Date.UTC(2024,0,1+i);const a=rarity([10,8,9,7,9],[0,1,2,3,4].map(d)),b2=rarity([9,8,7,9],[0,1,2,3].map(d)),c=rarity([5,8,7,9],[0,1,2,3].map(d)),lo=rarity([3,5,4,6,4],[0,1,2,3,4].map(d),true);
  return{a:[a.since,a.tie,sinceStr(a,'highest')],b:[b2.since,b2.tie,sinceStr(b2,'highest')],c:[c.since,c.tie,sinceStr(c,'highest')],lo:[lo.since,lo.tie,sinceStr(lo,'lowest')],D:[0,1,2,3,4].map(d)}});
 ok(r.a[0]===r.D[0]&&r.a[1]===r.D[2]&&/since 1 Jan 2024, matching 3 Jan 2024/.test(r.a[2]),'since = last strictly higher value; tie printed as "matching <date>"',r.a);
 ok(r.b[0]==null&&r.b[1]===r.D[0]&&/record highest.*matching 1 Jan 2024/.test(r.b[2]),'tie with the record is "matching", not a new record',r.b);
 ok(r.c[0]==null&&r.c[1]==null&&/highest in the data/.test(r.c[2]),'true record has no tie',r.c);ok(r.lo[0]===r.D[0]&&r.lo[1]===r.D[2],'lowest-since strict + tie',r.lo)}

// ---------- 4. Team findings: ETF streak caption, pending rows, numbers
{const r=await pg.evaluate(()=>{const old=window.etfStreak;window.etfStreak=()=>({k:5,s:1840.2,L:-148.7});const out=[];for(const a of ['btc','eth'])for(const [st] of STY)CAPT.flows[st].forEach(t=>out.push(tidy(t(etfFacts(a)))));window.etfStreak=old;return out.filter(Boolean)});
 ok(!r.some(t=>/noise/i.test(t)),'ETF streak captions drop "one red day ... is noise"',r.filter(t=>/noise/i.test(t)))}
{const ds=etf.datasets||etf;const r=await pg.evaluate(()=>{tab('news');return new Promise(res=>setTimeout(()=>res(document.querySelector('#nxEtf')?.innerText||document.body.innerText),2500))});
 for(const a of ['btc','eth']){const D=(ds[a]||ds[a.toUpperCase()]);if(!D)continue;const rows=(D.days||D.rows||D).filter(x=>!x.pending&&x.total!=null);const L=rows.at(-1),s7=rows.slice(-7).reduce((s,x)=>s+x.total,0),s30=rows.slice(-30).reduce((s,x)=>s+x.total,0);
  const fm=v=>(v<0?'-':'+')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+'M';
  ok(r.includes(fm(L.total).replace('+',''))||r.includes(fm(L.total)),`ETF ${a} latest completed day shown (${L.date} ${L.total})`,r.slice(0,300));ok(r.includes('7d '+fm(s7))&&r.includes('30d '+fm(s30)),`ETF ${a} 7d/30d sums recomputed`,{s7,s30,txt:r.slice(0,300)});
  const pend=(D.days||D.rows||D).filter(x=>x.pending).map(x=>x.date);ok(!pend.length||pend.every(d=>d>L.date),`ETF ${a} pending rows only after last completed day`,pend)}}

// ---------- 5. Team findings: news classification, headline-only $ amounts, lead-story merge
{const r=await pg.evaluate(()=>{const o={};o.op1=isOpinion('Bitcoin will reclaim $90k as ETFs buy');o.op2=isOpinion('Why bitcoin could crash');o.op3=isOpinion('Is this the top?');
  o.d1=isData('Bitcoin ETFs bleed $300M');o.d2=isData('ETH ETFs snap 9-day streak');o.d3=isData('ETF pull: $1.2B');o.d4=isData('ETF issuers file new S-1');
  const keep=D.news,t=Date.now();D.news=[{title:'BlackRock bitcoin ETF sees $500M inflow',desc:'',src:'A',t:t-1e6,link:'a'},{title:'Fidelity fund draws new money',desc:'BlackRock ETF also took $500M',src:'B',t:t-9e5,link:'b'},
    {title:'BlackRock bitcoin ETF $500M inflow tops week',desc:'',src:'C',t:t-8e5,link:'c'}];
  let cl=[];try{cl=newsClusters()}catch(e){o.err=e.message}D.news=keep;o.cl=cl.map(c=>c.items.map(x=>x.link).join(''));o.amt=cl.map(c=>Math.round(c.amt||0));
  return o});
 ok(!r.op1&&r.op2&&r.op3,"isOpinion ignores bare 'will', keeps could/?",r);ok(r.d1&&r.d2&&r.d3&&!r.d4,'isData matches ETF bleed/snap/streak/$amount',r);
 ok(r.cl.includes('ac')&&!r.cl.some(c=>c.includes('b')&&c.length>1),'merge uses headline $ amounts and compares with the lead story',r.cl)}

// ---------- 6. Team findings: altseason label, vol exchange, macro as-of, net liquidity method
{const r=await pg.evaluate(async()=>{tab('markets');renderAlt();await new Promise(r=>setTimeout(r,800));const c=document.getElementById('altCard'),t=c.innerText;const b=c.querySelector('[data-tg="alt|sk"]');b&&b.click();await new Promise(r=>setTimeout(r,300));
  return{t,after:document.getElementById('altCard').innerText,u:altUniv()}});
 ok(/Top \d+ coins trading on Binance\/OKX \(down to rank \d+\)/.test(r.t),'altseason label names universe and rank cutoff',r.t.slice(0,300));ok(new RegExp(`${r.u.sk.length} skipped \\(no data\\)`).test(r.t),'altseason shows K skipped (no data)',r.u);
 ok(!r.u.sk.length||r.u.sk.every(x=>r.after.includes(x.sym)),'skipped names revealed on tap',r.u.sk)}
{const r=await pg.evaluate(()=>SIG.filter(s=>/^rv/.test(s.id)).map(s=>({id:s.id,title:s.title,caps:STY.flatMap(([st])=>CAPT[sigFacts(s).fam][st].map(f=>tidy(f(sigFacts(s))))).filter(Boolean)})));
 ok(r.length&&r.every(x=>/Binance/.test(x.title)),'volatility cards name the exchange in the title',r.map(x=>x.title));ok(r.every(x=>x.caps.every(c=>/Binance/.test(c))),'every vol caption names Binance closes',r.flatMap(x=>x.caps.filter(c=>!/Binance/.test(c))))}
{const r=await pg.evaluate(async()=>{tab('macro');await new Promise(r=>setTimeout(r,3500));return[...document.querySelectorAll('#s-macro .card')].filter(c=>c.querySelector('canvas[data-mg]')).map(c=>({h:c.querySelector('h3')?.innerText.split('\n')[0],t:c.innerText}))});
 ok(r.length>=8&&r.every(c=>/As of (\d{1,2} \w+ \d{4}|\w+ \d{4})/.test(c.t)),'every macro card prints "As of <date>"',r.filter(c=>!/As of/.test(c.t)).map(c=>c.h));
 const nl=r.find(c=>/net liquidity/i.test(c.h));const P=mac.net_liquidity.points.at(-1);
 ok(nl&&/Wednesday TGA level \(WDTGAL\)/.test(nl.t),'net liquidity card states method (WALCL − WDTGAL − ON RRP)',nl&&nl.t.slice(0,400));
 const sp=(mac.net_liquidity.rrp_quarter_end_spikes||[]).some(x=>x.date===P[0]);ok(!sp||(nl&&/quarter-end spike/.test(nl.t)),'RRP quarter-end spike note on net liquidity card',sp);
 ok(Math.abs(P[1]-(P[2]-P[3]-P[4]))<0.2,'net liquidity = WALCL − TGA − RRP in data',P);
 const fred=['WALCL','WDTGAL','DGS10','DGS2'].map(k=>[k,mac.series[k]?.last_date]);ok(fred.every(([k,d])=>d>='2026-09-30'),'30 Sep values landed for daily/weekly FRED series',fred)}
// ---------- 7. Captions: all families × 3 styles
{if(FEEDS.up)await pg.waitForFunction(()=>D.news.length>0,{timeout:90000}).catch(()=>{});
const r=await pg.evaluate(()=>{const ctxs=[{kind:'alt'},{kind:'etf',a:'btc'},{kind:'etf',a:'eth'},{kind:'dd',a:'BTC'},{kind:'perf',a:'BTC'},...SIG.map(s=>({kind:'sig',id:s.id})),...MAC.cards.map(c=>({kind:'mac',id:c.id})),...['price','insight','pulse','chart','heat'].map(t=>({kind:'studio',t,coin:stCoin()})),...D.news.slice(0,15).map(n=>({kind:'news',n}))];
  const bad=[],cnt={n:0};for(const c of ctxs){let Fx;try{Fx=capFacts(c)}catch(e){bad.push([c.kind+':'+(c.id||c.a||c.t||''),'facts error '+e.message]);continue}if(!Fx){bad.push([c.kind+':'+(c.id||c.a||c.t||''),'no facts']);continue}
   for(const [st] of STY){const pk=capPick(Fx,st,-1,mb32(1)).t;cnt.n++;const L=lintBanned(pk,Fx.title,Fx.open);const why=[];if(!pk)why.push('empty');if(xLen(pk)>280)why.push('>280 '+xLen(pk));if(L.length)why.push(L.join('|'));if(/undefined|NaN|Infinity|\bnull\b|\$-(?!\d)/.test(pk))why.push('bad token');if(/India|\bINR\b|₹|CoinDCX|rupee|crore/i.test(pk))why.push('india');
    for(const f of CAPT[Fx.fam][st]){const t=tidy(f(Fx));if(t&&(/undefined|NaN|Infinity|\bINR\b|₹|CoinDCX/.test(t)||/India|rupee|crore/i.test(t)))why.push('template bad: '+t.slice(0,80))}if(why.length)bad.push([c.kind+':'+(c.id||c.a||c.t||'')+':'+st,why.join('; '),pk.slice(0,120)])}}return{bad,n:cnt.n,k:ctxs.length}});
 const nNews=await pg.evaluate(()=>Math.min(15,D.news.length));if(!nNews&&!FEEDS.up)console.log('SKIP: feeds unreachable ('+FEEDS.why+') — live news captions not in this sweep; news captions are covered by tnewsfx fixtures');
 ok(r.n>=(nNews||FEEDS.up?150:100)&&!r.bad.length,`all captions (${r.k} cards × 3 styles = ${r.n}) lint-clean, ≤280, no bad tokens, no rupee`,r.bad)}

// ---------- 8. DOM sweep: every tab × theme — no ₹/INR (except India source note + raw headline links), no bad tokens, a11y
{const out=[];for(const th of ['neo','sap','ch','bb']){await pg.evaluate(t=>applyTheme(t),th);for(const t of TABS){await pg.evaluate(t=>{tab(t);scrollTo(0,0)},t);await W(t==='macro'||t==='signals'?2500:1200);
  const r=await pg.evaluate(()=>{const sec=document.querySelector('section.on');const skip=e=>e.tagName==='SCRIPT'||e.tagName==='STYLE';
   const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const rup=[],bad=[];let n;while((n=tw.nextNode())){const e=n.parentElement;if(!e||!e.offsetParent&&e.tagName!=='BODY')continue;const s=n.textContent;if(/India|\bINR\b|₹|CoinDCX|rupee|crore/i.test(s)&&!skip(e))rup.push(s.trim().slice(0,80));if(/\bNaN\b|\bundefined\b|Infinity|\bnull\b|\$-(?!\d)/.test(s))bad.push(s.trim().slice(0,80))}
   const vals=[...sec.querySelectorAll('textarea,input:not([type=range])')].map(e=>e.value).filter(v=>/India|\bINR\b|₹|CoinDCX|rupee|crore/i.test(v));
   const a11y=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&!b.textContent.trim()&&!b.getAttribute('aria-label')).length;const cv=[...sec.querySelectorAll('canvas')].filter(c=>!c.getAttribute('aria-label')).length;const imgs=[...document.querySelectorAll('img:not([alt])')].length;
   return{rup:rup.concat(vals),bad,a11y,cv,imgs}});out.push([th,t,r])}}
 const f=k=>out.filter(x=>x[2][k].length||x[2][k]>0).map(x=>[x[0],x[1],x[2][k]]);
 ok(!f('rup').length,'no India/INR/₹/CoinDCX/rupee/crore in rendered text, fields or drafts on any tab/theme',f('rup'));ok(!f('bad').length,'no NaN/undefined/null/Infinity/$- in DOM',f('bad'));
 ok(!f('a11y').length&&!f('cv').length&&!f('imgs').length,'buttons named, canvases labelled, images have alt',[f('a11y'),f('cv'),f('imgs')]);
 const lang=await pg.evaluate(()=>document.documentElement.lang);ok(!!lang,'html lang set',lang);
 const nav=await pg.evaluate(()=>[...document.querySelectorAll('nav button')].map(b=>b.getAttribute('aria-label')));ok(new Set(nav).size===7&&nav.every(Boolean),'nav labels unique and present',nav);
 await pg.evaluate(()=>{applyTheme('neo');tab('today');document.querySelector('nav button').focus()});await pg.keyboard.press('ArrowRight');await pg.keyboard.press('Enter');await W(800);
 const kb=await pg.evaluate(()=>document.querySelector('section.on').id);ok(kb==='s-markets','keyboard: arrow + Enter switches tabs',kb);await pg.keyboard.press('F5');await W(800);ok(await pg.evaluate(()=>document.querySelector('section.on').id)==='s-macro','F-key shortcuts match the Bloomberg labels')}

// ---------- 9. Performance + leaks
{const r=await pg.evaluate(()=>({lt:__lt,iv:__iv.size,nav:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,mem:performance.memory?.usedJSHeapSize}));
 for(let i=0;i<5;i++){await pg.evaluate(()=>refresh());await W(4000)}const r2=await pg.evaluate(()=>({iv:__iv.size,mem:performance.memory?.usedJSHeapSize}));
 console.log('perf',{tDom,tReady,dcl:Math.round(r.nav),longTasks:r.lt.length,maxLong:Math.max(0,...r.lt),iv:[r.iv,r2.iv],memMB:[r.mem/1e6|0,r2.mem/1e6|0]});
 ok(r.nav<3000,'DOMContentLoaded under 3s',r.nav);ok(r2.iv<=r.iv,'no interval leak across 5 refreshes',[r.iv,r2.iv]);ok(r2.mem<r.mem*1.6+20e6,'no large heap growth across refreshes',[r.mem,r2.mem])}
ok(!pg.E.page.length,'no page errors',pg.E.page);ok(!(await pg.evaluate(()=>__rej)).length,'no unhandled rejections',await pg.evaluate(()=>__rej));await pg.close();


// ---------- 11. ETF dominant fund from Farside header-mapped per-fund flows
{const D=etf.datasets.btc;ok(D.funds.length>=10&&D.days.slice(-30).every(d=>Object.keys(d.funds).join()===D.funds.join()),'etf.json stores per-fund flows keyed by Farside header tickers',D.funds);
 const L=D.days.filter(d=>!d.pending&&d.total!=null).at(-1);let dom=null;for(const [k,v] of Object.entries(L.funds))if(v!=null&&Math.sign(v)===Math.sign(L.total)&&(!dom||Math.abs(v)>Math.abs(dom[1])))dom=[k,v];if(dom&&Math.abs(dom[1])<0.6*Math.abs(L.total))dom=null;
 const q=await newPage(b);await q.goto(URL);await q.waitForFunction(()=>{try{return NX.etf}catch(e){return false}},{timeout:90000});await q.evaluate(()=>tab('news'));await W(2500);
 const r=await q.evaluate(()=>({cap:tidy(CAPT.flows.simple[0](etfFacts('btc'))),card:document.getElementById('nxEtf')?.innerText||document.body.innerText}));
 if(dom){ok(r.cap.includes(`$${Math.abs(dom[1]).toFixed(1)}M of it from ${dom[0]}`)&&/from \$BTC ETFs on/.test(r.cap)&&/Farside\.$/.test(r.cap),`ETF caption names ${dom[0]} (≥60% of the day)`,r.cap);ok(r.card.includes(`${dom[0]}: `),'ETF card names the dominant fund',r.card.slice(0,300))}
 else ok(!/of it from/.test(r.cap),'ETF caption names no fund when none is ≥60%',r.cap);
 // swap: make IBIT dominate instead → caption must follow the data
 const m2=JSON.parse(JSON.stringify(etf));const L2=m2.datasets.btc.days.filter(d=>!d.pending&&d.total!=null).at(-1);for(const k in L2.funds)L2.funds[k]=0;L2.funds.IBIT=-120;L2.funds.ARKB=-28.7;L2.total=-148.7;
 await q.setRequestInterception(true);q.on('request',x=>x.url().includes('data/etf.json')?x.respond({status:200,contentType:'application/json',body:JSON.stringify(m2)}):x.continue());await q.reload();await q.waitForFunction(()=>{try{return NX.etf}catch(e){return false}},{timeout:90000});
 const c2=await q.evaluate(()=>tidy(CAPT.flows.simple[0](etfFacts('btc'))));ok(/\$120\.0M of it from IBIT/.test(c2),'ETF dominant fund follows etf.json (IBIT case)',c2);
 for(const k in L2.funds)L2.funds[k]=0;L2.funds.IBIT=-70;L2.funds.FBTC=-78.7;
 await q.reload();await q.waitForFunction(()=>{try{return NX.etf}catch(e){return false}},{timeout:90000});const c3=await q.evaluate(()=>tidy(CAPT.flows.simple[0](etfFacts('btc'))));ok(!/of it from/.test(c3),'no fund named when the largest is under 60%',c3);await q.close()}

// ---------- 12. No India anywhere: data/ files, news filter, storage migration
{const bad=[];for(const f of fs.readdirSync(DATA)){const t=fs.readFileSync(`${DATA}/${f}`,'utf8');const m=t.match(/India|\bINR\b|₹|CoinDCX|rupee|crore/i);if(m||/india/i.test(f))bad.push([f,m&&m[0]])}ok(!bad.length,'data/ directory has no India/INR/₹/CoinDCX/rupee/crore (and no india.json)',bad)}
{const q=await newPage(b);await q.setRequestInterception(true);let served=0;
 q.on('request',x=>{if(x.url().includes('api.rss2json.com')){served++;const t=new Date().toISOString().replace('T',' ').slice(0,19);x.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({status:'ok',items:[
   {title:'India mulls new crypto tax rules',link:'https://x/1',pubDate:t,description:'Finance ministry weighs changes.'},{title:'Exchange raises ₹435 crore',link:'https://x/2',pubDate:t,description:''},
   {title:'WazirX resumes withdrawals',link:'https://x/3',pubDate:t,description:''},{title:'Bitcoin ETF inflows top $500M',link:'https://x/4',pubDate:t,description:'Regulator SEBI comments'},
   {title:'Ether ETF flows turn positive',link:'https://x/5',pubDate:t,description:'Daily net inflows across funds.'}]})})}else x.continue()});
 await q.evaluateOnNewDocument(()=>{if(!sessionStorage.y){sessionStorage.y=1;localStorage.rpd_india='{"latest":{}}';localStorage.rpt=JSON.stringify({cur:'inr'})}});
 await q.goto(URL);await q.waitForFunction(()=>{try{return D.news.length>0}catch(e){return false}},{timeout:90000}).catch(()=>{});await q.evaluate(()=>tab('news'));await W(2500);
 const r=await q.evaluate(()=>({titles:D.news.map(n=>n.title),dom:document.getElementById('s-news').innerText,keys:Object.keys(localStorage),cur:S.cur,fn:typeof deRupee,ind:'ind' in NX?'present':'undefined'}));
 ok(served>0&&r.titles.includes('Ether ETF flows turn positive')&&!r.titles.some(t=>/India|₹|WazirX|top \$500M/.test(t)),'runtime news filter drops injected India/rupee/WazirX/SEBI items before display',r.titles);
 ok(!/India|₹|WazirX|crore/i.test(r.dom),'injected India headlines absent from News DOM',r.dom.slice(0,300));
 ok(!r.keys.some(k=>/india|inr/i.test(k))&&r.cur==='usd','cached india data and INR settings removed from storage on load',r.keys);ok(r.fn==='undefined'&&r.ind==='undefined'||r.ind==='object'&&false,'rupee conversion and India state removed',[r.fn,r.ind]);await q.close()}
if(process.env.LIVE){const res=await fetch(process.env.LIVE.replace(/\/?$/,'/')+'data/india.json?x='+Date.now());ok(res.status===404,'data/india.json 404s on Pages',res.status)}
// ---------- 10. Failure modes: each data file missing, all third-party APIs down, offline after load, slow network
const sweep=async(name,setup,after)=>{const q=await newPage(b);await setup(q);let loaded=true;try{await q.goto(URL,{timeout:90000})}catch(e){loaded=false}await W(after||9000);
  const r=[];for(const t of TABS){try{await q.evaluate(t=>{tab(t)},t);await W(1500);r.push(await q.evaluate(()=>{const s=document.querySelector('section.on');const txt=s.innerText.trim();const empty=[...s.querySelectorAll('.card')].filter(c=>c.offsetParent&&c.innerText.trim().length<8).length;return{id:s.id,len:txt.length,empty,bad:/\bNaN\b|\bundefined\b|\bnull\b|\$-(?!\d)/.test(txt)}}))}catch(e){r.push({err:e.message})}}
  const rej=await q.evaluate(()=>__rej).catch(()=>['eval failed']);ok(loaded&&!q.E.page.length&&!rej.length&&r.every(x=>!x.err&&x.len>40&&!x.empty&&!x.bad),`failure mode: ${name} → no crash, no blank cards`,{page:q.E.page,rej,r:r.filter(x=>x.err||x.len<=40||x.empty||x.bad)});await q.close()};
for(const f of ['macro','etf','derivs','market','calendar'])await sweep(`data/${f}.json 500`,async q=>{await q.setRequestInterception(true);q.on('request',x=>x.url().includes(`data/${f}.json`)?x.respond({status:500,body:'err'}):x.continue())});
await sweep('data/macro.json truncated JSON',async q=>{await q.setRequestInterception(true);q.on('request',x=>x.url().includes('data/macro.json')?x.respond({status:200,contentType:'application/json',body:'{"series":{'}):x.continue())});
await sweep('all third-party APIs blocked',async q=>{await q.setRequestInterception(true);q.on('request',x=>new (require('url').URL)(x.url()).hostname===new (require('url').URL)(URL).hostname?x.continue():x.abort('failed'))},15000);
await sweep('offline after load',async q=>{q.once('load',async()=>{await W(6000);await q.setOfflineMode(true);await q.evaluate(()=>refresh()).catch(()=>{})})},15000);
await sweep('slow 3G',async q=>{const c=await q.target().createCDPSession();await c.send('Network.enable');await c.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:20000})},30000);
console.log('\nFAILS:',F.length,F);await b.close();process.exit(F.length?1:0)})();
