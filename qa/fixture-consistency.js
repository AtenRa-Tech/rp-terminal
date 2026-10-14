// CRYPTO GOD fixture-consistency check. Usage: node qa/fixture-consistency.js. Exit 1 = block.
// Fails when any derivs fixture's `latest` timestamp is newer than the end of its own series beyond that metric's limit.
const fs=require('fs'),path=require('path'),H=36e5;
const LIM={oi_t:['oi_hourly',3*H],funding_t:['funding',12*H],basis_t:['basis_hourly',3*H]};
const dir=path.join(__dirname,'fixtures');let bad=0,n=0;
for(const f of fs.readdirSync(dir).filter(x=>/^derivs.*\.json$/.test(x))){const d=JSON.parse(fs.readFileSync(path.join(dir,f)));
 for(const[a,v]of Object.entries(d.assets||{})){const L=v.latest||{};for(const[k,[s,lim]]of Object.entries(LIM)){if(L[k]==null||!v[s]?.points?.length)continue;n++;
  const end=v[s].points.at(-1)[0],gap=L[k]-end;if(gap>lim||gap<0){bad++;console.log(`FAIL ${f} ${a} latest.${k} vs ${s} end: gap ${(gap/H).toFixed(1)}h (limit ${lim/H}h)`)}
  if(v[s].last!=null&&v[s].last!==end){bad++;console.log(`FAIL ${f} ${a} ${s}.last != last point`)}}}}
console.log(`fixture-consistency: ${n} checks, ${bad} failures`);process.exit(bad?1:0);
