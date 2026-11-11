// ONE page loader for every browser gate (11 Nov, run 42972400257: five data gates timed out waiting for network idle because the app keeps
// polling outside feeds, so the page never goes quiet). Usage in a gate:  const QL=require('./_load.js');  await QL.open(page,url);
// open(): network policy (below) -> goto(waitUntil 'domcontentloaded') -> wait for the APP's own ready signal (<html data-ready="1">, set by
// index.html once its first load has finished, also when a feed fails) -> short settle. Never waits for network idle.
// Timeouts never pass: a page that does not signal ready within QA_READY_MS (default 90 s) is retried ONCE, then open() throws
// "timed out: ..." and the gate exits non-zero (its own catch). A gate that hangs after that is stopped by the watchdog (QA_GATE_TIMEOUT s,
// default 600) with "timed out" and exit 124. A page from before the ready signal (no data-ready attribute, e.g. the live site still on older
// tested code) gets the old behaviour instead: window load + a fixed 15 s settle.
// Network policy, QA_NET (default from the target URL):
//   frozen  - tests/freeze/preload.js is loaded (FREEZE_T0 set): it already replays everything; the loader adds nothing.
//   replay  - default for a local URL (localhost/127.0.0.1, i.e. the data gates): the local server is used as is (the data being gated);
//             every outside GET is answered from the recorded feeds (tests/fixtures/frozen/net, moved to today, qa/_replay.js);
//             anything not recorded, and any non-GET, is aborted. Results do not depend on feed speed and a hanging feed is never reached.
//   block   - every outside request is aborted (ready-signal tests).
//   live    - default for a remote URL (live-site smoke): no interception; feeds are real.
// A gate's own route()/request handler keeps priority (playwright page routes run first and pass on with route.fallback();
// a puppeteer handler's continue() goes through the same policy).
const path=require('path');
const READY_MS=+process.env.QA_READY_MS||90000,LEGACY_SETTLE=15000,GATE_S=+process.env.QA_GATE_TIMEOUT||600;
const LOCAL=h=>h==='localhost'||h==='127.0.0.1'||h==='[::1]';
const isLocal=u=>{try{return LOCAL(new URL(u).hostname)}catch(e){return false}};
const NAME=path.basename(process.argv[1]||'gate');
// watchdog: a gate that never finishes must fail loudly, not hang until the job timeout
const WD=setTimeout(()=>{console.error(`::error title=${NAME} timed out::${NAME} timed out: did not finish within ${GATE_S}s (watchdog, qa/_load.js); this is a FAIL, not a pass`);process.exit(124)},GATE_S*1000);WD.unref();
function mode(url){const m=process.env.QA_NET;if(m){if(!/^(frozen|replay|block|live)$/.test(m))throw new Error('QA_NET must be frozen|replay|block|live, got '+m);return m}
 if(process.env.FREEZE_T0)return 'frozen';return isLocal(url)?'replay':'live'}
let REPLAY=null;const replay=()=>REPLAY||(REPLAY=require('./_replay.js'));
const STATS={replayed:0,aborted:0,local:0};
// decision for one request: {pass:true} | {abort:true} | {res:{status,contentType,body}}
function decide(m,u,method){let x;try{x=new URL(u)}catch(e){return {pass:true}}if(!/^https?:$/.test(x.protocol))return {pass:true};
 if(LOCAL(x.hostname)){STATS.local++;return {pass:true}}
 if(m==='block'){STATS.aborted++;return {abort:true}}
 const a=replay().answer(u,method);if(!a){STATS.aborted++;return {abort:true}}STATS.replayed++;return {res:a}}
// puppeteer: a gate's own request handler calls continue(); route that through the policy (patched once per loaded puppeteer copy)
const PPM=new Set();
function patchPuppeteer(m){for(const [id,mod] of Object.entries(require.cache)){if(!/puppeteer-core[\\/]lib[\\/]cjs[\\/]puppeteer[\\/]api[\\/]HTTPRequest\.js$/.test(id)||PPM.has(id))continue;
  const H=mod.exports&&mod.exports.HTTPRequest;if(!H)continue;PPM.add(id);const C0=H.prototype.continue;
  H.prototype.continue=async function(...a){const d=decide(m,this.url(),this.method());if(d.pass)return C0.apply(this,a);if(d.abort)return this.abort('failed');
   return this.respond({status:d.res.status,contentType:d.res.contentType,headers:{'access-control-allow-origin':'*'},body:d.res.body})}}}
async function installNet(page,m){if(page.__qaNet)return;page.__qaNet=m;if(m==='frozen'||m==='live')return;
 if(typeof page.route==='function'){// playwright: context route = lowest priority, so a gate's page.route() decides first and falls back here
  const ctx=page.context();if(ctx.__qaNet)return;ctx.__qaNet=m;
  await ctx.route('**/*',route=>{const q=route.request(),d=decide(m,q.url(),q.method());if(d.pass)return route.continue().catch(()=>{});if(d.abort)return route.abort('failed').catch(()=>{});
   return route.fulfill({status:d.res.status,contentType:d.res.contentType,headers:{'access-control-allow-origin':'*'},body:d.res.body}).catch(()=>{})});return}
 // puppeteer
 patchPuppeteer(m);
 if(page.listenerCount('request')===0){await page.setRequestInterception(true);page.on('request',q=>{if(q.isInterceptResolutionHandled&&q.isInterceptResolutionHandled())return;q.continue().catch(()=>{})})}
 else if(PPM.size===0)throw new Error('qa/_load: cannot route this page\'s own request handler through QA_NET='+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// the app's ready signal; 'legacy' = a page without the attribute (older code) that has finished loading
const READY=()=>{const h=document.documentElement;if(!h)return false;if(h.hasAttribute('data-ready'))return h.getAttribute('data-ready')==='1';return document.readyState==='complete'?'legacy':false};
async function waitReady(page,timeout=READY_MS){const pw=typeof page.route==='function';
 const h=pw?await page.waitForFunction(READY,undefined,{timeout,polling:250}):await page.waitForFunction(READY,{timeout,polling:250});
 const v=await h.jsonValue().catch(()=>true);if(v==='legacy'){console.log(`[qa/_load] ${NAME}: page has no ready signal (older code); waiting ${LEGACY_SETTLE/1000}s after load`);await sleep(LEGACY_SETTLE)}return v}
async function open(page,url,o={}){const timeout=o.timeout||READY_MS,settle=o.settle??1000,m=o.net||mode(url);await installNet(page,m);let last;const t0=Date.now();
 for(let a=1;a<=2;a++){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout});await waitReady(page,timeout);await sleep(settle);
   console.log(`[qa/_load] ${NAME}: ready after ${((Date.now()-t0)/1000).toFixed(1)}s (attempt ${a}, QA_NET=${m}${m==='replay'||m==='block'?`, ${STATS.replayed} replayed, ${STATS.aborted} aborted`:''})`);return page}
  catch(e){last=e;console.error(`[qa/_load] ${NAME}: attempt ${a} failed: ${String(e&&e.message||e).split('\n')[0]}${a<2?' - retrying once':''}`)}}
 const msg=String(last&&last.message||last).split('\n')[0],to=/timeout|timed out/i.test(msg);
 throw new Error(`${to?'timed out':'failed to load'}: ${url} did not signal ready (<html data-ready="1">) within ${timeout/1000}s, 2 attempts (${msg}); this gate did not run, so it FAILS`)}
module.exports={open,waitReady,installNet,mode,isLocal,decide,STATS,READY_MS};
