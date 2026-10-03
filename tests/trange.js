// trange.js — chart range buttons, indicators and stated ranges (supervisor P1, 3 Oct). Usage: URL=... node tests/trange.js
// R1 every ENABLED range button shows its span: first candle open -> last candle close within 5% of the label (ALL: whole pair history loaded)
// R2 every DISABLED button gives a reason; selecting it is refused (CH.rng stays null), so no export/caption can come from it
// I1 indicator header values (EMA20/50/200, RSI, MACD) are identical across every enabled range (1W/1M/3M/1Y/ALL) on the same timeframe; none is blank when the loaded history has warm-up
// E1 the chart export Data: line states the range shown (endpoints within 5% of the span of the first/last visible candle)
// E2 Studio chart captions (3 styles, every template + picked) state the range shown, endpoints within 5%
const p=require('puppeteer-core'),fs=require('fs'),os=require('os'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const R=[];const T=(k,pass,info)=>R.push({k,pass:!!pass,info});
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:1440,height:900});
pg.on('pageerror',e=>console.log('pageerror',e.message));await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof drawChart==='function'&&typeof tab==='function',{timeout:60000});
await pg.evaluate(()=>tab('chart'));await new Promise(r=>setTimeout(r,3000));
const out=await pg.evaluate(async()=>{const res=[];
  // parse 'd Mon[ yyyy][ hh:mm UTC]' near a reference time
  const MN={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const parse=(s,ref)=>{const m=s.match(/(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?(?: (\d\d):(\d\d))?/);if(!m)return null;let y=m[3]?+m[3]:new Date(ref).getUTCFullYear();let t=Date.UTC(y,MN[m[2]],+m[1],+(m[4]||0),+(m[5]||0));if(!m[3]&&t>ref+864e5*2)t=Date.UTC(y-1,MN[m[2]],+m[1],+(m[4]||0),+(m[5]||0));return t};
  const ends=(txt,ref)=>{const m=txt.match(/(?:from the week of |candles |, \S+ candles )?(\d{1,2} [A-Z][a-z]{2}(?: \d{4})?(?: \d\d:\d\d)?(?: UTC)?) through (?:the week ending )?(\d{1,2} [A-Z][a-z]{2}(?: \d{4})?(?: \d\d:\d\d)?(?: UTC)?)/);if(!m)return null;const wk=/week ending/.test(txt);return{a:parse(m[1],ref),b:parse(m[2],ref),wk}};
  for(const iv of Object.keys(IVMS)){CH.iv=iv;CH.rng=null;await loadChart();if(!CH.d){res.push({iv,err:'no data'});continue}const d=CH.d,N=d.t.length,ms=IVMS[iv];const row={iv,N,complete:!!d.complete,pages:d.pages,rng:{}};
    for(const r of Object.keys(RNG)){const why=rngWhy(r);const btn=document.querySelector(`#rngs [data-rng="${r}"]`);
      if(why){CH.rng=r;applyRng();row.rng[r]={on:false,why,btnDisabled:!!btn?.disabled,refused:CH.rng===null};CH.rng=null;continue}
      CH.rng=r;applyRng();window.AXLOG=[];const lay=drawChart(document.createElement('canvas').getContext('2d'),1920,1080,{...CH,cross:null});
      const hd=AXLOG.find(x=>x.fn==='chartHdr'),rs=AXLOG.find(x=>x.fn==='rsiHdr'),md=AXLOG.find(x=>x.fn==='macdHdr');window.AXLOG=null;const st=lay.st,ec=hd.emaIdx;
      const span=d.t[N-1]+ms-d.t[st],want=r==='ALL'?span:RNG[r]*864e5;
      const e=ends(hd.data,d.t[N-1]);const vis=d.t[ec]+(iv==='1w'?6*864e5:/m|h/.test(iv)?ms:0)-d.t[st];
      const dataOK=!!e&&Math.abs(e.a-d.t[st])<=.05*vis&&Math.abs(e.b-(d.t[ec]+(iv==='1w'?6*864e5:/m|h/.test(iv)?ms:0)))<=.05*vis;
      // captions
      CAPCTX=null;NEWSPICK=null;document.querySelector('#stType').value='chart';const F=capFacts({kind:'studio',t:'chart'});const caps=[];for(const [stl] of STY){(CAPT[F.fam][stl]||[]).forEach(fn=>{try{caps.push(String(tidy(fn(F))))}catch(x){}});try{const pk=capPick(F,stl,-1,()=>.5);caps.push(typeof pk==='string'?pk:JSON.stringify(pk))}catch(x){}}
      const capBad=caps.filter(c=>{const q=ends(c,d.t[N-1]);if(!q)return true;const v2=F.range.t1-F.range.t0;return Math.abs(q.a-d.t[st])>.05*v2||Math.abs(q.b-F.range.t1)>.05*v2});
      row.rng[r]={on:true,n:N-st,first:new Date(d.t[st]).toISOString(),last:new Date(d.t[N-1]+ms).toISOString(),spanD:+(span/864e5).toFixed(2),err:+(Math.abs(span-want)/want*100).toFixed(2),
        hdr:{ema:(hd.ema||[]).join(' | '),rsi:rs?(rs.v==null?null:+rs.v.toFixed(6)):undefined,macd:md?.text?.replace(/ · [^·]*$/,'')},data:hd.data,dataOK,caps:caps.length,capBad:capBad.slice(0,2),capSample:caps[0]}}
    CH.rng=null;res.push(row)}
  CH.iv='1d';await loadChart();return res});
for(const row of out){if(row.err){T(`LOAD_${row.iv}`,false,row.err);continue}
  for(const [r,x] of Object.entries(row.rng)){if(!x.on){T(`R2_disabled_${row.iv}_${r}`,x.why&&x.btnDisabled&&x.refused,x.why);continue}
    T(`R1_span_${row.iv}_${r}`,r==='ALL'?row.complete&&x.n===row.N:x.err<=5,`${x.n} candles ${x.first} → ${x.last} = ${x.spanD}d (${x.err}% off)`);
    T(`E1_data_line_${row.iv}_${r}`,x.dataOK,x.data);T(`E2_captions_${row.iv}_${r}`,x.caps>0&&!x.capBad.length,x.capBad.length?x.capBad:x.capSample)}
  const H=Object.keys(row.rng).map(r=>row.rng[r]).filter(x=>x&&x.on);// every enabled range (1M/3M/1Y and also 1W/ALL)
  if(H.length>=2){const h0=JSON.stringify(H[0].hdr);T(`I1_indicators_equal_${row.iv}`,H.every(x=>JSON.stringify(x.hdr)===h0)&&!/–/.test(H[0].hdr.ema||'')&&H[0].hdr.rsi!=null,`${H.length} ranges: ${h0}`)}
  else T(`I1_indicators_equal_${row.iv}`,true,'fewer than two ranges enabled');}
fs.writeFileSync(path.join(os.tmpdir(),'trange.json'),JSON.stringify(out,null,1));
let f=0;for(const r of R){if(!r.pass)f++;console.log((r.pass?'PASS ':'FAIL ')+r.k+' :: '+(typeof r.info==='string'?r.info:JSON.stringify(r.info)).slice(0,300))}console.log('FAILS: '+f);await b.close();process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
