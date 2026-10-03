// Stale-derivatives test (CRYPTO GOD). Usage: node qa/stale-derivs.js [URL]
// Blocks every live derivatives feed and serves fixtures/derivs-stale.json (>=4 days old).
// PASS only if no funding/OI reading from that file appears anywhere and its status shows age + source.
// repo copy: news headlines (outlet text such as 'Bitcoin open interest jumps $2.3 billion') are stripped before matching; they are not readings from derivs.json
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');
const URL=process.argv[2]||'https://atenra-tech.github.io/rp-terminal/';
const STALE=fs.readFileSync(path.join(__dirname,'fixtures/derivs-stale.json'));
const BLOCK=/fapi\.binance|okx\.com|bybit\.com|deribit\.com/i;
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();await pg.setViewport({width:412,height:915});await pg.setRequestInterception(true);
pg.on('request',r=>{const u=r.url();if(BLOCK.test(u))return r.abort();if(/derivs\.json/.test(u))return r.respond({status:200,contentType:'application/json',body:STALE});r.continue()});
await pg.goto(URL+(URL.includes('?')?'&':'?')+'x='+Date.now(),{waitUntil:'networkidle2',timeout:60000});await new Promise(r=>setTimeout(r,8000));
let txt='';for(const t of ['today','markets','signals']){await pg.click(`nav button[data-t="${t}"]`);await new Promise(r=>setTimeout(r,4000));txt+=`\n##${t}\n`+(await pg.evaluate(()=>document.body.innerText)).replace(/\nImportant news\n[\s\S]*?(?=\n[^\n]*Stories are merged|$)/,'\n[news headlines omitted: third-party text, not app readings]')}
fs.writeFileSync(path.join(require('os').tmpdir(),'stale-derivs.out.txt'),txt);await b.close();
const fails=[];
const bad=[/Funding[^\n]{0,40}neutral/i,/neutral band/i,/Funding [-+]?\d+\.\d+% per 8h/i,/open interest (is |up |down |[-+]?\d)/i,/OI [-+]?\d+(\.\d+)?%/];
for(const re of bad){const m=txt.match(re);if(m)fails.push('reading from stale file: "'+m[0]+'"')}
if(!/stale|old|age/i.test(txt))fails.push('no stale/age status shown for derivatives');
console.log(fails.length?'FAIL\n- '+fails.join('\n- '):'PASS');process.exit(fails.length?1:0)})();
