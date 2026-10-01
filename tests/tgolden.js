// tgolden.js — known-answer tests against the frozen 30 Sep 2026 snapshot (/workspace/rpt/fixtures/data-golden.json).
// The page runs with a mocked clock (1 Oct 2026 12:00 UTC), data/*.json served from the frozen dir, Binance BTC/ETH daily klines
// served from frozen binance_daily.json plus an OPEN 1 Oct candle at a fake price (must be ignored), every other API blocked.
// Usage: URL=... GOLD=/path/to/fixtures node tgolden.js
const p=require('puppeteer-core');const fs=require('fs'),path=require('path');
const URL=process.env.URL||'http://localhost:8765/index.html';const FX=process.env.GOLD||'/workspace/rpt/fixtures';
const G=JSON.parse(fs.readFileSync(FX+'/data-golden.json'));const FR=path.join(FX,G.frozen_dir);const BD=JSON.parse(fs.readFileSync(FR+'/binance_daily.json'));
const NOW=Date.parse('2026-10-01T12:00:00Z'),OPEN={BTCUSDT:99999,ETHUSDT:4999};const HOST=new (require('url').URL)(URL).hostname;
const kl=(sym,end,lim)=>{const rows=BD[sym].map(([d,c])=>[Date.parse(d+'T00:00:00Z'),c]);rows.push([Date.parse('2026-10-01T00:00:00Z'),OPEN[sym]]);return rows.filter(r=>r[0]<=end).slice(-lim).map(([t,c])=>[t,String(c),String(c),String(c),String(c),'0',t+86399999,'0',0,'0','0','0'])};
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' :: '+JSON.stringify(x).slice(0,300):''));if(!c)F.push(n)};
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const ctx=await b.createBrowserContext();const pg=await ctx.newPage();
await pg.evaluateOnNewDocument(NOW=>{const off=NOW-Date.now(),_D=Date;class FD extends _D{constructor(...a){a.length?super(...a):super(_D.now()+off)}static now(){return _D.now()+off}}FD.UTC=_D.UTC;FD.parse=_D.parse;window.Date=FD},NOW);
await pg.setRequestInterception(true);
pg.on('request',x=>{const u=new (require('url').URL)(x.url());const m=u.pathname.match(/\/data\/(\w+)\.json$/);
  if(m&&fs.existsSync(`${FR}/${m[1]}.json`))return x.respond({status:200,contentType:'application/json',body:fs.readFileSync(`${FR}/${m[1]}.json`)});
  if(u.hostname===HOST)return x.continue();
  if(/binance/.test(u.hostname)&&/klines/.test(u.pathname)&&u.searchParams.get('interval')==='1d'&&BD[u.searchParams.get('symbol')])return x.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify(kl(u.searchParams.get('symbol'),+(u.searchParams.get('endTime')||NOW),+(u.searchParams.get('limit')||1000)))});
  return x.abort('failed')});
pg.on("pageerror",e=>console.log("PAGEERR",e.message));pg.on("console",m=>{if(/warn|error/.test(m.type())&&!/Failed to load/.test(m.text()))console.log("CONSOLE",m.text().slice(0,300))});await pg.goto(URL);await pg.waitForFunction(()=>{try{return SIG&&SIG.length&&MK&&MAC.M&&MAC.cards.length}catch(e){return false}},{timeout:150000}).catch(()=>{});
await pg.evaluate(()=>{tab("macro")});await new Promise(r=>setTimeout(r,4000));
const r=await pg.evaluate(async()=>{await ensureCC();const S_=id=>SIG.find(s=>s.id===id);const o={};const c=D.cc.bitcoin;o.ath=c?.ath;o.athD=c&&new Date(c.athT).toISOString().slice(0,10);o.athDisp=c&&usdK(c.ath);o.ch30=ch30Of('bitcoin');
  o.close=SIGD.CL.BTC.v.at(-1);o.dd=S_('dd')?.m;o.ddRead=S_('dd')?.read;o.ddF=ddFacts('BTC');o.ddF=o.ddF&&JSON.stringify(o.ddF).match(/-?\d+\.\d%/g);o.mayer=S_('mayer')?.m;o.y2=S_('2y')?.m;o.wrsi=S_('wrsi')?.m;
  o.st=SIGD.ST?.v.at(-1);o.st30=st30();o.eb=S_('ethbtc')?.m;o.ebRead=S_('ethbtc')?.read;o.ebShare=S_('ethbtc')?.om?.share;
  const L=id=>{const s=ser(id,MAC.M);return s?s.v.at(-1):null};o.dfii=L('DFII10');o.dgs10=L('DGS10');o.dgs2=L('DGS2');o.t10=L('T10Y2Y');const C=curveInfo(MAC.M);o.inv=[C.lastInv,C.lastInvEnd].map(x=>x&&new Date(x).toISOString().slice(0,10));
  const g=gm2(MAC.M);o.m2=[g?.yoy,g?.yoyCC];o.nl=(()=>{const c=MAC.cards.find(c=>c.id==='netliq')||{};return [c.read,c.cap,c.note].join(' | ')})();try{o.perf=JSON.stringify(perfFacts('BTC'))}catch(e){o.perf=''}
  const cl=clusters();o.clDD=JSON.stringify(cl).match(/-?\d+\.\d%[^"]{0,30}(ATH|high)/i)?.[0];return o});
const V=Object.fromEntries(G.values.map(v=>[v.id,v]));const near=(a,id,k=1)=>a!=null&&Math.abs(a*k-V[id].expected)<=Math.max(V[id].tol,1e-9)+1e-9;
ok(near(r.ath,'btc_ath_close')&&r.athD===V.btc_ath_close.date,'ATH daily close 124,658.54 on 6 Oct 2025',[r.ath,r.athD]);ok(r.athDisp===V.btc_ath_close.display,"ATH displays '$124.7k'",r.athDisp);
ok(near(r.close,'btc_close'),'BTC completed close 30 Sep (open 1 Oct candle ignored)',r.close);
ok(Math.abs(r.dd-V.btc_drawdown_pct.expected)<=0.05+1e-9&&/^32\.9% below/.test(r.ddRead||''),'drawdown −32.9% on completed close (Signals)',[r.dd,r.ddRead]);ok((r.ddF||[]).includes('-32.9%')||(r.ddF||[]).includes('32.9%'),'drawdown −32.9% (Studio dd facts)',r.ddF);
ok(Math.abs(r.ch30-V.btc_30d_change_pct.expected)<=0.05,'BTC 30d +6.4% on completed closes (E1)',r.ch30);
ok(near(r.y2,'btc_2y_ma_ratio'),'2-year MA ratio 0.94×',r.y2);ok(near(r.mayer,'btc_mayer_multiple'),'Mayer 1.17',r.mayer);ok(near(r.wrsi,'btc_weekly_rsi14'),'weekly RSI 61.6 (Sun 27 Sep)',r.wrsi);
ok(near(r.st,'stablecoins_usd_bn',1e-9),'stablecoins $311.2B',r.st);ok(near(r.st30,'stablecoins_30d_pct'),'stablecoins +1.26% 30d',r.st30);
ok(near(r.eb,'ethbtc_close'),'ETH/BTC close 0.03212',r.eb);ok(Math.abs(r.ebShare-32.9)<=0.5&&/bottom 33% of readings since \w+ 2017/.test(r.ebRead||''),"ETH/BTC one window: 'bottom 33% since 2017'",[r.ebShare,r.ebRead]);
ok(near(r.dfii,'real_yield_10y')&&near(r.dgs10,'ust_10y')&&near(r.dgs2,'ust_2y')&&near(r.t10,'t10y2y'),'macro levels (DFII10, DGS10, DGS2, T10Y2Y)',[r.dfii,r.dgs10,r.dgs2,r.t10]);
ok(r.inv[0]===V.t10y2y_last_inversion.expected.start&&r.inv[1]===V.t10y2y_last_inversion.expected.end,'2s10s last inversion 6 Jul 2022 – 26 Aug 2024',r.inv);
ok(near(r.m2[0],'global_m2_yoy_usd_pct')&&near(r.m2[1],'global_m2_yoy_cc_pct'),'global M2 YoY 8.6% USD / 6.0% constant FX',r.m2);
ok(/\$5,?747(\.\d)?B/.test(r.nl),'net liquidity $5,747B',r.nl.slice(0,200));ok(/42\.6/.test(r.perf),'Q3 return +42.6%',r.perf.slice(0,200));
ok(!r.clDD||/32\.9%/.test(r.clDD),'clusters drawdown matches −32.9%',r.clDD);
console.log('\nGOLDEN FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})();
