// trare_ui.js (19 Nov 2026): rare signals in the app. Frozen gate (node -r ./freeze/preload.js).
// (a) index.html inlines shared/rare.js verbatim (rare:begin/rare:end). (b) Chart tab: a note under every rare-signal chart (10 series) plus the
// notes under the main chart; no note says "not rare"; each note has a source and a UTC date. (c) Posting desk: the TEST-FIXTURE example is labelled
// and Copy / Open in X / export / share stay off for it. (f) CNG 19 Nov: card headline without timestamp in <=2 lines, OI post shape, Share to X primary and first (Chart tab + Studio), @RPTIME. (d) A live rare reading: Copy and share are on only while the audit passes; an edit that
// breaks a check turns them off at once; stale data turns them off. (e) No page errors.
const p=require('puppeteer-core'),fs=require('fs'),path=require('path');const URL=process.env.URL||'http://localhost:8765/index.html';
const F=[];const ok=(c,n,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?' :: '+JSON.stringify(x).slice(0,900):''));if(!c)F.push(n)};
const H=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),SRC=fs.readFileSync(path.join(__dirname,'../shared/rare.js'),'utf8');
{const m=H.match(/\/\/ rare:begin[^\n]*\n([\s\S]*?)\/\/ rare:end\n/);ok(m&&m[1]===SRC,'(a) index.html inlines shared/rare.js verbatim')}
(async()=>{const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 try{for(const vp of [{width:1366,height:900},{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]){const nm=vp.width<500?'phone':'desktop';
  const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(URL,{waitUntil:'domcontentloaded',timeout:120000});await pg.waitForFunction(()=>typeof tab==='function'&&typeof RARE==='object',{timeout:60000});
  await pg.evaluate(()=>tab('chart'));await pg.waitForFunction(()=>document.querySelectorAll('#rareBox [data-rs]').length>=10,{timeout:180000}).catch(()=>{});
  const C=await pg.evaluate(()=>({cards:[...document.querySelectorAll('#rareBox [data-rs]')].map(e=>({k:e.dataset.rs,st:e.dataset.status,note:e.querySelector('[data-rnote]')?.textContent||'',cv:!!e.querySelector('canvas')})),ch:[...document.querySelectorAll('#chRare [data-rline]')].map(e=>e.textContent),sum:document.querySelector('[data-rsum]')?.textContent||''}));
  const live=C.cards.filter(c=>!c.k.startsWith('fx-'));
  ok(live.length===10&&['oi7','oilvl','etf_btc','etf_eth','dgs10','t10y2y','dollar','link','funding','basis'].every(k=>live.some(c=>c.k===k)),`(b) ${nm}: a rare-signal card for each of the 10 series`,live.map(c=>c.k));
  ok(live.every(c=>c.note.length>30&&(c.st==='missing'||/Source: /.test(c.note)&&/\d{1,2} [A-Z][a-z]{2}/.test(c.note))),`(b) ${nm}: every note has a source and the data's own date`,live.map(c=>c.note.slice(0,80)));
  ok(C.cards.every(c=>!/not rare/i.test(c.note))&&!/not rare/i.test(C.sum)&&C.ch.every(t=>!/not rare/i.test(t)),`(b) ${nm}: no note says "not rare"`);
  ok(live.filter(c=>c.st==='normal').every(c=>/Within its normal range/.test(c.note)),`(b) ${nm}: no-signal notes read "Within its normal range"`);
  ok(live.filter(c=>c.st!=='missing').every(c=>c.cv),`(b) ${nm}: each note sits under its own chart`);
  ok(C.ch.length>=1,`(b) ${nm}: notes under the main chart (BTC: open interest + ETF)`,C.ch);
  const fx=C.cards.find(c=>c.k==='fx-oi7');ok(!fx||await pg.evaluate(()=>/EXAMPLE · TEST FIXTURE · NOT LIVE DATA/.test(document.querySelector('[data-rs="fx-oi7"]').textContent)),`(c) ${nm}: the example card is labelled TEST FIXTURE`);
  await pg.evaluate(()=>document.querySelector('[data-rd="oi7"]').click());const det=await pg.evaluate(()=>document.querySelector('[data-rdet="oi7"]').innerText);ok(/percentile/i.test(det)&&/180 days/.test(det)&&/Past cases/.test(det)&&!/what followed|last time/i.test(det),`(b) ${nm}: details panel: thresholds, 180-day window, past cases as a count only`,det.slice(0,300));
  const hasFx=await pg.evaluate(()=>!!RSX);
  if(hasFx){await pg.evaluate(()=>openRare('fx-oi7'));await pg.waitForSelector('#rareTA',{timeout:20000});await new Promise(r=>setTimeout(r,300));
   const S=await pg.evaluate(()=>({ban:/EXAMPLE · TEST FIXTURE/.test(document.querySelector('#capBox').textContent),desk:!!document.querySelector('#rareDesk .rfxb'),copy:$('#rareCopy').disabled,x:$('#rareX').disabled,sh:$('#stShare').disabled,ex:$('#stExp').disabled,aud:$('#rareAud').innerText,ratio:$('#stRatio').value}));
   ok(S.ban&&S.desk,`(c) ${nm}: the example is labelled in the desk and in the post editor`,S);
   ok(S.copy&&S.x&&S.sh&&S.ex,`(c) ${nm}: Copy, Open in X, export and share are off for the example`,S);
   ok(/Audit passed/.test(S.aud)&&S.ratio!=='16:9',`(c) ${nm}: the audit runs on the example (passes) and the card is 4:5 / 1:1`,S);
   const blk=await pg.evaluate(()=>{let n=0;const o=window.exportPNG;window.exportPNG=()=>{n++};$('#stShare').disabled=false;$('#stShare').click();$('#stExp').disabled=false;$('#stExp').click();window.exportPNG=o;return n});ok(blk===0,`(c) ${nm}: a forced click on share/export still exports nothing for the example`)}
  else ok(false,`(c) ${nm}: example fixture built`);
  const D=await pg.evaluate(async()=>{const D=JSON.parse(JSON.stringify(RSIN.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=P[P.length-8][2]*0.78;RSIN={...RSIN,derivs:D,stale:{}};RS=RARE.build(RSIN);RSAT=Date.now();
    const s=RS.find(x=>x.id==='oi7');if(s.status!=='rare')return{st:s.status,note:s.note};openRare('oi7');await new Promise(r=>setTimeout(r,400));const g=()=>({copy:$('#rareCopy').disabled,x:$('#rareX').disabled,sh:$('#stShare').disabled,aud:$('#rareAud').innerText.split('\n')[0]});
    const a=g();const ta=$('#rareTA');const v0=ta.value;ta.value=v0.replace('in the 7 days','in the 7 days, bullish');ta.dispatchEvent(new Event('input',{bubbles:true}));const bb=g();
    ta.value=v0;ta.dispatchEvent(new Event('input',{bubbles:true}));const c=g();RSIN={...RSIN,stale:{oi7:'Data stale, 6h0m old, past 5h limit (OKX).'}};RS=RARE.build(RSIN);CAPK='';makeDraft();const d=g();return{st:s.status,a,bb,c,d}});
  ok(D.st==='rare'&&!D.a.copy&&!D.a.x&&!D.a.sh&&/passed/.test(D.a.aud),`(d) ${nm}: a live rare reading that passes the audit: Copy, Open in X and share on`,D);
  ok(D.bb&&D.bb.copy&&D.bb.x&&D.bb.sh&&/failed/.test(D.bb.aud),`(d) ${nm}: an edit adding a banned word turns Copy, Open in X and share off`,D.bb);
  ok(D.c&&!D.c.copy&&D.d&&D.d.copy&&D.d.sh,`(d) ${nm}: restoring the text re-enables; stale data turns them off`,{c:D.c,d:D.d});
  const N=await pg.evaluate(async()=>{const D=JSON.parse(JSON.stringify(RSIN.derivs)),P=D.assets.BTC.oi_daily.points;P[P.length-1][2]=P[P.length-8][2]*0.78;RSIN={...RSIN,derivs:D,stale:{}};RS=RARE.build(RSIN);RSAT=Date.now();CAPK='';openRare('oi7');await new Promise(r=>setTimeout(r,400));
    const fst=el=>{const b=[...el.querySelectorAll('button')].filter(b=>b.offsetParent);return b[0]};const ch=document.querySelector('#s-chart [data-x="chartx"]').parentElement,st=$('#stShare').parentElement;
    const pos=(el,sel)=>{const x=el.querySelector(sel).getBoundingClientRect();return[x.top,x.left]};
    return{rc:RARECARD,post:$('#rareTA').value.split('\n')[0],stFirst:st.querySelector('button').id,stPri:$('#stShare').classList.contains('pri')&&!$('#stExp').classList.contains('pri'),chFirst:ch.querySelector('button').dataset.x,chPri:ch.querySelector('[data-x="chartx"]').classList.contains('pri')&&!ch.querySelector('[data-x="chart"]').classList.contains('pri'),
     stAhead:(([t1,l1],[t2,l2])=>t1<t2||t1===t2&&l1<l2)(pos(st,'#stShare'),pos(st,'#stExp')),chAhead:!!(ch.querySelector('[data-x="chartx"]').compareDocumentPosition(ch.querySelector('[data-x="chart"]'))&4)&&getComputedStyle(ch).flexDirection==='row',hdl:HDL(),hdlx:HDLX()}});
  ok(N.rc&&N.rc.lines<=2&&!/UTC|\d\d:\d\d/.test(N.rc.head)&&/^BTC open interest on OKX: −\d+\.\d% in 7 days$/.test(N.rc.head),`(f) ${nm}: card headline "BTC open interest on OKX: −X% in 7 days", no timestamp, ≤2 lines`,N.rc);
  ok(/^\$BTC perpetual open interest on OKX: −\d+\.\d% in the 7 days to \d{1,2} [A-Z][a-z]{2} \(−[\d,]+ BTC\)(, to [\d,]+ BTC)?\.$/.test(N.post),`(f) ${nm}: post line 1 has CNG's shape ("in the 7 days to <date>", no time)`,N.post);
  ok(N.stFirst==='stShare'&&N.stPri&&N.stAhead,`(f) ${nm}: Studio: Share to X is primary and ahead of Save image`,N);
  ok(N.chFirst==='chartx'&&N.chPri&&N.chAhead,`(f) ${nm}: Chart tab: Share to X is primary and ahead of Save image`,N);
  ok(N.hdl===''&&N.hdlx==='@RPTIME',`(f) ${nm}: until HANDLE_CONFIRMED, live exports get no handle (HDL() is empty); the example card keeps @RPTIME`,N);
  ok(N.rc&&N.rc.handle===null,`(g) ${nm}: a live rare card shows no handle until RP confirms it`,N.rc);
  // ---------- round 3: notes as 2 lines, button labels, thresholds, handle, phone live price
  const G=await pg.evaluate(async()=>{tab('chart');await new Promise(r=>setTimeout(r,300));const n=[...document.querySelectorAll('#rareBox [data-rnote], #chRare [data-rline]')].map(e=>{const a=e.querySelector('.rn1'),b=e.querySelector('.rn2');return{a:a&&a.textContent,b:b&&b.textContent,aw:a&&getComputedStyle(a.querySelector('b')||a).fontWeight,bf:b&&parseFloat(getComputedStyle(b).fontSize),af:a&&parseFloat(getComputedStyle(a).fontSize),hA:a&&a.getBoundingClientRect().height,hB:b&&b.getBoundingClientRect().height,lh:a&&parseFloat(getComputedStyle(a).lineHeight)}});
   const lab=[...document.querySelectorAll('button')].map(b=>b.textContent.trim());const stale=[...document.querySelectorAll('#rareBox [data-rs][data-status="stale"] .bias, #chRare [data-status="stale"] .bias')].map(b=>b.textContent);
   const oi=RS.find(s=>s.id==='oi7');TX=[];const L=axLog;let live=null;window.axLog=o=>{if(o&&o.fn==='chartLive')live=o;return L(o)};try{const cv=document.createElement('canvas');const w=innerWidth<700?390:1366;cv.width=w*2;cv.height=600;drawChart(cv.getContext('2d'),cv.width,cv.height,{...CH,cross:null})}catch(e){}window.axLog=L;
   return{n,lab,stale,thr:oi&&oi.thr,noteTxt:[...document.querySelectorAll('#rareBox [data-rnote]')].map(e=>e.textContent).join('\n'),live,stX:!!document.getElementById('stX'),hc:typeof HANDLE==='string'?HANDLE:null,hconf:typeof HANDLE_CONFIRMED==='boolean'?HANDLE_CONFIRMED:null}});
  ok(G.n.length>=10&&G.n.every(x=>x.a&&x.b&&+x.aw>=700&&x.bf<x.af),`(g) ${nm}: every note = bold line 1 (reading · verdict) + smaller grey line 2`,G.n.slice(0,3));
  ok(G.n.every(x=>x.hA<=x.lh*3.2&&x.hB<=x.lh*4.5),`(g) ${nm}: no 6–8 line note paragraphs (line 1 ≤ 3 lines, line 2 ≤ 4)`,G.n.map(x=>[Math.round(x.hA),Math.round(x.hB),x.lh]));
  ok(!/stale/i.test(G.noteTxt)&&G.stale.every(t=>/Stale/.test(t)),`(g) ${nm}: stale shows only in the badge, never in the note sentence`,{st:G.stale});
  ok(G.n.some(x=>/^BTC OI [−+]\d+\.\d% in 7 days · /.test(x.a)),`(g) ${nm}: OI note line 1 reads "BTC OI −X% in 7 days · <verdict>"`,G.n.map(x=>x.a));
  ok(!G.lab.some(t=>/\b[48]K\b/.test(t))&&!G.stX&&G.lab.filter(t=>t==='Share to X').length>=2&&G.lab.filter(t=>t==='Save image').length>=2,`(g) ${nm}: buttons read "Share to X" and "Save image"; no 4K/8K label; no X 4K button`,G.lab.filter(t=>/K\b|Share|Save|Export/.test(t)));
  ok(G.thr&&/^[−+]\d+\.\d%$/.test(G.thr.lo)&&/^[−+]\d+\.\d%$/.test(G.thr.hi),`(g) ${nm}: OI 2% line labelled at one decimal (${G.thr&&G.thr.lo})`,G.thr);
  ok(G.hc==='@RPTIME'&&G.hconf===false&&(H.match(/@RPTIME/g)||[]).length===1,`(g) ${nm}: handle is one config value (HANDLE), not yet confirmed`,{hc:G.hc,n:(H.match(/@RPTIME/g)||[]).length});
  if(nm==='phone')ok(!G.live||G.live.x+G.live.w<=G.live.max+1,`(g) phone: when the live price does not fit the OHLC row it moves to the title row and fits (not clipped)`,G.live);

  // ---------- round 4 (CNG A/C + supervisor 19 Nov): handle in BOTH states, sign/number never split at phone width, Studio says "Rare signal", example 2% line = live line
  const HS=await pg.evaluate(async()=>{const P=CanvasRenderingContext2D.prototype,of=P.fillText;let log=[];P.fillText=function(t,...a){log.push(String(t));return of.call(this,t,...a)};
    const cv=()=>{const c=document.createElement('canvas');c.width=1600;c.height=2000;return c.getContext('2d')};const fx=RSX&&RSX.s,lv=RS.find(s=>s.id==='oi7');
    const jobs={chart:x=>drawChart(x,1600,900,{...CH,cross:null}),heat:x=>drawHeat(x,1600,900,true),fng:x=>drawFng(x,440,220),price:x=>drawCard(x,1600,900,'price',stCoin()),insight:x=>drawCard(x,1600,900,'insight',stCoin()),pulse:x=>drawCard(x,1600,900,'pulse'),rareLive:x=>drawRareCard(x,1600,2000,lv),rareExample:x=>drawRareCard(x,1600,2000,fx)};
    const run=()=>{const o={};for(const [k,f] of Object.entries(jobs)){log=[];try{f(cv());o[k]=log.some(t=>t.includes('@RPTIME'))}catch(e){o[k]='ERR '+e}}return o};
    const h0=S.handle;S.handle='@RPTIME';const off=run();HCONF=true;const on=run();HCONF=HANDLE_CONFIRMED;S.handle=h0;P.fillText=of;return{off,on}});
  ok(Object.entries(HS.off).every(([k,v])=>v===(k==='rareExample')),`(h) ${nm}: HANDLE_CONFIRMED=false: @RPTIME only on the example card (not the chart header, heatmap, gauge, Studio cards or live rare card)`,HS.off);
  ok(Object.values(HS.on).every(v=>v===true),`(h) ${nm}: HANDLE_CONFIRMED=true: @RPTIME on every chart, card and export`,HS.on);
  const SJ=await pg.evaluate(async()=>{tab('chart');await new Promise(r=>setTimeout(r,300));document.querySelectorAll('[data-rd]').forEach(b=>{try{b.click()}catch(e){}});await new Promise(r=>setTimeout(r,300));
    const sp=[...document.querySelectorAll('#rareBox .nw, #chRare .nw')].filter(e=>e.offsetParent);const split=sp.filter(e=>e.getClientRects().length!==1).map(e=>e.textContent);
    const t=document.createElement('p');t.className='rnote';t.style.width='70px';t.innerHTML=escN('US spot $ETH ETFs: net outflow (−$239.9M) in 3 days, −19.2% and +18 bp');document.querySelector('#rareBox').appendChild(t);
    const syn=[...t.querySelectorAll('.nw')].map(e=>[e.textContent,e.getClientRects().length]);t.remove();
    const ws=[...document.querySelectorAll('#rareBox [data-rnote], #chRare [data-rline]')].map(e=>e.innerHTML).join(' ');const bare=(ws.replace(/<span class="nw">[^<]*<\/span>/g,'').match(/[+\u2212$]\d[\d,.]*/g)||[]);
    return{n:sp.length,split,syn,bare}});
  ok(SJ.n>=10&&!SJ.split.length&&!SJ.bare.length,`(h) ${nm}: every sign/currency+number in the notes and details is one unbreakable token (${SJ.n} tokens, none split)`,SJ);
  ok(SJ.syn.length===3&&SJ.syn.every(([t,n])=>n===1)&&SJ.syn.some(([t])=>t==='(−$239.9M)'),`(h) ${nm}: a 70px-wide note never splits "(−$239.9M)", "−19.2%" or "+18 bp"`,SJ.syn);
  const SEL=await pg.evaluate(async()=>{openRare('fx-oi7');await new Promise(r=>setTimeout(r,300));const a=$('#stType').selectedOptions[0].textContent;const lv=RARE.build(RSIN).find(s=>s.id==='oi7'),ex=RARE.build(RARE.FX.oiDrop(RSIN)).find(s=>s.id==='oi7');/* rebuilt from the current inputs (section d changed them) */
    const th={fx:ex.thr,lv:lv.thr,fxp2:ex.j.p2,lvp2:lv.j.p2};$('#stType').value='price';$('#stType').dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,200));return{a,b:$('#stType').selectedOptions[0].textContent,th}});
  ok(SEL.a==='Rare signal'&&SEL.b==='Price card',`(h) ${nm}: Studio type selector reads "Rare signal" on a rare-signal card`,SEL);
  ok(SEL.th.fx.lo===SEL.th.lv.lo&&SEL.th.fxp2===SEL.th.lvp2,`(h) ${nm}: the example card's 2% line is the live firing line (${SEL.th.lv.lo}), not one recomputed with the example bucket`,SEL.th);
  ok(!errs.length,`(e) ${nm}: no page errors`,errs);await pg.close()}}
 catch(e){ok(false,'run',String(e))}finally{await b.close()}
 console.log('FAILS: '+F.length);process.exit(F.length?1:0)})();
