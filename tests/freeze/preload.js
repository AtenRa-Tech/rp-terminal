// node -r ./freeze/preload.js tX.js : frozen gate (ported from the single-file branch, supervisor 21/24 Oct).
// Every puppeteer page gets a constant clock T0 (fixtures/frozen/meta.json), same-origin data/*.json is served from
// fixtures/frozen/data (the branch's data/ snapshot, so hourly data commits on main never move the gate), and every external
// GET is answered from the recording (anything not recorded fails like a down source). A test's own respond()/abort() still wins.
// Node side: Date runs from T0 too (advancing in real time), so fixtures a test builds from "now" match the page clock.
// Re-record: FREEZE_RECORD=1 node -r ./freeze/preload.js tX.js (keeps existing entries, adds new ones).
const fs=require('fs'),path=require('path'),P=require('puppeteer-core'),crypto=require('crypto');const FZ=path.join(__dirname,'../fixtures/frozen');
const REC=!!process.env.FREEZE_RECORD;const META=JSON.parse(fs.readFileSync(FZ+'/meta.json','utf8'));const T0=META.T0;
const IP=fs.existsSync(FZ+'/index.json')?FZ+'/index.json':null;const IDX=IP?JSON.parse(fs.readFileSync(IP,'utf8')):{};
/* Node-side reads of the repo's data/*.json (tests that seed pages from disk) see the same frozen snapshot as the page */
{const RD=path.resolve(__dirname,'../../data')+path.sep;const map=f=>{try{const r=path.resolve(String(f));if(r.startsWith(RD)&&/\.json$/.test(r)){const z=path.join(FZ,'data',r.slice(RD.length));if(fs.existsSync(z))return z}}catch(e){}return f};
 for(const n of ['readFileSync','readFile','existsSync','statSync','createReadStream']){const o=fs[n];fs[n]=function(f,...a){return o.call(this,typeof f==='string'?map(f):f,...a)}}
 const pr=fs.promises.readFile;fs.promises.readFile=function(f,...a){return pr.call(this,typeof f==='string'?map(f):f,...a)}}
const {key}=require('./key');const LOCAL=h=>h==='localhost'||h==='127.0.0.1';
{const RD=Date,r0=RD.now();class ND extends RD{constructor(...a){a.length?super(...a):super(T0+(RD.now()-r0))}static now(){return T0+(RD.now()-r0)}}global.Date=ND}
const inject=`(()=>{const RD=Date,T0=${T0};class FD extends RD{constructor(...a){a.length?super(...a):super(T0)}static now(){return T0}}window.Date=FD;window.__FROZEN=1})();`;
const dataFile=x=>{const m=x.pathname.match(/\/data\/([\w.-]+\.json)$/);if(!m)return null;const f=path.join(FZ,'data',m[1]);return fs.existsSync(f)?f:null};
const {HTTPRequest}=require('puppeteer-core/lib/cjs/puppeteer/api/HTTPRequest.js');const C0=HTTPRequest.prototype.continue;
let dirty=false;const save=()=>{if(dirty){fs.writeFileSync(FZ+'/index.json',JSON.stringify(IDX));dirty=false}};
HTTPRequest.prototype.continue=async function(...a){const u=this.url();let x;try{x=new URL(u)}catch(e){return C0.apply(this,a)}
 if(!/^https?:/.test(x.protocol))return C0.apply(this,a);
 if(LOCAL(x.hostname)){const f=dataFile(x);if(f)return this.respond({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:fs.readFileSync(f)});return C0.apply(this,a)}
 if(this.method()!=='GET')return this.abort('failed');
 const k=key(u),r=IDX[k];if(r)return this.respond({status:r.s,contentType:r.ct,headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(`${FZ}/net/${r.h}.body`)});
 if(!REC)return this.abort('failed');return C0.apply(this,a)};
const capture=pg=>pg.on('response',async r=>{const u=r.url();let x;try{x=new URL(u)}catch(e){return}if(!/^https?:/.test(x.protocol)||LOCAL(x.hostname)||r.request().method()!=='GET')return;
 try{if(!r.remoteAddress().ip)return;const k=key(u);if(IDX[k])return;const body=await r.buffer();const h=crypto.createHash('sha1').update(k).digest('hex').slice(0,16);
  fs.mkdirSync(FZ+'/net',{recursive:true});fs.writeFileSync(`${FZ}/net/${h}.body`,body);IDX[k]={h,s:r.status(),ct:r.headers()['content-type']||'',u};dirty=true;save()}catch(e){}});
const wrap=o=>{if(!o||o.__fz)return o;const np=o.newPage.bind(o);o.newPage=async(...a)=>{const pg=await np(...a);await pg.setBypassServiceWorker(true).catch(()=>{});await pg.evaluateOnNewDocument(inject);if(REC)capture(pg);
  await pg.setRequestInterception(true);const sri=pg.setRequestInterception.bind(pg);pg.setRequestInterception=async v=>sri(true);/* a test turning it off must not bypass the replay */
  pg.on('request',q=>{if(pg.listenerCount('request')>pg.__fzBase)return;q.continue().catch(()=>{})});pg.__fzBase=pg.listenerCount('request');
  /* service-worker tests opt in with ?sw=1 (tfix F/E5-E6): the worker stays on for that page so the offline reload is real; its own fetches are not replayed, which is fine because the check runs offline */
  const g0=pg.goto.bind(pg);pg.goto=async(u,...r)=>{if(/[?&]sw=1\b/.test(u))await pg.setBypassServiceWorker(false).catch(()=>{});return g0(u,...r)};return pg};
 if(o.createBrowserContext){const cc=o.createBrowserContext.bind(o);o.createBrowserContext=async(...a)=>wrap(await cc(...a))}
 if(o.createIncognitoBrowserContext){const ci=o.createIncognitoBrowserContext.bind(o);o.createIncognitoBrowserContext=async(...a)=>wrap(await ci(...a))}o.__fz=1;return o};
const L=P.launch.bind(P);P.launch=async(...a)=>wrap(await L(...a));
process.env.DATA=FZ+'/data';process.on('exit',save);
