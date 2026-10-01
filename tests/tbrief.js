const p=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));
const BAN=[/what are you buying/i,/what'?s your move/i,/everyone'?s watching/i,/are you ready/i,/don'?t miss/i,/\bLFG\b/i,/to the moon/i,/\bNFA\b[\s.!]*$/i,/undefined|NaN/];
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const e=[];pg.on('pageerror',x=>e.push(x.message));const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);console.log((c?'PASS ':'FAIL ')+m)};
await pg.goto('http://localhost:8765/index.html');
await pg.waitForFunction(()=>TAB==='today'&&SIG&&SIG.length&&MAC.items&&MAC.items.length&&NX.cal&&NX.etf,{timeout:90000});await W(6000);
// wait for auto-audits of top 5 (up to 90s)
await pg.waitForFunction(()=>typeof AUDDONE!=='undefined'&&AUDDONE,{timeout:120000}).catch(()=>console.log('audits not finished in time'));await W(1500);
const T=await pg.evaluate(()=>({nav:[...document.querySelectorAll('nav button')].map(b=>b.innerText.replace(/\n/g,' ')+' w='+Math.round(b.getBoundingClientRect().width)+(b.scrollWidth>b.clientWidth?' CLIPPED':'')),
  def:document.querySelector('section.on')?.id,chips:[...document.querySelectorAll('#todayBox .ms')].map(x=>x.querySelector('b').textContent+' | '+x.querySelector('.bias').textContent+' | '+x.querySelector('.msw').textContent),
  recs:[...document.querySelectorAll('#todayBox .rec[data-open]')].map(x=>x.dataset.open+' | '+x.querySelector('.rt').textContent+' | '+x.querySelector('[data-sb]').textContent+' | '+x.querySelector('.msw').textContent),
  bd:todayItems().slice(0,5).map(it=>({id:it.id,score:it.score,parts:Object.fromEntries(Object.keys(OW).map(k=>[k,[Math.round(it.opp[k][0]),it.opp[k][1]]]))})),
  clusters:[...document.querySelectorAll('#todayBox .cl')].map(c=>c.innerText.replace(/\n/g,' ¦ ')),
  news:[...document.querySelectorAll('#todayBox .card')][3]?.innerText.slice(0,600),
  ev:[...document.querySelectorAll('#todayBox .card')].find(c=>/Next event/.test(c.innerText))?.innerText}));
console.log(JSON.stringify(T,null,1));
ok(T.def==='s-today','Today is the default tab');ok(T.nav.length===7&&!T.nav.some(x=>/CLIPPED/.test(x)),'nav 7 tabs, none clipped');
ok(T.chips.length===6&&T.chips.filter(c=>!/No data/.test(c)).length>=5,'6 state chips, >=5 with data');ok(T.recs.length>=3,'>=3 recommendations');
ok(T.clusters.length>=1,'at least one cluster rendered');ok(/in \d+d|in \d+h/.test(T.ev||''),'next event countdown');ok(/Sources OK|stale|fallback in use: .+\(primary .+ failed\)|sources: /.test(T.ev||''),'freshness line');
await pg.screenshot({path:'b-today.png'});
await pg.evaluate(()=>scrollTo(0,document.querySelectorAll('#todayBox .card')[2].getBoundingClientRect().top+scrollY-60));await W(500);await pg.screenshot({path:'b-today2.png'});
// chip rule on tap
await pg.evaluate(()=>scrollTo(0,0));await W(300);await pg.tap('#todayBox .ms');await W(300);ok(await pg.evaluate(()=>!!document.querySelector('#todayBox .rule.on')),'chip tap shows rule');
// score breakdown
const rb=await pg.$('#todayBox .rec [data-sb]');await rb.evaluate(x=>x.scrollIntoView({block:'center'}));await W(200);await rb.tap();await W(400);
const bdOk=await pg.evaluate(()=>{const x=document.querySelector('#todayBox .sbx.on');return x&&/Rarity/.test(x.innerText)&&/Recency/.test(x.innerText)&&/Relevance/.test(x.innerText)&&/30%/.test(x.innerText)});ok(bdOk,'score breakdown renders with weights');
await pg.evaluate(()=>{const x=document.querySelector('#todayBox .sbx.on').closest('.rec');scrollTo(0,x.getBoundingClientRect().top+scrollY-60)});await W(400);await pg.screenshot({path:'b-score.png'});
// tap recommendation -> chart card
const first=await pg.evaluate(()=>document.querySelector('#todayBox .rec[data-open]').dataset.open);
await pg.evaluate(()=>{document.querySelector('#todayBox .sbx.on')?.classList.remove('on');scrollTo(0,0)});
const rt=await pg.$('#todayBox .rec[data-open] .msw');await rt.evaluate(x=>x.scrollIntoView({block:'center'}));await rt.tap();await W(2500);
const op=await pg.evaluate(k=>{const [kind,id]=k.split('|');const el=kind==='sig'?document.querySelector(`#s-signals [data-sid="${id}"]`):document.querySelector(`[data-mcard="${id}"]`);const r=el?.getBoundingClientRect();return{tab:TAB,found:!!el,top:r&&Math.round(r.top),flash:el?.classList.contains('flash')}},first);
console.log('open',first,JSON.stringify(op));ok(op.found&&op.top>=0&&op.top<300&&op.tab===(first.startsWith('sig')?'signals':'macro'),'tapping a recommendation opens its chart card');
// Signals tab score button + breakdown
if(first.startsWith('sig')){ok(await pg.evaluate(k=>!!document.querySelector(`#s-signals [data-sb="${k}"]`),first),'Signals card has score button')}
// captions for several signals + macro + etf + news
const capRes=await pg.evaluate(async()=>{const out=[];const ids=SIG.slice().sort((a,b)=>b.score-a.score).slice(0,4).map(s=>({kind:'sig',id:s.id}));const ctxs=[...ids,{kind:'mac',id:'btcm2'},{kind:'mac',id:'real'},{kind:'etf',a:'btc'},{kind:'news',n:D.news[0]}];
  for(const c of ctxs){if(c.kind==='news'&&!c.n)continue;openCaptions(c);await new Promise(r=>setTimeout(r,400));const g=[...document.querySelectorAll('#capBox textarea')].map(t=>t.value);
    const lint=g.map(t=>lintBanned(t,c.n?.title));const before=document.querySelector('#draftA').value;
    let changed=0;for(let k=0;k<3;k++){document.querySelector('[data-cr="analytical"]').click();await new Promise(r=>setTimeout(r,60));if(document.querySelector('#draftA').value!==before)changed++;}
    const prevRepeat=(()=>{let last=document.querySelector('#draftC').value,rep=0;for(let k=0;k<6;k++){document.querySelector('[data-cr="ct"]').click();const v=document.querySelector('#draftC').value;if(v===last)rep++;last=v}return rep})();
    out.push({ctx:c.kind+':'+(c.id||c.a||'news'),label:document.querySelector('#capFor').textContent,styles:g,lint,changed,prevRepeat,counts:[...document.querySelectorAll('[data-cc]')].map(x=>x.textContent)})}return out});
for(const r of capRes){console.log('\n== '+r.ctx+' ('+r.label+') counts '+r.counts.join(' '));r.styles.forEach((t,i)=>console.log(['SIMPLE','ANALYTICAL','CT'][i]+': '+t.replace(/\n/g,' ⏎ ')));
  ok(r.styles.length===3&&r.styles.every(t=>t.length>20),r.ctx+' has 3 caption styles');ok(r.styles.every(t=>!BAN.some(re=>re.test(t))),r.ctx+' no banned phrases (test regex)');ok(r.lint.every(l=>!l.length),r.ctx+' app lint clean '+JSON.stringify(r.lint));
  ok(r.changed>=2,r.ctx+' regenerate changes text');ok(r.prevRepeat===0,r.ctx+' no repeats in a row');ok(r.styles.every(t=>(t.match(/\$[A-Z]{2,6}\b/g)||[]).length<=1),r.ctx+' light $TICKER use')}
ok(capRes.filter(r=>r.ctx.startsWith('sig')).length>=3,'captions for >=3 different signals');
// template inventory: >=4 per style per family
ok(await pg.evaluate(()=>Object.values(CAPT).every(f=>STY.every(([s])=>f[s].length>=4))),'>=4 templates per style per family');
// edited text: audit flags banned phrases
await pg.evaluate(()=>openCaptions({kind:'sig',id:SIG[0].id}));await W(500);
await pg.evaluate(()=>{const t=document.querySelector('#draft');t.value=t.value+' What are you buying? 🚀🚀🚀 #BTC #Crypto LFG';t.dispatchEvent(new Event('input',{bubbles:true}))});await W(200);
const live=await pg.evaluate(()=>document.querySelector('[data-cl="simple"]').innerText);console.log('live lint:',live);ok(/Banned phrase/.test(live)&&/hashtags/.test(live)&&/Emoji/.test(live),'live lint flags edited text');
await pg.evaluate(()=>runDraftAudit('draft','Simple'));await W(5000);const aud=await pg.evaluate(()=>[...document.querySelectorAll('#audit li')].map(x=>x.innerText).join(' || '));console.log('audit:',aud.slice(0,800));ok(/Banned phrase/.test(aud)&&/Generic question/.test(aud),'audit on edited text flags banned phrases');
await pg.evaluate(()=>{const c=document.querySelector('#audit')?.closest('.ov,.modal,.sheet');document.querySelectorAll('.ov,.modal').forEach(x=>x.remove?.())});
// restore clean captions and screenshot
await pg.goto('http://localhost:8765/index.html');await pg.waitForFunction(()=>SIG&&SIG.length&&MAC.items,{timeout:90000});await W(1500);
await pg.evaluate(()=>{openCaptions({kind:'sig',id:todayItems().find(x=>x.kind==='sig').id})});await W(1200);
await pg.evaluate(()=>{const c=$('#capCard');scrollTo(0,c.getBoundingClientRect().top+scrollY-60)});await W(500);await pg.screenshot({path:'b-captions.png'});
// insights reachable from markets
await pg.evaluate(()=>tab('insights'));await W(800);ok(await pg.evaluate(()=>TAB==='markets'&&document.querySelector('#s-insights').classList.contains('on')),'insights merged into Markets');
console.log('\npageerrors:',JSON.stringify(e));ok(!e.length,'no page errors');console.log('\nFAILS:',fails.length,JSON.stringify(fails));await b.close()})();
