// twording.js: supervisor wording rulings A-F (7 Oct). Each check drives the app's own builders (crafted or loaded data)
// or the sweep's own ban list, so it fails on b479fff-era code and passes on the fix. URL=... node tests/twording.js
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
// A) the caption sweep's ban list (built from shared/banned-words.json) bans 'look(s) fine' and 'Historically' outright
{const SWP=process.env.SWEEP||path.join(__dirname,'..','qa','caption-sweep.js'),src=fs.readFileSync(SWP,'utf8');let B=[];try{const __dirname=path.dirname(SWP);eval(src.split('\n').filter(l=>/^const (BW|BANNED)=/.test(l)).join('\n')+'\nB=BANNED;')}catch(e){}
 const hit=t=>B.some(re=>re.test(t));ok(hit('Miners look fine.')&&hit('Miners looks fine')&&hit('Historically, readings this low.')&&hit('historically'),"sweep: bans 'look(s) fine' and 'Historically'",B.map(String).slice(0,4))}
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return typeof buildSignals==='function'&&SIGD&&SIGD.P&&SIGD.CL&&MK&&MK.breadth}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(()=>{const o={},DAYm=864e5,H=/historically/i;
 const mk=(start,f)=>{const end=Date.UTC(2026,9,6),t=[],v=[];for(let x=start;x<=end;x+=DAYm)t.push(x);const N=t.length;for(let i=0;i<N;i++)v.push(f(i,N));return{t,v,src:'Binance'}};
 const sig=(d,id)=>{try{return buildSignals(d).find(s=>s.id===id)}catch(e){return{err:String(e)}}};
 const base=(i,N)=>1000*Math.exp(5*i/N)*(1+.45*Math.sin(i/180));
 // B) Hash Ribbons: no-capitulation mood + recovery-cross caption
 {const t=[],v=[];const t0=Date.UTC(2025,8,1);for(let i=0;i<385;i++){t.push(t0+i*DAYm);v.push(i<320?1e9:i<370?.7e9:1.3e9)}
  const s=sig({H:{t,v}},'hash'),flat=sig({H:{t:t.slice(0,300),v:v.slice(0,300)}},'hash');let mood=null;try{const Fh=sigFacts(flat);mood=[Fh.chg,Fh.mood]}catch(e){mood=String(e)}
  o.hash={read:s?.read,cap:s?.cap,err:s?.err,mood}}
 // C) drawdown captions on loaded data: computed 'last N cycle lows (years) ran X% to Y% from the all-time-high daily close'
 {let X=null,caps=[],pc=null;try{X=ddFacts('BTC');pc=pastCycles();caps=X?[...CAPT.dd.simple,...CAPT.dd.analytical,...CAPT.dd.ct].map(f=>f(X)):[]}catch(e){caps=[String(e)]}
  o.dd={pastS:X?.pastS,caps,pc:pc&&pc.map(x=>[x.l,Math.round(Math.abs(x.dd))])}}
 // D) 2-year MA: count + dates from the loaded closes, ratio recomputed here
 {const P=mk(Date.UTC(2010,6,1),base),s=sig({P,CL:{BTC:P}},'2y');let a=0;const dd=P.v.map(x=>{a=Math.max(a,x);return(x/a-1)*100});let mi=-1;P.t.forEach((x,i)=>{if(x>=Date.UTC(2021,10,1)&&x<=Date.UTC(2023,0,31)&&(mi<0||dd[i]<dd[mi]))mi=i});
  const ma=P.v.slice(mi-729,mi+1).reduce((s,x)=>s+x,0)/730;o.y2={cap:s?.cap,err:s?.err,r22:(P.v[mi]/ma).toFixed(2),d22:dU(P.t[mi])}}
 // pi / Mayer / weekly RSI: past-pattern lines carry a count and dates (no 'Historically') in every branch
 {const dn=mk(Date.UTC(2014,0,1),(i,N)=>i<N-160?base(i,N-160):base(N-161,N-160)*Math.pow(.99,i-(N-161))),up=mk(Date.UTC(2014,0,1),(i,N)=>i<N-160?base(i,N-160):base(N-161,N-160)*Math.pow(1.012,i-(N-161)));
  const L=SIGD.P,live=buildSignals(SIGD);o.past={pi:live.find(s=>s.id==='pi')?.cap,mayer:live.find(s=>s.id==='mayer')?.cap,wlo:sig({P:dn,CL:{BTC:dn}},'wrsi'),whi:sig({P:up,CL:{BTC:up}},'wrsi')};
  o.past.wlo={cap:o.past.wlo?.cap,read:o.past.wlo?.read};o.past.whi={cap:o.past.whi?.cap,read:o.past.whi?.read}}
 // E) vol templates (every branch) + yield-curve caveat
 {const Fv={...FDEF,fam:'vol',A:'ETH',tk:'$ETH',n:30,val:'25%',pos:'lower than 95% of days since 2019',since:'the lowest since 3 Mar 2024',z:'1.9σ below its median since 2019',src:'Binance',rare:true,sinceY:'2024',date:'6 Oct'},out=[];
  for(const lo of [true,false])for(const k of ['simple','analytical','ct'])(CAPT.vol[k]||[]).forEach(f=>{try{out.push(f({...Fv,lo}))}catch(e){}});o.vol=out.filter(x=>H.test(x)||/quiet stretch/i.test(x))}
 {const s=[...document.scripts].map(x=>x.textContent).join('\n');o.curve=/recessions? ha/i.test(s)?'recession line present':''}
 // F) Altseason/Market-state short line + dominance needs only 31 daily snapshots (it is used as a 30-day change only)
 {const A=altCalc(),line=(()=>{const h=altTodayHTML(),dv=document.createElement('div');dv.innerHTML=h;return[...dv.querySelectorAll('.msw')].map(x=>x.textContent).join(' | ')})();
  const M0=MK;let x31=null;try{MK=JSON.parse(JSON.stringify(M0));const GD=MK.global_daily.points,last=GD.at(-1),Ld=A.L.d,pts=[];for(let k=30;k>=0;k--){const d=new Date(dIso(Ld)-k*DAYm).toISOString().slice(0,10),row=[...last];row[0]=d;row[2]=last[2]+k*.01;pts.push(row)}MK.global_daily.points=pts;const B=altCalc();x31={domOK:B.domOK,dom30:B.L.dom30,n:B.avail.filter(Boolean).length}}catch(e){x31=String(e)}finally{MK=M0}
  o.alt={line,domOK:A.domOK,domDays:A.domDays,n:A.avail.filter(Boolean).length,dom30:A.L.dom30,x31,domMin:ALT.TH.domMin}}
 return o});
const nH=x=>typeof x==='string'&&!/historically|looks? fine/i.test(x);
ok(Array.isArray(r.hash.mood)&&/above 1\.0, no capitulation/i.test(r.hash.mood.join(' '))&&(r.hash.mood.join(' ').match(/no capitulation/gi)||[]).length===1&&!/look/i.test(r.hash.mood.join(' ')),"hash: no-capitulation state reads 'above 1.0, no capitulation' (once; P1: it replaces the status text)",r.hash.mood);
ok(/Hash Ribbons cross/.test(r.hash.read||'')&&nH(r.hash.cap)&&!/after miner stress eased/.test(r.hash.cap),"hash: recovery-cross caption drops the 'Historically… miner stress eased' line",r.hash);
const pc=r.dd.pc||[],lo=pc.length?Math.min(...pc.map(x=>x[1])):null,hi=pc.length?Math.max(...pc.map(x=>x[1])):null;
ok(pc.length>0&&new RegExp(`^the last \\w+ cycle lows? on loaded history \\(${pc.map(x=>x[0]).join(', ')}\\) ran −${lo}%( to −${hi}%)? from the all-time-high daily close$`).test(r.dd.pastS||''),"drawdown: 'the last N cycle lows (years) ran X% to Y% from the all-time-high daily close' computed from loaded history",r.dd);
ok(r.dd.caps.length>0&&r.dd.caps.every(c=>nH(c)&&!/unusually shallow|hard to compare/.test(c)),"drawdown: no 'Historically' / 'unusually shallow' in any drawdown caption",r.dd.caps.filter(c=>!nH(c)||/unusually shallow/.test(c)));
ok(nH(r.y2.cap)&&/The last three cycle lows on loaded history against the 2-year MA: 2014–15 \(\d+ \w+ 201[45], [\d.]+×\), 2018 \(/.test(r.y2.cap||'')&&r.y2.cap.includes(`2022 (${r.y2.d22}, ${r.y2.r22}×)`)&&/\d of \d with a 2-year MA closed below it\./.test(r.y2.cap),"2y MA: count + dates computed live (2022 ratio matches a recompute), no 'Historically'",r.y2);
ok(nH(r.past.pi)&&/crossed above the 2×350-day MA \w+ times?: \d+ \w+ \d{4}|No cross on loaded daily closes/.test(r.past.pi||''),"pi cycle: past crosses as a count + dates, no 'Historically'",r.past.pi);
ok(nH(r.past.mayer)&&/: \d+ closed below 0\.8.* and \d+ above 2\.4/.test(r.past.mayer||''),"mayer: counts + dates, no 'Historically'",r.past.mayer);
ok(nH(r.past.wlo.cap)&&/Weekly RSI closed below 35 in \d+ earlier weeks? of loaded history/.test(r.past.wlo.cap||'')&&nH(r.past.whi.cap)&&/Weekly RSI closed above 80 in \d+ earlier weeks? of loaded history/.test(r.past.whi.cap||''),"weekly RSI: <35 and >80 branches give a count + date, no 'Historically'",r.past);
ok(!r.vol.length,"vol: no 'Historically' / 'quiet stretches' line in any vol template branch",r.vol);
ok(!r.curve,"yield curve: recession line dropped",r.curve);
ok(r.alt.domMin===31&&r.alt.x31&&r.alt.x31.domOK===true&&r.alt.x31.dom30!=null,"market state: dominance (a 30-day change only) is used once 31 daily snapshots exist",r.alt);
ok(r.alt.domOK||r.alt.line.includes(`${r.alt.n}/6 inputs; dominance excluded, ${r.alt.domDays}/31 days of data`),"market state short line: 'N/6 inputs; dominance excluded, k/31 days of data' from the live count",r.alt.line);
ok(!errs.length,'no page errors',errs.slice(0,3));
console.log('FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})();
