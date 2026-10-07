// Export gate. Usage: node export-check.js [URL]. Exit 1 = block deploy / roll back.
const {chromium}=require('playwright-core');const fs=require('fs');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(8000);
for(const t of ['markets','chart','studio','today']){await p.evaluate(t=>{try{tab(t)}catch(e){}},t);await p.waitForTimeout(5000)}
const E=await p.evaluate(()=>{const P=CanvasRenderingContext2D.prototype,of=P.fillText;let log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
 const jobs=[];try{CAPCTX=null}catch(e){}
 (S.watch||[]).slice(0,4).forEach(c=>jobs.push(['insight-'+c.sym,(x,W,H)=>drawCard(x,W,H,'insight',c),[3840,2160]]));
 jobs.push(['heatmap',(x,W,H)=>drawHeat(x,W,H,true),[3840,2160]]);
 jobs.push(['chart-'+(typeof chartCoin==='function'?chartCoin().sym:'')+'-'+(CH&&CH.iv),(x,W,H)=>drawChart(x,W,H,{...CH,cross:null}),[3840,2160]]);
 jobs.push(['pulse',(x,W,H)=>drawCard(x,W,H,'pulse'),[3840,2160]]);jobs.push(['corr',drawCorr,[3840,2160]]);
 const sel=document.querySelector('#stType'),rat=document.querySelector('#stRatio');
 const res=[];for(const [nm,fn,[w,h]] of jobs){log=[];let c,err=null;try{c=render8k(fn,w,h)}catch(e){err=String(e)}res.push({nm,w,h,err,text:log.join(' ⏐ ')})}
 for(const ty of ['price','insight','pulse','chart','heat','dd','perf'])for(const r of ['16:9','1:1','4:5']){sel.value=ty;rat.value=r;const [w,h]=SIZES[r].map(x=>x/2);log=[];let err=null;try{render8k(drawStudio,w,h)}catch(e){err=String(e)}res.push({nm:'studio-'+ty+'-'+r,w,h,err,text:log.join(' ⏐ ')})}
 P.fillText=of;let fm={};try{const d=CH.d,N=d.c.length,ms=IVMS[CH.iv]||864e5,op=N>1&&d.t[N-1]+ms>Date.now(),pl=x=>typeof plain==='function'?plain(x):String(x);fm={open:op,iv:CH.iv,fv:op?pl(d.c[N-1]):'',cv:op?pl(d.c[N-2]):'',formD:new Date(d.t[N-1]).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}}catch(e){}
 return {res,chart:{N:CH&&CH.d&&CH.d.c.length,lastT:CH&&CH.d&&CH.d.t&&new Date(CH.d.t[CH.d.t.length-1]).toISOString(),...fm}}});
await p.evaluate(()=>{try{tab('chart')}catch(e){}});await p.waitForTimeout(3000);await p.screenshot({path:'chart-live.png'});
await b.close();fs.writeFileSync('live-exports2.json',JSON.stringify(E,null,1));
const BAN=/\b(buy|sell|accumulat\w*|fire sale|value zone|bullish|bearish|supportive|headwind|BREAKING|confirmed|every cycle|always|never|in history|overbought|oversold|golden[- ]cross|death[- ]cross|strong day|rough day|quiet tape|uptrend|downtrend)\b|India|INR|₹|rupee/i;
console.log('chart data',JSON.stringify(E.chart));let fails=0;
// a lone 0.0% (missing value shown as zero) is bad; 10.0%, -20.0%, 60.0% are real readings (the old /0\.0%/ had no left boundary and failed them)
const BADV=/\bNaN\b|undefined|\bnull\b|(?<![\d.])[+−-]?0\.0%/;if(!['+0.0%','x 0.0% y','-0.0%'].every(t=>BADV.test(t))||['-10.0%','60.0%','+20.0%','1.0%'].some(t=>BADV.test(t))){console.error('export-check: BADV self-test failed');process.exit(2)}
// forming-candle rule (Crypto News GOD / RP, 7 Oct): while the last candle is still forming, a chart export's Data line states the closed-through date,
// marks the forming candle and the rendered UTC time; the forming value only appears labelled 'live' and never next to 'close'.
const CLOSEW=/\b(close[sd]?|closing)\b/i;
const formingFails=(text,ch)=>{const f=[];if(!ch||!ch.open)return f;const d=(text.match(/Data:[^⏐]*/)||[''])[0];
 if(!/forming/i.test(d))f.push('forming: Data line has no forming marker');if(!/rendered[^⏐]*\d\d:\d\d UTC/.test(d))f.push('forming: Data line has no rendered UTC time');
 if(ch.fv&&ch.fv!==ch.cv)for(const fr of text.split(' ⏐ '))if(fr.includes(ch.fv)&&/[A-Za-z]/.test(fr.replace(/UTC/g,''))){if(!/\blive\b/i.test(fr))f.push('forming value '+ch.fv+' without a live label → "'+fr.slice(0,80)+'"');if(CLOSEW.test(fr.replace(/\bclose to\b/gi,'')))f.push('"close" on forming value '+ch.fv)}
 return f};
{const CH0={open:true,iv:'1d',fv:'777',cv:'500',formD:'7 Oct'},ok='Data: Binance BTC/USDT · through 7 Oct 2026 (forming) · rendered 7 Oct 15:20 UTC ⏐ O 1 H 2 L 3 C 500 ⏐ live 777 · 15:20 UTC';
 const bad=['Data: Binance BTC/USDT · through 7 Oct 2026 · rendered 7 Oct 15:20 UTC','Data: Binance BTC/USDT · through 7 Oct 2026 (forming)','Data: Binance BTC/USDT · 1 Jan – 7 Oct 2026','Data: x · through 6 Oct (7 Oct candle forming) · rendered 7 Oct 15:20 UTC ⏐ close 777','Data: x · through 6 Oct (7 Oct candle forming) · rendered 7 Oct 15:20 UTC ⏐ C 777 BTC'];
 if(formingFails(ok,CH0).length||!bad.every(t=>formingFails(t,CH0).length)||formingFails('Data: x',{open:false}).length){console.error('export-check: forming self-test failed',formingFails(ok,CH0));process.exit(2)}}
for(const e of E.res){const f=[];if(e.err)f.push('ERR '+e.err);if(!/@RPTIME/.test(e.text))f.push('no @RPTIME');const d=(e.text.match(/Data:[^⏐]*/)||[''])[0];if(!d)f.push('no Data:');else if(!/through|as of|updated|\d\d:\d\d ?UTC/i.test(d))f.push('Data: line has no as-of → "'+d.trim().slice(0,90)+'"');if(!/\d\d:\d\d UTC/.test(e.text))f.push('no UTC time');const m=[...new Set((e.text.match(new RegExp(BAN,'gi'))||[]))];if(m.length)f.push('banned/lean: '+m.join(', '));{const bm=e.text.match(BADV);if(bm)f.push('bad value: '+bm[0]+' in "'+e.text.slice(Math.max(0,bm.index-40),bm.index+bm[0].length+5)+'"')}
 if(e.nm.includes('chart')&&E.chart.lastT){const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const lt=new Date(E.chart.lastT);const labs=[...e.text.matchAll(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: (20\d\d))?\b/g)];const last=labs[labs.length-1];if(last){const m=mo.indexOf(last[2]||last[3]);const dd=last[1]?+last[1]:1;let dt=new Date(Date.UTC(lt.getUTCFullYear(),m,dd));if(dt>lt)dt=new Date(Date.UTC(lt.getUTCFullYear()-1,m,dd));if((lt-dt)/864e5>(last[1]?3:31))f.push('last axis label '+last[0]+' but last candle '+lt.toISOString().slice(0,10))}}
 // Forming-candle rule (approved 3 Oct): if the last drawn candle hasn't closed, the Data line must say "(forming)" with its date and keep "rendered HH:MM UTC".
 if(e.nm.includes('chart')&&E.chart.lastT){const IVMS={'15m':9e5,'1h':36e5,'4h':144e5,'1d':864e5,'1w':6048e5}[String(E.chart.iv).toLowerCase()]||864e5;const lt=new Date(E.chart.lastT);
  if(Date.now()-lt.getTime()<IVMS){const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const ds=lt.getUTCDate()+' '+mo[lt.getUTCMonth()];
   if(!new RegExp('through '+ds+'(?: \\d{4})? \\(forming\\)').test(d))f.push('forming candle '+ds+' drawn but Data line lacks "through '+ds+' (forming)"');
   if(!/rendered[^⏐]*\d\d:\d\d ?UTC/.test(d))f.push('forming candle drawn but no "rendered HH:MM UTC"')}}
 if(/chart/.test(e.nm))f.push(...formingFails(e.text,E.chart));
 if(f.length)fails++;console.log((f.length?'FAIL ':'PASS ')+e.nm+(f.length?' | '+f.join(' | '):''))}
console.log('export check:',E.res.length,'images,',fails,'fail');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
