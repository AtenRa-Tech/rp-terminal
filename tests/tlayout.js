// tlayout.js — round 5 C + E: desktop compact previews (grid, click expands full width), Macro 4 columns >= 1200px, phone layout single column;
// chart search, favourites (localStorage, pinned first) and category filters on Signals/Macro
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const R={};
for(const [w,h] of [[1280,900],[412,900]]){const pg=await b.newPage();await pg.setViewport({width:w,height:h});pg.on('pageerror',e=>console.log('pageerror',e.message));
 await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof tab==='function');await pg.evaluate(()=>{localStorage.removeItem('rpt_favs');tab('signals')});
 await pg.waitForFunction(()=>document.querySelectorAll('#sigList>.sig').length>5,{timeout:120000});await new Promise(r=>setTimeout(r,8000));
 const r=await pg.evaluate(async()=>{const vis=()=>[...document.querySelectorAll('#sigList>.sig')].filter(c=>!c.hidden).map(c=>c.dataset.sid);const cols=el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;const o={all:vis().length,cols:cols(document.getElementById('sigList'))};
  const q=document.querySelector('[data-cq="sig"]');q.value='rainbow';q.dispatchEvent(new Event('input',{bubbles:true}));o.q=vis();q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));
  const cat=k=>{document.querySelector(`[data-tools="sig"] [data-ccat="${k}"]`).click();return vis()};o.cats={};for(const k of ['Price','On-chain','Derivatives','Altseason','Volatility'])o.cats[k]=cat(k);o.macro=(cat('Macro'),document.querySelector('[data-tools="sig"] .cnone').textContent);cat('All');
  o.catOK=Object.entries(o.cats).every(([k,ids])=>ids.every(id=>sigCat(id)===k));o.catSum=Object.values(o.cats).reduce((s,a)=>s+a.length,0);
  const target=vis().at(-1);document.querySelector(`#sigList>.sig[data-sid="${target}"] [data-fav]`).click();o.favLS=localStorage.rpt_favs;o.first=document.querySelector('#sigList>.sig').dataset.sid;o.target=target;
  document.querySelector('[data-cfav="sig"]').click();o.favOnly=vis();document.querySelector('[data-cfav="sig"]').click();
  const c=[...document.querySelectorAll('#sigList>.sig')][1];const w0=c.getBoundingClientRect().width;c.querySelector('canvas').click();await new Promise(r=>setTimeout(r,300));o.open=c.classList.contains('open');o.w0=w0;o.w1=c.getBoundingClientRect().width;o.listW=document.getElementById('sigList').getBoundingClientRect().width;
  tab('macro');await new Promise(r=>setTimeout(r,6000));o.macCols=cols(document.getElementById('macList'));o.tileCols=cols(document.getElementById('macTiles'));return o});
 if(w===1280){R.C_signals_grid_desktop={cols:r.cols,pass:r.cols>=3};R.C_click_expands_full_width={w0:r.w0,w1:r.w1,listW:r.listW,pass:r.open&&r.w1>=r.listW-2&&r.w0<r.listW/2};
  R.C_macro_4_columns={macCols:r.macCols,tileCols:r.tileCols,pass:r.macCols===4&&r.tileCols===4}}
 else R.C_phone_single_column={cols:r.cols,macCols:r.macCols,tileCols:r.tileCols,pass:r.cols===1&&r.macCols===1&&r.tileCols===2};
 R['E_search_'+w]={q:r.q,pass:r.q.join()==='rainbow'};R['E_filters_'+w]={cats:Object.fromEntries(Object.entries(r.cats).map(([k,v])=>[k,v.length])),pass:r.catOK&&r.catSum===r.all&&/Macro tab/.test(r.macro)};
 R['E_favourites_'+w]={fav:r.favLS,first:r.first,favOnly:r.favOnly,pass:r.favLS===JSON.stringify(['sig:'+r.target])&&r.first===r.target&&r.favOnly.join()===r.target};await pg.close()}
await b.close();let f=0;for(const[k,v]of Object.entries(R)){const ok=v&&v.pass;if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+k+' '+JSON.stringify(v).slice(0,400))}console.log('FAILS: '+f);process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
