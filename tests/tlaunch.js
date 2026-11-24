// 24 Nov: browser launch retried ONCE with a longer timeout (qa/_launch.js), used by the live smoke (tests/tsmoke.js, qa/card-presence.js).
// Cause: data.yml run 44847233870 (21 Nov 01:09Z) smoke "Timed out after 30000 ms while waiting for the WS endpoint URL" -> needless rollback.
// Unit: stub launchers (ok / fail-then-ok / fail-twice). Real: puppeteer launching a Chrome wrapper that hangs on its FIRST start only.
// Usage: node tests/tlaunch.js   (CHROME=/path overrides /usr/bin/google-chrome)
const fs=require('fs'),path=require('path'),os=require('os');const {launchRetry,FIRST_MS,RETRY_MS}=require('../qa/_launch.js');
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(!c&&x!==undefined?' :: '+JSON.stringify(x).slice(0,300):''));if(!c)F.push(n)};
(async()=>{
 ok(FIRST_MS===60000&&RETRY_MS===120000&&RETRY_MS>FIRST_MS,'first launch 60s (puppeteer default 30s), retry 120s',{FIRST_MS,RETRY_MS});
 const stub=plan=>{const calls=[];return{calls,fn:async o=>{calls.push(o.timeout);const r=plan[calls.length-1];if(r==='ok')return{browser:calls.length};throw new Error('Timed out after '+o.timeout+' ms while waiting for the WS endpoint URL')}}};
 const logs=[],log=m=>logs.push(m);
 {const s=stub(['ok']);const b=await launchRetry(s.fn,{executablePath:'x'},{log});ok(b.browser===1&&s.calls.length===1&&s.calls[0]===60000&&!logs.length,'launch ok first time: one call, 60s, nothing logged',s.calls)}
 {const s=stub(['fail','ok']);const b=await launchRetry(s.fn,{executablePath:'x',args:['--no-sandbox']},{log});ok(b.browser===2&&s.calls.join()==='60000,120000','first launch times out -> ONE retry with 120s, succeeds',s.calls);ok(logs.length===1&&/retrying ONCE with a 120s timeout/.test(logs[0])&&/WS endpoint/.test(logs[0]),'retry is logged with the first error',logs)}
 {const s=stub(['fail','fail','ok']);let err=null;try{await launchRetry(s.fn,{},{log})}catch(e){err=e}ok(err&&s.calls.length===2,'two failures -> error after exactly 2 launches (never a third)',s.calls)}
 {const s=stub(['ok']);await launchRetry(s.fn,{executablePath:'/c',headless:'new',args:['--no-sandbox']},{log:()=>{}});const o=s.calls;ok(o.length===1,'options passed through')}
 // static: the smoke's browser launches go through launchRetry, no bare launch left in the smoke path
 const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 const ts=R('tests/tsmoke.js'),cp=R('qa/card-presence.js');
 ok(/launchRetry\(o=>p\.launch\(o\)/.test(ts)&&!/await p\.launch\(\{/.test(ts),'tests/tsmoke.js launches Chrome via launchRetry');
 ok(/launchRetry\(o=>chromium\.launch\(o\)/.test(cp)&&!/await chromium\.launch\(\{/.test(cp),'qa/card-presence.js launches Chrome via launchRetry');
 // real: a Chrome wrapper that hangs on its first start (like the runner's slow start), then starts normally
 const CH=process.env.CHROME||'/usr/bin/google-chrome';
 if(!fs.existsSync(CH)){console.log('SKIP real launch: no Chrome at '+CH)}else{
  const T=fs.mkdtempSync(path.join(os.tmpdir(),'tlaunch-')),mark=path.join(T,'started'),w=path.join(T,'chrome-slow');
  fs.writeFileSync(w,`#!/bin/sh\nif [ ! -f "${mark}" ]; then touch "${mark}"; exec sleep 60; fi\nexec "${CH}" "$@"\n`);fs.chmodSync(w,0o755);
  const P=require('puppeteer-core');const lg=[];let b=null,err=null;const t0=Date.now();
  try{b=await launchRetry(o=>P.launch(o),{executablePath:w,headless:'new',args:['--no-sandbox']},{first:3000,retry:60000,log:m=>lg.push(m)})}catch(e){err=e}
  let v=null;if(b){try{v=await b.version()}catch(e){}await b.close()}
  ok(b&&v&&lg.length===1&&/retrying ONCE/.test(lg[0]),'real Chrome: first start hangs past its timeout, the single retry starts the browser',{err:err&&err.message,lg,v,ms:Date.now()-t0});
  fs.rmSync(T,{recursive:true,force:true})}
 console.log(`tlaunch: ${F.length} FAILS`);console.log(`FAILS: ${F.length}`);process.exit(F.length?1:0)})().catch(e=>{console.log('FAIL tlaunch crashed: '+(e&&e.stack));console.log('FAILS: 1');process.exit(1)});
