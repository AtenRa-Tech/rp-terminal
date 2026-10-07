// ONE dollar-token list (supervisor ruling 7 Oct): the app constant DOLLAR_TOKENS, shared/dollar-tokens.json and scripts/fetch_market.py STABLE must match.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const R=path.join(__dirname,'..'),fails=[],ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c?'':' → '+JSON.stringify(x).slice(0,300)));if(!c)fails.push(m)};
const J=JSON.parse(fs.readFileSync(path.join(R,'shared/dollar-tokens.json'),'utf8'));
const html=fs.readFileSync(path.join(R,process.env.APP_FILE||'index.html'),'utf8'),m=html.match(/const DOLLAR_TOKENS=(\{.*?\});\/\/ verbatim/);
ok(!!m,'app embeds DOLLAR_TOKENS');const A=m?JSON.parse(m[1]):{};
const eq=(a,b)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort());
ok(eq(A.stable,J.stable),'app stable list = shared/dollar-tokens.json',{onlyApp:(A.stable||[]).filter(x=>!J.stable.includes(x)),onlyJson:J.stable.filter(x=>!(A.stable||[]).includes(x))});
ok(eq(A.yield,J.yield),'app yield-token list = shared/dollar-tokens.json',A.yield);
ok(JSON.stringify(A.calm)===JSON.stringify(J.calm),'app second-check thresholds = shared',A.calm);
ok(/const HSTABLE=new Set\(DOLLAR_TOKENS\.stable\)/.test(html)&&/YIELDTOK=new Set\(DOLLAR_TOKENS\.yield\)/.test(html),'app sets are built from DOLLAR_TOKENS (no second hard-coded list)');
for(const s of 'USYC BUIDL USDY OUSG SUSDE SUSDS SDAI USTB BENJI'.split(' '))ok(J.yield.includes(s),'yield token '+s+' listed');
let P=null;try{P=JSON.parse(execFileSync('python3',['-c',"import sys,json,importlib.util as u;sys.argv=['x'];sp=u.spec_from_file_location('fm',sys.argv[0] if 0 else 'scripts/fetch_market.py');m=u.module_from_spec(sp);sp.loader.exec_module(m);print(json.dumps({'stable':sorted(m.STABLE),'calm':m.CALM,'src':open('scripts/fetch_market.py').read().count('STABLE = {')}))"],{cwd:R}).toString())}catch(e){ok(false,'import scripts/fetch_market.py',String(e).slice(0,200))}
if(P){ok(eq(P.stable,[...J.stable,...J.yield]),'script STABLE = shared stable + yield',{onlyScript:P.stable.filter(x=>!J.stable.includes(x)&&!J.yield.includes(x))});
 ok(JSON.stringify(P.calm)===JSON.stringify(J.calm),'script second-check thresholds = shared',P.calm);ok(P.src===0,'script has no hard-coded STABLE set',P.src)}
console.log('FAILS:',fails.length,JSON.stringify(fails));process.exit(fails.length?1:0);
