// tetfstale.js (narrow no-rollback ruling, 12 Nov): the ETF stale label carries through to Studio. Frozen gate (node -r ./freeze/preload.js).
// Fixture = frozen etf.json (T0 Sat 24 Oct 2026 15:26Z) with BTC cut back to Fri 16 Oct (5 NYSE trading days after its last complete day, past
// the 2-day limit of #45's etfFundState = stale) and ETH left at Thu 22 Oct (fresh): BTC and ETH are judged separately (17 Nov ruling).
// (e) the ETF card shows its stale label (header + the BTC column, not ETH); (d) a stale ETF figure stays out of Studio captions and every export
// path, and the 🛡 Audit fails on it; fresh ETH still captions, exports and audits normally. Control: the unmodified frozen file shows no stale label.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,900):''));if(!c)F.push(n)};
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/frozen/data/etf.json'),'utf8'));
function staleBtc(){const E=JSON.parse(JSON.stringify(BASE));const d=E.datasets.btc;d.days=d.days.filter(x=>x.date<='2026-10-16');d.last_date='2026-10-16';/* fresh run stamps must not make it fresh */E.checked_at=E.light_checked_at=E.updated;return E}
async function run(name,E){const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const pg=await b.newPage();await pg.setViewport({width:412,height:915});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.setRequestInterception(true);const body=JSON.stringify(E);
 pg.on('request',q=>{if(/\/data\/etf\.json/.test(q.url()))return q.respond({status:200,contentType:'application/json',body});return q.continue()});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return typeof tab==='function'&&typeof etfAStale==='function'}catch(e){return false}},{timeout:60000}).catch(()=>{});
 await pg.evaluate(()=>tab('news'));await pg.waitForFunction(()=>{try{return !!(NX.etf&&document.querySelector('#nxEtf .card'))}catch(e){return false}},{timeout:60000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,1500));
 const r=await pg.evaluate(async()=>{const o={};const card=document.querySelector('#nxEtf .card');
  o.sw={btc:etfAStale('btc'),eth:etfAStale('eth')};o.head=card?card.querySelector('h3').innerText:'';o.note=card?card.querySelector('small.note').innerText:'';
  o.colStale=[...document.querySelectorAll('#nxEtf [data-etf-stale="1"]')].map(e=>e.dataset.etf);
  const fig=a=>{const s=etfStats(NX.etf,a);return s&&s.L?fM(s.L.total,0):null};o.fig={btc:fig('btc'),eth:fig('eth')};
  // count every export: render8k is what every PNG path (8K, 4K, Share) goes through
  let n=0;const r8=window.render8k;window.render8k=function(...a){n++;throw new Error('test: export blocked here')};window.__n=()=>n;
  const exp=async(fn)=>{const k=n;try{fn()}catch(e){}await new Promise(r=>setTimeout(r,400));return n-k};
  o.btn={};MAC.etfA='btc';renderEtf();for(const k of ['share','4k','cap']){const el=document.querySelector(`#nxEtf [data-ex="${k}"]`);o.btn['btc_'+k]={dis:!!(el&&el.disabled),exp:await exp(()=>el&&el.dispatchEvent(new MouseEvent('click',{bubbles:true})))}}
  MAC.etfA='eth';renderEtf();{const el=document.querySelector('#nxEtf [data-ex="4k"]');o.btn.eth_4k={dis:!!(el&&el.disabled),exp:await exp(()=>el&&el.dispatchEvent(new MouseEvent('click',{bubbles:true})))}}
  const studio=async a=>{openCaptions({kind:'etf',a});await new Promise(r=>setTimeout(r,800));makeDraft(true);const box=document.querySelector('#capBox');
   const x={capFor:document.querySelector('#capFor').textContent,ta:[...box.querySelectorAll('textarea')].map(t=>t.value),box:box.innerText,stale:!!box.querySelector('[data-etfstale]')};
   x.exp={};for(const id of ['stExp','stX','stShare'])x.exp[id]=await exp(()=>document.getElementById(id).onclick());return x};
  o.st={btc:await studio('btc'),eth:await studio('eth')};
  window.render8k=r8;
  // Audit: the BTC ETF caption text (as it would be if pasted or left from before the feed went stale) must fail while BTC is stale
  const aud=async a=>{CAPCTX={kind:'etf',a};NEWSPICK=null;let ta=document.getElementById('draft');if(!ta){ta=document.createElement('textarea');ta.id='draft';document.body.appendChild(ta)}ta.value=etfCap(a);
   await runDraftAudit('draft','Simple');const el=document.querySelector('#audit');const vd=el&&el.querySelector('.vd');const res={vd:vd?vd.className:'',txt:el?el.innerText:''};if(el)el.classList.remove('on');return res};
  o.aud={btc:await aud('btc'),eth:await aud('eth')};return o});
 await b.close();return{name,...r,errs}}
// (g) 17 Nov ruling: a pending row's partial values (IBIT filled, even a partial total while still flagged pending) never reach the page card,
// Studio, a caption (every template), an export (fillText of every ETF render) or the Audit.
const MARK=['876.5','4,321.9','4321.9','765.4'];
function pendingMarked(){const E=JSON.parse(JSON.stringify(BASE));const pb=E.datasets.btc.days.at(-1),pe=E.datasets.eth.days.at(-1);
 if(!pb.pending||!pe.pending)throw new Error('frozen etf.json newest rows are expected to be pending');pb.funds.IBIT=-876.5;pb.total=-4321.9;pe.funds.ETHA=765.4;return E}
async function runPending(){const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const pg=await b.newPage();await pg.setViewport({width:412,height:915});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.setRequestInterception(true);const body=JSON.stringify(pendingMarked());
 pg.on('request',q=>{if(/\/data\/etf\.json/.test(q.url()))return q.respond({status:200,contentType:'application/json',body});return q.continue()});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return typeof tab==='function'&&typeof etfAStale==='function'}catch(e){return false}},{timeout:60000}).catch(()=>{});
 await pg.evaluate(()=>tab('news'));await pg.waitForFunction(()=>{try{return !!(NX.etf&&document.querySelector('#nxEtf .card'))}catch(e){return false}},{timeout:60000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,1500));
 const r=await pg.evaluate(async()=>{const rows=[];const P=CanvasRenderingContext2D.prototype,of=P.fillText;let log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
  for(const a of ['btc','eth']){MAC.etfA=a;renderEtf();rows.push(['card '+a,document.querySelector('#nxEtf').innerText]);
   const F=capFacts({kind:'etf',a});rows.push(['facts '+a,JSON.stringify(F)]);for(const [st] of STY)(CAPT[F.fam][st]||[]).forEach((fn,i)=>{try{rows.push([`caption ${a} ${st}#${i}`,String(tidy(fn(F))||'')])}catch(e){}});
   rows.push(['etfCap '+a,etfCap(a)]);
   log=[];try{render8k((x,W,H)=>drawEtf(x,W,H,a),1920,1080)}catch(e){rows.push(['export err '+a,String(e)])}rows.push(['export etf '+a,log.join(' | ')]);
   openCaptions({kind:'etf',a});await new Promise(r=>setTimeout(r,800));makeDraft(true);rows.push(['studio captions '+a,[...document.querySelectorAll('#capBox textarea')].map(t=>t.value).join(' | ')]);
   log=[];try{render8k(drawStudio,1920,1080)}catch(e){rows.push(['studio export err '+a,String(e)])}rows.push(['studio export '+a,log.join(' | ')]);
   let ta=document.getElementById('draft');if(ta){NEWSPICK=null;CAPCTX={kind:'etf',a};await runDraftAudit('draft','Simple');const el=document.querySelector('#audit');rows.push(['audit '+a,el?el.innerText:'']);if(el)el.classList.remove('on')}else rows.push(['audit '+a,'NO DRAFT'])}
  P.fillText=of;rows.push(['page text',document.body.innerText]);
  const st={btc:etfStats(NX.etf,'btc'),eth:etfStats(NX.etf,'eth')};return{rows,L:{btc:st.btc.L.date,eth:st.eth.L.date},pend:NX.etf.datasets.btc.days.at(-1).pending}});
 await b.close();return{...r,errs}}
(async()=>{
 const S=await run('STALE_BTC',staleBtc()),C=await run('FRESH',BASE);
 console.log('[STALE_BTC] '+JSON.stringify({sw:S.sw,head:S.head,colStale:S.colStale,btn:S.btn,st:{btc:{...S.st.btc,box:S.st.btc.box.slice(0,200)},eth:{capFor:S.st.eth.capFor,ta:S.st.eth.ta.length,exp:S.st.eth.exp}},aud:{btc:S.aud.btc.vd,eth:S.aud.eth.vd}}).slice(0,2500));
 ok(/stale: last complete day 16 Oct 2026/.test(S.sw.btc)&&S.sw.eth==='','helper (reads etfFundState): BTC stale (last complete day 16 Oct, past 2 NYSE trading days), ETH fresh',S.sw);
 // (e) the ETF card shows its stale label
 ok(/⚠️ stale/.test(S.head),'(e) ETF card header shows the stale label',S.head);
 ok(S.colStale.length===1&&S.colStale[0]==='btc','(e) stale label on the BTC column only (BTC and ETH judged separately)',S.colStale);
 ok(/BTC ETF flows stale/.test(S.note),'(e) card note names why (BTC last complete day)',S.note);
 // (d) out of exports and captions
 for(const k of ['share','4k','cap'])ok(S.btn['btc_'+k].dis&&S.btn['btc_'+k].exp===0,`(d) stale BTC: card ${k} button disabled and nothing exported`,S.btn['btc_'+k]);
 ok(!S.btn.eth_4k.dis&&S.btn.eth_4k.exp===1,'control: fresh ETH card 4K still exports',S.btn.eth_4k);
 const sb=S.st.btc;ok(!sb.ta.length&&sb.stale&&/No caption/.test(sb.box)&&/stale/.test(sb.capFor),'(d) Studio: stale BTC ETF context shows the stale label and no caption text',sb);
 ok(S.fig.btc&&!sb.box.includes(S.fig.btc)&&!sb.ta.some(t=>t.includes(S.fig.btc)),'(d) the stale BTC figure appears nowhere in Studio captions',{fig:S.fig.btc,box:sb.box});
 ok(Object.values(sb.exp).every(v=>v===0),'(d) Studio 8K / X 4K / Share refuse the stale BTC ETF context',sb.exp);
 const se=S.st.eth;ok(se.ta.length===3&&se.ta.some(t=>/ETH/.test(t))&&!se.stale,'control: fresh ETH ETF context still gets 3 captions',{ta:se.ta.map(t=>t.slice(0,60)),capFor:se.capFor});
 ok(se.exp.stExp===1,'control: Studio export works for the fresh ETH ETF context',se.exp);
 ok(/bad/.test(S.aud.btc.vd)&&/Stale data: US spot BTC ETF flows stale/.test(S.aud.btc.txt)&&/ETF figure is stale/.test(S.aud.btc.txt),'(d) 🛡 Audit fails a BTC ETF caption while BTC ETF data is stale',S.aud.btc);
 ok(!/Stale data/.test(S.aud.eth.txt),'control: Audit of the fresh ETH ETF caption has no stale failure',S.aud.eth.txt.slice(0,400));
 ok(!S.errs.length,'STALE_BTC: no page errors',S.errs);
 // control: unmodified frozen file
 ok(C.sw.btc===''&&C.sw.eth===''&&!/stale/.test(C.head)&&!C.colStale.length,'control: frozen (fresh) etf.json shows no stale label',{sw:C.sw,head:C.head,col:C.colStale});
 ok(C.st.btc.ta.length===3&&C.btn.btc_4k.exp===1,'control: fresh BTC captions and exports normally',{ta:C.st.btc.ta.length,btn:C.btn.btc_4k});
 ok(!/Stale data/.test(C.aud.btc.txt),'control: fresh BTC caption audit has no stale failure',C.aud.btc.txt.slice(0,300));
 ok(!C.errs.length,'FRESH: no page errors',C.errs);
 const G=await runPending();const hit=G.rows.filter(([k,t])=>MARK.some(m=>t.includes(m))).map(([k,t])=>k+': '+MARK.filter(m=>t.includes(m)).join(','));
 ok(G.pend===true&&G.L.btc==='2026-10-22'&&G.L.eth==='2026-10-22','(g) fixture: pending rows (23 Oct) carry partial IBIT/ETHA figures and a partial BTC total; last complete day stays 22 Oct',G.L);
 const need=['card btc','card eth','caption btc','export etf btc','studio captions btc','studio export btc','audit btc','studio captions eth','audit eth'];
 ok(need.every(n=>G.rows.some(([k,t])=>k.startsWith(n)&&t&&t!=='NO DRAFT')),'(g) every surface was rendered (card, every caption template, exports, Studio, Audit)',G.rows.map(([k,t])=>k+':'+String(t).length));
 ok(!hit.length,'(g) pending-row partial values (IBIT −876.5, partial total −4,321.9, ETHA 765.4) appear on no card, caption, export, Studio draft, Audit or page text',hit);
 ok(!G.errs.length,'(g) no page errors',G.errs);
 console.log('FAILS: '+F.length);process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
