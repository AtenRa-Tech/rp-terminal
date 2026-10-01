// Caption sweep gate. Usage: node caption-sweep.js [URL]  (default: live site). Exit 1 = block deploy.
// Generates every caption template for every card from the page's own data and checks it.
const {chromium}=require('playwright-core');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const BANNED=[/\bbuy(ing)? (zone|signal|the dip)\b/i,/\bsell(ing)? (zone|signal)\b/i,/\bvalue zone\b/i,/\bdeepest-value\b/i,/\baccumulat(e|ion)\b/i,/\bfire sale\b/i,/\bsell,? seriously\b/i,/\bevery (cycle|top|bottom)\b/i,/\balways\b/i,/\bnever\b/i,/\bin history\b/i,/\bbest (buy|entry|time)\b/i,/\bguarantee/i,/\bBREAKING\b/,/\bconfirmed\b/i,/\bINR\b|₹|\brupee|\bIndia/i];
const STATUS=/\((?:[^)]*\b(?:busy|failed|429|timeout|error|fallback|pending)\b[^)]*)\)/i;
const BADTOK=/\b(NaN|undefined|null|Infinity)\b|\[object/;
function repeated(t){const w=t.replace(/https?:\/\/\S+/g,' ').toLowerCase().replace(/[^a-z0-9%$. ]/g,' ').split(/\s+/).filter(Boolean);const s=new Set();for(let i=0;i+4<=w.length;i++){const g=w.slice(i,i+4).join(' ');if(s.has(g))return g;s.add(g)}return null}
function nums(t){return (t.match(/[$+−-]?\d[\d,]*\.?\d*\s?(?:%|[kKMBT]\b|×|σ|bp|EH\/s)?/g)||[]).map(x=>x.replace(/[,\s+−-]/g,'').replace(/^\$/,'').replace(/\.$/,''))}
function trivial(n){const v=parseFloat(n);return /^(19|20)\d\d$/.test(n)||(!/[%kMBT×σ.]/.test(n)&&v<=31)||['280','200','365','52','50','100','90','60','128','111','140','350'].includes(n)}
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});
await p.waitForTimeout(8000);
for(const t of ['signals','macro','altseason','news','studio','today']){await p.evaluate(t=>{try{tab(t)}catch(e){}},t);await p.waitForTimeout(4000)}
const rows=await p.evaluate(()=>{const out=[];const ctxs=[];
 (SIG||[]).forEach(s=>ctxs.push([{kind:'sig',id:s.id},s]));(MAC.cards||[]).forEach(s=>ctxs.push([{kind:'mac',id:s.id}]));
 ['btc','eth'].forEach(a=>ctxs.push([{kind:'etf',a}]));ctxs.push([{kind:'alt'}]);ctxs.push([{kind:'dd',a:'BTC'}]);ctxs.push([{kind:'perf',a:'BTC'}]);ctxs.push([{kind:'studio',t:'pulse'}]);
 let cl=[];try{cl=newsClusters()}catch(e){out.push({c:'news',err:String(e)})}
 cl.slice(0,6).forEach(c=>ctxs.push([{kind:'news',n:c.lead}]));
 for(const [c,o] of ctxs){const id=c.kind+':'+(c.id||c.a||c.t||(c.n&&c.n.title)||'');let F;
  try{F=capFacts(c,o)}catch(e){out.push({c:id,err:'capFacts '+e});continue}if(!F){out.push({c:id,err:'null facts'});continue}
  const ref=JSON.stringify(F)+' '+(document.querySelector('[data-id="'+(c.id||'')+'"]')?.innerText||'');
  for(const [st] of STY){CAPT[F.fam][st].forEach((fn,i)=>{let t;try{t=tidy(fn(F));if(t&&typeof t!=='string')t=String(t)}catch(e){t='ERR '+e}
    let lint=[];try{lint=t?lintBanned(t,F.title,F.open):[]}catch(e){}
    out.push({c:id,st,i,t,len:t?(()=>{try{return xLen(t)}catch(e){return t.length}})():0,lint,ref})});
   let pk;try{pk=capPick(F,st,-1,()=>.5);if(pk&&typeof pk!=='string')pk=pk.t||pk.text||pk.cap||JSON.stringify(pk)}catch(e){pk='ERR '+e}out.push({c:id,st,i:'picked',t:pk,len:pk?(()=>{try{return xLen(pk)}catch(e){return pk.length}})():0,lint:[],ref,picked:1})}}
 return out});
await b.close();
const fails=[];
for(const r of rows){if(r.err){fails.push([r.c,'-','-',r.err]);continue}const t=r.t||'';const loc=[r.c,r.st,r.i];
 if(!t){if(r.picked)continue;continue}
 if(/^ERR /.test(t))fails.push([...loc,'template threw: '+t]);
 if(r.len>280)fails.push([...loc,'over 280 ('+r.len+')']);
 if(BADTOK.test(t))fails.push([...loc,'bad token '+t.match(BADTOK)[0]]);
 if(STATUS.test(t))fails.push([...loc,'status text '+t.match(STATUS)[0]]);
 for(const re of BANNED)if(re.test(t))fails.push([...loc,'banned "'+t.match(re)[0]+'"']);
 if(r.lint&&r.lint.length)fails.push([...loc,'app lint: '+r.lint.join(',')]);
 const rp=repeated(t);if(rp)fails.push([...loc,'repeated phrase "'+rp+'"']);
 if(/\blive\b/i.test(t)&&/\b(\d{1,2} \w{3}|close)\b/i.test(t)&&!/\blive[^.]{0,25}\d\d:\d\d ?UTC/i.test(t))fails.push([...loc,'live and close values without labels']);
 const ref=r.ref.replace(/[,\s+−-]/g,'');for(const n of nums(t.replace(/https?:\/\/\S+/g,' '))){if(trivial(n))continue;const core=n.replace(/[%kMBT×σ]|bp|EH\/s/g,'');if(core&&!ref.includes(core))fails.push([...loc,'number '+n+' not on card'])}}
const seen=new Set();const uniq=fails.filter(f=>{const k=f.join('|');return !seen.has(k)&&seen.add(k)});
const n=rows.filter(r=>r.t&&!r.picked).length;
console.log(`caption sweep: ${n} captions, ${uniq.length} failures (${URL})`);
uniq.forEach(f=>console.log(' FAIL',f.join(' | ')));
require('fs').writeFileSync(__dirname+'/caption-sweep.last.json',JSON.stringify({url:URL,at:new Date().toISOString(),captions:n,fails:uniq,rows:rows.map(({ref,...r})=>r)},null,1));
process.exit(uniq.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
