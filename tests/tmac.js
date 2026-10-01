const p=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});const e=[];pg.on('pageerror',x=>e.push(x.message));pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')e.push('console: '+m.text().slice(0,200))});
await pg.goto('http://localhost:8765/index.html');await W(5000);
await pg.evaluate(()=>tab('macro'));await W(15000);
const info=await pg.evaluate(()=>({nav:[...document.querySelectorAll('nav button')].map(b=>b.textContent+' w='+Math.round(b.getBoundingClientRect().width)+' ov='+(b.scrollWidth>b.clientWidth)),tiles:[...document.querySelectorAll('#macTiles .stat')].map(x=>x.innerText.replace(/\n/g,' | ')),health:document.querySelector('#macHealth').textContent,cards:MAC.cards.map(c=>c.id+': '+c.read),ll:MAC.ll&&MAC.ll.ll.map(x=>x.lag+'m r='+(x.r==null?'-':x.r.toFixed(3))+' n='+x.n),band:MAC.ll&&MAC.ll.band,btcsrc:MAC.btc&&MAC.btc.src,canv:document.querySelectorAll('[data-mg]').length}));
console.log(JSON.stringify(info,null,1));
await pg.screenshot({path:'m-macro.png'});
await pg.evaluate(()=>scrollTo(0,1500));await W(600);await pg.screenshot({path:'m-macro2.png'});
// yoy lead-lag + scroll preservation on control click
const y1=await pg.evaluate(()=>scrollY);await pg.evaluate(()=>document.querySelector('[data-mchg="yoy"]').click());await W(1500);
const yoy=await pg.evaluate(()=>({y:scrollY,ll:MAC.ll.ll.map(x=>x.lag+'m r='+(x.r==null?'-':x.r.toFixed(3))+' n='+x.n)}));console.log('scroll before',y1,'after',yoy.y,'\nYOY',yoy.ll.join(' · '));
await pg.evaluate(()=>document.querySelector('[data-mchg="mom"]').click());await W(800);
await pg.evaluate(()=>document.querySelector('[data-mlag="60"]').click());await W(800);
// audit macro card 0 and 1
for(const i of [0,1,2]){const r=await pg.evaluate(async i=>{const R=await auditMacro(MAC.cards[i]);return MAC.cards[i].id+' => '+verdict(R)[1]+'\n  '+R.map(x=>x[0]+': '+x[1]).join('\n  ')},i);console.log(r)}
// 4K export of lead card
const png=await pg.evaluate(()=>new Promise(res=>{const s=MAC.cards.find(c=>c.id==='lead');const c=render8k((x,W,H)=>drawSig(x,W,H,s),3840,2160);res(c.toDataURL('image/png'))}));require('fs').writeFileSync('m-card-4k.png',Buffer.from(png.split(',')[1],'base64'));
// export via button path (download) – check no error
await pg.evaluate(()=>macAct(1,'4k'));await W(3000);
// captions
console.log('CAPS\n'+await pg.evaluate(()=>MAC.cards.map(c=>'--'+c.id+'\n'+c.cap).join('\n')));
// news
await pg.evaluate(()=>tab('news'));await W(5000);
const nx=await pg.evaluate(()=>({cal:document.querySelector('#nxCal').innerText.slice(0,900),etf:document.querySelector('#nxEtf').innerText,etfcap:etfCap('btc')}));console.log(JSON.stringify(nx,null,1));
await pg.screenshot({path:'m-news.png'});
// other themes nav fit
for(const t of ['sap','ch','bb','neo']){await pg.evaluate(t=>{applyTheme(t);tab('macro',1)},t);await W(1500);const n=await pg.evaluate(()=>[...document.querySelectorAll('nav button')].map(b=>b.textContent+(b.scrollWidth>b.clientWidth?'(OVERFLOW)':'')).join(' '));console.log(t,n)}
const txt=await pg.evaluate(()=>document.body.innerText);console.log('IST mentions:',(txt.match(/IST|\+05:30|Asia\/Kolkata/g)||[]).length);
console.log('errors',e);await b.close()})();
