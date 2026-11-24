// C6 (15 Oct ruling) on ONE clock (24 Nov). data.yml run 45085594889 (gates 23:57:25Z -> 00:01:49Z, 22/23 Nov): qa/stale-captions.js built the C6
// fixture from Node's wall clock, the page judged it on its own clock at load time, and the expected labels were computed from the wall clock AGAIN
// after all five cases had run - three different moments. Across 00:00Z they sat on different UTC days, so "one close back" became two closes back and
// C6 failed (oicapBTC/ETH "missing from SIG", "marked stale"). Now everything comes from one time T (the fixture's time): the fixture, the page clock
// (pinned to T for the C6 case) and the expected labels. Tests: tests/tc6clock.js (23:59Z and 00:01Z).
const H=36e5,DAY=24*H,MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dm=t=>{const d=new Date(t);return d.getUTCDate()+' '+MO[d.getUTCMonth()]};
// at time T: today's 00:00 UTC (D0); hourly OI ends 23:00 UTC yesterday (one close back); the label must name the close two days before D0's date
// (the newest 00:00 point is D0-24h, i.e. the close of D0-48h's day) and must not claim yesterday's close.
function c6At(T){const D0=Math.floor(T/DAY)*DAY;return{T,D0,end:D0-H,oiAgeMs:T-(D0-H),want:'('+dm(D0-2*DAY),bad:'('+dm(D0-DAY)+' close'}}
// the C6 checks on a captured page state (same rules as before, expected strings from c6At(T))
function c6Fails(st,T){const c=c6At(T),f=[];
 for(const a of ['BTC','ETH']){const id='oicap'+a;
  if(!st.sig.includes(id))f.push('C6 '+id+' one close back: missing from SIG (should be fresh)');
  else{const tx=st.sigtx[id]||'';if(!tx.includes(c.want))f.push('C6 '+id+': label does not name '+c.want+' close)');if(tx.includes(c.bad))f.push('C6 '+id+': label claims '+c.bad+')')}
  if(st.stale&&st.stale[id]&&st.stale[id].stale)f.push('C6 '+id+' one close back marked stale')}
 return f}
// page init script: the page's Date is the constant T (same shape as tests/freeze/preload.js), so the page cannot cross 00:00Z mid-case
const pinClock=T=>`(()=>{const RD=Date,T=${+T};class FD extends RD{constructor(...a){a.length?super(...a):super(T)}static now(){return T}}window.Date=FD;window.__C6CLOCK=T})();`;
module.exports={c6At,c6Fails,pinClock,dm,H,DAY};
