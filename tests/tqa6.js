// tqa6.js — axis label minimum (supervisor ruling 3 Oct): label count follows plot width relative to the label font, never image height.
// Narrow plots (phone) 4-6 labels, wide plots (desktop; 16:9, 1:1, 4:5 exports; 4K/8K alike) 8-10. If the span's own unit cannot reach the
// minimum, a finer unit is used; a collision beats the minimum (logged as short:true, listed, and must be rare).
// Cases: every chart interval x range button at 412 and 1440 CSS px; every Signals and Macro chart card on screen at both widths; exports:
// chart 16:9, every card 16:9, Studio chart template in 16:9 / 1:1 / 4:5. Asserts count within min..max (or short) and no collisions on either row.
// Usage: URL=... node tests/tqa6.js   (writes the per-case table to $TMPDIR/tqa6.json)
const p=require('puppeteer-core'),fs=require('fs'),os=require('os'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const rows=[];const coll=B=>{for(let i=1;i<(B||[]).length;i++)if(B[i][0]<B[i-1][1]-0.5)return true;return false};
// short count allowed ONLY when (a) the span has fewer candles (or days, for multi-day intraday dates) than the minimum, or (b) no even step fits:
// every step the app tried that gives min..max labels collided (the app logs each step's count + fit). Any other short count fails.
const judge=(name,a,expectDesk)=>{if(!a){rows.push({name,pass:false,why:'no axis log'});return}
  const dh=a.cls==='dh',main=dh?a.row2.labels.length:a.labels.length,times=dh?a.labels.length:0;
  const okMax=main<=a.maxN&&(!dh||times<=Math.max(0,main-1)),noColl=!coll(a.boxes)&&!coll(a.row2.boxes),cls=expectDesk==null||a.desk===expectDesk;
  // multi-day intraday: at most ONE time label between two day markers
  let oneTime=true;if(dh&&times){const D=a.row2.ticks;for(let i=0;i+1<D.length;i++){if(a.ticks.filter(t=>t>D[i]&&t<D[i+1]).length>1)oneTime=false}if(a.ticks.some(t=>t<D[0]||t>D.at(-1)))oneTime=false}
  let okMin=main>=a.minN,shortOK=false,reason=null;
  if(!okMin){reason=a.why||'(no reason logged)';
    if(/^fewer candles/.test(reason))shortOK=a.nPts!=null&&a.nPts<a.minN;
    else if(/^fewer days/.test(reason))shortOK=dh&&Math.ceil((a.lastT-a.t0)/864e5)<a.minN;
    else if(/^no even step fits/.test(reason))shortOK=(a.ev||[]).every(e=>e.c<a.minN||e.c>a.maxN+2||e.fit===false);}
  rows.push({name,cls:a.cls,step:String(a.k)+(a.n??''),n:main,times,min:a.minN,max:a.maxN,short:!okMin,reason,em:+a.em.toFixed(1),labels:a.labels.join(' ')+(a.row2.labels.length?' / '+a.row2.labels.join(' '):''),
    pass:okMax&&(okMin||shortOK)&&noColl&&cls&&oneTime,why:[!okMax&&'over max',!okMin&&!shortOK&&'short without a valid reason',!noColl&&'collision',!cls&&'wrong width class',!oneTime&&'more than one time between day markers'].filter(Boolean).join(',')})};
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const [w,h] of [[412,915],[1440,900]]){const desk=w>=1000;const pg=await b.newPage();await pg.setViewport({width:w,height:h,deviceScaleFactor:w<500?3:1});pg.on('pageerror',e=>console.log('pageerror',e.message));
  await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof drawChart==='function'&&typeof tab==='function',{timeout:60000});
  await pg.evaluate(()=>tab('chart'));await new Promise(r=>setTimeout(r,3000));
  const C=await pg.evaluate(async()=>{const out=[];for(const iv of Object.keys(IVMS)){CH.iv=iv;CH.rng=null;await loadChart();if(!CH.d)continue;
      for(const r of Object.keys(RNG)){if(rngN(r)==null){out.push({iv,r,skip:rngWhy(r)||'disabled'});continue}CH.rng=r;applyRng();window.AXLOG=[];drawChartScreen();const a=AXLOG.find(x=>x.fn==='chart');window.AXLOG=null;out.push({iv,r,a})}}
    CH.iv='1d';CH.rng=null;await loadChart();
    // chart export 16:9 (1D, 1Y)
    CH.rng='1Y';applyRng();window.AXLOG=[];render8k((x,W,H)=>drawChart(x,W,H,{...CH,cross:null}),1920,1080);out.push({iv:'1d',r:'1Y',exp:'chart 16:9',a:AXLOG.find(x=>x.fn==='chart')});window.AXLOG=null;CH.rng=null;
    return out});
  for(const c of C){if(c.skip){rows.push({name:`chart ${c.iv} ${c.r} @${w}`,skip:c.skip,pass:true});continue}judge(c.exp?`export ${c.exp} ${c.iv} ${c.r}`:`chart ${c.iv} ${c.r} @${w}`,c.a,c.exp?true:desk)}
  for(const t of ['signals','macro']){await pg.evaluate(t=>tab(t),t);await pg.waitForFunction(t=>t==='signals'?typeof SIG!=='undefined'&&SIG&&SIG.length>5:MAC&&MAC.cards&&MAC.cards.length>5,{timeout:120000},t);await new Promise(r=>setTimeout(r,2500));
    const K=await pg.evaluate((t,expW)=>{const out=[];const sel=t==='signals'?'[data-sg]':'[data-mg]',list=t==='signals'?SIG:MAC.cards;
      document.querySelectorAll(sel).forEach(cv=>{const s=list[+cv.dataset[t==='signals'?'sg':'mg']];if(!s||!cv.offsetParent)return;window.AXLOG=[];const ctx=fit(cv,Math.round(cv.parentElement.clientWidth*9/16));drawSig(ctx,cv.width,cv.height,s);out.push({id:s.id||s.title,a:AXLOG.filter(x=>x.fn==='plot'&&x.row2)});window.AXLOG=null});
      if(expW)list.forEach(s=>{window.AXLOG=[];render8k((x,W,H)=>drawSig(x,W,H,s),1920,1080);out.push({id:s.id||s.title,exp:1,a:AXLOG.filter(x=>x.fn==='plot'&&x.row2)});window.AXLOG=null});return out},t,desk);
    for(const k of K){if(!k.a.length){rows.push({name:`${k.exp?'export 16:9':'card'} ${t} ${k.id}${k.exp?'':' @'+w}`,skip:'no time axis (bars / gauge)',pass:true});continue}k.a.forEach((a,i)=>judge(`${k.exp?'export 16:9':'card'} ${t} ${k.id}${i?'#'+i:''}${k.exp?'':' @'+w}`,a,k.exp?true:null))}}
  if(desk){// Studio chart template in the three Studio ratios (base size; 8K is the same layout scaled)
    await pg.evaluate(()=>tab('studio'));await new Promise(r=>setTimeout(r,2500));
    const S=await pg.evaluate(()=>{const out=[];const sel=document.querySelector('#stType'),rat=document.querySelector('#stRatio');sel.value='chart';sel.dispatchEvent(new Event('change'));
      for(const [r,W,H] of [['16:9',1920,1080],['1:1',1080,1080],['4:5',1080,1350]]){rat.value=r;window.AXLOG=[];render8k(drawStudio,W,H);out.push({r,a:AXLOG.find(x=>x.fn==='chart'||x.fn==='plot')});window.AXLOG=null}return out});
    for(const s of S)judge(`export studio chart ${s.r}`,s.a,true)}
  await pg.close()}
await b.close();fs.writeFileSync(path.join(os.tmpdir(),'tqa6.json'),JSON.stringify(rows,null,1));
let f=0,sh=0;for(const r of rows){if(!r.pass)f++;if(r.short)sh++;console.log((r.skip?'SKIP ':r.pass?'PASS ':'FAIL ')+r.name+(r.skip?' ('+r.skip+')':` [${r.cls} ${r.step}] n=${r.n}${r.times?' +'+r.times+' times':''} (${r.min}-${r.max}${r.short?', short: '+r.reason:''}) em=${r.em} :: ${r.labels}`)+(r.why?' !! '+r.why:''))}
console.log(`cases ${rows.filter(r=>!r.skip).length}, short ${sh}, FAILS: ${f}`);process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
