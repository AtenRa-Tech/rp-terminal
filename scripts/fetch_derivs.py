#!/usr/bin/env python3
"""Refresh data/derivs.json for RP Terminal: BTC/ETH perpetual open interest,
funding and spot-vs-perp basis from public exchange endpoints (stdlib only).

Fallback chain per series: Binance USD-M -> OKX -> Bybit -> Deribit (funding only).
Binance and Bybit geo-block US IPs (HTTP 451 / 403), and GitHub-hosted runners are
in the US, so in practice OKX is usually the source there. The venue actually used
is recorded per series ("source"), with every attempt listed under "attempts".

These are SINGLE-VENUE numbers (one exchange's USDT-margined perpetual), not an
aggregate across exchanges. There is no reliable free aggregated OI feed.

Series kept per asset:
  oi_hourly    last 30 days, hourly   [t_ms, oi_usd, oi_coin]
  oi_daily     as long as the venue offers (OKX: since end-2023)   [t_ms, oi_usd, oi_coin]
  funding      per funding event, merged with previous runs (history grows; capped at 2 years)  [t_ms, rate]
  basis_hourly last 30 days, hourly: perp close vs spot close  [t_ms, perp, spot, basis_pct]
"""
import datetime as dt, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "derivs.json")
UA = "rp-terminal-data/1.0 (+https://github.com/AtenRa-Tech/rp-terminal)"
NOW = dt.datetime.now(dt.timezone.utc)
NOW_MS = int(NOW.timestamp() * 1000)
H = 3600_000
DAY = 24 * H
SYM = {"BTC": {"bn": "BTCUSDT", "okx": "BTC-USDT-SWAP", "okx_spot": "BTC-USDT", "bybit": "BTCUSDT", "deribit": "BTC-PERPETUAL"},
       "ETH": {"bn": "ETHUSDT", "okx": "ETH-USDT-SWAP", "okx_spot": "ETH-USDT", "bybit": "ETHUSDT", "deribit": "ETH-PERPETUAL"}}



def write_json(path, obj):
    """Atomic write; refuses NaN/Infinity so a bad value can never corrupt the file."""
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(s)
    os.replace(tmp, path)

def get(url, timeout=25, tries=2):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 451):   # geo-block: no point retrying
                raise RuntimeError(f"HTTP {e.code} (geo-blocked)")
            last = e
        except Exception as e:  # noqa
            last = e
        time.sleep(1.5 * (i + 1))
    raise last


def okx(path):
    d = get("https://www.okx.com" + path)
    if str(d.get("code")) != "0":
        raise RuntimeError(f"OKX code {d.get('code')} {d.get('msg')}")
    time.sleep(0.15)
    return d["data"]


# ---------------- open interest ----------------
def bn_oi(a, period, days):
    out, end = {}, NOW_MS
    while True:
        d = get(f"https://fapi.binance.com/futures/data/openInterestHist?symbol={SYM[a]['bn']}&period={period}&limit=500&endTime={end}")
        if not d:
            break
        for r in d:
            out[int(r["timestamp"])] = [int(r["timestamp"]), round(float(r["sumOpenInterestValue"]), 0), round(float(r["sumOpenInterest"]), 3)]
        first = min(int(r["timestamp"]) for r in d)
        if first <= NOW_MS - days * DAY or len(d) < 500:
            break
        end = first - 1
    pts = sorted(v for k, v in out.items() if k >= NOW_MS - days * DAY)
    return pts, {"source": "Binance USD-M", "instrument": SYM[a]["bn"] + " perpetual", "note": "Binance only serves the last 30 days of OI history"}


def okx_oi(a, period, days):
    out, end = {}, None
    for _ in range(40):
        d = okx(f"/api/v5/rubik/stat/contracts/open-interest-history?instId={SYM[a]['okx']}&period={period}&limit=100" + (f"&end={end}" if end else ""))
        if not d:
            break
        for t, _oi, ccy, usd in d:
            out[int(t)] = [int(t), round(float(usd), 0), round(float(ccy), 3)]
        first = int(d[-1][0])
        if first <= NOW_MS - days * DAY:
            break
        end = first - 1
    pts = sorted(v for k, v in out.items() if k >= NOW_MS - days * DAY)
    meta = {"source": "OKX", "instrument": SYM[a]["okx"] + " (USDT-margined perpetual)"}
    if period == "1D":
        meta["note"] = "OKX daily buckets start at 16:00 UTC (00:00 UTC+8)"
    return pts, meta


def bybit_oi(a, interval, days):
    sym = SYM[a]["bybit"]
    out, cursor = {}, ""
    for _ in range(40):
        d = get(f"https://api.bybit.com/v5/market/open-interest?category=linear&symbol={sym}&intervalTime={interval}&limit=200" + (f"&cursor={cursor}" if cursor else ""))
        lst = d.get("result", {}).get("list", [])
        for r in lst:
            out[int(r["timestamp"])] = float(r["openInterest"])
        cursor = d.get("result", {}).get("nextPageCursor")
        if not lst or not cursor or min(out) <= NOW_MS - days * DAY:
            break
    kl = get(f"https://api.bybit.com/v5/market/kline?category=linear&symbol={sym}&interval={'60' if interval == '1h' else 'D'}&limit=1000")
    px = {int(r[0]): float(r[4]) for r in kl.get("result", {}).get("list", [])}
    pts = []
    for t in sorted(out):
        if t < NOW_MS - days * DAY:
            continue
        p = px.get(t)
        pts.append([t, round(out[t] * p, 0) if p else None, round(out[t], 3)])
    return pts, {"source": "Bybit", "instrument": sym + " linear perpetual"}


# ---------------- funding ----------------
def bn_funding(a, days):
    d = get(f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={SYM[a]['bn']}&limit=1000&startTime={NOW_MS - days * DAY}")
    return [[int(r["fundingTime"]), float(r["fundingRate"])] for r in d], {"source": "Binance USD-M", "instrument": SYM[a]["bn"], "interval_h": 8}


def okx_funding(a, days):
    out, after = {}, None
    for _ in range(10):
        d = okx(f"/api/v5/public/funding-rate-history?instId={SYM[a]['okx']}&limit=400" + (f"&after={after}" if after else ""))
        if not d:
            break
        for r in d:
            out[int(r["fundingTime"])] = float(r.get("realizedRate") or r["fundingRate"])
        after = d[-1]["fundingTime"]
        if int(after) <= NOW_MS - days * DAY:
            break
    return [[t, out[t]] for t in sorted(out)], {"source": "OKX", "instrument": SYM[a]["okx"], "interval_h": 8, "note": "OKX serves about 3 months of funding history; older points are kept from previous runs"}


def bybit_funding(a, days):
    d = get(f"https://api.bybit.com/v5/market/funding/history?category=linear&symbol={SYM[a]['bybit']}&limit=200")
    lst = d.get("result", {}).get("list", [])
    return sorted([int(r["fundingRateTimestamp"]), float(r["fundingRate"])] for r in lst), {"source": "Bybit", "instrument": SYM[a]["bybit"], "interval_h": 8}


def deribit_funding(a, days):
    out = {}
    end = NOW_MS
    start_all = NOW_MS - days * DAY
    while end > start_all:
        start = max(start_all, end - 30 * DAY)
        d = get(f"https://www.deribit.com/api/v2/public/get_funding_rate_history?instrument_name={SYM[a]['deribit']}&start_timestamp={start}&end_timestamp={end}")
        for r in d.get("result", []):
            t = int(r["timestamp"])
            if (t // H) % 8 == 0:              # sample every 8h so it is comparable
                out[t] = float(r["interest_8h"])
        end = start - 1
    return [[t, out[t]] for t in sorted(out)], {"source": "Deribit", "instrument": SYM[a]["deribit"], "interval_h": 8, "note": "Deribit interest_8h sampled every 8 hours (inverse BTC-margined perpetual)"}


# ---------------- basis ----------------
def bn_basis(a, days):
    out, end = [], NOW_MS
    d = get(f"https://fapi.binance.com/futures/data/basis?pair={SYM[a]['bn']}&contractType=PERPETUAL&period=1h&limit=500&endTime={end}")
    for r in d:
        perp, idx = float(r["futuresPrice"]), float(r["indexPrice"])
        out.append([int(r["timestamp"]), perp, idx, round((perp / idx - 1) * 100, 4)])
    return sorted(out), {"source": "Binance USD-M basis (perp vs index)", "instrument": SYM[a]["bn"]}


def okx_candles(inst, days):
    out, after = {}, None
    for _ in range(12):
        d = okx(f"/api/v5/market/history-candles?instId={inst}&bar=1H&limit=100" + (f"&after={after}" if after else ""))
        if not d:
            break
        for r in d:
            if r[8] == "1":          # confirmed candles only
                out[int(r[0])] = float(r[4])
        after = d[-1][0]
        if int(after) <= NOW_MS - days * DAY:
            break
    return out


def okx_basis(a, days):
    perp, spot = okx_candles(SYM[a]["okx"], days), okx_candles(SYM[a]["okx_spot"], days)
    pts = [[t, perp[t], spot[t], round((perp[t] / spot[t] - 1) * 100, 4)] for t in sorted(set(perp) & set(spot)) if t >= NOW_MS - days * DAY]
    return pts, {"source": "OKX (perp close vs spot close)", "instrument": f"{SYM[a]['okx']} vs {SYM[a]['okx_spot']}"}


def chain(label, fns, attempts):
    tried = []
    for name, fn in fns:
        try:
            pts, meta = fn()
            if not pts:
                raise RuntimeError("no data")
            tried.append({"source": name, "ok": True, "n": len(pts)})
            attempts.append({"series": label, "tried": tried})
            return pts, meta
        except Exception as e:  # noqa
            tried.append({"source": name, "ok": False, "error": str(e)[:160]})
            print(f"  {label}: {name} failed: {str(e)[:120]}", file=sys.stderr)
    attempts.append({"series": label, "tried": tried})
    return None, None


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            prev = {}
    attempts, assets = [], {}
    for a in ("BTC", "ETH"):
        pa = prev.get("assets", {}).get(a, {})
        A = {}

        def put(key, pts, meta, cols, units):
            if pts:
                A[key] = dict(meta, columns=cols, units=units, last=pts[-1][0], points=pts)
            elif key in pa:
                A[key] = dict(pa[key], stale_copy=True)

        pts, meta = chain(f"{a} oi_hourly", [("Binance", lambda: bn_oi(a, "1h", 30)), ("OKX", lambda: okx_oi(a, "1H", 30)), ("Bybit", lambda: bybit_oi(a, "1h", 30))], attempts)
        put("oi_hourly", pts, meta, ["t", "oi_usd", "oi_coin"], "USD notional and coin")
        # long daily history: OKX first (since end-2023); Binance only keeps 30 days
        pts, meta = chain(f"{a} oi_daily", [("OKX", lambda: okx_oi(a, "1D", 1100)), ("Bybit", lambda: bybit_oi(a, "1d", 1100)), ("Binance", lambda: bn_oi(a, "1d", 30))], attempts)
        put("oi_daily", pts, meta, ["t", "oi_usd", "oi_coin"], "USD notional and coin")
        pts, meta = chain(f"{a} funding", [("Binance", lambda: bn_funding(a, 365)), ("OKX", lambda: okx_funding(a, 365)), ("Bybit", lambda: bybit_funding(a, 365)), ("Deribit", lambda: deribit_funding(a, 90))], attempts)
        if pts:
            # merge with earlier runs from the SAME source so history accumulates beyond what the API serves
            old = pa.get("funding", {})
            if old.get("source") == meta["source"]:
                m = {int(t): r for t, r in old.get("points", [])}
                m.update({int(t): r for t, r in pts})
                pts = [[t, m[t]] for t in sorted(m) if t >= NOW_MS - 730 * DAY]
        put("funding", pts, meta or {}, ["t", "rate"], "fraction per funding interval (0.0001 = 0.01%)")
        pts, meta = chain(f"{a} basis_hourly", [("Binance", lambda: bn_basis(a, 21)), ("OKX", lambda: okx_basis(a, 30))], attempts)
        put("basis_hourly", pts, meta, ["t", "perp", "spot", "basis_pct"], "USD prices; basis in percent")
        lat = {}
        if A.get("oi_hourly"):
            t, usd, coin = A["oi_hourly"]["points"][-1]
            lat.update(oi_t=t, oi_usd=usd, oi_coin=coin)
        if A.get("funding"):
            t, r = A["funding"]["points"][-1]
            lat.update(funding_t=t, funding=r)
        if A.get("basis_hourly"):
            r = A["basis_hourly"]["points"][-1]
            lat.update(basis_t=r[0], basis_pct=r[3])
        A["latest"] = lat
        assets[a] = A
    out = {"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
           "scope": "Single venue per series (see 'source'); not an aggregate of all exchanges.",
           "fallback_chain": "Binance USD-M -> OKX -> Bybit (-> Deribit for funding). Binance/Bybit block US IPs, so GitHub-hosted runs normally use OKX.",
           "assets": assets, "attempts": attempts}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    write_json(OUT, out)
    for a, A in assets.items():
        for k, v in A.items():
            if k != "latest":
                print(f"{a} {k:13s} {v.get('source')} n={len(v.get('points', []))}{' STALE COPY' if v.get('stale_copy') else ''}")
        print(a, "latest", A["latest"])


if __name__ == "__main__":
    main()
