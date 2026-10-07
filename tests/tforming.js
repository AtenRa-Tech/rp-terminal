// tforming.js: forming-candle rule (7 Oct, approved). Readings, scores, POST NOW and caption values use the last CLOSED candle;
// the Data line reads 'through <closed> (<x> candle forming)' + rendered UTC time; a live header value is labelled 'live' beside the closed value.
// Fails on b479fff-era code, passes on the fix. URL=... node tests/tforming.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIGD&&SIGD.P&&SIGD.CL&&SIG&&SIG.length>5}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(()=>{const o={},DAYm=864e5,today=Math.floor(Date.now()/DAYm)*DAYm;
 // 1. score + POST NOW: append a forming daily bar (today, unfinished) that moves +40% / -40%; nothing may change
 const withForm=(d,k)=>{const f=s=>s&&s.t&&s.t.length&&s.t.at(-1)<today?{...s,t:[...s.t,today],v:[...s.v,s.v.at(-1)*k]}:s;const x={...d};for(const key of ['P','EB','PG','BT','H'])x[key]=f(d[key]);x.CL={};for(const a in d.CL)x.CL[a]=f(d.CL[a]);return x};
 const run=d=>{const S0=SIGD;SIGD=d;try{const S=buildSignals(d);S.forEach(s=>{try{prepSig(s)}catch(e){}});return Object.fromEntries(S.map(s=>[s.id,{score:Math.round(s.score*100)/100,pn:postNow(s),read:s.read}]))}finally{SIGD=S0}};
 const base=run(SIGD),up=run(withForm(SIGD,1.4)),dn=run(withForm(SIGD,.6));const diff=[];for(const id in base)for(const [lab,X] of [['up',up],['dn',dn]]){const a=base[id],c=X[id];if(!c||a.score!==c.score||a.pn!==c.pn||a.read!==c.read)diff.push([id,lab,a,c])}
 o.sig={n:Object.keys(base).length,diff:diff.slice(0,4),pnBase:Object.values(base).filter(x=>x.pn).length,pnUp:Object.values(up).filter(x=>x.pn).length,pnDn:Object.values(dn).filter(x=>x.pn).length};
 // 2. chart export + screen with a forming daily candle: header = closed candle, live value labelled 'live'; Data line marks forming + rendered UTC
 const N=200,t=[],op=[],h=[],l=[],c=[],v=[];for(let i=0;i<N;i++){const x=100+i*.5;t.push(today-(N-1-i)*DAYm);op.push(x);h.push(x+1);l.push(x-1);c.push(x+.3);v.push(10)}c[N-1]=777;h[N-1]=780;
 const syn={t,o:op,h,l,c,v,src:'Binance',pair:'BTC/USDT',complete:true,pages:1};
 window.AXLOG=[];const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;const ctx=cv.getContext('2d');
 const keep={d:CH.d,iv:CH.iv,n:CH.n,cross:CH.cross};let lay=null;try{CH.d=syn;CH.iv='1d';CH.n=120;CH.cross=null;lay=drawChart(ctx,cv.width,cv.height,{...CH,d:syn,iv:'1d',n:120,cross:null});drawChartScreen()}catch(e){o.chartErr=String(e)}
 const hdr=(AXLOG||[]).filter(x=>x.fn==='chartHdr').at(0)||{};o.hdr={ohlcC:hdr.ohlcC,closedC:c[N-2],formC:c[N-1],live:hdr.live||'',tag:hdr.tag,data:hdr.data,closedD:axFull(t[N-2]),formD:axDay(t[N-1])};
 o.screen=document.getElementById('chSrc')?.textContent||'';
 // 3. chart caption facts: the value is the closed candle's, never the forming one
 let Fc=null;try{Fc=capFacts({kind:'studio',t:'chart'})}catch(e){Fc={err:String(e)}}o.cap={now:Fc?.now,closed:money(c[N-2]),form:money(c[N-1]),caps:Fc&&!Fc.err?STY.map(([st])=>capPick(Fc,st,-1,()=>.5).t):[]};
 Object.assign(CH,keep);window.AXLOG=null;
 // 4. app lint: 'close' on a forming value is flagged (guard)
 o.lint=lintBanned('BTC closed at $85,000 today.','',true).length>0&&!lintBanned('BTC at $85,000, live 14:20 UTC.','',true).length;
 return o});
ok(r.sig.n>5&&!r.sig.diff.length,'score: every signal score and reading unchanged when only the forming daily candle moves (+40% / -40%)',r.sig);
ok(r.sig.pnBase===r.sig.pnUp&&r.sig.pnBase===r.sig.pnDn&&!r.sig.diff.some(x=>x[2].pn!==x[3]?.pn),'POST NOW: count and flags unchanged when only the forming candle moves',r.sig);
ok(r.hdr.ohlcC===r.hdr.closedC,'chart header: OHLC shows the last CLOSED candle, not the forming one',r.hdr);
ok(/^live 777(\.0+)? · \d\d:\d\d UTC$/.test(r.hdr.live),"chart header: forming price shown beside it, labelled 'live HH:MM UTC'",r.hdr);
ok(typeof r.hdr.data==='string'&&r.hdr.data.includes(`through ${r.hdr.closedD} (${r.hdr.formD} candle forming) · rendered `)&&/rendered \d+ \w{3} \d\d:\d\d UTC$/.test(r.hdr.data),"export Data line: 'through <closed date> (<date> candle forming) · rendered <UTC time>'",r.hdr);
ok(r.screen.includes(`through ${r.hdr.closedD} (${r.hdr.formD} candle forming)`)&&/rendered \d+ \w{3} \d\d:\d\d UTC$/.test(r.screen),'chart screen Data line: closed-through date + forming marker + rendered UTC time',r.screen);
ok(typeof r.cap.now==='string'&&r.cap.now.startsWith(r.cap.closed)&&!r.cap.caps.some(t=>t.includes(r.cap.form)),'chart caption: value is the closed candle, forming value never used',r.cap);
ok(r.lint===true,"lint: 'close' attached to a forming value is flagged",r.lint);
ok(!errs.length&&!r.chartErr,'no page errors',[errs.slice(0,3),r.chartErr]);
console.log('FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})();
