// tfix.js — regression tests for QA batch 2 (C/N/E items). URL=... node tfix.js
const p=require('puppeteer-core');const fs=require('fs');const W=ms=>new Promise(r=>setTimeout(r,ms));
const URL=process.env.URL||'http://localhost:8765/index.html';const ROOT=process.env.ROOT||'/workspace/rp-terminal',DATA=ROOT+'/data';const HOST=new (require('url').URL)(URL).hostname;
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,500):''));if(!c)F.push(n)};
const ready=pg=>pg.waitForFunction(()=>{try{return SIG&&SIG.length&&MK&&MAC.items&&NX.etf}catch(e){return false}},{timeout:150000});
const block=(re,mode='abort')=>async q=>{await q.setRequestInterception(true);q.on('request',x=>{const h=new (require('url').URL)(x.url()).hostname;if(h!==HOST&&re.test(x.url())){mode===429?x.respond({status:429,contentType:'application/json',body:'{}'}):x.abort('failed')}else x.continue()})};
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const src=fs.readFileSync(new (require('url').URL)(URL).pathname.replace(/^\/(rp-terminal\/)?/,ROOT+'/'),'utf8');
// ---- static
ok(!/en-IN|\bINR\b|₹/.test(src),'no en-IN / INR / ₹ in source');ok(!/CoinGecko busy/.test(src),'no "(CoinGecko busy)" label');ok(fs.existsSync(ROOT+'/sw.js')&&/serviceWorker.*register\('sw\.js'\)/.test(src),'E5 sw.js exists and is registered');
async function page(ctx,setup){const pg=await (ctx||b).newPage();await pg.setViewport({width:412,height:915});pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));if(setup)await setup(pg);return pg}
// ---- A. normal load
{const pg=await page();await pg.goto(URL);await ready(pg);await pg.evaluate(()=>tab('today'));await W(4000);
 const r=await pg.evaluate(async()=>{await ensureCC();const o={};o.usdK=usdK(124658.54);o.usdK2=usdK(999.4);o.usdB=usdB(450000);
  o.rule1=RULE1.filter(w=>!lintBanned('Historically, this was a '+w+' for BTC.','').length);
  const wr=SIG.find(s=>s.id==='wrsi');o.wrsi=wr?.om?.cur;const st=SIG.find(s=>s.id==='stable');o.stable=SIGD.ST?.v.at(-1);o.st30=st30();
  o.fund=fundSt(-0.0011);const BF=btcFund();o.bf=BF?.src;const ms=marketStates();o.der=ms.find(x=>x.k==='Derivatives')?.why;o.rows=ms.map(x=>x.k+': '+x.why);
  const cl=(typeof clusters==='function'?clusters():[]);o.clF=JSON.stringify(cl).match(/\d\.\d{4}%\/8h · [^"]+/)?.[0];
  o.post=[todayItems().filter(postNow).length,(document.getElementById('postCnt')?.innerText||'')];
  o.hash=SIG.find(s=>s.id==='hash');o.hash=o.hash?o.hash.read:'';
  const dd=SIG.find(s=>s.id==='dd');o.dd=dd?.read;const eb=SIG.find(s=>s.id==='ethbtc');o.eb=eb?.why+' | '+eb?.read;
  const C=curveInfo(MAC.M);o.curve=[C.lastInv&&new Date(C.lastInv).toISOString().slice(0,10),C.lastInvEnd&&new Date(C.lastInvEnd).toISOString().slice(0,10),C.state];
  o.m2=m2YoyTxt(gm2(MAC.M));o.m2cap=(MAC.cards.find(c=>c.id==='btcm2')||{}).cap||'';o.m2f=(()=>{try{return macFacts(MAC.cards.find(c=>c.id==='btcm2')).chg}catch(e){return'ERR'}})();
  o.cvNote=(()=>{try{return macFacts(MAC.cards.find(c=>c.id==='curve')).note}catch(e){return'ERR '+e.message}})();
  o.cal=calSummary(NX.cal.items.filter(x=>Date.parse(x.date_utc)>Date.now()-3600e3).slice(8),Date.now());
  o.cc=D.cc.bitcoin;o.ath=athOf('bitcoin');let c30=null;const B=SIGD.CL.BTC;if(B){const N=B.v.length;c30=(B.v[N-1]/B.v[back(B,30)]-1)*100}o.c30=[ch30Of('bitcoin'),c30];
  o.th=threadSplit?threadSplit('A'.repeat(200)+'. '+'B'.repeat(200)+'. '+'C'.repeat(150)+'.\n\nhttps://example.com/x'):null;
  o.ins=Object.values(D.ins).flatMap(a=>a.pts).filter(t=>/odds of a pullback|relief bounce|big move often follows|squeeze|watch for a crossover/i.test(t));
  o.stale=(()=>{const keep=DF.derivs;DF.derivs={v:{updated:'2020-01-01T00:00:00Z'},at:Date.now()};const s=dataStale(),fl=freshLine();DF.derivs=keep;return[s,fl.includes('stale data files')]})();
  o.fresh=freshLine();return o});
 ok(r.usdK==='$124.7k'&&r.usdB==='$450.0k','rounding: usdK(124,658.54) = $124.7k; small $ never $0M',[r.usdK,r.usdB]);
 ok(!r.rule1.length,'C4 RULE1 phrases flagged even after "Historically"',r.rule1);
 ok(Math.abs(r.wrsi-61.6)<0.6,'weekly RSI from completed Sunday closes ≈61.6',r.wrsi);
 ok(Math.abs(r.stable/1e9-311.2)<1.5,'stablecoins last completed day ≈$311.2B',r.stable);
 ok(r.fund==='Funding neutral','C7 funding -0.0011% is "Funding neutral"',r.fund);
 ok(/derivs\.json/.test(r.bf||'')&&(r.der||'').includes(r.bf),'funding: one source (derivs.json, labelled) on Today chip',[r.bf,r.der]);
 ok(!r.clF||/derivs\.json/.test(r.clF),'funding: clusters use the same labelled source',r.clF);
 ok(r.post[1].includes(String(r.post[0]))||r.post[0]===0,'POST NOW count line matches postNow() count',r.post);
 ok(/7-day avg/.test(r.hash),"hashrate chart labelled '7-day avg'");
 ok(/^\d+\.\d% below the daily-close ATH of \$124,659/.test(r.dd||''),'E11 drawdown read has no double negative',r.dd);
 ok(/((bottom|top) \d+% of readings|around the middle of its range) since \w+ 2017/.test(r.eb)&&!/of the last 5 years/.test(r.eb),'ETH/BTC read names its real window',r.eb);
 ok(r.curve[0]==='2022-07-06'&&r.curve[1]==='2024-08-26'&&r.curve[2]===1,'N4 curve: last ≥5-day inversion 6 Jul 2022 – 26 Aug 2024',r.curve);
 ok(/The last inversion ran from 6 Jul 2022 to 26 Aug 2024 \(runs under 5 trading days ignored\)/.test(r.cvNote),'N4 curve note text',r.cvNote);
 ok(/^growth at constant FX is [+-]\d+\.\d% a year, the (lowest|highest) (since [A-Z][a-z]{2} \d{4}|in the data \(since \d{4}\)) \([+-]\d+\.\d% in USD\)$/.test(r.m2)&&r.m2cap.includes(r.m2)&&r.m2f===r.m2,'N11 M2 YoY rarity caption (card + facts)',[r.m2,r.m2f]);
 {const cal=JSON.parse(fs.readFileSync(DATA+'/calendar.json'));const now=Date.now(),cy=new Date(now).getUTCFullYear();const rest=cal.items.filter(x=>Date.parse(x.date_utc)>now-3600e3).sort((a,b)=>Date.parse(a.date_utc)-Date.parse(b.date_utc)).slice(8);
  const nF=rest.filter(x=>x.type==='fomc_decision'&&new Date(x.date_utc).getUTCFullYear()===cy+1).length;
  ok(!rest.length||(new RegExp(`${cy+1}: .*${nF} FOMC meetings.*\\(times tentative\\)`).test(r.cal)),'N20 calendar footer generated from data (plural, tentative)',[nF,r.cal])}
 ok(r.cc&&Math.abs(r.c30[0]-r.c30[1])<1e-6,'E1 30d = Binance completed closes (same basis as Today)',r.c30);
 ok(r.ath&&Math.abs(r.ath.ath-124658.54)<0.01&&/daily close \$124\.7k/.test(r.ath.lbl),"E1/extra 'From ATH' uses Binance daily-close ATH $124,658.54 and labels it",r.ath);
 ok(r.th&&r.th.every(x=>x.length<=280)&&/https:\/\/example\.com/.test(r.th.at(-1))&&/^1\//.test(r.th[0]),'N14 thread split ≤280, source on last post',r.th);
 ok(!r.ins.length,'insight points have no forecast phrases',r.ins);
 ok(r.stale[0].filter(x=>/^derivs\.json/.test(x)).length===1&&r.stale[1],'E8 stale data file warning shown when over its age limit',r.stale);
 ok(/BTC history age \d/.test(r.fresh),"E2 'BTC history age' label",r.fresh);
 // C9 macro tiles "as of"
 const tiles=await pg.evaluate(async()=>{tab('macro');await new Promise(r=>setTimeout(r,2500));return[...document.querySelectorAll('#s-macro .stat, #s-macro .tile')].map(e=>e.innerText).filter(t=>t.trim())});
 ok(tiles.length>3&&tiles.filter(t=>/as of|week of/.test(t)).length>=tiles.length-1,'C9 "as of" on macro tiles',tiles.slice(0,6));
 // scans: RULE1 phrases in DOM + captions
 const sc=await pg.evaluate(async()=>{const out=[];for(const t of ['today','signals','macro','markets','studio']){tab(t);await new Promise(r=>setTimeout(r,900));const tx=document.body.innerText;RULE1.forEach(w=>{if(new RegExp('\\b'+w+'\\b','i').test(tx.replace(/"[^"]*"/g,'')))out.push(t+':'+w)})}return out});
 ok(!sc.length,'no RULE1 phrase anywhere in rendered tabs',sc);
 // lean words: no Bullish/Bearish/Supportive/Headwind/Risk-on… on any chip, badge, force, cluster or caption (news headlines from feeds excluded)
 const lean=await pg.evaluate(async()=>{const LEAN=/\b(bullish|bearish|supportive|headwinds?|tailwinds?|risk[- ]on|risk[- ]off|favou?rable|unfavou?rable|lean (bull|bear)\w*)\b/ig,out=[];const strip=t=>{(D.news||[]).forEach(n=>{[n.title,n.desc].forEach(x=>{if(x)t=t.split(x).join(' ')})});return t};
   for(const t of ['today','markets','chart','signals','macro','news','studio']){tab(t);await new Promise(r=>setTimeout(r,1200));document.querySelectorAll('.rule,[data-tgx]').forEach(e=>e.classList.add('on'));const m=strip(document.body.innerText).match(LEAN);if(m)out.push(t+': '+[...new Set(m)].join(','))}
   const chips=marketStates().map(x=>x.k+': '+x.st);const caps=[];for(const c of [...SIG.map(s=>({kind:'sig',id:s.id})),...MAC.cards.map(c=>({kind:'mac',id:c.id})),{kind:'studio',t:'insight',coin:stCoin()},{kind:'studio',t:'price',coin:stCoin()}]){try{const F=capFacts(c);for(const[st]of STY)CAPT[F.fam][st].forEach(f=>{const x=tidy(f(F));if(LEAN.test(x))caps.push(c.kind+':'+(c.id||c.t)+':'+x.slice(0,60));LEAN.lastIndex=0})}catch(e){}}
   return{out,chips,caps,lint:['Funding is supportive here','A headwind for BTC','Risk-on tape','Bullish setup'].filter(x=>!lintBanned(x,'').length),badges:[...document.querySelectorAll('.bias')].map(b=>b.textContent).filter(Boolean)}});
 ok(!lean.out.length&&!lean.caps.length,'no lean words (Bullish/Bearish/Supportive/Headwind/Risk-on…) in any rendered tab or caption',lean);
 ok(!lean.lint.length,'lint flags lean words',lean.lint);
 ok(lean.chips.filter(c=>!/No data/.test(c)).every(c=>/(Above|Below) 200DMA, [+-]\d|ETH\/BTC (up|down|flat), [+-]\d|Real yield (rising|falling), [+−]\d+bp|Funding (positive|negative|neutral), −?\d|ETF flows (positive|negative), [+-]|Stablecoins (rising|falling), [+-]/.test(c)),'Today chips name metric, direction and figure',lean.chips);
 // E9/E10 export drawing: labels inside frame, vol axis ≥0, altseason axis 0–100
 {const vf=await require('./volfix.js')(pg);console.log('vol cards:',vf.live?'live':'no live vol extreme today, built from flattened-closes fixture',vf.ids.join(','))}
 const ex=await pg.evaluate(()=>{const spy=(s)=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const x=c.getContext('2d'),T=[];const f=x.fillText.bind(x);x.fillText=(t,a,b2,...r)=>{T.push([String(t),a,x.measureText(String(t)).width,x.textAlign]);return f(t,a,b2,...r)};drawSig(x,1920,1080,s);return T};
  const rv=SIG.find(s=>s.id==='rv7ETH')||SIG.find(s=>/^rv/.test(s.id));const T=spy(rv),miss=spy(undefined),mk=T.find(t=>/^(LOW|HIGH)$/.test(t[0]));const neg=T.filter(t=>/^-\d+%$/.test(t[0])).map(t=>t[0]);
  renderAlt();const A=spy(ALTOBJ),ax=A.filter(t=>/^-?\d+%$/.test(t[0])).map(t=>parseFloat(t[0]));return{id:rv&&rv.id,mk,right:mk?(mk[3]==='right'?mk[1]:mk[1]+mk[2]):null,neg,ax,miss:miss.map(t=>t[0])}});
 ok(ex.miss.length===1&&ex.miss[0]==='—','E9 missing signal draws "—", no crash',ex.miss);
 ok(ex.mk&&ex.right<=1920-40,'E9 rv7 LOW/HIGH marker label inside the right edge',ex);ok(!ex.neg.length,'E9 volatility y-axis never below 0',ex.neg);ok(ex.ax.length&&ex.ax.every(v=>v>=0&&v<=100),'E10 altseason y-axis within 0–100%',ex.ax);
 ok(!pg.errs.length,'no page errors (normal load)',pg.errs);await pg.close()}
// ---- B. CoinGecko 429
{const ctx=await b.createBrowserContext();const pg=await page(ctx,block(/coingecko/,429));await pg.goto(URL);await pg.waitForFunction(()=>D.cc&&D.cc.bitcoin&&D.mk.bitcoin,{timeout:90000});await W(1500);
 const r=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d'),T=[];const f=x.fillText.bind(x);x.fillText=(t,...a)=>{T.push(String(t));return f(t,...a)};drawCard(x,1600,900,'price',S.watch.find(w=>w.id==='bitcoin'));
  const i=T.indexOf('30d');tab('today');await new Promise(r=>setTimeout(r,1500));const s=await coinSearch('sol');return{v30:T[i+1]||T[T.indexOf('30d',i+1)+1],T,want:pct(ch30Of('bitcoin')),fl:freshLine(),s,sn:!!document.getElementById('sNote'),mk30:D.mk.bitcoin.price_change_percentage_30d_in_currency}});
 ok(r.T.includes(r.want)&&r.want!=='–'&&!r.T.includes('+0.00%'),'E1 price card 30d from Binance closes when CoinGecko 429s (no +0.00%)',{want:r.want,T:r.T.slice(0,30)});
 ok(r.mk30==null,'E1 CoinPaprika 30d never stored as real',r.mk30);
 ok(/fallback in use: .*\(primary CoinGecko failed\)/.test(r.fl)&&!/Sources OK/.test(r.fl)&&/CoinGecko ✗/.test(r.fl),'E2 data health names fallback + failed primary, never Sources OK',r.fl);
 ok(r.s==='local'&&r.sn,'E4 search falls back to the local coin list with a visible note (CoinPaprika search is paid-only, HTTP 402)',r.s);await ctx.close()}
// ---- C. CoinGecko + CoinPaprika down, market.json backup / all down
{const ctx=await b.createBrowserContext();const pg=await page(ctx,block(/coingecko|coinpaprika/));await pg.goto(URL);await pg.waitForFunction(()=>document.getElementById('gUpd').textContent.length>3||document.getElementById('globNA'),{timeout:60000});
 const r=await pg.evaluate(async()=>({g:document.getElementById('global').innerText,u:document.getElementById('gUpd').textContent,s:await coinSearch('sol'),err:document.getElementById('sErr')?.innerText}));
 ok(/market\.json/.test(r.u)&&/Total market cap/.test(r.g),'E3 global card filled from market.json when CoinGecko+CoinPaprika fail',r);ok(r.s==='local'||r.s==='err','E4 search answers from the local list when CoinGecko is down',r.s);await ctx.close()}
{const ctx=await b.createBrowserContext();const pg=await page(ctx,async q=>{await q.setRequestInterception(true);q.on('request',x=>{const u=x.url(),h=new (require('url').URL)(u).hostname;(h!==HOST&&/coingecko|coinpaprika/.test(u))||/market\.json/.test(u)?x.abort('failed'):x.continue()})});
 await pg.goto(URL);await pg.waitForFunction(()=>document.getElementById('globNA'),{timeout:60000}).catch(()=>{});const g=await pg.evaluate(()=>document.getElementById('global').innerText);ok(/Unavailable — source down/.test(g),"E3 'Unavailable — source down' when every backup fails",g);const se=await pg.evaluate(async()=>{MK=null;D.top=[];const k=await coinSearch('sol');return{k,err:document.getElementById('sErr')?.innerText}});ok(se.k==='err'&&/Search unavailable/.test(se.err||''),'E4 visible search error when no source and no local list',se);await ctx.close()}
// ---- D. Binance + blockchain.com + Coinbase blocked: no infinite loading, POST NOW suppressed
{const ctx=await b.createBrowserContext();const pg=await page(ctx,block(/binance|blockchain\.info|coinbase/));await pg.goto(URL);await pg.evaluate(()=>tab('today'));
 await pg.waitForFunction(()=>SIGD&&SIG,{timeout:90000});await W(2000);const r=await pg.evaluate(()=>({rows:marketStates().map(x=>x.k+': '+x.why),post:todayItems().filter(postNow).map(x=>x.kind+':'+x.id),tk:document.getElementById('tkIn').innerText.slice(0,80)}));
 ok(!r.rows.some(x=>/Loading/.test(x))&&r.rows.some(x=>/^ETH: Price history unavailable/.test(x)),'E7 BTC/ETH rows show unavailable instead of loading',r.rows);ok(!r.post.some(x=>/^sig:/.test(x)),'E7 POST NOW suppressed for signals without inputs',r.post);ok(!/Loading markets/.test(r.tk),'E7 ticker not stuck loading',r.tk);await ctx.close()}
{const ctx=await b.createBrowserContext();const pg=await page(ctx,block(/binance|blockchain\.info/));await pg.goto(URL);await pg.evaluate(()=>tab('today'));
 await pg.waitForFunction(()=>SIGD&&SIG,{timeout:120000});await W(1500);const r=await pg.evaluate(()=>({btc:marketStates()[0].why,fl:freshLine(),post:todayItems().filter(postNow).filter(x=>x.kind==='sig'&&x.fbIn).length}));
 ok(/Coinbase/.test(r.fl)&&/primary (Binance spot|blockchain\.com) failed/.test(r.fl),'E7 Coinbase fallback for daily closes, reported in data health',r);ok(r.post===0,'E7 POST NOW suppressed on short fallback history',r);await ctx.close()}
// ---- E. all third-party blocked (fresh profile): ticker message; then saved copy restored
{const ctx=await b.createBrowserContext();const pg=await page(ctx);await pg.goto(URL);await pg.waitForFunction(()=>localStorage.rp_last,{timeout:60000});
 const q=await page(ctx,block(/./));await q.goto(URL);await W(9000);const r=await q.evaluate(()=>({tk:document.getElementById('tkIn').innerText.slice(0,90),ban:document.getElementById('offBan').innerText,fl:freshLine()}));
 ok(/\$/.test(r.tk)&&/data as of \d\d:\d\d UTC/.test(r.ban)&&/last saved prices/.test(r.fl),'E5 saved copy restored with "data as of HH:MM UTC" banner when every API fails',r);await ctx.close()}
{const ctx=await b.createBrowserContext();const q=await page(ctx,block(/./));await q.goto(URL);await W(9000);const tk=await q.evaluate(()=>document.getElementById('tkIn').innerText);ok(/Prices unavailable/.test(tk),'E7 ticker says unavailable with no data and no saved copy',tk);await ctx.close()}
// ---- F. service worker: offline reload shows last state
{const ctx=await b.createBrowserContext();const pg=await page(ctx);const u=URL+(URL.includes('?')?'&':'?')+'sw=1';await pg.goto(u);await ready(pg);
 await pg.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller||(location.reload(),false),{timeout:30000,polling:4000}).catch(()=>{});await pg.reload();await ready(pg).catch(()=>{});await W(2000);
 const swT=await b.waitForTarget(t=>t.type()==='service_worker'&&t.browserContext()===ctx,{timeout:15000}).catch(()=>null);let cs=null;if(swT){cs=await swT.createCDPSession();await cs.send('Network.enable');await cs.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})}
 await pg.setRequestInterception(true);pg.on('request',x=>{if(pg.__off&&new (require('url').URL)(x.url()).hostname!==HOST)x.abort('internetdisconnected');else x.continue()});pg.__off=1;
 await pg.setOfflineMode(true);let r;try{await pg.reload({waitUntil:'domcontentloaded',timeout:30000});await W(6000);r=await pg.evaluate(()=>({t:document.title,ban:document.getElementById('offBan')?.innerText,tk:document.getElementById('tkIn')?.innerText.slice(0,60)}))}catch(e){r={err:e.message}}
 ok(r.ban&&/^Offline · data as of \d\d:\d\d UTC/.test(r.ban)&&/\$/.test(r.tk||''),'E5 offline reload (service worker) shows last state + Offline banner',r);
 // ---- G. offline in-app refresh
 pg.__off=0;if(cs)await cs.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await pg.setOfflineMode(false);await pg.reload();await ready(pg);await pg.evaluate(()=>tab('today'));await W(2000);await pg.setOfflineMode(true);await pg.evaluate(()=>{dispatchEvent(new Event('offline'));document.getElementById('refBtn').click()});await W(15000);
 const g=await pg.evaluate(()=>({ban:document.getElementById('offBan').innerText,rows:marketStates().map(x=>x.k+': '+x.why)}));
 ok(/^(Offline|Live sources unreachable) · data as of \d\d:\d\d UTC/.test(g.ban)&&!g.rows.some(x=>/Loading price history/.test(x)),'E6 offline in-app refresh: banner, ETH row not stuck loading',g);await pg.setOfflineMode(false);await ctx.close()}
console.log('\nFAILS:',F.length,JSON.stringify(F));await b.close();process.exit(0)})();
