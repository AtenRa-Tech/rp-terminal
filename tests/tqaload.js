// tqaload (11 Nov, run 42972400257): browser gates never wait for network idle; they load through ONE loader (qa/_load.js) that waits for the app's
// ready signal, answers outside feeds from the recordings on the data gate, and turns a timeout into a FAIL (retry once, then "timed out", exit != 0).
// Static checks + behaviour: (a) every outside feed HANGS (proxy that never answers): the blocking data gates still finish and pass on the recorded
// feeds, and none of the app's feed hosts is ever contacted; (b) a page that never signals ready fails as a timeout after one retry; a gate that
// never finishes is stopped by the watchdog; (c) no network-idle wait anywhere in the gates. Runs its own local servers on free ports.
// Child gates run WITHOUT the frozen preload (exactly like data.yml), against the repo's own data/.
const fs=require('fs'),path=require('path'),net=require('net'),http=require('http'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),QA=path.join(ROOT,'qa'),rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
process.env.QA_GATE_TIMEOUT=process.env.QA_GATE_TIMEOUT||'1150';/* this suite requires qa/_load.js: its own watchdog sits under run-all's 1200 s limit */
const fails=[];const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' -> '+String(x).slice(0,400)));if(!c)fails.push(m)};
const IDLE=new RegExp('network'+'idle','i');// built at run time so this file itself does not contain the token
// ---------- (c) static
const gateFiles=[...fs.readdirSync(QA).filter(f=>/\.js$/.test(f)).map(f=>'qa/'+f),...fs.readdirSync(__dirname).filter(f=>/\.(js|sh|py)$/.test(f)).map(f=>'tests/'+f),
 ...fs.readdirSync(path.join(ROOT,'tests/freeze')).map(f=>'tests/freeze/'+f),...fs.readdirSync(path.join(ROOT,'.github/workflows')).map(f=>'.github/workflows/'+f),
 ...(fs.existsSync(path.join(ROOT,'.github/scripts'))?fs.readdirSync(path.join(ROOT,'.github/scripts')).map(f=>'.github/scripts/'+f):[])];
const isFile=f=>{try{return fs.statSync(path.join(ROOT,f)).isFile()}catch(e){return false}};const idle=gateFiles.filter(isFile).filter(f=>IDLE.test(rd(f)));ok(!idle.length,`(c) no network-idle wait in ${gateFiles.filter(isFile).length} gate/test/workflow files`,idle.join(', '));
const browserQa=fs.readdirSync(QA).filter(f=>/\.js$/.test(f)&&!/^_/.test(f)).filter(f=>/require\('(playwright-core|puppeteer-core)'\)/.test(rd('qa/'+f)));
for(const f of browserQa){const s=rd('qa/'+f);ok(/require\('\.\/_load\.js'\)/.test(s)&&/QL\.open\(/.test(s)&&!/\.goto\(/.test(s),`qa/${f}: loads the page only through qa/_load.js (QL.open, no direct goto)`)}
ok(browserQa.length>=14,'found the browser gates ('+browserQa.length+')',browserQa.join(','));
{const s=rd('tests/tscroll.js');ok(/require\('\.\.\/qa\/_load\.js'\)/.test(s)&&/QL\.open\(/.test(s)&&!/\.goto\(/.test(s),'tests/tscroll.js (frozen gate) loads through qa/_load.js')}
const LD=rd('qa/_load.js');
ok(/waitUntil:'domcontentloaded'/.test(LD)&&!/waitUntil:'load'/.test(LD)&&!IDLE.test(LD),'loader: goto waits for domcontentloaded only');
ok(/data-ready/.test(LD)&&/waitForFunction\(READY/.test(LD),'loader: waits for the app ready signal (<html data-ready="1">)');
ok(/for\(let a=1;a<=2;a\+\+\)/.test(LD)&&/timed out/.test(LD)&&/throw new Error/.test(LD),'loader: one retry, then throws "timed out"');
ok(/process\.exit\(124\)/.test(LD)&&/\.unref\(\)/.test(LD),'loader: watchdog exits 124 for a gate that never finishes');
const HTML=rd('index.html');
ok(/<html[^>]*\bdata-ready="0"/.test(HTML),'index.html: <html data-ready="0"> before the first load');
ok(/Promise\.allSettled\(\[BOOT_REF,BOOT_TAB\]\)\.then\(\(\)=>Promise\.allSettled\(\[TODAYP,SIGP\]\)\)\.finally\(\(\)=>\{window\.RP_READY=true;document\.documentElement\.dataset\.ready='1'\}\)/.test(HTML),'index.html: ready set in allSettled(...).finally(), so a failed or blocked feed still ends in ready');
ok(/TODAYP=Promise\.allSettled\(core\)/.test(HTML),'index.html: Today data promise (no news) feeds the ready signal');
const DY=rd('.github/workflows/data.yml'),gs=DY.slice(DY.indexOf('\n  gates:'),DY.indexOf('\n  deploy:'));
ok(/export QA_NET=replay/.test(gs),'data.yml gates: QA_NET=replay (outside feeds from the recordings)');
ok(/node qa\/caption-sweep\.js \$U --no-live-news > g\/caption-sweep\.log 2>&1 & p7=\$!/.test(gs),'data.yml gates: blocking caption sweep runs without live news');
{const m=gs.match(/\( QA_NET=live [^\n]*timeout \d+ node qa\/caption-sweep\.js \$U --live-news-only [^\n]*\) & plive=\$!/);ok(!!m,'data.yml gates: live-news sweep runs apart, QA_NET=live, own timeout');
 ok(!/ps="[^"]*plive/.test(gs)&&!/\$plive \|\| fail=1/.test(gs),'data.yml gates: live-news sweep is not in $ps and never sets fail')}
// loader decisions (unit)
{const L=require('../qa/_load.js'),R=require('../qa/_replay.js');const rec='https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT';
 ok(L.decide('replay','http://127.0.0.1:1/index.html','GET').pass,'replay: local server passes through');
 const d=L.decide('replay',rec,'GET');ok(d.res&&d.res.status===200,'replay: a recorded outside GET is answered from the recording');
 ok(L.decide('replay','https://unrecorded.example.com/feed','GET').abort,'replay: an unrecorded outside request is aborted');
 ok(L.decide('replay',rec,'POST').abort,'replay: a non-GET outside request is aborted');
 ok(L.decide('block',rec,'GET').abort,'block: every outside request is aborted');
 const now=Date.now(),a=R.answer('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&endTime='+now,'GET',now);
 const k=a&&JSON.parse(a.body),DAY=864e5;ok(k&&k.length===1000&&k.at(-1)[0]===Math.floor(now/DAY)*DAY&&k.every(c=>c[0]<=now),'replay: a now-based candle request gets the recording moved to today (last candle opens today 00:00 UTC, none in the future)',k&&new Date(k.at(-1)[0]).toISOString());
 const b=k&&R.answer('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&endTime='+(k[0][0]-1),'GET',now);ok(b&&JSON.parse(b.body).at(-1)[0]===k[0][0]-DAY,'replay: the next history page (endTime from the first page) replays contiguously')}
// ---------- behaviour
const free=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
const env0=()=>{const e={...process.env};for(const k of ['FREEZE_T0','FREEZE_RECORD','DATA','NODE_OPTIONS','QA_NET','QA_READY_MS','QA_GATE_TIMEOUT'])delete e[k];e.NODE_PATH=e.NODE_PATH||path.join(__dirname,'node_modules');return e};
const run=(args,env,ms=600000)=>new Promise(r=>{const t0=Date.now();const c=spawn(process.execPath,args,{cwd:ROOT,env:{...env0(),...env}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);
 const k=setTimeout(()=>{out+='\n[tqaload] killed after '+ms+'ms';c.kill('SIGKILL')},ms);c.on('close',code=>{clearTimeout(k);r({code,out,s:((Date.now()-t0)/1000).toFixed(1)})})});
async function serve(dir){const port=await free();const p=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:dir,stdio:'ignore'});
 for(let i=0;i<50;i++){const up=await new Promise(r=>http.get(`http://127.0.0.1:${port}/`,res=>{res.resume();r(true)}).on('error',()=>r(false)));if(up)break;await new Promise(r=>setTimeout(r,200))}return {port,kill:()=>p.kill()}}
(async()=>{const S=await serve(ROOT),U=`http://127.0.0.1:${S.port}/index.html`;const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tqaload-'));
 fs.writeFileSync(path.join(tmp,'never.html'),'<!doctype html><html data-ready="0"><body>never ready<script>window.SIG=[];window.SIGT={}</script></body></html>');
 fs.writeFileSync(path.join(tmp,'legacy.html'),'<!doctype html><html><body>older page without the signal</body></html>');const T=await serve(tmp);
 try{
  // ready signal with every outside request blocked: ready, and the signal data is there
  {const s=`const {chromium}=require('playwright-core');const QL=require(${JSON.stringify(path.join(QA,'_load.js'))});(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();const t0=Date.now();
   await QL.open(p,${JSON.stringify(U)},{timeout:60000,settle:0});const r=await p.evaluate(()=>({ready:window.RP_READY===true&&document.documentElement.dataset.ready==='1',sig:Array.isArray(SIG),mac:!!(MAC&&MAC.M)}));console.log('RESULT',JSON.stringify({...r,s:(Date.now()-t0)/1000,aborted:QL.STATS.aborted,replayed:QL.STATS.replayed}));await b.close()})().catch(e=>{console.error(e);process.exit(2)})`;
   const r=await run(['-e',s],{QA_NET:'block'},180000);const m=r.out.match(/RESULT (.*)/);const j=m?JSON.parse(m[1]):{};
   ok(r.code===0&&j.ready&&j.sig&&j.mac&&j.aborted>0&&j.replayed===0,`ready with ALL outside requests blocked: ready in ${j.s}s, SIG built, macro loaded, ${j.aborted} outside requests aborted`,r.out.slice(-600))}
  // legacy page (no data-ready attribute, live site on older code): passes after load + fixed settle, no timeout
  {const s=`const {chromium}=require('playwright-core');const QL=require(${JSON.stringify(path.join(QA,'_load.js'))});(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();await QL.open(p,'http://127.0.0.1:${T.port}/legacy.html',{timeout:20000,settle:0});console.log('LEGACY_OK');await b.close()})().catch(e=>{console.error(e);process.exit(2)})`;
   const r=await run(['-e',s],{QA_NET:'block'},120000);ok(r.code===0&&/LEGACY_OK/.test(r.out)&&/no ready signal \(older code\)/.test(r.out),'a page from before the ready signal loads with the old fixed wait',r.out.slice(-400))}
  // (b) never-ready page: a real gate retries once, then fails as a timeout (non-zero, "timed out"), never "0 failures"
  {const r=await run(['qa/card-presence.js',`http://127.0.0.1:${T.port}/never.html`],{QA_READY_MS:'5000',QA_NET:'block'},120000);
   ok(r.code!==0&&/timed out/.test(r.out)&&/attempt 1 failed[^\n]*retrying once/.test(r.out)&&/attempt 2 failed/.test(r.out)&&!/0 failures/.test(r.out),`(b) never-ready page: card-presence exits ${r.code} after one retry with "timed out" (${r.s}s)`,r.out.slice(-600))}
  {const r=await run(['-e',`require(${JSON.stringify(path.join(QA,'_load.js'))});setInterval(()=>{},1000)`],{QA_GATE_TIMEOUT:'2'},30000);
   ok(r.code===124&&/timed out/.test(r.out),'(b) a gate that never finishes: watchdog exits 124 with "timed out"',r.code+' '+r.out.slice(-300))}
  // (a) every outside feed hangs: a proxy that accepts and never answers. Sanity: on QA_NET=live the page's feeds DO go to it.
  const hosts=new Set([...HTML.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})\//g)].map(m=>m[1]));
  const seen=[];const px=net.createServer(c=>{c.once('data',d=>{const m=String(d).match(/^(?:CONNECT ([^:\s]+)|\w+ https?:\/\/([^/:\s]+))/);if(m)seen.push(m[1]||m[2])});c.on('error',()=>{})});
  const pport=await new Promise(r=>px.listen(0,'127.0.0.1',()=>r(px.address().port)));const PX={http_proxy:`http://127.0.0.1:${pport}`,https_proxy:`http://127.0.0.1:${pport}`,HTTP_PROXY:`http://127.0.0.1:${pport}`,HTTPS_PROXY:`http://127.0.0.1:${pport}`};
  {const r=await run(['qa/oicap-label.js',U],{...PX,QA_NET:'live',QA_READY_MS:'8000'},120000);const app=seen.filter(h=>hosts.has(h));
   ok(app.length>0&&r.code!==0&&/timed out/.test(r.out),`(a) sanity: with live feeds the hanging proxy is reached (${[...new Set(app)].slice(0,4).join(', ')}) and the gate fails as "timed out" (exit ${r.code}), not as a pass`,r.out.slice(-300))}
  seen.length=0;const G=[['card-presence',['qa/card-presence.js',U]],['oicap-label',['qa/oicap-label.js',U]],['pulse-movers',['qa/pulse-movers.js',U]],['caption-sweep',['qa/caption-sweep.js',U,'--no-live-news']],['stale-captions',['qa/stale-captions.js',U],{DERIVS_FIXTURE:'qa/fixtures/derivs-stale.json'}]];
  const t0=Date.now();const R=await Promise.all(G.map(([n,a,e])=>run(a,{...PX,...(e||{}),QA_NET:'replay',QA_GATE_TIMEOUT:'480'},540000).then(r=>[n,r])));
  for(const [n,r] of R)ok(r.code===0&&/ready after/.test(r.out)&&!/timed out/.test(r.out),`(a) feeds hang: ${n} finished and passed on the recorded feeds in ${r.s}s (in parallel)`,r.out.slice(-500));
  const app=seen.filter(h=>hosts.has(h));ok(app.length===0,`(a) feeds hang: no app feed host was contacted by the replay gates (${((Date.now()-t0)/1000).toFixed(0)}s for all 5 in parallel; browser-internal connections ignored: ${seen.length})`,[...new Set(app)].join(','));
  px.close()}
 finally{S.kill();T.kill();try{fs.rmSync(tmp,{recursive:true,force:true})}catch(e){}}
 console.log(`FAILS: ${fails.length}`,JSON.stringify(fails));process.exit(fails.length?1:0)})().catch(e=>{console.error(e);console.log('FAILS: 1');process.exit(1)});
