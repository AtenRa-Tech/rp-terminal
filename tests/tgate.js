// tgate.js — QA3 deploy-gate design: news captions from the saved replay snapshots are BLOCKING; live news captions are warnings only.
// Run 1: a replay snapshot containing a headline with a banned call must block (exit 1). Run 1b: banned lean word ONLY in the outlet summary ->
// the summary is dropped from every caption, the headline still goes out, the sweep passes (exit 0). Run 2: clean replay set, live news on -> exit 0 even if live news warns.
const {execFileSync}=require('child_process');const fs=require('fs'),os=require('os'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const SW=path.join(__dirname,'..','qa','caption-sweep.js'),RD=path.join(__dirname,'..','qa','news-replay');
const snaps=fs.readdirSync(RD).filter(f=>/^20.*\.json$/.test(f)).sort();const base=JSON.parse(fs.readFileSync(path.join(RD,snaps.at(-1))));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gate-'));const bad={...base,news:[...['CoinDesk','The Block','Decrypt','Cointelegraph'].map((src,i)=>({...base.news[0],title:'Zentry token about to explode after $2 billion record token sale',desc:'Analysts called the setup bullish for the token over the coming weeks after the raise closed on Friday.',src,link:'https://example.com/z'+i,t:base.now-(10+i)*6e4})),...base.news]};
fs.writeFileSync(path.join(tmp,'2099-01-01T00-00-00-000Z.json'),JSON.stringify(bad));
const run=(env,args)=>{try{const o=execFileSync('node',[SW,URL,...args],{env:{...process.env,...env},encoding:'utf8',timeout:600000});return{rc:0,o}}catch(e){return{rc:e.status,o:String(e.stdout||'')}}};
let f=0;const r1=run({RDIR:tmp},['--no-live-news']);const ok1=r1.rc===1&&/FAIL news@2099/.test(r1.o);console.log((ok1?'PASS':'FAIL')+' GATE_replay_news_blocks rc='+r1.rc+' '+(r1.o.split('\n')[0]||''));if(!ok1)f++;
// 1b: banned word only in the outlet summary (clean headline)
const SUM='Analysts called the setup bullish for the token over the coming weeks after the raise closed on Friday.',HL='Zentry raises $2 billion in record token sale led by major funds';
const tmp2=fs.mkdtempSync(path.join(os.tmpdir(),'gate2-'));const bad2={...base,news:[...['CoinDesk','The Block','Decrypt','Cointelegraph'].map((src,i)=>({...base.news[0],title:HL,desc:SUM,src,link:'https://example.com/y'+i,t:base.now-(10+i)*6e4})),...base.news]};
fs.writeFileSync(path.join(tmp2,'2099-01-01T00-00-00-000Z.json'),JSON.stringify(bad2));
const r1b=run({RDIR:tmp2},['--no-live-news']);const ok1b=r1b.rc===0&&!/FAIL news@2099/.test(r1b.o);console.log((ok1b?'PASS':'FAIL')+' GATE_summary_only_dropped_sweep_passes rc='+r1b.rc+' '+(r1b.o.split('\n')[0]||''));if(!ok1b)f++;
const r2=run({},[]);const ok2=r2.rc===0&&/0 blocking failures/.test(r2.o);console.log((ok2?'PASS':'FAIL')+' GATE_live_news_warn_only rc='+r2.rc+' '+(r2.o.split('\n')[0]||''));if(!ok2)f++;
(async()=>{const p=require('puppeteer-core');const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});await pg.waitForFunction(()=>typeof newsFacts==='function'&&typeof CAPT!=='undefined',{timeout:90000}).catch(()=>{});
 const r=await pg.evaluate(({HL,SUM,t})=>{const n={src:'CoinDesk',title:HL,desc:SUM,link:'https://example.com/y',t};const keep=D.news;D.news=[n];try{const F=newsFacts(n),caps=[];for(const st of ['simple','analytical','ct'])CAPT.news[st].forEach(fn=>{try{caps.push(tidy(fn(F)))}catch(e){caps.push('ERR '+e)}});
  return{desc1:F.desc1,n:caps.length,withSum:caps.filter(c=>/bullish|Analysts called/i.test(c)).length,withHL:caps.filter(c=>c.includes(HL.slice(0,30))||c.includes(F.short||'@@')).length,lint:caps.map(c=>lintBanned(c,F.title,false).filter(x=>/^Banned|^Regional/.test(x))).filter(x=>x.length).length}}finally{D.news=keep}},{HL,SUM,t:base.now});
 const ok3=r.desc1===''&&r.n>=8&&r.withSum===0&&r.withHL===r.n&&r.lint===0;console.log((ok3?'PASS':'FAIL')+' GATE_summary_dropped_headline_kept '+JSON.stringify(r));if(!ok3)f++;
 await b.close();console.log('FAILS: '+f);process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
