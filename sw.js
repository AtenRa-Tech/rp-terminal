// RP Terminal service worker (E5): offline reload shows the last state.
// App shell: network-first with cache fallback. data/*.json: network-first, cached copy when offline.
// Third-party APIs are never intercepted (the app has its own fallbacks and a saved copy in localStorage).
const V='rpt-v1',SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  const key=u.pathname.endsWith('.json')?u.origin+u.pathname:r; // data files: one cached copy regardless of ?v= cache-buster
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(key,cp))}return res}).catch(()=>caches.match(key,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):undefined)).then(m=>m||Response.error())))});
