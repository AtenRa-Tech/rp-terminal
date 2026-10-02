// Contact sheets for supervisor review. Usage: node qa/contact-sheet.js [URL] [OUTDIR]
// screen-<w>.png: every chart canvas on screen per tab at phone width w (360/412/430, DPR 2), labelled; exports.png: every 4K export (downscaled), labelled.
const {chromium}=require('playwright-core');const fs=require('fs');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/',OUT=process.argv[3]||'/workspace/rp-terminal/contact';fs.mkdirSync(OUT,{recursive:true});
const compose=async(p,items,colW,cols,title)=>p.evaluate(async({items,colW,cols,title})=>{const imgs=await Promise.all(items.map(it=>new Promise(r=>{const im=new Image();im.onload=()=>r([it,im]);im.onerror=()=>r([it,null]);im.src=it.src})));
  const pad=16,lab=34,cells=imgs.map(([it,im])=>({it,im,h:im?Math.round(im.height*colW/im.width):40}));const rows=[];for(let i=0;i<cells.length;i+=cols)rows.push(cells.slice(i,i+cols));
  const H=70+rows.reduce((s,r)=>s+Math.max(...r.map(c=>c.h))+lab+pad,0),W=cols*(colW+pad)+pad;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,W,H);x.fillStyle='#fff';x.font='bold 30px sans-serif';x.fillText(title,pad,44);
  let y=70;for(const r of rows){let xx=pad;for(const cl of r){x.fillStyle='#ffd400';x.font='bold 22px sans-serif';x.fillText(cl.it.label.slice(0,70),xx,y+24);if(cl.im)x.drawImage(cl.im,xx,y+lab,colW,cl.h);x.strokeStyle='#444';x.strokeRect(xx,y+lab,colW,cl.h);xx+=colW+pad}y+=Math.max(...r.map(c=>c.h))+lab+pad}
  return c.toDataURL('image/png')},{items,colW,cols,title});
const save=(f,d)=>{fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));console.log('wrote',f)};
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const w of [360,412,430]){const p=await b.newPage({viewport:{width:w,height:900},deviceScaleFactor:2});await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:120000}).catch(()=>{});await p.waitForTimeout(8000);
  const items=[];const grab=async(tag)=>{const r=await p.evaluate(tag=>[...document.querySelectorAll('section.on canvas')].filter(c=>c.width>50&&c.height>50&&c.offsetParent).map((c,i)=>({label:`${tag} · ${c.id||c.dataset.sg||c.dataset.mg||c.dataset.sp||c.className||i} · ${c.width}×${c.height}`,src:c.toDataURL('image/png')})),tag);items.push(...r.filter(x=>!/data-sp|spark/.test(x.label)))};
  for(const t of ['today','signals','macro','markets','news','studio']){await p.evaluate(t=>tab(t),t);await p.waitForTimeout(t==='signals'?15000:5000);await grab(t+' @'+w)}
  await p.evaluate(()=>tab('chart'));for(const iv of ['15m','1h','4h','1d','1w']){await p.click(`[data-iv="${iv}"]`).catch(()=>{});await p.waitForTimeout(5000);await grab('chart '+iv+' @'+w)}
  save(`${OUT}/screen-${w}.png`,await compose(p,items,w*2>720?720:w*2,4,`RP Terminal · every chart on screen at ${w}px (DPR 2) · ${new Date().toISOString().slice(0,16)}Z · ${URL}`));
  if(w===412){const ex=await p.evaluate(async()=>{const L=[];const add=(label,fn)=>{try{const c=render8k(fn,3840,2160);const s=document.createElement('canvas');s.width=1280;s.height=720;s.getContext('2d').drawImage(c,0,0,1280,720);L.push({label,src:s.toDataURL('image/png')})}catch(e){L.push({label:label+' ERROR '+e.message,src:''})}};
    (SIG||[]).forEach(s=>add('sig 4K · '+s.title,(x,W,H)=>drawSig(x,W,H,s)));(MAC.cards||[]).forEach(s=>add('macro 4K · '+s.title,(x,W,H)=>drawSig(x,W,H,s)));if(ALTOBJ)add('altseason 4K',(x,W,H)=>drawSig(x,W,H,ALTOBJ));
    if(NX.etf)['btc','eth'].forEach(a=>add('ETF 4K · '+a,(x,W,H)=>drawEtf(x,W,H,a)));if(SIGD?.CL?.BTC){add('studio DD 4K',(x,W,H)=>drawDD(x,W,H,'BTC'));add('studio perf 4K',(x,W,H)=>drawPerf(x,W,H,'BTC'))}
    for(const iv of ['15m','1h','4h','1d','1w']){try{CH.iv=iv;await loadChart()}catch(e){}add('chart '+iv+' 4K (studio/share)',(x,W,H)=>drawCard(x,W,H,'chart'))}
    add('heatmap 4K',(x,W,H)=>drawHeat(x,W,H,true));return L});
   save(`${OUT}/exports-4k.png`,await compose(p,ex,1280,3,`RP Terminal · every 4K export (shown at 1280×720) · ${new Date().toISOString().slice(0,16)}Z`))}
  await p.close()}
await b.close()})().catch(e=>{console.error(e);process.exit(1)});
