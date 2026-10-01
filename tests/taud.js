const p=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});const e=[];pg.on('pageerror',x=>e.push(x.message));
await pg.goto('http://localhost:8765/index.html');await W(6000);await pg.evaluate(()=>tab('signals'));await W(14000);
const out=await pg.evaluate(async()=>{const o=[];for(const s of SIG){const R=await auditSignal(s);o.push(s.id+' => '+verdict(R)[1]+'\n  '+R.map(x=>x[0]+': '+x[1]).join('\n  '))}return o.join('\n')});console.log(out);
await pg.evaluate(()=>runSigAudit(0));await W(5000);await pg.screenshot({path:'a-sig.png'});
await pg.evaluate(()=>{document.querySelector('#audit').classList.remove('on');tab('studio');document.querySelector('#draft').value='BREAKING: $BTC will hit $150,000 guaranteed. Price now $79,000. Buy now, the bottom is in!';});await pg.evaluate(()=>runDraftAudit());await W(4000);await pg.screenshot({path:'a-draft.png'});
console.log(e.join('\n'));await b.close()})();
