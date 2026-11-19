// trare.js (19 Nov 2026): rare-signals engine + posting-desk audit (shared/rare.js).
// CRYPTO GOD's spec, Crypto News GOD's wording rules (section 7: one test per audit check) and the supervisor's rulings:
//  OI 7-day change in percent, OI level 180-day high/low only, 180 CALENDAR days everywhere, audit recomputes every figure at post time.
// Supervisor fixtures: S1 today's no-signal case, S2 a 7-day OI drop exactly at the 2% line (fires on a tie), S3 an ETF streak containing a pending row
// (pending never counted), S4 the dollar index dated 13 Nov, never 'today'. Plus wording tests (banned words, 'not rare', since-dates, source names, '180 days').
// Inputs: tests/fixtures/rare/today.json (live data recorded 19 Nov). Plain node; no network.
const fs=require('fs'),path=require('path');const R=require('../shared/rare.js');
const J=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/rare/today.json'),'utf8'));const NOW=Date.parse(J.now),DAY=864e5;
const inp={now:NOW,derivs:J.derivs,etf:J.etf,macro:J.macro,link:{t:J.link.t,v:J.link.v,src:J.link.src},stale:{}};
let F=0;const ok=(c,m,x)=>{if(c)console.log('PASS '+m);else{F++;console.log('FAIL '+m+(x!==undefined?' '+JSON.stringify(x).slice(0,400):''))}};
const B=i=>R.build(i),by=(L,id)=>L.find(s=>s.id===id),r2=(x,d=2)=>Math.round(x*10**d)/10**d;
const chk=(A,k)=>A.checks.find(c=>String(c.k)===String(k));
const T=B(inp);const ALL=[T];

// ---------- S1: today's no-signal case (numbers recomputed from live data; CRYPTO GOD 19 Nov + supervisor percent ruling)
{const s=by(T,'oi7');ok(s.status==='normal'&&r2(s.j.cur)===-11.33&&r2(s.coins,1)===-4233.3&&r2(s.j.p2)===-17.51&&r2(s.j.p98)===18.89&&s.j.N===1047,'S1 OI 7-day change -11.33% (-4,233.3 BTC), rare below -17.51% / above +18.89%, 1,047 readings: normal',{cur:s.j.cur,p2:s.j.p2,p98:s.j.p98,N:s.j.N})}
{const s=by(T,'oilvl');ok(s.status==='normal'&&r2(s.level||s.v.at(-1),1)===33121.9&&r2(s.j.win.lo,1)===26524.2&&r2(s.j.win.hi,1)===39954&&!s.j.tail,'S1 OI level 33,121.9 BTC vs 180-day low 26,524.2 / high 39,954.0: normal, no percentile test',s.j.win)}
{const b=by(T,'etf_btc'),e=by(T,'etf_eth');ok(b.status==='normal'&&b.n===1&&b.dir<0&&R.dD(b.dataT)==='17 Nov 2026'&&b.j.win.hi===13&&e.status==='normal'&&e.n===2&&e.dir<0&&e.j.win.hi===17,'S1 ETF: BTC 1 day of outflows, ETH 2 days, complete days through 17 Nov (18 Nov pending), longest in 180 days 13 / 17',{b:[b.n,b.j.win.hi],e:[e.n,e.j.win.hi]})}
{const s=by(T,'dgs10');ok(s.status==='normal'&&s.j.cur===-2&&s.j.p2===-14&&s.j.p98===14&&s.j.win.lo===-17&&s.j.win.hi===15&&s.j.N===16203,'S1 10Y -2 bp, 2%/98% -14/+14 bp, 180-day -17/+15 bp, 16,203 moves: normal',{p:[s.j.p2,s.j.p98],w:[s.j.win.lo,s.j.win.hi]})}
{const s=by(T,'t10y2y');ok(s.status==='normal'&&s.j.cur===0.27&&!s.crossed,'S1 2s10s +0.27 pp, no crossing: normal')}
{const s=by(T,'dollar');ok(s.status==='normal'&&r2(s.j.cur,3)===0.087&&R.dD(s.dataT)==='13 Nov 2026'&&r2(s.j.win.lo,3)===-0.922&&r2(s.j.win.hi,3)===0.845&&r2(s.j.p2,3)===-0.670&&r2(s.j.p98,3)===0.686&&s.j.N===2696,'S1 dollar +0.087% on 13 Nov; 180 calendar days -0.922% / +0.845%; 2%/98% -0.670/+0.686%: normal',{lo:s.j.win.lo,hi:s.j.win.hi})}
{const s=by(T,'link');ok(s.status==='normal'&&r2(s.j.cur)===-24.68&&r2(s.j.p2)===-43.64&&r2(s.j.p98)===109.67&&r2(s.j.win.lo)===-28.7&&r2(s.j.win.hi)===61.59&&s.j.N===2834,'S1 LINK -24.68%, 2%/98% -43.64/+109.67%, 180-day -28.70/+61.59%: normal')}
ok(['funding','basis'].every(id=>by(T,id).status==='history'&&by(T,id).postText===null),'S1 funding and basis: not enough history, no post');
ok(T.every(s=>!s.postText)&&T.filter(s=>s.status==='rare').length===0,'S1 nothing is rare today: no post anywhere');
ok(R.audit('$BTC perpetual open interest on OKX: −11.3% in 7 days (−4,233 BTC), to 33,122 BTC.\nAmong the lowest 2% of 7-day changes since 1 Jan 2024: 7.5% of 1,047 readings were this low or lower.\nData to 19 Nov 02:50 UTC.\nSource: '+R.SRC.oi+'.',by(T,'oi7'),inp).ok===false,'S1 a post written for today\'s non-rare reading fails the audit');

// ---------- S2: 7-day OI drop exactly at the 2% line fires on the tie
{const fi=R.FX.oiAtLine(inp),L=B(fi),s=by(L,'oi7');ALL.push(L);ok(s.j.cur===s.j.p2&&s.j.N===1001&&s.status==='rare'&&s.j.form==='tail'&&s.j.shareTxt==='2.0','S2 reading == 2nd percentile (1,001 readings, share 2.0%): fires',{cur:s.j.cur,p2:s.j.p2,share:s.j.share});
 const A=R.audit(s.postText,s,fi);ok(A.ok,'S2 its post passes all audit checks',A.checks.filter(c=>!c.pass));
 const D=JSON.parse(JSON.stringify(fi.derivs)),P=D.assets.BTC.oi_daily.points,n=P.length;P[n-1][2]=P[n-8][2]*(1+(s.j.cur/100)*0.995);const s2=by(B({...fi,derivs:D}),'oi7');ok(s2.status!=='rare'&&s2.j.cur>s2.j.p2,'S2 just inside the 2% line: does not fire',{cur:s2.j.cur,p2:s2.j.p2})}

// ---------- S3: ETF streak containing a pending row; the pending row is never counted
{const fi=R.FX.etfPending(inp,'btc',15),L=B(fi),s=by(L,'etf_btc'),pend=fi.etf.datasets.btc.days.filter(r=>r.pending);ALL.push(L);
 ok(pend.length===1&&s.n===15&&!s.t.includes(Date.parse(pend[0].date+'T00:00:00Z'))&&R.dD(s.dataT)==='17 Nov 2026','S3 15 complete outflow days + 1 pending row: streak 15, through 17 Nov, pending date not read',{n:s.n,pend:pend[0].date});
 const E2=JSON.parse(JSON.stringify(fi.etf));E2.datasets.btc.days.at(-1).total=-999;const s2=by(B({...fi,etf:E2}),'etf_btc');ok(s2.n===s.n&&s2.cum===s.cum&&s2.status===s.status,'S3 a pending row with a total still never counts');
 ok(s.status==='rare'&&R.audit(s.postText,s,fi).ok&&!/pending/i.test(s.postText+s.note),'S3 the streak post passes the audit and never mentions the pending row')}

// ---------- S4: dollar index dated 13 Nov, never 'today'
{const s=by(T,'dollar');ok(/last data 13 Nov 2026/.test(s.note)&&!/\b(today|now)\b/i.test(s.note),'S4 dollar note carries its own date (last data 13 Nov 2026), never today',s.note);
 const fi=R.FX.dollar(inp,-1.1),L=B(fi),d=by(L,'dollar');ALL.push(L);ok(d.status==='rare'&&/13 Nov 2026/.test(d.postText)&&R.audit(d.postText,d,fi).ok,'S4 a rare dollar move posts with 13 Nov 2026 and passes',d.postText);
 const bad=d.postText.replace('Data to 13 Nov 2026 (FRED, latest published).','Data: today (FRED, latest published).');const A=R.audit(bad,d,fi);ok(!A.ok&&!chk(A,6).pass,'S4 the same post saying "today" fails check 6',chk(A,6))}

// ---------- ETF streaks: NYSE calendar decides what to skip (CRYPTO GOD ruling 19 Nov), thresholds from the data
{const b=by(T,'etf_btc'),e=by(T,'etf_eth');ok(b.j.p98===13&&e.j.p98===16&&b.j.win.hi===13&&e.j.win.hi===17&&b.j.N===717&&e.j.N===585,'E1 thresholds from the data: 98th percentile streak 13 days BTC / 16 ETH; longest in 180 days 13 BTC / 17 ETH (717 / 585 trading days)',{b:[b.j.p98,b.j.win.hi,b.j.N],e:[e.j.p98,e.j.win.hi,e.j.N]});
 const hol=J.etf.datasets.btc.days.filter(r=>!r.pending&&!require('../shared/nyse.js').open(r.date));ok(hol.length===15&&hol.every(r=>(+r.total||0)===0),'E1 the 15 BTC holiday rows in etf.json (total 0) are skipped by the calendar, not by their total',hol.map(r=>r.date))}
const NY=require('../shared/nyse.js');
// synthetic tail after the last complete day (17 Nov, outflow): 18-25 Nov trading days, 26 Nov = Thanksgiving (NYSE closed), 27 Nov trading day
const etfTail=(rows,now='2026-11-28T12:00:00Z')=>{const E=JSON.parse(JSON.stringify(inp.etf)),d=E.datasets.btc;d.days=d.days.filter(r=>!r.pending).concat(rows.map(([date,total,pending])=>({date,total,pending:!!pending})));return{...inp,now:Date.parse(now),etf:E}};
const run=[['2026-11-18',-10],['2026-11-19',-20],['2026-11-20',-30],['2026-11-23',-40],['2026-11-24',-50],['2026-11-25',-60]];
ok(!NY.open('2026-11-26')&&NY.open('2026-11-25')&&NY.open('2026-11-27'),'E2 calendar: 26 Nov 2026 (Thanksgiving) closed, 25 and 27 Nov open');
{const s=by(B(etfTail(run.concat([['2026-11-26',0],['2026-11-27',-70]]))),'etf_btc');ok(s.n===8&&s.dir<0&&R.dD(s.dataT)==='27 Nov 2026','E2 a holiday row (total 0) inside a run does not break the streak: 17-27 Nov = 8 trading days',{n:s.n})}
{const s=by(B(etfTail(run.concat([['2026-11-26',-55],['2026-11-27',-70]]))),'etf_btc');ok(s.n===8&&Math.round(s.cum*10)/10===-519.9,'E2 a holiday row with a non-zero total is still skipped (calendar decides, not the total): 8 days, holiday flow not summed',{n:s.n,cum:s.cum})}
{const s=by(B(etfTail(run.slice(0,5).concat([['2026-11-25',0],['2026-11-26',0],['2026-11-27',-70]]))),'etf_btc');ok(s.n===1&&R.dD(s.dataT)==='27 Nov 2026','E3 a trading day with total exactly 0 (25 Nov) breaks the streak: only 27 Nov counts',{n:s.n})}
{const s0=by(B(etfTail(run)),'etf_btc'),s=by(B(etfTail(run.concat([['2026-11-27',-999,true]]))),'etf_btc');ok(s.n===s0.n&&s.n===7&&s.cum===s0.cum&&R.dD(s.dataT)==='25 Nov 2026','E4 a pending row (even with a total) is never counted: streak stays 7 through 25 Nov',{n:s.n,s0:s0.n})}

// ---------- audit checks: one test each (wording rules section 7) + recompute
const FX=R.FX.oiDrop(inp,-19.2),FL=B(FX),FS=by(FL,'oi7');ALL.push(FL);ok(FS.status==='rare'&&R.audit(FS.postText,FS,FX).ok,'fixture: OI -19.2% example passes every check',R.audit(FS.postText,FS,FX).checks.filter(c=>!c.pass));
const fail=(txt,k,m,sig=FS,i=FX)=>{const A=R.audit(txt,sig,i);ok(!A.ok&&!chk(A,k).pass,m,{k,check:chk(A,k)})};
fail(FS.postText.replace('Among the lowest 2%','Among the most extreme 2%'),1,'C1 a rarity sentence outside the fixed forms fails');
fail(FS.postText.replace(': 1.5% of',': 1.4% of'),1,'C1 a stated percent that differs from the recomputed share fails');
fail(FS.postText.replace(/Among the lowest[^\n]+/,'Lowest 7-day change in 180 trading days.'),2,'C2 "180 trading days" fails (calendar days only)');
{const sig={...FS,j:{...FS.j,win:{...FS.j.win,method:'obs'}}};fail(FS.postText.replace(/Among the lowest[^\n]+/,'Lowest 7-day change in 180 days.'),2,'C2 a window computed in observations fails',sig)}
{const fi=R.FX.oiDrop(inp,-12),s=by(B(fi),'oi7');fail('$BTC perpetual open interest on OKX: −12.0% in 7 days, to 33,122 BTC.\nLowest 7-day change in 180 days.\nData to 19 Nov 02:50 UTC.\nSource: '+R.SRC.oi+'.',2,'C2 a "lowest in 180 days" claim that is not a 180-calendar-day low fails',s,fi)}
fail(FS.postText.replace('since 1 Jan 2024','since 1 Dec 2023'),3,'C3 a since date before the OI window start (1 Jan 2024) fails');
{const f=by(T,'funding'),b=by(T,'basis');const A=R.audit('Funding −0.001% per 8h (19 Nov 00:00 UTC).\nLowest funding in 180 days.\nSource: '+R.SRC.funding+'.',f,inp),Bq=R.audit('Basis −0.0458% (19 Nov 01:00 UTC).\nLowest basis in 180 days.\nSource: '+R.SRC.basis+'.',b,inp);ok(!chk(A,4).pass&&!chk(Bq,4).pass,'C4 funding and basis can never produce a post')}
{const D=JSON.parse(JSON.stringify(inp.derivs));D.assets.BTC.oi_daily.points=D.assets.BTC.oi_daily.points.slice(-300);const P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=P[P.length-8][2]*0.7;const i2={...inp,derivs:D},s=by(B(i2),'oi7');
 ok(s.status==='history'&&!s.postText&&/Not enough history yet/.test(s.note),'C4 a series under 365 days shows "Not enough history yet" and has no post',s.note);fail(FS.postText,4,'C4 the audit fails a post for a series under 365 days',s,i2)}
for(const w of ['what followed','last time this happened','bullish','bearish','whales','massive','BREAKING','not rare','DXY','buy','all-time','capitulation','smart money','huge','INR'])fail(FS.postText.replace('in 7 days','in 7 days, '+w),5,'C5 banned phrase "'+w+'" fails');
fail(FS.postText.replace('\nData to 19 Nov 02:50 UTC.',''),6,'C6 a post with no data date fails');
fail(FS.postText.replace('Data to 19 Nov','Data now to 19 Nov'),6,'C6 "now" on data older than one hour fails');
{const fi=R.FX.tenY(inp,-14),s=by(B(fi),'dgs10');ok(s.j.cur<=s.j.p2&&R.floor1(s.j.share)>2.0&&s.status==='normal'&&!s.postText,'C7 10Y -14 bp sits on the 2% line but ties push the share to '+R.floor1(s.j.share).toFixed(1)+'%: does not fire',{share:s.j.share});
 const t='US 10-year Treasury yield: −14 bp in a day, to '+s.level.toFixed(2)+'%.\nAmong the lowest 2% of daily moves in the US 10-year yield since 3 Jan 1962: '+R.floor1(s.j.share).toFixed(1)+'% of 16,203 readings were this low or lower.\nData to 17 Nov 2026 (FRED, latest published).\nSource: FRED DGS10.';fail(t,7,'C7 a post claiming the 2% tail on that tie fails',s,fi);
 const f15=R.FX.tenY(inp,-15),s15=by(B(f15),'dgs10');ALL.push(B(f15));ok(s15.status==='rare'&&R.audit(s15.postText,s15,f15).ok&&/: 1\.9% of 16,203 readings were this low or lower/.test(s15.postText),'C7 -15 bp: computed share 1.9% is stated and it fires',s15.postText)}
fail(FS.postText.replace('19.2%','19.3%'),'R','R an edited figure fails the recompute');
{const D=JSON.parse(JSON.stringify(FX.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]*=1.01;fail(FS.postText,'R','R the series moved before posting: the old figures fail the recompute',FS,{...FX,derivs:D})}
fail(FS.postText.replace(R.SRC.oi,'Open interest across exchanges'),'S','S a source line other than the exact source name fails');
{const i2={...FX,stale:{oi7:'Data stale, 6h0m old, past 5h limit (OKX).'}},s=by(B(i2),'oi7');ok(s.status==='stale'&&/Data stale/.test(s.note),'F stale OI shows the stale label in its note');fail(FS.postText,'F','F stale data blocks the post',s,i2)}
fail(FS.postText+' 🚀','X','X emoji in a rare-signal post fails');

// ---------- wording
const notes=[],posts=[];for(const L of ALL)for(const s of L){notes.push([s.id,s.note]);if(s.postText)posts.push([s.id,s.postText])}
ok(notes.concat(posts).every(([,t])=>!/not rare/i.test(t)),'W no note or post ever says "not rare"');
ok(T.filter(s=>s.status==='normal').every(s=>/\. Within its normal range\. Source: /.test(s.note)),'W no-signal notes read "Within its normal range"');
ok(posts.length>=5&&posts.every(([,t])=>!R.BANNED.some(re=>re.test(t))),'W no banned word in any generated post ('+posts.length+' posts)',posts.filter(([,t])=>R.BANNED.some(re=>re.test(t))));
ok(notes.every(([id,t])=>{const m=[...t.matchAll(/since (\d{1,2} [A-Z][a-z]{2} \d{4})/g)];return m.every(x=>Date.parse(x[1]+' UTC')>=Date.parse(R.EARLIEST[id]+'T00:00:00Z'))})&&posts.every(([id,t])=>[...t.matchAll(/since (\d{1,2} [A-Z][a-z]{2} \d{4})/g)].every(x=>Date.parse(x[1]+' UTC')>=Date.parse(R.EARLIEST[id]+'T00:00:00Z'))),'W every since-date is on or after the series window start');
{const E=R.EARLIEST;ok(E.oi7==='2024-01-01'&&E.etf_btc==='2024-01-11'&&E.etf_eth==='2024-07-23'&&E.dgs10==='1962-01-03'&&E.t10y2y==='1976-06-01'&&E.dollar==='2016-01-27'&&E.link==='2019-01-16','W earliest since-dates match the wording rules')}
ok(/Source: OKX BTC perpetual \(BTC-USDT-SWAP\) open interest, in BTC,/.test(by(T,'oi7').note)&&/Source: FRED broad dollar index \(DTWEXBGS\),/.test(by(T,'dollar').note)&&/Source: Farside Investors, complete days only,/.test(by(T,'etf_btc').note)&&/Source: FRED DGS10,/.test(by(T,'dgs10').note)&&/Source: FRED T10Y2Y,/.test(by(T,'t10y2y').note)&&/Source: Binance LINKUSDT daily closes,/.test(by(T,'link').note),'W exact source names on every note');
ok(notes.concat(posts).every(([,t])=>!/\bDXY\b|across exchanges|market-wide/i.test(t)),'W never "DXY", "across exchanges" or "market-wide"');
{const s=by(B({...inp,link:{...inp.link,src:'Coinbase'}}),'link');ok(/Source: Coinbase LINK-USD daily closes,/.test(s.note)&&!/Binance/.test(s.note),'W LINK note names Coinbase when the closes came from the Coinbase fallback',s.note)}
ok(/snapshot \d{1,2} Nov \d\d:\d\d UTC/.test(by(T,'oi7').note)&&/still open/.test(by(T,'oi7').note),'W OI note gives the snapshot time in UTC (newest bucket still open)');
ok(T.filter(s=>s.j&&s.j.win).every(s=>s.j.win.method==='calendar'&&s.j.win.to-s.j.win.from===180*DAY),'W every 180-day window is 180 calendar days');
{const D=JSON.parse(JSON.stringify(inp.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=41000;const L=B({...inp,derivs:D}),s=by(L,'oilvl');ALL.push(L);ok(s.status==='rare'&&s.rarity==='Highest OKX BTC perpetual open interest in 180 days'&&/in 180 days/.test(s.postText)&&!/2%/.test(s.postText)&&R.audit(s.postText,s,{...inp,derivs:D}).ok,'W OI level uses only the 180-day form ("in 180 days", no percentile)',s.postText)}
{const fi=R.FX.oiDrop(inp,-26),s=by(B(fi),'oi7');ok(s.j.tail&&s.j.winExt==='low'&&s.j.form==='tail'&&/^Among the lowest 2%/.test(s.rarity),'W both conditions met: the tail form is used, not both')}
ok(posts.every(([,t])=>!/180 (trading days|sessions|observations|readings)/i.test(t))&&notes.every(([,t])=>!/180 trading days/i.test(t)),'W never "180 trading days"');
ok(notes.concat(posts).every(([,t])=>!/\u20b9|\bINR\b|\bIndia/i.test(t)),'W USD only: no INR or India');
ok(posts.every(([,t])=>!/what followed|last time/i.test(t))&&ALL.flat().every(s=>!s.facts||s.facts.every(f=>!/what followed|last time/i.test(f.join(' ')))),'W no "what followed" or "last time" anywhere');
ok(posts.every(([,t])=>R.xLen(t)<=280&&t.split('\n').length<=4),'W every post fits 280 characters and 3 lines + source');

// ---------- CNG review (19 Nov): '7-day' wording, exact OI post shape, card headline
ok(FS.postText==='$BTC perpetual open interest on OKX: −19.2% in 7 days (−7,172 BTC), to 30,183 BTC.\nAmong the lowest 2% of 7-day changes since 1 Jan 2024: 1.5% of 1,047 readings were this low or lower.\nData to 19 Nov 02:50 UTC.\nSource: OKX BTC perpetual (BTC-USDT-SWAP) open interest, in BTC.','N1 OI post matches CNG\'s template exactly',FS.postText);
ok(FS.head==='BTC open interest on OKX: −19.2% in 7 days'&&!/UTC|\d\d:\d\d/.test(FS.head),'N2 card headline has no timestamp',FS.head);
{const fi=R.FX.oiDrop(inp,-26),s=by(B(fi),'oi7');ok(!/weekly/i.test(s.note+s.postText)&&/7-day changes/.test(s.rarity),'N3 "7-day", never "weekly", in notes and posts')}
{/* synthetic OKX series (deterministic): a volatile first 420 days sets wide 2% tails, a calm last 180+ days; the newest 7-day change is a new 180-day low but inside the tail */
 let z=12345;const rnd=()=>{z=(z*1103515245+12345)%2147483648;return z/2147483648-0.5};const D=JSON.parse(JSON.stringify(inp.derivs)),O=D.assets.BTC.oi_daily,t0=O.points.at(-1)[0]-619*DAY;let c=30000;const P=[];
 for(let i=0;i<620;i++){c*=Math.exp((i<420?0.06:0.004)*rnd());P.push([t0+i*DAY,c*70000,c])}O.points=P;const n=P.length;let lo=Infinity;for(let i=n-180;i<n-1;i++)lo=Math.min(lo,P[i][2]/P[i-7][2]-1);
 P[n-1][2]=P[n-8][2]*(1+lo-0.01);const i2={...inp,derivs:D},s=by(B(i2),'oi7');
 ok(s.j.form==='window'&&s.rarity==='Lowest 7-day change in 180 days'&&R.audit(s.postText,s,i2).ok,'N4 180-day form reads "Lowest 7-day change in 180 days" and passes the audit',{form:s.j.form,r:s.rarity,p2:s.j.p2,cur:s.j.cur,post:s.postText,A:s.postText&&R.audit(s.postText,s,i2).checks.filter(c=>!c.pass)})}
ok(R.FORMS.some(re=>re.test('Highest 7-day change in 180 days'))&&!R.FORMS.some(re=>re.test('Among the lowest 2% of weekly changes since 1 Jan 2024 (1.5% of 1,047 readings at or below this)')),'N5 audit forms: new "7-day" tail and window forms allowed, the old parenthesised form is not');
ok(posts.every(([,t])=>{const L=t.split('\n');return L.length===4&&/^Data to \d{1,2} [A-Z][a-z]{2}/.test(L[2])&&/^Source: /.test(L[3])}),'N6 every post: 3 lines + source, date on its own line ("Data to …")',posts.map(p=>p[1].split('\n')[2]));
ok(ALL.flat().filter(s=>s.postText).every(s=>s.head&&!/UTC|\d\d:\d\d/.test(s.head)),'N7 every rare card headline is free of timestamps');
console.log('FAILS: '+F);process.exit(F?1:0);
