// Caption sweep gate. Usage: node caption-sweep.js [URL] [--no-live-news]  (default URL: live site). Exit 1 = block deploy.
// QA3 gate design: BLOCKING = every non-news card on the build's live data + news captions generated from the saved replay snapshots
// (qa/news-replay/*.json, frozen, so an outlet headline can't block a deploy). Live news captions are swept too but only reported as WARN.
// Generates every caption template for every card from the page's own data and checks it.
const {chromium}=require('playwright-core');
const ARGS=process.argv.slice(2),URL=ARGS.find(a=>!a.startsWith('--'))||'https://atenra-tech.github.io/rp-terminal/',LIVENEWS=!ARGS.includes('--no-live-news');
const fs0=require('fs'),RDIR=process.env.RDIR||(__dirname+'/news-replay'),SNAPS=fs0.existsSync(RDIR)?fs0.readdirSync(RDIR).filter(f=>/^20.*\.json$/.test(f)).sort().map(f=>({f,...JSON.parse(fs0.readFileSync(RDIR+'/'+f))})):[];
const BANNED=[/\bnoted\.?$|\bNoted\./,/\bhistorically\b/i,/\blooks? fine\b/i,/\bbuy(ing)? (zone|signal|the dip)\b/i,/\bsell(ing)? (zone|signal)\b/i,/\bvalue zone\b/i,/\bdeepest-value\b/i,/\baccumulat(e|ion)\b/i,/\bfire sale\b/i,/\bsell,? seriously\b/i,/\bevery (cycle|top|bottom)\b/i,/\balways\b/i,/\bnever\b/i,/\bin history\b/i,/\bbest (buy|entry|time)\b/i,/\bguarantee/i,/\bBREAKING\b/,/\bconfirmed\b/i];// regional + rule-1 call/lean lists are NOT duplicated here: they are read from the app's own RPT_WORDS (one source of truth, also used by the news filter and the draft audit)
const STATUS=/\((?:[^)]*\b(?:busy|failed|429|timeout|error|fallback|pending)\b[^)]*)\)/i;
const BADTOK=/\b(NaN|undefined|null|Infinity)\b|\[object/;
function repeated(t){const w=t.replace(/https?:\/\/\S+/g,' ').toLowerCase().replace(/[^a-z0-9%$. ]/g,' ').split(/\s+/).filter(Boolean);const s=new Set();for(let i=0;i+4<=w.length;i++){const g=w.slice(i,i+4).join(' ');if(s.has(g))return g;s.add(g)}return null}
// Crypto News GOD's stricter rule (7 Oct): split at punctuation; any clause of 2+ words that appears twice fails. Do NOT loosen it:
// a legitimate repeat goes on REP_OK with a reason (supervisor reviews every entry).
function repClause(t){const c=t.replace(/https?:\/\/\S+/g,' ').split(/[.,;:()]+/).map(x=>x.trim().toLowerCase().replace(/\s+/g,' ')).filter(x=>x.split(' ').length>=2&&/[a-z]/.test(x));const s=new Set();for(const x of c){if(s.has(x)&&!REP_OK.some(([re])=>re.test(x)))return x;s.add(x)}return null}
const REP_OK=[/* [regex, 'reason'] — empty: no repeat is allowed today */];
function nums(t){return (t.match(/[$+−-]?\d[\d,]*\.?\d*\s?(?:%|[kKMBT]\b|×|σ|bp|EH\/s)?/g)||[]).map(x=>x.replace(/[,\s+−-]/g,'').replace(/^\$/,'').replace(/\.$/,''))}
function trivial(n){const v=parseFloat(n);return /^(19|20)\d\d$/.test(n)||(!/[%kMBT×σ.]/.test(n)&&v<=31)||['280','200','365','52','50','100','90','60','128','111','140','350'].includes(n)}
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});
await p.waitForTimeout(8000);
for(const t of ['signals','macro','altseason','news','chart','studio','today']){await p.evaluate(t=>{try{tab(t)}catch(e){}},t);await p.waitForTimeout(4000)}
const rows=await p.evaluate(({SNAPS,LIVENEWS})=>{const out=[];const ctxs=[];
 (SIG||[]).forEach(s=>ctxs.push([{kind:'sig',id:s.id},s]));(MAC.cards||[]).forEach(s=>ctxs.push([{kind:'mac',id:s.id}]));
 ['btc','eth'].forEach(a=>ctxs.push([{kind:'etf',a}]));ctxs.push([{kind:'alt'}]);ctxs.push([{kind:'dd',a:'BTC'}]);ctxs.push([{kind:'perf',a:'BTC'}]);ctxs.push([{kind:'studio',t:'pulse'}]);ctxs.push([{kind:'studio',t:'chart'}]);
 const gen=(c,o,tag,warn)=>{const id=(tag||c.kind)+':'+(c.id||c.a||c.t||(c.n&&c.n.title)||'');let F;
  try{F=capFacts(c,o)}catch(e){out.push({c:id,err:'capFacts '+e,warn});return}if(!F){out.push({c:id,err:'null facts',warn});return}
  const ref=JSON.stringify(F)+' '+(document.querySelector('[data-id="'+(c.id||'')+'"]')?.innerText||'');
  // data-dependent states, rendered every run: last comparable reading <60 days old (since='') and the legacy since=percentile fallback
  if(!tag&&!c._v&&F.pos){if(F.since!==F.pos)gen({...c,_v:'pos'},o,c.kind+'~since=pos',warn);if(F.since)gen({...c,_v:'lt60'},o,c.kind+'~since<60d',warn)}
  if(c._v==='pos')F={...F,since:F.pos};if(c._v==='lt60')F={...F,since:'',sinceD:''};
  for(const [st] of STY){CAPT[F.fam][st].forEach((fn,i)=>{let t;try{t=tidy(fn(F));if(t&&typeof t!=='string')t=String(t)}catch(e){t='ERR '+e}
    let lint=[];try{lint=t?lintBanned(t,F.title,F.open):[]}catch(e){}
    out.push({c:id,st,i,t,len:t?(()=>{try{return xLen(t)}catch(e){return t.length}})():0,lint,ref,warn,open:!!F.open,fv:F.formV||''})});
   let pk;try{pk=capPick(F,st,-1,()=>.5);if(pk&&typeof pk!=='string')pk=pk.t||pk.text||pk.cap||JSON.stringify(pk)}catch(e){pk='ERR '+e}out.push({c:id,st,i:'picked',t:pk,len:pk?(()=>{try{return xLen(pk)}catch(e){return pk.length}})():0,lint:[],ref,picked:1,warn,open:!!F.open,fv:F.formV||''})}
  // forming-candle rule: the same card with a value from today's unfinished candle (open=true) -> the app's own pick must never say 'close'
  if(!tag&&!c._v&&c.kind==='sig')for(const [st] of STY){let pk;try{pk=capPick({...F,open:true},st,-1,()=>.5).t}catch(e){pk='ERR '+e}out.push({c:'sig~forming:'+(c.id||''),st,i:'picked',t:pk,len:pk?pk.length:0,lint:[],ref,picked:1,warn,open:true})}};
 for(const [c,o] of ctxs)gen(c,o);
 // news from frozen replay snapshots (blocking)
 const realNow=Date.now,realNews=D.news;for(const S0 of SNAPS){Date.now=()=>S0.now;D.news=S0.news;try{newsClusters().slice(0,6).forEach(c=>gen({kind:'news',n:c.lead},null,'news@'+S0.f.slice(0,16)))}catch(e){out.push({c:'news@'+S0.f,err:String(e)})}finally{Date.now=realNow;D.news=realNews}}
 if(!SNAPS.length)out.push({c:'news-replay',err:'no saved snapshots in qa/news-replay'});
 // live news (warning only)
 if(LIVENEWS){try{newsClusters().slice(0,6).forEach(c=>gen({kind:'news',n:c.lead},null,'newslive',1))}catch(e){out.push({c:'newslive',err:String(e),warn:1})}}
 return out},{SNAPS,LIVENEWS});
const W=await p.evaluate(()=>window.RPT_WORDS?{region:[RPT_WORDS.region.source,RPT_WORDS.region.flags],rule1:RPT_WORDS.rule1.map(x=>[x[0].source,x[0].flags])}:null);
await b.close();
if(!W){console.error('caption sweep: app does not expose RPT_WORDS (shared word list)');process.exit(1)}
BANNED.push(new RegExp(...W.region));const RULE1=W.rule1.map(x=>new RegExp(...x));// rule 1 on news captions runs through the app lint (headline text exempt), on every other card directly
let fails=[];
const warns=[];for(const r of rows){const fails0=fails;if(r.warn)fails=warns;try{if(r.err){fails.push([r.c,'-','-',r.err]);continue}const t=r.t||'';const loc=[r.c,r.st,r.i];
 if(!t){fails.push([...loc,'blank caption']);continue}// a blank template or blank pick means Studio offers an empty caption
 if(/^ERR /.test(t))fails.push([...loc,'template threw: '+t]);
 if(r.len>280)fails.push([...loc,'over 280 ('+r.len+')']);
 if(BADTOK.test(t))fails.push([...loc,'bad token '+t.match(BADTOK)[0]]);
 if(STATUS.test(t))fails.push([...loc,'status text '+t.match(STATUS)[0]]);
 for(const re of BANNED)if(re.test(t))fails.push([...loc,'banned "'+t.match(re)[0]+'"']);
 if(!/^news/.test(r.c))for(const re of RULE1)if(re.test(t))fails.push([...loc,'rule 1 "'+t.match(re)[0]+'"']);
 if(r.lint&&r.lint.length)fails.push([...loc,'app lint: '+r.lint.join(',')]);
 if(/(?:\b(?:is|at|That's|That is|Context:)\s*[.,;]|,\s*[.,]|\(\s*\)|\.\s*\.(?!\.))/.test(t))fails.push([...loc,'empty slot "'+t.match(/(?:\b(?:is|at|That's|That is|Context:)\s*[.,;]|,\s*[.,]|\(\s*\)|\.\s*\.(?!\.))/)[0]+'"']);
 const rc=repClause(t);if(rc)fails.push([...loc,'repeated phrase "'+rc+'"']);
 // forming-candle rule (7 Oct): never attach 'close' to a forming value; a forming value only appears labelled live
 if((r.open||(r.fv&&t.includes(r.fv)))&&/\b(daily )?(close[sd]?|closing)\b/i.test(t.replace(/\bclose to\b/gi,'')))fails.push([...loc,'"close" on a forming value']);
 if(r.fv&&t.includes(r.fv)&&!/\blive\b/i.test(t))fails.push([...loc,'forming value '+r.fv+' without a live label']);
 const rp=repeated(t);if(rp)fails.push([...loc,'repeated phrase "'+rp+'"']);
 if(/\blive\b/i.test(t)&&/\b(\d{1,2} \w{3}|close)\b/i.test(t)&&!/\blive[^.]{0,25}\d\d:\d\d ?UTC/i.test(t))fails.push([...loc,'live and close values without labels']);
 const ref=r.ref.replace(/[,\s+−-]/g,'');for(const n of nums(t.replace(/https?:\/\/\S+/g,' '))){if(trivial(n))continue;const core=n.replace(/[%kMBT×σ]|bp|EH\/s/g,'');if(core&&!ref.includes(core))fails.push([...loc,'number '+n+' not on card'])}}finally{fails=fails0}}
const seen=new Set();const uniq=fails.filter(f=>{const k=f.join('|');return !seen.has(k)&&seen.add(k)});
const n=rows.filter(r=>r.t&&!r.picked).length;
const wseen=new Set(),wq=warns.filter(f=>{const k=f.join('|');return !wseen.has(k)&&wseen.add(k)});
console.log(`caption sweep: ${n} captions (${SNAPS.length} replay snapshots), ${uniq.length} blocking failures, ${wq.length} live-news warnings (${URL})`);
uniq.forEach(f=>console.log(' FAIL',f.join(' | ')));wq.forEach(f=>console.log(' WARN (live news, non-blocking)',f.join(' | ')));
require('fs').writeFileSync(__dirname+'/caption-sweep.last.json',JSON.stringify({url:URL,at:new Date().toISOString(),captions:n,fails:uniq,warnings:wq,rows:rows.map(({ref,...r})=>r)},null,1));
process.exit(uniq.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
