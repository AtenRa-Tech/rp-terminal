// feeds.js — are the app's news feeds reachable through either proxy the app uses (rss2json, allorigins)?
// Returns {up, why}. Used by tqa/talt to SKIP live-news checks only when the feeds themselves are down.
const FEEDS=['https://www.coindesk.com/arc/outboundfeeds/rss/','https://cointelegraph.com/rss','https://decrypt.co/feed','https://www.theblock.co/rss.xml','https://bitcoinmagazine.com/.rss/full/'];
const get=async(u,ms=15000)=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(u,{signal:ac.signal});return{st:r.status,txt:r.ok?await r.text():''}}catch(e){return{st:'ERR '+(e.name||e.message)}}finally{clearTimeout(t)}};
module.exports=async()=>{const why=[];for(const f of FEEDS){const a=await get('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(f));if(a.txt&&/"status":"ok"/.test(a.txt)&&/"items":\[\{/.test(a.txt))return{up:true,why:'rss2json ok for '+f};why.push('rss2json '+a.st);
  const b=await get('https://api.allorigins.win/raw?url='+encodeURIComponent(f),20000);if(b.txt&&/<item[\s>]/.test(b.txt))return{up:true,why:'allorigins ok for '+f};why.push('allorigins '+b.st)}return{up:false,why:[...new Set(why)].join(', ')}};
