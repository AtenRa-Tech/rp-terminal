// 11 Nov: the smoke no-India guard fails only when a file returns content (2xx); 5xx is retried, then counts as absent. node tests/tabsent.js
const {absent}=require('./tsmoke.js');const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+JSON.stringify(x)));if(!c)F.push(n)};
const seq=a=>{let i=0;const calls=[];const f=async u=>{calls.push(u);const v=a[Math.min(i++,a.length-1)];if(v==='err')throw new Error('net');return{status:v}};f.calls=calls;return f};
(async()=>{
 let g=seq([503,404]),r=await absent(g,'india.json',3,0);ok(r.absent&&r.status===404&&g.calls.length===2,'503 then 404: absent (retried once)',r);
 g=seq([503]);r=await absent(g,'india.json',3,0);ok(r.absent&&g.calls.length===4,'503 every time: absent after 3 retries (4 requests), never content',[r,g.calls.length]);
 g=seq([200]);r=await absent(g,'india.json',3,0);ok(!r.absent&&r.status===200,'200: fails (file serves content)',r);
 g=seq([204]);r=await absent(g,'india.json',3,0);ok(!r.absent,'any 2xx (204) fails',r);
 g=seq([503,200]);r=await absent(g,'india.json',3,0);ok(!r.absent&&r.status===200,'503 then 200: fails',r);
 g=seq([404]);r=await absent(g,'india.json',3,0);ok(r.absent&&g.calls.length===1,'404: absent, no retry',r);
 g=seq(['err',404]);r=await absent(g,'india.json',3,0);ok(r.absent&&g.calls.length===2,'network error is retried',r);
 console.log('FAILS: '+F.length);process.exit(F.length?1:0)})();
