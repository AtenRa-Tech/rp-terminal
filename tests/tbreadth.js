// tbreadth.js: runs tests/tbreadth.py (fetch_market.py breadth rebuilt in full with the current coin list) so run-all.sh covers it.
const {spawnSync}=require('child_process');const r=spawnSync('python3',[__dirname+'/tbreadth.py'],{encoding:'utf8'});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status===0?0:1);
