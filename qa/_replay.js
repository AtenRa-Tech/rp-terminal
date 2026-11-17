// Real-clock replay of the recorded outside feeds (11 Nov, data gates). Used by qa/_load.js in QA_NET=replay mode.
// Same recording as the frozen gate (tests/fixtures/frozen/net + index.json, same URL key as tests/freeze/key.js), but the page keeps the REAL clock
// and the REAL data/*.json from the local server, because the data gates check the data that is about to be published.
// So the recording is moved forward by whole UTC days (DELTA = today 00:00 UTC - recording day 00:00 UTC):
//  - request: time-window params (endTime/startTime ms, end/start ISO) are moved back by DELTA before the lookup, so paging replays exactly;
//    a "now"-based param (e.g. bnDaily endTime=Date.now()) that lands on the recording day matches the recorded call nearest to it;
//  - response: candle/series times move forward by DELTA (values unchanged), candles that would open after now are dropped and point
//    stamps (ticker closeTime, funding/OI ts, last_updated) are capped at now, so yesterday's close is a full recorded close and nothing is in the future.
// Anything not recorded is aborted (like a down source). Non-GET outside requests are aborted.
const fs=require('fs'),path=require('path');
const FZ=process.env.QA_REPLAY_DIR||path.join(__dirname,'../tests/fixtures/frozen');
const {key}=require('../tests/freeze/key.js');
const DAY=864e5,META=JSON.parse(fs.readFileSync(path.join(FZ,'meta.json'),'utf8')),T0=META.T0,T0D=Math.floor(T0/DAY)*DAY;
const IDX=JSON.parse(fs.readFileSync(path.join(FZ,'index.json'),'utf8'));
const delta=(now=Date.now())=>Math.floor(now/DAY)*DAY-T0D;
const MS=v=>typeof v==='number'&&v>1e12&&v<2.5e12,SEC=v=>typeof v==='number'&&v>1e9&&v<2.5e9;
const TPARAM_MS=['endTime','startTime'],TPARAM_ISO=['end','start'];
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?$/;
// shape key: the URL key with its time-window params removed (to find the recorded call nearest to a "now"-based request)
const SHAPE=new Map();
for(const [k,r] of Object.entries(IDX)){let x;try{x=new URL(r.u)}catch(e){continue}const t={};for(const q of TPARAM_MS)if(x.searchParams.has(q)){t[q]=+x.searchParams.get(q);x.searchParams.delete(q)}
 for(const q of TPARAM_ISO)if(x.searchParams.has(q)){t[q]=Date.parse(x.searchParams.get(q));x.searchParams.delete(q)}
 if(!Object.keys(t).length)continue;const s=key(x.toString());if(!SHAPE.has(s))SHAPE.set(s,[]);SHAPE.get(s).push({k,t})}
function unshift(u,d){let x;try{x=new URL(u)}catch(e){return {u,t:{}}}const t={};
 for(const q of TPARAM_MS)if(x.searchParams.has(q)){const v=+x.searchParams.get(q);if(isFinite(v)){t[q]=v-d;x.searchParams.set(q,String(v-d))}}
 for(const q of TPARAM_ISO)if(x.searchParams.has(q)){const v=Date.parse(x.searchParams.get(q));if(isFinite(v)){t[q]=v-d;x.searchParams.set(q,new Date(v-d).toISOString())}}
 return {u:x.toString(),t}}
// -> {rec, d} or null
function lookup(u,now=Date.now()){const d=delta(now);let r=IDX[key(u)];if(r)return {r,d};
 const {u:u2,t}=unshift(u,d);r=IDX[key(u2)];if(r)return {r,d};
 if(!Object.keys(t).length)return null;
 // "now"-based window: nearest recorded call of the same shape, only within one day of the request (never a different page of history)
 let x;try{x=new URL(u2)}catch(e){return null}for(const q of [...TPARAM_MS,...TPARAM_ISO])x.searchParams.delete(q);const c=SHAPE.get(key(x.toString()));if(!c)return null;
 let best=null,bd=Infinity;for(const e of c){let dist=0,ok=true;for(const q of Object.keys(t)){if(!(q in e.t)){ok=false;break}dist=Math.max(dist,Math.abs(e.t[q]-t[q]))}if(ok&&dist<bd){bd=dist;best=e}}
 return best&&bd<=DAY?{r:IDX[best.k],d}:null}
// move a recorded JSON body forward by d ms (see header); host decides the second-based series
function shiftBody(buf,ct,host,d,now=Date.now()){if(!/json/i.test(ct||'')&&!/^\s*[\[{]/.test(buf.slice(0,64).toString()))return buf;let j;try{j=JSON.parse(buf.toString('utf8'))}catch(e){return buf}
 const ds=d/1000,cap=v=>Math.min(v,now),capS=v=>Math.min(v,Math.floor(now/1000));
 const isoS=v=>{const t=Date.parse(v);return isFinite(t)?new Date(Math.min(t+d,now)).toISOString():v};
 const cbSec=/coinbase\.com$/.test(host);
 const walk=o=>{if(Array.isArray(o)){
   // candle arrays: [openMs,...,closeMs,...] (Binance) or [openSec,...] (Coinbase exchange); drop candles that would open after now
   if(o.length&&Array.isArray(o[0])&&(MS(o[0][0])||(cbSec&&SEC(o[0][0])))){const out=[];for(const c of o){const k=c.slice();if(MS(k[0])){k[0]+=d;if(MS(k[6]))k[6]+=d;if(k[0]>now)continue}else if(cbSec&&SEC(k[0])){k[0]+=ds;if(k[0]*1000>now)continue}out.push(k)}return out}
   return o.map(walk)}
  if(o&&typeof o==='object'){const r={};for(const [k,v] of Object.entries(o)){
    if(/^(openTime|closeTime|fundingTime|nextFundingTime|ts|time|timestamp_ms)$/.test(k)&&(MS(v)||(typeof v==='string'&&/^\d{13}$/.test(v)))){const n=cap(+v+d);r[k]=typeof v==='string'?String(n):n}
    else if(/^(x|date|timestamp|last_updated)$/.test(k)&&(SEC(v)||(typeof v==='string'&&/^\d{10}$/.test(v)))){const n=capS(+v+ds);r[k]=typeof v==='string'?String(n):n}
    else if(typeof v==='string'&&ISO.test(v)&&/(updated|_at|time|date)$/i.test(k)&&Math.abs(Date.parse(v)-T0)<3*DAY)r[k]=isoS(v)
    else r[k]=walk(v)}return r}
  return o};
 return Buffer.from(JSON.stringify(walk(j)))}
// -> {status, contentType, body} or null (= abort)
function answer(u,method='GET',now=Date.now()){if(method!=='GET')return null;const L=lookup(u,now);if(!L)return null;let host='';try{host=new URL(u).hostname}catch(e){}
 const body=fs.readFileSync(path.join(FZ,'net',L.r.h+'.body'));return {status:L.r.s,contentType:L.r.ct,body:L.r.s===200?shiftBody(body,L.r.ct,host,L.d,now):body}}
module.exports={answer,lookup,shiftBody,delta,T0,IDX};
