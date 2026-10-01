const p=require('puppeteer-core');(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.setViewport({width:412,height:800,isMobile:true,hasTouch:true});await pg.goto('http://localhost:8765/index.html',{waitUntil:'networkidle2',timeout:60000});await new Promise(r=>setTimeout(r,4000));
for(const t of ['markets','signals']){await pg.evaluate(t=>tab(t),t);await new Promise(r=>setTimeout(r,t==='signals'?15000:1500));
await pg.evaluate(()=>scrollTo(0,600));await pg.setViewport({width:412,height:860,isMobile:true,hasTouch:true});await new Promise(r=>setTimeout(r,600));
const a=await pg.evaluate(()=>scrollY);await pg.evaluate(()=>refresh());await new Promise(r=>setTimeout(r,800));const c=await pg.evaluate(()=>scrollY);
console.log(t,'after address-bar resize',a,'after refresh',c);await pg.setViewport({width:412,height:800,isMobile:true,hasTouch:true});}
console.log('errors',errs);await b.close()})();
