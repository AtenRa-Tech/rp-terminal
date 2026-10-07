// tbugs2.js: regression tests for RP's 7 Oct 29-bug review, items that had no test (3 5 10 11 12 19 24 25 26) or a partial one (6 15 16 18 23 27).
// Numbering = RP's table; 20-29 are the recovered tail of the table (contact/bugs29.md), 1-19 use the short names from STATUS4.md.
// Each check drives the app's own functions with crafted data and stubbed network. URL=... node tests/tbugs2.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,600):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return typeof buildSignals==='function'&&MAC&&MAC.M&&MAC.M.series&&SIG&&SIGD&&SIGD.P}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5,T=async(k,f)=>{try{o[k]=await f()}catch(e){o[k]={err:String(e&&e.stack||e).slice(0,300)}}};
 const day0=Math.floor(Date.now()/DAYm)*DAYm,cd=day0-DAYm;// cd = last CLOSED UTC day
 const row=(t,o1,h,l,c)=>[t,String(o1),String(h),String(l),String(c),'10',t+DAYm-1,'0',0,'0','0','0'];
 // #3 candle validation
 await T('k3',async()=>{const keepJ=window.J;const t0=cd-12*DAYm,R=[row(t0,10,11,9,10.5),row(t0+DAYm,10.5,12,10,11),row(t0+2*DAYm,11,'NaN',10,11.5),row(t0+3*DAYm,11,12,10,-1),row(t0+4*DAYm,11,10,12,11),row(t0+4*DAYm,11,12,10,11.2),row(t0+5*DAYm,11,12.5,10.5,12),row(t0+5*DAYm-DAYm*3,11,12,10,11),row(t0+6*DAYm,12,13,11.5,12.5),row(t0+7*DAYm,12.5,13,12,12.8)];
   window.J=async u=>{if(/klines/.test(u))return R;return keepJ(u)};D.kl={};let k;try{k=await klines({id:'zz3',sym:'zz3'},'1d',10)}finally{window.J=keepJ;D.kl={}}
   const inc=k.t.every((x,i)=>!i||x>k.t[i-1]),valid=k.t.every((_,i)=>[k.o[i],k.h[i],k.l[i],k.c[i]].every(x=>isFinite(x)&&x>0)&&k.h[i]>=k.l[i]);return{n:k.t.length,inc,valid}});
 // #6 history paging: three Binance pages stitched, overlap de-duplicated, complete flag
 await T('k6',async()=>{const keepJ=window.J;const N=2400,t0=cd-(N-1)*DAYm,all=Array.from({length:N},(_,i)=>row(t0+i*DAYm,100+i,101+i,99+i,100.5+i));
   window.J=async u=>{if(!/klines/.test(u))return keepJ(u);const m=u.match(/endTime=(\d+)/),e=m?+m[1]:Infinity;const rows=all.filter(x=>x[0]<=e+DAYm);return rows.slice(-1000)};D.kl={};let k;try{k=await klinesH({id:'zz6',sym:'zz6'},'1d')}finally{window.J=keepJ;D.kl={}}
   return{n:k.t.length,inc:k.t.every((x,i)=>!i||x>k.t[i-1]),pages:k.pages,complete:k.complete,first:k.t[0]===t0}});
 // #5 chart auto-refresh fetches newer candles
 await T('k5',async()=>{try{tab('chart')}catch(e){}for(let i=0;i<60&&!CH.d;i++)await new Promise(r=>setTimeout(r,250));if(!CH.d)return{err:'no chart'};
   const keep=window.klinesH,d=CH.d,nt=d.t.at(-1)+(d.t.at(-1)-d.t.at(-2)),nd={...d,t:[...d.t,nt],o:[...d.o,d.c.at(-1)],h:[...d.h,d.c.at(-1)*1.01],l:[...d.l,d.c.at(-1)*.99],c:[...d.c,d.c.at(-1)*1.005],v:[...d.v,1]};
   const keepR={lm:window.loadMarkets,lr:window.loadRate,lf:window.loadFng,lt:window.loadTrend};window.loadMarkets=window.loadRate=window.loadFng=window.loadTrend=async()=>{};
   window.klinesH=async()=>nd;try{await refresh(false);for(let i=0;i<20&&CH.d.t.at(-1)!==nt;i++)await new Promise(r=>setTimeout(r,100))}finally{window.klinesH=keep;Object.assign(window,{loadMarkets:keepR.lm,loadRate:keepR.lr,loadFng:keepR.lf,loadTrend:keepR.lt})}
   return{got:CH.d.t.at(-1)===nt}});
 // #10 macro re-read after the TTL; #11 derivs re-read after the TTL
 await T('k10',async()=>{await ensureMac();const keepDF=window.dataFile,keepN=Date.now,NEW=JSON.parse(JSON.stringify(MAC.M));NEW.__fresh=1;let calls=0;
   window.dataFile=async(n,f)=>{if(n==='macro'){calls++;return{v:NEW,src:'live',at:keepN()}}return keepDF(n,f)};Date.now=()=>keepN()+20*60000;try{await ensureMac()}finally{Date.now=keepN;window.dataFile=keepDF}return{fresh:MAC.M?.__fresh===1,calls}});
 await T('k11',async()=>{await ensureDV();const keepDF=window.dataFile,keepN=Date.now,cur=await keepDF('derivs'),NEW=JSON.parse(JSON.stringify(cur.v));NEW.__fresh=1;
   window.dataFile=async(n,f)=>n==='derivs'?{v:NEW,src:'live',at:keepN()}:keepDF(n,f);Date.now=()=>keepN()+20*60000;let raw;try{await ensureDV();raw=(typeof DVRAW!=='undefined')?DVRAW:null}finally{Date.now=keepN;window.dataFile=keepDF}return{fresh:raw?.__fresh===1}});
 // #12 manual refresh drops every cached dataset
 await T('k12',async()=>{const keepR=window.refresh;window.refresh=()=>{};try{document.querySelector('#refBtn').onclick()}finally{window.refresh=keepR}
   const st={mac:MAC.M===null,dv:(typeof DVRAW!=='undefined')?DVRAW===null:false,df:Object.keys(DF).length===0,kl:Object.keys(D.kl).length===0,sig:SIG===null};await ensureMac();await ensureDV();return st});
 // #15 live-fallback label: data file served by the fallback host or the offline copy says so
 await T('k15',async()=>{const keepF=window.fetch;window.fetch=async(u,o)=>{if(/raw\.githubusercontent/.test(u))return new Response(JSON.stringify({x:1}),{status:200});throw new Error('down')};let a,c;
   try{a=await dataFile('zzfb',true);localStorage.rpd_zzoff=JSON.stringify({y:1});window.fetch=async()=>{throw new Error('down')};c=await dataFile('zzoff',true)}finally{window.fetch=keepF;delete localStorage.rpd_zzfb;delete localStorage.rpd_zzoff}
   return{a:a?.src,c:c?.src}});
 // #16 source attribution: BTC history served by the Coinbase fallback is labelled Coinbase
 await T('k16',async()=>{const keepJ=window.J;window.J=async u=>{if(/exchange\.coinbase\.com\/products\/BTC-USD\/candles/.test(u)){const e=Date.parse(new URL(u).searchParams.get('end'))/1000;return Array.from({length:300},(_,i)=>{const t=e-(i+1)*86400;return[t,90,110,95,100+i%7,5]})}throw new Error('down '+u.slice(0,40))};
   let d;try{d=await loadSigData()}finally{window.J=keepJ}return{src:d?.P?.src||null,n:d?.P?.t?.length||0}});
 // #18 constant-FX M2 missing -> '—' (never n/a or 0)
 await T('k18',async()=>{const t=[],P=[];for(let i=0;i<30;i++){const x=Date.UTC(2024,i,1);t.push(x);P.push([new Date(x).toISOString().slice(0,10),100+i])}const G={t,P,yoy:(P[29][1]/P[17][1]-1)*100,yoyCC:null};return m2YoyTxt0(G)});
 // #19 real yield: nominal and real read on the same date
 await T('k19',async()=>{const M=JSON.parse(JSON.stringify(MAC.M)),a=M.series.DGS10,bb=M.series.DFII10,lb=bb.points.at(-1)[0],nx=new Date(Date.parse(lb)+DAYm*1).toISOString().slice(0,10);a.points=a.points.filter(p=>p[0]<=lb);a.points.push([nx,9.99]);a.last_date=nx;
   const c=buildMacro(M,MAC.btc).find(x=>x.id==='real');return{read:c?.read||null,src:c?.src||null,lb}});
 // #23 altseason: no usable breadth rows
 await T('k23',async()=>{const keep=MK;MK={...(MK||{}),breadth:{points:[['2026-10-01',null,null,null],['2026-10-02',5,null,null]]}};let v,e=null;try{v=altCalc()}catch(x){e=String(x)}finally{MK=keep}return{v:v===undefined?'undef':v,e}});
 // #24 partial source recovery: long-term BTC source fails, fresh coin histories still replace the old ones
 await T('k24',async()=>{const keepL=window.loadSigData,old=SIGD,E=old.CL.ETH,fresh={...E,v:E.v.map((x,i)=>i===E.v.length-1?x*1.5:x),src:'Binance'};
   window.loadSigData=async()=>({P:null,H:null,EB:null,PG:null,BT:null,ST:null,CL:{BTC:old.CL.BTC,ETH:fresh,LINK:old.CL.LINK}});try{await ensureSig(true)}finally{window.loadSigData=keepL}
   const res={eth:SIGD.CL.ETH.v.at(-1)===fresh.v.at(-1),keptP:!!SIGD.P&&SIGD.P.t.at(-1)===old.P.t.at(-1)};SIGD=old;await ensureSig(true).catch(()=>{});return res});
 // #25 #26 #27 audits on a synthetic chart (Binance-sourced, so an independent recompute must come from another provider)
 {const N=1200,t=Array.from({length:N},(_,i)=>cd-(N-1-i)*DAYm),v=t.map((_,i)=>i<700?20000+i*100:90000-(i-700)*40),keep=SIGD,keepL=window.liveBTC,keepB=window.bnDaily,keepC=window.cbDaily,keepJ=window.J;
  const sma=(a,n)=>a.slice(-n).reduce((x,y)=>x+y,0)/n,may=v[N-1]/sma(v,200),ddv=(v[N-1]/Math.max(...v)-1)*100;let cb=0,bn=0,feed=null;
  SIGD={...keep,P:{t,v,src:'Binance'},CL:{...keep.CL,BTC:{t,v,src:'Binance'}},EB:{t:[cd-DAYm,cd],v:[.049,.05],src:'Binance'},PG:{t:[cd-DAYm,cd],v:[29,30],src:'Binance'}};
  window.liveBTC=async()=>[];window.bnDaily=async()=>{bn++;return{...(feed||{t,v}),src:'Binance'}};
  window.cbDaily=async(sym)=>{cb++;if(sym==='ETHBTC')return{t:[cd-DAYm,cd],v:[.04,.05005],src:'Coinbase'};if(sym==='PAXGUSDT')return{t:[cd-DAYm,cd],v:[3900,4000],src:'Coinbase'};if(sym==='BTCUSDT'&&feed==='gold')return{t:[cd-DAYm,cd],v:[110000,120000],src:'Coinbase'};return{...(feed||{t,v}),src:'Coinbase'}};
  window.J=async u=>{if(/prices\/ETH-BTC\/spot/.test(u))return{data:{amount:'0.06'}};if(/prices\/BTC-USD\/spot/.test(u))return{data:{amount:'150000'}};if(/prices\/PAXG-USD\/spot/.test(u))return{data:{amount:'4000'}};throw new Error('down')};
  const run=async s=>{const R=await auditSignal({title:'Test chart',cap:'Test reading through the last close.',src:'test',...s});return R.map(x=>[x[0],x[1]])};
  try{await T('a25',async()=>{feed=null;cb=0;bn=0;const R=await run({id:'mayer',m:may,read:''});return{R,cb,bn}});
   // chart lags one day behind the recompute source; the source's newer close is wildly different
   await T('a26i',async()=>{const t2=t.slice(0,-1),v2=v.slice(0,-1);SIGD.CL.BTC={t:t2,v:v2,src:'Binance'};SIGD.P={t:t2,v:v2,src:'Binance'};feed={t,v:v.map((x,i)=>i===N-1?x*3:x)};const m=v2.at(-1)/sma(v2,200);const R=await run({id:'mayer',m,read:''});SIGD.CL.BTC={t,v,src:'Binance'};SIGD.P={t,v,src:'Binance'};feed=null;return R});
   await T('a26e',async()=>run({id:'ethbtc',m:.05,read:''}));
   await T('a26g',async()=>{feed='gold';const R=await run({id:'gold',m:30,read:''});feed=null;return R});
   await T('a27d',async()=>{feed={t:t.slice(-100),v:v.slice(-100)};const R=await run({id:'dd',m:ddv,read:''});feed=null;return R});
   await T('a27p',async()=>{feed={t:t.slice(-120),v:v.slice(-120)};const R=await run({id:'pi',m:1,read:''});feed=null;return R})}
  finally{SIGD=keep;window.liveBTC=keepL;window.bnDaily=keepB;window.cbDaily=keepC;window.J=keepJ}}
 return o});
const has=(R,st,re)=>Array.isArray(R)&&R.some(x=>x[0]===st&&re.test(x[1]));const none=(R,re)=>Array.isArray(R)&&!R.some(x=>re.test(x[1]));
ok(r.k3&&r.k3.inc&&r.k3.valid&&r.k3.n===6,'#3 candle validation: NaN/negative/high<low/duplicate/backwards rows dropped (6 of 10 kept)',r.k3);
ok(r.k5&&r.k5.got===true,'#5 chart auto-refresh fetches newer candles (not just a redraw)',r.k5);
ok(r.k6&&r.k6.n===2400&&r.k6.inc&&r.k6.pages===3&&r.k6.first,'#6 history paging: 3 pages of Binance candles stitched in order, overlap removed, full span',r.k6);
ok(r.k10&&r.k10.fresh===true,'#10 macro: macro.json re-read after the cache TTL (a long-open page picks up new FRED data)',r.k10);
ok(r.k11&&r.k11.fresh===true,'#11 derivs: derivs.json re-read after the cache TTL',r.k11);
ok(r.k12&&r.k12.mac&&r.k12.dv&&r.k12.df&&r.k12.kl&&r.k12.sig,'#12 manual refresh drops every cached dataset (signals, macro, derivs, data files, candles)',r.k12);
ok(r.k15&&r.k15.a==='GitHub raw (fallback)'&&r.k15.c==='cached copy (offline)','#15 live-fallback label: fallback host and offline copy are labelled as such',r.k15);
ok(r.k16&&r.k16.src==='Coinbase'&&r.k16.n>0,'#16 source attribution: BTC history served by the Coinbase fallback is labelled Coinbase, not Binance',r.k16);
ok(typeof r.k18==='string'&&/— at constant FX/.test(r.k18)&&!/n\/a|NaN|0\.0% at constant/.test(r.k18),"#18 constant-FX M2 missing reads '—' (never n/a or 0)",r.k18);
ok(r.k19&&r.k19.read&&!/9\.99/.test(r.k19.read)&&!/9\.99/.test(r.k19.src||''),'#19 real yield: nominal and real yields read on their last common date (no mixing days)',r.k19);
ok(r.k23&&!r.k23.e&&r.k23.v===null,'#23 altseason: no usable breadth rows gives no reading (null), no crash',r.k23);
ok(r.k24&&r.k24.eth&&r.k24.keptP,'#24 partial source recovery: fresh coin histories used when the long-term BTC source fails (old BTC history kept)',r.k24);
ok(r.a25&&r.a25.cb>0&&has(r.a25.R,'ok',/Coinbase \(independent/)&&none(r.a25.R,/Binance's own/),'#25 independent audits: chart on Binance -> recompute from Coinbase, labelled independent',r.a25);
ok(has(r.a26i,'ok',/closes through/)&&none(r.a26i,/^Recomputed.*\bbad\b/),'#26 audit date alignment: recompute ends on the chart\'s last close date',r.a26i);
ok(has(r.a26e,'ok',/Coinbase's \d+ \w+ \d{4} close/),'#26 audit date alignment: ETH/BTC compared with the Coinbase daily close on the chart date, not a live quote',r.a26e);
ok(has(r.a26g,'ok',/Coinbase's \d+ \w+ \d{4} closes/),'#26 audit date alignment: BTC-in-gold compared with Coinbase daily closes on the chart date, not live quotes',r.a26g);
ok(has(r.a27d,'warn',/too short/i)&&!(r.a27d||[]).some(x=>x[0]==='bad'),'#27 audit history validation: history that starts after the ATH gives a clear warning, no invalid drawdown',r.a27d);
ok(has(r.a27p,'warn',/needs 350/)&&!(r.a27p||[]).some(x=>x[0]==='bad'||(x[0]==='ok'&&/Recomputed/.test(x[1]))),'#27 audit history validation: 120 closes for a 350-day indicator -> clear warning naming what is needed',r.a27p);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
