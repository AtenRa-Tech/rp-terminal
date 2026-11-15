// tnyse.js (15 Nov ruling): ONE NYSE trading-day calendar, shared/nyse.js, used by the page's ETF line (inlined in index.html), tests/tsmoke.js bizDays
// and (via the twin scripts/nyse.py, tests/tnyse.py) the stale alarm. NYSE holidays only: Veterans Day and Columbus Day are trading days.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const ROOT=path.join(__dirname,'..'),SRC=fs.readFileSync(path.join(ROOT,'shared/nyse.js'),'utf8'),HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),N=require('../shared/nyse.js');
const T=s=>Date.parse(s),H=y=>new Set(N.holidays(y));
// required calendar cases
ok(!N.open('2027-03-26')&&H(2027).has('2027-03-26'),'Good Friday 2027 (Fri 26 Mar) is skipped',N.holidays(2027));
ok(!N.open('2026-11-26')&&!N.open('2027-11-25')&&N.open('2026-11-27'),'Thanksgiving (26 Nov 2026, 25 Nov 2027) is skipped; the Friday after trades');
ok(N.bizDays(T('2026-12-24'),T('2026-12-29T00:00:00Z'))===2&&N.bizDays(T('2026-12-24'),T('2026-12-29T23:59:00Z'))===2,'24 Dec -> 29 Dec 2026 counts 2 trading days (Christmas Fri 25 Dec skipped)',N.bizDays(T('2026-12-24'),T('2026-12-29T00:00:00Z')));
ok(N.open('2026-11-11')&&N.bizDays(T('2026-11-10'),T('2026-11-11T12:00:00Z'))===1&&N.open('2026-10-12'),'Veterans Day 11 Nov 2026 (and Columbus Day 12 Oct) count as trading days');
ok(!N.open('2027-06-18')&&!H(2027).has('2027-06-19'),'Juneteenth 2027 on a Saturday: Fri 18 Jun 2027 is skipped');
ok(N.open('2027-12-31')&&!H(2027).has('2027-12-31')&&!H(2028).has('2028-01-01')&&N.bizDays(T('2027-12-30'),T('2028-01-03T12:00:00Z'))===2,'New Year 2028 on a Saturday: Fri 31 Dec 2027 is a trading day, no make-up closure');
ok(!N.open('2027-07-05')&&H(2027).has('2027-07-05')&&!N.open('2026-07-03'),'Sunday holiday observed Monday (4 Jul 2027 -> Mon 5 Jul skipped); Saturday 4 Jul 2026 -> Fri 3 Jul skipped');
ok(N.holidays(2026).length===10&&N.holidays(2028).length===9,'10 NYSE holidays in 2026; 9 in 2028 (New Year on Saturday is not observed)',[N.holidays(2026),N.holidays(2028)]);
ok(N.bizH(T('2026-12-25'),T('2026-12-29T00:00:00Z'))===24&&N.bizH(T('2026-11-11'),T('2026-11-12T00:00:00Z'))===24,'bizH counts only NYSE trading hours (Christmas + weekend 0, Veterans Day 24)');
// one source of truth: the page inlines the file verbatim and uses NYSE.bizH; the smoke's bizDays is NYSE.bizDays
const m=HTML.match(/\/\/ nyse:begin[^\n]*\n([\s\S]*?)\/\/ nyse:end\n/);
ok(m&&m[1]===SRC,'index.html inlines shared/nyse.js verbatim between nyse:begin/nyse:end');
const OUT=m?HTML.replace(m[0],''):HTML;ok(/const bizH=NYSE\.bizH;/.test(OUT)&&(OUT.match(/const bizH=/g)||[]).length===1,'index.html: the only bizH is NYSE.bizH (no weekday-only copy)');
ok(HTML.split('\n').filter(l=>/bizH\(/.test(l)).every(l=>!/usHol|bizDays\(/.test(l)),'ETF lines (bizH callers) do not use the bond calendar usHol');
{const E=(l,h,top)=>({last_date:top||l,datasets:{btc:{days:[{date:l,pending:false,total:-95},...(h?[{date:h,pending:true,total:null}]:[])]},eth:{days:[{date:l,pending:false,total:-1.3}]}}});
 const a=N.etfLast(E('2026-11-10','2026-11-11','2026-11-11')),b=N.etfLast(E('2026-11-10')),c=N.etfLast({last_date:'2026-11-09'});
 ok(a.last==='2026-11-10'&&a.held==='2026-11-11'&&b.last==='2026-11-10'&&b.held===null&&c.last==='2026-11-09','etfLast: last complete day = newest non-pending row; the pending newest row is held back, never counted',{a,b,c})}
const sm=require('./tsmoke.js');
{const c=[['2026-11-13','2026-11-15T12:00:00Z',0,true],['2026-11-13','2026-11-17T12:00:00Z',2,true],['2026-11-13','2026-11-18T12:00:00Z',3,false],['2026-11-25','2026-11-27T12:00:00Z',1,true]].map(([l,n,bd,g])=>{const L=sm.etfLast({last_date:l,updated:g?'2026-10-01T00:00:00Z':n,datasets:{btc:{days:[{date:l,pending:false,total:1}]}}}),b=sm.bizDays(Date.parse(L.last+'T00:00:00Z'),Date.parse(n));return [l,n,b,b===bd&&(b<=2)===g]});ok(c.every(x=>x[3]),'smoke on the CRYPTO GOD fixtures (limit 2, from last_date, updated ignored): 13 Nov->15 Nov 0 green, ->17 Nov 2 green, ->18 Nov 3 red; 25 Nov->27 Nov 1 green',c)}
ok(sm.NYSE===N&&typeof sm.etfLast==='function'&&sm.etfLast({last_date:'2026-11-09'}).last==='2026-11-09','tsmoke.js requires shared/nyse.js (same module object) and exports etfLast');
{const c=[];for(let a=T('2024-01-01');a<T('2031-01-01');a+=7*864e5+5*36e5){const b=a+((a/864e5)%11+1)*864e5;if(sm.bizDays(a,b)!==N.bizDays(a,b))c.push([a,b])}ok(!c.length,'smoke bizDays equals NYSE.bizDays on 2024-2030 samples',c.slice(0,3))}
(async()=>{
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return typeof etfStale==='function'&&typeof NX==='object'}catch(e){return false}},{timeout:150000});
 const r=await pg.evaluate(()=>{const o={same:bizH===NYSE.bizH,hol:NYSE.holidays(2027)},real=Date.now,keep=NX.etf;
  const st=(ld,now)=>{NX.etf={...(keep||{}),last_date:ld};Date.now=()=>Date.parse(now);try{return etfStale()}finally{Date.now=real}};
  try{o.xmas=st('2026-12-24','2026-12-29T12:00:00Z');o.xmas2=st('2026-12-24','2026-12-31T00:30:00Z');o.vet=st('2026-11-10','2026-11-13T00:30:00Z');o.vet2=st('2026-11-10','2026-11-12T23:30:00Z');o.gf=st('2027-03-24','2027-03-29T23:00:00Z');o.cg=[['2026-11-13','2026-11-15T12:00:00Z'],['2026-11-13','2026-11-17T12:00:00Z'],['2026-11-13','2026-11-18T12:00:00Z'],['2026-11-25','2026-11-27T12:00:00Z']].map(([l,n])=>st(l,n))}finally{NX.etf=keep;Date.now=real;try{etfStale()}catch(e){}}return o});
 ok(r.same,'page: bizH used by etfStale/renderEtf is NYSE.bizH',r);
 ok(JSON.stringify(r.hol)===JSON.stringify(N.holidays(2027)),'page NYSE holidays equal shared/nyse.js (2027)',r.hol);
 ok(r.xmas===false&&r.xmas2===true,'page ETF line: last 24 Dec 2026 is fresh on 29 Dec 12:00Z (Christmas skipped), stale on 31 Dec 00:30Z',r);
 ok(r.vet2===false&&r.vet===true,'page ETF line: Veterans Day counts (last 10 Nov 2026: fresh 12 Nov 23:30Z, stale 13 Nov 00:30Z)',r);
 ok(r.gf===false,'page ETF line: Good Friday 2027 skipped (last Wed 24 Mar, fresh Mon 29 Mar 23:00Z)',r);
 ok(JSON.stringify(r.cg)==='[false,false,true,false]','page ETF line on the CRYPTO GOD fixtures: 15 Nov/17 Nov fresh, 18 Nov stale (last 13 Nov); 27 Nov fresh (last 25 Nov, Thanksgiving skipped)',r.cg);
 ok(!errs.length,'no page errors',errs.slice(0,3));await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
