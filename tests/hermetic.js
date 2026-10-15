// hermetic.js: suites that read the committed data/derivs.json get a copy whose hourly OI/basis series run to the current UTC hour
// (last value carried; TEST DATA ONLY, same rule as tclosed.js), so the nightly 00:00-02:30 UTC gap before the 00:00 OI point is
// published cannot change results. Staleness itself is tested with explicit stale fixtures (tstale, stale-derivs*, stale-captions).
const fs=require('fs'),path=require('path');const H=36e5;
function aligned(now=Date.now()){const x=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/derivs.json'),'utf8')),top=Math.floor(now/H)*H;
 for(const A of Object.values(x.assets||{})){for(const k of ['oi_hourly','basis_hourly']){const P=A[k]?.points;if(!P?.length)continue;const l=P.at(-1);for(let t=l[0]+H;t<=top;t+=H)P.push([t,...l.slice(1)])}
  const L=A.latest||(A.latest={}),o=A.oi_hourly?.points?.at(-1),b=A.basis_hourly?.points?.at(-1);if(o){L.oi_t=o[0];if(o[1]!=null)L.oi_usd=o[1];if(o[2]!=null)L.oi_coin=o[2]}if(b){L.basis_t=b[0]}}
 return x}
async function hermetic(pg){await pg.setRequestInterception(true);pg.on('request',r=>{if(r.isInterceptResolutionHandled&&r.isInterceptResolutionHandled())return;
 if(/\/data\/derivs\.json(\?|$)/.test(r.url()))return r.respond({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify(aligned())});r.continue()})}
module.exports={hermetic,aligned};
