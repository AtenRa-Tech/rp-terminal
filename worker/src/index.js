// RP Terminal outside refresh timer (Cloudflare Worker, cron "7 * * * *"). Supervisor ruling 15 Nov.
// Each tick:
//   1. read live data/derivs.json, _runs.json, macro.json, etf.json (cache-busted)
//   2. decide whether a refresh has something to fetch:
//        derivatives: the oldest newest-hour among every asset's latest.oi_t / latest.basis_t is past 3h (C4: exactly 3.0h is fresh, not dispatched),
//        daily batch due: the oldest of macro.json checked_at / etf.json checked_at (fallback: updated, never light_checked_at) is before the latest 00:20 UTC slot
//        (same rule as .github/scripts/refresh_slot.py batch_due, which data.yml's own catch-up uses)
//      etf.json: only the full batch writes checked_at; a light re-fetch writes light_checked_at and must not make the batch look done
//   3. only then ask GitHub: skip if a data.yml run is queued / in progress, or a workflow_dispatch run was created < 55 min ago;
//      otherwise dispatch data.yml on main ONCE (inputs.full = "true" when the daily batch is due).
//      Batch back-off (supervisor): a completed "Refresh data (full)" dispatch run created today (UTC) while the batch is STILL due is a failed
//      attempt; after 3 of them, full=true is sent again only when the newest attempt is >= 6h old. Backed off, a stale-derivatives
//      refresh still goes with full=false, and nothing goes if derivatives are fresh.
//   4. heartbeat (optional HEARTBEAT_URL, healthchecks.io style): ping on a clean tick, <url>/fail when any feed is past its shared
//      freshness limit (same checks as .github/scripts/data_age.py) or the timer itself could not do its job (GitHub API error, bad token).
// Secrets only from env (GH_TOKEN, HEARTBEAT_URL); neither is ever logged or sent anywhere except its own host.
import { DISPATCH_DERIVS_H, LAST_RUN_MAX_MIN, MACRO_FETCH_LIMIT_H, BATCH_UTC, ONE_PER_HOUR_MIN, ACTIVE, BATCH_MAX_FAILED, BATCH_RETRY_H, FULL_TITLE } from "./limits.js";

const H = 3600000;
const ms = (x) => { const t = Date.parse(x); return Number.isFinite(t) ? t : NaN; };

async function getJSON(fetchFn, url) {
  try {
    const r = await fetchFn(url, { headers: { "cache-control": "no-cache" }, cf: { cacheTtl: 0 } });
    if (!r.ok) return { err: `HTTP ${r.status}` };
    return { j: await r.json() };
  } catch (e) { return { err: String((e && e.message) || e).slice(0, 120) }; }
}


// C4: unrounded age is the decision; the number we show is never rounded into or onto the other side of the limit
// (2h59m59.6s stays 2.99, not 3.00; 3.01 stays 3.01, not 3.0).
export function displayAgeH(age, lim) {
  const r = Math.round(age * 100) / 100;
  if (age < lim && r >= lim) return Math.floor(age * 100 + 1e-12) / 100; // 2h59m59.6s stays 2.99, never 3.00
  if (age > lim && r <= lim) return Math.ceil(age * 100 - 1e-12) / 100;  // 3.01 stays 3.01, never 3.00
  return r;
}
export function fmtAgeH(age, lim) {
  const n = displayAgeH(age, lim);
  const s = n.toFixed(2);
  return `${s}h`;
}
export function fmtAgeH1(age, lim) { // 1-decimal messages (data_age.py twin); bump precision when .1f would land on/inside the limit
  const s = age.toFixed(1);
  if (age > lim && Number(s) <= lim) return fmtAgeH(age, lim);
  return `${s}h`;
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
// checked_at only (same as refresh_slot.py); fallback to updated on old files. Never light_checked_at: a light ETF re-fetch must leave the batch due.
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
    if (!(h <= v.lim_h)) bad.push(`${f}: ${fmtAgeH1(h, v.lim_h)} old > limit ${v.lim_h}h`);
  }
  const mk = R.market || {};
  if (!mk.updated || mk.limit_h == null) bad.push("market: no updated/limit_h");
  else { const h = (now - ms(mk.updated)) / H; if (!(h <= mk.limit_h)) bad.push(`market: ${fmtAgeH1(h, mk.limit_h)} old > limit ${mk.limit_h}h`); }
  for (const [s, v] of Object.entries(R.macro || {})) if (v && typeof v === "object" && v.ok === false) bad.push(`macro ${s}: past its limit (${v.limit})`);
  const mc = R.macro_checked;
  if (mc == null) bad.push("macro_checked missing (macro fetch time unknown)");
  else if (!mc.checked_at) bad.push("macro fetch: no checked_at");
  else { const h = (now - ms(mc.checked_at)) / H; if (!(h <= MACRO_FETCH_LIMIT_H)) bad.push(`macro fetch: last successful run ${fmtAgeH1(h, MACRO_FETCH_LIMIT_H).replace(/h$/, "")}h ago > limit ${MACRO_FETCH_LIMIT_H}h`); }
  return bad;
}

// supervisor back-off: {ok, failed, why}. dispatchRuns = data.yml workflow_dispatch runs (newest first, GitHub API objects)
export function batchBackoff(dispatchRuns, now) {
  const d = new Date(now), day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const tries = (dispatchRuns || []).filter((r) => r.display_title === FULL_TITLE && r.status === "completed" && ms(r.created_at) >= day0 && ms(r.created_at) <= now);
  if (tries.length < BATCH_MAX_FAILED) return { ok: true, failed: tries.length };
  const newest = Math.max(...tries.map((r) => ms(r.created_at)));
  const h = (now - newest) / H;
  if (h >= BATCH_RETRY_H) return { ok: true, failed: tries.length };
  return { ok: false, failed: tries.length, why: `daily batch failed ${tries.length} times today (UTC); next full try ${(BATCH_RETRY_H - h).toFixed(1)}h after the last one` };
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
  // C4: compare the unrounded age; display rounding must never pull a just-under value up to the 3h limit or a just-over value down into it.
  out.derivs_age_h = age == null ? null : displayAgeH(age, DISPATCH_DERIVS_H);
  const due = batchDue([checkedAt(MA.j), checkedAt(ET.j)], now);
  out.batch_due = due;
  const stale = staleProblems(R.j, now);
  if (R.j) problems.push(...stale);
  const derivsStale = age == null || age > DISPATCH_DERIVS_H;
  out.want = derivsStale || due;
  out.reason = derivsStale ? (age == null ? "derivatives age unknown" : `derivatives ${fmtAgeH(age, DISPATCH_DERIVS_H)} old (> ${DISPATCH_DERIVS_H}h)`) : due ? "daily batch due (not run since the last 00:20 UTC slot)" : `derivatives ${fmtAgeH(age, DISPATCH_DERIVS_H)} old, daily batch done: nothing to fetch`;

  if (out.want) {
    const token = env.GH_TOKEN;
    if (!token) { problems.push("GH_TOKEN not set: cannot check or dispatch"); out.skip = "no token"; }
    else {
      const api = `https://api.github.com/repos/${repo}/actions/workflows/${wf}`;
      try {
        const [a, b] = await Promise.all([
          fetchFn(`${api}/runs?per_page=30`, { headers: ghHeaders(token) }),
          fetchFn(`${api}/runs?event=workflow_dispatch&per_page=50`, { headers: ghHeaders(token) }),
        ]);
        if (!a.ok || !b.ok) { problems.push(`GitHub API read failed (HTTP ${a.ok ? b.status : a.status}); token missing scope or expired?`); out.skip = "github read failed"; }
        else {
          const runs = ((await a.json()).workflow_runs) || [];
          const dRuns = ((await b.json()).workflow_runs) || [];
          const lastD = dRuns[0];
          let full = due ? "true" : "false";
          if (due) {
            const bo = batchBackoff(dRuns, now); out.batch_failed_today = bo.failed;
            if (!bo.ok) { full = "false"; out.batch_backoff = bo.why; problems.push(bo.why); }
          }
          const active = runs.find((r) => ACTIVE.includes(r.status));
          const recentMin = lastD ? (now - ms(lastD.created_at)) / 60000 : Infinity;
          if (active) out.skip = `a ${wf} run is already ${active.status} (run ${active.id})`;
          else if (full === "false" && !derivsStale) out.skip = `batch backed off and derivatives fresh: nothing to fetch`;
          else if (recentMin < ONE_PER_HOUR_MIN) out.skip = `a workflow_dispatch run was created ${Math.round(recentMin)} min ago (< ${ONE_PER_HOUR_MIN})`;
          else {
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
