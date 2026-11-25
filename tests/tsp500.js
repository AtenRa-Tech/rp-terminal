// tsp500.js (25 Nov supervisor ruling): the app judges SP500 in NYSE trading days (NYSE.bizDays, like the ETF line), limit FRESHNESS.sp500_trading_days (3),
// not 5 calendar days. Same cases as tests/tsp500.py (incident 25 Nov 01:18Z, Thanksgiving week, stalled series), same counts as scripts/nyse.py via runs_log.py.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,900):''));if(!c)F.push(n)};
const ROOT=path.join(__dirname,'..'),FR=JSON.parse(fs.readFileSync(path.join(ROOT,'shared/freshness.json'),'utf8'));
// [last_date, now, trading days, fresh?, label]
const C=[['2026-11-20','2026-11-25T01:18:00Z',3,true,'incident: Wed 25 Nov 01:18Z, last Fri 20 Nov (Mon+Tue+Wed)'],['2026-11-23','2026-11-25T01:18:00Z',2,true,'Wed 25 Nov, last Mon 23 Nov'],
 ['2026-11-25','2026-11-30T01:00:00Z',2,true,'Mon 30 Nov 01Z, last Wed 25 (Fri 27 + Mon 30; Thu closed)'],['2026-11-25','2026-12-01T01:00:00Z',3,true,'Tue 1 Dec 01Z, last Wed 25 (3, at the limit)'],
 ['2026-11-27','2026-12-01T01:00:00Z',2,true,'Tue 1 Dec 01Z, last Fri 27'],['2026-11-24','2026-11-26T01:00:00Z',1,true,'Thanksgiving Thu 26, last Tue 24'],
 ['2026-11-18','2026-11-25T01:18:00Z',5,false,'stalled: last Wed 18 on 25 Nov'],['2026-11-19','2026-11-25T01:18:00Z',4,false,'stalled: last Thu 19 on 25 Nov'],
 ['2026-11-20','2026-11-27T12:00:00Z',4,false,'stalled: last Fri 20 on Fri 27 Nov'],['2026-11-25','2026-12-02T01:00:00Z',4,false,'stalled: last Wed 25 on Wed 2 Dec']];
const py=JSON.parse(execFileSync('python3',['-c',`import sys,json,datetime as d;sys.path.insert(0,'${ROOT}/scripts');sys.argv=['x'];import runs_log as r
C=json.loads(${JSON.stringify(JSON.stringify(C))})
ms=lambda s:int(d.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
print(json.dumps([r.macro_fresh({"series":{"SP500":{"freq":"Daily","last_date":a,"points":[[a,1]]}}},ms(n))["SP500"] for a,n,*_ in C]))`]).toString());
(async()=>{
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return MAC.M&&MAC.cards&&MAC.cards.length}catch(e){return false}},{timeout:150000}).catch(()=>{});await new Promise(r=>setTimeout(r,5000));
 const r=await pg.evaluate((C)=>{const real=Date.now,o={lim:NYSED.lim,ids:NYSED.ids,inl:FRESHNESS.sp500_trading_days,rows:[],ser:[]};
  const mk=(id,last)=>({...MAC.M,failed:[],series:{...MAC.M.series,[id]:{...(MAC.M.series[id]||{title:id,source:'FRED '+id,freq:'Daily',points:[[last,1],[last,1]]}),freq:'Daily',last_date:last,points:MAC.M.series[id]?.points?.length?MAC.M.series[id].points:[[last,1],[last,1]]}}});
  for(const [a,n] of C){Date.now=()=>Date.parse(n);try{const M=mk('SP500',a),f=fresh('SP500',M);const s=ser('SP500',M);o.rows.push({bd:f.bd,st:f.st,over:f.over,unit:f.unit,limT:f.limT,why:f.why,ageT:f.ageT});o.ser.push(s?'series':'null:'+(STALEM['macro SP500']?.limT||''))}finally{Date.now=real}}
  Date.now=()=>Date.parse('2026-11-25T01:18:00Z');try{const M=mk('RRPONTSYD','2026-11-23'),M2=mk('RRPONTSYD','2026-11-19');o.rrp=[fresh('RRPONTSYD',M).st,fresh('RRPONTSYD',M2).st,fresh('RRPONTSYD',M).lim];o.fed=fresh('DGS10',mk('DGS10','2026-11-20')).limT}finally{Date.now=real}
  o.nDays=[typeof nDays==='function',typeof nDays==='function'&&nDays(1,'NYSE trading'),typeof nDays==='function'&&nDays(2,'NYSE trading'),typeof nDays==='function'&&nDays(1,'US business'),typeof nDays==='function'&&nDays(2,'US business')];
  const W=[['SP500','2026-11-24','2026-11-26T01:00:00Z','1 NYSE trading day old'],['SP500','2026-11-23','2026-11-25T01:18:00Z','2 NYSE trading days old'],['DGS10','2026-10-02','2026-10-05T12:00:00Z','1 US business day old'],['DGS10','2026-10-05','2026-10-07T10:30:00Z','2 US business days old']];
  o.word=[];for(const [id,a,n,want] of W){Date.now=()=>Date.parse(n);try{const M=mk(id,a),f=fresh(id,M),x=M.series[id];const line=`${x.title}: last data ${x.last_date} (${f.bd!=null?`${f.ageT}; ${f.unit?'daily S&P 500 data':'daily Fed data'} allows ${f.limT}`:''})`;o.word.push({id,bd:f.bd,ageT:f.ageT,want,line,ok:f.ageT===want&&line.includes('('+want+';')})}finally{Date.now=real}}
  return o},C);
 ok(r.lim===FR.sp500_trading_days&&r.lim===3&&r.inl===3&&r.ids.length===1&&r.ids[0]==='SP500','app: NYSED = SP500, limit 3 = shared/freshness.json sp500_trading_days (inline FRESHNESS)',r);
 C.forEach((c,i)=>{const w=r.rows[i],pyr=py[i];ok(w.bd===c[2]&&w.st===!c[3]&&w.unit==='NYSE trading days'&&w.limT==='3 NYSE trading days',`app SP500 ${c[4]} -> ${c[2]} trading days, ${c[3]?'fresh (PASS)':'stale (FAIL)'}`,w);
  ok(pyr.biz_days===w.bd&&pyr.ok===c[3],`app and runs_log.py (scripts/nyse.py) agree: ${c[4]}`,{app:w,py:pyr});
  ok(c[3]?r.ser[i]==='series':r.ser[i]==='null:3 NYSE trading days',`app: ser('SP500') ${c[3]?'returns the series':'is withheld and labelled "past 3 NYSE trading days limit"'} (${c[4]})`,r.ser[i])});
 C.forEach((c,i)=>{const w=r.rows[i],want=c[2]+' NYSE trading '+(c[2]===1?'day':'days')+' old';ok(w.ageT===want,`app SP500 ageT at count ${c[2]} is '${want}' (${c[4]})`,w)});
 ok(r.nDays[0]&&r.nDays[1]==='1 NYSE trading day'&&r.nDays[2]==='2 NYSE trading days'&&r.nDays[3]==='1 US business day'&&r.nDays[4]==='2 US business days','app nDays: count 1 is singular day, count 2 is plural days (SP500 and Fed)',r.nDays);
 r.word.forEach(w=>ok(w.ok,`audit/freshness line: ${w.id} count ${w.bd} reads '${w.want}'`,w));
 ok(r.rrp[0]===false&&r.rrp[1]===true&&r.rrp[2]===5&&r.fed==='3 US business days','app: RRPONTSYD (other daily) keeps 5 calendar days; Fed H.15 keeps 3 US business days',r);
 {const sm=require('./tsmoke.js'),T=x=>Date.parse(x);ok(sm.SP500_DAYS===3&&C.every(c=>{const f=sm.sp500Fresh(c[0],T(c[1]));return f.biz===c[2]&&f.ok===c[3]}),'smoke (tsmoke.js sp500Fresh) gives the same counts and verdicts on every case above; limit from shared/freshness.json',C.map(c=>sm.sp500Fresh(c[0],T(c[1]))));
  ok(!sm.sp500Fresh(null).ok&&!sm.sp500Fresh(undefined).ok,'smoke: SP500 without last_date fails');
  ok(/^macro [A-Z0-9]+ within /.test('macro SP500 within 3 NYSE trading days'),'smoke check name keeps the "macro <ID> within" shape, so the narrow no-rollback ruling treats it as a data-age check')}
 ok(!errs.length,'no page errors',errs.slice(0,3));await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
