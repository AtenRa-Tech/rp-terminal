// P0 15 Oct app test: a late/divergent/missing LIVE exchange price must never change a score or data confidence.
// early = each signal re-scored with its audit result removed (exactly what a page shows before its audit finishes); must equal the audited scores.
// Loads the app 3x with identical market data (recorded once, replayed) and only the live-price endpoints changed:
//   agree (all 4 exchanges within 0.05%), split (one exchange 3% off = late print), down (live endpoints fail).
// Waits for the top-5 auto audits to finish, then requires identical Opportunity scores, POST NOW count and Data confidence.
const p=require('puppeteer-core'),U=require('url');
const URL=process.argv[2]||'http://localhost:8765/index.html';
const LIVE=/api\.coinbase\.com\/v2\/prices|api\.kraken\.com\/0\/public\/Ticker|ticker\/price\?symbol=BTCUSDT|\/simple\/price\?ids=bitcoin/;
const AUD=/coinbase\.com\/products\/(?!BTC-USD\/)[^/]+\/candles|api\.coinbase\.com|kraken\.com/; // audit-only cross-check sources (21 Oct: Coinbase BTC-USD daily candles are now the PRIMARY BTC history, so they are not held)
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i;
const FKEY=u=>{try{const x=new U.URL(u);for(const q of ['x','v','t','_','ts','cb','nocache'])x.searchParams.delete(q);for(const q of ['endTime','end','to']){const v=+x.searchParams.get(q);if(v>1.7e9&&(v>1e12?v:v*1e3)>Date.now()-3*864e5)x.searchParams.set(q,'NOW')}/* 'now'-based paging (bnDaily endTime=Date.now()) must replay across loads/days */return x.toString()}catch(e){return u}};
const FROZEN=new Map();
function livePrice(u,mode){const base=67000,k={coinbase:1,kraken:1.0003,binance:.9998,simple:1.0001};const n=Object.keys(k).find(x=>u.includes(x==='simple'?'simple/price':x));let v=base*k[n];if(mode==='split'&&n==='kraken')v=base*1.03;
 return n==='coinbase'?{data:{amount:String(v)}}:n==='kraken'?{result:{XXBTZUSD:{c:[String(v)]}}}:n==='binance'?{price:String(v)}:{bitcoin:{usd:v}}}
async function run(b,mode,record){const pg=await b.newPage();
 // pre: audit cross-check fetches never settle (not even on the app's 12 s abort), so every score is read before any audit finishes
 if(mode==='pre')await pg.evaluateOnNewDocument((src,src2)=>{const re=new RegExp(src),re2=new RegExp(src2),f=window.fetch;window.fetch=function(u,o){const s=String(u&&u.url||u);if(re.test(s)||re2.test(s))return new Promise(()=>{});return f.apply(this,arguments)}},LIVE.source,AUD.source);await pg.setBypassServiceWorker(true);await pg.setViewport({width:412,height:915});await pg.setRequestInterception(true);
 pg.on('request',r=>{const u=r.url();if(BLOCK.test(u))return r.abort();
  if(mode==='pre'&&(LIVE.test(u)||AUD.test(u)))return; // pre: audit responses held forever -> page is scored before any audit finishes
  if(LIVE.test(u)){if(mode==='down')return r.abort();return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(livePrice(u,mode))})}
  const k=FKEY(u);if(FROZEN.has(k)){const f=FROZEN.get(k);
   // forming: the newest daily-candle page also carries TODAY's still-forming candle (open today 00:00 UTC, price +5%); it must be dropped before scoring
   if(mode==='forming'&&/\/klines\?.*interval=1d/.test(u)&&/endTime=/.test(u)&&+new U.URL(u).searchParams.get('endTime')>Date.now()-3*864e5){/* only the NEWEST page carries today's forming candle; older pages (endTime = first open of the next page - 1) never do (fix 21 Oct: a fake candle in an older page sat mid-series, so closed() could not drop it) */try{const rows=JSON.parse(Buffer.from(f.body).toString());const L=rows.at(-1),t0=Math.floor(Date.now()/864e5)*864e5;
     if(L){if(L[0]<t0){const c=String(+L[4]*1.05);rows.push([t0,L[4],c,L[4],c,L[5],t0+864e5-1,...L.slice(7)])}else{L[4]=String(+L[4]*1.05);L[2]=L[4]}/* recording already ends on today's forming candle: move it 5% */return r.respond({...f,body:JSON.stringify(rows)}).catch(()=>{})}}catch(e){}}
   return r.respond(f).catch(()=>{})}
  if(!record&&r.method()==='GET'&&!u.startsWith(new U.URL(URL).origin))return r.abort(); r.continue()});
 if(record)pg.on('response',async res=>{try{const u=res.url(),q=res.request();if(q.method()!=='GET'||LIVE.test(u)||res.status()>=300&&res.status()<400)return;const body=await res.buffer();FROZEN.set(FKEY(u),{status:res.status(),headers:{'content-type':res.headers()['content-type']||'application/octet-stream','access-control-allow-origin':'*'},body})}catch(e){}});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'x='+Date.now(),{waitUntil:'networkidle2',timeout:120000});
 await pg.click('nav button[data-t="signals"]');
 if(mode==='pre'){await pg.waitForFunction(()=>typeof SIG!=='undefined'&&SIG&&SIG.filter(s=>s.score!=null).length>=13,{timeout:90000,polling:200}).catch(()=>{})}else
 // wait until the auto audits of the top 5 have finished (status line no longer says "(running)")
 await pg.waitForFunction(()=>{const e=document.getElementById('audSt');return e&&!/running/.test(e.textContent)&&/of top/.test(e.textContent)},{timeout:120000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,2000));
 if(mode==='early')await pg.evaluate(()=>{window.__early=1});
 const out=await pg.evaluate(()=>{const S=(typeof SIG!=='undefined'&&SIG)||[];const sc={},cf={};const EARLY=window.__early;for(const s0 of S){let s=s0;if(EARLY&&typeof oppScore==='function'){s=Object.assign({},s0);delete s.audit;delete s.auditTxt;delete s.auditWhy;oppScore(s)}if(s.score!=null)sc[s.id]=s.score;(window.__rd||(window.__rd={}))[s.id]={read:s.read,closed:s.closed??s.lastT};if(s.opp?.conf)cf[s.id]=s.opp.conf[0]}
  const st={};for(const c of ((typeof SIGSTALE!=='undefined'&&SIGSTALE)||[])){const el=document.querySelector('[data-id="'+c.id+'"]');st[c.id]={stale:!!c.stale,score:c.score??null,read:c.read,why:c.staleWhy||'',inSig:S.includes(c),post:typeof postNow==='function'?!!postNow(c):false,label:el?/stale|unavailable/i.test(el.innerText):null}}
  const t=document.body.innerText;return{st,sc,cf,post:(t.match(/(\d+) of (\d+) charts are POST NOW/)||[]).slice(1).join('/'),aud:document.getElementById('audSt')?.textContent||'',audited:EARLY?0:S.filter(s=>s.audit).length,rd:window.__rd||{}}});
 await pg.close();return out}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 await run(b,'agree',true);const R={};for(const m of ['agree','split','down','early','pre','forming'])R[m]=await run(b,m,false);await b.close();
 const F=[];const n=Object.keys(R.agree.sc).length;if(n<3)F.push(`only ${n} scores read`);
 const FRC=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../shared/freshness.json'),'utf8')).confidence,FULL=new Set([FRC.fresh_multi_source,FRC.fresh_single_source]);
 for(const m of Object.keys(R))for(const [k,c] of Object.entries(R[m].cf))if(!FULL.has(c))F.push(`${m}: ${k} scored with confidence ${c}, not a full value (${[...FULL]}) from shared/freshness.json`);
 // 21 Oct: a required card whose source went quiet (no new points for 2+ days) is NOT a failure if it is listed as stale: unscored, shown as —, labelled with its reason
 // and kept out of SIG / POST NOW. A required card that is neither scored nor listed stale is still a failure.
 // 25 Oct (supervisor): that stale-is-OK rule is for the REAL clock only (main's data/ read on today's date, where a card can honestly be past its limit).
 // Under the frozen gate (node -r tests/freeze/preload.js: page clock T0, recorded fresh data/derivs) every required card is fresh, so it MUST be scored:
 // a fresh card that goes unscored (or is wrongly marked stale) fails here.
 const FROZENCLK=!!process.env.FREEZE_T0;console.log(FROZENCLK?`frozen clock ${new Date(+process.env.FREEZE_T0).toISOString()}: required cards must be scored (stale not accepted)`:'real clock: a required card past its freshness limit may be stale + unscored');
 for(const m of Object.keys(R))for(const k of ['ethbtc','rainbow','hash','fundBTC']){if(R[m].sc[k]!=null)continue;const c=R[m].st[k];
  if(FROZENCLK){F.push(`${m}: required card ${k} not scored on the frozen clock with fresh recorded data${c?` (listed stale: ${String(c.why).slice(0,80)})`:''}`);continue}
  if(!c){F.push(`${m}: required card ${k} missing (neither scored nor listed stale)`);continue}
  if(!c.stale)F.push(`${m}: ${k} unscored but not marked stale`);if(c.score!=null)F.push(`${m}: stale ${k} has score ${c.score}`);if(c.read!=='—')F.push(`${m}: stale ${k} shows a reading "${c.read}"`);
  if(!/^(Stale|Unavailable)/.test(c.why))F.push(`${m}: stale ${k} has no stale label/reason`);if(c.inSig)F.push(`${m}: stale ${k} is still in SIG`);if(c.post)F.push(`${m}: stale ${k} counts as POST NOW`);
  if(m==='agree')console.log(`${k}: stale, unscored, excluded (${c.why.slice(0,80)})`)}
 if(R.early.audited)F.push(`early: ${R.early.audited} signals were already audited when scored`);console.log('early case scored with',R.early.audited,'audited;',Object.keys(R.early.sc).length,'scores');
 if(R.pre.audited)F.push(`pre: ${R.pre.audited} signals audited although audit responses were held`);console.log('pre case scored with',R.pre.audited,'audited');
 {const lc=Math.floor(Date.now()/864e5)*864e5-864e5;for(const k of ['ethbtc','gold','rainbow','mayer','2y','pi','dd','wrsi']){const a=R.agree.rd[k],f=R.forming.rd[k];if(!a||!f){F.push(`forming: ${k} missing`);continue}
  if(a.read!==f.read)F.push(`forming: ${k} label "${f.read}" vs "${a.read}"`);if(a.closed!==f.closed)F.push(`forming: ${k} date ${new Date(f.closed).toISOString()} vs ${new Date(a.closed).toISOString()}`);
  if(k!=='wrsi'&&f.closed!==lc)F.push(`forming: ${k} ends ${new Date(f.closed).toISOString().slice(0,10)}, not the last closed day ${new Date(lc).toISOString().slice(0,10)}`)}
  console.log('forming case: ethbtc',R.forming.rd.ethbtc?.read,'| gold',R.forming.rd.gold?.read,'| last closed day',new Date(lc).toISOString().slice(0,10))}
 for(const m of ['split','down','early','pre','forming']){for(const k of new Set([...Object.keys(R.agree.sc),...Object.keys(R[m].sc)])){if(R.agree.sc[k]!==R[m].sc[k])F.push(`${m}: score ${k} ${R.agree.sc[k]} vs ${R[m].sc[k]}`);if(R.agree.cf[k]!==R[m].cf[k])F.push(`${m}: confidence ${k} ${R.agree.cf[k]} vs ${R[m].cf[k]}`)}
  if(R.agree.post!==R[m].post)F.push(`${m}: POST NOW ${R.agree.post} vs ${R[m].post}`)}
 console.log('scores', JSON.stringify(R.agree.sc));console.log('audits agree|split|down:',R.agree.aud,'|',R.split.aud,'|',R.down.aud);
 console.log(F.length?'FAIL\n- '+F.join('\n- '):`PASS ${n} scores identical with agreeing, late (3% off) and missing live prices, and when scored before the audit finished`);process.exit(F.length?1:0)})();
