// tclosed.js: forming-candle rule across EVERY signal card (generic). Every daily series gets a row for today (the unfinished UTC day);
// rebuilt cards must still read the last CLOSED day (settled 8h funding prints excepted). Plus the OI rulings (8 Oct): ONE formula for every stored point,
// OI in coins ÷ circulating supply; latest = OI (coins) at D's 00:00 UTC close; step-back to an older day marks the card stale (SIGSTALE, stale:true); exact label.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIG&&SIG.length&&SIGD&&DV&&MK}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(async()=>{const OCL=a=>typeof oiCapLatest==='function'?oiCapLatest(a):{v:'n/a: no oiCapLatest'};const DAYm=864e5,day0=Math.floor(Date.now()/DAYm)*DAYm,D=day0-DAYm,o={};
 const today=t=>t!=null&&t>=day0;const dS=x=>new Date(x).toISOString().slice(0,10);
 const check=list=>list.map(s=>{let F={};try{F=sigFacts(s)}catch(e){}return{id:s.id,settled:!!s.settled,open:!!F.open,lastT:s.lastT??s.closed??null,today:today(s.lastT??s.closed),date:F.date}}).filter(x=>!x.settled&&(x.open||x.today));
 // 1) the cards on the page now
 o.live=check(SIG||[]);o.n=(SIG||[]).length;
 // 2) every daily series with an extra row for today: price/coin histories + derivs daily OI + market file
 const keepD=SIGD,keepDV=DVRAW,keepMK=MK;try{
  const add=S=>S&&S.t?{...S,t:[...S.t,day0],v:[...S.v,S.v.at(-1)*1.37]}:S;const d={...SIGD};for(const k of ['P','H','EB','PG','BT','ST'])d[k]=add(SIGD[k]);d.CL={};for(const k in SIGD.CL)d.CL[k]=add(SIGD.CL[k]);
  const raw=JSON.parse(JSON.stringify(DVRAW));for(const a in raw.assets){const A=raw.assets[a];if(A.oi_daily?.points?.length){const l=A.oi_daily.points.at(-1);if(l[0]<day0)A.oi_daily.points.push([day0,l[1]*1.37,l[2]*1.37])}}
  DVRAW=raw;DV=gateDV(raw);const list=[...buildSignals(d),...derivSignals()];list.forEach(s=>{try{prepSig(s)}catch(e){}});o.fixture=check(list);o.fn=list.length;
  // OI ÷ circulating supply (rulings 8 Oct): ONE formula for every stored point = OI in coins ÷ circulating supply (price cancels)
  const oc=list.find(s=>s.id==='oicapBTC'),L=OCL('BTC'),S=typeof oiCapSeries==='function'?oiCapSeries('BTC'):null,H=(DV.assets.BTC.oi_hourly?.points||[]),hD=H.find(p=>Math.abs(p[0]-(D+DAYm))<=30*60000);
  o.oc={has:!!oc,lastT:oc?.lastT,D:L.D,want:D,v:L.v,oiC:L.oiC,hC:hD?.[2],sup:L.sup,m:oc?.msPre?.a?.at(-1),src:oc?.src,title:oc?.title,desc:(SIGT.oicapBTC||[]).join(' | '),stale:oc?.stale,lbl:oc?`OKX open interest (coins) at 00:00 UTC ${dU(D+DAYm)} (${dShort(D)} close) ÷ circulating supply`:null};
  if(S){const dmap=new Map((DV.assets.BTC.oi_daily.points||[]).map(p=>[p[0],p[2]]));o.formula={n:S.a.length,bad:S.a.map((v,i)=>{const c=i===S.a.length-1?L.oiC:dmap.get(S.t[i]);return Math.abs(v-c/S.sup*100)<1e-12&&S.coin[i]===c?null:[S.t[i],v,c]}).filter(Boolean).slice(0,5)}}else o.formula={n:0,bad:['no series']};
  // step-back: OI at D's 00:00 UTC close missing -> D-1 (stale); D and D-1 missing -> D-2 (stale). A stale card is not in SIG (no reading, score, POST NOW, caption); it sits in SIGSTALE with stale:true
  const stepBack=k=>{const raw2=JSON.parse(JSON.stringify(keepDV));raw2.assets.BTC.oi_hourly.points=raw2.assets.BTC.oi_hourly.points.filter(p=>!Array.from({length:k},(_,j)=>D+DAYm-j*DAYm).some(c=>Math.abs(p[0]-c)<=30*60000));DVRAW=raw2;DV=gateDV(raw2);
    const Lk=OCL('BTC'),out=derivSignals(),st=(typeof SIGSTALE!=='undefined'?SIGSTALE:[]).find(x=>x.id==='oicapBTC');SIG=[...(SIG||[]).filter(x=>x.id!=='oicapBTC')];
    return{D:Lk.D,want:D-k*DAYm,stale:Lk.stale,inOut:!!out.find(x=>x.id==='oicapBTC'),card:st?{stale:st.stale,usedDate:st.usedDate,wantDate:st.wantDate,score:st.score,src:st.src,why:st.staleWhy}:null,
      today:todayItems().some(x=>x.id==='oicapBTC'),postNow:st?postNow(st):false,cluster:(clusters().flatMap(c=>c.in).find(x=>/OI \(coins\)/.test(x.l))||{}).v}};
  const keepSIG=SIG;o.sb1=stepBack(1);o.sb2=stepBack(2);SIG=keepSIG;
  const raw3=JSON.parse(JSON.stringify(keepDV));raw3.assets.BTC.oi_hourly.points=[];DVRAW=raw3;DV=gateDV(raw3);o.noOIall={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC'),stale:SIGSTALE.some(x=>x.id==='oicapBTC')};
  DVRAW=keepDV;DV=gateDV(keepDV);const AD=(0,eval)('D'),keepMk=AD.mk;try{AD.mk={};MK={...keepMK,totals_proxy:{...keepMK.totals_proxy,points:[]}};o.noSup={v:OCL('BTC').v,card:!!derivSignals().find(s=>s.id==='oicapBTC')}}finally{AD.mk=keepMk;MK=keepMK}
  derivSignals();
 }finally{SIGD=keepD;DVRAW=keepDV;DV=gateDV(keepDV);MK=keepMK}
 return o});
ok(r.n>5&&!r.live.length,'every signal card on the page reads the last closed day (no forming reading)',r.live);
ok(r.fn>5&&!r.fixture.length,"every signal card still reads the last closed day when every daily series has a row for today",r.fixture);
const dIs=t=>new Date(t).toISOString().slice(0,10);
ok(r.oc.has&&r.oc.lastT===r.oc.want&&r.oc.D===r.oc.want&&r.oc.oiC===r.oc.hC&&r.oc.v!=null&&Math.abs(r.oc.m-r.oc.oiC/r.oc.sup*100)<1e-12&&!r.oc.stale,"OI ÷ supply: latest day D = OI (coins) at D's 00:00 UTC close ÷ circulating supply",r.oc);
ok(r.formula.n>=60&&!r.formula.bad.length,"OI ÷ supply: EVERY stored point = OI in coins ÷ circulating supply (one formula, whole series)",r.formula);
ok(r.oc.src&&r.oc.src.startsWith(r.oc.lbl)&&/^OKX open interest \(coins\) at 00:00 UTC \d{1,2} [A-Z][a-z]{2} \d{4} \(\d{1,2} [A-Z][a-z]{2} close\) ÷ circulating supply( \(supply as of \d{1,2} [A-Z][a-z]{2}\))?$/.test(r.oc.src),"OI ÷ supply label: 'OKX open interest (coins) at 00:00 UTC <D+1> (<D> close) ÷ circulating supply (supply as of <D Mon>)'",r.oc.src);
ok(!/market cap|today'?s/i.test(r.oc.src+' '+r.oc.title+' '+r.oc.desc)&&/÷ circulating supply/.test(r.oc.title)&&/÷ circulating supply/.test(r.oc.desc),"OI ÷ supply: no 'market cap' or 'today's' on the card (title, description, src)",r.oc);
ok(r.sb1.stale&&r.sb1.D===r.sb1.want&&!r.sb1.inOut&&r.sb1.card&&r.sb1.card.stale===true&&r.sb1.card.usedDate===dIs(r.sb1.want)&&r.sb1.card.score==null&&!r.sb1.today&&!r.sb1.postNow&&/^stale/.test(r.sb1.cluster||''),"step-back 1 day: card names the date used, stale:true, out of SIG/readings/scores/POST NOW/captions",r.sb1);
ok(r.sb2.stale&&r.sb2.D===r.sb2.want&&!r.sb2.inOut&&r.sb2.card&&r.sb2.card.stale===true&&r.sb2.card.usedDate===dIs(r.sb2.want)&&/\(\d{1,2} [A-Z][a-z]{2} close\)/.test(r.sb2.card.src)&&!r.sb2.today&&!r.sb2.postNow,"step-back 2 days (fixture): card stale (stale:true, usedDate 2 days back), excluded everywhere",r.sb2);
ok(r.noOIall.v==null&&!r.noOIall.card&&!r.noOIall.stale,"OI ÷ supply: no hourly OI -> no reading (the 16:00 daily bucket is never a stand-in)",r.noOIall);
ok(r.noSup.v==null&&!r.noSup.card,"OI ÷ supply: no circulating supply -> no reading",r.noSup);
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
