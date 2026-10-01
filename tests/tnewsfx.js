// tnewsfx.js — news-rule fixtures (/workspace/rpt/fixtures/news-rules.json) + supervisor edge cases. Run against any build: URL=... node tnewsfx.js
const p=require('puppeteer-core');const fs=require('fs');const URL=process.env.URL||'http://localhost:8765/index.html';
const FX=JSON.parse(fs.readFileSync((process.env.FIX||'/workspace/rpt/fixtures')+'/news-rules.json'));const res={};
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
await pg.setRequestInterception(true);pg.on('request',x=>/rss|news|feed|allorigins|codetabs|corsproxy/i.test(x.url())&&!/localhost/.test(x.url())?x.abort('failed'):x.continue());
await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof newsClusters==='function'&&typeof D==='object',{timeout:60000});await new Promise(r=>setTimeout(r,3000));
const out=await pg.evaluate(FX=>{const now=Date.now(),T=x=>{try{return x()}catch(e){return'ERR '+e.message}};let u=0;
  const mk=(items)=>items.map(i=>({title:i.title,desc:i.desc||'',src:i.src,t:now-i.ageMin*6e4,link:i.primary?'https://www.sec.gov/news/press-release/fx'+(u++):'https://example.com/'+(u++),primary:!!i.primary}));
  const R={};const set=a=>{D.news=a;return a};
  const tagOf=(items)=>{const N=set(mk(items));const C=newsClusters();const lead=C[0].lead;const R2=[];newsCheck(lead,'BREAKING: '+lead.title,null,R2);lintText.news=newsCheck(lead,'BREAKING: '+lead.title,null,[]);const L=lintText('BREAKING: '+lead.title+'\n\n'+lead.link,null);lintText.news=null;
    const bl=L.filter(x=>/BREAKING/i.test(x[1]));return{clusters:C.length,tag:bl.length?bl.every(x=>x[0]==='ok'):null,lint:bl.map(x=>x[0]+': '+x[1].slice(0,80))}};
  for(const f of FX.breaking)R[f.id]=T(()=>{const r=tagOf(f.items);return{...r,want:{tag:f.tag,clusters:f.clusters},pass:r.tag===f.tag&&r.clusters===f.clusters}});
  for(const f of FX.merge)R[f.id]=T(()=>{const N=set(mk(f.items));const C=newsClusters();const r={clusters:C.length,want:f.clusters};
    if(f.outlets){const c=C[0];r.outlets=c.outs?.length;const R2=[];newsCheck(c.lead,c.lead.title+'\n\n'+c.lead.link,null,R2);r.unconf=R2.some(x=>/^Unconfirmed/.test(x[1]));
      const F=newsFacts(c.lead),caps=STY.flatMap(([st])=>CAPT.news[st].map(t=>t(F)));r.badCap=caps.filter(t=>/Single source|Only .{1,40} so far/.test(t));r.pass=r.clusters===1&&r.outlets===f.outlets&&!r.unconf&&!r.badCap.length}
    else r.pass=r.clusters===f.clusters;return r});
  const opPart=t=>{set(mk([{src:'X',ageMin:30,title:t}]));const c=newsClusters()[0];return(c.parts||[]).some(p=>p[0]==='Opinion headline'&&p[1]===-15)};
  FX.opinion_penalty_minus15.forEach((t,i)=>R['OP+'+(i+1)]=T(()=>{const v=opPart(t);return{t,penal:v,pass:v===true}}));
  (FX.opinion_no_penalty||[]).forEach((t,i)=>R['OP-'+(i+1)]=T(()=>{const v=opPart(t);return{t,penal:v,pass:v===false}}));
  FX.abbreviation_split.forEach((f,i)=>R['AB'+(i+1)]=T(()=>{const N=set(mk([{src:'X',ageMin:30,title:'Fixture headline about markets today',desc:f.desc}]));const d=newsFacts(N[0]).desc1;return{d,pass:d.includes(f.mustContain)}}));
  // supervisor edge cases
  const two=m=>[{src:'CoinDesk',ageMin:m,title:'Exchange Y halts withdrawals after $40M exploit'},{src:'The Block',ageMin:m,title:'Exchange Y suspends withdrawals after $40M exploit'}];
  R['EA_60min_no_tag']=T(()=>{const r=tagOf(two(60));return{...r,pass:r.tag===false}});R['EA_59min_tag']=T(()=>{const r=tagOf(two(59));return{...r,pass:r.tag===true}});
  ['Zcash Killer? | podcast','BTC to $1 Million by 2030','ETH to $10K by 2027'].forEach((t,i)=>R['EB+'+(i+1)]=T(()=>{const v=opPart(t);return{t,penal:v,pass:v===true}}));
  ['SEC will rule on spot SOL ETF by Friday','US? No: Bitcoin hashrate hits record'].forEach((t,i)=>R['EB-'+(i+1)]=T(()=>{const v=opPart(t);return{t,penal:v,pass:v===false}}));
  const two2=(a,b)=>T(()=>{set(mk([{src:'CoinDesk',ageMin:60,title:a},{src:'Decrypt',ageMin:50,title:b}]));const n=newsClusters().length;return{n,pass:n===2}});
  R['EC_near_vs_other_protocol']=two2('NEAR Intents hit by $3.8M exploit','Kamino lending protocol hit by $3.8M exploit');
  R['EC_generic_words']=two2('Crypto lender Celsia loses $3.8M in Exploit flagged by SEC on Bitcoin','Wallet maker Zentry drained of $3.8M, Bitcoin and SEC Exploit concerns');
  R['EC_outlet_names']=two2('Mango lost $3.8M, according to CoinDesk','Kamino user loses $3.8M, CoinDesk data shows');
  R['EC_sentence_initial']=two2('Hackers drain $3.8M from Celsia vaults','Hackers steal $3.8M in Zentry bridge attack');
  // news captions on fixture stories: picked caption per style non-empty, ≤280, lint-clean; every template free of bad tokens
  const allFx=[...FX.breaking,...FX.merge];R['NC_news_captions']=T(()=>{const bad=[];let n=0;for(const f of allFx){set(mk(f.items));const c=newsClusters()[0],F=newsFacts(c.lead);
    for(const[st]of STY){const pk=capPick(F,st,-1,()=>.5).t;n++;const L=lintBanned(pk||'',F.title,F.open);if(!pk||xLen(pk)>280||L.length)bad.push([f.id,st,pk&&pk.slice(0,80),L]);CAPT.news[st].forEach(fn=>{const t=tidy(fn(F));if(/undefined|NaN|\bnull\b|\[object/.test(t)||xLen(t)>280)bad.push([f.id,st,'template',t.slice(0,80)])})}}return{n,bad,pass:n>0&&!bad.length}});
  R['NS_news_score_parts']=T(()=>{set(mk(FX.merge[0].items));const c=newsClusters()[0];const names=c.parts.map(p=>p[0]);return{names,score:c.score,pass:['Freshness','Pickup','Size','Price reaction'].every(k=>names.includes(k))&&c.score>=0&&c.score<=100}});
  return R},FX);
let f=0;for(const[k,v]of Object.entries(out)){const ok=v&&v.pass;if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+k+' '+JSON.stringify(v).slice(0,260))}
console.log('FIXTURE FAILS:',f);await b.close();process.exit(0)})();
