// News replay. "node news-replay.js snap [URL]" saves the page's raw news items to news-replay/<UTC>.json.
// "node news-replay.js run [URL]" feeds every saved snapshot through that build's newsClusters() and diffs
// top-10 order + cluster counts against news-replay/baseline.json (written on first run or with --rebase). Review-only: exit 0 always.
const {chromium}=require('playwright-core');const fs=require('fs');const path=require('path');
const [mode='run',URL='https://atenra-tech.github.io/rp-terminal/']=process.argv.slice(2);const DIR=path.join(__dirname,'news-replay');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(8000);
await p.evaluate(()=>{try{tab('news')}catch(e){}});await p.waitForTimeout(5000);
if(mode==='snap'){const raw=await p.evaluate(()=>({now:Date.now(),news:D.news}));const f=path.join(DIR,new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(f,JSON.stringify(raw));console.log('saved',f,raw.news.length);await b.close();return}
const out={};for(const f of fs.readdirSync(DIR).filter(f=>/^20.*\.json$/.test(f)).sort()){const s=JSON.parse(fs.readFileSync(path.join(DIR,f)));
 out[f]=await p.evaluate(s=>{const RealNow=Date.now;Date.now=()=>s.now;D.news=s.news;let cl=[];try{cl=newsClusters()}finally{Date.now=RealNow}
  return {clusters:cl.length,multi:cl.filter(c=>c.items.length>1).length,top10:cl.slice(0,10).map(c=>Math.round(c.score)+' '+c.lead.title.slice(0,70)+' ['+c.items.length+']')}},s)}
await b.close();const base=path.join(DIR,'baseline.json');
if(!fs.existsSync(base)||process.argv.includes('--rebase')){fs.writeFileSync(base,JSON.stringify(out,null,1));console.log('baseline written for',Object.keys(out).length,'snapshots');return}
const B=JSON.parse(fs.readFileSync(base));let diffs=0;for(const f in out){const a=B[f],c=out[f];if(!a){console.log('NEW',f);continue}
 if(a.clusters!==c.clusters||a.multi!==c.multi){diffs++;console.log(`${f}: clusters ${a.clusters}->${c.clusters}, merged ${a.multi}->${c.multi}`)}
 c.top10.forEach((t,i)=>{if(a.top10[i]!==t){diffs++;console.log(`${f} #${i+1}: ${a.top10[i]||'-'}  =>  ${t}`)}})}
console.log(diffs?diffs+' changes for review':'no ranking changes')})().catch(e=>{console.error(e);process.exit(0)});
