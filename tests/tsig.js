const p=require('puppeteer-core');const fs=require('fs');const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(/warn|error/.test(m.type())&&!/Failed to load|CORS|429/.test(m.text()))errs.push(m.type()+' '+m.text())});
await pg.goto('http://localhost:8765/index.html');await W(7000);await pg.evaluate(()=>tab('signals'));await W(15000);
await pg.screenshot({path:'g-signals.png'});await pg.screenshot({path:'g-signals-full.png',fullPage:true});
const r=await pg.evaluate(()=>SIG.map(s=>{const t=performance.now();const c=render8k((x,W,H)=>drawSig(x,W,H,s),3840,2160);return{id:s.id,score:Math.round(s.score),read:s.read,ms:Math.round(performance.now()-t),url:c.toDataURL('image/jpeg',.85)}}));
for(const s of r){fs.writeFileSync('g-'+s.id+'.jpg',Buffer.from(s.url.split(',')[1],'base64'));console.log(s.score,s.id,s.ms+'ms',s.read)}
console.log(errs.join('\n'));await b.close()})();
