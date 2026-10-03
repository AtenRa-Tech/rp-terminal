// tqa5.js — round 5 (RP feedback) regression tests
// A adaptive time axis: each visible-period rule (within a day / several days / few months / several years / halving days), label density at
//   360 px and 1280 px CSS widths (4-6 phone, <=10 desktop), no collisions on either row, range buttons (1W 1M 3M 1Y ALL, clamped, separate from
//   intervals), exact visible-range label, crosshair full timestamp across panels, rainbow years-only + 'Latest:' annotation, exports use the same axis,
//   MACD header in its own band (P2), 1W Data line 'through the week ending' (P2)
// B small grey labels meet WCAG AA 4.5:1 on all 4 themes and are >= 12px
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
const R={};const T=(k,v)=>{R[k]=v};
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function page(w,h){const pg=await b.newPage();await pg.setViewport({width:w,height:h,deviceScaleFactor:w<500?3:1});pg.on('pageerror',e=>console.log('pageerror',e.message));
  await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof drawChart==='function'&&typeof tab==='function',{timeout:60000});return pg}
// --- synthetic period rules on an on-screen canvas of the given CSS width
const SYN=async(pg,cssW)=>pg.evaluate(cssW=>{const c=document.createElement('canvas');c.style.width=cssW+'px';c.style.height='300px';c.width=cssW*2;c.height=600;document.body.appendChild(c);const ctx=c.getContext('2d');ctx.font=F(22,500);
  const run=(t0,t1,intra)=>{window.AXLOG=[];timeAxis(ctx,{t0,t1,xOf:t=>40+(t-t0)/(t1-t0)*(c.width-200),xMin:40,xMax:c.width-160,y:500,u:2,col:'#fff',intra});const a=AXLOG[0];window.AXLOG=null;return{cls:a.cls,k:a.k,n:a.n,maxN:a.maxN,l:a.labels,r2:a.row2.labels,b1:a.boxes,b2:a.row2.boxes}};
  const U=Date.UTC,o={day:run(U(2026,9,3,0),U(2026,9,3,23),1),days:run(U(2026,8,29,0),U(2026,9,3,8),1),months:run(U(2026,5,1),U(2026,9,2),0),years:run(U(2010,6,18),U(2026,9,2),0)};c.remove();return o},cssW);
const coll=B=>{for(let i=1;i<B.length;i++)if(B[i][0]<B[i-1][1])return true;return false};
for(const [w,h] of [[360,800],[1280,900]]){const pg=await page(w,h);const S=await SYN(pg,w-40);const lim=w<500?6:10,lo=w<500?4:4;
  T(`PERIOD_within_day_${w}`,{...S.day,pass:S.day.cls==='h'&&S.day.l.includes('12:00')&&(w<500||S.day.l.includes('06:00')&&S.day.l.includes('18:00'))&&S.day.r2[0]==='3 Oct'&&S.day.l.every(x=>/^\d\d:\d\d$/.test(x)&&(+x.slice(0,2))%((S.day.k==='h'?S.day.n:1)||1)===0)&&S.day.l.length<=lim&&S.day.l.length>=(w<500?2:lo)});
  T(`PERIOD_several_days_${w}`,{...S.days,pass:S.days.cls==='dh'&&S.days.r2.slice(0,3).join()===(w<500?S.days.r2.slice(0,3).join():'29 Sep,30 Sep,1 Oct')&&S.days.r2.every(x=>/^\d{1,2} [A-Z][a-z]{2}$/.test(x))&&S.days.l.every(x=>/^\d\d:\d\d$/.test(x)&&x!=='00:00')&&S.days.r2.length<=lim&&S.days.l.length<=Math.round(S.days.maxN*1.5)});
  T(`PERIOD_few_months_${w}`,{...S.months,pass:S.months.cls==='m'&&S.months.l.join()==='Jun,Jul,Aug,Sep,Oct'&&S.months.r2.join()==='2026'});
  T(`PERIOD_several_years_${w}`,{...S.years,pass:S.years.cls==='y'&&S.years.l.every(x=>/^\d{4}$/.test(x))&&[1,2,4,5,10].includes(S.years.n)&&S.years.l.length<=lim&&S.years.l.length>=lo&&(w>=1000||S.years.n>=4)&&!S.years.r2.length});
  T(`NO_COLLISIONS_synthetic_${w}`,{pass:Object.values(S).every(x=>!coll(x.b1)&&!coll(x.b2))});
  T(`DENSITY_maxN_${w}`,{maxN:S.day.maxN,pass:w<500?S.day.maxN>=4&&S.day.maxN<=6:S.day.maxN>=8&&S.day.maxN<=10});
  // live chart at this width: 1h / 1d / 1w
  await pg.evaluate(()=>tab('chart'));await new Promise(r=>setTimeout(r,3000));
  const L=await pg.evaluate(async()=>{const out={};for(const iv of ['1h','1d','1w']){CH.rng=null;CH.n=120;CH.iv=iv;await loadChart();if(!CH.d)continue;window.AXLOG=[];drawChartScreen();const a=AXLOG.find(x=>x.fn==='chart'),rg=AXLOG.find(x=>x.fn==='chartRange'),hd=AXLOG.find(x=>x.fn==='chartHdr'),md=AXLOG.find(x=>x.fn==='macdHdr');window.AXLOG=null;
     const N=CH.d.t.length,st=N-Math.min(CH.n,N),want=axRange(CH.d.t[st],iv==='1w'?Math.min(CH.d.t[N-1]+6*864e5,Date.now()):CH.d.t[N-1],/h|m/.test(iv));
     out[iv]={cls:a.cls,step:a.k+a.n,maxN:a.maxN,l:a.labels,r2:a.row2.labels,c1:a.boxes,c2:a.row2.boxes,range:rg&&rg.text,want,data:hd.data,macd:md&&{band:md.band,plotTop:md.plotTop}}}return out});
  for(const [iv,a] of Object.entries(L)){const nPrim=a.cls==='dh'?a.r2.length:a.l.length;
    T(`LIVE_${iv}_${w}`,{cls:a.cls,step:a.step,labels:a.l.join('|')+' / '+a.r2.join('|'),pass:!coll(a.c1)&&!coll(a.c2)&&nPrim<=lim&&nPrim>=Math.min(3,lo)&&a.range===a.want&&/ UTC$/.test(a.range)});
    if(iv==='1w')T(`P2_1W_data_line_${w}`,{data:a.data,pass:/weekly candles through the week ending \d{1,2} [A-Z][a-z]{2} \d{4}/.test(a.data)});
    if(a.macd)T(`P2_MACD_own_band_${iv}_${w}`,{...a.macd,pass:a.macd.plotTop>=a.macd.band[1]-0.5&&a.macd.band[1]>a.macd.band[0]})}
  if(w===1280){// range buttons, crosshair, exports
    const RB=await pg.evaluate(async()=>{CH.iv='1d';await loadChart();const btn=k=>document.querySelector(`#rngs [data-rng="${k}"]`);const out={n:document.querySelectorAll('#rngs [data-rng]').length,sepIv:!document.querySelector('#ivs [data-rng]')};
      const N=CH.d.t.length;btn('1M').click();await new Promise(r=>setTimeout(r,200));out.m1=CH.n;window.AXLOG=[];drawChartScreen();out.rg1=AXLOG.find(x=>x.fn==='chartRange').text;window.AXLOG=null;
      btn('1Y').click();await new Promise(r=>setTimeout(r,200));out.y1=CH.n;btn('ALL').click();await new Promise(r=>setTimeout(r,200));out.all=CH.n;out.N=N;
      const z=document.getElementById('zoom');z.value=90;z.dispatchEvent(new Event('input'));out.zoomClears=CH.rng===null&&!document.querySelector('#rngs .on');
      CH.iv='1w';renderChartCtl();await loadChart();out.w1dis=btn('1W').disabled;out.m1w=rngN('1M');CH.iv='1d';renderChartCtl();await loadChart();
      // crosshair: full timestamp, line through every panel
      const cs={};for(const iv of ['1h','1d']){CH.iv=iv;await loadChart();window.AXLOG=[];const c=document.createElement('canvas');c.width=1600;c.height=900;drawChart(c.getContext('2d'),1600,900,{...CH,n:120,cross:CH.d.t.length-5});const x=AXLOG.find(z=>z.fn==='cross');window.AXLOG=null;cs[iv]=x}
      // exports use the same axis (cls by span), desktop density
      const ex={};for(const iv of ['1h','1d','1w']){CH.iv=iv;await loadChart();window.AXLOG=[];const c=document.createElement('canvas');c.width=3840;c.height=2160;drawChart(c.getContext('2d'),3840,2160,{...CH,n:120,cross:null});const a=AXLOG.find(z=>z.fn==='chart');window.AXLOG=null;ex[iv]={cls:a.cls,maxN:a.maxN,l:a.labels,r2:a.row2.labels,c1:a.boxes,c2:a.row2.boxes}}
      CH.iv='1d';await loadChart();return{...out,cs,ex}});
    T('RANGE_buttons',{...RB,cs:undefined,ex:undefined,pass:RB.n===5&&RB.sepIv&&RB.m1===30&&RB.y1===Math.min(365,RB.N)&&RB.all===RB.N&&RB.zoomClears&&RB.w1dis===true&&RB.m1w===5&&/^\d{1,2} [A-Z][a-z]{2} \d{4} – \d{1,2} [A-Z][a-z]{2} \d{4} UTC$/.test(RB.rg1)});
    const DOW='(Mon|Tue|Wed|Thu|Fri|Sat|Sun)';T('CROSSHAIR_full_timestamp',{h:RB.cs['1h']?.text,d:RB.cs['1d']?.text,pass:new RegExp('^'+DOW+' \\d{1,2} [A-Z][a-z]{2} \\d{4} \\d\\d:\\d\\d UTC$').test(RB.cs['1h']?.text)&&new RegExp('^'+DOW+' \\d{1,2} [A-Z][a-z]{2} \\d{4} UTC$').test(RB.cs['1d']?.text)&&['RSI','MACD'].every(k=>RB.cs['1d'].panels.includes(k))&&RB.cs['1d'].bottom>RB.cs['1d'].top});
    T('EXPORT_same_axis_4k',{ex:Object.fromEntries(Object.entries(RB.ex).map(([k,v])=>[k,v.cls+' '+v.l.join('|')+' / '+v.r2.join('|')])),pass:Object.entries(RB.ex).every(([iv,v])=>v.cls===L[iv]?.cls&&v.maxN===10&&!coll(v.c1)&&!coll(v.c2))});
    // rainbow + halving
    await pg.evaluate(()=>tab('signals'));await pg.waitForFunction(()=>typeof SIG!=='undefined'&&SIG&&SIG.length>5,{timeout:120000});
    const SG=await pg.evaluate(()=>{const g=id=>{const s=SIG.find(x=>x.id===id);if(!s)return null;window.AXLOG=[];const c=document.createElement('canvas');c.width=3840;c.height=2160;drawSig(c.getContext('2d'),3840,2160,s);const a=AXLOG.slice();window.AXLOG=null;return a};
      const rb=g('rainbow'),hv=g('halv'),P=SIGD.P;return{rb:rb&&{ax:rb.find(x=>x.fn==='plot'),lt:rb.find(x=>x.fn==='latest')?.text,rg:rb.find(x=>x.fn==='plotRange')?.text,want:'Latest: '+axFull(SIG.find(x=>x.id==='rainbow')?SIGD.P.t.at(-1):0)},hv:hv&&hv.find(x=>x.fn==='plot')}});
    T('RAINBOW_years_and_latest',{labels:SG.rb?.ax?.labels,latest:SG.rb?.lt,range:SG.rb?.rg,pass:!!SG.rb&&SG.rb.ax.cls==='y'&&SG.rb.ax.labels.every(x=>/^\d{4}$/.test(x))&&!SG.rb.ax.row2.labels.length&&/^Latest: \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(SG.rb.lt||'')&&SG.rb.ax.last==null});
    T('HALVING_days_since',{labels:SG.hv?.labels,step:SG.hv?.step,pass:!!SG.hv&&SG.hv.days&&SG.hv.labels[0]==='0'&&[100,200,250,500].includes(SG.hv.step)&&SG.hv.labels.every((x,i)=>+x===i*SG.hv.step)&&SG.hv.caption==='days since halving'})}
  if(w===360){// P2 heatmap Data line wraps instead of clipping (split2 directly + drawHeat at 9:16 when tiles loaded)
    const HW=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=1080;c.height=1920;const x=c.getContext('2d');x.font=F(21.6,500);const t='Data: CoinGecko top 50 by market cap (stablecoins excluded), as of 3 Oct 05:00 UTC · tile area ∝ mcap^0.6';const L=split2(x,t,560);
      const ok=L.length>=2&&L.length<=3&&L.every(l=>x.measureText(l).width<=560)&&(L.join(' ')===t||(L[0].slice(0,-2)+' · '+L.slice(1).join(' '))===t);let heat=null;
      if(heatItems().length){window.AXLOG=[];drawHeat(x,1080,1920,true);heat=AXLOG.find(z=>z.fn==='heatData');window.AXLOG=null}return{L,ok,heat}});
    T('P2_heat_data_line_wraps',{lines:HW.L,heat:HW.heat&&HW.heat.lines,pass:HW.ok&&(!HW.heat||HW.heat.widths.every(v=>v<=HW.heat.maxW+0.5))});
    const C=await pg.evaluate(async()=>{const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      const out={};const keep=THEME;for(const th of Object.keys(THEMES)){applyTheme(th);await new Promise(r=>setTimeout(r,100));const cs=getComputedStyle(document.documentElement);const mu=cs.getPropertyValue('--mu').trim(),bg=cs.getPropertyValue('--bg').trim(),card=cs.getPropertyValue('--p2').trim()||bg;
        const el=document.createElement('span');el.className='mu';el.textContent='x';document.querySelector('.card')?.appendChild(el);const col=getComputedStyle(el).color;const fs=parseFloat(getComputedStyle(el).fontSize);el.remove();
        const toRgb=h=>{const d=document.createElement('i');d.style.color=h;document.body.appendChild(d);const r=getComputedStyle(d).color;d.remove();return r};
        const small=[...document.querySelectorAll('.k,.note,small,.msw')].slice(0,40).map(e=>parseFloat(getComputedStyle(e).fontSize));
        out[th]={mu,bg:toRgb(bg),card:toRgb(card),rBg:+ratio(toRgb(mu),toRgb(bg)).toFixed(2),rCard:+ratio(toRgb(mu),toRgb(card)).toFixed(2),minSmall:Math.min(...small)}}
      applyTheme(keep);return out});
    T('B_contrast_AA_all_themes',{themes:C,pass:Object.keys(C).length===4&&Object.values(C).every(x=>x.rBg>=4.5&&x.rCard>=4.5)});
    T('B_small_labels_min_12px',{min:Object.fromEntries(Object.entries(C).map(([k,v])=>[k,v.minSmall])),pass:Object.values(C).every(x=>x.minSmall>=12)})}
  await pg.close()}
await b.close();let f=0;for(const[k,v]of Object.entries(R)){const ok=v&&v.pass;if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+k+' '+JSON.stringify(v).slice(0,420))}
console.log('FAILS: '+f);process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(2)});
