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
{const s=by(T,'t10y2y');ok(s.status==='normal'&&s.level===0.27&&s.j.cur===-3&&!s.cross,'S1 2s10s −3 bp in one day to +0.27 pp, no crossing: normal',{lvl:s.level,cur:s.j.cur})}
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
{const s=by(T,'dollar');ok(/data 13 Nov 2026/.test(s.note)&&!/\b(today|now)\b/i.test(s.note),'S4 dollar note carries its own date (data 13 Nov 2026), never today',s.note);
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
fail(FS.postText.replace('since 8 Jan 2024','since 1 Dec 2023'),3,'C3 a since date before the OI window start (1 Jan 2024) fails');
fail(FS.postText.replace('since 8 Jan 2024','since 1 Jan 2024'),3,'C3b a since date before the first 7-day change (8 Jan 2024) fails');
{const f=by(T,'funding'),b=by(T,'basis');const A=R.audit('Funding −0.001% per 8h (19 Nov 00:00 UTC).\nLowest funding in 180 days.\nSource: '+R.SRC.funding+'.',f,inp),Bq=R.audit('Basis −0.0458% (19 Nov 01:00 UTC).\nLowest basis in 180 days.\nSource: '+R.SRC.basis+'.',b,inp);ok(!chk(A,4).pass&&!chk(Bq,4).pass,'C4 funding and basis can never produce a post')}
{const D=JSON.parse(JSON.stringify(inp.derivs));D.assets.BTC.oi_daily.points=D.assets.BTC.oi_daily.points.slice(-300);const P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=P[P.length-8][2]*0.7;const i2={...inp,derivs:D},s=by(B(i2),'oi7');
 ok(s.status==='history'&&!s.postText&&/Not enough history yet/.test(s.note),'C4 a series under 365 days shows "Not enough history yet" and has no post',s.note);fail(FS.postText,4,'C4 the audit fails a post for a series under 365 days',s,i2)}
for(const w of ['what followed','last time this happened','bullish','bearish','whales','massive','BREAKING','not rare','DXY','buy','all-time','capitulation','smart money','huge','INR'])fail(FS.postText.replace('in the 7 days','in the 7 days, '+w),5,'C5 banned phrase "'+w+'" fails');
fail(FS.postText.replace(' to 19 Nov','').replace(', snapshot 19 Nov 02:50 UTC',''),6,'C6 a post with no data date fails');
fail(FS.postText.replace('in the 7 days to 19 Nov','in the 7 days to now'),6,'C6 "now" on data older than one hour fails');
{const fi=R.FX.tenY(inp,-14),s=by(B(fi),'dgs10');ok(s.j.cur<=s.j.p2&&R.floor1(s.j.share)>2.0&&s.status==='normal'&&!s.postText,'C7 10Y -14 bp sits on the 2% line but ties push the share to '+R.floor1(s.j.share).toFixed(1)+'%: does not fire',{share:s.j.share});
 const t='US 10-year Treasury yield: −14 bp in a day, to '+s.level.toFixed(2)+'%.\nAmong the lowest 2% of daily moves in the US 10-year yield since 3 Jan 1962: '+R.floor1(s.j.share).toFixed(1)+'% of 16,203 readings were this low or lower.\nData to 17 Nov 2026 (FRED, latest published).\nSource: FRED DGS10.';fail(t,7,'C7 a post claiming the 2% tail on that tie fails',s,fi);
 const f15=R.FX.tenY(inp,-15),s15=by(B(f15),'dgs10');ALL.push(B(f15));ok(s15.status==='rare'&&R.audit(s15.postText,s15,f15).ok&&/: 1\.9% of 16,203 readings were this low or lower/.test(s15.postText),'C7 -15 bp: computed share 1.9% is stated and it fires',s15.postText)}
fail(FS.postText.replace('19.2%','19.3%'),'R','R an edited figure fails the recompute');
{const D=JSON.parse(JSON.stringify(FX.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]*=1.01;fail(FS.postText,'R','R the series moved before posting: the old figures fail the recompute',FS,{...FX,derivs:D})}
fail(FS.postText.replace(R.SRC.oi,'Open interest across exchanges'),'S','S a source line other than the exact source name fails');
{const i2={...FX,stale:{oi7:'Data stale, 6h0m old, past 5h limit (OKX).'}},s=by(B(i2),'oi7');ok(s.status==='stale'&&!/stale/i.test(s.note),'F stale OI: status stale (badge), never in the note sentence',s.note);fail(FS.postText,'F','F stale data blocks the post',s,i2)}
fail(FS.postText+' 🚀','X','X emoji in a rare-signal post fails');

// ---------- wording
const notes=[],posts=[];for(const L of ALL)for(const s of L){notes.push([s.id,s.note]);if(s.postText)posts.push([s.id,s.postText])}
ok(notes.concat(posts).every(([,t])=>!/not rare/i.test(t)),'W no note or post ever says "not rare"');
ok(T.filter(s=>s.status==='normal').every(s=>/ · Within its normal range$/.test(s.note1)&&/^Source: /.test(s.note2)),'W no-signal notes read "Within its normal range"');
ok(posts.length>=5&&posts.every(([,t])=>!R.BANNED.some(re=>re.test(t))),'W no banned word in any generated post ('+posts.length+' posts)',posts.filter(([,t])=>R.BANNED.some(re=>re.test(t))));
ok(notes.every(([id,t])=>{const m=[...t.matchAll(/since (\d{1,2} [A-Z][a-z]{2} \d{4})/g)];return m.every(x=>Date.parse(x[1]+' UTC')>=Date.parse(R.EARLIEST[id]+'T00:00:00Z'))})&&posts.every(([id,t])=>[...t.matchAll(/since (\d{1,2} [A-Z][a-z]{2} \d{4})/g)].every(x=>Date.parse(x[1]+' UTC')>=Date.parse(R.EARLIEST[id]+'T00:00:00Z'))),'W every since-date is on or after the series window start');
{const E=R.EARLIEST;ok(E.oi7==='2024-01-01'&&E.etf_btc==='2024-01-11'&&E.etf_eth==='2024-07-23'&&E.dgs10==='1962-01-03'&&E.t10y2y==='1976-06-01'&&E.dollar==='2016-01-27'&&E.link==='2019-01-16','W earliest since-dates match the wording rules')}
ok(/Source: OKX BTC perpetual \(BTC-USDT-SWAP\) open interest, in BTC,/.test(by(T,'oi7').note)&&/Source: FRED broad dollar index \(DTWEXBGS\),/.test(by(T,'dollar').note)&&/Source: Farside Investors, complete days only,/.test(by(T,'etf_btc').note)&&/Source: FRED DGS10,/.test(by(T,'dgs10').note)&&/Source: FRED T10Y2Y,/.test(by(T,'t10y2y').note)&&/Source: Binance LINKUSDT daily closes,/.test(by(T,'link').note),'W exact source names on every note');
ok(notes.concat(posts).every(([,t])=>!/\bDXY\b|across exchanges|market-wide/i.test(t)),'W never "DXY", "across exchanges" or "market-wide"');
{const s=by(B({...inp,link:{...inp.link,src:'Coinbase'}}),'link');ok(/Source: Coinbase LINK-USD daily closes,/.test(s.note)&&!/Binance/.test(s.note),'W LINK note names Coinbase when the closes came from the Coinbase fallback',s.note)}
ok(/· snapshot \d{1,2} Nov \d\d:\d\d UTC$/.test(by(T,'oi7').note2),'W OI note gives the snapshot time in UTC (grey line 2)',by(T,'oi7').note2);
ok(T.filter(s=>s.j&&s.j.win).every(s=>s.j.win.method==='calendar'&&s.j.win.to-s.j.win.from===180*DAY),'W every 180-day window is 180 calendar days');
{const D=JSON.parse(JSON.stringify(inp.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=41000;const L=B({...inp,derivs:D}),s=by(L,'oilvl');ALL.push(L);ok(s.status==='rare'&&s.rarity==='Highest OKX BTC perpetual open interest in 180 days'&&/in 180 days/.test(s.postText)&&!/2%/.test(s.postText)&&R.audit(s.postText,s,{...inp,derivs:D}).ok,'W OI level uses only the 180-day form ("in 180 days", no percentile)',s.postText)}
{const fi=R.FX.oiDrop(inp,-26),s=by(B(fi),'oi7');ok(s.j.tail&&s.j.winExt==='low'&&s.j.form==='tail'&&/^Among the lowest 2%/.test(s.rarity),'W both conditions met: the tail form is used, not both')}
ok(posts.every(([,t])=>!/180 (trading days|sessions|observations|readings)/i.test(t))&&notes.every(([,t])=>!/180 trading days/i.test(t)),'W never "180 trading days"');
ok(notes.concat(posts).every(([,t])=>!/\u20b9|\bINR\b|\bIndia/i.test(t)),'W USD only: no INR or India');
ok(posts.every(([,t])=>!/what followed|last time/i.test(t))&&ALL.flat().every(s=>!s.facts||s.facts.every(f=>!/what followed|last time/i.test(f.join(' ')))),'W no "what followed" or "last time" anywhere');
ok(posts.every(([,t])=>R.xLen(t)<=280&&t.split('\n').length<=4),'W every post fits 280 characters and 3 lines + source');

// ---------- CNG review (19 Nov): '7-day' wording, exact OI post shape, card headline
ok(R.TPL.oi7.post(FS.f)==='$BTC perpetual open interest on OKX: −19.2% in the 7 days to 19 Nov (−7,172 BTC), to 30,183 BTC.'&&FS.srcLine==='Source: OKX BTC perpetual (BTC-USDT-SWAP) open interest, in BTC, snapshot 19 Nov 02:50 UTC.','N1 OI template: "in the 7 days to 19 Nov" (date only), snapshot time on the source line',{l1:R.TPL.oi7.post(FS.f),src:FS.srcLine});
ok(FS.postText==='$BTC perpetual open interest on OKX: −19.2% in the 7 days to 19 Nov (−7,172 BTC).\nAmong the lowest 2% of 7-day changes since 8 Jan 2024: 1.5% of 1,047 readings were this low or lower.\nSource: OKX BTC perpetual (BTC-USDT-SWAP) open interest, in BTC, snapshot 19 Nov 02:50 UTC.'&&FS.fit==='line 1 short form'&&R.xLen(FS.postText)<=280,'N1b full OI form is 290 characters, so the post uses the short line 1 (no level) and fits 280',{t:FS.postText,fit:FS.fit,len:R.xLen(FS.postText)});
ok(FS.head==='BTC open interest on OKX: −19.2% in 7 days'&&!/UTC|\d\d:\d\d/.test(FS.head),'N2 card headline has no timestamp',FS.head);
{const fi=R.FX.oiDrop(inp,-26),s=by(B(fi),'oi7');ok(!/weekly/i.test(s.note+s.postText)&&/7-day changes/.test(s.rarity),'N3 "7-day", never "weekly", in notes and posts')}
{/* synthetic OKX series (deterministic): a volatile first 420 days sets wide 2% tails, a calm last 180+ days; the newest 7-day change is a new 180-day low but inside the tail */
 let z=12345;const rnd=()=>{z=(z*1103515245+12345)%2147483648;return z/2147483648-0.5};const D=JSON.parse(JSON.stringify(inp.derivs)),O=D.assets.BTC.oi_daily,t0=O.points.at(-1)[0]-619*DAY;let c=30000;const P=[];
 for(let i=0;i<620;i++){c*=Math.exp((i<420?0.06:0.004)*rnd());P.push([t0+i*DAY,c*70000,c])}O.points=P;const n=P.length;let lo=Infinity;for(let i=n-180;i<n-1;i++)lo=Math.min(lo,P[i][2]/P[i-7][2]-1);
 P[n-1][2]=P[n-8][2]*(1+lo-0.01);const i2={...inp,derivs:D},s=by(B(i2),'oi7');
 ok(s.j.form==='window'&&s.rarity==='Lowest 7-day change in 180 days'&&R.audit(s.postText,s,i2).ok,'N4 180-day form reads "Lowest 7-day change in 180 days" and passes the audit',{form:s.j.form,r:s.rarity,p2:s.j.p2,cur:s.j.cur,post:s.postText,A:s.postText&&R.audit(s.postText,s,i2).checks.filter(c=>!c.pass)})}
ok(R.FORMS.some(re=>re.test('Highest 7-day change in 180 days'))&&!R.FORMS.some(re=>re.test('Among the lowest 2% of weekly changes since 1 Jan 2024 (1.5% of 1,047 readings at or below this)')),'N5 audit forms: new "7-day" tail and window forms allowed, the old parenthesised form is not');
ok(posts.every(([id,t])=>{const L=t.split('\n');return /^Source: /.test(L.at(-1))&&(id.startsWith('oi')?L.length===3&&/snapshot \d{1,2} [A-Z][a-z]{2} \d\d:\d\d UTC\.$/.test(L[2]):L.length===4&&/^Data to \d{1,2} [A-Z][a-z]{2}/.test(L[2]))}),'N6 every post: OI = 2 lines + source with snapshot; others 3 lines + source with a "Data to" line',posts.map(p=>p[1].split('\n').slice(2)));
ok(ALL.flat().filter(s=>s.postText).every(s=>s.head&&!/UTC|\d\d:\d\d/.test(s.head)),'N7 every rare card headline is free of timestamps');

// ---------- round 3 (supervisor + CNG + CRYPTO GOD, 19 Nov 13:07 IST)
const oiDay=t=>t+8*36e5,day0=t=>new Date(t).toISOString().slice(0,10);
// G: 'since' = first value of the measured (change/streak) series, generic for every series
{const L=T.filter(s=>s.j&&s.t&&s.t.length);const bad=L.filter(s=>day0(s.since)!==day0(s.id.startsWith('oi')?oiDay(s.t[0]):s.t[0]));ok(!bad.length,'G1 every series: since = first value of its measured series',bad.map(s=>[s.id,day0(s.since),day0(s.t[0])]))}
ok(day0(by(T,'oi7').since)==='2024-01-08'&&day0(by(T,'oilvl').since)==='2024-01-01','G2 OI 7-day change starts 8 Jan 2024 (the first change needs 7 days of OI); the OI level itself starts 1 Jan 2024');
ok(/since 8 Jan 2024:/.test(FS.postText)&&/since 8 Jan 2024/.test(FS.verdict)&&!/since 1 Jan 2024/.test(FS.postText),'G3 post and card say "since 8 Jan 2024"',{p:FS.postText,v:FS.verdict});
ok(day0(by(T,'dollar').since)==='2016-01-28'&&day0(by(T,'dgs10').since)==='1962-01-03'&&day0(by(T,'link').since)==='2019-02-15','G4 change series start one step after their raw rows (dollar 28 Jan 2016, 10Y 3 Jan 1962, LINK 15 Feb 2019)');
// P: thresholds at the reading's own precision
{const dec=x=>{const m=String(x).replace(/[^\d.]/g,'').split('.');return m[1]?m[1].length:0};const L=T.concat([FS]).filter(s=>s.thr);
 ok(FS.thr.lo==='−17.9%'&&by(T,'oi7').thr.lo==='−17.5%'&&by(T,'oi7').thr.hi==='+18.9%','P1 OI 2% line shown to one decimal: −17.5% today (not −18%), +18.9% at 98%',{t:by(T,'oi7').thr,fx:FS.thr});
 ok(L.every(s=>[s.thr.lo,s.thr.hi].filter(Boolean).every(x=>dec(x)===s.dp)&&dec(s.stats[0][1].replace(/[a-z ]+$/i,''))===s.dp),'P2 every threshold has the same decimals as its reading (dp per series)',L.map(s=>[s.id,s.dp,s.thr,s.stats[0][1]]));
 ok(L.every(s=>s.thr.kind!=='2%'||(s.thr.lo===s.fv(s.j.p2)&&s.thr.hi===s.fv(s.j.p98))),'P3 thresholds are the unrounded 2nd/98th percentiles rounded at that precision')}
// N: notes are two short lines; stale is in the badge only
ok(ALL.flat().every(s=>s.note.split('\n').length===2&&s.note1.length<=110&&s.note2.length<=200&&!/stale/i.test(s.note)),'N8 every note = bold line 1 (reading · verdict) + grey line 2 (source, window, data time); no stale text',ALL.flat().map(s=>[s.id,s.note1.length,s.note2.length]).filter(x=>x[1]>110||x[2]>200));
ok(by(T,'oi7').note1==='BTC OI −11.3% in 7 days · Within its normal range','N9 OI note line 1 reads "BTC OI −11.3% in 7 days · Within its normal range"',by(T,'oi7').note1);
// templates live in one place
ok(['oi7','oilvl','etf','dgs10','t10y2y','dollar','link'].every(k=>typeof R.TPL[k].post==='function'&&typeof R.TPL[k].head==='function'&&typeof R.TPL[k].short==='function'),'T0 every post, headline and note line comes from RARE.TPL');
// ETF / 10Y / dollar / LINK / OI level line 1 shapes (CNG)
{const fi=R.FX.etfPending(inp,'btc',14),s=by(B(fi),'etf_btc');const l1=s.postText.split('\n')[0];ok(/^US spot \$BTC ETFs: 14 straight days of net outflows, −\$[\d,]+\.\dM in total\.$/.test(l1)&&!/over the streak| M\b/.test(s.postText)&&R.audit(s.postText,s,fi).ok,'T1 ETF line 1: "US spot $BTC ETFs: 14 straight days of net outflows, −$X.XM in total." and the audit passes',{l1,a:R.audit(s.postText,s,fi).checks.filter(c=>!c.pass)})}
{const fi=R.FX.tenY(inp,-15),s=by(B(fi),'dgs10');ok(s.postText.split('\n')[0]===`US 10-year Treasury yield: −15 bp in one day, to ${s.level.toFixed(2)}%.`,'T2 10Y line 1: "−15 bp in one day, to 4.97%."',s.postText)}
{const fi=R.FX.dollar(inp),s=by(B(fi),'dollar');const L=s.postText.split('\n');ok(L[0]==='Broad US dollar index: −1.10% in one day, to 121.20.'&&L[2]==='Data to 13 Nov 2026 (FRED, latest published).','T3 dollar line 1 "−1.10% in one day, to 121.20." and the 13 Nov date on the Data line',L)}
{const C={...inp.link,src:'Coinbase'},t=C.t.slice(),v=C.v.slice();const now=inp.now;let n=t.length;while(n&&t[n-1]+DAY>now)n--;v[n-1]=v[n-31]*1.9;const i2={...inp,link:{t,v,src:'Coinbase'}},s=by(B(i2),'link');
 ok(s.status==='rare'&&/^\$LINK on Coinbase: \+90\.0% in 30 days, to \$[\d.]+\.$/.test(s.postText.split('\n')[0])&&/^Source: Coinbase LINK-USD daily closes\.$/.test(s.postText.split('\n').at(-1))&&R.audit(s.postText,s,i2).ok,'T4 LINK post unchanged and names Coinbase when the fallback is used',{st:s.status,p:s.postText})}
{const D=JSON.parse(JSON.stringify(inp.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=26100;const i2={...inp,derivs:D},s=by(B(i2),'oilvl');
 ok(s.status==='rare'&&s.postText.split('\n')[0]==='$BTC perpetual open interest on OKX: 26,100 BTC, below its previous 180-day low of 26,524 BTC.'&&/, snapshot 19 Nov 02:50 UTC\.$/.test(s.postText)&&R.audit(s.postText,s,i2).ok,'T5 OI level line 1: "26,100 BTC, below its previous 180-day low of 26,524 BTC." and the audit passes',{p:s.postText,a:s.postText&&R.audit(s.postText,s,i2).checks.filter(c=>!c.pass)})}
// 2s10s: CRYPTO GOD numbers ruling: judged on the daily change; a sign flip alone is not a signal
// 2s10s, both triggers (supervisor 13:59): (a) a −0.01 → +0.02 pp flip fires when there was no up-crossing in the previous 180 calendar days
{const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.T10Y2Y.points,n=P.length;P[n-2][1]=-0.01;P[n-1][1]=0.02;const i2={...inp,macro:M},s=by(B(i2),'t10y2y');
 ok(s.j.cur===3&&s.cross==='positive'&&s.j.form==='cross'&&s.status==='rare'&&s.rarity==='The 10Y–2Y spread turned positive, the first time since 6 Sep 2024'&&/^10Y–2Y Treasury spread: \+3 bp in one day, to \+0\.02 pp, turning positive\.$/.test(s.postText.split('\n')[0])&&R.audit(s.postText,s,i2).ok,'T6a 2s10s −0.01 → +0.02 pp with no up-crossing in 180 days fires (first since 6 Sep 2024) and passes the audit',{cur:s.j.cur,form:s.j.form,r:s.rarity,p:s.postText,a:s.postText&&R.audit(s.postText,s,i2).checks.filter(c=>!c.pass)})}
// (b) the same flip inside the real 4–6 Sep 2024 back-and-forth does not fire (up-crossings on 28 Aug and 4 Sep are inside 180 days)
{const M=JSON.parse(JSON.stringify(inp.macro)),S=M.series.T10Y2Y;S.points=S.points.filter(p=>p[0]<='2024-09-06');const P=S.points,n=P.length;S.last_date='2024-09-06';P[n-2][1]=-0.01;P[n-1][1]=0.02;const i2={...inp,now:Date.parse('2024-09-07T12:00:00Z'),macro:M},s=by(B(i2),'t10y2y');
 ok(P[n-1][0]==='2024-09-06'&&P[n-2][0]==='2024-09-05'&&s.cross==='positive'&&s.j.cur===3&&!s.j.fires&&s.status==='normal'&&!s.postText&&/Within its normal range/.test(s.note1),'T6b the same −0.01 → +0.02 flip on the real 4–6 Sep 2024 back-and-forth does not fire',{d:P.slice(-3),cross:s.cross,st:s.status,f:s.j.form})}
// (c) no 'since' date for 2s10s is ever earlier than 1 Jun 1976
{const cases=[];for(const [a,b] of [[-0.01,0.02],[0.30,-0.10],[-0.10,0.25]]){const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.T10Y2Y.points,n=P.length;P[n-2][1]=a;P[n-1][1]=b;const i2={...inp,macro:M},s=by(B(i2),'t10y2y');cases.push([s,i2])}
 {const M=JSON.parse(JSON.stringify(inp.macro)),S=M.series.T10Y2Y;S.points=S.points.filter(p=>p[0]<='1976-12-31');S.points.at(-2)[1]=-0.05;S.points.at(-1)[1]=0.05;const i2={...inp,now:Date.parse('1977-01-02T12:00:00Z'),macro:M};cases.push([by(B(i2),'t10y2y'),i2])}
 const first=Date.parse('1976-06-01T00:00:00Z'),dates=[];for(const [s] of cases.concat([[by(T,'t10y2y')]])){const txt=[s.note,s.postText||'',s.rarity,(s.facts||[]).map(f=>f.join(' ')).join(' ')].join(' ');for(const m of txt.matchAll(/(?:inverted )?since (?:records began on )?(\d{1,2} [A-Z][a-z]{2} \d{4})/g))dates.push(m[1]);for(const m of txt.matchAll(/(\d{1,2} [A-Z][a-z]{2} \d{4})\u2013/g))dates.push(m[1])}
 ok(dates.length>3&&dates.every(d=>Date.parse(d+' UTC')>=first)&&R.EARLIEST.t10y2y==='1976-06-01'&&cases.every(([s,i])=>!s.postText||R.audit(s.postText,s,i).checks.find(c=>c.k===3).pass),'T6c every 2s10s "since" date (notes, posts, details, crossing sentence) is on or after 1 Jun 1976',[...new Set(dates)])
 const fx=R.audit('10Y–2Y Treasury spread: +3 bp in one day, to +0.02 pp, turning positive.\nThe 10Y–2Y spread turned positive, the first time since 31 May 1976.\nData to 18 Nov 2026 (FRED, latest published).\nSource: FRED T10Y2Y.',cases[0][0],cases[0][1]);ok(!fx.ok&&!fx.checks.find(c=>c.k===3).pass,'T6d a 2s10s post claiming "since 31 May 1976" fails the audit (check 3)')}
{const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.T10Y2Y.points,n=P.length;P[n-1][1]=+(P[n-2][1]-0.40).toFixed(2);const i2={...inp,macro:M},s=by(B(i2),'t10y2y');const l1=s.postText&&s.postText.split('\n')[0];
 ok(s.status==='rare'&&l1===`10Y–2Y Treasury spread: −40 bp in one day, to ${(s.level<0?'−':'+')+Math.abs(s.level).toFixed(2)} pp${s.cross?', turning '+s.cross:''}.`&&/^Among the lowest 2% of daily moves in the 10Y–2Y spread since /.test(s.postText.split('\n')[1])&&R.audit(s.postText,s,i2).ok,'T7 2s10s −40 bp in one day fires on the 2% tail of its daily change, line 1 "±X bp in one day, to Y pp."',{p:s.postText,a:s.postText&&R.audit(s.postText,s,i2).checks.filter(c=>!c.pass)})}
{const M=JSON.parse(JSON.stringify(inp.macro)),P=M.series.T10Y2Y.points,n=P.length;P[n-2][1]=-0.10;P[n-1][1]=0.25;const i2={...inp,macro:M},s=by(B(i2),'t10y2y');
 ok(s.status==='rare'&&/, turning positive\.$/.test(s.postText.split('\n')[0])&&R.audit(s.postText,s,i2).ok,'T8 2s10s: a large move that also crosses zero mentions the turn only as context',s.postText)}
ok(T.concat([FS]).filter(s=>s.thr&&s.thr.kind==='2%').every(s=>{const r=s.facts.find(f=>f[0]==='2nd / 98th percentile');return r&&r[1]===s.thr.lo+' / '+s.thr.hi}),'P4 the details panel shows the same threshold text as the card');
ok(/, 8 Jan 2024–19 Nov 2026 · snapshot/.test(by(T,'oi7').note2)&&!/1 Jan 2024/.test(by(T,'oi7').note+FS.postText),'G5 OI note line 2 and the card footer give the window from 8 Jan 2024; no "1 Jan 2024" on the 7-day change',by(T,'oi7').note2);
console.log('FAILS: '+F);process.exit(F?1:0);
