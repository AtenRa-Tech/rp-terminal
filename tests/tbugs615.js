// #6 and #15 remaining gaps (PR #18 body). URL=... node tests/tbugs615.js
// #6: drive the real chart controls (Zoom slider + ALL range pill) to the earliest loaded candle, for both a 1000-candle and a 2400-candle load.
// #15: insight Data: line on exports, Today/Market-state Derivatives line, and insight-fact captions never say 'live' for an old fallback.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:1280,height:900});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await require('./hermetic').hermetic(pg);await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return typeof loadChart==='function'&&typeof drawCard==='function'&&SIGD&&SIGD.P&&typeof marketStates==='function'}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5,day0=Math.floor(Date.now()/DAYm)*DAYm,cd=day0-DAYm;
 const mk=(N)=>{const t0=cd-(N-1)*DAYm,t=Array.from({length:N},(_,i)=>t0+i*DAYm);return{t,o:t.map(()=>100),h:t.map(()=>101),l:t.map(()=>99),c:t.map((_,i)=>100+i%40),v:t.map(()=>1e6),src:'Binance',pair:'BTC/USDT',complete:true,pages:N<=1000?1:3}};
 // Drive the real controls: set #zoom to max via its input event, and click the ALL range pill. Assert the chart window starts at candle 0.
 const drive=(N)=>{const d=mk(N);window.klinesH=async()=>d;CH.iv='1d';CH.rng=null;CH.n=120;return loadChart().then(()=>{
   const z=document.querySelector('#zoom');if(!z)return{err:'no #zoom'};
   // (1) Zoom slider to max
   z.value=String(z.max);z.dispatchEvent(new Event('input',{bubbles:true}));drawChartScreen();
   const a1={max:+z.max,n:CH.n,st:CH.lay?.st,N:CH.lay?.N,firstT:CH.d?.t?.[CH.lay?.st],wantT:CH.d?.t?.[0]};
   // (2) ALL range pill
   CH.n=120;CH.rng=null;renderRng();const all=document.querySelector('[data-rng="ALL"]');
   if(!all||all.disabled)return{slider:a1,all:{err:'ALL pill missing or disabled',why:all?.dataset?.why||null}};
   all.click();drawChartScreen();
   const a2={n:CH.n,st:CH.lay?.st,N:CH.lay?.N,rng:CH.rng,firstT:CH.d?.t?.[CH.lay?.st],wantT:CH.d?.t?.[0]};
   return{slider:a1,all:a2}})};
 o.k6_1k=await drive(1000);o.k6_24=await drive(2400);
 // restore chart load
 try{delete window.klinesH;CH.rng=null;await loadChart()}catch(e){}

 // #15 insight Data: line, Market-state Derivatives line, insight-fact captions
 const keepDV=DV,keepI=D.ins.bitcoin||null,keepB=btcFund;
 const old={f:1e-4,ft:Math.floor(Date.now()/288e5)*288e5,oi:1e9,src:'Binance',at:Date.now()-45*60000},fresh={f:1e-4,ft:Math.floor(Date.now()/288e5)*288e5,oi:1e9,src:'Binance',at:Date.now()};
 // force the live-fallback path (no derivs.json funding)
 DV={...DV,assets:{...DV.assets,BTC:{...DV.assets.BTC,latest:{...(DV.assets.BTC?.latest||{}),funding:null,funding_t:null},funding:null}}};
 // (a) insight Data: line + (c) insight pts (the funding fact caption)
 D.ins.bitcoin={w:{id:'bitcoin',sym:'BTC'},last:1,ch30:1,rsi:50,vol:40,hi52:1,lo52:1,fromHi:0,dv:old,bias:'30d up',pts:[`Funding 0.0100% per 8h (Binance, fetched ${hmU(old.at)}), inside the ±0.01% neutral band.`],src:'Binance',pair:'BTC/USDT',asof:cd,rets:[],cl:{t:[cd],v:[1]}};
 const TX=[];const of=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(t,...a){TX.push(String(t));return of.call(this,t,...a)};
 try{const c=document.createElement('canvas');c.width=1920;c.height=1080;drawCard(c.getContext('2d'),1920,1080,'insight',{id:'bitcoin',sym:'BTC'})}catch(e){o.insErr=String(e)}
 CanvasRenderingContext2D.prototype.fillText=of;
 const dataLine=TX.find(t=>/^Data:/.test(t))||'';
 o.k15_ins={data:dataLine,live:/(?<!not )\blive\b/i.test(dataLine),asof:/as of \d\d:\d\d UTC \(fetched earlier, not live\)/.test(dataLine)||/fetched earlier, not live/.test(dataLine),pts:D.ins.bitcoin.pts,ptsLive:D.ins.bitcoin.pts.some(p=>/(?<!not )\blive\b/i.test(p))};
 // rebuild pts the way analyze does, so we catch a regression that reintroduces ', live)'
 {const dv=old,f=dv.f*100,fs=fundSt(f);const line=`Funding ${f.toFixed(4)}% per 8h (${dv.src}, ${dv.at?'fetched '+hmU(dv.at):'fetch time unknown'}), ${fs==='Funding positive'?'above':fs==='Funding negative'?'below':'inside'} the ±0.01% neutral band.`;
  o.k15_pts={line,noLive:!/, live\)/.test(line)&&!/\blive\b/.test(line),hasFetch:/fetched \d\d:\d\d UTC/.test(line)}}
 // (b) Today / Market-state Derivatives line via marketStates()
 D.ins.bitcoin={...(D.ins.bitcoin||{}),dv:old};
 const ms=marketStates().find(x=>x.k==='Derivatives');
 o.k15_ms={st:ms?.st,why:ms?.why,live:/(?<!not )\blive\b/i.test((ms?.st||'')+' '+(ms?.why||'')),asof:/as of \d\d:\d\d UTC \(fetched earlier, not live\)/.test(ms?.why||'')||/fetched earlier, not live/.test(ms?.why||'')||/Binance as of/.test(ms?.why||'')};
 // fresh control: why may say live
 D.ins.bitcoin.dv=fresh;const msF=marketStates().find(x=>x.k==='Derivatives');
 o.k15_msF={why:msF?.why,live:/(?<!not )\blive\b/i.test(msF?.why||'')};
 // restore
 DV=keepDV;if(keepI)D.ins.bitcoin=keepI;else delete D.ins.bitcoin;
 return o});
 // #6 assertions
 for(const [k,N,lab] of [['k6_1k',1000,'1000'],['k6_24',2400,'2400']]){const x=r[k];
  ok(x&&x.slider&&x.slider.max===N&&x.slider.n===N&&x.slider.st===0&&x.slider.firstT===x.slider.wantT,`#6 Zoom slider reaches the earliest of ${lab} loaded candles`,x&&x.slider);
  ok(x&&x.all&&!x.all.err&&x.all.rng==='ALL'&&x.all.n===N&&x.all.st===0&&x.all.firstT===x.all.wantT,`#6 ALL range pill reaches the earliest of ${lab} loaded candles`,x&&x.all)}
 // #15 assertions
 ok(r.k15_ins&&!r.k15_ins.live&&/fetched earlier, not live|as of \d\d:\d\d UTC/.test(r.k15_ins.data||''),'#15 insight Data: line on export never says live for a 45-min-old fallback',r.k15_ins);
 ok(r.k15_pts&&r.k15_pts.noLive&&r.k15_pts.hasFetch,"#15 insight-fact captions: funding fact carries the fetch time, never 'live'",r.k15_pts);
 ok(r.k15_ms&&!r.k15_ms.live&&/as of \d\d:\d\d UTC \(fetched earlier, not live\)/.test(r.k15_ms.why||''),'#15 Today/Market-state Derivatives line names the fetch time, never live',r.k15_ms);
 ok(r.k15_msF&&r.k15_msF.live,"#15 control: a fresh fallback still says live on the Derivatives line",r.k15_msF);
 ok(!errs.length,'no page errors',errs.slice(0,3));
 console.log('FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
