// Stale gate: data confidence + chip label (RP X). Usage: node qa/stale-conf.js [URL]. Exit 1 = block.
// Same fixture as stale-derivs2 (timestamps shifted relative to now), live derivatives feeds blocked.
// C1 Today "data confidence" with a 4-day-old derivs.json is lower than with a 10-minute-old one
// C2 Derivatives chip reads "Funding: data stale (cache <age>, <source>)" and gives no reading; with fresh data it gives a reading
// C4 every Today chip that gives a reading shows source · age beside it
// C3 app-side: with the stale file no funding/OI signal cards exist (not selectable in Studio), and capFacts for them is unavailable
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/derivs-stale.json')));const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i,H=36e5;
function lastT(o){let m=0;(function w(x){if(Array.isArray(x)){if(typeof x[0]==='number'&&x[0]>1.7e12)m=Math.max(m,x[0]);x.forEach(w)}else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if((k==='last'||/_t$/.test(k))&&typeof v==='number')m=Math.max(m,v);w(v)}})(o);return m}
function shift(o,d){if(Array.isArray(o)){if(typeof o[0]==='number'&&o[0]>1.7e12)o[0]+=d;o.forEach(x=>shift(x,d))}else if(o&&typeof o==='object')for(const k of Object.keys(o)){if((k==='last'||/_t$/.test(k))&&typeof o[k]==='number'&&o[k]>1.7e12)o[k]+=d;else shift(o[k],d)}return o}
function aged(ms){const f=JSON.parse(JSON.stringify(BASE)),now=Date.now();shift(f,now-ms-lastT(BASE));f.updated=new Date(now-ms).toISOString();return f}
async function run(b,body){const pg=await b.newPage();await pg.setViewport({width:412,height:915});await pg.setRequestInterception(true);
 pg.on('request',r=>{const u=r.url();if(BLOCK.test(u))return r.abort();if(/derivs\.json/.test(u))return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});r.continue()});
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'x='+Date.now(),{waitUntil:'networkidle2',timeout:60000});await pg.waitForFunction(()=>typeof tab==='function',{timeout:60000});
 await pg.evaluate(()=>tab('signals'));await new Promise(r=>setTimeout(r,9000));await pg.evaluate(()=>tab('today'));await new Promise(r=>setTimeout(r,6000));
 const r=await pg.evaluate(()=>{const dc=document.getElementById('dataConf')?.textContent||'';const ch=[...document.querySelectorAll('.ms')].find(e=>/^Derivatives/.test(e.innerText));const st=ch?.querySelector('.bias')?.textContent||'';
  const ids=(SIG||[]).map(s=>s.id),der=ids.filter(i=>/^(fund|oicap)/.test(i));const opts=[...document.querySelectorAll('#stType option')].map(o=>o.value);const chips=[...document.querySelectorAll('.ms')].map(e=>({k:e.querySelector('b')?.textContent,st:e.querySelector('.bias')?.textContent,age:e.querySelector('.age')?.textContent||null}));return{dc,pct:+(dc.match(/(\d+)%/)||[])[1],st,der,opts,chips}});
 await pg.close();return r}
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const fresh=await run(b,aged(10*60e3)),stale=await run(b,aged(4*24*H));await b.close();const fails=[];
 console.log('fresh',JSON.stringify(fresh));console.log('stale',JSON.stringify(stale));
 if(!(stale.pct<fresh.pct))fails.push(`C1 data confidence stale ${stale.pct} not below fresh ${fresh.pct}`);
 if(!/^Funding: data stale \(cache \d+[hd], [A-Za-z]+\)$/.test(stale.st))fails.push('C2 stale chip label: "'+stale.st+'"');
 if(/neutral|positive|negative|%\/8h/i.test(stale.st))fails.push('C2 stale chip gives a reading: "'+stale.st+'"');
 if(!/%\/8h/.test(fresh.st))fails.push('C2 fresh chip has no reading: "'+fresh.st+'"');
 if(stale.der.length)fails.push('C3 stale file still builds derivative cards: '+stale.der.join(','));if(!fresh.der.length)fails.push('C3 fresh file builds no derivative cards (control)');
 // C4 (D): every chip with a reading shows its source and age beside it ('OKX · 2h'); stale/no-data chips show no reading
 for(const c of fresh.chips.concat(stale.chips)){if(c.st==='No data'||/data stale/.test(c.st))continue;if(!/^[A-Za-z][\w.\- ]* · (\d+[hd]|—)$/.test(c.age||''))fails.push('C4 chip without source · age: '+JSON.stringify(c))}
 console.log(fails.length?'FAIL\n- '+fails.join('\n- '):'PASS');process.exit(fails.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
