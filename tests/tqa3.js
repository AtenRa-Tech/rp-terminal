// tqa3.js — QA batch 3 regression tests: C14 (one POST NOW count), N11 (M2 one since-claim), export text (as-of + own sources, no internal paths),
// date axes on every chart/export (last label = last data point, calendar ticks, year on first label + year change, no overlap),
// @RPTIME in the header of every chart/export, Chart tab header (live OHLC/RSI/MACD, EMA values at last close, Data line), nice price steps inside the price panel.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof drawChart==='function'&&typeof tab==='function',{timeout:60000});
for(const t of ['today','signals','macro','markets','chart','studio','markets']){await pg.evaluate(t=>{try{tab(t)}catch(e){}},t);await new Promise(r=>setTimeout(r,t==='signals'?15000:5000))}
await pg.evaluate(()=>tab('today'));await new Promise(r=>setTimeout(r,4000));
const R=await pg.evaluate(async()=>{const out={};const T=(k,f)=>{try{out[k]=f()}catch(e){out[k]={pass:false,err:String(e.stack||e).slice(0,300)}}};
 // capture all canvas text + axis logs for one render
 const orig=CanvasRenderingContext2D.prototype.fillText;let TX=[];CanvasRenderingContext2D.prototype.fillText=function(t,...a){TX.push(String(t));return orig.call(this,t,...a)};
 const run=(fn,w,h)=>{TX=[];window.AXLOG=[];const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const r={tx:TX.slice(),ax:window.AXLOG.slice()};window.AXLOG=null;return r};
 const dayLab=t=>axFull(t,false);
 const axOK=(ax,o={})=>{const bad=[];const A=ax.filter(a=>a.fn==='plot'&&a.date!==false||a.fn==='chart'||a.fn==='axis');
   for(const a of A){if(a.last!==axFull(a.lastT,a.intra))bad.push('last label '+a.last+' != '+axFull(a.lastT,a.intra));
     if(Math.abs(a.lastT-a.dataLast)>1000)bad.push('axis end '+new Date(a.lastT).toISOString()+' != data end '+new Date(a.dataLast).toISOString());
     for(let i=1;i<a.boxes.length;i++)if(a.boxes[i][0]<a.boxes[i-1][1])bad.push('overlap '+a.labels[i-1]+'|'+a.labels[i]);
     if(a.boxes.length&&a.boxes.at(-1)[1]>a.xMax+1)bad.push('last label past right edge');
     if(a.labels.length>1&&!a.intra&&a.k!=='y'&&!/\d{4}$/.test(a.labels[0]))bad.push('no year on first label '+a.labels[0]);
     for(let i=1;i<a.ticks.length-1;i++){const y0=new Date(a.ticks[i-1]).getUTCFullYear(),y1=new Date(a.ticks[i]).getUTCFullYear();if(y1!==y0&&!a.intra&&!/\d{4}$/.test(a.labels[i]))bad.push('year change without year '+a.labels[i])}}
   for(const a of ax.filter(a=>a.fn==='bars'&&a.lastT!=null)){const want=a.mon?calLab(a.lastT,'m',true):axFull(a.lastT);if(a.last!==want)bad.push('bars last '+a.last+' != '+want);for(let i=1;i<a.boxes.length;i++)if(a.boxes[i][0]<a.boxes[i-1][1])bad.push('bars overlap')}
   return{n:A.length,bad}};
 const textOK=(tx,asof=true)=>{const bad=[],j=tx.join(' | ');if(!tx.some(t=>t.includes(HDL())))bad.push('no handle');const dl=tx.find(t=>/^Data: /.test(t));if(!dl)bad.push('no Data line');
   else{if(asof&&!/(through|as of) \d{1,2} [A-Z][a-z]{2}( \d{4}| \d\d:\d\d)|through [A-Z][a-z]{2} \d{4}|through \d{1,2} [A-Z][a-z]{2} \d{4}/.test(dl))bad.push('no as-of: '+dl);if(/data\/|\.json/.test(dl))bad.push('internal path: '+dl);if(/blockchain\.com, Binance, DefiLlama/.test(dl))bad.push('generic source')}
   if(/data\/[a-z]+\.json/.test(j))bad.push('internal path in image');return{dl,bad}};
 // ---- C14
 T('C14_same_count',()=>{tab('signals');return null});
 // ---- exports: every signal, macro, alt, ETF, DD, perf card at 4K
 const ex=[];(SIG||[]).forEach(s=>ex.push(['sig:'+s.id,(x,W,H)=>drawSig(x,W,H,s)]));(MAC.cards||[]).forEach(s=>ex.push(['mac:'+s.id,(x,W,H)=>drawSig(x,W,H,s)]));
 try{const A=altCalc&&altObj?altObj():ALTOBJ;if(A)ex.push(['alt',(x,W,H)=>drawSig(x,W,H,A)])}catch(e){if(ALTOBJ)ex.push(['alt',(x,W,H)=>drawSig(x,W,H,ALTOBJ)])}
 if(NX.etf)['btc','eth'].forEach(a=>ex.push(['etf:'+a,(x,W,H)=>drawEtf(x,W,H,a)]));if(SIGD?.CL?.BTC){ex.push(['dd:BTC',(x,W,H)=>drawDD(x,W,H,'BTC')]);ex.push(['perf:BTC',(x,W,H)=>drawPerf(x,W,H,'BTC')])}
 out.EXPORT_COUNT={n:ex.length,ids:ex.map(e=>e[0]),pass:ex.length>=25};
 for(const [id,fn] of ex)T('EX_'+id,()=>{const r=run(fn,3840,2160),t=textOK(r.tx),a=axOK(r.ax);const wm=r.ax.some(x=>x.fn==='wm')||r.tx.some(z=>z.includes(HDL()));return{dl:t.dl,axes:a.n,bad:[...t.bad,...a.bad,...(wm?[]:['no watermark'])],pass:!t.bad.length&&!a.bad.length&&wm}});
 // handle fallback: blank handle still draws @RPTIME
 T('WM_blank_handle_fallback',()=>{const h=S.handle;S.handle='';const r=run((x,W,H)=>drawSig(x,W,H,SIG[0]),1920,1080);S.handle=h;return{pass:r.tx.some(t=>t.includes('@RPTIME'))}});
 // ---- Chart tab: synthetic candles for every timeframe, ending at an open candle now, at 3 phone widths + 4K export
 const ivMs={'15m':9e5,'1h':36e5,'4h':144e5,'1d':864e5,'1w':6048e5};
 const syn=(iv,n)=>{const st=ivMs[iv],t1=Math.floor(Date.now()/st)*st- (iv==='1w'?((new Date(Math.floor(Date.now()/864e5)*864e5).getUTCDay()+6)%7)*864e5-0:0);const t=[],o=[],h=[],l=[],c=[],v=[];let px=60000;for(let i=n-1;i>=0;i--){const tt=iv==='1w'?(()=>{const d=Math.floor(Date.now()/864e5)*864e5;return d-((new Date(d).getUTCDay()+6)%7)*864e5-i*6048e5})():t1-i*st;const op=px;px*=1+Math.sin(i/7)*.01+.002;t.push(tt);o.push(op);c.push(px);h.push(Math.max(op,px)*1.01);l.push(Math.min(op,px)*.99);v.push(100+i%17)}return{t,o,h,l,c,v,src:'Binance',pair:'BTC/USDT'}};
 for(const iv of Object.keys(ivMs))for(const [w,hh] of [[360*2,520*2],[412*2,560*2],[430*2,580*2],[3840,2160]])T(`CH_${iv}_${w}`,()=>{const d=syn(iv,500),o={...CH,iv,d,n:iv==='1d'?460:Math.min(CH.n||200,300),cross:null,ind:{...CH.ind,EMA:true,VOL:true,RSI:true,MACD:true}};const r=run((x,W,H)=>drawChart(x,W,H,o),w,hh);
   const a=axOK(r.ax),hd=r.ax.find(z=>z.fn==='chartHdr'),pr=r.ax.find(z=>z.fn==='price'),md=r.ax.find(z=>z.fn==='macdHdr'),rs=r.ax.find(z=>z.fn==='rsiHdr'),bad=[...a.bad];
   if(!hd)bad.push('no header');else{if(!/^live \d\d:\d\d UTC$/.test(hd.tag))bad.push('OHLC not tagged live: '+hd.tag);if(hd.handle!==HDL()||!r.tx.includes(HDL()))bad.push('no handle');if(!/^Data: Binance BTCUSDT .* candles through .* · rendered \d{1,2} [A-Z][a-z]{2} \d\d:\d\d UTC$/.test(hd.data))bad.push('data line '+hd.data);
     if(!hd.ema||!/^EMA20 [\d.,]+k?$/.test(hd.ema[0]))bad.push('ema legend '+hd.ema);if(hd.emaIdx!==hd.N-2)bad.push('EMA not on last completed close')}
   if(!md||!/MACD\(12,26,9\) \S+ · signal \S+ · hist \S+ · live/.test(md.text))bad.push('macd hdr '+(md&&md.text));if(!rs||!/^live/.test(rs.tag))bad.push('rsi tag');
   if(!pr||!pr.ticks.length)bad.push('no price ticks');else{const f=pr.step/10**Math.floor(Math.log10(pr.step));if(![1,2,2.5,5,10].some(x=>Math.abs(x-f)<1e-9))bad.push('step not nice '+pr.step);if(pr.ticks.some(t=>t.y>pr.volTop||t.y<pr.top))bad.push('price label outside price panel')}
   const ax=r.ax.find(z=>z.fn==='chart');return{labels:ax&&ax.labels,price:pr&&pr.ticks.map(t=>t.lab),bad,pass:!bad.length&&a.n===1}});
 // real Chart tab data if loaded
 T('CH_live_1d',()=>{if(!CH.d)return{pass:true,skip:'no live candles'};const r=run((x,W,H)=>drawChart(x,W,H,{...CH,cross:null}),824,1120),a=axOK(r.ax),ax=r.ax.find(z=>z.fn==='chart');return{labels:ax.labels,bad:a.bad,pass:!a.bad.length&&ax.lastT===CH.d.t.at(-1)}});
 // month-boundary rule: 15 months of daily candles -> month starts, year on first + January
 T('AX_month_boundaries',()=>{const t1=Date.UTC(2026,9,2),t0=Date.UTC(2025,6,1);const c=document.createElement('canvas').getContext('2d');c.font='15px sans-serif';window.AXLOG=[];const L=timeAxis(c,{t0,t1,xOf:t=>(t-t0)/(t1-t0)*1000,xMin:0,xMax:1000,y:0,col:'#fff'});window.AXLOG=null;const labs=L.map(x=>x.lab);
   const ok=labs[0]==='Jul 2025'&&labs.includes('Jan 2026')&&labs.at(-1)==='2 Oct 2026'&&labs.slice(1,-1).every(l=>/^[A-Z][a-z]{2}$/.test(l)||l==='Jan 2026');return{labs,pass:ok}});
 CanvasRenderingContext2D.prototype.fillText=orig;return out});
// C14 needs both tabs rendered with the shared function
const c14=await pg.evaluate(async()=>{await renderSignals();const a=document.querySelector('#sigTop [data-pnc]')?.textContent;tab('today');await new Promise(r=>setTimeout(r,3000));const b=document.querySelector('#postCnt [data-pnc]')?.textContent;const m=s=>(s||'').match(/^(\d+) of (\d+) charts/);return{a,b,pass:!!a&&a===b&&!!m(a)&&+m(a)[2]===todayItems().length}});R.C14_same_count=c14;
// N11
R.N11_m2_one_since=await pg.evaluate(()=>{const caps=STY.flatMap(([st])=>CAPT.macro[st].map(fn=>tidy(fn(macFacts(MAC.cards.find(c=>c.id==='btcm2'))))));const bad=caps.filter(t=>(t.match(/\b(lowest|highest) (since|in the data)/g)||[]).length>1||/highest since May 2026/.test(t));const want=caps.find(t=>/growth at constant FX is [+−-]\d+\.\d% a year, the (lowest|highest) since [A-Z][a-z]{2} \d{4} \([+−-]\d+\.\d% in USD\)/.test(t));return{example:want,bad,pass:!bad.length&&!!want}});
// ---- final scope: stamp on every image path, missing values, drawdown basis, URL safety, insight wording, M2 lag, watchlist, F&G, heatmap, corr, trending
Object.assign(R,await pg.evaluate(async()=>{const out={};const T=(k,f)=>{try{out[k]=f()}catch(e){out[k]={pass:false,err:String(e.stack||e).slice(0,300)}}};
 const P=CanvasRenderingContext2D.prototype,of=P.fillText;let TX=[];P.fillText=function(t,...a){TX.push(String(t));return of.call(this,t,...a)};
 const run=(fn,w=1920,h=1080)=>{TX=[];window.AXLOG=[];let err=null;try{render8k(fn,w,h)}catch(e){err=String(e)}const ax=window.AXLOG;window.AXLOG=null;return{tx:TX.slice(),ax,err}};
 const paths=[['card-price',(x,W,H)=>drawCard(x,W,H,'price',S.watch[0])],['card-insight',(x,W,H)=>drawCard(x,W,H,'insight',S.watch[0])],['card-pulse',(x,W,H)=>drawCard(x,W,H,'pulse')],['corr',drawCorr],['heat',(x,W,H)=>drawHeat(x,W,H,true)],['chart',(x,W,H)=>drawCard(x,W,H,'chart')],['studio',drawStudio]];
 (SIG||[]).forEach(s=>paths.push(['sig-'+s.id,(x,W,H)=>drawSig(x,W,H,s)]));(MAC.cards||[]).forEach(s=>paths.push(['mac-'+s.id,(x,W,H)=>drawSig(x,W,H,s)]));if(NX.etf)paths.push(['etf',(x,W,H)=>drawEtf(x,W,H,'btc')]);
 for(const [id,fn] of paths)T('STAMP_'+id,()=>{const r=run(fn),st=r.ax.find(a=>a.fn==='stamp')||(r.tx.find(t=>/^Data: /.test(t))&&{data:r.tx.find(t=>/^Data: /.test(t))});return{err:r.err,data:st&&st.data,pass:!r.err&&!!st&&(STAMP_RE.test(st.data)||(id==='heat'&&!heatItems().length&&/feed unavailable/.test(st.data)))&&r.tx.some(t=>t.includes(HDL()))}});
 T('STAMP_throws_without_asof',()=>{let a=false,b=false;try{stampCheck('Data: Binance')}catch(e){a=true}try{stampCheck('Signals from price')}catch(e){b=true}return{pass:a&&b}});
 T('B_pulse_missing_dominance_dash',()=>{const g=D.glob;D.glob={...(g||{}),_src:'CoinGecko',_at:Date.now(),total_market_cap:{usd:1e12},total_volume:{usd:1e11},market_cap_percentage:{btc:null,eth:null}};const r=run((x,W,H)=>drawCard(x,W,H,'pulse'));D.glob=g;return{pass:!r.err&&!r.tx.some(t=>/^0\.0%$/.test(t))&&r.tx.filter(t=>t==='—').length>=2}});
 T('B_pulse_no_mood_fng_dated',()=>{const F=mktFacts({t:'pulse'});return{ctx2:F.ctx2,pass:F.mood===''&&(!D.fng.length||/^alternative\.me index: \d+, .+, \d{1,2} [A-Z][a-z]{2}$/.test(F.ctx2))}});
 T('C_ath_on_last_close',()=>{const id=S.watch[0].id,c=D.cc[id];if(!c)return{pass:true,skip:'no closes'};const A=athOf(id);return{pass:Math.abs(A.pct-(c.last/c.ath-1)*100)<1e-9}});
 T('D_safeUrl',()=>({pass:safeUrl('javascript:alert(1)')===''&&safeUrl('http://x.com')===''&&safeUrl('data:text/html,x')===''&&safeUrl(' https://a.com/x ')==='https://a.com/x'&&esc(`"'<>&`)==='&quot;&#39;&lt;&gt;&amp;'}));
 T('D_news_js_link_never_rendered',()=>{const keep=D.news;D.news=[{title:'Test story about Zentry',desc:'',src:'X',t:Date.now()-6e5,link:'javascript:alert(1)'}];NCL=[];let h='';try{tab('news');h=document.getElementById('s-news').innerHTML}finally{D.news=keep;NCL=[]}return{pass:!/javascript:/i.test(h)}});
 T('D_trending_unsafe_thumb',()=>{const k=D.trend;D.trend=[{id:'x"onerror="alert(1)',symbol:'X',name:'<b>x</b>',thumb:'javascript:alert(1)',market_cap_rank:1}];renderTrend();const h=document.getElementById('trend').innerHTML;D.trend=k;renderTrend();return{pass:!/javascript:|<b>x|onerror="/.test(h)}});
 T('P0_insight_wording',()=>{const bad=[];Object.values(D.ins||{}).forEach(a=>a.pts.forEach(p=>{if(/regime|overbought|oversold|trend is (up|down)/i.test(p))bad.push(p)}));const r=run((x,W,H)=>drawCard(x,W,H,'insight',S.watch[0]));const L=lintBanned('RSI is 75 (overbought)',null,false);return{n:Object.keys(D.ins||{}).length,bad,pass:!bad.length&&r.tx.some(t=>/ snapshot$/.test(t))&&!r.tx.some(t=>/outlook/.test(t))&&L.length>0}});
 T('P0_insight_completed_close',()=>{const a=Object.values(D.ins||{})[0];if(!a)return{pass:true,skip:'insights not loaded'};return{asof:new Date(a.asof).toISOString(),pass:a.asof+864e5<=Date.now()}});
 T('M2_lag_shows_r_and_significance',()=>{MAC.lag=30;MAC.cards=buildMacro(MAC.M,MAC.btc);const c=MAC.cards.find(x=>x.id==='btcm2');MAC.lag=0;MAC.cards=buildMacro(MAC.M,MAC.btc);const c0=MAC.cards.find(x=>x.id==='btcm2');return{read:c&&c.read,pass:!!c&&/1-month lag r = -?\d\.\d\d.*(not significant|significant|not valid)/.test(c.read)&&/1-month lag r = /.test(c.cap)&&!/shifted/.test(c0.read)}});
 T('WL_price_unavailable_not_zero',()=>{const w=S.watch[0],keepM=D.mk[w.id],keepH=S.hold[w.id];D.mk[w.id]={...(keepM||{}),current_price:null};S.hold[w.id]={q:'2',a:'100'};renderWL();const h=document.getElementById('wl').innerHTML+document.getElementById('pf').innerHTML;D.mk[w.id]=keepM;if(keepH)S.hold[w.id]=keepH;else delete S.hold[w.id];renderWL();return{pass:/price unavailable/.test(h)&&!/\$0(\.00)?\b/.test(h)}});
 T('BullBear_removed',()=>({pass:!/Bull|Bear/.test(biasCol.toString())}));
 T('FNG_right_edge_dated',()=>{if(!D.fng.length)return{pass:true,skip:'no F&G'};window.AXLOG=[];const c=document.createElement('canvas');c.width=600;c.height=200;drawFng(c.getContext('2d'),600,200);const a=window.AXLOG.find(x=>x.fn==='fng');window.AXLOG=null;return{pass:!!a&&a.last===axFull(D.fng.at(-1).t)}});
 T('HEAT_no_stables_data_time',()=>{if(!D.top?.length)return{pass:true,skip:'no top'};const it=heatItems();return{dl:heatData(),pass:!it.some(c=>/^(usdt|usdc|dai|usde|fdusd)$/i.test(c.symbol))&&/as of \d{1,2} [A-Z][a-z]{2} \d\d:\d\d UTC/.test(heatData())&&/mcap\^0\.6/.test(heatData())}});
 T('CORR_grey_note',()=>{const r=run(drawCorr);return{pass:!r.err&&r.tx.some(t=>/\|r\| < 0\.36 not significant \(n = 30\)/i.test(t))||!Object.keys(D.ins||{}).length}});
 P.fillText=of;return out}));
let f=0;for(const[k,v]of Object.entries(R)){const ok=v&&v.pass;if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+k+' '+JSON.stringify(v).slice(0,400))}
console.log('FAILS: '+f);await b.close();process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
