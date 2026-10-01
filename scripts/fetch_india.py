#!/usr/bin/env python3
"""Refresh data/india.json (hourly): CoinDCX BTCINR & USDTINR, Coinbase BTC-USD spot,
USD/INR mid-market (open.er-api.com, fallback frankfurter), premiums, and a rolling
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

    try:
        d = getj("https://open.er-api.com/v6/latest/USD")
        if d.get("result") != "success":
            raise ValueError(d.get("result"))
        cur["usd_inr"] = float(d["rates"]["INR"])
        src["usd_inr"] = {"provider": "open.er-api.com (ExchangeRate-API, daily mid-market)",
                          "url": "https://open.er-api.com/v6/latest/USD",
                          "as_of": dt.datetime.fromtimestamp(d["time_last_update_unix"], dt.timezone.utc).strftime(ISO)}
    except Exception as e:
        failed.append({"id": "open.er-api", "error": str(e)[:200]})
        try:
            d = getj("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR")
            cur["usd_inr"] = float(d["rates"]["INR"])
            src["usd_inr"] = {"provider": "frankfurter (ECB reference rate, daily)",
                              "url": "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR",
                              "as_of": d["date"] + "T16:00:00Z"}
        except Exception as e2:
            failed.append({"id": "frankfurter", "error": str(e2)[:200]})

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
           "sources": src, "failed": failed, "latest": latest,
           "history_window": "30 days, hourly", "history": hist}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    print(json.dumps(latest), "failed:", [f["id"] for f in failed], "history:", len(hist), file=sys.stderr)


if __name__ == "__main__":
    main()
