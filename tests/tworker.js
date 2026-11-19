// 17 Nov: Cloudflare Worker refresh timer (worker/src/index.js). Node only, NO network: every fetch is mocked (any unmocked URL fails the test).
// Supervisor cases: fresh -> no dispatch; run queued/in progress -> no dispatch; stale derivatives -> exactly one dispatch;
// daily batch due -> one dispatch (full=true); heartbeat /fail on a stale feed. Plus parity with data_age.py / refresh_slot.py.
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); const fails = [];
const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c ? '' : ' :: ' + JSON.stringify(x))); if (!c) fails.push(m); };
const H = 3600000, NOW = Date.parse('2026-11-17T15:07:00Z'), iso = (t) => new Date(t).toISOString().replace('.000', '');
const TOKEN = 'github_pat_TESTTOKEN_never_logged', HB = 'https://hc-ping.com/11111111-2222-3333-4444-555555555555';
const SITE = 'https://atenra-tech.github.io/rp-terminal/', API = 'https://api.github.com/repos/AtenRa-Tech/rp-terminal/actions/workflows/data.yml';
const ENV = { GH_TOKEN: TOKEN, HEARTBEAT_URL: HB, REPO: 'AtenRa-Tech/rp-terminal', WORKFLOW: 'data.yml', REF: 'main', SITE_URL: SITE };
function derivs(oiH, basisH) { const a = { oi_t: NOW - oiH * H, basis_t: NOW - basisH * H, funding_t: NOW - 7 * H }; return { assets: { BTC: { latest: { ...a } }, ETH: { latest: { ...a } } } }; }
function runs(o = {}) {
  const f = (h, lim) => ({ t: iso(NOW - h * H), lim_h: lim, ok: h <= lim });
  return { last_run: iso(NOW - (o.lastRunMin ?? 50) * 60000), runs: [{ feeds: { 'BTC oi': f(o.oi ?? 3.1, 5), 'BTC basis': f(2.1, 5), 'BTC funding': f(o.funding ?? 7.1, 12), 'ETH oi': f(o.oi ?? 3.1, 5), 'ETH basis': f(2.1, 5), 'ETH funding': f(7.1, 12) } }],
    market: { updated: iso(NOW - (o.market ?? 0.2) * H), limit_h: 3 }, macro: { DGS10: { ok: true }, ...(o.macroBad ? { DEXUSEU: { ok: false, limit: '14 days (daily)' } } : {}) },
    macro_checked: { checked_at: iso(NOW - (o.macroChecked ?? 14.5) * H) } };
}
const today0025 = iso(Date.UTC(2026, 10, 17, 0, 25)), yday0025 = iso(Date.UTC(2026, 10, 16, 0, 25));
function world(o = {}) {
  return { derivs: o.derivs ?? derivs(2.1, 2.1), runs: o.runs ?? runs({ oi: 2.1 }), macro: o.macro ?? { checked_at: today0025, updated: today0025 }, etf: o.etf ?? { updated: today0025, checked_at: today0025 },
    active: o.active ?? [], lastDispatchMin: o.lastDispatchMin ?? 120, dispatchRuns: o.dispatchRuns, ghStatus: o.ghStatus ?? 200, dispatchStatus: o.dispatchStatus ?? 204, liveDown: o.liveDown ?? [] };
}
function mock(w) {
  const calls = [];
  const res = (status, j) => ({ ok: status >= 200 && status < 300, status, json: async () => j });
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const live = url.match(/^https:\/\/atenra-tech\.github\.io\/rp-terminal\/data\/(derivs|_runs|macro|etf)\.json\?v=\d+$/);
    if (live) { const k = live[1] === '_runs' ? 'runs' : live[1]; if (w.liveDown.includes(k)) return res(503, null); return res(200, JSON.parse(JSON.stringify(w[k]))); }
    if (url === `${API}/runs?per_page=30`) return res(w.ghStatus, { workflow_runs: [...w.active.map((s, i) => ({ id: 900 + i, status: s, event: 'schedule', created_at: iso(NOW - 5 * 60000) })), { id: 1, status: 'completed', event: 'schedule', created_at: iso(NOW - 50 * 60000) }] });
    if (url === `${API}/runs?event=workflow_dispatch&per_page=50`) return res(w.ghStatus, { workflow_runs: w.dispatchRuns || [{ id: 2, status: 'completed', event: 'workflow_dispatch', display_title: 'Refresh data', created_at: iso(NOW - w.lastDispatchMin * 60000) }] });
    if (url === `${API}/dispatches` && init.method === 'POST') return res(w.dispatchStatus, null);
    if (url.startsWith(HB)) return res(200, null);
    throw new Error('unmocked network call: ' + url);
  };
  return { f, calls };
}
(async () => {
  const W = await import(path.join(ROOT, 'worker/src/index.js'));
  const L = await import(path.join(ROOT, 'worker/src/limits.js'));
  async function run(w, env = ENV, now = NOW) { const m = mock(w); const logs = []; const out = await W.tick(env, { fetch: m.f, now, log: (...a) => logs.push(a.join(' ')) }); return { out, calls: m.calls, logs: logs.join('\n') }; }
  const posts = (c) => c.filter((x) => x.url === `${API}/dispatches`);
  const hb = (c) => c.filter((x) => x.url.startsWith(HB));
  const gh = (c) => c.filter((x) => x.url.startsWith('https://api.github.com/'));
  const noLeak = (r) => !r.logs.includes(TOKEN) && !r.logs.includes(HB) && !hb(r.calls).some((x) => String(x.body).includes(TOKEN)) && !r.calls.some((x) => !x.url.startsWith('https://api.github.com/') && JSON.stringify(x.headers).includes(TOKEN));

  // (a) fresh data -> no dispatch, GitHub not even asked, heartbeat ok
  let r = await run(world());
  ok(posts(r.calls).length === 0 && !r.out.dispatched && gh(r.calls).length === 0, '(a) fresh derivatives (2.1h) + batch done today: no dispatch, no GitHub API call', r.out);
  ok(hb(r.calls).length === 1 && hb(r.calls)[0].url === HB && r.out.heartbeat === 'ok 200', '(a) heartbeat: one success ping (no /fail)', hb(r.calls).map((x) => x.url));
  ok(r.calls.filter((x) => x.url.includes('github.io')).every((x) => /\?v=\d+$/.test(x.url)) && r.calls.filter((x) => x.url.includes('github.io')).length === 4, 'live derivs/_runs/macro/etf read cache-busted (?v=now)');
  r = await run(world({ derivs: derivs(2.99, 2.0) }));
  ok(posts(r.calls).length === 0, '(a) 2.99h old: still no dispatch (threshold is past 3h; exactly 3.0h is fresh)', r.out);
  r = await run(world({ derivs: derivs(3.0, 2.0) }));
  ok(posts(r.calls).length === 0 && r.out.derivs_age_h === 3, 'C4: derivatives exactly 3.0h old: no dispatch (fresh, not rounded into stale)', r.out);
  r = await run(world({ derivs: derivs((2 * H + 59 * 60000 + 59600) / H, 2.0) }));
  ok(posts(r.calls).length === 0 && r.out.derivs_age_h < 3 && !/derivatives 3\.00h/.test(r.out.reason || ''), 'C4: 2h59m59.6s is not dispatched and is not shown as 3.00h', r.out);
  r = await run(world({ derivs: derivs(3.01, 2.0), runs: runs() }));
  ok(posts(r.calls).length === 1 && r.out.derivs_age_h > 3, 'C4: derivatives 3.01h old: one dispatch', r.out);

  // (b) stale derivatives but a data.yml run queued / in progress -> no dispatch
  for (const s of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), active: [s] }));
    ok(posts(r.calls).length === 0 && /already/.test(r.out.skip || '') && r.out.problems.length === 0, `(b) stale derivs + a data.yml run ${s}: no dispatch, heartbeat stays ok`, r.out);
  }

  // (c) stale derivatives -> exactly one dispatch on main, full=false, token only to api.github.com
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs() }));
  const p = posts(r.calls);
  ok(p.length === 1 && r.out.dispatched === true, '(c) derivatives 3.1h old, nothing running: exactly ONE dispatch', r.out);
  ok(p.length === 1 && JSON.parse(p[0].body).ref === 'main' && JSON.parse(p[0].body).inputs.full === 'false' && p[0].headers.Authorization === `Bearer ${TOKEN}`, '(c) dispatch: ref main, inputs.full "false", Bearer GH_TOKEN', p[0] && p[0].body);
  ok(r.calls.filter((x) => x.method === 'POST' && x.url.startsWith('https://api.github.com/')).length === 1, '(c) no other GitHub write call');
  ok(noLeak(r), '(c) GH_TOKEN and HEARTBEAT_URL never in logs, heartbeat body or non-GitHub requests');
  r = await run(world({ derivs: derivs(2.1, 3.01), runs: runs() }));
  ok(posts(r.calls).length === 1, '(c) basis 3.01h old (OI fresh): one dispatch (oldest of oi_t / basis_t decides)', r.out);
  r = await run(world({ derivs: derivs(2.1, 3.0) }));
  ok(posts(r.calls).length === 0, 'C4: basis exactly 3.0h old (OI fresh): no dispatch', r.out);
  const D1 = derivs(2.1, 2.1); D1.assets.ETH.latest.oi_t = NOW - 3.2 * H;
  r = await run(world({ derivs: D1, runs: runs() }));
  ok(posts(r.calls).length === 1, '(c) only ETH stale: one dispatch (every asset counts)', r.out);

  // one per hour: a workflow_dispatch run created < 55 min ago blocks; 55+ min allows
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), lastDispatchMin: 54 }));
  ok(posts(r.calls).length === 0 && /min ago/.test(r.out.skip || ''), 'one per hour: dispatch created 54 min ago -> no dispatch', r.out);
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), lastDispatchMin: 56 }));
  ok(posts(r.calls).length === 1, 'one per hour: last dispatch 56 min ago -> dispatches', r.out);
  // two ticks in the same hour (e.g. a retried cron): the second sees the first dispatch (1 min old) and does nothing
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), lastDispatchMin: 1 }), ENV, NOW + 60000);
  ok(posts(r.calls).length === 0, 'second tick 1 min after a dispatch: no second dispatch', r.out);

  // daily batch due -> one dispatch with full=true
  r = await run(world({ macro: { checked_at: yday0025 }, etf: { checked_at: today0025, updated: today0025 } }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true' && r.out.batch_due, 'daily batch due (macro last fetched yesterday, derivs fresh): ONE dispatch, inputs.full "true"', r.out);
  r = await run(world({ macro: { checked_at: today0025 }, etf: { checked_at: yday0025, updated: yday0025 } }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true', 'daily batch due when ETF is the older one', r.out);
  r = await run(world({ macro: { checked_at: yday0025 }, etf: { checked_at: yday0025, updated: yday0025 } }), ENV, Date.parse('2026-11-17T00:07:00Z'));
  ok(posts(r.calls).length === 0 && r.out.batch_due === false, '00:07 UTC with yesterday 00:25 batch: not due yet (slot is 00:20)', r.out);
  r = await run(world({ macro: { checked_at: yday0025 }, active: ['in_progress'] }));
  ok(posts(r.calls).length === 0, 'batch due but a run in progress: no dispatch', r.out);

  // ETF row held back (pending: true, waiting on a fund) never makes the batch due by itself
  const etfPending = (upd, chk) => ({ updated: upd, ...(chk ? { checked_at: chk } : {}), last_date: '2026-11-13', datasets: { btc: { status: 'ok', last_date: '2026-11-13', days: [{ date: '2026-11-13', total: 120.5, pending: false }, { date: '2026-11-16', total: null, pending: true }] }, eth: { status: 'ok', last_date: '2026-11-16', days: [{ date: '2026-11-16', total: -12.0, pending: false }] } } });
  r = await run(world({ etf: etfPending(yday0025, today0025) }));
  ok(r.out.batch_due === false && posts(r.calls).length === 0 && gh(r.calls).length === 0, 'ETF newest row pending, batch ran today (checked_at today, updated yesterday because content unchanged): not due, no dispatch', r.out);
  r = await run(world({ etf: etfPending(today0025) }));
  ok(r.out.batch_due === true && posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true',
    'ETF with no checked_at (live today), updated today by a light run that completed the pending row: batch DUE, one full dispatch (no fallback to updated)', r.out);
  r = await run(world({ etf: etfPending(yday0025, today0025), derivs: derivs(3.1, 2.1), runs: runs() }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'false', 'ETF pending + stale derivatives: one dispatch with full "false" (the pending row adds no batch)', r.out);

  // a light re-fetch after 00:20 UTC leaves the daily batch due: light_checked_at is never read
  r = await run(world({ macro: { checked_at: yday0025 }, etf: { checked_at: yday0025, light_checked_at: today0025, updated: yday0025 } }));
  ok(r.out.batch_due === true && posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true',
    'light re-fetch after 00:20 UTC (light_checked_at today, checked_at yesterday) leaves the daily batch due', r.out);
  r = await run(world({ macro: { checked_at: today0025 }, etf: { updated: today0025, light_checked_at: today0025 } }));
  ok(r.out.batch_due === true && posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true',
    'ETF with no checked_at: batch due even when updated and light_checked_at are today (no fallback, never light_checked_at)', r.out);
  ok(W.checkedAt({ updated: today0025 }) === null && W.checkedAt({ updated: today0025, light_checked_at: today0025 }) === null && W.checkedAt({ checked_at: yday0025, updated: today0025 }) === yday0025,
    'checkedAt reads checked_at only: never updated, never light_checked_at', null);

  // supervisor back-off: 3 failed batch attempts in one UTC day, then one full try every 6h
  const fullRun = (hAgo, st = 'completed', t = 'Refresh data (full)') => ({ id: Math.round(hAgo * 100), status: st, event: 'workflow_dispatch', display_title: t, created_at: iso(NOW - hAgo * H) });
  const due0 = { macro: { checked_at: yday0025 } };
  r = await run(world({ ...due0, dispatchRuns: [fullRun(2.1), fullRun(8), fullRun(13)] }));
  ok(posts(r.calls).length === 0 && /failed 3 times today/.test(r.out.batch_backoff || ''), 'back-off: 3 failed full attempts today, newest 2.1h ago, 4th attempt within 6h -> NO dispatch', r.out);
  ok(hb(r.calls)[0].url.endsWith('/fail') && /daily batch failed 3 times/.test(hb(r.calls)[0].body), 'back-off: heartbeat /fail says the batch keeps failing');
  r = await run(world({ ...due0, derivs: derivs(3.1, 2.1), runs: runs(), dispatchRuns: [fullRun(2.1), fullRun(8), fullRun(13)] }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'false', 'back-off + stale derivatives: one dispatch, full "false" (no 4th batch try)', r.out);
  r = await run(world({ ...due0, dispatchRuns: [fullRun(6.1), fullRun(8), fullRun(13)] }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true', 'back-off: newest failed attempt 6.1h ago -> one full try', r.out);
  r = await run(world({ ...due0, dispatchRuns: [fullRun(2.1), fullRun(8)] }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true', 'back-off: only 2 failed attempts today -> third full try goes (subject to the 55 min rule)', r.out);
  r = await run(world({ ...due0, dispatchRuns: [fullRun(2.1), fullRun(16), fullRun(17)] }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true', "back-off is per UTC day: yesterday's attempts (16h, 17h ago) do not count", r.out);
  r = await run(world({ ...due0, dispatchRuns: [fullRun(2.1, 'completed', 'Refresh data'), fullRun(3, 'completed', 'Refresh data'), fullRun(4, 'completed', 'Refresh data')] }));
  ok(posts(r.calls).length === 1 && JSON.parse(posts(r.calls)[0].body).inputs.full === 'true', 'back-off counts only full=true runs ("Refresh data (full)"), not derivatives-only dispatches', r.out);
  r = await run(world({ ...due0, runs: runs({ oi: 2.1, macroChecked: 27 }), dispatchRuns: [fullRun(2.1), fullRun(8), fullRun(13)] }));
  ok(posts(r.calls).length === 0 && hb(r.calls)[0].url.endsWith('/fail') && /macro fetch: last successful run 27\.0h ago > limit 26h/.test(hb(r.calls)[0].body) && /daily batch failed 3 times/.test(hb(r.calls)[0].body), 'back-off, 4th attempt within 6h: no dispatch, heartbeat /fail names the stale feed (macro fetch 27h) and the back-off', hb(r.calls)[0] && hb(r.calls)[0].body);
  { const N0 = Date.parse('2026-11-18T00:30:00Z'); const at = (t) => ({ id: t, status: 'completed', event: 'workflow_dispatch', display_title: 'Refresh data (full)', created_at: t });
    const m = mock(world({ macro: { checked_at: '2026-11-17T00:25:00Z' }, etf: { checked_at: '2026-11-17T00:25:00Z' }, derivs: { assets: { BTC: { latest: { oi_t: N0 - 2.1 * H, basis_t: N0 - 2.1 * H } } } }, runs: { ...runs({ oi: 2.1 }), last_run: iso(N0 - 30 * 60000) },
      dispatchRuns: [at('2026-11-17T23:20:00Z'), at('2026-11-17T22:10:00Z'), at('2026-11-17T21:00:00Z')] }));
    const o = await W.tick(ENV, { fetch: m.f, now: N0, log: () => {} }); const pp = m.calls.filter((x) => x.url === `${API}/dispatches`);
    ok(o.batch_due && pp.length === 1 && JSON.parse(pp[0].body).inputs.full === 'true', 'new UTC day resets the back-off: 3 failures 21:00-23:20Z yesterday, at 00:30Z the batch is due again -> one full try', o); }
  const dyText = fs.readFileSync(path.join(ROOT, '.github/workflows/data.yml'), 'utf8');
  ok(dyText.includes(`inputs.full && '${L.FULL_TITLE}' || 'Refresh data'`) && /^run-name: /m.test(dyText), 'data.yml run-name marks a full=true dispatch with limits.js FULL_TITLE');
  ok(L.BATCH_MAX_FAILED === 3 && L.BATCH_RETRY_H === 6, 'back-off constants: 3 failed attempts per UTC day, then every 6h');

  // heartbeat
  r = await run(world({ runs: runs({ oi: 2.1, funding: 13 }) }));
  ok(hb(r.calls).length === 1 && hb(r.calls)[0].url === HB + '/fail' && /BTC funding: 13\.0h old > limit 12h/.test(hb(r.calls)[0].body), 'heartbeat: funding 13h > 12h -> /fail naming the feed', hb(r.calls).map((x) => [x.url, x.body]));
  r = await run(world({ runs: runs({ oi: 5.2 }), derivs: derivs(5.2, 2.1) }));
  ok(hb(r.calls)[0].url.endsWith('/fail') && /BTC oi: 5\.2h old > limit 5h/.test(hb(r.calls)[0].body) && posts(r.calls).length === 1, 'heartbeat: OI 5.2h > 5h -> /fail (and the refresh is dispatched)', hb(r.calls)[0].body);
  r = await run(world({ runs: runs({ oi: 2.1, market: 3.4 }) }));
  ok(hb(r.calls)[0].url.endsWith('/fail') && /market: 3\.4h old > limit 3h/.test(hb(r.calls)[0].body), 'heartbeat: market 3.4h > 3h -> /fail');
  r = await run(world({ runs: runs({ oi: 2.1, macroBad: true }) }));
  ok(hb(r.calls)[0].url.endsWith('/fail') && /macro DEXUSEU/.test(hb(r.calls)[0].body), 'heartbeat: macro series past its limit -> /fail');
  r = await run(world({ runs: runs({ oi: 2.1, lastRunMin: 95 }) }));
  ok(hb(r.calls)[0].url.endsWith('/fail') && /last_run .* 95 min old/.test(hb(r.calls)[0].body), 'heartbeat: last_run 95 min > 90 -> /fail');
  r = await run(world({ runs: runs({ oi: 2.1 }) }), { ...ENV, HEARTBEAT_URL: HB + '/' });
  ok(hb(r.calls)[0].url === HB, 'heartbeat URL with a trailing slash still pings the check itself');
  r = await run(world(), { ...ENV, HEARTBEAT_URL: undefined });
  ok(hb(r.calls).length === 0 && r.out.heartbeat === 'not configured', 'no HEARTBEAT_URL: no ping, no crash');

  // failures of the timer itself
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), ghStatus: 401 }));
  ok(posts(r.calls).length === 0 && hb(r.calls)[0].url.endsWith('/fail') && /GitHub API read failed \(HTTP 401\)/.test(hb(r.calls)[0].body) && noLeak(r), 'GitHub 401 (expired/wrong token): no dispatch, heartbeat /fail, token not leaked', r.out);
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs(), dispatchStatus: 403 }));
  ok(posts(r.calls).length === 1 && !r.out.dispatched && /dispatch failed \(HTTP 403\)/.test(hb(r.calls)[0].body), 'dispatch refused (403): heartbeat /fail, no retry', r.out);
  r = await run(world({ derivs: derivs(3.1, 2.1), runs: runs() }), { ...ENV, GH_TOKEN: undefined });
  ok(gh(r.calls).length === 0 && hb(r.calls)[0].url.endsWith('/fail') && /GH_TOKEN not set/.test(hb(r.calls)[0].body), 'no GH_TOKEN: no GitHub call, heartbeat /fail');
  r = await run(world({ liveDown: ['derivs'] }));
  ok(posts(r.calls).length === 1 && hb(r.calls)[0].url.endsWith('/fail') && /live derivs\.json unreadable/.test(hb(r.calls)[0].body), 'live derivs.json unreadable: one dispatch (guards still apply) + /fail', r.out);
  r = await run(world({ liveDown: ['runs'] }));
  ok(posts(r.calls).length === 0 && hb(r.calls)[0].url.endsWith('/fail'), 'live _runs.json unreadable, derivs fresh: no dispatch, /fail');

  // scheduled() wiring: uses global fetch, waits on ctx.waitUntil
  { const m = mock(world({ derivs: derivs(3.1, 2.1), runs: runs() })); const g = globalThis.fetch, cl = console.log; const ps = []; let logged = '';
    globalThis.fetch = m.f; console.log = (...a) => { logged += a.join(' '); };
    const realNow = Date.now; Date.now = () => NOW;
    try { await W.default.scheduled({ cron: '7 * * * *' }, ENV, { waitUntil: (x) => ps.push(x) }); await Promise.all(ps); } finally { globalThis.fetch = g; console.log = cl; Date.now = realNow; }
    ok(ps.length === 1 && posts(m.calls).length === 1 && !logged.includes(TOKEN) && !logged.includes(HB), 'scheduled(): one waitUntil tick, one dispatch, secrets not logged');
    const fr = await W.default.fetch(); ok(fr.status === 404, 'HTTP fetch handler does nothing (404): no manual trigger'); }

  // wrangler.toml: cron 7 * * * *, no secrets in the file
  const wt = fs.readFileSync(path.join(ROOT, 'worker/wrangler.toml'), 'utf8');
  ok(/^crons = \["7 \* \* \* \*"\]$/m.test(wt), 'wrangler.toml: cron trigger hourly at minute 7');
  ok(!/^\s*(GH_TOKEN|HEARTBEAT_URL)\s*=/m.test(wt) && !/github_pat_|ghp_|hc-ping\.com\//.test(wt + fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8')), 'no token or heartbeat URL in wrangler.toml or the code');
  { const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'worker/package.json'), 'utf8')); ok(!pj.dependencies && !pj.devDependencies && pj.type === 'module', 'worker has no npm dependencies (plain ES module)'); }

  // parity with the Python the room already trusts
  const py = (code) => execFileSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8' }).trim();
  const da = fs.readFileSync(path.join(ROOT, '.github/scripts/data_age.py'), 'utf8'), rs = fs.readFileSync(path.join(ROOT, '.github/scripts/refresh_slot.py'), 'utf8');
  ok(new RegExp(`^LAST_RUN_MAX_MIN = ${L.LAST_RUN_MAX_MIN}$`, 'm').test(da) && new RegExp(`^MACRO_FETCH_LIMIT_H = ${L.MACRO_FETCH_LIMIT_H}$`, 'm').test(da), 'limits.js LAST_RUN_MAX_MIN / MACRO_FETCH_LIMIT_H = data_age.py');
  ok(new RegExp(`^BATCH_UTC = \\(${L.BATCH_UTC[0]}, ${L.BATCH_UTC[1]}\\)`, 'm').test(rs), 'limits.js BATCH_UTC = refresh_slot.py BATCH_UTC');
  const fr = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/freshness.json'), 'utf8'));
  ok(L.DISPATCH_DERIVS_H < fr.derivs_hourly_h && L.DISPATCH_DERIVS_H > fr.oi_settle_h, 'dispatch threshold 3h sits between the 2h OKX settle and the 5h OI/basis limit', [fr.oi_settle_h, fr.derivs_hourly_h]);
  ok(/age > DISPATCH_DERIVS_H/.test(fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8')) && !/age >= DISPATCH_DERIVS_H/.test(fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8')), 'Worker dispatch compares unrounded age > 3h (exactly 3.0h is fresh)');
  const cases = [runs({ oi: 2.1 }), runs({ oi: 5.2 }), runs({ funding: 13 }), runs({ market: 3.4 }), runs({ macroBad: true }), runs({ lastRunMin: 95 }), runs({ macroChecked: 27 }), { last_run: null }, { ...runs({ oi: 2.1 }), macro_checked: undefined }];
  const T = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tworker-'));
  cases.forEach((c, i) => {
    const f = path.join(T, `r${i}.json`); fs.writeFileSync(f, JSON.stringify(c));
    const pyBad = py(`import sys,json; sys.path.insert(0,'.github/scripts'); import data_age as d
warn=sys.stdout
sys.stdout=sys.stderr
r=d.check(json.load(open(${JSON.stringify(f)})), d.P(${JSON.stringify(iso(NOW))}))
sys.stdout=warn
print(json.dumps(r))`);
    const a = JSON.parse(pyBad.trim().split('\n').filter((l) => /^[\[\{]/.test(l)).pop()).length, b = W.staleProblems(JSON.parse(JSON.stringify(c)), NOW).length;
    ok(a === b, `staleProblems = data_age.check (case ${i}: ${a} problem(s))`, { py: JSON.parse(pyBad), js: W.staleProblems(c, NOW) });
  });
  const bcases = [[today0025, today0025, '2026-11-17T15:07:00Z'], [yday0025, today0025, '2026-11-17T15:07:00Z'], [yday0025, yday0025, '2026-11-17T00:07:00Z'], [yday0025, yday0025, '2026-11-17T00:21:00Z'], ['2026-11-17T00:20:00Z', today0025, '2026-11-17T00:30:00Z']];
  for (const [m1, e1, n] of bcases) {
    const pv = py(`import sys,datetime as dt; sys.path.insert(0,'.github/scripts'); import refresh_slot as r; print(str(r.batch_due([${JSON.stringify(m1)},${JSON.stringify(e1)}], r._t(${JSON.stringify(n)}))).lower())`);
    ok(pv === String(W.batchDue([m1, e1], Date.parse(n))), `batchDue = refresh_slot.batch_due (${m1}, ${e1} at ${n}: ${pv})`);
  }
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`tworker: ${fails.length} FAILS`); console.log(`FAILS: ${fails.length}`); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('FAIL tworker crashed: ' + (e && e.stack)); console.log('FAILS: 1'); process.exit(1); });
