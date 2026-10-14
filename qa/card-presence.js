// Card presence (ruling 14 Oct 20:20 IST, blocking): every signal card the app knows must be either live in SIG
// or listed in SIGSTALE with stale:true and a staleWhy. A card that vanishes from both fails.
// Known cards = union of SIGT keys (titles registered by the app) and the 16-card list from 7 Oct.
// Usage: node qa/card-presence.js [URL]. Exit 1 = block.
const {chromium}=require('playwright-core');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
// Rarity-gated cards (buildSignals returns null unless the reading is a >=30-day extreme): rv7/rv30 for BTC/ETH/LINK and linkbtc.
// Their absence is by design, so they are not required.
const GATED=/^(rv\d+(BTC|ETH|LINK)|linkbtc)$/;
const BASE=['mayer','rainbow','ethbtc','2y','wrsi','fundBTC','hash','halv','gold','pi','dd','stable','fundETH','oicapBTC','oicapETH'];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(15000);
const r=await p.evaluate(()=>({sig:(SIG||[]).map(c=>c.id),stale:(typeof SIGSTALE!=='undefined'&&Array.isArray(SIGSTALE)?SIGSTALE:[]).map(c=>({id:c.id,stale:c.stale,why:c.staleWhy})),sigt:typeof SIGT!=='undefined'?Object.keys(SIGT):[]}));await b.close();
const known=[...new Set([...BASE,...r.sigt])].filter(id=>!GATED.test(id)),f=[];
for(const id of known){const st=r.stale.find(s=>s.id===id);if(r.sig.includes(id)){if(st)f.push(id+': in both SIG and SIGSTALE');continue}
 if(!st)f.push(id+': missing from SIG and SIGSTALE (vanished with no stale notice)');else{if(st.stale!==true)f.push(id+': in SIGSTALE without stale:true');if(!st.why)f.push(id+': in SIGSTALE with empty staleWhy')}}
console.log(`card presence: ${known.length} known cards, ${r.sig.length} live, ${r.stale.length} stale, ${f.length} failures`);f.forEach(x=>console.log('FAIL '+x));process.exit(f.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
