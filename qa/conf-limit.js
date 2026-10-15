// Supervisor 15 Oct: data confidence is FULL while an input is within its freshness limit and reduced only past it.
// For each scored signal without a fixed confidence: lastT at (limit - 1 min) => full (85, or 70 single-source); (limit + 1 min) => reduced (-30).
const p=require('puppeteer-core');const URL=process.argv[2]||'http://localhost:8765/index.html';
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
 await pg.goto(URL,{waitUntil:'networkidle2',timeout:120000});await pg.waitForFunction(()=>typeof SIG!=='undefined'&&SIG&&SIG.filter(s=>s.score!=null).length>=8,{timeout:120000});
 const R=await pg.evaluate(()=>{const out=[];for(const s0 of SIG){if(s0.confFix||s0.score==null)continue;const lim=confLimD(s0),full=s0.single?70:85;
   const at=dm=>{const s=Object.assign({},s0);s.lastT=Date.now()-(lim*864e5+dm*6e4);delete s.audit;oppScore(s);return s.opp.conf[0]};
   out.push({id:s0.id,lim,full,in:at(-1),out:at(1),fresh:at(-lim*1440+60)})}return out});
 await b.close();const F=[];for(const r of R){if(r.in!==r.full)F.push(`${r.id}: limit-1min confidence ${r.in} != full ${r.full}`);if(r.fresh!==r.full)F.push(`${r.id}: 1h old confidence ${r.fresh} != full ${r.full} (no slide inside the limit)`);if(!(r.out<r.full))F.push(`${r.id}: limit+1min confidence ${r.out} not reduced`)}
 console.log(R.map(r=>`${r.id} lim ${r.lim}d: 1h ${r.fresh}, lim-1m ${r.in}, lim+1m ${r.out}`).join('\n'));if(R.length<5)F.push('only '+R.length+' signals checked');
 console.log(F.length?'FAIL\n- '+F.join('\n- '):`PASS ${R.length} signals: full confidence up to limit-1min, reduced at limit+1min`);process.exit(F.length?1:0)})();
