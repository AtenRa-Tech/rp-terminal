// RARE SIGNALS ENGINE (19 Nov 2026): CRYPTO GOD's rare-signals spec + Crypto News GOD's wording rules (section 7 audit) + supervisor rulings.
// ONE engine for the Chart-tab notes, the posting desk and the audit. index.html inlines this file between the rare:begin/rare:end markers
// (tests/trare_ui.js asserts the inlined copy equals this file); tests/trare.js requires it directly.
// Rules (all computed here at call time from the unrounded series, never hard-coded):
//  - rare = (a) at/beyond the 2nd or 98th percentile of the series' own gap-free history (numpy linear interpolation, today included) AND the
//    computed share of history at or beyond today's reading, rounded down to 0.1, is not above 2.0% (ties, e.g. 10Y at 1 bp, can block it);
//    or (b) a new low/high against every reading in the previous 180 CALENDAR days (supervisor ruling; never 180 observations).
//  - OI 7-day change is judged in percent (coins shown second). OI level uses only the 180-day high/low test.
//  - under 365 days of gap-free history: 'not enough history', never a post. Funding and basis never produce a post; negative basis is never a signal.
//  - ETF: pending rows are never read; NYSE holidays are not gaps; a zero-total day ends a streak.
//  - every note/post carries the data's own date in UTC; no 'today'/'now' for data older than an hour.
const RARE=(()=>{const DAY=864e5,WIN_DAYS=180,WIN=WIN_DAYS*DAY,MIN_DAYS=365,MINUS='\u2212';
 const nyse=()=>typeof NYSE!=='undefined'?NYSE:(typeof require==='function'?require('./nyse.js'):null);
 // earliest legitimate 'since' date per series (wording rules section 2); the audit fails any earlier date
 const EARLIEST={oi7:'2024-01-01',oilvl:'2024-01-01',etf_btc:'2024-01-11',etf_eth:'2024-07-23',dgs10:'1962-01-03',t10y2y:'1976-06-01',dollar:'2016-01-27',link:'2019-01-16',funding:'2026-07-27',basis:'2026-10-20'};
 // postSrc: the exact source name on a POST's source line (supervisor 19 Nov: the instrument code and 'in BTC' stay on the card only)
 const POSTSRC={oi:'OKX BTC perpetual open interest'};
 const SRC={oi:'OKX BTC perpetual (BTC-USDT-SWAP) open interest, in BTC',etf:'Farside Investors, complete days only',dgs10:'FRED DGS10',t10y2y:'FRED T10Y2Y',dollar:'FRED broad dollar index (DTWEXBGS)',
  link:{Binance:'Binance LINKUSDT daily closes',Coinbase:'Coinbase LINK-USD daily closes'},funding:'OKX BTC-USDT-SWAP funding',basis:'OKX BTC-USDT-SWAP perp vs spot'};
 const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const iso=t=>new Date(t).toISOString().slice(0,10),ymd=s=>Date.parse(String(s).slice(0,10)+'T00:00:00Z');
 const dD=t=>{const d=new Date(t);return d.getUTCDate()+' '+MON[d.getUTCMonth()]+' '+d.getUTCFullYear()};// '1 Jan 2024'
 const dS=t=>{const d=new Date(t);return d.getUTCDate()+' '+MON[d.getUTCMonth()]};// '19 Nov'
 const hm=t=>{const d=new Date(t);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0')};
 const dT=t=>dD(t)+' '+hm(t)+' UTC';
 const sg=(x,d)=>(x<0?MINUS:x>0?'+':'')+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const nf=(x,d=0)=>(x<0?MINUS:'')+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const floor1=x=>Math.floor(x*10+1e-9)/10;
 // stated share: rounded down to 0.1%; below 0.1% it reads 'under 0.1' (CNG/supervisor 19 Nov)
 const shareT=x=>floor1(x)<0.1?'under 0.1':floor1(x).toFixed(1);
 // numpy.percentile(a, q) with the default linear method
 function quantile(a,q){const s=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);if(!s.length)return null;const h=(s.length-1)*q/100,lo=Math.floor(h),hi=Math.ceil(h);return s[lo]+(s[hi]-s[lo])*(h-lo)}
 // tail and 180-calendar-day tests on a reading series {t,v} (t ascending, last = the reading under test)
 function judge(t,v,o={}){const N=v.length,cur=v[N-1],tc=t[N-1];const p2=quantile(v,2),p98=quantile(v,98);/* o.thr (example card only) replaces the REPORTED 2nd/98th percentile with the live one; firing always uses this series' own */
  const le=v.filter(x=>x<=cur).length,ge=v.filter(x=>x>=cur).length,shareLo=le/N*100,shareHi=ge/N*100;
  const side=o.side||(cur<0?'low':cur>0?'high':(shareLo<=shareHi?'low':'high'));
  const share=side==='low'?shareLo:shareHi,tail=!o.noTail&&(side==='low'?cur<=p2:cur>=p98)&&floor1(share)<=2.0;
  const from=tc-WIN;let lo=Infinity,hi=-Infinity,n=0,loT=null,hiT=null;for(let i=0;i<N-1;i++){if(t[i]<from)continue;n++;if(v[i]<lo){lo=v[i];loT=t[i]}if(v[i]>hi){hi=v[i];hiT=t[i]}}
  const winExt=n?(cur<lo?'low':cur>hi?'high':null):null;
  // past cases (details panel only): earlier readings that met today's tail condition on the same side, as a count and episode dates
  const thr=side==='low'?p2:p98,past=[];for(let i=0;i<N-1;i++)if(side==='low'?v[i]<=thr:v[i]>=thr)past.push(t[i]);const eps=[];past.forEach(x=>{if(!eps.length||x-eps.at(-1).last>7*DAY)eps.push({first:x,last:x});else eps.at(-1).last=x});
  return{cur,t:tc,N,p2:o.thr?o.thr.p2:p2,p98:o.thr?o.thr.p98:p98,side,share,shareTxt:shareT(share),shareLo,shareHi,tail,win:{method:'calendar',days:WIN_DAYS,from,to:tc,n,lo:n?lo:null,hi:n?hi:null,loT,hiT},winExt,
   fires:!!(tail||(winExt&&(!o.winSide||o.winSide===winExt))),form:tail?'tail':winExt?'window':null,past:{days:past.length,episodes:eps.length,dates:eps.slice(-5).map(e=>e.first)}}}
 // EFFECTIVE CUT-OFF (supervisor ruling a, 19 Nov): the least extreme reading, on the series' grid, at which judge() itself fires on this tail
 // (reading at/beyond the 2nd/98th percentile AND the share at or beyond it, today included, rounded down to 0.1%, not above 2.0%).
 // Found by putting candidate readings in today's place and asking the SAME judge() — so the label, chart line, details and audit can never
 // disagree with what fires. The firing rule itself is unchanged. null = this tail can never fire on this history.
 const gdp=g=>Math.max(0,-Math.floor(Math.log10(g)+1e-9));
 function cutoff(t,v,side,o,grid){const N=v.length;if(N<3||!grid)return null;const sg1=side==='low'?-1:1,w=v.slice(),gd=gdp(grid),oo={...o,side,noTail:false};
  const pl=quantile(v,side==='low'?2:98);if(pl==null)return null;const G0=Math.round(pl/grid)-sg1*2;
  const at=k=>+((G0+sg1*k)*grid).toFixed(gd),fires=x=>{w[N-1]=x;return judge(t,w,oo).tail};
  let a=0,n=0;while(fires(at(a))){a--;if(++n>1e5)return null}let b=1;while(!fires(at(b))){a=b;b*=2;if(b>1e8)return null}
  while(b-a>1){const m=Math.floor((a+b)/2);if(fires(at(m)))b=m;else a=m}return at(b)}
 // latest gap-free segment: index of its first point. ok(prevT, t) says whether the step is gap-free
 function segStart(t,ok){let s=0;for(let i=1;i<t.length;i++)if(!ok(t[i-1],t[i]))s=i;return s}
 const enough=(t0,t1)=>(t1-t0)/DAY>=MIN_DAYS;
 const plus1y=t=>{const d=new Date(t);return Date.UTC(d.getUTCFullYear()+1,d.getUTCMonth(),d.getUTCDate())};
 const notEnough=(n,start)=>TPL.notEnough(n,dD(start),dD(plus1y(start)));
 // ================= WORDING TEMPLATES (the ONE place to edit wording; Crypto News GOD owns the final text) =================
 // Every sentence of a Chart-tab note, a post and a card headline comes from TPL. f = the figures, already formatted by the series code.
 // Post = [line 1, rarity sentence, optional 'Data to' line, source line]. The audit's fixed rarity forms (FORMS below) must match TPL.tail/window/etf*.
 // Over 280 X-weighted characters: (OI) the snapshot time leaves the source line and goes into line 1 (postTime); (ETF) the 'Data to' line falls back to dataFit.
 // The level is never dropped and the source name is never shortened. The first form that fits is used; s.fit names the fallback. Nothing fits: the audit fails closed.
 const TPL={
  normal:'Within its normal range',
  tail:(lo,metric,since,share,N)=>`Among the ${lo?'lowest':'highest'} 2% of ${metric} since ${since}: ${share}% of ${N} readings were this ${lo?'low or lower':'high or higher'}`,
  window:(lo,wmetric)=>`${lo?'Lowest':'Highest'} ${wmetric} in ${WIN_DAYS} days`,
  etfTail:(n,word,through,share,since)=>`${n} straight days of net ${word}, complete days through ${through}; a streak this long has happened on ${share}% of days since ${since}`,
  etfWindow:A=>`Longest US spot ${A} ETF flow streak in ${WIN_DAYS} days`,
  cross:(dir,cur,prev)=>`10Y\u20132Y Treasury spread turned ${dir}: ${cur} pp, from ${prev} pp the day before (first crossing this way in at least ${WIN_DAYS} days)`,
  // details row per tail (CNG 19 Nov): the effective cut-off at the series' grid precision, then the percentile line it comes from
  firesAt:(side,at,pct,streak)=>side==='low'?`${at} or below (2nd percentile ${pct}; ties keep the share at or under 2.0%)`:`${at} or ${streak?'longer':'above'} (98th percentile${streak?' streak':''} ${pct}; ties keep the share at or under 2.0%)`,
  notEnough:(n,start,until)=>`Not enough history yet (${n} days since ${start}); no signal until ${until}`,
  // Chart-tab note: bold line 1 = short reading + ' · ' + verdict; grey line 2 = source, window, data time
  verdict:{normal:'Within its normal range',history:'Not enough history yet',tail:(lo,since)=>`${lo?'Lowest':'Highest'} 2% since ${since}`,etfTail:since=>`Among the longest 2% of streaks since ${since}`,missing:'No data'},
  note2:(src,from,to,when,extra)=>`Source: ${src}, ${from}\u2013${to} \u00b7 ${when}${extra?' \u00b7 '+extra:''}`,
  dataFred:d=>`Data to ${d} (FRED, latest published).`,
  source:(src,extra)=>`Source: ${src}${extra?', '+extra:''}.`,
  oi7:{short:f=>`BTC OI ${f.chg}% in 7 days`,head:f=>`BTC open interest on OKX: ${f.chg}% in 7 days`,
   post:f=>`${f.cash} perpetual open interest on OKX: ${f.chg}% in the 7 days to ${f.day} (${f.coins} BTC), to ${f.level} BTC.`,
   postTime:f=>`${f.cash} perpetual open interest on OKX: ${f.chg}% in the 7 days to ${f.day} ${f.hm} UTC (${f.coins} BTC), to ${f.level} BTC.`,data:null,src:f=>`snapshot ${f.snap}`,when:f=>`snapshot ${f.snap}`},
  oilvl:{short:f=>`BTC OI ${f.level} BTC`,head:f=>`BTC open interest on OKX: ${f.level} BTC`,
   post:f=>`${f.cash} perpetual open interest on OKX: ${f.level} BTC, ${f.lo?'below its previous':'above its previous'} ${WIN_DAYS}-day ${f.lo?'low':'high'} of ${f.ext} BTC.`,data:null,postTime:f=>`${f.cash} perpetual open interest on OKX: ${f.level} BTC at ${f.day} ${f.hm} UTC, ${f.lo?'below its previous':'above its previous'} ${WIN_DAYS}-day ${f.lo?'low':'high'} of ${f.ext} BTC.`,src:f=>`snapshot ${f.snap}`,when:f=>`snapshot ${f.snap}`},
  etf:{short:f=>f.n?`${f.A} ETFs ${f.n} day${f.n>1?'s':''} of net ${f.word} (${f.cum})`:`${f.A} ETFs no streak (last day flat)`,head:f=>`US spot ${f.A} ETFs: ${f.n} straight day${f.n===1?'':'s'} of net ${f.word}`,
   post:f=>`US spot ${f.cash} ETFs: ${f.n} straight days of net ${f.word}, ${f.cum} in total.`,data:f=>`Data to ${f.day} UTC, complete days.`,dataFit:f=>`Data to ${f.day} UTC.`,src:null,when:f=>`complete days through ${f.date} UTC`},
  dgs10:{short:f=>`US 10Y ${f.bp} bp to ${f.lvl}%`,head:f=>`US 10-year yield: ${f.bp} bp in one day`,
   post:f=>`US 10-year Treasury yield: ${f.bp} bp in one day, to ${f.lvl}%.`,data:f=>TPL.dataFred(f.date),src:null,when:f=>`data ${f.date}, FRED latest published`},
  t10y2y:{short:f=>`10Y\u20132Y ${f.bp} bp to ${f.lvl} pp`,head:f=>`10Y\u20132Y spread: ${f.bp} bp in one day`,
   post:f=>`10Y\u20132Y Treasury spread: ${f.bp} bp in one day, to ${f.lvl} pp.`,data:f=>TPL.dataFred(f.date),src:null,when:f=>`data ${f.date}, FRED latest published`},
  dollar:{short:f=>`Dollar index ${f.pct}% to ${f.lvl}`,head:f=>`Broad dollar index: ${f.pct}% in one day`,
   post:f=>`Broad US dollar index: ${f.pct}% in one day, to ${f.lvl}.`,data:f=>TPL.dataFred(f.date),src:null,when:f=>`data ${f.date}, FRED latest published`},
  link:{short:f=>`LINK ${f.pct}% in 30 days to $${f.px}`,head:f=>`LINK: ${f.pct}% in 30 days`,
   post:f=>`${f.cash} on ${f.src}: ${f.pct}% in 30 days, to $${f.px}.`,data:f=>`Data to ${f.day} UTC daily close.`,src:null,when:f=>`${f.date} UTC daily close`},
  funding:{short:f=>`BTC funding ${f.r}% per 8h`,when:f=>f.at},
  basis:{short:f=>`BTC basis ${f.x}%`,when:f=>f.at,extra:'negative basis is the normal state and is never a signal'}
 };
 function sentence(m,j){if(!j.fires)return TPL.normal;
  if(j.form==='tail')return TPL.tail(j.side==='low',m.metric,dD(m.since),j.shareTxt,j.N.toLocaleString('en-US'));
  return TPL.window(j.winExt==='low',m.wmetric||m.metric)}
 // 'since' = the first value of the MEASURED series (the change/streak series that is judged), never the first raw row (supervisor, 19 Nov)
 const sinceOf=(t,lab=x=>x)=>lab(t[0]);
 // thresholds and the reading share ONE precision per series (dp): a 1-decimal reading gets 1-decimal 2%/98% lines (-17.5%, not -18%)
 const fmtAt=(dp,unit,signed=true)=>x=>(signed?sg(x,dp):nf(x,dp))+unit;
 // ---------- the series
 function oiSeries(DV){const A=DV&&DV.assets&&DV.assets.BTC,d=A&&A.oi_daily;if(!d||!d.points||!d.points.length)return{err:'no OKX daily open interest in derivs.json'};
  if(!/OKX/i.test(String(d.source||'')))return{err:`daily open interest came from ${d.source||'an unknown venue'}, not OKX; the OKX history is not comparable`};
  const P=d.points.filter(p=>p&&isFinite(p[0])&&p[2]!=null&&isFinite(p[2])),t=P.map(p=>+p[0]),c=P.map(p=>+p[2]),u=P.map(p=>+p[1]);const s=segStart(t,(a,b)=>b-a===DAY);
  return{t:t.slice(s),c:c.slice(s),u:u.slice(s),snap:Date.parse(DV.updated)||null}}
 // OKX daily buckets run 16:00 UTC -> 16:00 UTC (00:00 UTC+8); a bucket is labelled by the UTC date it ends on (= its UTC+8 day)
 const oiDay=t=>t+8*36e5;
 function sOI7(inp,st){const O=oiSeries(inp.derivs),base={id:'oi7',title:'BTC open interest · 7-day change',group:'Derivatives',source:SRC.oi,unit:'%',cash:'$BTC'};if(O.err)return{...base,missing:O.err};
  const t=[],v=[],dc=[];for(let i=7;i<O.t.length;i++){t.push(O.t[i]);v.push((O.c[i]/O.c[i-7]-1)*100);dc.push(O.c[i]-O.c[i-7])}if(!v.length)return{...base,missing:'fewer than 8 daily buckets'};
  const since=oiDay(O.t[0]),j=judge(t,v,{thr:inp.thrBase&&inp.thrBase.oi7}),L=O.c.length-1,coins=dc.at(-1);
  const m={metric:'7-day changes',wmetric:'7-day change',since:sinceOf(t,oiDay)};const snap=O.snap||O.t[L];/* first 7-day change = 8th bucket (8 Jan 2024) */
  const dateTxt=`snapshot ${dS(snap)} ${hm(snap)} UTC; daily bucket ${dS(O.t[L])} 16:00\u2013${dS(O.t[L]+DAY)} 16:00 UTC, still open`;
  const s={...base,j,t,v,since:m.since,srcFrom:since,srcTo:snap,dataT:snap,open:O.t[L]+DAY>(inp.now||Date.now()),coins,level:O.c[L],dateTxt,
   readTxt:`OKX BTC perpetual open interest ${sg(j.cur,1)}% (${sg(coins,0)} BTC) in 7 days`,rarity:sentence(m,j),hist:enough(t[0],t.at(-1)),
   chart:{t:O.t.slice(7).map(oiDay),v,fmt:x=>sg(x,0)+'%',band:[j.p2,j.p98]},dp:1,fv:fmtAt(1,'%'),grid:0.01,fc:fmtAt(2,'%'),jo:{thr:inp.thrBase&&inp.thrBase.oi7},
   facts:[['Reading',sg(j.cur,2)+'% ('+sg(coins,1)+' BTC)'],['2nd / 98th percentile',sg(j.p2,2)+'% / '+sg(j.p98,2)+'%'],[`Low / high in previous ${WIN_DAYS} days`,j.win.n?sg(j.win.lo,2)+'% / '+sg(j.win.hi,2)+'%':'\u2014'],['Share at or '+(j.side==='low'?'below':'above'),j.shareTxt+'% of '+j.N.toLocaleString('en-US')+' readings'],['Window',dD(m.since)+' \u2013 '+dT(snap)+' (gap-free, every step 24h)']]};
  s.stats=[['7-day change',sg(j.cur,1)+'%'],['In coins',sg(coins,0)+' BTC'],['Open interest',nf(O.c[L],0)+' BTC']];
  s.f={cash:s.cash,chg:sg(j.cur,1),coins:sg(coins,0),level:nf(O.c[L],0),day:dS(O.t[L]+DAY),hm:hm(snap),snap:`${dS(snap)} ${hm(snap)} UTC`};return s}
 function sOIlvl(inp){const O=oiSeries(inp.derivs),base={id:'oilvl',title:'BTC open interest · level (coins)',group:'Derivatives',source:SRC.oi,unit:'BTC',cash:'$BTC'};if(O.err)return{...base,missing:O.err};
  const j0=judge(O.t,O.c,{noTail:true}),L=O.c.length-1,snap=O.snap||O.t[L];const m={metric:'OKX BTC perpetual open interest',since:sinceOf(O.t,oiDay)};
  const s={...base,j:j0,t:O.t,v:O.c,since:m.since,srcFrom:m.since,srcTo:snap,dataT:snap,usd:O.u[L],dateTxt:`snapshot ${dS(snap)} ${hm(snap)} UTC; daily bucket ${dS(O.t[L])} 16:00\u2013${dS(O.t[L]+DAY)} 16:00 UTC, still open`,
   readTxt:`OKX BTC perpetual open interest ${nf(O.c[L],0)} BTC`,rarity:sentence(m,j0),hist:enough(O.t[0],O.t[L]),levelOnly:true,
   chart:{t:O.t.map(oiDay),v:O.c,fmt:x=>nf(x/1000,1)+'k',band:null,win:[j0.win.lo,j0.win.hi]},dp:0,fv:fmtAt(0,' BTC',false),
   facts:[['Reading',nf(O.c[L],1)+' BTC ($'+(O.u[L]/1e9).toFixed(2)+'B notional)'],[`Low / high in previous ${WIN_DAYS} days`,j0.win.n?nf(j0.win.lo,1)+' / '+nf(j0.win.hi,1)+' BTC':'\u2014'],['Test','180-day high or low only (a percentile on a trending level is not used)'],['Window',dD(m.since)+' \u2013 '+dT(snap)]]};
  s.stats=[['Open interest',nf(O.c[L],0)+' BTC'],[`${WIN_DAYS}-day low`,j0.win.n?nf(j0.win.lo,0):'\u2014'],[`${WIN_DAYS}-day high`,j0.win.n?nf(j0.win.hi,0):'\u2014']];
  s.f={cash:s.cash,day:dS(snap),hm:hm(snap),level:nf(O.c[L],0),lo:j0.winExt!=='high',ext:j0.win.n?nf(j0.winExt==='high'?j0.win.hi:j0.win.lo,0):'\u2014',snap:`${dS(snap)} ${hm(snap)} UTC`};return s}
 // ETF flow streaks from complete (non-pending) rows only; NYSE holidays are not gaps; a zero-total day ends a streak
 // CRYPTO GOD ruling (19 Nov): which rows to skip is decided by the NYSE calendar (shared/nyse.js), never by total == 0. A row on an NYSE holiday or weekend
 // is skipped whatever its total (Farside lists holidays as 0); a real trading day with exactly 0 net flow stays and breaks the streak. Pending rows are never read.
 // No calendar available: fail closed (no ETF series), never fall back to the totals.
 function etfRows(E,a){const d=E&&E.datasets&&E.datasets[a];if(!d||!d.days)return null;const N=nyse();if(!N||typeof N.open!=='function')return null;
  return d.days.filter(r=>r&&!r.pending&&N.open(String(r.date).slice(0,10))&&r.total!=null&&isFinite(+r.total)).map(r=>({t:ymd(r.date),v:+r.total}))}
 function sETF(inp,a){const A=a.toUpperCase(),id='etf_'+a,base={id,title:`US spot ${A} ETF · flow streak`,group:'ETF flows',source:SRC.etf,unit:'days',cash:'$'+A};
  const R=etfRows(inp.etf,a);if(!R||!R.length)return{...base,missing:R?`no complete ${A} rows in etf.json`:'NYSE calendar unavailable'};const N=nyse();
  const s0=segStart(R.map(r=>r.t),(x,y)=>{for(let k=x+DAY;k<y;k+=DAY)if(N.open(k))return false;return true});const rows=R.slice(s0);
  const t=[],L=[],dir=[];let run=0,sgn=0;for(const r of rows){const g=r.v>0?1:r.v<0?-1:0;if(g===0){run=0;sgn=0}else if(g===sgn)run++;else{run=1;sgn=g}t.push(r.t);L.push(run);dir.push(sgn)}
  const j=judge(t,L,{side:'high'}),n=L.at(-1),dr=dir.at(-1),last=t.at(-1),cum=rows.slice(rows.length-n).reduce((x,r)=>x+r.v,0);
  const ge=j.shareHi,word=dr<0?'outflows':'inflows';const since=sinceOf(t);
  let rarity=TPL.normal;if(j.fires)rarity=j.form==='tail'?TPL.etfTail(n,word,dD(last),shareT(ge),dD(since)):TPL.etfWindow(A);
  const s={...base,j,t,v:L,since,srcFrom:since,srcTo:last,dataT:last,n,dir:dr,cum,dateTxt:`complete days through ${dD(last)} UTC`,
   readTxt:n?`${n} day${n>1?'s':''} of net ${word} (${cum<0?MINUS:'+'}$${nf(Math.abs(cum),1)}M) in US spot ${A} ETFs`:`No streak in US spot ${A} ETFs (last day flat)`,rarity,hist:enough(t[0],last),
   chart:{t:rows.map(r=>r.t),v:rows.map(r=>r.v),bars:true,fmt:x=>(x<0?MINUS:'')+'$'+nf(Math.abs(x),0)+'M'},dp:0,fv:fmtAt(0,' days',false),grid:1,fc:fmtAt(0,' days',false),jo:{side:'high'},
   facts:[['Reading',`${n} day${n===1?'':'s'} of net ${word}; ${cum<0?MINUS:'+'}$${nf(Math.abs(cum),1)}M over the streak`],['98th percentile streak',nf(j.p98,0)+' days'],[`Longest streak in previous ${WIN_DAYS} days`,j.win.n?j.win.hi+' days':'\u2014'],['Days with a streak this long',floor1(ge).toFixed(1)+'% of '+j.N.toLocaleString('en-US')+' complete days'],['Window',dD(since)+' \u2013 '+dD(last)+' (complete days; NYSE holidays are not gaps; pending rows never read)']]};
  s.sv=L.map((x,i)=>x*dir[i]);s.stats=[['Streak',n+' day'+(n===1?'':'s')],['Total',(cum<0?MINUS:'+')+'$'+nf(Math.abs(cum),1)+'M'],['Through',dS(last)]];
  s.f={A,cash:s.cash,n,word,cum:(cum<0?MINUS:'+')+'$'+nf(Math.abs(cum),1)+'M',day:dS(last),date:dD(last)};return s}
 // FRED daily series: a gap longer than 5 calendar days breaks the history
 function fred(M,id){const s=M&&M.series&&M.series[id];if(!s||!s.points||!s.points.length)return null;const P=s.points.filter(p=>p&&p[1]!=null&&isFinite(+p[1])),t=P.map(p=>ymd(p[0])),v=P.map(p=>+p[1]);const k=segStart(t,(a,b)=>b-a<=5*DAY);return{t:t.slice(k),v:v.slice(k),last:s.last_date}}
 function sDGS10(inp){const base={id:'dgs10',title:'US 10-year yield · daily move',group:'Rates',source:SRC.dgs10,unit:'bp'};const F=fred(inp.macro,'DGS10');if(!F)return{...base,missing:'DGS10 missing from macro.json'};
  const t=[],v=[];for(let i=1;i<F.t.length;i++){t.push(F.t[i]);v.push(Math.round((F.v[i]-F.v[i-1])*100))}const j=judge(t,v),last=t.at(-1),lvl=F.v.at(-1);const m={metric:'daily moves in the US 10-year yield',wmetric:'daily '+(j.cur<0?'fall':'rise')+' in the US 10-year yield',since:sinceOf(t)};
  const s={...base,j,t,v,since:m.since,srcFrom:F.t[0],srcTo:last,dataT:last,level:lvl,dateTxt:`${dD(last)}, FRED latest published`,readTxt:`US 10-year yield ${sg(j.cur,0)} bp to ${lvl.toFixed(2)}%`,rarity:sentence(m,j),hist:enough(t[0],last),
   chart:{t:F.t,v:F.v,fmt:x=>x.toFixed(2)+'%'},dp:0,fv:fmtAt(0,' bp'),grid:1,fc:fmtAt(0,' bp'),jo:{},
   facts:[['Reading',sg(j.cur,0)+' bp (level '+lvl.toFixed(2)+'%)'],['2nd / 98th percentile',sg(j.p2,0)+' / '+sg(j.p98,0)+' bp'],[`Low / high in previous ${WIN_DAYS} days`,j.win.n?sg(j.win.lo,0)+' / '+sg(j.win.hi,0)+' bp':'\u2014'],['Share at or '+(j.side==='low'?'below':'above'),j.shareTxt+'% of '+j.N.toLocaleString('en-US')+' daily moves (values are rounded to 1 bp, so ties count; above 2.0% it does not fire)'],['Window',dD(t[0])+' \u2013 '+dD(last)]]};
  s.stats=[['Daily move',sg(j.cur,0)+' bp'],['Yield',lvl.toFixed(2)+'%'],['Date',dS(last)]];
  s.f={bp:sg(j.cur,0),lvl:lvl.toFixed(2),date:dD(last)};return s}
 function sT10Y2Y(inp){const base={id:'t10y2y',title:'2s10s spread · daily move',group:'Rates',source:SRC.t10y2y,unit:'bp'};const F=fred(inp.macro,'T10Y2Y');if(!F)return{...base,missing:'T10Y2Y missing from macro.json'};
  // Two triggers (supervisor, 19 Nov 13:59): (1) like the 10Y, a 2% tail or a 180-day extreme of its DAILY CHANGE (bp);
  // (2) a zero crossing on the latest day that is the first crossing in that direction in the previous 180 calendar days.
  // A crossing with an earlier same-direction crossing inside 180 days (e.g. the Sep 2024 back-and-forth) is context only, never a signal.
  const t=[],v=[];for(let i=1;i<F.t.length;i++){t.push(F.t[i]);v.push(Math.round((F.v[i]-F.v[i-1])*100))}const j0=judge(t,v),N=F.v.length,cur=F.v[N-1],prev=F.v[N-2],last=t.at(-1);
  const sgn=x=>x>0?1:x<0?-1:0,X=[];{let ps=0;for(let i=0;i<N;i++){const g=sgn(F.v[i]);if(g&&ps&&g!==ps)X.push({t:F.t[i],up:g>0});if(g)ps=g}}/* zero readings are skipped, the last non-zero sign counts */
  const cx=X.length&&X.at(-1).t===last?X.at(-1):null,cross=cx?(cx.up?'positive':'negative'):null,prevSame=cx?X.slice(0,-1).filter(x=>x.up===cx.up):[],lastSame=prevSame.at(-1)||null;
  const firstCross=!!cx&&!(lastSame&&lastSame.t>=last-WIN);
  const j={...j0,fires:j0.fires||firstCross,form:j0.fires?j0.form:firstCross?'cross':null,crossFires:firstCross,cross:cx?{dir:cross,prevSame:lastSame&&lastSame.t}:null};
  const m={metric:'daily moves in the 10Y\u20132Y spread',wmetric:'daily '+(j.cur<0?'fall':'rise')+' in the 10Y\u20132Y spread',since:sinceOf(t)};
  /* crossing sentence: 'since' = the previous crossing in that direction, or the start of the measured series (never before 1 Jun 1976) */
  const rarity=j0.fires?sentence(m,j0):firstCross?TPL.cross(cross,sg(cur,2),sg(prev,2)):TPL.normal;
  const s={...base,j,t,v,since:m.since,srcFrom:F.t[0],srcTo:last,dataT:last,level:cur,cross,dateTxt:`${dD(last)}, FRED latest published`,readTxt:`10Y\u20132Y Treasury spread ${sg(j.cur,0)} bp to ${sg(cur,2)} pp`,rarity,hist:enough(t[0],last),
   chart:{t:F.t,v:F.v,fmt:x=>sg(x,2),zero:true},dp:0,fv:fmtAt(0,' bp'),grid:1,fc:fmtAt(0,' bp'),jo:{},
   facts:[['Reading',sg(j.cur,0)+' bp in one day, to '+sg(cur,2)+' pp (from '+sg(prev,2)+' pp)'+(cross?'; turned '+cross+' that day (context only)':'')],['2nd / 98th percentile',sg(j.p2,0)+' / '+sg(j.p98,0)+' bp'],[`Low / high in previous ${WIN_DAYS} days`,j.win.n?sg(j.win.lo,0)+' / '+sg(j.win.hi,0)+' bp':'\u2014'],['Share at or '+(j.side==='low'?'below':'above'),j.shareTxt+'% of '+j.N.toLocaleString('en-US')+' daily moves (rounded to 1 bp, so ties count; above 2.0% it does not fire)'],['Rule','rare on a 2% tail or 180-day extreme of the daily change (like the 10Y), or on the first zero crossing in that direction in 180 calendar days'],['Last crossing',X.length?dD(X.at(-1).t)+' ('+(X.at(-1).up?'to positive':'to negative')+')':'\u2014'],['Window',dD(t[0])+' \u2013 '+dD(last)]]};
  s.stats=[['Daily move',sg(j.cur,0)+' bp'],['10Y\u20132Y',sg(cur,2)+' pp'],['Date',dS(last)]];
  s.f={bp:sg(j.cur,0),lvl:nf(cur,2),cross,date:dD(last)};return s}
 function sDollar(inp){const base={id:'dollar',title:'Broad dollar index · daily move',group:'Dollar',source:SRC.dollar,unit:'%'};const F=fred(inp.macro,'DTWEXBGS');if(!F)return{...base,missing:'DTWEXBGS missing from macro.json'};
  const t=[],v=[];for(let i=1;i<F.t.length;i++){t.push(F.t[i]);v.push((F.v[i]/F.v[i-1]-1)*100)}const j=judge(t,v),last=t.at(-1),lvl=F.v.at(-1);const m={metric:'daily moves in the broad dollar index',wmetric:'daily '+(j.cur<0?'fall':'rise')+' in the broad dollar index',since:sinceOf(t)};
  const s={...base,j,t,v,since:m.since,srcFrom:F.t[0],srcTo:last,dataT:last,level:lvl,dateTxt:`last data ${dD(last)}, FRED latest published`,readTxt:`Broad dollar index ${sg(j.cur,3)}% to ${lvl.toFixed(2)}`,rarity:sentence(m,j),hist:enough(F.t[0],last),
   chart:{t:F.t,v:F.v,fmt:x=>x.toFixed(1)},dp:2,fv:fmtAt(2,'%'),grid:0.001,fc:fmtAt(3,'%'),jo:{},
   facts:[['Reading',sg(j.cur,3)+'% (index '+lvl.toFixed(4)+', Jan 2006 = 100)'],['2nd / 98th percentile',sg(j.p2,3)+'% / '+sg(j.p98,3)+'%'],[`Low / high in previous ${WIN_DAYS} days`,j.win.n?sg(j.win.lo,3)+'% / '+sg(j.win.hi,3)+'%':'\u2014'],['Share at or '+(j.side==='low'?'below':'above'),j.shareTxt+'% of '+j.N.toLocaleString('en-US')+' daily moves'],['Window',dD(F.t[0])+' \u2013 '+dD(last)+' (starts after the last gap of more than 5 days)']]};
  s.stats=[['Daily move',sg(j.cur,2)+'%'],['Index',lvl.toFixed(2)],['Date',dS(last)]];
  s.f={pct:sg(j.cur,2),lvl:lvl.toFixed(2),date:dD(last)};return s}
 function sLINK(inp){const C=inp.link,src=C&&C.src==='Coinbase'?'Coinbase':'Binance',base={id:'link',title:'LINK · 30-day return',group:'Coins',source:SRC.link[src],unit:'%',cash:'$LINK'};
  if(!C||!C.t||C.t.length<31)return{...base,missing:'LINK daily closes not loaded'};const now=inp.now||Date.now();let n=C.t.length;while(n&&C.t[n-1]+DAY>now)n--;/* completed UTC days only */
  const T=C.t.slice(0,n),V=C.v.slice(0,n),k=segStart(T,(a,b)=>b-a===DAY),tt=T.slice(k),vv=V.slice(k);const t=[],v=[];for(let i=30;i<tt.length;i++){t.push(tt[i]);v.push((vv[i]/vv[i-30]-1)*100)}if(!v.length)return{...base,missing:'fewer than 31 gap-free LINK closes'};
  const j=judge(t,v),last=t.at(-1),px=vv.at(-1);const m={metric:'LINK 30-day returns',wmetric:'LINK 30-day return',since:sinceOf(t)};
  const s={...base,j,t,v,since:m.since,srcFrom:tt[0],srcTo:last,dataT:last,price:px,kept:!!C.kept,dateTxt:`${dD(last)} UTC daily close`,readTxt:`LINK ${sg(j.cur,1)}% over 30 days to $${px.toFixed(3)}`,rarity:sentence(m,j),hist:enough(t[0],last),
   chart:{t:tt,v:vv,fmt:x=>'$'+x.toFixed(x<10?2:1),log:true},dp:1,fv:fmtAt(1,'%'),grid:0.01,fc:fmtAt(2,'%'),jo:{},
   facts:[['Reading',sg(j.cur,2)+'% ($'+vv[vv.length-31].toFixed(3)+' \u2192 $'+px.toFixed(3)+')'],['2nd / 98th percentile',sg(j.p2,2)+'% / '+sg(j.p98,2)+'%'],[`Low / high in previous ${WIN_DAYS} days`,j.win.n?sg(j.win.lo,2)+'% / '+sg(j.win.hi,2)+'%':'\u2014'],['Share at or '+(j.side==='low'?'below':'above'),j.shareTxt+'% of '+j.N.toLocaleString('en-US')+' readings'],['Window',dD(tt[0])+' \u2013 '+dD(last)+' ('+src+', completed UTC days, gap-free)']]};
  s.stats=[['30-day return',sg(j.cur,1)+'%'],['Close',('$'+px.toFixed(2))],['Date',dS(last)]];
  s.f={cash:s.cash,src,pct:sg(j.cur,1),px:px.toFixed(2),day:dS(last),date:dD(last)};return s}
 function sFunding(inp){const A=inp.derivs&&inp.derivs.assets&&inp.derivs.assets.BTC,f=A&&A.funding,base={id:'funding',title:'BTC funding (OKX)',group:'Derivatives',source:SRC.funding,unit:'% per 8h',never:'Funding never produces a post: under a year of history.'};
  if(!f||!f.points||!f.points.length)return{...base,missing:'no funding in derivs.json'};const P=f.points,t0=P[0][0],tl=P.at(-1)[0],r=P.at(-1)[1]*100,days=Math.round((tl-t0)/DAY);
  return{...base,t:P.map(p=>p[0]),v:P.map(p=>p[1]*100),since:t0,srcFrom:t0,srcTo:tl,dataT:tl,hist:enough(t0,tl)&&false,days,f:{r:sg(r,3),at:dS(tl)+' '+hm(tl)+' UTC'},dateTxt:dS(tl)+' '+hm(tl)+' UTC',readTxt:`Funding ${sg(r,3)}% per 8h`,rarity:notEnough(days,t0),chart:{t:P.map(p=>p[0]),v:P.map(p=>p[1]*100),fmt:x=>sg(x,3)+'%',zero:true},
   facts:[['Reading',sg(r,4)+'% per 8h'],['History',days+' days since '+dD(t0)+' (OKX serves about 3 months; the file stores it from 27 Jul 2026)'],['Signal','none until '+dD(plus1y(t0))]],post:null}}
 function sBasis(inp){const A=inp.derivs&&inp.derivs.assets&&inp.derivs.assets.BTC,b=A&&A.basis_hourly,base={id:'basis',title:'BTC basis (OKX perp vs spot)',group:'Derivatives',source:SRC.basis,unit:'%',never:'Basis never produces a post: under a year of history, and negative basis is the normal state.'};
  if(!b||!b.points||!b.points.length)return{...base,missing:'no basis in derivs.json'};const P=b.points,t0=P[0][0],tl=P.at(-1)[0],x=P.at(-1)[3],days=Math.round((tl-t0)/DAY),neg=P.filter(p=>p[3]<0).length;
  return{...base,t:P.map(p=>p[0]),v:P.map(p=>p[3]),since:t0,srcFrom:t0,srcTo:tl,dataT:tl,hist:false,days,f:{x:sg(x,4),at:dS(tl)+' '+hm(tl)+' UTC'},dateTxt:dS(tl)+' '+hm(tl)+' UTC',readTxt:`Basis ${sg(x,4)}%`,rarity:notEnough(days,t0)+'. Negative basis is the normal state and is never a signal',chart:{t:P.map(p=>p[0]),v:P.map(p=>p[3]),fmt:x=>sg(x,3)+'%',zero:true},
   facts:[['Reading',sg(x,4)+'%'],['Negative hours',neg+' of '+P.length],['History',days+' days since '+dD(t0)],['Signal','never (negative basis is the normal state); no rarity test until '+dD(plus1y(t0))]],post:null}}

 // ---------- assemble: note, post, freshness
 const ORDER=['oi7','oilvl','etf_btc','etf_eth','dgs10','t10y2y','dollar','link','funding','basis'];
 function build(inp){const now=inp.now||Date.now(),st=inp.stale||{};const L=[sOI7(inp),sOIlvl(inp),sETF(inp,'btc'),sETF(inp,'eth'),sDGS10(inp),sT10Y2Y(inp),sDollar(inp),sLINK(inp),sFunding(inp),sBasis(inp)];
  for(const s of L){s.stale=st[s.id]||'';s.fixture=!!inp.fixture;const P=TPL[s.id.startsWith('etf_')?'etf':s.id];
   if(s.missing){s.note1=`${s.title} \u00b7 \u2014`;s.note2=s.missing;s.note=s.note1+'\n'+s.note2;s.status='missing';s.post=null;s.postText=null;continue}
   if(!s.never&&!s.hist){s.rarity=notEnough(Math.round((s.t.at(-1)-s.since)/DAY),s.since);if(s.j)s.j.fires=false}
   s.status=s.stale?'stale':s.never||!s.hist?'history':s.j&&s.j.fires?'rare':'normal';
   // thresholds at the reading's own precision (s.dp): 2%/98% lines, or the 180-day low/high for the level
   // ONE threshold value per tail: s.cut (effective cut-off from judge()) feeds the card label, the chart line, the details row and audit check 7.
   // Labels at the reading's precision are rounded OUTWARD (toward the tail), so the labelled value itself always fires.
   if(s.j&&s.grid&&s.j.p2!=null&&!s.levelOnly){const etf=s.id.startsWith('etf_');s.cut={lo:etf?null:cutoff(s.t,s.v,'low',s.jo||{},s.grid),hi:cutoff(s.t,s.v,'high',s.jo||{},s.grid),p2:s.j.p2,p98:s.j.p98}}
   const outw=(x,side)=>{if(x==null)return null;const k=10**(s.dp||0),y=side==='low'?Math.floor(x*k+1e-9)/k:Math.ceil(x*k-1e-9)/k;return y};
   if(s.cut){s.cut.loLab=outw(s.cut.lo,'low');s.cut.hiLab=outw(s.cut.hi,'high')}
   if(s.fv&&s.j){const F=x=>x==null?'\u2014':s.fv(x);s.thr=s.id.startsWith('etf_')?{lo:null,hi:F(s.cut&&s.cut.hiLab),kind:'98% streak'}:s.levelOnly?(s.j.win&&s.j.win.n?{lo:s.fv(s.j.win.lo),hi:s.fv(s.j.win.hi),kind:'180-day'}:null):s.cut?{lo:F(s.cut.loLab),hi:F(s.cut.hiLab),kind:'2%'}:null}
   if(s.cut&&s.fc){const fc=x=>x==null?'\u2014':s.fc(x),etf=s.id.startsWith('etf_'),rows=etf?[['Fires at',TPL.firesAt('high',fc(s.cut.hi),fc(s.j.p98),true)]]:[['Fires at (low tail)',TPL.firesAt('low',fc(s.cut.lo),fc(s.j.p2))],['Fires at (high tail)',TPL.firesAt('high',fc(s.cut.hi),fc(s.j.p98))]];
    if(s.facts){const i=s.facts.findIndex(([k])=>k==='2nd / 98th percentile'||k==='98th percentile streak');if(i>=0)s.facts.splice(i,1,...rows);else s.facts.splice(1,0,...rows)}}
   // details panel uses the same precision: reading, 2nd/98th percentile and the 180-day low/high rows
   if(s.fv&&s.j&&s.facts&&!s.id.startsWith('etf_'))s.facts=s.facts.map(([k,v])=>k==='Reading'&&!s.levelOnly?[k,String(v).replace(/^[\u2212+\-]?[\d,.]+%?( bp)?/,s.fv(s.j.cur))]:/^Low \/ high in previous/.test(k)&&s.j.win&&s.j.win.n?[k,s.fv(s.j.win.lo)+' / '+s.fv(s.j.win.hi)]:[k,v]);
   // Chart-tab note: line 1 (bold) = short reading · verdict; line 2 (grey) = source, window of the measured series (since -> last), data time. Stale shows in the badge only.
   const j=s.j,V=TPL.verdict,verdict=(s.never||!s.hist)?V.history:j&&j.fires?(j.form==='cross'?`Turned ${s.cross}, first crossing this way in at least ${WIN_DAYS} days`:j.form==='tail'?(s.id.startsWith('etf_')?V.etfTail(dD(s.since)):V.tail(j.side==='low',dD(s.since))):s.rarity):V.normal;
   s.verdict=verdict;s.note1=`${P.short(s.f)} \u00b7 ${verdict}`;
   s.note2=TPL.note2(s.source,dD(s.since),dD(s.srcTo),P.when(s.f),(s.never||!s.hist)?[`no signal until ${dD(plus1y(s.since))}`,P.extra].filter(Boolean).join('; '):'');
   s.note=s.note1+'\n'+s.note2;
   if(P.head)s.head=P.head(s.f);const pSrc=POSTSRC[s.id.startsWith('oi')?'oi':'']||s.source;s.postSource=pSrc;s.srcLine=TPL.source(pSrc,P.src?P.src(s.f):'');
   const mk=(l1,d,sl)=>[l1,s.rarity+'.',d].filter(Boolean).concat([sl]).join('\n');s.post=null;s.postText=null;s.fit=null;
   if(s.status==='rare'&&P.post){const d=P.data?P.data(s.f):null;const tries=[[P.post(s.f),d,s.srcLine,null]];
    if(P.postTime)tries.push([P.postTime(s.f),d,TPL.source(pSrc),'snapshot time moved from the source line to line 1']);
    if(d&&P.dataFit)tries.push([P.post(s.f),P.dataFit(s.f),s.srcLine,'Data line short form']);
    const ok=tries.find(([a,b,c])=>xLen(mk(a,b,c))<=280)||tries[0];s.post=[ok[0],s.rarity+'.',ok[1]];s.srcLine=ok[2];s.postText=mk(ok[0],ok[1],ok[2]);s.fit=ok[3]}}
  return L}
 // X's own character count (twitter-text v3 'weighted length'): code points in 0-4351, 8192-8205, 8208-8223 and 8242-8247 count 1,
 // everything else 2 (so U+2212 '−' counts 2); every URL counts 23; an emoji (with its joiners/modifiers) counts 2. Text is NFC-normalised first.
 const XR=[[0,4351],[8192,8205],[8208,8223],[8242,8247]];
 const xLen=t=>{let s=String(t).normalize('NFC'),n=0;s=s.replace(/https?:\/\/\S+/g,()=>{n+=23;return''});
  const E=/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;s=s.replace(E,()=>{n+=2;return''});
  for(const ch of s){const c=ch.codePointAt(0);n+=XR.some(([a,b])=>c>=a&&c<=b)?1:2}return n};

 // ---------- AUDIT (wording rules section 7, each check fails closed) + supervisor recompute
 const BANNED=[/what followed/i,/last time/i,/historically leads? to/i,/signal to (buy|sell)/i,/\bbullish\b/i,/\bbearish\b/i,/capitulation/i,/smart money/i,/\bwhales?\b/i,/\bmassive\b/i,/\bhuge\b/i,/\binsane\b/i,/never seen/i,/all[- ]time/i,/\bbreaking\b/i,/\bnot rare\b/i,/most extreme 2%/i,/\bDXY\b/,/across exchanges/i,/market[- ]wide/i,/\b(buy|sell|buying|selling)\b/i,/\btargets?\b/i,/\bwill (rise|fall|go|hit|reach)\b/i,/\bINR\b|\u20b9|\bindia\b|\brupee/i];
 const NOWW=/\b(today|now|this morning|just now|tonight|currently)\b/i;
 const DATE_RE=/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( \d{4})?\b/;
 const FORMS=[/^10Y\u20132Y Treasury spread turned (positive|negative): [+\u2212]\d+\.\d\d pp, from [+\u2212]\d+\.\d\d pp the day before \(first crossing this way in at least 180 days\)$/,/^Among the (lowest|highest) 2% of [^.:]+ since \d{1,2} [A-Z][a-z]{2} \d{4}: (under 0\.1|\d+\.\d)% of ([\d,]+) readings were this (low or lower|high or higher)$/,/^(Lowest|Highest) [^.]+ in 180 days$/,/^\d+ straight days of net (outflows|inflows), complete days through \d{1,2} [A-Z][a-z]{2} \d{4}; a streak this long has happened on (under 0\.1|\d+\.\d)% of days since \d{1,2} [A-Z][a-z]{2} \d{4}$/];
 const toks=x=>(String(x).replace(/\u2212/g,'-').match(/[-+]?\$?\d+(,\d{3})*(\.\d+)?/g)||[]).map(z=>z.replace(/^\+/,''));
 function audit(text,sig,inp){const T=String(text||''),now=(inp&&inp.now)||Date.now(),C=[];const add=(k,name,pass,why)=>C.push({k,name,pass:!!pass,why:pass?'':why});
  const lines=T.split('\n').map(x=>x.trim()).filter(Boolean),rl=lines[1]||'';const rs=rl.replace(/\.$/,'');
  // recompute from the unrounded series at post time
  let R=null;try{R=inp?build({...inp,now}).find(x=>x.id===sig.id):null}catch(e){R=null}
  // 1. rarity sentence form + recomputed percent
  {const f=FORMS.find(re=>re.test(rs));let ok=!!f,why=f?'':'line 2 is not one of the fixed rarity forms';if(f&&R&&R.j){const m=rs.match(/: (under 0\.1|\d+\.\d)% of ([\d,]+) readings/)||rs.match(/happened on (under 0\.1|\d+\.\d)% of days/);if(m){const want=R.id.startsWith('etf_')?shareT(R.j.shareHi):R.j.shareTxt;if(m[1]!==want){ok=false;why=`stated share ${m[1]}% but the recomputed share is ${want}%`}if(m[2]&&+m[2].replace(/,/g,'')!==R.j.N){ok=false;why=`stated ${m[2]} readings but the history has ${R.j.N}`}}if(R.rarity!==rs){ok=false;why=why||`rarity sentence differs from the recomputed one ("${R.rarity}")`}}add(1,'Rarity sentence form and recomputed percent',ok,why)}
  // 2. any '180 days' claim must be a 180-calendar-day window, and hold on it
  {let ok=true,why='';if(/180 (trading days|sessions|readings|observations|obs|business days)/i.test(T)){ok=false;why='a 180-day window must be calendar days, not observations'}
   else if(/in 180 days/i.test(T)){const j=(R||sig).j;if(!j||!j.win||j.win.method!=='calendar'||j.win.to-j.win.from!==WIN){ok=false;why='the 180-day window was not computed over 180 calendar days'}
    else if(R&&R.j){const r=R.j;const claimLow=/^Lowest/.test(rs),claimHigh=/^Highest/.test(rs);if((claimLow&&r.winExt!=='low')||(claimHigh&&r.winExt!=='high')){ok=false;why=`not a new ${claimLow?'low':'high'} against every reading in the previous 180 calendar days`}}}
   if(ok&&sig.j&&sig.j.win&&sig.j.win.method!=='calendar'){ok=false;why='window computed in observations'}add(2,'180 days = 180 calendar days',ok,why)}
  // 3. no 'since' date earlier than the series' window start
  {let ok=true,why='';const E=EARLIEST[sig.id];const re=/since (\d{1,2} [A-Z][a-z]{2} \d{4})/g;let m;while((m=re.exec(T))){const d=Date.parse(m[1]+' UTC');if(!E||!isFinite(d)||d<ymd(E)){ok=false;why=`"since ${m[1]}" is earlier than the ${sig.id} window start ${E?dD(ymd(E)):'(unknown)'}`}else if(R&&d<ymd(iso(R.since))){ok=false;why=`"since ${m[1]}" is earlier than this history's first reading ${dD(R.since)}`}}add(3,'Since date not before the window start',ok,why)}
  // 4. under 365 days of history, negative basis or funding: no post
  {let ok=true,why='';if(['funding','basis'].includes(sig.id)||sig.never){ok=false;why=sig.id==='basis'?'basis never produces a post':'funding never produces a post'}else if(!(R||sig).hist){ok=false;why='under 365 days of gap-free history'}else if(/\bbasis\b/i.test(T)&&/negative/i.test(T)){ok=false;why='negative basis is never a signal'}add(4,'History of at least 365 days; never funding or basis',ok,why)}
  // 5. banned phrases
  {const hit=BANNED.filter(re=>re.test(T)).map(re=>(T.match(re)||[''])[0]);add(5,'No banned phrase',!hit.length,'banned: '+hit.map(h=>'"'+h+'"').join(', '))}
  // 6. data date present (UTC), and no 'today'/'now' on data older than an hour
  {let ok=DATE_RE.test(T)&&/UTC|FRED, latest published|latest published day/.test(T),why=ok?'':'no data date in UTC';const age=(now-(sig.dataT||0))/36e5;if(ok&&NOWW.test(T)&&age>1){ok=false;why=`says "${T.match(NOWW)[0]}" on data ${age.toFixed(1)}h old`}add(6,'Data date shown; no "today"/"now" on old data',ok,why)}
  // 7. ties: a share above 2.0% does not fire (10Y), and a tail post only at or beyond the effective cut-off recomputed now (every percentile series)
  {let ok=true,why='';const r=R||sig;if(r.cut&&r.j&&r.j.form==='tail'){const lo=r.j.side==='low',c=lo?r.cut.lo:r.cut.hi;if(c==null||(lo?r.j.cur>c:r.j.cur<c)){ok=false;why=`reading ${r.j.cur} is not beyond the effective cut-off ${c}`}}if(r.id==='dgs10'&&r.j&&r.j.form==='tail'&&floor1(r.j.share)>2.0){ok=false;why=`10Y share with ties is ${floor1(r.j.share).toFixed(1)}%, above 2.0%`}
   if(r.id==='dgs10'&&/Among the (lowest|highest) 2%/.test(T)&&!(r.j&&r.j.form==='tail')){ok=false;why=`10Y share with ties is ${r.j?floor1(r.j.share).toFixed(1):'?'}%, above 2.0%: it does not fire`}add(7,'Ties above 2.0% do not fire; reading beyond the effective cut-off',ok,why)}
  // R. every figure recomputed from the unrounded series at post time
  {let ok=!!(R&&R.postText),why=R?(R.postText?'':'the recomputed reading is not rare: no post'):'could not recompute from the series';if(ok){const want=new Set(toks(R.postText)),bad=toks(T).filter(x=>!want.has(x));if(bad.length){ok=false;why='figures not in the recomputed post: '+bad.join(', ')}const miss=toks(R.postText).filter(x=>!toks(T).includes(x));if(ok&&miss.length&&toks(lines[0]||'').length<toks(R.postText.split('\n')[0]).length){ok=false;why='line 1 figures missing: '+miss.join(', ')}}add('R','Every figure recomputed at post time',ok,why)}
  // S. exact source name; F. fresh data; X. post format
  {const src=lines.at(-1)||'',want=(R||sig).srcLine||TPL.source((R||sig).source),ok=src===want;add('S','Exact source name',ok,`source line must be "${want}"`)}
  {const s=(R&&R.stale)||sig.stale;add('F','Data inside its freshness limit',!s,'stale: '+s)}
  {const cash=(T.match(/\$[A-Za-z]{2,6}\b/g)||[]).length,em=/\p{Extended_Pictographic}/u.test(T);let ok=xLen(T)<=280&&cash<=1&&!em&&lines.length<=4,why=xLen(T)>280?`${xLen(T)} characters, over 280`:cash>1?'more than one cashtag':em?'no emoji in rare-signal posts':lines.length>4?'max 3 lines plus the source line':'';add('X','X format (280, one cashtag, no emoji, 3 lines + source)',ok,why)}
  return{ok:C.every(c=>c.pass),checks:C,fixture:!!(inp&&inp.fixture)}}

 // ---------- TEST FIXTURES (examples; never shown as live): built from real history with the newest point replaced
 const FX={
  // newest OKX bucket set so the 7-day change lands exactly on the 2nd-percentile line (a tie fires)
  oiAtLine(inp){const D=JSON.parse(JSON.stringify(inp.derivs)),O=D.assets.BTC.oi_daily;O.points=O.points.slice(-1008);/* 1,001 seven-day readings: (N-1)*2% = 20 exactly, so the 2% line is one reading, no interpolation */
   const P=O.points,n=P.length,ch=[];for(let i=7;i<n-1;i++)ch.push(P[i][2]/P[i-7][2]-1);ch.sort((a,b)=>a-b);const x=(ch[19]+ch[20])/2;/* 20 readings below it: with it included it is the 21st smallest = the 2nd percentile itself */
   P[n-1][2]=P[n-8][2]*(1+x);P[n-1][1]=P[n-1][2]*(P[n-2][1]/P[n-2][2]);return{...inp,derivs:D,fixture:true,stale:{}}},
  // a sharp fall: newest bucket 19% below the bucket 7 days earlier (example preview)
  oiDrop(inp,pct=-19.2){const L0=sOI7(inp),base=L0&&L0.j?{oi7:{p2:L0.j.p2,p98:L0.j.p98}}:null;/* the example fires on the live 2%/98% lines, not on lines recomputed with its synthetic bucket */
   const D=JSON.parse(JSON.stringify(inp.derivs)),P=D.assets.BTC.oi_daily.points,n=P.length;P[n-1][2]=P[n-8][2]*(1+pct/100);P[n-1][1]=P[n-1][2]*(P[n-2][1]/P[n-2][2]);return{...inp,derivs:D,fixture:true,stale:{},thrBase:base}},
  // ETF: a long outflow streak whose newest row is still pending (the pending row must never count)
  etfPending(inp,a='btc',len=15){const E=JSON.parse(JSON.stringify(inp.etf)),d=E.datasets[a],rows=d.days.filter(r=>!r.pending);let c=0;for(let i=rows.length-1;i>=0&&c<len;i--){const N=nyse();if(N&&!N.open(rows[i].date))continue;rows[i].total=-100-c;c++}
   const lastT=ymd(rows.at(-1).date);let t=lastT+DAY;const N=nyse();while(N&&!N.open(t))t+=DAY;d.days=rows.concat([{date:iso(t),total:null,funds:{},pending:true}]);return{...inp,etf:E,fixture:true,stale:{}}},
  // 10Y: newest published move set to bp basis points (moves are rounded to 1 bp, so this ties with every past move of that size)
  tenY(inp,bp=-14){const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.DGS10.points,n=P.length;P[n-1][1]=Math.round((P[n-2][1]+bp/100)*100)/100;return{...inp,macro:M,fixture:true,stale:{}}},
  // dollar index: keep FRED's own date (13 Nov), never 'today'
  dollar(inp,pct=-1.1){const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.DTWEXBGS.points,n=P.length;P[n-1][1]=+(P[n-2][1]*(1+pct/100)).toFixed(4);return{...inp,macro:M,fixture:true,stale:{}}}};
 return{TPL,POSTSRC,shareT,cutoff,build,audit,judge,quantile,floor1,EARLIEST,SRC,BANNED,FORMS,WIN_DAYS,MIN_DAYS,FX,dD,dT,ORDER,xLen}})();
if(typeof module==='object'&&module&&module.exports)module.exports=RARE;
