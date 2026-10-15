#!/usr/bin/env python3
"""data/_runs.json: one record per derivatives run plus a rolling 24h hourly sample (stdlib only).

Freshness here is judged per feed from derivs.json's own per-metric timestamps (latest.*_t), never from the
file's 'updated' field: a run can rewrite the file while a feed fails and keeps an old copy.
Limits match the app (DVLIM): open interest 3h, basis 3h, funding 12h.

  runs    : last 200 runs  {t, workflow, run_id, feeds:{"BTC oi": {t, age_h, lim_h, ok}, ...}, ok}
  hourly  : one sample per UTC hour for the last 24 hours (the newest run in that hour wins)
  sla_24h : {hours_sampled, hours_within, pct_within, window_start, window_end}; a missing hour counts as NOT within

Usage: python scripts/runs_log.py            (record this run)
       python scripts/runs_log.py --check 95  (exit 1 if within limits in <95% of the last 24 hourly slots; a missing hour counts as a miss; once 24 samples exist the check fails on its own — no manual switch)
"""
import datetime as dt, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DERIVS = os.path.join(ROOT, "data", "derivs.json")
RUNS = os.path.join(ROOT, "data", "_runs.json")
LIM = {"oi": 3.0, "basis": 3.0, "funding": 12.0}
H = 3600_000


def now_ms():
    return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)


def iso(ms):
    return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def feeds(d, t):
    out = {}
    for a, A in (d.get("assets") or {}).items():
        L = A.get("latest") or {}
        for m, lim in LIM.items():
            ft = L.get(m + "_t")
            age = None if ft is None else round((t - ft) / H, 2)
            out[f"{a} {m}"] = {"t": None if ft is None else iso(ft), "age_h": age, "lim_h": lim, "ok": age is not None and age <= lim}
    return out


def sla(hourly, t):
    end = t // H * H
    slots = [end - k * H for k in range(24)]
    by = {s["hour_ms"]: s for s in hourly}
    within = sum(1 for s in slots if by.get(s, {}).get("ok") is True)
    return {"hours_sampled": sum(1 for s in slots if s in by), "hours_within": within, "pct_within": round(100 * within / 24, 1),
            "window_start": iso(slots[-1]), "window_end": iso(end + H)}


def load(p, dflt):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return dflt


# ---- market + macro freshness (15 Oct ruling). Same rules as the app: market.json 2h; macro per series: daily Fed H.15
# (DGS10, DGS2, DFII10, T10Y2Y) 3 US business days with bond-market holidays skipped; weekly 12 days; H.10 daily FX 10 days;
# other daily 5 days; monthly = shared/freshness.json monthly_days (100) from month start, age <= limit ok. Reported in _runs.json; they do not change the derivatives SLA ('ok').
import datetime as _dt
MARKET = os.path.join(os.path.dirname(DERIVS), "market.json"); MACRO = os.path.join(os.path.dirname(DERIVS), "macro.json")
MARKET_LIM_H = 2; FEDD = ("DGS10", "DGS2", "DFII10", "T10Y2Y"); FEDD_LIM = 3; FRESHNESS = json.load(open(os.path.join(ROOT, "shared", "freshness.json")))  # ONE monthly limit shared with the app and smoke
CAD = {"Monthly": FRESHNESS["monthly_days"], "Daily": 5, "Weekly": 12}
def us_hol(y):
    D = _dt.date
    def f(m, d):
        t = D(y, m, d); w = t.weekday()
        return t + _dt.timedelta(1) if w == 6 else t - _dt.timedelta(1) if w == 5 else t
    def nth(m, wd, n):  # wd: Monday=0
        t = D(y, m, 1); return t + _dt.timedelta((wd - t.weekday()) % 7 + 7 * (n - 1))
    def last(m, wd):
        t = (D(y, m + 1, 1) if m < 12 else D(y + 1, 1, 1)) - _dt.timedelta(1); return t - _dt.timedelta((t.weekday() - wd) % 7)
    return {f(1, 1), nth(1, 0, 3), nth(2, 0, 3), last(5, 0), f(6, 19), f(7, 4), nth(9, 0, 1), nth(10, 0, 2), f(11, 11), nth(11, 3, 4), f(12, 25)}
def us_biz_days(last_ymd, now_ms):
    x = _dt.date.fromisoformat(str(last_ymd)[:10]); e = _dt.datetime.fromtimestamp(now_ms / 1000, _dt.timezone.utc).date(); n = 0; H = {}
    while x < e:
        x += _dt.timedelta(1)
        if x.year not in H: H[x.year] = us_hol(x.year)
        if x.weekday() < 5 and x not in H[x.year]: n += 1
    return n
def market_fresh(m, t):
    u = (m or {}).get("updated")
    if not u: return {"ok": False, "why": "market.json missing or no 'updated'", "limit_h": MARKET_LIM_H}
    age = (t - _dt.datetime.fromisoformat(u.replace("Z", "+00:00")).timestamp() * 1000) / H
    return {"ok": age <= MARKET_LIM_H, "updated": u, "age_h": round(age, 2), "limit_h": MARKET_LIM_H}
def macro_fresh(M, t):
    out = {}
    for sid, s in ((M or {}).get("series") or {}).items():
        ld = s.get("last_date")
        if not ld or not s.get("points"): out[sid] = {"ok": False, "why": "missing or invalid observation date"}; continue
        f = "Monthly" if str(s.get("freq", "")).startswith("Monthly") else "Weekly" if str(s.get("freq", "")).startswith("Weekly") else "Daily"
        if sid in FEDD:
            bd = us_biz_days(ld, t); out[sid] = {"ok": bd <= FEDD_LIM, "last_date": ld, "biz_days": bd, "limit": f"{FEDD_LIM} US business days"}
        else:
            age = (t - _dt.datetime.fromisoformat(ld[:10] + "T00:00:00+00:00").timestamp() * 1000) / (24 * H)
            lim = 10 if f == "Daily" and (sid.startswith("DEX") or sid.startswith("DTWEX")) else CAD[f]
            out[sid] = {"ok": age <= lim, "last_date": ld, "age_d": round(age, 1), "limit": f"{lim} days ({f.lower()})"}
    return out


def record():
    t = now_ms()
    d = load(DERIVS, {})
    fd = feeds(d, t)
    ok = bool(fd) and all(v["ok"] for v in fd.values())
    R = load(RUNS, {})
    runs = (R.get("runs") or [])[-199:]
    mk, mc = market_fresh(load(MARKET, {}), t), macro_fresh(load(MACRO, {}), t)
    runs.append({"t": iso(t), "workflow": os.environ.get("GITHUB_WORKFLOW", "local"), "run_id": os.environ.get("GITHUB_RUN_ID"), "feeds": fd, "ok": ok,
                 "market": mk, "macro_stale": sorted(k for k, v in mc.items() if not v["ok"])})
    hr = t // H * H
    hourly = [s for s in (R.get("hourly") or []) if s.get("hour_ms", 0) > hr - 24 * H and s.get("hour_ms") != hr]
    hourly.append({"hour_ms": hr, "hour": iso(hr), "t": iso(t), "ok": ok, "stale": [k for k, v in fd.items() if not v["ok"]]})
    hourly.sort(key=lambda s: s["hour_ms"])
    out = {"note": "Written by scripts/runs_log.py after each derivatives run. Freshness per feed from derivs.json latest.*_t (not 'updated'). "
                   "Limits: oi 3h, basis 3h, funding 12h. sla_24h counts a missing hour as not within.",
           "last_run": iso(t), "runs": runs, "hourly": hourly, "sla_24h": sla(hourly, t),
           "market": mk, "macro": mc}
    tmp = RUNS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), allow_nan=False)
    os.replace(tmp, RUNS)
    print("runs_log:", out["last_run"], "ok" if ok else "STALE " + ",".join(k for k, v in fd.items() if not v["ok"]), out["sla_24h"])


def check(pct, path=RUNS, t=None):
    R = load(path, None)
    if not R or not R.get("hourly"):
        print("::warning::data/_runs.json missing or has no hourly samples yet (first deploy after the change); SLA check starts after the first Refresh derivatives run")
        return 0
    t = t or now_ms()
    s = sla(R["hourly"], t)
    first = min(x["hour_ms"] for x in R["hourly"])
    if first > t // H * H - 23 * H:
        # bootstrap: fewer than 24 hours recorded since _runs.json started; report it, do not invent the missing history
        print(f"::warning::derivatives SLA: only {s['hours_sampled']} of 24 hourly samples exist yet (since {iso(first)}); {s['hours_within']} within limits. Full check starts after 24h of samples.")
        return 0
    msg = f"derivatives within limits in {s['hours_within']}/24 hourly samples ({s['pct_within']}%) over {s['window_start']} - {s['window_end']}"
    if s["pct_within"] < pct:
        print(f"::error::{msg}, below {pct}%")
        return 1
    print("OK", msg)
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--check":
        sys.exit(check(float(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else RUNS))
    record()
