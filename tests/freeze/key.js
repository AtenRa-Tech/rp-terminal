// URL -> replay key: drop cache-busters and time-window params so a replay matches the recorded call
const DROP=/^(v|_|cb|nocache)$/;// the clock is frozen (constant) in both recording and replay, so time-window params match exactly
exports.key=u=>{let x;try{x=new URL(u)}catch(e){return u}const inner=x.searchParams.get('u');if(inner)return 'proxy:'+exports.key(inner);
 const q=[...x.searchParams.entries()].filter(([k])=>!DROP.test(k)).sort((a,b)=>a[0]<b[0]?-1:1).map(([k,v])=>k+'='+v).join('&');return x.host+x.pathname+(q?'?'+q:'')};
