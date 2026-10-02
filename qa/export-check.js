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
 P.fillText=of;return {res,chart:{N:CH&&CH.d&&CH.d.c.length,lastT:CH&&CH.d&&CH.d.t&&new Date(CH.d.t[CH.d.t.length-1]).toISOString()}}});
await p.evaluate(()=>{try{tab('chart')}catch(e){}});await p.waitForTimeout(3000);await p.screenshot({path:'chart-live.png'});
await b.close();fs.writeFileSync('live-exports2.json',JSON.stringify(E,null,1));
const BAN=/\b(buy|sell|accumulat\w*|fire sale|value zone|bullish|bearish|supportive|headwind|BREAKING|confirmed|every cycle|always|never|in history|overbought|oversold|golden[- ]cross|death[- ]cross|strong day|rough day|quiet tape|uptrend|downtrend)\b|India|INR|₹|rupee/i;
console.log('chart data',JSON.stringify(E.chart));let fails=0;
for(const e of E.res){const f=[];if(e.err)f.push('ERR '+e.err);if(!/@RPTIME/.test(e.text))f.push('no @RPTIME');const d=(e.text.match(/Data:[^⏐]*/)||[''])[0];if(!d)f.push('no Data:');else if(!/through|as of|updated|\d\d:\d\d ?UTC/i.test(d))f.push('Data: line has no as-of → "'+d.trim().slice(0,90)+'"');if(!/\d\d:\d\d UTC/.test(e.text))f.push('no UTC time');const m=[...new Set((e.text.match(new RegExp(BAN,'gi'))||[]))];if(m.length)f.push('banned/lean: '+m.join(', '));if(/\bNaN\b|undefined|\bnull\b|0\.0%/.test(e.text))f.push('bad value: '+(e.text.match(/\bNaN\b|undefined|\bnull\b|0\.0%/)||[])[0]);
 if(e.nm.includes('chart')&&E.chart.lastT){const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const lt=new Date(E.chart.lastT);const labs=[...e.text.matchAll(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: (20\d\d))?\b/g)];const last=labs[labs.length-1];if(last){const m=mo.indexOf(last[2]||last[3]);const dd=last[1]?+last[1]:1;let dt=new Date(Date.UTC(lt.getUTCFullYear(),m,dd));if(dt>lt)dt=new Date(Date.UTC(lt.getUTCFullYear()-1,m,dd));if((lt-dt)/864e5>(last[1]?3:31))f.push('last axis label '+last[0]+' but last candle '+lt.toISOString().slice(0,10))}}
 if(f.length)fails++;console.log((f.length?'FAIL ':'PASS ')+e.nm+(f.length?' | '+f.join(' | '):''))}
console.log('export check:',E.res.length,'images,',fails,'fail');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
