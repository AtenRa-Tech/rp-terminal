// Post-deploy smoke test. Usage: node tests/tsmoke.js https://atenra-tech.github.io/rp-terminal/
// Every tab renders, no page errors / app console errors, india.json is 404, each data file is under its age limit.
const p=require('puppeteer-core');const URL=(process.argv[2]||'https://atenra-tech.github.io/rp-terminal/').replace(/\/?$/,'/');
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,400):''));if(!c)F.push(n)};
// bizDays = US weekdays after the observation date, up to and including today (UTC). Was off by one: looping while x<now counted tomorrow as soon as today began.
const DAY=864e5,now=Date.now(),bizDays=(t,n=now)=>{let d=0,x=new Date(t);x.setUTCHours(0,0,0,0);const e=new Date(n);e.setUTCHours(0,0,0,0);while(x<e){x=new Date(+x+DAY);const w=x.getUTCDay();if(w&&w<6)d++}return d};
{const T=x=>Date.parse(x);const c=[[T('2026-10-05'),T('2026-10-07T10:30:00Z'),2],[T('2026-10-05'),T('2026-10-07T23:59:00Z'),2],[T('2026-10-05'),T('2026-10-08T00:01:00Z'),3],[T('2026-10-02'),T('2026-10-05T12:00:00Z'),1],[T('2026-10-02'),T('2026-10-04T12:00:00Z'),0]].map(([a,b,w])=>[bizDays(a,b),w]);ok(c.every(([g,w])=>g===w),'bizDays counts weekdays after the date through today (Fri->Mon=1, Mon->Wed=2)',c)}
(async()=>{
 const g=async u=>{const r=await fetch(URL+u+'?v='+now,{cache:'no-store'});return r};
 ok((await g('india.json')).status===404&&(await g('data/india.json')).status===404,'india.json returns 404');
 const J={};for(const n of ['derivs','market','etf','macro','calendar']){const r=await g('data/'+n+'.json');ok(r.ok,`data/${n}.json served`,r.status);if(r.ok)J[n]=await r.json()}
 const h=u=>(now-Date.parse(u))/36e5;
 if(J.derivs)ok(h(J.derivs.updated)<=36,'derivs.json under 36h',J.derivs.updated);if(J.market)ok(h(J.market.updated)<=36,'market.json under 36h',J.market.updated);
 if(J.etf)ok(bizDays(Date.parse(J.etf.last_date+'T00:00:00Z'))<=2,'etf.json last day within 2 US business days',J.etf.last_date);
 if(J.macro){const S=J.macro.series,age=id=>S[id]?(now-Date.parse(S[id].last_date+'T00:00:00Z'))/DAY:Infinity,lim={daily:['DGS10','DGS2','DFII10','T10Y2Y'],fx:['DEXUSEU','DEXJPUS','DEXCHUS','DTWEXBGS'],weekly:['WALCL','WDTGAL','WTREGEN'],monthly:['M2SL']};
  lim.daily.forEach(id=>ok(S[id]&&bizDays(Date.parse(S[id].last_date+'T00:00:00Z'))<=2,`macro ${id} within 2 business days`,S[id]?.last_date));
  /* H.10 FX: daily values published weekly (Monday ~21:15 UTC, through the prior Friday; Tuesday after a Monday holiday), so a Friday value is legitimately up to ~11 days old just before the next release */lim.fx.forEach(id=>ok(age(id)<=12,`macro ${id} within 12 days (H.10 weekly release)`,S[id]?.last_date));lim.weekly.forEach(id=>ok(age(id)<=12,`macro ${id} within 12 days`,S[id]?.last_date));
  lim.monthly.forEach(id=>ok(age(id)<=75,`macro ${id} within 75 days of month start`,S[id]?.last_date))}
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
 const errs=[];pg.on('pageerror',e=>errs.push('pageerror '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|CORS|status of 4\d\d|status of 5\d\d/.test(m.text()))errs.push('console '+m.text())});
 await pg.goto(URL+'?v='+now,{waitUntil:'domcontentloaded',timeout:60000});await new Promise(r=>setTimeout(r,8000));
 for(const t of ['today','markets','chart','signals','macro','news','studio']){await pg.evaluate(t=>tab(t),t);await new Promise(r=>setTimeout(r,t==='signals'||t==='macro'?12000:5000));
  const r=await pg.evaluate(t=>{const s=document.getElementById('s-'+t);return s?{vis:s.classList.contains('on'),len:s.innerText.trim().length}:null},t);ok(r&&r.vis&&r.len>40,`tab ${t} renders`,r)}
 ok(!errs.length,'no page errors or app console errors',errs);await b.close();
 console.log('\nSMOKE FAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
