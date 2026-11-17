// RP Terminal outside refresh timer (Cloudflare Worker, cron "7 * * * *"). Supervisor ruling 15 Nov.
// Each tick:
//   1. read live data/derivs.json, _runs.json, macro.json, etf.json (cache-busted)
//   2. decide whether a refresh has something to fetch:
//        derivatives: the oldest newest-hour among every asset's latest.oi_t / latest.basis_t is >= 3h old (a new settled OKX hour is out), or
//        daily batch due: the oldest of macro.json checked_at / etf.json checked_at|updated is before the latest 00:20 UTC slot
//        (same rule as .github/scripts/refresh_slot.py batch_due, which data.yml's own catch-up uses)
//   3. only then ask GitHub: skip if a data.yml run is queued / in progress, or a workflow_dispatch run was created < 55 min ago;
//      otherwise dispatch data.yml on main ONCE (inputs.full = "true" when the daily batch is due)
//   4. heartbeat (optional HEARTBEAT_URL, healthchecks.io style): ping on a clean tick, <url>/fail when any feed is past its shared
//      freshness limit (same checks as .github/scripts/data_age.py) or the timer itself could not do its job (GitHub API error, bad token).
// Secrets only from env (GH_TOKEN, HEARTBEAT_URL); neither is ever logged or sent anywhere except its own host.
import { DISPATCH_DERIVS_H, LAST_RUN_MAX_MIN, MACRO_FETCH_LIMIT_H, BATCH_UTC, ONE_PER_HOUR_MIN, ACTIVE } from "./limits.js";

const H = 3600000;
const ms = (x) => { const t = Date.parse(x); return Number.isFinite(t) ? t : NaN; };

async function getJSON(fetchFn, url) {
  try {
    const r = await fetchFn(url, { headers: { "cache-control": "no-cache" }, cf: { cacheTtl: 0 } });
    if (!r.ok) return { err: `HTTP ${r.status}` };
    return { j: await r.json() };
  } catch (e) { return { err: String((e && e.message) || e).slice(0, 120) }; }
}

// age (hours) of the derivatives: the OLDEST newest-hour across assets and the oi/basis feeds; null when unknown
export function derivsAgeH(d, now) {
  const ts = [];
  for (const A of Object.values((d && d.assets) || {})) {
    const L = (A && A.latest) || {};
    for (const k of ["oi_t", "basis_t"]) if (typeof L[k] === "number") ts.push(L[k]);
    if (typeof L.oi_t !== "number" || typeof L.basis_t !== "number") return null;
  }
  if (!ts.length) return null;
  return (now - Math.min(...ts)) / H;
}

// same rule as refresh_slot.py batch_due(): due when min(checked) < latest 00:20 UTC slot; unknown -> due
export function batchDue(checked, now) {
  const d = new Date(now);
  let slot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), BATCH_UTC[0], BATCH_UTC[1]);
  if (now < slot) slot -= 24 * H;
  const t = checked.map(ms);
  if (!t.length || t.some((x) => Number.isNaN(x))) return true;
  return Math.min(...t) < slot;
}
const checkedAt = (j) => (j && (j.checked_at || j.updated)) || null;

// port of .github/scripts/data_age.py check(): every problem that makes the live stale alarm fail
export function staleProblems(R, now) {
  const bad = [];
  if (!R) return ["_runs.json unreadable"];
  if (!R.last_run) return ["_runs.json has no last_run (seed or broken)"];
  const m = (now - ms(R.last_run)) / 60000;
  if (!(m <= LAST_RUN_MAX_MIN)) bad.push(`last_run ${R.last_run} is ${Math.round(m)} min old (> ${LAST_RUN_MAX_MIN} min)`);
  const runs = R.runs || [];
  const feeds = (runs.length ? runs[runs.length - 1].feeds : null) || {};
  if (!Object.keys(feeds).length) bad.push("no feeds in newest runs[] entry");
  for (const [f, v] of Object.entries(feeds)) {
    if (!v || !v.t || v.lim_h == null) { bad.push(`${f}: no t/lim_h`); continue; }
    const h = (now - ms(v.t)) / H;
    if (!(h <= v.lim_h)) bad.push(`${f}: ${h.toFixed(1)}h old > limit ${v.lim_h}h`);
  }
  const mk = R.market || {};
  if (!mk.updated || mk.limit_h == null) bad.push("market: no updated/limit_h");
  else { const h = (now - ms(mk.updated)) / H; if (!(h <= mk.limit_h)) bad.push(`market: ${h.toFixed(1)}h old > limit ${mk.limit_h}h`); }
  for (const [s, v] of Object.entries(R.macro || {})) if (v && typeof v === "object" && v.ok === false) bad.push(`macro ${s}: past its limit (${v.limit})`);
  const mc = R.macro_checked;
  if (mc == null) bad.push("macro_checked missing (macro fetch time unknown)");
  else if (!mc.checked_at) bad.push("macro fetch: no checked_at");
  else { const h = (now - ms(mc.checked_at)) / H; if (!(h <= MACRO_FETCH_LIMIT_H)) bad.push(`macro fetch: last successful run ${h.toFixed(1)}h ago > limit ${MACRO_FETCH_LIMIT_H}h`); }
  return bad;
}

function ghHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "rpt-refresh-timer" };
}

export async function tick(env, deps = {}) {
  const fetchFn = deps.fetch || fetch;
  const now = deps.now != null ? deps.now : Date.now();
  const log = deps.log || ((...a) => console.log(...a));
  const site = (env.SITE_URL || "https://atenra-tech.github.io/rp-terminal/").replace(/\/?$/, "/");
  const repo = env.REPO || "AtenRa-Tech/rp-terminal", wf = env.WORKFLOW || "data.yml", ref = env.REF || "main";
  const out = { at: new Date(now).toISOString(), dispatched: false };
  const problems = [];
  const v = `v=${now}`;
  const [D, R, MA, ET] = await Promise.all(["derivs", "_runs", "macro", "etf"].map((f) => getJSON(fetchFn, `${site}data/${f}.json?${v}`)));
  for (const [n, x] of [["derivs.json", D], ["_runs.json", R], ["macro.json", MA], ["etf.json", ET]]) if (x.err) problems.push(`live ${n} unreadable (${x.err})`);

  const age = D.j ? derivsAgeH(D.j, now) : null;
  out.derivs_age_h = age == null ? null : Math.round(age * 100) / 100;
  const due = batchDue([checkedAt(MA.j), checkedAt(ET.j)], now);
  out.batch_due = due;
  const stale = staleProblems(R.j, now);
  if (R.j) problems.push(...stale);
  const derivsStale = age == null || age >= DISPATCH_DERIVS_H;
  out.want = derivsStale || due;
  out.reason = derivsStale ? (age == null ? "derivatives age unknown" : `derivatives ${age.toFixed(2)}h old (>= ${DISPATCH_DERIVS_H}h)`) : due ? "daily batch due (not run since the last 00:20 UTC slot)" : `derivatives ${age.toFixed(2)}h old, daily batch done: nothing to fetch`;

  if (out.want) {
    const token = env.GH_TOKEN;
    if (!token) { problems.push("GH_TOKEN not set: cannot check or dispatch"); out.skip = "no token"; }
    else {
      const api = `https://api.github.com/repos/${repo}/actions/workflows/${wf}`;
      try {
        const [a, b] = await Promise.all([
          fetchFn(`${api}/runs?per_page=30`, { headers: ghHeaders(token) }),
          fetchFn(`${api}/runs?event=workflow_dispatch&per_page=1`, { headers: ghHeaders(token) }),
        ]);
        if (!a.ok || !b.ok) { problems.push(`GitHub API read failed (HTTP ${a.ok ? b.status : a.status}); token missing scope or expired?`); out.skip = "github read failed"; }
        else {
          const runs = ((await a.json()).workflow_runs) || [];
          const lastD = (((await b.json()).workflow_runs) || [])[0];
          const active = runs.find((r) => ACTIVE.includes(r.status));
          const recentMin = lastD ? (now - ms(lastD.created_at)) / 60000 : Infinity;
          if (active) out.skip = `a ${wf} run is already ${active.status} (run ${active.id})`;
          else if (recentMin < ONE_PER_HOUR_MIN) out.skip = `a workflow_dispatch run was created ${Math.round(recentMin)} min ago (< ${ONE_PER_HOUR_MIN})`;
          else {
            const full = due ? "true" : "false";
            const r = await fetchFn(`${api}/dispatches`, { method: "POST", headers: { ...ghHeaders(token), "content-type": "application/json" }, body: JSON.stringify({ ref, inputs: { full } }) });
            if (r.status === 204 || r.ok) { out.dispatched = true; out.full = full; }
            else { problems.push(`dispatch failed (HTTP ${r.status})`); out.skip = "dispatch failed"; }
          }
        }
      } catch (e) { problems.push(`GitHub API error (${String((e && e.message) || e).slice(0, 120)})`); out.skip = "github error"; }
    }
  }
  out.problems = problems;

  const hb = env.HEARTBEAT_URL;
  if (hb) {
    const base = hb.replace(/\/+$/, "");
    const url = problems.length ? `${base}/fail` : base;
    const body = problems.length ? `RP Terminal timer: ${problems.join("; ")}`.slice(0, 9000) : `ok ${out.reason}${out.dispatched ? " -> dispatched" : ""}`;
    try { const r = await fetchFn(url, { method: "POST", body }); out.heartbeat = problems.length ? `fail ${r.status}` : `ok ${r.status}`; }
    catch (e) { out.heartbeat = "unreachable"; }
  } else out.heartbeat = "not configured";

  log(JSON.stringify(out));
  return out;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(env)); },
  // no manual trigger over HTTP (workers_dev/preview_urls are off anyway): runs only on the cron
  async fetch() { return new Response("not found", { status: 404 }); },
};
