// ONE NYSE trading-day calendar (15 Nov ruling): ETF flow freshness skips NYSE holidays only, never the bond-market list (usHol closes Columbus and Veterans Day, when NYSE and ETFs trade).
// Used by index.html (inlined between the nyse:begin/nyse:end markers; tests/tnyse.js asserts it equals this file), tests/tsmoke.js (require) and, through the Python twin scripts/nyse.py (tests/tnyse.py cross-checks 2024-2030), the stale alarm.
// Holidays: New Year, MLK (3rd Mon Jan), Presidents (3rd Mon Feb), Good Friday, Memorial (last Mon May), Juneteenth, Independence Day, Labor (1st Mon Sep), Thanksgiving (4th Thu Nov), Christmas.
// Observance: Saturday holiday -> Friday before closed, except New Year's Day (1 Jan on a Saturday: Fri 31 Dec stays open); Sunday holiday -> Monday after closed. All dates UTC.
const NYSE=(()=>{const C={},DAY=864e5,iso=t=>new Date(t).toISOString().slice(0,10);
 const easter=y=>{const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31);return Date.UTC(y,mo-1,(h+l-7*m+114)%31+1)};
 const holidays=y=>{if(C[y])return C[y];
  const obs=(m,d,newYear)=>{const t=Date.UTC(y,m,d),w=new Date(t).getUTCDay();return w===0?iso(t+DAY):w===6?(newYear?null:iso(t-DAY)):iso(t)};
  const nth=(m,wd,n)=>{const t=Date.UTC(y,m,1);return iso(t+(((wd-new Date(t).getUTCDay())+7)%7+7*(n-1))*DAY)};
  const last=(m,wd)=>{const t=Date.UTC(y,m+1,0);return iso(t-(((new Date(t).getUTCDay()-wd)+7)%7)*DAY)};
  return C[y]=new Set([obs(0,1,true),nth(0,1,3),nth(1,1,3),iso(easter(y)-2*DAY),last(4,1),y>=2022?obs(5,19):null,obs(6,4),nth(8,1,1),nth(10,4,4),obs(11,25)].filter(Boolean))};
 // open(t): t is a 'YYYY-MM-DD' string or ms; true on a weekday that is not an NYSE holiday
 const open=t=>{const s=typeof t==='string'?t.slice(0,10):iso(t),w=new Date(s+'T00:00:00Z').getUTCDay();return w>0&&w<6&&!holidays(+s.slice(0,4)).has(s)};
 // bizDays(t,n): NYSE trading days after the UTC date of t, up to and including the UTC date of n (Fri -> Mon = 1)
 const bizDays=(t,n=Date.now())=>{let d=0,x=Date.parse(iso(t));const e=Date.parse(iso(n));while(x<e){x+=DAY;if(open(x))d++}return d};
 // bizH(a,b): hours in [a,b) whose UTC date is an NYSE trading day
 const bizH=(a,b)=>{let h=0;for(let t=a;t<b;t+=36e5)if(open(t))h++;return h};
 // etfLast(E): etf.json's last COMPLETE day = newest non-pending row (fetch_etf.py holds the newest row pending, total null, until every fund reports),
 // per dataset from its days[], newest across datasets (same as fetch_etf.py's top-level last_date). held = newest row date still pending and newer than last, else null.
 const etfLast=E=>{let last=null,held=null;const ds=Object.values((E&&E.datasets)||{});for(const d of ds){const rows=(d&&d.days)||[];for(const r of rows){const x=String(r.date||'').slice(0,10);if(!x)continue;if(r.pending){if(!held||x>held)held=x}else if(!last||x>last)last=x}}
  if(!ds.length&&E&&E.last_date)last=String(E.last_date).slice(0,10);if(held&&last&&held<=last)held=null;return {last,held}};
 return {holidays:y=>[...holidays(y)].sort(),open,bizDays,bizH,etfLast}})();
if(typeof module==='object'&&module&&module.exports)module.exports=NYSE;
