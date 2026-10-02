// tgate.js — QA3 deploy-gate design: news captions from the saved replay snapshots are BLOCKING; live news captions are warnings only.
// Run 1: a replay snapshot containing a headline with a banned lean word must block (exit 1). Run 2: clean replay set, live news on -> exit 0 even if live news warns.
const {execFileSync}=require('child_process');const fs=require('fs'),os=require('os'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const SW=path.join(__dirname,'..','qa','caption-sweep.js'),RD=path.join(__dirname,'..','qa','news-replay');
const snaps=fs.readdirSync(RD).filter(f=>/^20.*\.json$/.test(f)).sort();const base=JSON.parse(fs.readFileSync(path.join(RD,snaps.at(-1))));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gate-'));const bad={...base,news:[...['CoinDesk','The Block','Decrypt','Cointelegraph'].map((src,i)=>({...base.news[0],title:'Zentry raises $2 billion in record token sale led by major funds',desc:'Analysts called the setup bullish for the token over the coming weeks after the raise closed on Friday.',src,link:'https://example.com/z'+i,t:base.now-(10+i)*6e4})),...base.news]};
fs.writeFileSync(path.join(tmp,'2099-01-01T00-00-00-000Z.json'),JSON.stringify(bad));
const run=(env,args)=>{try{const o=execFileSync('node',[SW,URL,...args],{env:{...process.env,...env},encoding:'utf8',timeout:600000});return{rc:0,o}}catch(e){return{rc:e.status,o:String(e.stdout||'')}}};
let f=0;const r1=run({RDIR:tmp},['--no-live-news']);const ok1=r1.rc===1&&/FAIL news@2099/.test(r1.o);console.log((ok1?'PASS':'FAIL')+' GATE_replay_news_blocks rc='+r1.rc+' '+(r1.o.split('\n')[0]||''));if(!ok1)f++;
const r2=run({},[]);const ok2=r2.rc===0&&/0 blocking failures/.test(r2.o);console.log((ok2?'PASS':'FAIL')+' GATE_live_news_warn_only rc='+r2.rc+' '+(r2.o.split('\n')[0]||''));if(!ok2)f++;
console.log('FAILS: '+f);process.exit(f?1:0);
