#!/usr/bin/env python3
"""Refresh data/market.json for RP Terminal: BTC dominance, TOTAL / TOTAL2 / TOTAL3,
altcoin breadth (B30 / B90), cap-tier rotation and altcoin volume share (stdlib only, no keys).

Sources and why
  Ranking + exact snapshot : CoinPaprika /v1/global + /v1/tickers (free; 60 requests/hour per IP,
                             so this job makes only 2 calls). Fallback: CoinLore /api/global + /api/tickers.
                             CoinGecko's free API answers HTTP 429 to cloud IPs, and its
                             market_cap_chart endpoint needs a paid key.
  Daily closes             : Binance spot <SYM>USDT 1d klines (data-api.binance.vision, completed UTC
                             days only); fallback OKX spot <SYM>-USDT 1Dutc candles (confirmed only).
                             A coin's exchange price must match its ranking price within 6%, or the pair
                             is rejected (guards against ticker-symbol collisions).
  Stablecoin supply        : DefiLlama stablecoincharts/all (USD-pegged circulating).

Exact vs reconstructed (labelled separately in the file)
  global_daily  EXACT. One snapshot per UTC day from the ranking source: total market cap, BTC and ETH
                dominance, TOTAL2 = total - BTC cap, TOTAL3 = TOTAL2 - ETH cap. History starts with the
                first run of this job and builds daily ("history building").
  totals_proxy  RECONSTRUCTED daily history: sum over today's top non-stable assets (after removing
                wrapped/staked duplicates) of daily close x TODAY's circulating supply, plus DefiLlama's
                total stablecoin supply for that day. Limits: (1) uses current supply, so coins whose
                supply grew are overstated in the past; (2) survivorship: today's constituents only;
                (3) top-N coverage only (coverage ratio vs the exact total is reported).
  breadth       Universe = top 50 by market cap excluding BTC, stablecoins, gold tokens, wrapped/staked/
                bridged tokens and anything with < 120 days of daily closes (eligibility re-checked for
                every historical day). B30 / B90 = % of the universe whose 30 / 90-day return beat BTC's.
                Backfilled from price history using today's constituents (survivorship noted).
  rotation      median 30-day return minus BTC's, for coin ranks 2-10 / 11-50 / 51-100 (after exclusions).
  alt_volume    altcoin share of Binance spot USDT volume across the covered coins (single venue).
"""
import datetime as dt, json, os, re, statistics as st, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "market.json")
UA = "rp-terminal-data/1.0 (+https://github.com/AtenRa-Tech/rp-terminal)"
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date().isoformat()
DAY_MS = 86400_000
KEEP_DAYS = 760
UNIVERSE_N, MIN_HIST = 50, 120
TOTALS_N = 150

STABLE = {"USDT", "USDC", "DAI", "USDE", "FDUSD", "PYUSD", "USDS", "USD1", "TUSD", "USDD", "RLUSD", "FRAX", "USDG", "GHO",
          "CRVUSD", "LUSD", "USDP", "GUSD", "BUSD", "USDB", "USDX", "USDA", "EURC", "EURS", "EURT", "USDTB", "USYC", "BUIDL",
          "USR", "DOLA", "SUSD", "MIM", "FRXUSD", "USD0", "AUSD", "USDF", "BFUSD", "USDO", "USX", "ZUSD", "EUSD", "USDL", "XUSD",
          "OUSD", "USDY", "OUSG", "USTB", "USDM", "BOLD", "MUSD", "DEUSD", "SRUSD", "RUSD", "USDN", "CUSD", "AVUSD", "USDZ",
          "USDC.E", "USDAI", "UUSD", "M", "CASH", "BTSE"}
PEGGED = {"XAUT", "PAXG", "KAU", "XAUM", "CGO", "DGX"}
DUP_SYM = {"WBTC", "WETH", "STETH", "WSTETH", "WEETH", "EETH", "RETH", "CBBTC", "CBETH", "METH", "EZETH", "RSETH", "BTCB", "BTC.B",
           "SOLVBTC", "LBTC", "JITOSOL", "MSOL", "BNSOL", "TBTC", "WBETH", "BETH", "CLBTC", "FBTC", "SUSDE", "SUSDS", "USDT0",
           "BSC-USD", "JUPSOL", "SAVAX", "OSETH", "SFRXETH", "FRXETH", "PUFETH", "SWETH", "ANKRETH", "WBNB", "WTRX", "WSOL",
           "WHYPE", "KHYPE", "STHYPE", "UNIBTC", "PUMPBTC", "ENZOBTC", "XSOLVBTC", "LSETH", "OETH", "SUPEROETH", "WAVAX",
           "WPOL", "WMATIC", "STKAAVE", "WBT", "BBTC", "STBTC", "SCRVUSD", "SUSDA", "SUSDAI", "SYRUPUSDC", "SYRUPUSDT", "WUSDM",
           "WSTUSR", "STUSDS", "SDAI", "SAVUSD", "JLP", "ETHX", "ETH+", "EBTC", "VSOL", "SCNSOL", "BBSOL", "ASBNB", "PSOL", "HSOL"}
DUP_NAME = re.compile(r"\b(wrapped|staked|bridged|restaked|liquid staking|binance-peg|bitcoin bep2|rocket pool eth|coinbase wrapped)\b", re.I)


def get(url, timeout=40, tries=3, fatal=(402, 403, 451)):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code in fatal:
                raise
            time.sleep(8 if e.code == 429 else 2 * (i + 1))
        except Exception as e:  # noqa
            last = e
            time.sleep(2 * (i + 1))
    raise last


def ranking():
    """-> (source, global dict, list of coins {sym,name,rank,price,mcap,vol,pc7})"""
    try:
        g = get("https://api.coinpaprika.com/v1/global")
        t = get("https://api.coinpaprika.com/v1/tickers?quotes=USD")
        coins = []
        for x in t:
            q = x.get("quotes", {}).get("USD", {})
            if x.get("rank") and q.get("market_cap"):
                coins.append({"id": x["id"], "sym": x["symbol"].upper(), "name": x["name"], "rank": x["rank"], "price": q["price"],
                              "mcap": q["market_cap"], "vol": q.get("volume_24h"), "pc30": q.get("percent_change_30d")})
        return "CoinPaprika", {"total": float(g["market_cap_usd"]), "btc_dom": float(g["bitcoin_dominance_percentage"]), "vol": float(g["volume_24h_usd"])}, coins
    except Exception as e:  # noqa
        print("CoinPaprika failed:", str(e)[:120], "-> CoinLore", file=sys.stderr)
    g = get("https://api.coinlore.net/api/global/")[0]
    coins = []
    for start in range(0, 400, 100):
        for x in get(f"https://api.coinlore.net/api/tickers/?start={start}&limit=100")["data"]:
            coins.append({"id": "coinlore-" + str(x["id"]), "sym": x["symbol"].upper(), "name": x["name"], "rank": int(x["rank"]),
                          "price": float(x["price_usd"]), "mcap": float(x["market_cap_usd"] or 0), "vol": float(x.get("volume24") or 0), "pc30": None})
        time.sleep(0.5)
    return "CoinLore", {"total": float(g["total_mcap"]), "btc_dom": float(g["btc_d"]), "vol": float(g["total_volume"])}, coins


def classify(c, bpx, epx):
    s, n, px = c["sym"], c["name"], c["price"] or 0
    if s in DUP_SYM or DUP_NAME.search(n):
        return "dup"
    if s != "BTC" and bpx and abs(px / bpx - 1) < 0.03:
        return "dup"
    if s != "ETH" and epx and 0.97 <= px / epx <= 1.35 and re.search(r"eth", s + n, re.I):
        return "dup"
    if s in STABLE:
        return "stable"
    if s in PEGGED:
        return "pegged"
    # behavioural catch for unlisted USD/EUR stablecoins: must also be named like one
    if 0.97 <= px <= 1.03 and re.search(r"usd|dollar|eur", s + " " + n, re.I) and (c.get("pc30") is None or abs(c["pc30"]) < 2.5):
        return "stable"
    return "coin"


def closes(sym, ref_px):
    """Daily closes for completed UTC days: {date: (close, quote_volume)}, plus source.
    The pair is accepted only if its LIVE (current, unclosed) candle is within 8% of the ranking
    price and the pair traded in the last 2 days (rejects symbol collisions and delisted pairs)."""
    errs = []
    now_ms = int(NOW.timestamp() * 1000)
    ok = lambda live, last_ms: ref_px and live and abs(live / ref_px - 1) < 0.08 and now_ms - last_ms < 2 * DAY_MS
    try:
        k = get(f"https://data-api.binance.vision/api/v3/klines?symbol={sym}USDT&interval=1d&limit=1000", tries=2, fatal=(400, 402, 403, 451))
        if k and ok(float(k[-1][4]), k[-1][0]):
            return {dt.datetime.fromtimestamp(r[0] / 1000, dt.timezone.utc).date().isoformat(): (float(r[4]), float(r[7])) for r in k if r[6] < now_ms}, "Binance"
        errs.append("Binance price mismatch or stale" if k else "Binance empty")
    except Exception as e:  # noqa
        errs.append("Binance " + str(e)[:40])
    try:
        out, after, live = {}, None, None
        for _ in range(8):
            r = get(f"https://www.okx.com/api/v5/market/history-candles?instId={sym}-USDT&bar=1Dutc&limit=100" + (f"&after={after}" if after else ""), tries=2, fatal=(400, 402, 403, 404, 451))
            data = r.get("data", [])
            if not data:
                break
            if live is None:
                live = (float(data[0][4]), int(data[0][0]))
                if not ok(*live):
                    break
            for x in data:
                if x[8] == "1":
                    out[dt.datetime.fromtimestamp(int(x[0]) / 1000, dt.timezone.utc).date().isoformat()] = (float(x[4]), float(x[7]))
            after = data[-1][0]
            time.sleep(0.12)
            if len(out) >= 760 or len(data) < 100:
                break
        if live and ok(*live) and out:
            return dict(sorted(out.items())), "OKX"
        errs.append("OKX price mismatch or stale" if live else "OKX empty")
    except Exception as e:  # noqa
        errs.append("OKX " + str(e)[:40])
    return None, "; ".join(errs)


def shift(d, n):
    return (dt.date.fromisoformat(d) - dt.timedelta(days=n)).isoformat()


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            prev = {}
    src, g, coins = ranking()
    coins.sort(key=lambda c: c["rank"])
    bys = {}
    for c in coins:
        bys.setdefault(c["sym"], c)
    btc, eth = bys["BTC"], bys["ETH"]
    for c in coins:
        c["cls"] = classify(c, btc["price"], eth["price"])
    total = g["total"]
    snap = {"t": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "source": src, "total": round(total), "btc_dominance_pct": round(g["btc_dom"], 3),
            "btc_dominance_calc_pct": round(btc["mcap"] / total * 100, 3), "eth_dominance_pct": round(eth["mcap"] / total * 100, 3),
            "total2": round(total - btc["mcap"]), "total3": round(total - btc["mcap"] - eth["mcap"]), "volume_24h": round(g["vol"])}
    gd = {r[0]: r for r in prev.get("global_daily", {}).get("points", [])}
    gd[TODAY] = [TODAY, snap["total"], snap["btc_dominance_pct"], snap["eth_dominance_pct"], snap["total2"], snap["total3"], snap["volume_24h"], src]
    global_daily = {"method": "EXACT snapshots from the ranking source, last snapshot of each UTC day; accumulated by this job",
                    "columns": ["date", "total", "btc_dom_pct", "eth_dom_pct", "total2", "total3", "volume_24h", "source"],
                    "first_date": min(gd), "days": len(gd), "points": [gd[k] for k in sorted(gd)]}

    # ---- closes for BTC, ETH and candidate coins (walk the ranking until the universe is full)
    cand = [c for c in coins if c["cls"] == "coin"]
    data, used, skipped = {}, [], []
    for c in cand:
        if len(used) >= TOTALS_N:
            break
        d, s = closes(c["sym"], c["price"])
        if d is None:
            skipped.append({"sym": c["sym"], "rank": c["rank"], "why": s})
            continue
        c["src"] = s
        data[c["sym"]] = d
        used.append(c)
        time.sleep(0.05)
    bc = {k: v[0] for k, v in data["BTC"].items()}
    dates = sorted(bc)[-KEEP_DAYS:]
    alts = [c for c in used if c["sym"] != "BTC"]
    # universe for breadth: first 50 alts (by rank) that have >= MIN_HIST closes today
    uni = [c for c in alts if len(data[c["sym"]]) >= MIN_HIST][:UNIVERSE_N]
    tiers = {"large": alts[0:9], "mid": alts[9:49], "small": alts[49:99]}

    def r(sym, d, n):
        a, b = data[sym].get(shift(d, n)), data[sym].get(d)
        return (b[0] / a[0] - 1) * 100 if a and b else None

    def hist_len(sym, d):
        f = next(iter(data[sym]))
        return (dt.date.fromisoformat(d) - dt.date.fromisoformat(f)).days + 1

    # stablecoin supply (DefiLlama)
    stab = {}
    try:
        for x in get("https://stablecoins.llama.fi/stablecoincharts/all"):
            stab[dt.datetime.fromtimestamp(int(x["date"]), dt.timezone.utc).date().isoformat()] = x["totalCirculatingUSD"]["peggedUSD"]
    except Exception as e:  # noqa
        print("DefiLlama failed", e, file=sys.stderr)
    circ = {c["sym"]: c["mcap"] / c["price"] for c in used if c["price"]}
    br, rot, tot, ethbtc = [], [], [], []
    for d in dates:
        rb = {}
        for n in (7, 30, 90):
            rB = r("BTC", d, n)
            xs = [r(c["sym"], d, n) for c in uni if hist_len(c["sym"], d) >= MIN_HIST]
            xs = [x for x in xs if x is not None]
            rb[n] = (round(sum(1 for x in xs if x > rB) / len(xs) * 100, 1) if rB is not None and len(xs) >= 30 else None, len(xs))
        br.append([d, rb[7][0], rb[30][0], rb[90][0], rb[30][1], rb[90][1]])
        rB = r("BTC", d, 30)
        row = [d, round(rB, 2) if rB is not None else None]
        for k in ("large", "mid", "small"):
            xs = [r(c["sym"], d, 30) for c in tiers[k]]
            xs = [x for x in xs if x is not None]
            row.append(round(st.median(xs) - rB, 2) if rB is not None and len(xs) >= max(5, len(tiers[k]) // 2) else None)
        rot.append(row)
        caps = {c["sym"]: data[c["sym"]][d][0] * circ[c["sym"]] for c in used if d in data[c["sym"]]}
        vols = {c["sym"]: data[c["sym"]][d][1] for c in used if d in data[c["sym"]] and c["src"] == "Binance"}
        sv = stab.get(d)
        b, e = caps.get("BTC", 0), caps.get("ETH", 0)
        tp = sum(caps.values()) + (sv or 0)
        vt = sum(vols.values())
        tot.append([d, round(tp), round(b), round(e), round(sv) if sv else None, round(tp - b), round(tp - b - e), round(tp - b - e - (sv or 0)),
                    round(b / tp * 100, 3) if tp else None, round((vt - vols.get("BTC", 0)) / vt * 100, 2) if vt else None, len(caps)])
        ea, ba = data["ETH"].get(d), data["BTC"].get(d)
        ethbtc.append([d, round(ea[0] / ba[0], 6) if ea and ba else None])
    # trim leading rows where breadth is not computable
    i0 = next((i for i, x in enumerate(br) if x[2] is not None), 0)
    last = dates[-1]
    top = [{"sym": c["sym"], "rank": c["rank"], "src": c["src"], "days": len(data[c["sym"]]),
            **{f"r{n}": (round(r(c["sym"], last, n), 2) if r(c["sym"], last, n) is not None else None) for n in (7, 30, 90)}} for c in uni]
    cov = round(tot[-1][1] / total * 100, 1) if tot else None
    out = {"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "method": "see scripts/fetch_market.py header",
           "ranking_source": src, "snapshot": snap, "global_daily": global_daily,
           "last_close_date": last,
           "stablecoins": {"source": "DefiLlama stablecoincharts/all (USD-pegged)", "columns": ["date", "usd"], "points": [[d, round(stab[d])] for d in dates if d in stab]},
           "ethbtc": {"source": "Binance spot daily closes ETHUSDT / BTCUSDT", "columns": ["date", "ethbtc"], "points": ethbtc},
           "breadth": {"universe": f"top {UNIVERSE_N} by market cap excl. BTC, stablecoins, gold tokens, wrapped/staked/bridged tokens and < {MIN_HIST} days of closes",
                       "note": "Backfilled with today's constituents (survivorship bias); each day only counts coins with >= 120 days of history at that date.",
                       "columns": ["date", "b7", "b30", "b90", "n30", "n90"], "points": br[i0:]},
           "rotation": {"tiers": "coin ranks 2-10 (large), 11-50 (mid), 51-100 (small) after exclusions; median 30d return minus BTC 30d return, % points",
                        "columns": ["date", "btc_30d_pct", "large_minus_btc", "mid_minus_btc", "small_minus_btc"], "points": rot[i0:]},
           "totals_proxy": {"method": "RECONSTRUCTED: sum(close x today's circulating supply) over covered top coins + DefiLlama stablecoin supply",
                            "coverage_pct_of_exact_total_today": cov,
                            "columns": ["date", "total", "btc", "eth", "stables", "total2", "total3", "total3_ex_stables", "btc_dom_pct", "alt_volume_share_pct", "n_assets"],
                            "points": tot[i0:]},
           "universe_now": top, "tiers_now": {k: [c["sym"] for c in v] for k, v in tiers.items()},
           "coverage": {"coins_with_closes": len(used), "skipped": skipped[:60],
                        "sources": {s: sum(1 for c in used if c["src"] == s) for s in ("Binance", "OKX")}},
           "excluded": {k: [c["sym"] for c in coins[:300] if c["cls"] == k] for k in ("stable", "pegged", "dup")}}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print("ranking", src, "snapshot", snap)
    print("closes for", len(used), "coins", out["coverage"]["sources"], "skipped", len(skipped), [s["sym"] for s in skipped[:25]])
    print("universe", len(uni), "last close", last, "breadth", br[-1], "rotation", rot[-1])
    print("totals", tot[-1], "coverage", cov)
    print("excluded", out["excluded"])


if __name__ == "__main__":
    main()
