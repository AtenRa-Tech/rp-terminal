// tsup.js — supervisor items on a31aa95: (1) combined ETF total never counts a pending (null) day as 0,
// (2) heatmap tile with missing 24h change is neutral grey and shows '—', (3) news via the allorigins relay goes through the same https-only/escape path.
const p=require('puppeteer-core');const URL=process.env.URL||'http://localhost:8765/index.html';
let fails=0;const ok=(c,n,d)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+JSON.stringify(d).slice(0,400)))};
const XML=`<?xml version="1.0"?><rss><channel>
<item><title>Evil relay item</title><link>javascript:alert(1)</link><pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate><description>x</description></item>
<item><title>Data item &lt;img src=x onerror=alert(2)&gt; 'q'</title><link>https://example.com/ok-story</link><pubDate>Fri, 02 Oct 2026 11:00:00 GMT</pubDate><description>y</description></item>
<item><title>No date item</title><link>https://example.com/nodate</link><description>z</description></item>
<item><title>Http item</title><link>http://example.com/plain</link><pubDate>Fri, 02 Oct 2026 09:00:00 GMT</pubDate><description>w</description></item>
</channel></rss>`;
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:412,height:915});
let relayHits=0;await pg.setRequestInterception(true);
pg.on('request',r=>{const u=r.url();if(u.includes('api.rss2json.com'))return r.respond({status:500,contentType:'application/json',body:'{"status":"error"}'});
 if(u.includes('api.allorigins.win')){relayHits++;return r.respond({status:200,contentType:'text/xml',headers:{'Access-Control-Allow-Origin':'*'},body:XML})}r.continue()});
const perr=[];pg.on('pageerror',e=>perr.push(e.message));
await pg.goto(URL,{waitUntil:'domcontentloaded'});await pg.waitForFunction(()=>typeof loadNews==='function'&&typeof drawHeat==='function',{timeout:60000});
await new Promise(r=>setTimeout(r,3000));
// (1) ETF combined
const e=await pg.evaluate(()=>{const mk=(rows)=>({funds:[1,2],status:'ok',days:rows.map(([date,total,pending])=>({date,total,pending:!!pending}))});
 const D0=[['2026-09-22',10],['2026-09-23',10],['2026-09-24',10],['2026-09-25',10],['2026-09-26',10],['2026-09-29',10],['2026-09-30',10]];
 const E={updated:'2026-10-02T00:00:00Z',datasets:{btc:mk([...D0.map(([d,v])=>[d,100]),['2026-10-01',500]]),eth:mk([...D0,['2026-10-01',null,true]])}};
 const m=etfComb(E);const sv=NX.etf;NX.etf=E;let s7;try{s7=etf7()}finally{NX.etf=sv}
 const E2={updated:E.updated,datasets:{btc:E.datasets.btc,eth:mk([...D0,['2026-10-01',null,false]])}};const m2=etfComb(E2);
 return{has1:m.has('2026-10-01'),has1b:m2.has('2026-10-01'),sep30:m.get('2026-09-30'),n:m.size,s7,ethL:etfStats(E,'eth').L.date}});
ok(!e.has1&&!e.has1b,'ETF combined: 1 Oct with ETH pending/null is dropped (not summed as 0)',e);
ok(e.sep30===110&&e.n===7,'ETF combined: complete days sum both funds (30 Sep = 100 + 10)',e);
ok(e.s7===770,'ETF 7-day combined uses the same 7 complete dates for both funds (770, not 1170)',e);
ok(e.ethL==='2026-09-30','etfStats ETH last day skips the pending 1 Oct',e);
// (2) heatmap missing 24h change
const h=await pg.evaluate(()=>{const sv=[D.top,D.srcTop,D.topAt];D.top=[{id:'a',symbol:'aaa',name:'A',market_cap:9e11,current_price:100,price_change_percentage_24h:null},{id:'b',symbol:'bbb',name:'B',market_cap:5e11,current_price:50,price_change_percentage_24h:2.5},{id:'c',symbol:'ccc',name:'C',market_cap:3e11,current_price:5,price_change_percentage_24h:0}];D.srcTop='CoinGecko';D.topAt=Date.now();
 const P=CanvasRenderingContext2D.prototype,of=P.fillText,fr=P.fillRect;const rects=[],tx=[];P.fillRect=function(x,y,w,hh){if(w>50&&hh>50)rects.push(this.fillStyle);return fr.call(this,x,y,w,hh)};P.fillText=function(t,...a){tx.push(String(t));return of.call(this,t,...a)};
 let err=null;try{const c=document.createElement('canvas');c.width=1200;c.height=800;drawHeat(c.getContext('2d'),1200,800,true)}catch(e){err=String(e)}P.fillRect=fr;P.fillText=of;[D.top,D.srcTop,D.topAt]=sv;
 const zero=heatCol(0),miss=heatCol(null);return{err,rects,tx,zero,miss,nanCol:heatCol(NaN)}});
const ia=h.tx.indexOf('AAA');
ok(!h.err&&h.miss!==h.zero&&/#4b4f57/i.test(h.miss)&&h.nanCol===h.miss,'heatCol(null/NaN) is neutral grey, not the 0% colour',h);
ok(ia>=0&&h.tx[ia+1]==='—'&&!h.tx.slice(ia,ia+2).includes('+0.0%')&&!h.tx.slice(ia,ia+2).includes('0.0%'),'heat tile with missing 24h change shows "—"',h.tx.slice(Math.max(0,ia-1),ia+3));
ok(h.rects.some(c=>/4b4f57/i.test(c)),'grey tile drawn on the heatmap',h.rects.slice(0,6));
// (3) allorigins relay path
const n=await pg.evaluate(async()=>{await loadNews();try{NF='all'}catch(e){}tab('news');renderNews();await new Promise(r=>setTimeout(r,800));
 const links=D.news.map(x=>x.link),hrefs=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
 return{n:D.news.length,titles:D.news.map(x=>x.title),links,js:hrefs.filter(h=>/^\s*javascript:/i.test(h)),http:hrefs.filter(h=>/^http:/i.test(h)),inj:!!document.querySelector('#s-news img[src="x"]'),htmlHasJs:/javascript:alert/i.test(document.querySelector('#s-news').innerHTML)}});
ok(relayHits>0,'rss2json forced down: allorigins relay was used',relayHits);
ok(n.links.length>0&&n.links.every(l=>/^https:\/\//.test(l)),'relay items: only https links kept (javascript:, http: and undated items dropped)',n);
ok(!n.titles.some(t=>/Evil relay|No date|Http item/.test(t)),'javascript:/undated/http relay items never reach D.news',n.titles);
ok(!n.js.length&&!n.htmlHasJs&&!n.inj,'news DOM: no javascript: href anywhere, relay title HTML is escaped (no injected <img>)',n);
ok(!perr.length,'no page errors',perr.slice(0,3));
await b.close();console.log('FAILS:',fails);process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
