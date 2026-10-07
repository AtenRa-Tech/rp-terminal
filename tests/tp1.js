// tp1.js: P1 (7 Oct supervisor): strict caption sweep rules, Hash Ribbons status line once, no 'Noted.', no blank templates,
// funding 'single venue (OKX)' once, BTC history age from candle CLOSE (fixed time), audits footer names the warning, card line text.
// Fails on b479fff-era code, passes on the fix. URL=... [SWEEP=path] node tests/tp1.js
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
// strict sweep rules present (repeated 2+ word clause, blank caption, 'Noted.')
{const src=fs.readFileSync(process.env.SWEEP||path.join(__dirname,'..','qa','caption-sweep.js'),'utf8');let rc=null,B=[];try{const m=src.match(/const BANNED=(\[.*?\]);/);B=eval(m[1]);eval(src.match(/function repClause[^\n]*\n/)[0].replace('function repClause','rc=function'));}catch(e){}
 const REP_OK=[];ok(typeof rc==='function'&&rc('No capitulation. Above 1.0, no capitulation.')==='no capitulation'&&rc('BTC at $1. ETH at $2.')===null&&B.some(re=>re.test('Mid-range. Noted.'))&&/fails\.push\(\[\.\.\.loc,'blank caption'\]\)/.test(src),"sweep: repeated 2+ word clause, blank caption and 'Noted.' all block",{rc:typeof rc})}
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
await pg.waitForFunction(()=>{try{return SIGD&&SIGD.P&&SIG&&SIG.length>8&&MK&&MK.breadth}catch(e){return false}},{timeout:150000}).catch(()=>{});
const r=await pg.evaluate(()=>{const o={};const rep=t=>{const c=t.replace(/https?:\/\/\S+/g,' ').split(/[.,;:()]+/).map(x=>x.trim().toLowerCase().replace(/\s+/g,' ')).filter(x=>x.split(' ').length>=2&&/[a-z]/.test(x));const s=new Set();for(const x of c){if(s.has(x))return x;s.add(x)}return null};
 const all=s=>{const Fx=sigFacts(s);return STY.flatMap(([st])=>CAPT[Fx.fam][st].map((fn,i)=>({st,i,t:tidy(fn(Fx))})))};
 // hash: no-capitulation status said once
 {const s=SIG.find(x=>x.id==='hash');const C=s?all(s):[];o.hash={read:s?.read,bad:C.filter(c=>rep(c.t)||(c.t.match(/no capitulation/gi)||[]).length>1).map(c=>c.t)}}
 // every signal template: non-blank, no 'Noted.'
 {const bl=[],nt=[];for(const s of SIG){let C=[];try{C=all(s)}catch(e){bl.push(s.id+' threw '+e);continue}C.forEach(c=>{if(!c.t||!c.t.trim())bl.push(`${s.id} ${c.st}#${c.i}`);if(/\bNoted\./.test(c.t))nt.push(`${s.id} ${c.st}#${c.i}`)})}o.blank=bl;o.noted=nt}
 // funding analytical: 'single venue' once, no 'rare within that window'
 {const s=SIG.find(x=>/^fund/.test(x.id));o.fund=s?all(s).filter(c=>(c.t.match(/single venue/gi)||[]).length>1||/rare within that window/.test(c.t)).map(c=>c.t):['no funding signal']}
 // history age at a fixed time: last daily candle opened 6 Oct 00:00 UTC, closed 7 Oct 00:00 UTC; at 14:10 UTC 7 Oct the age is 0.6 d
 {const now0=Date.now,P0=SIGD.P;try{Date.now=()=>Date.UTC(2026,9,7,14,10);SIGD.P={...P0,t:[...P0.t.slice(0,-1),Date.UTC(2026,9,6)]};o.age=(freshLine().match(/BTC history age [\d.]+d/)||[''])[0]}catch(e){o.age='ERR '+e}finally{Date.now=now0;SIGD.P=P0}}
 // audits footer names the warning and why
 {const its=todayItems().slice(0,5),keep=its.map(x=>[x.audit,x.auditWhy]);try{its.forEach(x=>{x.audit='ok';x.auditWhy=''});its[1].audit='warn';its[1].auditWhy=audWhy([['ok','fine'],['warn','Robustness: the range measure disagrees (19.0% over 30 days). Name the measure.']]);
   const d=document.createElement('div');d.innerHTML=freshLine();o.aud={txt:(d.textContent.match(/audits[^·]*/)||[''])[0],name:audName(its[1])}}catch(e){o.aud={err:String(e)}}finally{its.forEach((x,i)=>{x.audit=keep[i][0];x.auditWhy=keep[i][1]})}}
 // card line
 {const A=altCalc(),d=document.createElement('div');d.innerHTML=altTodayHTML();o.card={txt:[...d.querySelectorAll('.msw')].map(x=>x.textContent).join(' | '),n:A.avail.filter(Boolean).length,dd:A.domDays,ok:A.domOK,min:ALT.TH.domMin}}
 // pulse movers (7 Oct live rollback): stablecoins / tokenized T-bills excluded; a real sub-0.05% move never prints as 0.0%
 {const T0=D.top;try{const mk=(sym,ch,px=5)=>({id:sym,symbol:sym,name:sym,current_price:px,market_cap:1e9,price_change_percentage_24h:ch});
   D.top=[mk('usyc',.00935,1.14),mk('usdt',.001,1),mk('aaa',4.2),mk('bbb',2.1),mk('ccc',1.4),mk('ddd',-.03),mk('eee',-1.2),mk('fff',-3.3),mk('ggg',.5)];
   const mv=pulseMovers();o.pulse={syms:mv.map(c=>c.symbol),txt:mv.map(c=>mvPct(c.price_change_percentage_24h))}}catch(e){o.pulse={err:String(e)}}finally{D.top=T0}}
 return o});
ok(/No capitulation/.test(r.hash.read||'')?!r.hash.bad.length:true,"hash: 'above 1.0, no capitulation' replaces the status text (said once, no repeated clause)",r.hash);
ok(!r.blank.length,'templates: no blank caption template on any signal card',r.blank);
ok(!r.noted.length,"templates: no 'Noted.'",r.noted);
ok(!r.fund.length,"funding: 'single venue (OKX)' said once; no 'rare within that window' sentence",r.fund);
ok(r.age==='BTC history age 0.6d',"history age measured from candle close: 6 Oct candle at 14:10 UTC 7 Oct = 0.6d",r.age);
ok(!!r.aud&&(r.aud.txt||"").includes(`⚠ ${r.aud.name}: Robustness: the range measure disagrees (19.0% over 30 days).`),"audits footer names the warning chart and its reason",r.aud);
ok(r.card.ok||r.card.txt.includes(`${r.card.n}/6 inputs; dominance excluded, ${r.card.dd}/${r.card.min} days of data`),"card line: 'N/6 inputs; dominance excluded, k/31 days of data' (live count)",r.card);
ok(!!r.pulse.syms&&!r.pulse.syms.some(x=>/usyc|usdt/.test(x))&&r.pulse.syms.join()==='aaa,bbb,ccc,fff,eee,ddd'&&!r.pulse.txt.some(t=>/^[+−-]?0\.0%$/.test(t))&&r.pulse.txt.includes('-0.03%'),"pulse movers: stablecoins/T-bill tokens excluded; sub-0.05% move keeps 2 decimals (no lone 0.0%)",r.pulse);
ok(!errs.length,'no page errors',errs.slice(0,3));
console.log('FAILS:',F.length,JSON.stringify(F));await b.close();process.exit(F.length?1:0)})();
