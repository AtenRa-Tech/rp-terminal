#!/usr/bin/env python3
"""Refresh data/india.json (hourly): CoinDCX BTCINR & USDTINR, Coinbase BTC-USD spot,
USD/INR reference rates (Frankfurter/ECB and open.er-api, FRED DEXINUS as a lagging check), premiums, and a rolling
30-day hourly history. stdlib only, no keys."""
import datetime as dt, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "india.json")
UA = "rp-terminal-data/1.0 (+https://github.com/AtenRa-Tech/rp-terminal)"
NOW = dt.datetime.now(dt.timezone.utc)
ISO = "%Y-%m-%dT%H:%M:%SZ"


def getj(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            prev = {}
    pl = prev.get("latest", {})
    failed, src = [], {}
    cur = {}

    try:
        t = {x["market"]: x for x in getj("https://api.coindcx.com/exchange/ticker")}
        cur["btc_inr"] = float(t["BTCINR"]["last_price"])
        cur["usdt_inr"] = float(t["USDTINR"]["last_price"])
        ts = max(int(t["BTCINR"]["timestamp"]), int(t["USDTINR"]["timestamp"]))
        src["coindcx"] = {"url": "https://api.coindcx.com/exchange/ticker", "markets": ["BTCINR", "USDTINR"],
                          "as_of": dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime(ISO)}
    except Exception as e:
        failed.append({"id": "coindcx", "error": str(e)[:200]})

    try:
        cur["btc_usd"] = float(getj("https://api.coinbase.com/v2/prices/BTC-USD/spot")["data"]["amount"])
        src["btc_usd"] = {"url": "https://api.coinbase.com/v2/prices/BTC-USD/spot", "as_of": NOW.strftime(ISO)}
    except Exception as e:
        failed.append({"id": "coinbase", "error": str(e)[:200]})

    # USD/INR from two independent daily sources (each stored with its own date) + FRED DEXINUS as a lagging check
    fx = {}
    try:
        d = getj("https://api.frankfurter.app/latest?from=USD&to=INR")   # 301 -> api.frankfurter.dev; urllib follows it
        fx["ecb"] = {"rate": float(d["rates"]["INR"]), "date": d["date"], "provider": "Frankfurter (ECB reference rate)",
                     "url": "https://api.frankfurter.app/latest?from=USD&to=INR"}
    except Exception as e:
        failed.append({"id": "frankfurter", "error": str(e)[:200]})
    try:
        d = getj("https://open.er-api.com/v6/latest/USD")
        if d.get("result") != "success":
            raise ValueError(d.get("result"))
        fx["erapi"] = {"rate": float(d["rates"]["INR"]), "provider": "open.er-api.com (ExchangeRate-API)",
                       "date": dt.datetime.fromtimestamp(d["time_last_update_unix"], dt.timezone.utc).strftime("%Y-%m-%d"),
                       "url": "https://open.er-api.com/v6/latest/USD"}
    except Exception as e:
        failed.append({"id": "open.er-api", "error": str(e)[:200]})
    try:
        req = urllib.request.Request("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXINUS", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=40) as r:
            rows = [x.split(",") for x in r.read().decode().strip().splitlines()[1:]]
        rows = [x for x in rows if len(x) == 2 and x[1] not in (".", "")]
        fx["fred"] = {"rate": float(rows[-1][1]), "date": rows[-1][0], "provider": "FRED DEXINUS (noon NY buying rate, lags about a week)",
                      "url": "https://fred.stlouisfed.org/series/DEXINUS"}
    except Exception as e:
        failed.append({"id": "fred_dexinus", "error": str(e)[:200]})
    if not fx.get("ecb") and not fx.get("erapi"):
        pfx = prev.get("fx") or {}
        for k in ("ecb", "erapi"):
            if pfx.get(k):
                fx[k] = dict(pfx[k], carried_forward=True)
    live = [fx[k]["rate"] for k in ("ecb", "erapi") if fx.get(k)]
    if live:
        cur["usd_inr"] = sum(live) / len(live)
        src["usd_inr"] = {"provider": " / ".join(fx[k]["provider"] for k in ("ecb", "erapi") if fx.get(k)),
                          "method": "average of the available daily reference rates", "dates": {k: fx[k]["date"] for k in ("ecb", "erapi") if fx.get(k)}}
    # carry forward previous values for missing inputs, flagged
    carried = []
    for k in ("btc_inr", "usdt_inr", "btc_usd", "usd_inr"):
        if k not in cur and k in pl:
            cur[k] = pl[k]; carried.append(k)
    latest = {"time": NOW.strftime(ISO)}
    latest.update({k: cur.get(k) for k in ("btc_inr", "usdt_inr", "btc_usd", "usd_inr")})
    try:
        latest["btc_premium_pct"] = round((cur["btc_inr"] / (cur["btc_usd"] * cur["usd_inr"]) - 1) * 100, 4)
        latest["usdt_premium_pct"] = round((cur["usdt_inr"] / cur["usd_inr"] - 1) * 100, 4)
        latest["btc_premium_in_usdt_pct"] = round((cur["btc_inr"] / (cur["btc_usd"] * cur["usdt_inr"]) - 1) * 100, 4)
    except (KeyError, TypeError, ZeroDivisionError):
        latest.update(btc_premium_pct=None, usdt_premium_pct=None, btc_premium_in_usdt_pct=None)
    latest["carried_forward"] = carried
    live = [fx[k]["rate"] for k in ("ecb", "erapi") if fx.get(k)]
    if live and cur.get("usdt_inr") and cur.get("btc_inr") and cur.get("btc_usd"):
        lo, hi = min(live), max(live)
        latest["usd_inr_lo"], latest["usd_inr_hi"] = lo, hi
        latest["fx_spread_pct"] = round((hi / lo - 1) * 100, 4)
        latest["fx_disagree"] = latest["fx_spread_pct"] > 0.2
        latest["usdt_premium_range_pct"] = [round((cur["usdt_inr"] / hi - 1) * 100, 4), round((cur["usdt_inr"] / lo - 1) * 100, 4)]
        latest["btc_premium_range_pct"] = [round((cur["btc_inr"] / (cur["btc_usd"] * hi) - 1) * 100, 4), round((cur["btc_inr"] / (cur["btc_usd"] * lo) - 1) * 100, 4)]

    hist = [h for h in prev.get("history", []) if isinstance(h, dict)]
    cutoff = (NOW - dt.timedelta(days=30)).strftime(ISO)
    hour = NOW.strftime("%Y-%m-%dT%H")
    hist = [h for h in hist if h["time"] >= cutoff and not h["time"].startswith(hour)]
    if not carried or len(carried) < 4:
        hist.append({k: latest[k] for k in ("time", "btc_inr", "usdt_inr", "btc_usd", "usd_inr",
                                            "btc_premium_pct", "usdt_premium_pct", "btc_premium_in_usdt_pct")})
    hist.sort(key=lambda h: h["time"])

    out = {"updated": NOW.strftime(ISO), "last_date": latest["time"],
           "units": {"btc_inr": "INR", "usdt_inr": "INR", "btc_usd": "USD", "usd_inr": "INR per USD",
                     "*_pct": "percent"},
           "formulas": {"btc_premium_pct": "btc_inr/(btc_usd*usd_inr)-1",
                        "usdt_premium_pct": "usdt_inr/usd_inr-1",
                        "btc_premium_in_usdt_pct": "btc_inr/(btc_usd*usdt_inr)-1"},
           "sources": src, "fx": fx, "failed": failed, "latest": latest,
           "history_window": "30 days, hourly", "history": hist}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    s = json.dumps(out, separators=(",", ":"), allow_nan=False)
    with open(OUT + ".tmp", "w", encoding="utf-8") as f:
        f.write(s)
    os.replace(OUT + ".tmp", OUT)
    print(json.dumps(latest), "failed:", [f["id"] for f in failed], "history:", len(hist), file=sys.stderr)


if __name__ == "__main__":
    main()
