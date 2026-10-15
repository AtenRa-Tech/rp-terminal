const REPO = "AtenRa-Tech/rp-terminal";
const RUNS = "https://atenra-tech.github.io/rp-terminal/data/_runs.json";
const MARKET = "https://atenra-tech.github.io/rp-terminal/data/market.json";
const API = `https://api.github.com/repos/${REPO}/actions/workflows`;
const hdr = () => ({ Authorization: `Bearer ${process.env.RPT_DISPATCH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "rpt-timer" });
async function dispatch(wf) {
  const r = await fetch(`${API}/${wf}/dispatches`, { method: "POST", headers: hdr(), body: JSON.stringify({ ref: "main" }) });
  console.log(`dispatch ${wf}: ${r.status}`); return r.status;
}
async function recentRun(wf, mins) {
  const r = await fetch(`${API}/${wf}/runs?per_page=1&event=workflow_dispatch`, { headers: hdr() });
  if (!r.ok) return false;
  const j = await r.json(); const t = j.workflow_runs?.[0]?.created_at;
  return t ? (Date.now() - Date.parse(t)) / 60000 < mins : false;
}
// WATCHDOG (15 Oct): a merge-window pause disables data.yml/derivs.yml; if the box's resume timer dies they stay off for hours and every
// dispatch 422s silently. Any workflow disabled >35 min (30-min hard pause cap) is re-enabled here, independent of the box.
const MAX_DISABLED_MIN = 35;   // supervisor 15 Oct: 30-min hard pause cap + 5 min slack
async function watchdog(out) {
  for (const wf of ["data.yml", "derivs.yml"]) {
    const r = await fetch(`${API}/${wf}`, { headers: hdr() });
    if (!r.ok) { out[`wd_${wf}`] = `read ${r.status}`; continue; }
    const j = await r.json();
    if (j.state === "active") continue;
    const mins = Math.round((Date.now() - Date.parse(j.updated_at)) / 60000);
    out[`wd_${wf}`] = `${j.state} ${mins} min`;
    if (mins >= MAX_DISABLED_MIN) {
      const e = await fetch(`${API}/${wf}/enable`, { method: "PUT", headers: hdr() });
      console.log(`WATCHDOG: ${wf} ${j.state} for ${mins} min -> enable ${e.status}`); out[`wd_${wf}`] += ` -> enabled ${e.status}`;
      out.watchdog_fired = true;
    } else console.log(`watchdog: ${wf} ${j.state} ${mins} min (< ${MAX_DISABLED_MIN}, merge window)`);
  }
}
export default async () => {
  const out = { at: new Date().toISOString() };
  await watchdog(out);
  out.derivs = await dispatch("derivs.yml");
  // hourly market/macro/ETF refresh: the :22 tick (UTC minute 15-29) dispatches data.yml (GitHub's own schedule for it is unreliable)
  const m = new Date().getUTCMinutes();
  if (m >= 15 && m < 30) { out.data = await dispatch("data.yml"); out.data_reason = "hourly :22"; }
  let age = null;
  try {
    const r = await fetch(`${RUNS}?t=${Date.now()}`, { cache: "no-store" });
    const lr = (await r.json()).last_run; age = lr ? (Date.now() - Date.parse(lr)) / 60000 : null;
  } catch (e) { console.log("runs.json unreadable:", e.message); }
  out.age_min = age == null || isNaN(age) ? null : Math.round(age);
  console.log(`last_run age (min): ${out.age_min}`);
  let mAge = null;
  try {
    const r = await fetch(`${MARKET}?t=${Date.now()}`, { cache: "no-store" });
    const u = (await r.json()).updated; mAge = u ? (Date.now() - Date.parse(u)) / 60000 : null;
  } catch (e) { console.log("market.json unreadable:", e.message); }
  out.market_age_min = mAge == null || isNaN(mAge) ? null : Math.round(mAge);
  console.log(`market.json age (min): ${out.market_age_min}`);
  if (out.age_min == null || out.age_min >= 90 || out.market_age_min == null || out.market_age_min >= 90) {
    console.log("STALE ALARM: derivatives or market >=90 min old or unreadable");
    if (!out.data) { out.data = await dispatch("data.yml"); out.data_reason = "stale alarm"; }
    // live-suite fails visibly (GitHub emails); at most once per 3h to avoid queue pile-up
    // RED run on main (stale-alarm.yml fails while live data is past its limits) so the deploy-failure watch posts it to the room; <=1 per 30 min
    if (!(await recentRun("stale-alarm.yml", 30))) {
      const r = await fetch(`${API}/stale-alarm.yml/dispatches`, { method: "POST", headers: hdr(), body: JSON.stringify({ ref: "main", inputs: { reason: `kick: last_run ${out.age_min} min, market ${out.market_age_min} min` } }) });
      out.stale_alarm = r.status; console.log(`dispatch stale-alarm.yml: ${r.status}`);
    }
    // a pause must never silence the alarm: while stale, re-raise every 60 min (was once per 3h)
    if (!(await recentRun("live-suite.yml", 60))) out.live_suite = await dispatch("live-suite.yml");
    else console.log("live-suite dispatched <60 min ago, skipping");
  }
  console.log(JSON.stringify(out));
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
};
export const config = { schedule: "7,22,37,52 * * * *" };
