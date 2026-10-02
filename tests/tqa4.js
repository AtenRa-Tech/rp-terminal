// tqa4.js — QA batch 4 regression tests (one per approved item):
// 1 draft audit uses the ONE shared word list (RPT_WORDS: news filter + lintBanned + caption sweep); regional terms and call/lean words are red, controls clean (fixtures: news-rules.json draft_audit)
// 2 Global market card names the source that supplied the totals, with its time; 3 Fear & Greed reads "alternative.me index: 72, Greed, 2 Oct" everywhere
// 4 on-screen correlation table states "30 daily returns to <last completed day>"; 5 heatmap export/share disabled until tiles have data
// 6 chart axes: every year boundary labelled on every timeframe/zoom/width; every month boundary labelled whenever a "Mmm YYYY" label fits between month starts
// 7 1W uses "week ending <date>" in legend and Data line; 8 axis price labels hidden where the last-price tag overlaps; 9 watchlist sparklines carry their period label (7d)
const p=require('puppeteer-core'),fs=require('fs');const URL=process.env.URL||'http://localhost:8765/index.html';
const FIX=JSON.parse(fs.readFileSync((process.env.FIX||__dirname+'/fixtures')+'/news-rules.json','utf8'));
const SWEEP=fs.readFileSync(__dirname+'/../qa/caption-sweep.js','utf8');
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915,deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof drawChart==='function'&&typeof tab==='function',{timeout:60000});
for(const t of ['markets','chart','studio','markets']){await pg.evaluate(t=>{try{tab(t)}catch(e){}},t);await new Promise(r=>setTimeout(r,6000))}
const R={};
R.SHARED_WORD_LIST_sweep_reads_app=(()=>{const own=/\\bIndia|rupee|\\bINR\\b/.test(SWEEP.split('\n').find(l=>/^const BANNED=/.test(l))||'');return{pass:!own&&/RPT_WORDS\.region/.test(SWEEP)&&/RPT_WORDS\.rule1/.test(SWEEP)}})();
Object.assign(R,await pg.evaluate(async(DA)=>{const out={};const T=(k,f)=>{try{out[k]=f()}catch(e){out[k]={pass:false,err:String(e.stack||e).slice(0,300)}}};
 const P=CanvasRenderingContext2D.prototype,of=P.fillText;let TX=[];P.fillText=function(t,...a){TX.push(String(t));return of.call(this,t,...a)};
 const run=(fn,W=1600,H=900)=>{TX=[];const c=document.createElement('canvas');c.width=W;c.height=H;let err=null;try{fn(c.getContext('2d'),W,H)}catch(e){err=String(e)}return{tx:TX.slice(),err}};
 T('SHARED_WORD_LIST_one_object',()=>({pass:NEWSDROP===REGION_RE&&RPT_WORDS.region===REGION_RE&&RPT_WORDS.rule1===RULE1&&lintBanned('BTC is 70 lakh',null,false).some(x=>/^Regional content/.test(x))&&!REGION_RE.test('Indicator: ETH/BTC breadth index')&&!newsKeep({title:'WazirX volumes jump',desc:''})}));
 for(const d of DA){T('DRAFT_'+d.id,()=>{const save=window.CAPF;try{window.CAPF=null}catch(e){}lintText.news=null;lintText.newsTitle=null;const R=lintText(d.draft,null);const v=verdict(R);
   const bad=R.filter(x=>x[0]==='bad').length,warn=R.filter(x=>x[0]==='warn').length;const pass=d.expect==='bad'?bad>0&&v[0]==='bad'&&/call or lean|regional/.test(v[1]):bad===0&&warn===0;return{expect:d.expect,verdict:v,items:R.filter(x=>x[0]!=='ok').map(x=>x[0]+':'+x[1].slice(0,60)),pass}})}
 T('GLOBAL_source_is_totals_supplier',()=>{const keep=D.glob,t=Date.UTC(2026,9,2,21,40);const res=[];
   for(const g of [{_src:'CoinPaprika',_at:t},{_src:'market.json (CoinGecko)',_asof:t},{_src:'CoinGecko',_at:t}]){D.glob={total_market_cap:{usd:3e12},total_volume:{usd:1e11},market_cap_change_percentage_24h_usd:1,market_cap_percentage:{btc:57,eth:12},...g};renderGlobal();res.push(document.getElementById('gUpd').textContent)}
   D.glob=keep;renderGlobal();return{res,pass:res[0]==='data: CoinPaprika · as of 21:40 UTC'&&res[1]==='data: market.json (CoinGecko) · as of 21:40 UTC'&&res[2]==='data: CoinGecko · as of 21:40 UTC'&&!res.some(x=>/Binance/.test(x))}});
 T('FNG_one_label_everywhere',()=>{const keep=D.fng;const f={v:72,c:'Greed',t:Date.UTC(2026,9,2)};D.fng=[{v:60,c:'Greed',t:f.t-864e5},f];const want='alternative.me index: 72, Greed, 2 Oct';
   const keepG=D.glob;if(!D.glob)D.glob={total_market_cap:{usd:3e12},total_volume:{usd:1e11},market_cap_percentage:{btc:57},_src:'CoinPaprika',_at:Date.now()};renderGlobal();const g=document.getElementById('gFng')?.textContent;
   const a=run(drawFng,1200,400),pu=run((x,W,H)=>drawCard(x,W,H,'pulse'),3840,2160);D.fng=keep;D.glob=keepG;renderGlobal();
   return{lbl:fngLbl(f),g,pass:fngLbl(f)===want&&g===want&&a.tx.includes(want)&&pu.tx.includes(want)}});
 T('CORR_table_window',()=>{const L=S.watch.filter(w=>D.ins[w.id]);if(!L.length)return{pass:false,err:'insights not loaded'};const el=document.getElementById('corrAsof');const asof=Math.min(...L.map(w=>D.ins[w.id].asof));
   return{txt:el&&el.textContent,pass:!!el&&el.textContent.startsWith('30 daily returns to '+axFull(asof))&&asof+864e5<=Date.now()+1}});
 T('HEAT_buttons_disabled_without_tiles',()=>{const keep=D.top;const st=document.getElementById('stType'),sv=st.value;D.top=[];renderHeat();const b1=document.querySelector('[data-x="heat"]').disabled;st.value='heat';const ok0=heatGate();const s1=['stExp','stX','stShare'].map(i=>document.getElementById(i).disabled);
   st.value='price';heatGate();const s2=['stExp','stX','stShare'].map(i=>document.getElementById(i).disabled);D.top=keep;renderHeat();const b2=document.querySelector('[data-x="heat"]').disabled;st.value=sv;heatGate();
   return{b1,s1,s2,b2,hasTiles:heatItems().length,pass:b1&&!ok0&&s1.every(Boolean)&&!s2.some(Boolean)&&(heatItems().length?b2===false:b2===true)}});
 T('SPARK_period_label',()=>{TX=[];renderWL();const cv=[...document.querySelectorAll('[data-sp]')];const drawn=cv.filter(c=>D.mk[c.dataset.sp]?.sparkline_in_7d?.price?.length);return{n:cv.length,drawn:drawn.length,pass:drawn.length>0&&drawn.every(c=>c.dataset.period==='7d')&&TX.filter(t=>t==='7d').length>=drawn.length}});
 P.fillText=of;return out},FIX.draft_audit));
// chart axes, week convention, price-tag overlap: every timeframe x zoom x width
const AX=await pg.evaluate(async()=>{const res=[];const DAY=864e5;
 for(const iv of ['15m','1h','4h','1d','1w']){CH.iv=iv;await loadChart();if(!CH.d)continue;const N=CH.d.t.length;
  for(const nn of [60,120,250,500])for(const [W,H] of [[640,1000],[720,1116],[860,1240],[3840,2160]]){if(nn>N)continue;window.AXLOG=[];const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');const of=ctx.fillText.bind(ctx);const TX=[];ctx.fillText=(t,...a)=>{TX.push(String(t));return of(t,...a)};
   drawChart(ctx,W,H,{...CH,n:nn,cross:null});const a=AXLOG.find(x=>x.fn==='chart'),pr=AXLOG.find(x=>x.fn==='price'),hd=AXLOG.find(x=>x.fn==='chartHdr');window.AXLOG=null;
   const t0=CH.d.t[N-nn],t1=a.lastT,u0=H/600,pxD=a.pxPerDay||(W-72*u0)/nn*(iv==='1w'?1/7:iv==='1d'?1:{'4h':6,'1h':24,'15m':96}[iv]),gap0=a.gap||10*u0,labs=a.labels.map((l,i)=>({l,t:a.ticks[i],last:a.last!=null&&i===a.labels.length-1}));
   const yrs=[],mos=[];{const d=new Date(t0);let y=d.getUTCFullYear(),m=d.getUTCMonth()+1;for(;;){if(m>11){m=0;y++}const bt=Date.UTC(y,m,1);if(bt>t1)break;mos.push(bt);if(m===0)yrs.push(bt);m++}}
   const inWin=(L,bt)=>L.t>=bt&&L.t<bt+7*DAY;const missY=yrs.filter(bt=>!labs.some(L=>inWin(L,bt)&&/\d{4}|’\d\d/.test(L.l))).map(x=>new Date(x).toISOString().slice(0,7));
   const missM=mos.filter(bt=>!labs.some(L=>inWin(L,bt))).map(x=>new Date(x).toISOString().slice(0,7));
   ctx.font=F(10.5*H/600,500);const fitM=pxD*28>=ctx.measureText('Sep 2026').width+gap0;
   const ov=pr.lastY==null?['(no overlap logging: old build)']:pr.ticks.filter(tk=>!pr.hidden.includes(tk.lab)&&Math.abs(tk.y-pr.lastY)<pr.tagH/2+pr.labH/2).map(t=>t.lab);
   const wk=iv==='1w'?{legend:TX.find(t=>/^at close/.test(t)),data:hd.data}:null;
   res.push({iv,nn,W,labels:a.labels.join(' | '),end:a.endMode,missY,missM,fitM,ov,wk})}}return res});
let yF=0,mF=0,mEx=0,oF=0,wF=0;for(const r of AX){if(r.missY.length){yF++;console.log('FAIL AXIS_year '+JSON.stringify(r))}
 if(r.missM.length){if(r.fitM&&r.iv!=='1w'){mF++;console.log('FAIL AXIS_month '+JSON.stringify(r))}else mEx++}
 if(r.ov.length){oF++;console.log('FAIL PRICE_TAG_overlap '+JSON.stringify(r))}
 if(r.wk){const m1=(r.wk.legend||'').match(/week ending (\d{1,2} \w{3} \d{4})/),m2=(r.wk.data||'').match(/week ending (\d{1,2} \w{3} \d{4})/);if(!m1||!m2||m1[1]!==m2[1]){wF++;console.log('FAIL WEEK_ending '+JSON.stringify(r.wk))}}}
const d120=AX.filter(r=>r.iv==='1d'&&r.nn===120);R.AXIS_years_all_timeframes={configs:AX.length,pass:AX.length>=60&&!yF};
R.AXIS_months_when_they_fit={configs:AX.length,exempt_physically_impossible:mEx,pass:!mF&&d120.length>0&&d120.every(r=>!r.missM.length)};
R.AXIS_1d_default_every_month_and_end={sample:d120.map(r=>r.W+': '+r.labels),pass:d120.length>0&&d120.every(r=>r.end!=='hidden'&&!r.missM.length)};
R.PRICE_TAG_hides_overlapping_axis_label={pass:!oF};R.WEEK_ending_convention={sample:AX.find(r=>r.wk)?.wk,pass:!wF&&AX.some(r=>r.wk)};
let f=0;for(const[k,v]of Object.entries(R)){const ok=v&&v.pass;if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+k+' '+JSON.stringify(v).slice(0,400))}
console.log('FAILS: '+f);await b.close();process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
