// Pulse movers fixtures (Crypto News GOD). Usage: node qa/pulse-movers.js [URL]. Exit 1 = block.
// Ruling 7 Oct: gainer only at >= +0.1% 24h, loser only at <= -0.1%; fewer qualifiers = fewer slots; none = "No top-50 coin up/down over 24h".
// Yield-bearing dollar tokens and stablecoins never appear. Renders the Pulse card (16:9 and 1:1) from fixture D.top and reads every fillText.
const {chromium}=require('playwright-core');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const c=(sym,ch,price=10,mc=1e9)=>({id:sym.toLowerCase(),symbol:sym.toLowerCase(),name:sym,current_price:price,price_change_percentage_24h:ch,market_cap:mc,total_volume:mc/10});
const REAL=['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','TRX','LINK','AVAX'];
const YIELD=[['USYC',0.01,1.11],['sUSDe',0.02,1.19],['USDY',0.03,1.12],['OUSG',0.01,112],['BUIDL',0,1],['sUSDS',0.02,1.06],['sDAI',0.01,1.17],['USTB',0.01,10.6],['BENJI',0,1],['USDT',0.01,1],['USDC',-0.01,1]];
const FIX={
 flat:{top:REAL.map((s,i)=>c(s,[0.04,-0.03,0.02,-0.05,0.01,0,0.03,-0.02,0.05,-0.04][i])),want:{g:0,l:0,noUp:1,noDown:1}},
 down:{top:REAL.map((s,i)=>c(s,-(i+1)*0.6)),want:{g:0,l:3,noUp:1,noDown:0}},
 up:{top:REAL.map((s,i)=>c(s,(i+1)*0.7)),want:{g:3,l:0,noUp:0,noDown:1}},
 mixed2:{top:REAL.map((s,i)=>c(s,[2.1,0.15,0.05,-0.02,0.08,-0.09,0.04,-0.3,0.01,0][i])),want:{g:2,l:1,noUp:0,noDown:0}},
 // yield tokens accrue ~+0.1-0.3%/day and would take the gainer slots on a red day if not excluded; TRX (calm real coin, +0.12%) must stay
 yieldtok:{top:[...REAL.map((s,i)=>c(s,s==='TRX'?0.12:-(i+1)*0.4)),...YIELD.map(([s,ch,p],i)=>c(s,ch+0.15+i*0.01,p,5e9))],want:{g:1,l:3,noUp:0,noDown:0,keep:'TRX'}},
};

// HISTORY fixture (ruling 7 Oct, 21:36 IST): second check = leave a coin out when 24h |change| < 0.05% AND
// (30-day std dev of daily close-to-close returns < 0.1%/day  OR, if the app has no 30d closes, 7d |change| < 0.3% AND 30d |change| < 1.5%).
// Each fixture coin carries BOTH: closes30 (31 daily closes, oldest first) and the CoinGecko 7d/30d change fields, consistent with each other.
const mk=(sym,name,p0,dailyRets,ch24)=>{const cl=[p0];dailyRets.forEach(r=>cl.push(cl.at(-1)*(1+r/100)));const last=cl.at(-1);
 return {id:sym.toLowerCase(),symbol:sym.toLowerCase(),name,current_price:last,market_cap:3e9,total_volume:3e8,price_change_percentage_24h:ch24,
  price_change_percentage_7d_in_currency:(last/cl[cl.length-8]-1)*100,price_change_percentage_30d_in_currency:(last/cl[0]-1)*100,closes30:cl}};
const wave=(a,n=30,d=0)=>Array.from({length:n},(_,i)=>a*Math.sin(i*1.7)+a*0.3*Math.cos(i*0.9)+d);
const HIST=[
 mk('YLDX','Yield Note Token',1.081,Array(30).fill(0.012),0.012), // unlisted yield-bearing token: sd ~0, 7d +0.08%, 30d +0.36% -> OUT
 mk('USYC','Hashnote USYC',1.109,Array(30).fill(0.013),0.013),     // OUT (named)
 mk('sUSDe','Ethena Staked USDe',1.188,Array(30).fill(0.03),0.03),  // OUT (named)
 mk('TRX','TRON',0.34,wave(1.4,30,0.15),0.03),                              // calm real coin, quiet day (24h +0.03%), sd ~1%/day -> STAYS
 mk('BCH','Bitcoin Cash',540,[...wave(0.9,23,0.12),0.02,-0.01,0.03,-0.02,0.01,0.02,-0.01],0.02), // quiet week, choppy month -> STAYS
 mk('BTC','Bitcoin',120000,wave(2.2,30,0.1),-1.1),mk('ETH','Ethereum',4400,wave(3,30,-0.1),-1.6),mk('SOL','Solana',220,wave(4,30,0.2),2.4)];
const sd=a=>{const r=a.slice(1).map((x,i)=>(x/a[i]-1)*100),m=r.reduce((s,x)=>s+x,0)/r.length;return Math.sqrt(r.reduce((s,x)=>s+(x-m)**2,0)/r.length)};
const HWANT={out:['YLDX','USYC','SUSDE'],keep:['TRX','BCH','BTC','ETH','SOL']};
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(8000);
const fails=[],out={};
for(const [k,fx] of Object.entries(FIX))for(const [W,H] of [[1920,1080],[1080,1080]]){
 const log=await p.evaluate(({top,W,H})=>{const P=CanvasRenderingContext2D.prototype,of=P.fillText;const log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
  const save=D.top;D.top=top;try{render8k((x,w,h)=>drawCard(x,w,h,'pulse'),W,H)}catch(e){log.push('ERR '+e)}D.top=save;P.fillText=of;return log},{top:fx.top,W,H});
 const id=k+' '+W+'x'+H;out[id]=log.join(' | ');
 const err=log.find(t=>/^ERR /.test(t));if(err)fails.push(id+': '+err);
 const slots=[];log.forEach((t,i)=>{if(/^Top (gainer|loser)$/.test(t))slots.push([t,log.slice(i+1,i+4).join(' ')])});
 const g=slots.filter(s=>s[0]==='Top gainer'),l=slots.filter(s=>s[0]==='Top loser');
 const pc=s=>{const m=s.match(/([+\-−]?\d+(?:\.\d+)?)%/);return m?parseFloat(m[1].replace('−','-')):NaN};
 g.forEach(s=>{if(!(pc(s[1])>=0.1))fails.push(id+': "Top gainer" with '+s[1])});l.forEach(s=>{if(!(pc(s[1])<=-0.1))fails.push(id+': "Top loser" with '+s[1])});
 if(g.length!==fx.want.g)fails.push(id+': '+g.length+' gainer slots, want '+fx.want.g);if(l.length!==fx.want.l)fails.push(id+': '+l.length+' loser slots, want '+fx.want.l);
 const all=log.join(' ');if(fx.want.noUp&&!/No top-50 coin up over 24h/.test(all))fails.push(id+': missing "No top-50 coin up over 24h"');
 if(fx.want.noDown&&!/No top-50 coin down over 24h/.test(all))fails.push(id+': missing "No top-50 coin down over 24h"');
 if(fx.want.keep&&!g.some(x=>new RegExp('\\b\\$?'+fx.want.keep+'\\b').test(x[1])))fails.push(id+': calm real coin '+fx.want.keep+' (+0.12%) dropped from gainers');
 for(const [s] of YIELD)if(new RegExp('\\b\\$?'+s+'\\b','i').test(slots.map(x=>x[1]).join(' ')))fails.push(id+': '+s+' shown as a mover');}

// history fixture: heatmap items + pulse
{const r=await p.evaluate(top=>{const save=D.top;D.top=top;let h=null,e=null;try{h=heatItems().map(c=>String(c.symbol).toUpperCase())}catch(x){e=String(x)}
  const P=CanvasRenderingContext2D.prototype,of=P.fillText,log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
  try{render8k((x,w,h)=>drawCard(x,w,h,'heat'),1920,1080)}catch(x){log.push('ERR '+x)}P.fillText=of;D.top=save;return {h,e,log}},HIST);
 out['history heatItems']=JSON.stringify(r.h);out['history heat card']=r.log.join(' | ');
 if(r.e)fails.push('history: heatItems() threw '+r.e);
 if(r.h){for(const s of HWANT.out)if(r.h.includes(s))fails.push('history: '+s+' kept in heatmap (24h, 7d/30d and close-to-close sd all say yield token)');
  for(const s of HWANT.keep)if(!r.h.includes(s))fails.push('history: real coin '+s+' dropped from heatmap')}
 for(const s of HWANT.out)if(r.log.some(t=>new RegExp('^\\$?'+s+'$','i').test(t.trim())))fails.push('history: '+s+' drawn on heatmap export')}
await b.close();require('fs').writeFileSync(__dirname+'/pulse-movers.last.json',JSON.stringify(out,null,1));
const u=[...new Set(fails)];console.log('pulse movers: '+Object.keys(FIX).length+' fixtures x 2 ratios + history fixture ('+HIST.map(c=>c.symbol.toUpperCase()+' sd '+sd(c.closes30).toFixed(3)+'%/d 7d '+c.price_change_percentage_7d_in_currency.toFixed(2)+' 30d '+c.price_change_percentage_30d_in_currency.toFixed(2)).join('; ')+'), '+u.length+' failures');u.forEach(f=>console.log('FAIL '+f));process.exit(u.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
