// 24 Nov: C6 runs on the fixture's time, never the wall clock (qa/_c6.js, qa/stale-captions.js).
// Cause: data.yml run 45085594889 (gates 23:57:25Z -> 00:01:49Z, 22/23 Nov) failed "C6 oicapBTC/ETH one close back: missing from SIG / marked stale":
// the fixture, the page clock and the expected labels came from three different wall-clock moments on either side of 00:00Z.
// Unit: c6At/c6Fails at 23:59Z and 00:01Z. Browser (URL env, frozen data like run-all): the real gate's C6 case at 23:59Z and 00:01Z passes, and the
// old mixed-clock situation (fixture 23:59Z, page 00:01Z) fails with exactly the 4 lines from run 45085594889 - so the test would catch a regression.
// Usage: URL=http://127.0.0.1:8792/index.html node tests/tc6clock.js   (URL defaults to http://localhost:8765/index.html like run-all)
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');const C6=require('../qa/_c6.js');
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(!c&&x!==undefined?' :: '+JSON.stringify(x).slice(0,400):''));if(!c)F.push(n)};
const A=Date.parse('2026-10-24T23:59:00Z'),B=Date.parse('2026-10-25T00:01:00Z'),H=36e5,DAY=24*H;
// ---- unit
{const a=C6.c6At(A),b=C6.c6At(B);
 ok(a.D0===Date.parse('2026-10-24T00:00:00Z')&&a.end===Date.parse('2026-10-23T23:00:00Z')&&a.want==='(22 Oct'&&a.bad==='(23 Oct close','23:59Z: hourly OI ends 23:00Z the day before, label names the 22 Oct close, never "23 Oct close"',a);
 ok(b.D0===Date.parse('2026-10-25T00:00:00Z')&&b.end===Date.parse('2026-10-24T23:00:00Z')&&b.want==='(23 Oct'&&b.bad==='(24 Oct close','00:01Z: window moved one day: OI ends 23:00Z 24 Oct, label names the 23 Oct close',b);
 ok(a.oiAgeMs===A-a.end&&b.oiAgeMs===B-b.end&&a.oiAgeMs===24*H+59*60e3&&b.oiAgeMs===H+60e3,'fixture age measured from T itself (24h59m at 23:59Z / 1h01m at 00:01Z)',[a.oiAgeMs,b.oiAgeMs]);
 const st=w=>({sig:['oicapBTC','oicapETH'],sigtx:{oicapBTC:'OI '+w+' close)',oicapETH:'OI '+w+' close)'},stale:{}});
 ok(C6.c6Fails(st('(22 Oct'),A).length===0&&C6.c6Fails(st('(23 Oct'),B).length===0,'c6Fails passes the right label at each time');
 ok(C6.c6Fails(st('(22 Oct'),B).join('|')==='C6 oicapBTC: label does not name (23 Oct close)|C6 oicapETH: label does not name (23 Oct close)','the 23:59Z label judged at 00:01Z fails (expectations follow T, not a second clock read)',C6.c6Fails(st('(22 Oct'),B));
 ok(C6.c6Fails({sig:[],sigtx:{},stale:{oicapBTC:{stale:true},oicapETH:{stale:true}}},A).join('|')==='C6 oicapBTC one close back: missing from SIG (should be fresh)|C6 oicapBTC one close back marked stale|C6 oicapETH one close back: missing from SIG (should be fresh)|C6 oicapETH one close back marked stale','missing/stale wording unchanged (same lines as the gate log)');
 ok(/window\.Date=FD/.test(C6.pinClock(A))&&C6.pinClock(A).includes(String(A)),'pinClock pins the page Date to T')}
// ---- static: no wall-clock read left in the C6 path of the gate
{const s=fs.readFileSync(path.join(__dirname,'../qa/stale-captions.js'),'utf8');
 ok(!/Math\.floor\(Date\.now\(\)\/\(24\*H\)\)/.test(s),'stale-captions.js: no Date.now() day boundary for C6');
 ok(/oi_1d:await run\(b,c6fix\(T6\),T6\)/.test(s)&&/C6\.c6Fails\(R\.oi_1d\.state,T6\)/.test(s),'stale-captions.js: C6 fixture, page clock and checks all use T6');
 ok(/const T6=process\.env\.C6_AT\?Date\.parse\(process\.env\.C6_AT\):PAGE_NOW\(\)/.test(s),'T6 = C6_AT or the page clock, read once at start');}
// ---- browser: the real gate's C6 case
const URL=process.env.URL||'http://localhost:8765/index.html';/* same default as every run-all suite */
{
 const env0=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['FREEZE_T0','FREEZE_RECORD','NODE_OPTIONS','C6_AT','C6_PAGE_AT','C6_ONLY'].includes(k)));
 const R=path.join(__dirname,'..');const run=(at,pageAt)=>{const e={...env0,NODE_PATH:env0.NODE_PATH||path.join(__dirname,'node_modules'),C6_ONLY:'1',C6_AT:at,DERIVS_FIXTURE:'qa/fixtures/derivs-stale.json'};if(pageAt)e.C6_PAGE_AT=pageAt;
  const r=spawnSync('node',['-r','./tests/freeze/preload.js','qa/stale-captions.js',URL],{cwd:R,env:e,encoding:'utf8',timeout:300000});return{rc:r.status,out:(r.stdout||'')+(r.stderr||'')}};
 const a=run('2026-10-24T23:59:00Z');ok(a.rc===0&&/C6 only at 2026-10-24T23:59:00\.000Z \(page clock pinned\): 0 failures/.test(a.out),'gate C6 at 23:59Z: fresh, in SIG, label names the right close',a);
 const b=run('2026-10-25T00:01:00Z');ok(b.rc===0&&/C6 only at 2026-10-25T00:01:00\.000Z \(page clock pinned\): 0 failures/.test(b.out),'gate C6 at 00:01Z (after the rollover): passes',b);
 const m=run('2026-10-24T23:59:00Z','2026-10-25T00:01:00Z');ok(m.rc===1&&(m.out.match(/^FAIL C6 /gm)||[]).length===4&&/FAIL C6 oicapBTC one close back: missing from SIG/.test(m.out),'old mixed clocks (fixture 23:59Z, page 00:01Z) reproduce the 45085594889 failure: the check still catches it',m)}
console.log(`tc6clock: ${F.length} FAILS`);console.log(`FAILS: ${F.length}`);process.exit(F.length?1:0);
