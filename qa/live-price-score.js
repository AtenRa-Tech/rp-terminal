// P0 15 Oct app test: a late/divergent/missing LIVE exchange price must never change a score or data confidence.
// early = each signal re-scored with its audit result removed (exactly what a page shows before its audit finishes); must equal the audited scores.
// Loads the app 3x with identical market data (recorded once, replayed) and only the live-price endpoints changed:
//   agree (all 4 exchanges within 0.05%), split (one exchange 3% off = late print), down (live endpoints fail).
// Waits for the top-5 auto audits to finish, then requires identical Opportunity scores, POST NOW count and Data confidence.
const p=require('puppeteer-core'),U=require('url');
const URL=process.argv[2]||'http://localhost:8765/index.html';
const LIVE=/api\.coinbase\.com\/v2\/prices|api\.kraken\.com\/0\/public\/Ticker|ticker\/price\?symbol=BTCUSDT|\/simple\/price\?ids=bitcoin/;
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i;
const FKEY=u=>{try{const x=new U.URL(u);for(const q of ['x','v','t','_','ts','cb','nocache'])x.searchParams.delete(q);return x.toString()}catch(e){return u}};
const FROZEN=new Map();
function livePrice(u,mode){const base=67000,k={coinbase:1,kraken:1.0003,binance:.9998,simple:1.0001};const n=Object.keys(k).find(x=>u.includes(x==='simple'?'simple/price':x));let v=base*k[n];if(mode==='split'&&n==='kraken')v=base*1.03;
 return n==='coinbase'?{data:{amount:String(v)}}:n==='kraken'?{result:{XXBTZUSD:{c:[String(v)]}}}:n==='binance'?{price:String(v)}:{bitcoin:{usd:v}}}
async function run(b,mode,record){const pg=await b.newPage();await pg.setBypassServiceWorker(true);await pg.setViewport({width:412,height:915});await pg.setRequestInterception(true);
 pg.on('request',r=>{const u=r.url();if(BLOCK.test(u))return r.abort();
  if(LIVE.test(u)){if(mode==='down')return r.abort();return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(livePrice(u,mode))})}
  const k=FKEY(u);if(FROZEN.has(k)){const f=FROZEN.get(k);return r.respond(f).catch(()=>{})}
  if(!record&&r.method()==='GET'&&!u.startsWith(new U.URL(URL).origin))return r.abort(); r.continue()});
 if(record)pg.on('response',async res=>{try{const u=res.url(),q=res.request();if(q.method()!=='GET'||LIVE.test(u)||res.status()>=300&&res.status()<400)return;const body=await res.buffer();FROZEN.set(FKEY(u),{status:res.status(),headers:{'content-type':res.headers()['content-type']||'application/octet-stream','access-control-allow-origin':'*'},body})}catch(e){}});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'x='+Date.now(),{waitUntil:'networkidle2',timeout:120000});
 await pg.click('nav button[data-t="signals"]');
 // wait until the auto audits of the top 5 have finished (status line no longer says "(running)")
 await pg.waitForFunction(()=>{const e=document.getElementById('audSt');return e&&!/running/.test(e.textContent)&&/of top/.test(e.textContent)},{timeout:120000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,2000));
 if(mode==='early')await pg.evaluate(()=>{window.__early=1});
 const out=await pg.evaluate(()=>{const S=(typeof SIG!=='undefined'&&SIG)||[];const sc={},cf={};const EARLY=window.__early;for(const s0 of S){let s=s0;if(EARLY&&typeof oppScore==='function'){s=Object.assign({},s0);delete s.audit;delete s.auditTxt;delete s.auditWhy;oppScore(s)}if(s.score!=null)sc[s.id]=s.score;if(s.opp?.conf)cf[s.id]=s.opp.conf[0]}
  const t=document.body.innerText;return{sc,cf,post:(t.match(/(\d+) of (\d+) charts are POST NOW/)||[]).slice(1).join('/'),aud:document.getElementById('audSt')?.textContent||'',audited:EARLY?0:S.filter(s=>s.audit).length}});
 await pg.close();return out}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 await run(b,'agree',true);const R={};for(const m of ['agree','split','down','early'])R[m]=await run(b,m,false);await b.close();
 const F=[];const n=Object.keys(R.agree.sc).length;if(n<3)F.push(`only ${n} scores read`);
 if(R.early.audited)F.push(`early: ${R.early.audited} signals were already audited when scored`);console.log('early case scored with',R.early.audited,'audited;',Object.keys(R.early.sc).length,'scores');
 for(const m of ['split','down','early']){for(const k of new Set([...Object.keys(R.agree.sc),...Object.keys(R[m].sc)])){if(R.agree.sc[k]!==R[m].sc[k])F.push(`${m}: score ${k} ${R.agree.sc[k]} vs ${R[m].sc[k]}`);if(R.agree.cf[k]!==R[m].cf[k])F.push(`${m}: confidence ${k} ${R.agree.cf[k]} vs ${R[m].cf[k]}`)}
  if(R.agree.post!==R[m].post)F.push(`${m}: POST NOW ${R.agree.post} vs ${R[m].post}`)}
 console.log('scores', JSON.stringify(R.agree.sc));console.log('audits agree|split|down:',R.agree.aud,'|',R.split.aud,'|',R.down.aud);
 console.log(F.length?'FAIL\n- '+F.join('\n- '):`PASS ${n} scores identical with agreeing, late (3% off) and missing live prices, and when scored before the audit finished`);process.exit(F.length?1:0)})();
