// oicap label check (ruling 8 Oct 02:01 IST). Usage: node qa/oicap-label.js [URL]. Exit 1 = block.
// Both oicap lines (SIGT description and card src) name one formula, "open interest (coins) ... ÷ circulating supply", and the same date.
// Expected src (ruling 8 Oct 02:03 IST): "OKX open interest (coins) at 00:00 UTC <D Mon YYYY> (<D Mon> close) ÷ circulating supply[ (supply as of <date>)]", <D Mon YYYY> = lastT + 1 day, close = lastT.
// No "today's" in any line of any signal card (title, description, read, src, why, captions).
const {chromium}=require('playwright-core');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+'?v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(9000);
const r=await p.evaluate(()=>SIG.map(c=>({id:c.id,title:c.title,read:c.read,src:c.src,why:typeof c.why==='string'?c.why:'',cap:JSON.stringify(c.cap||''),lastT:c.lastT,desc:(SIGT[c.id]||[])[1]||''})));await b.close();
const f=[],M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],dU=t=>{const d=new Date(t);return d.getUTCDate()+' '+M[d.getUTCMonth()]+' '+d.getUTCFullYear()};
for(const c of r){for(const k of ['title','desc','read','src','why','cap'])if(/\btoday'?s\b/i.test(c[k]||''))f.push(c.id+' '+k+': says "today\'s": '+String(c[k]).slice(0,140));
 if(!/^oicap/.test(c.id))continue;
 if(/market cap/i.test(c.src)||!/÷ circulating supply/.test(c.src))f.push(c.id+' src: formula must be "÷ circulating supply": '+c.src);
 if(/market cap/i.test(c.desc)||!/÷ circulating supply/.test(c.desc))f.push(c.id+' description: formula must be "÷ circulating supply": '+c.desc);
 const want=c.lastT?dU(c.lastT+864e5):null,m=c.src.match(/open interest \(coins\) at 00:00 UTC (\d{1,2} [A-Z][a-z]{2} \d{4}) \((\d{1,2} [A-Z][a-z]{2})(?: \d{4})? close\) ÷ circulating supply/);
 if(!m)f.push(c.id+' src: missing "open interest (coins) at 00:00 UTC <D Mon YYYY> (<D Mon> close) ÷ circulating supply": '+c.src);else{if(want&&m[1]!==want)f.push(c.id+' src: date '+m[1]+' but card data ends at 00:00 UTC '+want);const cl=c.lastT?dU(c.lastT).replace(/ \d{4}$/,''):null;if(cl&&m[2]!==cl)f.push(c.id+' src: "('+m[2]+' close)" but the close is '+cl)}
 const dd=(c.desc.match(/\d{1,2} [A-Z][a-z]{2}(?: \d{4})?/g)||[]).filter(x=>!/supply as of/.test(c.desc.slice(Math.max(0,c.desc.indexOf(x)-16),c.desc.indexOf(x))));
 if(m)dd.forEach(x=>{if(!m[1].startsWith(x))f.push(c.id+' description: date '+x+' differs from src date '+m[1])})}
console.log('oicap label: '+r.length+' signal cards, '+f.length+' failures');f.forEach(x=>console.log('FAIL '+x));process.exit(f.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
