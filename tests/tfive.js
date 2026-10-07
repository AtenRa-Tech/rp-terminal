// tfive.js: RP's five bugs (7 Oct review) + rainbow start year. Each check drives the app's own builders with crafted data,
// so it fails on b479fff-era code and passes on the fix. URL=... node tests/tfive.js
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,600):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return typeof buildSignals==='function'&&typeof buildMacro==='function'&&MAC&&MAC.M&&MAC.M.series}catch(e){return false}},{timeout:150000}).catch(()=>{});
await pg.evaluate(()=>{try{tab('macro')}catch(e){}});await new Promise(r=>setTimeout(r,6000));
const r=await pg.evaluate(async()=>{const o={},DAYm=864e5;
 // synthetic BTC daily closes: from `start` to 6 Oct 2026, ATH `athAgo` days before the end, last close `ddEnd`% below it
 const mk=(start,athAgo,ddEnd)=>{const end=Date.UTC(2026,9,6),t=[],v=[];for(let x=start;x<=end;x+=DAYm)t.push(x);const N=t.length,ai=N-1-athAgo;
  for(let i=0;i<N;i++){let y=1000*Math.exp(4*i/N)*(1+.25*Math.sin(i/200));v.push(y)}const ath=Math.max(...v.slice(0,ai))*1.05;v[ai]=ath;for(let i=ai+1;i<N;i++)v[i]=Math.min(v[i],ath*.99);v[N-1]=ath*(1+ddEnd/100);return{t,v,src:'Binance'}};
 const sig=(P,id)=>{try{return buildSignals({P,CL:{BTC:P}}).find(s=>s.id===id)}catch(e){return{err:String(e)}}};
 // 1. drawdown: history starts 2016, so the 2014-15 bear low is unknown -> '—', never 0%
 {const s=sig(mk(Date.UTC(2016,0,1),400,-35),'dd');o.dd1={cap:s?.cap,err:s?.err}}
 // 2. near ATH: within 3% of the ATH daily close (ATH 40 days ago, -2%) vs ATH 2 days ago but -10%
 {const a=sig(mk(Date.UTC(2016,0,1),40,-2),'dd'),c=sig(mk(Date.UTC(2016,0,1),2,-10),'dd');o.near={a:[a?.read,a?.score,a?.cap],c:[c?.read,c?.score,c?.cap]}}
 // 6. rainbow: 'since 2011' only when the data starts in 2011
 {const s16=sig(mk(Date.UTC(2016,0,1),400,-35),'rainbow'),s10=sig(mk(Date.UTC(2010,6,18),400,-35),'rainbow');o.rb=[s16?.cap,s10?.cap]}
 // 3. breakeven: DGS10 one observation ahead of DFII10 -> '—' plus the lag; same date -> nominal − real
 {const M=JSON.parse(JSON.stringify(MAC.M)),A=M.series.DGS10,B=M.series.DFII10,lb=B.points.at(-1)[0];
  const cut=s=>{s.points=s.points.filter(p=>p[0]<=lb);s.last_date=s.points.at(-1)[0]};cut(A);
  const M2=JSON.parse(JSON.stringify(M)),A2=M2.series.DGS10,nx=new Date(Date.parse(lb+'T00:00:00Z')+DAYm).toISOString().slice(0,10);A2.points.push([nx,A2.points.at(-1)[1]+.05]);A2.last_date=nx;
  const card=MM=>{try{return buildMacro(MM,null).find(c=>c.id==='real')}catch(e){return{err:String(e)}}},tl=MM=>{try{const h=macTiles(MM),i=h.indexOf('10Y breakeven');return h.slice(i,i+260).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')}catch(e){return'ERR '+e}};
  const same=card(M),lag=card(M2);o.be={same:same?.read,sameExp:(A.points.at(-1)[1]-B.points.at(-1)[1]).toFixed(2)+'%',lag:lag?.read,lagCap:lag?.cap,lagTile:tl(M2),sameTile:tl(M)}}
 // 4. correlation by UTC date: Y misses one mid-window day (array positions shift) -> value must match the date-joined reference
 {const end=Date.UTC(2026,9,6),days=Array.from({length:45},(_,i)=>end-(44-i)*DAYm);let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647-.5};
  const xr=days.map(()=>rnd()*.06),yr=xr.map(x=>x+rnd()*.01);const cum=(r)=>{let c=100;return r.map(z=>c*=Math.exp(z))},X=cum(xr),Y=cum(yr);
  const mkIns=(t,v)=>{const c=v;return{w:null,last:c.at(-1),ch30:1,rsi:50,vol:40,hi52:Math.max(...c),lo52:Math.min(...c),fromHi:-5,dv:1e9,bias:'',pts:['test'],src:'Binance',pair:'TEST',asof:t.at(-1),rets:c.slice(-31).map((q,i,a)=>i?Math.log(q/a[i-1]):null).slice(1),cl:{t,v:c}}};
  const run=async(drop)=>{const ty=days.filter((_,i)=>!drop.includes(i)),vy=Y.filter((_,i)=>!drop.includes(i));const ins={tx:mkIns(days,X),ty:mkIns(ty,vy)};
   const keepW=S.watch,keepA=window.analyze;S.watch=[{id:'tx',sym:'TX'},{id:'ty',sym:'TY'}];window.analyze=async w=>({...ins[w.id],w});
   try{await renderInsights()}catch(e){}const cells=[...document.querySelectorAll('#corr td')].map(td=>td.innerText.trim()),note=document.getElementById('corrAsof')?.innerText||'';S.watch=keepW;window.analyze=keepA;
   // reference: inner join on dates, window = 30 return days ending at the last shared date, returns between consecutive shared dates
   const sh=days.map((t,i)=>[t,X[i],drop.includes(i)?null:Y[i]]).filter(z=>z[2]!=null&&z[0]>=end-30*DAYm),rx=[],ry=[];for(let i=1;i<sh.length;i++){rx.push(Math.log(sh[i][1]/sh[i-1][1]));ry.push(Math.log(sh[i][2]/sh[i-1][2]))}
   const m=a=>a.reduce((p,q)=>p+q,0)/a.length,mx=m(rx),my=m(ry);let a1=0,a2=0,a3=0;rx.forEach((q,i)=>{a1+=(q-mx)*(ry[i]-my);a2+=(q-mx)**2;a3+=(ry[i]-my)**2});return{cells,note,ref:a1/Math.sqrt(a2*a3),shared:sh.length}};
  o.corr1=await run([30]);o.corr5=await run([26,28,30,32,34])}
 return o});
const dd=r.dd1.cap||'';ok(dd&&!/(^|[^\d.])-?0%/.test(dd)&&/2014–15 —/.test(dd),"drawdown: 2014–15 bear low shows '—' (never 0%) when history starts 2016",r.dd1);
ok(/within 3%/.test(r.near.a[0]||'')&&r.near.a[1]===97,"near ATH: close 2% below an ATH set 40 days ago is 'within 3%' of it",r.near.a);
ok(!/near|within 3%/i.test((r.near.c[0]||'')+(r.near.c[2]||'').split('\n')[0])&&/^10\.0% below/.test(r.near.c[0]||'')&&r.near.c[1]!==97,"near ATH: ATH 2 days ago but close 10% below is NOT near ATH",r.near.c);
ok(r.rb[0]&&!/since 2011/.test(r.rb[0])&&/since 1 Jan 2016/.test(r.rb[0]),"rainbow: data starting 2016 does not claim 'since 2011'",r.rb[0]);
ok(/since 2011/.test(r.rb[1]||''),"rainbow: data starting 2010 still says 'since 2011' (fit starts 1 Jan 2011)",r.rb[1]);
ok((r.be.same||'').includes('breakeven '+r.be.sameExp),'breakeven: same observation date -> nominal − real',[r.be.same,r.be.sameExp]);
ok(/breakeven — \(nominal through .+ real through .+1d apart\)/.test(r.be.lag||'')&&!/breakeven -?\d/.test(r.be.lag||''),"breakeven: DGS10 one day ahead of DFII10 -> '—' plus the lag (card read)",r.be.lag);
ok(/inflation — \(/.test(r.be.lagCap||''),"breakeven: caption shows '—' plus the lag",r.be.lagCap);
ok(/10Y breakeven —/.test(r.be.lagTile||'')&&/1d apart/.test(r.be.lagTile||''),"breakeven: Macro tile shows '—' plus the lag",r.be.lagTile);
const c1=r.corr1,v1=parseFloat(c1.cells[1]);ok(isFinite(v1)&&Math.abs(v1-c1.ref)<0.006,'correlation: one missing day -> value equals the date-joined reference (not array position)',[c1.cells,c1.ref]);
ok(/30D, through 6 Oct/.test(c1.note),"correlation note shows the shared end date ('30D, through 6 Oct')",c1.note);
ok(r.corr5.cells[1]==='—'&&r.corr5.shared<28,"correlation: under 90% of window days shared -> '—'",[r.corr5.cells,r.corr5.shared]);
ok(!errs.length,'no page errors',errs.slice(0,5));
// 5. duplicate class attribute: no tag in the app source (incl. template strings) carries two class attributes; Market state timestamp has exactly one
{const src=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),dup=[];for(const m of src.matchAll(/<[a-zA-Z][^<>]*?>/g)){if((m[0].match(/\sclass=/g)||[]).length>1)dup.push(m[0].slice(0,120))}
 const i=src.indexOf('<h3>Market state'),ts=src.slice(i,src.indexOf('</h3>',i));ok(!dup.length,'no tag with a duplicate class attribute in index.html',dup);ok((ts.match(/\sclass=/g)||[]).length===2&&/<span class="mu" style=/.test(ts),'Market state timestamp span has a single class attribute',ts.slice(0,200))}
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
