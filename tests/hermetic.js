// hermetic.js: suites that read the committed data/derivs.json get a TEST-ONLY copy whose hourly OI/basis series run to the current UTC
// hour (last value carried forward), so the nightly 00:00-02:30 UTC gap before the 00:00 OI point is published cannot change results.
// Written ONLY to a temp dir (never data/), stamped "_test_only": true, every carried-forward point marked with a trailing "cf".
// The publish guard (.github/scripts/publish_guard.py) refuses any file with these marks. Staleness is tested with explicit stale fixtures.
const fs=require('fs'),os=require('os'),path=require('path');const H=36e5;
function aligned(now=Date.now(),endTop=Math.floor(now/H)*H){const x=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/derivs.json'),'utf8'));x._test_only=true;
 for(const A of Object.values(x.assets||{})){for(const k of ['oi_hourly','basis_hourly']){const P=A[k]?.points;if(!P?.length)continue;const l=P.at(-1).filter(v=>v!=='cf');for(let t=l[0]+H;t<=endTop;t+=H)P.push([t,...l.slice(1),'cf'])}
  const L=A.latest||(A.latest={}),o=A.oi_hourly?.points?.at(-1),b=A.basis_hourly?.points?.at(-1);if(o){L.oi_t=o[0];if(o[1]!=null)L.oi_usd=o[1];if(o[2]!=null)L.oi_coin=o[2]}if(b)L.basis_t=b[0]}
 return x}
// writes the test copy to a fresh temp dir and returns its path (never data/)
function write(now=Date.now(),endTop){const d=fs.mkdtempSync(path.join(os.tmpdir(),'rpt-hermetic-')),f=path.join(d,'derivs.json');fs.writeFileSync(f,JSON.stringify(aligned(now,endTop)));return f}
// news: the five RSS feeds are served from a recorded snapshot (qa/news-replay), timestamps shifted so the newest item is 30 min old
const FEEDN={'coindesk.com':'CoinDesk','cointelegraph.com':'Cointelegraph','decrypt.co':'Decrypt','theblock.co':'The Block','bitcoinmagazine.com':'Bitcoin Magazine'};
function newsBody(url,now=Date.now()){const S=JSON.parse(fs.readFileSync(path.join(__dirname,'../qa/news-replay/2026-10-01T22-33-14-329Z.json'),'utf8')),feed=decodeURIComponent((url.split('rss_url=')[1]||'')),
 src=Object.entries(FEEDN).find(([k])=>feed.includes(k))?.[1],mx=Math.max(...S.news.map(n=>n.t)),d=now-30*60000-mx,fmt=t=>new Date(t).toISOString().slice(0,19).replace('T',' ');
 return JSON.stringify({status:'ok',items:S.news.filter(n=>n.src===src).map(n=>({title:n.title,link:n.link,pubDate:fmt(n.t+d),description:n.desc||''}))})}
async function hermetic(pg){const f=write();await pg.setRequestInterception(true);pg.on('request',r=>{if(r.isInterceptResolutionHandled&&r.isInterceptResolutionHandled())return;
 const u=r.url();if(/\/data\/derivs\.json(\?|$)/.test(u))return r.respond({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:fs.readFileSync(f,'utf8')});
 if(/api\.rss2json\.com/.test(u))return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:newsBody(u)});if(/allorigins\.win/.test(u))return r.abort();r.continue()})}
module.exports={hermetic,aligned,write,newsBody};
if(require.main===module){const [now,end]=process.argv.slice(2).map(Number);console.log(write(now||Date.now(),end||undefined))}
