#!/usr/bin/env python3
"""Refresh data/macro.json for RP Terminal (stdlib only, no API keys).

Sources
  FRED public CSV  https://fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES
  ECB Data Portal  euro area M2 (BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E)
  Bank of Japan    stat-search API, MD02 / MAM1NAM2M2MO (M2 average outstanding)
  PBoC             pbc.gov.cn yearly "Money Supply" (货币供应量) tables

If a source fails, the previous copy of that series is kept from the existing
data/macro.json and the series id is listed in "failed"; the job never aborts.
"""
import csv, datetime as dt, io, json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "macro.json")
# FRED's CDN stalls requests with a bare browser UA, so use an honest bot UA by
# default; a browser UA is used only for pbc.gov.cn.
UA = "rp-terminal-data/1.0 (+https://github.com/AtenRa-Tech/rp-terminal)"
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date()
MONTHLY_START = "2012-01-01"
STALE_DAYS = 75

FRED = {
    # id: (title, units, freq)
    "M2SL":     ("US M2 money stock", "Billions of USD, SA", "Monthly"),
    "DEXUSEU":  ("USD per EUR (spot)", "USD per EUR", "Daily"),
    "DEXJPUS":  ("JPY per USD (spot)", "JPY per USD", "Daily"),
    "DEXCHUS":  ("CNY per USD (spot)", "CNY per USD", "Daily"),
    "DTWEXBGS": ("Nominal broad US dollar index", "Index Jan 2006=100", "Daily"),
    "DGS10":    ("US 10-year Treasury yield", "Percent", "Daily"),
    "DFII10":   ("US 10-year TIPS real yield", "Percent", "Daily"),
    "WALCL":    ("Fed total assets (balance sheet)", "Millions of USD", "Weekly (Wed)"),
    "WTREGEN":  ("Treasury General Account (TGA), week average", "Millions of USD", "Weekly (Wed)"),
    "RRPONTSYD": ("Fed overnight reverse repo (ON RRP)", "Billions of USD", "Daily"),
    "DGS2":     ("US 2-year Treasury yield", "Percent", "Daily"),
    "T10Y2Y":   ("10-year minus 2-year Treasury spread (2s10s)", "Percentage points", "Daily"),
    "SP500":    ("S&P 500 index", "Index", "Daily"),
}


def get(url, timeout=45, tries=3, ua=None):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua or UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(2 * (i + 1))
    raise last


def fred(sid):
    raw = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}").decode("utf-8")
    rows = list(csv.reader(io.StringIO(raw)))
    if not rows or len(rows[0]) < 2 or rows[0][1] != sid:
        raise ValueError(f"unexpected FRED CSV header: {rows[:1]}")
    pts = []
    for d, v in rows[1:]:
        if v not in (".", ""):
            pts.append([d, float(v)])
    if not pts:
        raise ValueError("no observations")
    return pts


def ecb_m2():
    url = ("https://data-api.ecb.europa.eu/service/data/BSI/M.U2.Y.V.M20.X.1.U2.2300.Z01.E"
           "?format=csvdata&startPeriod=2011-01")
    raw = get(url).decode("utf-8")
    pts = []
    for r in csv.DictReader(io.StringIO(raw)):
        if r.get("OBS_VALUE"):
            pts.append([r["TIME_PERIOD"] + "-01", float(r["OBS_VALUE"])])
    if not pts:
        raise ValueError("ECB: no observations")
    return pts


def boj_m2():
    url = ("https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en"
           "&db=MD02&startDate=201101&code=MAM1NAM2M2MO")
    d = json.loads(get(url))
    if str(d.get("STATUS")) != "200":
        raise ValueError(f"BOJ status {d.get('STATUS')} {d.get('MESSAGE')}")
    v = d["RESULTSET"][0]["VALUES"]
    pts = []
    for ym, val in zip(v["SURVEY_DATES"], v["VALUES"]):
        if val is None or val == "":
            continue
        ym = str(ym)
        pts.append([f"{ym[:4]}-{ym[4:6]}-01", float(val)])
    if not pts:
        raise ValueError("BOJ: no observations")
    return pts


PBOC = "https://www.pbc.gov.cn"


def _dec(b):
    for enc in ("utf-8", "gb18030"):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode("utf-8", "ignore")


def pboc_m2(prev_pts):
    """Scrape PBoC yearly Money Supply tables. Completed years already present
    in prev_pts (12 months) are reused instead of re-fetched."""
    have = {}
    for d, v in prev_pts or []:
        have.setdefault(d[:4], []).append([d, v])
    idx = _dec(get(PBOC + "/diaochatongjisi/116219/116319/index.html", ua=BROWSER_UA))
    years = {}
    for m in re.finditer(r"116319/([0-9a-z]+)/index\.html'>(\d{4})年统计数据", idx):
        years[m.group(2)] = m.group(1)
    links = {}
    for m in re.finditer(r"116319/([0-9a-z]+)/([0-9a-z]+)/index\.html'[^>]*>货币统计概览", idx):
        links[m.group(1)] = m.group(2)
    out = []
    for y in sorted(years):
        if y < MONTHLY_START[:4]:
            continue
        if int(y) < TODAY.year - 1 and len(have.get(y, [])) == 12:
            out += have[y]
            continue
        yid = years[y]
        if yid not in links:
            continue
        page = _dec(get(f"{PBOC}/diaochatongjisi/116219/116319/{yid}/{links[yid]}/index.html", ua=BROWSER_UA))
        t = re.sub(r"\s+", " ", page)
        m = (re.search(r'href="([^"]+\.htm)"[^>]*title="货币供应量表"', t)
             or re.search(r'货币供应量.{0,400}?href="([^"]+\.htm)"', t))
        if not m:
            raise ValueError(f"PBoC {y}: Money Supply htm link not found")
        href = m.group(1)
        href = href if href.startswith("http") else PBOC + href
        tab = _dec(get(href.replace("http://", "https://"), ua=BROWSER_UA))
        txt = re.sub(r"&nbsp;", " ", re.sub(r"<[^>]+>", " ", tab))
        txt = re.sub(r"\s+", " ", txt)
        labels = re.findall(r"\b(20\d\d)\.(\d{1,2})\b", txt.split("货币和准货币")[0])
        mrow = re.search(r"货币和准货币\s*[（(]M2[)）]\s*((?:-?[\d,]+\.?\d*\s*)+)", txt)
        if not labels or not mrow:
            raise ValueError(f"PBoC {y}: could not parse table")
        vals = [float(x.replace(",", "")) for x in mrow.group(1).split()]
        for (yy, mm), v in zip(labels, vals):
            out.append([f"{yy}-{int(mm):02d}-01", v])
    out = sorted({d: v for d, v in out}.items())
    if not out:
        raise ValueError("PBoC: no observations")
    return [list(x) for x in out]


def monthly_avg(daily):
    """Average of daily obs per calendar month; only complete months."""
    # a month counts as complete only once the series has an observation in a
    # later month (FRED's H.10 rates lag by about a week)
    cur = daily[-1][0][:7] if daily else TODAY.strftime("%Y-%m")
    acc = {}
    for d, v in daily:
        k = d[:7]
        if k < cur:
            acc.setdefault(k, []).append(v)
    return [[k + "-01", round(sum(v) / len(v), 6)] for k, v in sorted(acc.items())]


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            prev = {}
    pser = prev.get("series", {})
    series, failed, full = {}, [], {}

    def keep_prev(sid, err):
        failed.append({"id": sid, "error": str(err)[:200]})
        if sid in pser:
            s = dict(pser[sid]); s["stale_copy"] = True
            series[sid] = s
        print(f"FAILED {sid}: {err}", file=sys.stderr)

    def put(sid, title, units, freq, source, pts, start):
        p = [x for x in pts if x[0] >= start]
        series[sid] = {"title": title, "units": units, "freq": freq, "source": source,
                       "last_date": pts[-1][0], "points": p}

    for sid, (title, units, freq) in FRED.items():
        try:
            pts = fred(sid)
            full[sid] = pts
            # full history for every FRED series (daily ones too), so rarity scans see the real record
            put(sid, title, units, freq, f"FRED {sid}", pts, "")
        except Exception as e:
            keep_prev(sid, e)

    extra = [
        ("EA_M2_ECB", "Euro area M2 (ECB)", "Millions of EUR, SA, end of month", "Monthly",
         "ECB Data Portal BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E", ecb_m2),
        ("JP_M2_BOJ", "Japan M2 (BOJ)", "100 millions of JPY, NSA, monthly average outstanding", "Monthly",
         "Bank of Japan stat-search API MD02/MAM1NAM2M2MO", boj_m2),
        ("CN_M2_PBOC", "China M2 (PBoC)", "100 millions of CNY, NSA, end of month", "Monthly",
         "People's Bank of China, Money Supply table (pbc.gov.cn)",
         lambda: pboc_m2(pser.get("CN_M2_PBOC", {}).get("points"))),
    ]
    for sid, title, units, freq, src, fn in extra:
        try:
            pts = fn()
            full[sid] = pts
            put(sid, title, units, freq, src, pts, MONTHLY_START)
        except Exception as e:
            keep_prev(sid, e)

    # Monthly-average FX (computed from the daily H.10 series)
    for sid, title, units in (("DEXUSEU", "USD per EUR, monthly average", "USD per EUR"),
                              ("DEXJPUS", "JPY per USD, monthly average", "JPY per USD"),
                              ("DEXCHUS", "CNY per USD, monthly average", "CNY per USD")):
        mid = sid + "_MAVG"
        if sid in full:
            pts = monthly_avg(full[sid])
            put(mid, title, units, "Monthly (avg of daily, complete months)",
                f"Computed from FRED {sid}", pts, MONTHLY_START)
        elif mid in pser:
            series[mid] = dict(pser[mid], stale_copy=True)

    # ---- Global M2 in USD -------------------------------------------------
    def asdict(sid):
        return {d: v for d, v in series.get(sid, {}).get("points", [])}

    comp_def = {
        "US": ("M2SL", None, lambda v, fx: v),                       # bn USD
        "EA": ("EA_M2_ECB", "DEXUSEU_MAVG", lambda v, fx: v / 1e3 * fx),  # EUR mn -> USD bn
        "JP": ("JP_M2_BOJ", "DEXJPUS_MAVG", lambda v, fx: v / 10 / fx),   # 100mn JPY -> USD bn
        "CN": ("CN_M2_PBOC", "DEXCHUS_MAVG", lambda v, fx: v / 10 / fx),  # 100mn CNY -> USD bn
    }
    data = {k: (asdict(m), asdict(f) if f else None) for k, (m, f, _) in comp_def.items()}
    months = sorted(set.intersection(*[set(d[0]) for d in data.values()]))
    pts, checks_ok = [], True
    for mth in months:
        row = {}
        ok = True
        for k, (m2, fx) in data.items():
            if fx is not None and mth not in fx:
                ok = False; break
            row[k] = comp_def[k][2](m2[mth], fx[mth] if fx is not None else None)
        if not ok:
            continue
        total = sum(row.values())
        diff = abs(total - (row["US"] + row["EA"] + row["JP"] + row["CN"]))
        checks_ok &= diff < 1e-6
        pts.append([mth, round(total, 3), round(row["US"], 3), round(row["EA"], 3),
                    round(row["JP"], 3), round(row["CN"], 3)])
    comps = {}
    for k, (m, f, _) in comp_def.items():
        s = series.get(m, {})
        ld = s.get("last_date")
        age = (TODAY - dt.date.fromisoformat(ld)).days if ld else None
        comps[k] = {"series": m, "source": s.get("source"), "last_date": ld,
                    "fx_series": f, "fx_last_date": series.get(f, {}).get("last_date") if f else None,
                    "age_days": age, "stale": (age is None or age > STALE_DAYS),
                    "failed_this_run": any(x["id"] == m for x in failed)}
    latest = pts[-1] if pts else None
    # verify the rounded latest row too
    sum_check = None
    if latest:
        s4 = round(sum(latest[2:6]), 3)
        sum_check = {"month": latest[0], "total": latest[1], "sum_of_components": s4,
                     "abs_diff": round(abs(s4 - latest[1]), 6), "ok": abs(s4 - latest[1]) < 0.01}
    global_m2 = {
        "title": "Global M2 (US + Euro area + Japan + China) in USD",
        "units": "Billions of USD",
        "method": ("Each economy's M2 converted to USD with the monthly average of the FRED H.10 daily rate "
                   "(DEXUSEU, DEXJPUS, DEXCHUS). Total computed only for months where all four components "
                   "AND all FX averages exist; no forward-filling. Note: definitions differ (US monthly avg SA, "
                   "EA end-of-month SA, JP monthly avg NSA, CN end-of-month NSA)."),
        "columns": ["date", "total", "US", "EA", "JP", "CN"],
        "latest_complete_month": latest[0] if latest else None,
        "last_date": latest[0] if latest else None,
        "components": comps,
        "stale_components": [k for k, c in comps.items() if c["stale"]],
        "sum_check": {"all_months_ok": checks_ok, "latest": sum_check},
        "points": pts,
    }

    # ---- constant-currency global M2 (FX held at the 2015 average) ----------
    fxbase = {}
    for f in ("DEXUSEU_MAVG", "DEXJPUS_MAVG", "DEXCHUS_MAVG"):
        v = [x for d, x in series.get(f, {}).get("points", []) if d.startswith("2015-")]
        if len(v) == 12:
            fxbase[f] = sum(v) / 12
    if len(fxbase) == 3:
        cc = {"US": lambda v: v, "EA": lambda v: v / 1e3 * fxbase["DEXUSEU_MAVG"],
              "JP": lambda v: v / 10 / fxbase["DEXJPUS_MAVG"], "CN": lambda v: v / 10 / fxbase["DEXCHUS_MAVG"]}
        m2d = {k: asdict(comp_def[k][0]) for k in cc}
        for row in pts:
            mth = row[0]
            row.append(round(sum(cc[k](m2d[k][mth]) for k in cc), 3))
        global_m2["columns"].append("total_cc")
        global_m2["constant_currency"] = {
            "column": "total_cc", "fx_base": "2015 average of the monthly-average FX rates",
            "fx": {k: round(v, 6) for k, v in fxbase.items()},
            "why": "Holding FX fixed removes the dollar's effect on the USD total, so changes reflect local money growth only."}

    # ---- US net liquidity = Fed balance sheet - TGA - ON RRP (weekly, Wednesdays) ----
    net_liq = None
    if all(k in full for k in ("WALCL", "WTREGEN", "RRPONTSYD")):
        tga = {d: v for d, v in full["WTREGEN"]}
        rrp = sorted(full["RRPONTSYD"])
        import bisect
        rd = [d for d, _ in rrp]
        nl = []
        for d, w in full["WALCL"]:
            if d not in tga:
                continue
            i = bisect.bisect_right(rd, d) - 1          # RRP on that Wednesday, or the last day before it
            if i < 0 or (dt.date.fromisoformat(d) - dt.date.fromisoformat(rd[i])).days > 5:
                continue
            nl.append([d, round(w / 1e3 - tga[d] / 1e3 - rrp[i][1], 1), round(w / 1e3, 1), round(tga[d] / 1e3, 1), round(rrp[i][1], 1)])
        if nl:
            net_liq = {"title": "US net liquidity (Fed balance sheet - TGA - ON RRP)", "units": "Billions of USD",
                       "freq": "Weekly (Wednesday)", "columns": ["date", "net_liquidity", "walcl", "tga", "rrp"],
                       "method": ("WALCL (Wednesday level, $mn) / 1000 - WTREGEN (TGA, week average ending Wednesday, $mn) / 1000 "
                                  "- RRPONTSYD (ON RRP, $bn, value on that Wednesday or the last business day before it, max 5 days). "
                                  "Mixes a level with a week average, the usual public approximation."),
                       "source": "FRED WALCL, WTREGEN, RRPONTSYD", "last_date": nl[-1][0], "points": nl}

    out = {"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
           "stale_threshold_days": STALE_DAYS,
           "failed": failed,
           "series": series,
           "global_m2": global_m2,
           "net_liquidity": net_liq}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # Only rewrite when content (ignoring 'updated') changed
    if prev:
        a = dict(prev); b = dict(out); a.pop("updated", None); b.pop("updated", None)
        if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True):
            print("macro.json: no data change")
            return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"macro.json written: {len(series)} series, failed={[x['id'] for x in failed]}")
    for sid, s in series.items():
        print(f"  {sid:14s} last_date={s.get('last_date')} n={len(s.get('points', []))}")
    if latest:
        print("  GLOBAL_M2", latest, sum_check, "stale:", global_m2["stale_components"])
    if net_liq:
        print("  NET_LIQ", net_liq["points"][-1], "n", len(net_liq["points"]))


if __name__ == "__main__":
    main()
