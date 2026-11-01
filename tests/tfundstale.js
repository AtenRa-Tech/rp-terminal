// tfundstale.js (1 Nov P1): funding past its 12h limit (DVLIM.funding = FRESHNESS.signal_cards.funding_h) is never shown or scored as current.
// Self-contained: base = frozen fixture derivs.json (tests/fixtures/frozen/data), BTC/ETH funding replaced by tests/fixtures/funding-stale/funding.json
// with times rebuilt from the frozen T0; live funding endpoints answered by the test. Marker rates (0.0137/0.0173 derivs, 0.0191/0.0197 live)
// must not appear anywhere on the page or in Today/setup/insight text when stale. Cases: STALE (32d old file + 32d old live print), STALE_NOLIVE
// (32d old file, live funding down), FRESH (file within 8h, live print 3h old): fresh still renders normally.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,900):''));if(!c)F.push(n)};
const FX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/funding-stale/funding.json'),'utf8'));
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/frozen/data/derivs.json'),'utf8'));
const T0=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/frozen/meta.json'),'utf8')).T0,H=36e5,DAY=864e5;
function derivs(newest){const x=JSON.parse(JSON.stringify(BASE));for(const a of ['BTC','ETH']){const r=FX.rates[a],n=r.length,pts=r.map((v,i)=>[newest-(n-1-i)*8*H,v]);
  x.assets[a].funding.points=pts;x.assets[a].latest.funding=pts.at(-1)[1];x.assets[a].latest.funding_t=pts.at(-1)[0]}return JSON.stringify(x)}
const MK=['0.0137','0.0173','0.0191','0.0197'];
async function run(name,fileT,liveT){const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const pg=await b.newPage();await pg.setViewport({width:1280,height:900});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.setRequestInterception(true);const body=derivs(fileT);
 pg.on('request',q=>{const u=q.url();
  if(/\/data\/derivs\.json/.test(u))return q.respond({status:200,contentType:'application/json',body});
  const m=u.match(/okx\.com\/api\/v5\/public\/funding-rate-history\?instId=(\w+)-USDT/);
  if(m){const r=FX.live_marker[m[1]];if(liveT==null||r==null)return q.abort('failed');return q.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({code:'0',data:[{instId:m[1]+'-USDT-SWAP',fundingRate:String(r),realizedRate:String(r),fundingTime:String(liveT)}]})})}
  if(/fapi\.binance\.com\/fapi\/v1\/fundingRate/.test(u))return q.abort('failed');
  return q.continue()});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return SIG&&SIG.length>3&&DVRAW&&D.ins&&D.ins.bitcoin&&typeof marketStates==='function'}catch(e){return false}},{timeout:150000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,3000));
 const r=await pg.evaluate(()=>{const c=id=>{const s=SIGSTALE.find(x=>x.id===id),g=(SIG||[]).find(x=>x.id===id);return{stale:s?{read:s.read,score:s.score,used:s.usedDate}:null,live:g?{read:g.read,score:g.score}:null,today:todayItems().some(x=>x.id===id)}};
  const ms=marketStates().find(x=>x.k==='Derivatives'),cl=clusters().flatMap(x=>x.in||[]).filter(x=>/unding/.test(x.l)),ins=D.ins.bitcoin,eth=D.ins.ethereum;
  document.querySelectorAll('details').forEach(d=>d.open=true);
  return{BTC:c('fundBTC'),ETH:c('fundETH'),ms:ms&&{st:ms.st,why:ms.why,stale:ms.stale},cl,dvBTC:ins?.dv?{f:ins.dv.f,ft:ins.dv.ft}:null,dvETH:eth?.dv?{f:eth.dv.f,ft:eth.dv.ft}:null,pts:(ins?.pts||[]).filter(x=>/unding/.test(x)),
   insCard:[...document.querySelectorAll('#ins .stat')].filter(e=>/Funding/.test(e.textContent)).map(e=>e.textContent),bf:btcFund(),text:document.body.innerText}});
 await b.close();return{name,...r,errs}}
(async()=>{
 const S=await run('STALE',T0-32*DAY,T0-32*DAY),N=await run('STALE_NOLIVE',T0-32*DAY,null),R=await run('FRESH',Math.floor(T0/(8*H))*8*H,T0-3*H);
 const show=x=>({BTC:x.BTC,ETH:x.ETH,ms:x.ms,cl:x.cl,dv:[x.dvBTC,x.dvETH],pts:x.pts,insCard:x.insCard,bf:x.bf,errs:x.errs});
 for(const x of [S,N]){console.log('['+x.name+'] '+JSON.stringify(show(x)).slice(0,1500));
  for(const a of ['BTC','ETH'])ok(x[a].stale&&x[a].stale.read==='—'&&x[a].stale.score==null&&!x[a].live&&!x[a].today&&x[a].stale.used===new Date(T0-32*DAY).toISOString().slice(0,10),x.name+'_'+a+'_card_stale_dash_with_real_date',x[a]);
  const hits=MK.filter(m=>x.text.includes(m));ok(!hits.length,x.name+'_no_stale_rate_anywhere_on_page',hits);
  ok(x.ms&&!/\d\.\d{4}%/.test(x.ms.st)&&!MK.some(m=>(x.ms.why||'').includes(m)),x.name+'_today_derivatives_no_reading',x.ms);
  ok(!x.cl.some(i=>i.ok!=null)&&!x.cl.some(i=>MK.some(m=>String(i.v).includes(m))),x.name+'_setup_funding_gives_no_reading',x.cl);
  ok(x.bf==null,x.name+'_btcFund_null',x.bf);
  ok((!x.dvBTC||x.dvBTC.f==null)&&(!x.dvETH||x.dvETH.f==null)&&!x.pts.length,x.name+'_insight_live_funding_dropped',{dv:[x.dvBTC,x.dvETH],pts:x.pts});
  ok(x.insCard.every(t=>!/OI\s*\d\.\d{3}%/.test(t)),x.name+'_insight_card_funding_dash',x.insCard);
  ok(!x.errs.length,x.name+'_no_page_errors',x.errs)}
 console.log('[FRESH] '+JSON.stringify(show(R)).slice(0,1500));
 for(const a of ['BTC','ETH'])ok(R[a].live&&R[a].live.read.includes(a==='BTC'?'0.0137':'0.0173')&&!R[a].stale,'FRESH_'+a+'_card_reads_normally',R[a]);
 ok(R.ms&&/\d\.\d{4}%/.test(R.ms.st)&&!R.ms.stale,'FRESH_today_derivatives_reading',R.ms);
 ok(R.cl.some(i=>i.ok!=null),'FRESH_setup_funding_reading',R.cl);
 ok(R.dvBTC&&Math.abs(R.dvBTC.f-FX.live_marker.BTC)<1e-12&&R.pts.length===1,'FRESH_insight_live_funding_kept',{dv:R.dvBTC,pts:R.pts});
 ok(R.insCard.some(t=>/0\.019%/.test(t)),'FRESH_insight_card_funding_shown',R.insCard);
 ok(!R.errs.length,'FRESH_no_page_errors',R.errs);
 console.log('FAILS: '+F.length);process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
