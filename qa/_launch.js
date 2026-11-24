// Browser launch with ONE retry (24 Nov). data.yml run 44847233870 (21 Nov 01:09Z): the live smoke died on "Timed out after 30000 ms while waiting
// for the WS endpoint URL to appear in stdout" - Chrome was slow to start on the runner, the site was fine - and that red smoke rolled live back.
// First try: 60s launch timeout (puppeteer's default is 30s). On failure: log it and retry ONCE with 120s. Only the launch is retried, never a page
// load or a check. Works for puppeteer and playwright: pass a function that launches with the given options. Tests: tests/tlaunch.js.
const FIRST_MS=60000,RETRY_MS=120000;
async function launchRetry(launch,opts={},{first=FIRST_MS,retry=RETRY_MS,log=m=>console.log(m)}={}){
 try{return await launch({...opts,timeout:first})}
 catch(e){log(`browser launch failed after ${first/1000}s timeout (${String((e&&e.message)||e).split('\n')[0].slice(0,200)}); retrying ONCE with a ${retry/1000}s timeout`);
  return await launch({...opts,timeout:retry})}}
module.exports={launchRetry,FIRST_MS,RETRY_MS};
