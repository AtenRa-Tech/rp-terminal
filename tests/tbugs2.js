// tbugs2.js: regression tests for RP's 7 Oct 29-bug review (contact/bugs29.md, full list verbatim), tested BY NAME. Covers the bugs that had no test
// (3 5 8 10 11 12 13 14 15 19 21 24 25 26) or only a partial one (6 15 16 18 23 27). The name->test table for all 29 is in the PR and STATUS4.md.
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
 // #19 Partial macro data: a missing real-yield series must not break Market state, and the score must show which inputs are missing
 await T('k19',async()=>{try{tab('today')}catch(e){}await new Promise(r=>setTimeout(r,300));const keep=MAC.M,M=JSON.parse(JSON.stringify(MAC.M));delete M.series.DFII10;const res={};try{MAC.M=M;
   let ms=null,e=null;try{ms=marketStates()}catch(x){e=String(x)}const mc=ms&&ms.find(x=>x.k==='Macro');res.one={e,st:mc?.st,why:mc?.why,partial:mc?.partial};
   let ce=null;try{clusters()}catch(x){ce=String(x)}res.cl=ce;try{paintToday()}catch(x){res.paint=String(x)}res.chips=[...document.querySelectorAll('#todayBox .ms .msh b')].map(x=>x.textContent);
   const M2=JSON.parse(JSON.stringify(M));delete M2.series.DTWEXBGS;delete M2.global_m2;MAC.M=M2;const m2=marketStates().find(x=>x.k==='Macro');res.none={st:m2?.st,why:m2?.why}}
  finally{MAC.M=keep;try{paintToday()}catch(x){}}return res});
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

 // #3 (full definition): empty / malformed responses rejected (next provider tried), UTC grid alignment, gaps counted and named on the Data line
 await T('k3b',async()=>{const keepJ=window.J,o3={};const t0=cd-12*DAYm;try{
   window.J=async u=>{if(/binance/.test(u))return[];if(/coingecko.*ohlc/.test(u)){const e=Math.floor(Date.now()/144e5)*144e5;return Array.from({length:30},(_,i)=>{const c=e-(29-i)*144e5;return[c,10,11,9,10.5]})}throw new Error('x')};D.kl={};
   const a=await klines({id:'zz3a',sym:'zz3a'},'4h',30);o3.empty4h={src:a.src,n:a.t.length};
   window.J=async u=>{if(/binance/.test(u))return{code:-1121,msg:'Invalid symbol.'};throw new Error('x')};D.kl={};let e1=null;try{await klines({id:'zz3b',sym:'zz3b'},'1d',10)}catch(x){e1=String(x)}o3.malformed=e1;
   window.J=async u=>{if(/binance/.test(u))return[];throw new Error('x')};D.kl={};let e2=null,v2=null;try{v2=await klines({id:'zz3c',sym:'zz3c'},'1d',10)}catch(x){e2=String(x)}o3.empty1d={e:e2,v:v2&&v2.t.length};
   const rows=[row(t0,10,11,9,10.5),row(t0+DAYm+36e5,10.5,12,10,11),row(t0+2*DAYm,11,12,10,11.5),row(t0+5*DAYm,11.5,12.5,11,12),row(t0+6*DAYm,12,13,11.5,12.5)];
   window.J=async u=>/klines/.test(u)?rows:keepJ(u);D.kl={};const g=await klines({id:'zz3d',sym:'zz3d'},'1d',10);o3.grid={n:g.t.length,offGrid:g.t.some(t=>t%DAYm),gaps:g.gaps,dropped:g.dropped,line:chDataTxt(g,'1d')};
   const mon=Date.UTC(2026,8,7),wk=[row(mon,1,2,.5,1.5),row(mon+7*DAYm+DAYm,1.5,2,1,1.6),row(mon+14*DAYm,1.6,2,1,1.7)];window.J=async u=>/klines/.test(u)?wk:keepJ(u);D.kl={};const w=await klines({id:'zz3e',sym:'zz3e'},'1w',10);o3.week={n:w.t.length,mon:w.t.every(t=>new Date(t).getUTCDay()===1)}
  }finally{window.J=keepJ;D.kl={}}return o3});
 // #6 History display: everything loaded (up to 3 x 1000 candles) is reachable; the zoom is not capped at 500
 await T('k6b',async()=>{try{tab('chart')}catch(e){}const keep=window.klinesH,N=2400,t0=cd-(N-1)*DAYm,t=Array.from({length:N},(_,i)=>t0+i*DAYm),c=t.map((_,i)=>100+i%50);
   window.klinesH=async()=>({t,o:c,h:c.map(x=>x+1),l:c.map(x=>x-1),c,v:c.map(()=>1),src:'Binance',pair:'BTC/USDT',complete:true,pages:3});const keepRng=CH.rng;CH.rng=null;
   try{await loadChart();const z=document.querySelector('#zoom');const max=+z.max;z.value=String(max);z.dispatchEvent(new Event('input'));const lay=CH.lay;return{max,n:CH.n,st:lay?.st,N:lay?.N}}finally{window.klinesH=keep;CH.rng=keepRng;try{await loadChart()}catch(e){}}});
 // #8 Halving chart layout: elapsed-day labels never overlap and no text (legend included) is clipped, phone card and exports
 await T('k8',async()=>{const s=(SIG||[]).find(x=>x.id==='halv');if(!s)return{err:'no halving card'};const P=CanvasRenderingContext2D.prototype,of=P.fillText,res=[];
   for(const [W,H] of [[824,464],[1600,900],[3840,2160],[1080,1350]]){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d'),T0=[];
     P.fillText=function(t,x,y,...a){const w=this.measureText(String(t)).width,al=this.textAlign,x0=al==='center'?x-w/2:(al==='right'||al==='end')?x-w:x;T0.push({t:String(t),x0,x1:x0+w,y:Math.round(y)});return of.call(this,t,x,y,...a)};
     try{drawSig(ctx,W,H,s)}finally{P.fillText=of}
     const days=T0.filter(x=>/^\d{1,4}$/.test(x.t));const byY={};days.forEach(x=>(byY[x.y]=byY[x.y]||[]).push(x));let ov=[];Object.values(byY).forEach(g=>{g.sort((a,b)=>a.x0-b.x0);for(let i=1;i<g.length;i++)if(g[i].x0<g[i-1].x1-0.5)ov.push(g[i-1].t+'/'+g[i].t)});
     const clip=T0.filter(x=>x.x0<-1||x.x1>W+1||x.y<0||x.y>H+2).map(x=>x.t.slice(0,30));res.push({W,H,days:days.length,ov,clip})}
   return res});
 // #13 Offline status: a failed fetch never leaves the in-memory copy labelled 'live'
 await T('k13',async()=>{const keepF=window.fetch;let a,c;try{window.fetch=async()=>new Response(JSON.stringify({z:1}),{status:200});a=(await dataFile('zz13',true)).src;window.fetch=async()=>{throw new Error('down')};c=(await dataFile('zz13',true)).src}finally{window.fetch=keepF;delete DF.zz13;delete localStorage.rpd_zz13}return{a,c}});
 // #14 Derivatives freshness: a newly written derivs.json does not make old funding/OI observations fresh (each metric's newest point decides)
 await T('k14',async()=>{const now=Date.now(),H=36e5,raw={updated:new Date(now).toISOString(),assets:{BTC:{funding:{source:'OKX',points:[[now-20*H,1e-4]]},oi_hourly:{source:'OKX',points:[[now-5*H,1e9,1e4]]},oi_daily:{source:'OKX',points:[[now-30*H,1e9,1e4]]},basis_hourly:{source:'OKX',points:[[now-H,1,1,0.1]]},latest:{funding_t:now-20*H,funding:1e-4,oi_t:now-5*H,oi_usd:1e9,oi_coin:1e4,basis_t:now-H,basis_pct:0.1}}}};
   const keep={...STALEM};const g=gateDV(raw);const o14={fund:!!STALEM['BTC funding'],oi:!!STALEM['BTC oi'],basis:!!STALEM['BTC basis'],fl:g.assets.BTC.latest.funding,ol:g.assets.BTC.latest.oi_usd,bl:g.assets.BTC.latest.basis_pct,hasF:!!g.assets.BTC.funding};
   for(const k of Object.keys(STALEM))delete STALEM[k];Object.assign(STALEM,keep);gateDV(DVRAW);return o14});
 // #15 Live fallback freshness: an old live-feed derivatives reading (the fallback when derivs.json is stale) is not labelled live
 await T('k15b',async()=>{const keepDV=DV,keepI=D.ins.bitcoin;const o15={};try{DV={...DV,assets:{...DV.assets,BTC:{...DV.assets.BTC,latest:{...DV.assets.BTC.latest,funding:null}}}};
   D.ins.bitcoin={...(keepI||{}),dv:{f:1e-4,oi:1e9,src:'Binance',at:Date.now()-45*60000}};o15.old=btcFund()?.src;D.ins.bitcoin={...(keepI||{}),dv:{f:1e-4,oi:1e9,src:'Binance',at:Date.now()}};o15.fresh=btcFund()?.src;
   D.ins.bitcoin={...(keepI||{}),dv:{f:1e-4,oi:1e9,src:'Binance'}};o15.noTime=btcFund()?.src}finally{DV=keepDV;if(keepI)D.ins.bitcoin=keepI;else delete D.ins.bitcoin}return o15});
 // #16 (full definition): ratio and filtered series keep their provider; captions/labels follow the provider (Coinbase fallback)
 await T('k16b',async()=>{const d0=SIGD,cb=x=>x?{...x,src:'Coinbase'}:x,CL={BTC:cb(d0.CL.BTC),ETH:cb(d0.CL.ETH),LINK:d0.CL.LINK?{...d0.CL.LINK,src:'Binance'}:null};const d={...d0,CL,EB:alignR(CL.ETH,CL.BTC)};
   const L=buildSignals(d);const rv=L.find(x=>/^rv\d+ETH$/.test(x.id))||L.find(x=>/^rv/.test(x.id)&&x.asset!=='BTC')||L.find(x=>/^rv/.test(x.id)),eb=L.find(x=>x.id==='ethbtc'),lk=L.find(x=>x.id==='linkbtc');
   let caps=[];if(rv){try{const F=sigFacts({...rv,om:rv.om||oppMeta(rv.msPre||{t:[0,1],a:[1,1],dir:'abs'},'abs',Infinity)});caps=Object.values(CAPT.vol).flat().map(f=>{try{return f(F)}catch(e){return''}})}catch(e){caps=['ERR '+e]}}
   const keep=SIGD;SIGD=d;let ms;try{ms=marketStates().filter(x=>x.k==='BTC'||x.k==='ETH').map(x=>x.why)}finally{SIGD=keep}
   const r1=alignR({t:[cd],v:[2],src:'Coinbase'},{t:[cd],v:[1],src:'Binance'});
   return{ratio:{src:r1.src,pair:r1.pair},eb:eb?.src,ebCap:eb?.cap,rv:rv?{id:rv.id,src:rv.src,title:rv.title,cap:rv.cap}:null,lk:lk?.src,caps:caps.filter(x=>/Binance/.test(x)).slice(0,3),capsN:caps.length,capsCb:caps.filter(x=>/Coinbase/.test(x)).length,ms}});
 // #21 ETF trading-day windows: holiday rows without published fund readings never count as trading days (7-day sums use 7 published days)
 await T('k21',async()=>{const keep=NX.etf;const mk=(d,t,pend=false)=>({date:d,total:t,funds:{IBIT:t},pending:pend});const ds=['2026-09-24','2026-09-25','2026-09-26','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-05','2026-10-06'];
   const days=a=>[...ds.slice(0,6).map((d,i)=>mk(d,a+i)),mk('2026-10-01x',null),...ds.slice(6).map((d,i)=>mk(d,a+6+i)),mk('2026-10-07',null,true)].map(x=>x.date==='2026-10-01x'?{...x,date:'2026-10-03'}:x);
   const E={updated:new Date().toISOString(),last_date:'2026-10-06',datasets:{btc:{days:days(10)},eth:{days:days(1)}}};
   // holiday row (2026-10-03) carries no fund readings: total null, not pending
   const st=etfStats(E,'btc'),m=etfComb(E);NX.etf=E;let e7=null;const keepS=window.etfStale;try{e7=(()=>{const k=[...m.keys()].sort();return k.slice(-7).reduce((s,x)=>s+m.get(x),0)})()}finally{NX.etf=keep}
   const want7=[12,13,14,15,16,17,18].reduce((s,x)=>s+x,0),wantC=[12,13,14,15,16,17,18].reduce((s,x)=>s+x+(x-9),0);
   const E2={...E,datasets:{btc:{days:E.datasets.btc.days.map(x=>x.total==null?x:{...x,total:String(x.total)})},eth:E.datasets.eth}};const m2=etfComb(E2);
   return{n:st.days.length,s7:st.s7,want7,hol:st.days.some(x=>x.date==='2026-10-03'),comb:[...m.keys()].includes('2026-10-03'),e7,wantC,strN:m2.size,n2:m.size}});
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
ok(r.k19&&r.k19.one&&!r.k19.one.e&&!r.k19.cl&&!r.k19.paint&&r.k19.one.st&&r.k19.one.st!=='No data'&&!/NaN|undefined/.test(r.k19.one.st+r.k19.one.why)&&r.k19.chips.includes('Macro'),'#19 Partial macro data: DFII10 missing -> Market state still renders (Macro chip from the inputs present, no NaN, no crash)',r.k19);
ok(r.k19&&r.k19.one&&/Score [+−-]?\d+ from 2 of 3 inputs \(missing: 10Y real yield \(FRED DFII10\)\)/.test(r.k19.one.why||'')&&/10Y real yield —/.test(r.k19.one.why||'')&&(r.k19.one.partial||[]).length===1,"#19 Partial macro data: the score says how many inputs it used and names the missing one ('Score +n from 2 of 3 inputs (missing: 10Y real yield (FRED DFII10))')",r.k19&&r.k19.one);
ok(r.k19&&r.k19.none&&r.k19.none.st==='No data'&&/all missing/.test(r.k19.none.why||''),'#19 Partial macro data: every macro input missing -> Macro chip says No data and why (no score from nothing)',r.k19&&r.k19.none);
ok(r.k23&&!r.k23.e&&r.k23.v===null,'#23 altseason: no usable breadth rows gives no reading (null), no crash',r.k23);
ok(r.k24&&r.k24.eth&&r.k24.keptP,'#24 partial source recovery: fresh coin histories used when the long-term BTC source fails (old BTC history kept)',r.k24);
ok(r.a25&&r.a25.cb>0&&has(r.a25.R,'ok',/Coinbase \(independent/)&&none(r.a25.R,/Binance's own/),'#25 independent audits: chart on Binance -> recompute from Coinbase, labelled independent',r.a25);
ok(has(r.a26i,'ok',/closes through/)&&none(r.a26i,/^Recomputed.*\bbad\b/),'#26 audit date alignment: recompute ends on the chart\'s last close date',r.a26i);
ok(has(r.a26e,'ok',/Coinbase's \d+ \w+ \d{4} close/),'#26 audit date alignment: ETH/BTC compared with the Coinbase daily close on the chart date, not a live quote',r.a26e);
ok(has(r.a26g,'ok',/Coinbase's \d+ \w+ \d{4} closes/),'#26 audit date alignment: BTC-in-gold compared with Coinbase daily closes on the chart date, not live quotes',r.a26g);
ok(has(r.a27d,'warn',/too short/i)&&!(r.a27d||[]).some(x=>x[0]==='bad'),'#27 audit history validation: history that starts after the ATH gives a clear warning, no invalid drawdown',r.a27d);
ok(has(r.a27p,'warn',/needs 350/)&&!(r.a27p||[]).some(x=>x[0]==='bad'||(x[0]==='ok'&&/Recomputed/.test(x[1]))),'#27 audit history validation: 120 closes for a 350-day indicator -> clear warning naming what is needed',r.a27p);
ok(r.k3b&&r.k3b.empty4h&&r.k3b.empty4h.src==='CoinGecko'&&r.k3b.empty4h.n>0,'#3 candle validation: an empty exchange response is rejected and the next provider is tried (4h -> CoinGecko)',r.k3b&&r.k3b.empty4h);
ok(r.k3b&&/malformed|empty|no valid|CoinGecko OHLC has no/.test(r.k3b.malformed||'')&&r.k3b.empty1d&&r.k3b.empty1d.e&&r.k3b.empty1d.v==null,'#3 candle validation: malformed or empty responses never become an (empty) candle series',r.k3b);
ok(r.k3b&&r.k3b.grid&&r.k3b.grid.n===4&&!r.k3b.grid.offGrid&&r.k3b.grid.dropped===1&&r.k3b.grid.gaps===3&&/3 missing candles \(exchange gap, not filled\) · 1 invalid candle dropped · rendered/.test(r.k3b.grid.line),'#3 candle validation: off-UTC-grid candle dropped, history gaps counted and named on the Data line (never filled)',r.k3b&&r.k3b.grid);
ok(r.k3b&&r.k3b.week&&r.k3b.week.n===2&&r.k3b.week.mon,'#3 candle validation: weekly candles must open Monday 00:00 UTC (misaligned week dropped)',r.k3b&&r.k3b.week);
ok(r.k6b&&r.k6b.max===2400&&r.k6b.n===2400&&r.k6b.st===0&&r.k6b.N===2400,'#6 history display: zoom reaches every loaded candle (2400 > 500 cap), full zoom draws all of them',r.k6b);
ok(Array.isArray(r.k8)&&r.k8.length===4&&r.k8.every(x=>x.days>=3&&!x.ov.length&&!x.clip.length),'#8 halving chart layout: elapsed-day labels do not overlap and no text/legend is clipped (phone card, 16:9, 4K, 4:5)',r.k8);
ok(r.k13&&r.k13.a==='live'&&r.k13.c==='cached copy (offline)','#13 offline status: after a failed fetch the existing copy is labelled "cached copy (offline)", not live',r.k13);
ok(r.k14&&r.k14.fund&&r.k14.oi&&!r.k14.basis&&r.k14.fl==null&&r.k14.ol==null&&r.k14.bl===0.1&&!r.k14.hasF,'#14 derivatives freshness: a freshly written file with 20h-old funding and 5h-old OI marks both stale and drops them (fresh basis kept)',r.k14);
ok(r.k15b&&/Binance as of \d\d:\d\d UTC \(fetched earlier, not live\)/.test(r.k15b.old||'')&&!/Binance live/.test(r.k15b.old||'')&&/Binance live/.test(r.k15b.fresh||'')&&/not live/.test(r.k15b.noTime||''),'#15 live fallback freshness: an old live-feed derivatives reading is labelled with its time, never "live"',r.k15b);
ok(r.k16b&&r.k16b.ratio.src==='Coinbase / Binance'&&r.k16b.ratio.pair[0]==='Coinbase'&&/^Coinbase ETH-USD ÷ BTC-USD/.test(r.k16b.eb||'')&&/\(Coinbase,/.test(r.k16b.ebCap||'')&&r.k16b.rv&&/^Coinbase \w+-USD daily closes/.test(r.k16b.rv.src)&&/Coinbase closes/.test(r.k16b.rv.title)&&!/Binance/.test(r.k16b.rv.cap)&&(!r.k16b.lk||/^Binance LINKUSDT ÷ Coinbase BTC-USD/.test(r.k16b.lk))&&!r.k16b.caps.length&&r.k16b.capsCb>0&&r.k16b.ms.every(w=>/\(Coinbase closes\)/.test(w)),'#16 source attribution: ratios keep provider metadata; cards, captions and Market state name Coinbase when Coinbase supplied the data',r.k16b&&{lk:r.k16b.lk,caps:r.k16b.caps,capsN:r.k16b.capsN,capsCb:r.k16b.capsCb,ms:r.k16b.ms});
ok(r.k21&&r.k21.n===9&&!r.k21.hol&&!r.k21.comb&&r.k21.s7===r.k21.want7&&r.k21.e7===r.k21.wantC&&r.k21.strN===r.k21.n2,'#21 ETF trading-day windows: a holiday row with no fund readings is not a trading day (7-day sums = 7 published days; numeric strings kept)',r.k21);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
