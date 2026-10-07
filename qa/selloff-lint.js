// "sell-off" lint fixture (ruling 7 Oct 23:52 IST). Usage: node qa/selloff-lint.js [URL]. Exit 1 = block.
// PASS = app lintBanned() returns no "Banned phrase" for it; FAIL = it must return one.
const {chromium}=require('playwright-core');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const H='Bitcoin price drops to $82.7K October low as bond sell-off resumes on Iran nerves';
const PASS=[[H,H],['"'+H+'" (Cointelegraph)',H],['BTC fell 4% to $82.7K as the bond sell-off resumed.',''],['A selloff in long bonds pushed the 10-year yield up.',''],['The sell-off took BTC to its October low.','']];
const MUST=['Time to sell.','Sell now.','This is a selling opportunity.','Sell BTC here.','Sell off your alts before the close.','Sell-off incoming, sell now.','Buy the dip.','Buying zone for ETH.'];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:412,height:915}});
await p.goto(URL+'?v='+Date.now(),{waitUntil:'networkidle',timeout:90000});await p.waitForTimeout(5000);
const r=await p.evaluate(({PASS,MUST})=>{const ban=(t,ex)=>lintBanned(t,ex||'',false).filter(x=>/^Banned phrase/.test(x));
 return {pass:PASS.map(([t,ex])=>[t,ban(t,ex)]),must:MUST.map(t=>[t,ban(t,'')])}},{PASS,MUST});await b.close();
const f=[];r.pass.forEach(([t,l])=>{if(l.length)f.push('flagged but should pass: "'+t+'": '+l.join(' '))});r.must.forEach(([t,l])=>{if(!l.length)f.push('not flagged but is a call: "'+t+'"')});
console.log('sell-off lint: '+(PASS.length+MUST.length)+' cases, '+f.length+' failures');f.forEach(x=>console.log('FAIL '+x));process.exit(f.length?1:0)})().catch(e=>{console.error(e);process.exit(2)});
