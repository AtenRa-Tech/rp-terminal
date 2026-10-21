// 21 Oct phone P1s (RP's screenshots), at 390x844 and 412x915 phone emulation, several reloads each:
//  A. the page never lays out wider than the screen (ticker clipped in its strip, no sideways scroll), also with a 6000px ticker injected
//     and with a long stale note in a Today market-state row (wraps instead of widening body);
//  B. the bottom tab bar stays on screen after load;
//  C. reload with every live call failing: BTC, ETH, Liquidity and Derivatives keep the last good reading with its date (never stuck on Loading/No data, never '6d old').
// URL=... node tests/tphone.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html',ORIGIN=new (require('url').URL)(URL).origin;
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const go=u=>u+(u.includes('?')?'&':'?')+'v='+Date.now()+Math.random();
const layout=pg=>pg.evaluate(()=>{const W=innerWidth,n=document.querySelector('nav'),r=n?n.getBoundingClientRect():null;scrollTo(600,scrollY);const sx=scrollX;scrollTo(0,scrollY);
 return{W,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,vv:Math.round(visualViewport.width),scale:visualViewport.scale,sx,nav:r?{top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),vis:getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'}:null,H:innerHeight,tk:Math.round(document.getElementById('ticker').getBoundingClientRect().width)}});
const navOk=l=>l.nav&&l.nav.vis&&l.nav.h>=40&&l.nav.top>=0&&l.nav.bottom<=l.H+1&&l.nav.top<l.H;
const rows=pg=>pg.evaluate(()=>{try{return marketStates().filter(x=>['BTC','ETH','Liquidity','Derivatives'].includes(x.k)).map(x=>({k:x.k,st:x.st,why:x.why}))}catch(e){return[{k:'err',st:String(e)}]}});
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const [w,h] of [[390,844],[412,915]]){const ctx=await b.createBrowserContext();
 for(let i=0;i<3;i++){const pg=await ctx.newPage();await pg.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await pg.goto(go(URL),{waitUntil:'domcontentloaded',timeout:90000});
  for(const at of [1500,6000]){await new Promise(r=>setTimeout(r,at===1500?1500:4500));const l=await layout(pg);
   ok(l.sw<=w&&l.bw<=w&&l.vv===w&&l.sx===0&&l.tk<=w,`${w}px load ${i+1} @${at}ms: page stays ${w}px wide, no sideways scroll`,l);ok(navOk(l),`${w}px load ${i+1} @${at}ms: bottom tab bar on screen`,l)}
  if(i===0){// stress: a 6000px ticker (the overflow RP saw) must stay clipped inside its strip
   await pg.evaluate(()=>{document.getElementById('tkIn').textContent='BTC $83,000.00 +1.23% '.repeat(300)});await new Promise(r=>setTimeout(r,300));const l=await layout(pg);
   ok(l.sw<=w&&l.vv===w&&l.sx===0&&l.tk<=w,`${w}px: 6000px ticker text stays clipped, page ${w}px`,l);ok(navOk(l),`${w}px: tab bar on screen with a 6000px ticker`,l)}
  if(i===0){// stress (21 Oct, seen with 6-day-old derivs): a long stale note in a Today market-state row (.cin .num.mu) must wrap, not widen the page
   const ins=await pg.evaluate(()=>{const c=document.querySelector('.cin');if(!c)return false;const s=document.createElement('span');s.className='num mu';s.id='tphoneLong';s.textContent='stale: Stale: the OI series in derivs.json is past its freshness limit (stale, 3h51m old, past 3h limit (OKX)). Not used in readings, scores, POST NOW or captions. '.repeat(2);c.appendChild(s);return true});
   await new Promise(r=>setTimeout(r,300));const l=await layout(pg);ok(ins&&l.sw<=w&&l.bw<=w&&l.sx===0,`${w}px: long stale note in a Today row wraps, page ${w}px`,{ins,...l});await pg.evaluate(()=>document.getElementById('tphoneLong')?.remove())}
  if(i===0){await pg.waitForFunction(()=>{try{return SIG&&SIG.length>5&&marketStates().filter(x=>['BTC','ETH','Liquidity','Derivatives'].includes(x.k)&&!/No data|Stale/.test(x.st)).length===4}catch(e){return false}},{timeout:150000}).catch(()=>{});
   const R=await rows(pg);ok(R.length===4&&R.every(x=>!/No data|Loading/.test(x.st+x.why)),`${w}px first load: BTC, ETH, Liquidity, Derivatives have readings`,R)}
  await pg.close()}
 // C. reload with every live (third-party) call failing
 const pg=await ctx.newPage();await pg.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2});await pg.setRequestInterception(true);
 pg.on('request',r=>{const u=r.url();if(!u.startsWith(ORIGIN)&&!u.startsWith('data:'))return r.abort();r.continue()});
 await pg.goto(go(URL),{waitUntil:'domcontentloaded',timeout:90000});await new Promise(r=>setTimeout(r,4000));
 const R0=await rows(pg);ok(R0.length===4&&R0.filter(x=>x.k!=='Derivatives').every(x=>!/No data|Loading/.test(x.st+x.why)),`${w}px reload, live calls failing, 4s: BTC/ETH/Liquidity show the saved reading (not Loading/No data)`,R0);
 await pg.evaluate(()=>tab('today'));await new Promise(r=>setTimeout(r,26000));
 const R=await rows(pg),dated=x=>/\d{1,2} [A-Z][a-z]{2}|settled/.test(x.why);
 ok(R.length===4&&R.every(x=>!/No data|Loading/.test(x.st+x.why)),`${w}px reload, live calls failing: BTC, ETH, Liquidity, Derivatives not stuck on Loading/No data`,R);
 ok(R.filter(x=>x.k==='BTC'||x.k==='ETH').every(dated),`${w}px reload: BTC/ETH readings carry their close date`,R);
 ok(!R.some(x=>x.k==='Derivatives'&&/\d+d old|stale/i.test(x.st)),`${w}px reload: Derivatives keeps the last good funding (not '6d old')`,R.find(x=>x.k==='Derivatives'));
 const txt=await pg.evaluate(()=>document.getElementById('today')?.innerText||document.body.innerText);ok(!/Loading price history/.test(txt),`${w}px reload: Today screen has no stuck "Loading price history"`);
 const l=await layout(pg);ok(l.sw<=w&&navOk(l),`${w}px reload: page width and tab bar still OK`,l);
 await ctx.close()}
await b.close();console.log(F.length?`FAILS: ${F.length}`:'ALL PASS');process.exit(F.length?1:0)})();
