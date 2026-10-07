// tbanned.js: ONE banned-word source (supervisor ruling 8 Oct). shared/banned-words.json is the only list: the app inlines it (BANNED_WORDS) and builds
// lintBanned/lintText/news-filter rules from it; qa/caption-sweep.js reads the file. FAILS if either keeps its own list, if the inline copy differs,
// if India/INR stops being covered by the shared 'region' rule, or if the narrow 'sell-off' noun exception lets a sell/buy call through. URL=... node tests/tbanned.js
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html',ROOT=process.env.ROOT||path.join(__dirname,'..');
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,700):''));if(!c)F.push(n)};
const BW=JSON.parse(fs.readFileSync(path.join(ROOT,'shared/banned-words.json'),'utf8')),H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),S=fs.readFileSync(path.join(ROOT,'qa/caption-sweep.js'),'utf8');
const code=src=>src.split('\n').filter(l=>!/^\s*\/\//.test(l)).map(l=>l.replace(/\/\/ .*$/,'')).join('\n');
// --- static: one list
ok(['region','banned','rule1','risky','captions','sell_off_noun'].every(k=>BW[k])&&BW.rule1.every(r=>Array.isArray(r)&&typeof r[0]==='string'),'shared/banned-words.json has every section (region, banned, rule1, risky, captions, sell_off_noun)');
const m=H.match(/^const BANNED_WORDS=(\{.*\});$/m);let inl=null;try{inl=m&&JSON.parse(m[1])}catch(e){}
ok(inl&&JSON.stringify(inl)===JSON.stringify(BW),'app: inline BANNED_WORDS equals shared/banned-words.json exactly',m?'differs':'no BANNED_WORDS line');
const HL=code(H).split('\n').filter(l=>!/^const BANNED_WORDS=/.test(l)).join('\n');
const appOwn=[/^const (BANNED|RULE1|RISKY)=\[\[\//m,/REGION_RE=\//,/wazirx|crores|lakhs|rupees/i,/buy\(ing\)|buy\[- \]zone|buy the dip|time to buy|bullish\|bearish|accumulat\(e/i].filter(re=>re.test(HL)).map(String);
ok(!appOwn.length,'app: no word list of its own outside BANNED_WORDS (lintBanned, lintText, news filter all read the shared rules)',appOwn);
const SC=code(S);const swOwn=[/const BANNED=\[\//,/\/\\b[^\n]{0,40}(india|rupee|inr|lakh|buy|sell|bullish|accumulat|historically|always|never|guarantee)/i].filter(re=>re.test(SC)).map(String);
ok(!swOwn.length&&/'shared','banned-words\.json'/.test(S)&&/BW\.captions/.test(S)&&/BW\.rule1/.test(S)&&/BW\.region/.test(S),'caption sweep: reads shared/banned-words.json and keeps no list of its own',swOwn);
// --- India/INR coverage through the shared source
const RG=new RegExp(BW.region[0],BW.region[1]);ok(['Bitcoin in India','priced in INR','BTC is 70 lakh','5 crore','\u20B9 price','rupee slides','WazirX volumes','SEBI rules'].every(t=>RG.test(t))&&!RG.test('Indicator: ETH/BTC breadth index'),'India/INR bans covered by the shared region rule (whole words; "indicator" untouched)');
// --- sell-off cases (same as qa/selloff-lint.js plus extra calls), node side = the sweep's reading of the file
const HD='Bitcoin price drops to $82.7K October low as bond sell-off resumes on Iran nerves';
const PASS=[[HD,HD],['"'+HD+'" (Cointelegraph)',''],['BTC fell 4% to $82.7K as the bond sell-off resumed.',''],['A selloff in long bonds pushed the 10-year yield up.',''],['The sell-off took BTC to its October low.',''],['Equities extended a sharp sell-off overnight.','']];
const MUST=['Time to sell.','Sell now.','This is a selling opportunity.','Sell BTC here.','Sell off your alts before the close.','Sell-off incoming, sell now.','The sell-off is here, sell now.','Buy the dip.','Buying the dip on ETH.','Buying zone for ETH.','Buy zone reached.','Buy signal on BTC.','Accumulate here.','Load up before the halving.','Bullish setup.'];
const R1=BW.rule1.map(x=>new RegExp(x[0],x[1])),BN=BW.banned.map(x=>new RegExp(x[0],x[1])),SON=BW.sell_off_noun,strip=t=>t.replace(new RegExp(SON.headline[0],'g'+SON.headline[1]),' ').replace(new RegExp(SON.noun[0],'g'+SON.noun[1]),' ');
const sw=(t,ex)=>{const T=ex?t.split(ex).join(' '):t;return BN.some(r=>r.test(t))||R1.some(r=>r.test(strip(T)))};
ok(PASS.every(([t,e])=>!sw(t,e)),'shared rules (sweep reading): sell-off as a noun naming a market move / quoted headline with source passes',PASS.filter(([t,e])=>sw(t,e)).map(x=>x[0]));
ok(MUST.every(t=>sw(t,'')),'shared rules (sweep reading): every sell call and buy call is still banned',MUST.filter(t=>!sw(t,'')));
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL+(URL.includes('?')?'&':'?')+'v='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});await pg.waitForFunction(()=>typeof lintBanned==='function'&&window.RPT_WORDS,{timeout:90000}).catch(()=>{});
const r=await pg.evaluate(({PASS,MUST})=>{const ban=(t,ex)=>lintBanned(t,ex||'',false).filter(x=>/^Banned phrase|^Regional/.test(x));
 return{src:JSON.stringify(RPT_WORDS.src),same:RPT_WORDS.rule1.map(x=>x[0].source+'/'+x[0].flags).join('|'),reg:REGION_RE.source,news:NEWSDROP===REGION_RE,risky:RISKY.map(x=>x[0].source).join('|'),
  pass:PASS.map(([t,e])=>[t,ban(t,e)]),must:MUST.map(t=>[t,ban(t,'')]),india:['Bitcoin in India','priced in INR','BTC is 70 lakh'].map(t=>lintBanned(t,'',false).some(x=>/^Regional content/.test(x)))}},{PASS,MUST});
ok(r.src===JSON.stringify(BW),'app at runtime: RPT_WORDS.src is the shared file');
ok(r.same===BW.rule1.map(x=>new RegExp(x[0],x[1])).map(x=>x.source+'/'+x.flags).join('|')&&r.reg===RG.source&&r.news&&r.risky===BW.risky.map(x=>new RegExp(x[0],x[1]).source).join('|'),'app at runtime: rule-1, region (news filter too) and risky rules are the shared ones');
ok(r.india.every(Boolean),'app lintBanned: India/INR terms flagged as regional content',r.india);
ok(r.pass.every(x=>!x[1].length),'app lintBanned: sell-off noun / quoted headline passes',r.pass.filter(x=>x[1].length));
ok(r.must.every(x=>x[1].length),'app lintBanned: every sell call and buy call flagged',r.must.filter(x=>!x[1].length).map(x=>x[0]));
ok(!errs.length,'no page errors',errs.slice(0,5));
await b.close();console.log('\nFAILS:',F.length,JSON.stringify(F));process.exit(F.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
