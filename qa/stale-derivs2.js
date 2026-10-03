// CRYPTO GOD stale-derivatives suite v2. Usage: node qa/stale-derivs2.js [URL]
// repo copy (team v2, 3 Oct): require via NODE_PATH, fixture in qa/fixtures, output to tmpdir
// Builds derivs.json fixtures at run time from fixtures/derivs-stale.json by shifting timestamps
// relative to "now", blocks live derivatives feeds, and checks:
//  S1 scores: Opportunity scores + POST NOW count with a stale file == with derivs.json missing
//  S2 boundary: 2h50m old (inside the 3h limit) shows readings; 3h10m old (past) shows none
//  S3 mixed: open interest fresh + funding 4 days old -> OI readings stay, funding readings go
//  S4 confidence: derivative cards' data confidence with stale data < with fresh data (or card absent)
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/derivs-stale.json')));
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i;
const H=36e5;
function lastT(o){let m=0;(function w(x){if(Array.isArray(x)){if(typeof x[0]==='number'&&x[0]>1.7e12)m=Math.max(m,x[0]);x.forEach(w)}else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if((k==='last'||/_t$/.test(k))&&typeof v==='number')m=Math.max(m,v);w(v)}})(o);return m}
function shift(o,d){if(Array.isArray(o)){if(typeof o[0]==='number'&&o[0]>1.7e12)o[0]+=d;o.forEach(x=>shift(x,d))}else if(o&&typeof o==='object')for(const k of Object.keys(o)){if((k==='last'||/_t$/.test(k))&&typeof o[k]==='number'&&o[k]>1.7e12)o[k]+=d;else shift(o[k],d)}return o}
function aged(ageMs){const f=JSON.parse(JSON.stringify(BASE)),now=Date.now();shift(f,now-ageMs-lastT(BASE));f.updated=new Date(now-ageMs).toISOString();return f}
function fundAge(f,age){const now=Date.now();for(const a of Object.values(f.assets)){if(a.funding){const l=lastT(a.funding);shift(a.funding,now-age-l)}if(a.latest?.funding_t)a.latest.funding_t=now-age}return f}
function mixed(){const f=aged(10*60e3),old=4*24*H;for(const a of Object.values(f.assets)){if(a.funding)shift(a.funding,-old);if(a.latest?.funding_t)a.latest.funding_t-=old}return f}
const STRIP=t=>t.replace(/^.*(jumps|surges|plunges|headline).*$/gim,'');
const FUND=[/Funding[^\n]{0,40}neutral/i,/neutral band/i,/funding[^\n]{0,30}[-+]?\d+\.\d{3,}%/i];
const OI=[/OI [-+]?\d+(\.\d+)?%/,/open interest[^\n]{0,40}[-+]?\d+(\.\d+)?/i];
const has=(t,res)=>res.map(r=>STRIP(t).match(r)).filter(Boolean).map(m=>m[0]);
async function run(b,body){const pg=await b.newPage();await pg.setViewport({width:412,height:915});await pg.setRequestInterception(true);
 pg.on('request',r=>{const u=r.url();if(BLOCK.test(u))return r.abort();if(/derivs\.json/.test(u))return body==null?r.respond({status:404,body:''}):r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});r.continue()});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'x='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});await new Promise(r=>setTimeout(r,15000));
 let txt='';for(const t of ['today','markets','signals']){await pg.click(`nav button[data-t="${t}"]`);await new Promise(r=>setTimeout(r,4000));txt+=`\n##${t}\n`+await pg.evaluate(()=>document.body.innerText)}
 const sig=txt.split('##signals')[1]||'',L=sig.split('\n'),scores={};for(let i=1;i<L.length;i++){const m=L[i].match(/^(\d{1,3}) ⓘ$/);if(m&&!scores[L[i-1]])scores[L[i-1]]=+m[1]}
 const post=(sig.match(/(\d+) of (\d+) charts are POST NOW/)||[]).slice(1).join('/');
 // confidence of derivative cards: open each score breakdown
 const conf=await pg.evaluate(async()=>{const out={};const bs=[...document.querySelectorAll('button[data-sb]')].filter(e=>e.offsetParent);
  for(const b of bs){const box=b.parentElement.parentElement;const title=box.innerText.split('\n')[0];if(!/funding|open interest/i.test(title))continue;b.click();await new Promise(r=>setTimeout(r,700));const m=box.innerText.match(/Data confidence\n[^\n]*\n\t(\d{1,3})/);out[title]=m?+m[1]:null;b.click();await new Promise(r=>setTimeout(r,300))}return out});
 await pg.close();return{txt,scores,post,conf}}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const R={};
 for(const [k,f] of [['missing',null],['stale4d',aged(4*24*H)],['inside',aged(2*H+50*60e3)],['past',fundAge(aged(3*H+10*60e3),7*H)],['fund_past',fundAge(aged(30*60e3),12*H+10*60e3)],['mixed',mixed()]])R[k]=await run(b,f);
 await b.close();const fails=[],notes=[];
 const eq=JSON.stringify(R.stale4d.scores)===JSON.stringify(R.missing.scores)&&R.stale4d.post===R.missing.post;
 if(!eq){const diff=Object.keys({...R.stale4d.scores,...R.missing.scores}).filter(k=>R.stale4d.scores[k]!==R.missing.scores[k]).map(k=>`${k}: stale ${R.stale4d.scores[k]??'absent'} vs missing ${R.missing.scores[k]??'absent'}`);fails.push(`S1 scores differ from "derivs missing" (POST NOW ${R.stale4d.post} vs ${R.missing.post}): ${diff.join('; ')}`)}
 const ins=has(R.inside.txt,FUND.concat(OI));if(!ins.length)fails.push('S2 inside-limit (2h50m) shows no derivatives readings');
 // Ruling 3 Oct: each metric's own limit decides (funding 12h; OI and basis 3h). Late file (3h10m) with funding 7h old:
 const po=has(R.past.txt,OI),pf=has(R.past.txt,FUND);if(po.length)fails.push('S2 past-limit OI (3h10m) still shows: '+[...new Set(po)].join(' | '));if(!pf.length)fails.push('S5 late file: funding 7h old (inside 12h) was hidden');
 const fp=has(R.fund_past.txt,FUND);if(fp.length)fails.push('S5 funding 12h10m old (past 12h) still shows: '+[...new Set(fp)].join(' | '));
 for(const k of ['past','fund_past','mixed','stale4d']){const m=R[k].txt.match(/(\d+(?:\.\d+)?)h old \(limit (\d+)h\)/g)||[];for(const x of m){const [,a,l]=x.match(/([\d.]+)h old \(limit (\d+)h\)/);if(+a<=+l)fails.push(`S6 ${k}: contradictory status "${x}"`)}}
 const mf=has(R.mixed.txt,FUND),mo=has(R.mixed.txt,OI);if(mf.length)fails.push('S3 mixed: stale funding still shown: '+[...new Set(mf)].join(' | '));if(!mo.length)fails.push('S3 mixed: fresh open interest was dropped');
 for(const[t,c]of Object.entries(R.stale4d.conf)){const f=R.inside.conf[t];if(c!=null&&f!=null&&!(c<f))fails.push(`S4 "${t}" confidence stale ${c} not below fresh ${f}`)}
 notes.push('POST NOW: missing '+R.missing.post+', stale '+R.stale4d.post+', inside '+R.inside.post);
 fs.writeFileSync(path.join(require('os').tmpdir(),'stale-derivs2.out.json'),JSON.stringify(R,null,1));
 console.log(notes.join('\n'));console.log(fails.length?'FAIL\n- '+fails.join('\n- '):'PASS');process.exit(fails.length?1:0)})();
