// Volatility signal cards (rv7/rv30 per asset) only exist while the latest realized vol is a >=30-day extreme (buildSignals gate),
// so on most days live data has none and suites that check them would test nothing or crash. If live SIG has no rv card, build them
// with the app's own buildSignals from the real Binance closes with the last 10 closes flattened (a forced low-vol extreme, real dates)
// and add them to SIG for this test page only. Returns {live, ids}.
module.exports=pg=>pg.evaluate(()=>{
  const have=SIG.filter(s=>/^rv/.test(s.id)).map(s=>s.id);if(have.length)return{live:true,ids:have};
  const CL={};for(const A of ['BTC','ETH','LINK']){const C=SIGD?.CL?.[A];if(!C||C.v.length<400)continue;const v=[...C.v],n=v.length,b=v[n-11];
    for(let i=n-10;i<n;i++)v[i]=b*(1+((i%2)?1:-1)*1e-4);CL[A]={...C,v}}
  const rv=buildSignals({...SIGD,CL:{...SIGD.CL,...CL}}).filter(s=>/^rv/.test(s.id));rv.forEach(s=>{try{prepSig(s)}catch(e){}});SIG.push(...rv);
  return{live:false,ids:rv.map(s=>s.id)}});
