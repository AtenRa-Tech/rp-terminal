// tlive15.js (15 Oct, after #27 went live): the two fixes proved on TODAY's live data, not only on synthetic fixtures.
//  1) oicap BTC/ETH on live derivs.json: newest 00:00 UTC OI one close back -> FRESH in SIG (one-day lag, same rule as every daily card); two back -> stale.
//  2) the live Cointelegraph Tron item ("...$200M ATM share offering to fuel TRX acquisitions", summary "...alongside its daily accumulation"):
//     every news caption passes the banned-word lint because the outlet's flagged summary sentence is dropped; the same word in our wording fails.
// Live data is fetched at run time; if the site/feed cannot be reached, the copies recorded from live on 15 Oct 2026 are used (tests/fixtures/*-20261015.json). URL=... node tests/tlive15.js
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html',SITE=process.env.SITE_URL||'https://atenra-tech.github.io/rp-terminal/';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,900):''));if(!c)F.push(n)};
const FX=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8'));
const get=async(u,ms=20000)=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(u,{signal:ac.signal});return r.ok?await r.json():null}catch(e){return null}finally{clearTimeout(t)}};
(async()=>{
 let dv=await get(SITE+'data/derivs.json?v='+Date.now()),dvSrc='live';if(!dv||!dv.assets){dv=FX('derivs-live-20261015.json');dvSrc='fixture recorded from live 15 Oct'}
 let it=null,nwSrc='live';const r=await get('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent('https://cointelegraph.com/rss'));if(r&&r.items)it=r.items.find(i=>/Tron .*\$200M ATM share offering/.test(i.title));if(!it){it=FX('news-tron-20261015.json').item;nwSrc='fixture recorded from live 15 Oct'}
 console.log('derivs:',dvSrc,dv.updated,'| news:',nwSrc,it.title);
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
 await pg.waitForFunction(()=>{try{return typeof derivSignals==='function'&&typeof gateDV==='function'&&typeof newsFacts==='function'&&typeof supplyOf==='function'&&supplyOf('BTC')&&supplyOf('ETH')}catch(e){return false}},{timeout:150000}).catch(()=>{});
 const R=await pg.evaluate(({dv,it})=>{const o={},DAYm=864e5,now=Date.now(),D0=Math.floor(now/DAYm)*DAYm-DAYm,keep={DV,DVRAW,SIG,SIGSTALE};
  try{
  const run=k=>{const raw=JSON.parse(JSON.stringify(dv));for(const a of ['BTC','ETH']){const A=raw.assets[a];if(!A?.oi_hourly)continue;const drop=Array.from({length:k},(_,j)=>D0+DAYm-j*DAYm);A.oi_hourly.points=A.oi_hourly.points.filter(p=>!drop.some(c=>Math.abs(p[0]-c)<=30*60000))}
   DVRAW=raw;DV=gateDV(raw);const out=derivSignals();const res={};for(const a of ['BTC','ETH']){const id='oicap'+a,c=out.find(x=>x.id===id),s=SIGSTALE.find(x=>x.id===id);const L=oiCapLatest(a,now,DVRAW);res[a]={inSIG:!!c,stale:!!(s&&s.stale),back:L.back,src:c?c.src:(s?s.src:null),score:c?c.score:(s?s.score:null)}}return res};
  o.k0=run(0);o.k1=run(1);o.k2=run(2);o.D0=new Date(D0).toISOString().slice(0,10);
  const n={src:'Cointelegraph',title:it.title,link:it.link,t:Date.parse(String(it.pubDate).replace(' ','T')+'Z'),desc:String(it.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()};
  const Fc=newsFacts(n);o.desc1=Fc.desc1;o.caps=[];for(const st of ['simple','analytical','ct'])CAPT.news[st].forEach((fn,i)=>{let t='';try{t=tidy(fn(Fc))}catch(e){t='ERR '+e}o.caps.push({st,i,t,lint:lintBanned(t,Fc.title,false).filter(x=>/^Banned phrase|^Regional/.test(x))})});
  o.own=lintBanned('Tron plans to fund its daily accumulation of TRX.','',false).filter(x=>/^Banned phrase/.test(x));
  o.ownNext=lintBanned(Fc.title+' Daily accumulation keeps going.',Fc.title,false).filter(x=>/^Banned phrase/.test(x));
  }catch(e){o.err=String(e.stack||e)}finally{Object.assign(window,{});DV=keep.DV;DVRAW=keep.DVRAW;SIG=keep.SIG;SIGSTALE=keep.SIGSTALE}return o},{dv,it});
 ok(!R.err,'harness ran',R.err);
 for(const a of ['BTC','ETH']){const k0=R.k0?.[a],k1=R.k1?.[a],k2=R.k2?.[a];
  ok(k1&&k1.back===1&&k1.inSIG&&!k1.stale,`C6 live derivs: ${a} oicap one close back is FRESH in SIG (scored later by prepSig)`,{k0,k1});
  ok(k1&&/\(\d{1,2} [A-Z][a-z]{2} close\)/.test(k1.src||''),`C6 live derivs: ${a} oicap label names the close it used`,k1);
  ok(k2&&k2.back===2&&!k2.inSIG&&k2.stale&&k2.score==null,`C6 live derivs: ${a} oicap two closes back is stale, out of SIG`,k2);
  ok(k0&&(k0.back===0?k0.inSIG&&!k0.stale:k0.back===1?k0.inSIG:true),`live derivs as published: ${a} oicap not wrongly stale (back=${k0&&k0.back})`,k0)}
 ok(R.desc1==='','Tron summary ("...its daily accumulation", outlet wording, not the headline) is dropped from captions',R.desc1);
 const bad=(R.caps||[]).filter(c=>c.lint.length||/^ERR/.test(c.t));ok((R.caps||[]).length>=8&&!bad.length,'live Tron item: every news caption passes the banned-word lint ("accumulate" no longer flagged)',bad);
 ok((R.own||[]).length>0,'"accumulation" in OUR wording still fails',R.own);
 ok((R.ownNext||[]).length>0,'our wording next to the headline still fails',R.ownNext);
 ok(!errs.length,'no page errors',errs.slice(0,3));
 await b.close();console.log('FAILS:',F.length,F);process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
