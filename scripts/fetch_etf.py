#!/usr/bin/env python3
"""Refresh data/etf.json: daily US spot BTC / ETH ETF net flows (US$m) from Farside.
stdlib only. If Farside blocks or the layout changes, keep previous data for that
asset and record status ('blocked' / 'error')."""
import datetime as dt, html, json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "etf.json")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
NOW = dt.datetime.now(dt.timezone.utc)
# full-history pages first, then the short (recent ~2 weeks) pages as fallback
URLS = {"btc": ["https://farside.co.uk/bitcoin-etf-flow-all-data/", "https://farside.co.uk/btc/"],
        "eth": ["https://farside.co.uk/ethereum-etf-flow-all-data/", "https://farside.co.uk/eth/"]}



def write_json(path, obj):
    """Atomic write; refuses NaN/Infinity so a bad value can never corrupt the file."""
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(s)
    os.replace(tmp, path)

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "ignore")


def cell(c):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).replace("\xa0", " ").strip()


def num(s):
    s = s.replace(",", "").strip()
    if s in ("", "-"):
        return None
    neg = s.startswith("(") and s.endswith(")")
    v = float(s.strip("()"))
    return -v if neg else v


def parse(page):
    m = re.search(r'<table[^>]*class="etf"[^>]*>(.*?)</table>', page, re.S)
    if not m:
        raise ValueError("ETF table not found (blocked or layout change)")
    rows = [[cell(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
            for r in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S)]
    funds = None
    for r in rows:
        if (len(r) > 3 and r[0] in ("", "Date") and sum(1 for x in r[1:-1] if x) >= 3
                and all(re.fullmatch(r"[A-Z]{2,6}", x) for x in r[1:-1] if x)):
            funds = r[1:-1]
            break
    if not funds:
        raise ValueError("fund header row not found")
    days = []
    for r in rows:
        try:
            d = dt.datetime.strptime(r[0], "%d %b %Y").date().isoformat()
        except (ValueError, IndexError):
            continue
        vals = r[1:1 + len(funds)]
        flows = {f: num(v) for f, v in zip(funds, vals)}
        days.append({"date": d, "total": num(r[len(funds) + 1]),
                     "no_data": all(v == "-" for v in vals), "partial": any(v in ("-", "") for v in vals), "funds": flows})
    if not days:
        raise ValueError("no daily rows parsed")
    # Farside shows the current day with '-' in every fund until data arrives:
    # only the most recent row can be 'pending'; older all-'-' rows are
    # market holidays / no-report days (kept with their listed total).
    # The most recent row stays pending (total None, never 0) while any fund is still '-',
    # i.e. until Farside has filled it in; it is only final once every fund has a value
    # or a later day's row exists.
    for i, d in enumerate(days):
        nd, part = d.pop("no_data"), d.pop("partial")
        d["pending"] = bool(i == len(days) - 1 and (nd or part or d["total"] is None))
        if d["pending"]:
            d["total"] = None
    return funds, days


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            prev = {}
    out = {"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "units": "US$m (net daily flow)",
           "source": "Farside Investors (farside.co.uk)", "datasets": {}}
    for k, urls in URLS.items():
        p = prev.get("datasets", {}).get(k)
        errs, got = [], None
        for url in urls:
            try:
                funds, days = parse(fetch(url))
                got = (url, funds, days); break
            except urllib.error.HTTPError as e:
                errs.append(("blocked" if e.code in (403, 429, 503) else "error", f"{url}: HTTP {e.code}"))
            except Exception as e:
                errs.append(("error", f"{url}: {str(e)[:150]}"))
        if got:
            url, funds, days = got
            merged = {d["date"]: d for d in (p or {}).get("days", [])}
            merged.update({d["date"]: d for d in days})
            days = [merged[x] for x in sorted(merged)]
            allf = list(funds) + [f for f in (p or {}).get("funds", []) if f not in funds]
            done = [d for d in days if not d["pending"]]
            out["datasets"][k] = {"status": "ok", "url": url, "fetched": out["updated"],
                                  "funds": allf, "last_date": done[-1]["date"] if done else None,
                                  "days": days}
        else:
            status = "blocked" if any(s == "blocked" for s, _ in errs) else "error"
            out["datasets"][k] = dict(p or {"funds": [], "days": [], "last_date": None},
                                      status=status, error="; ".join(m for _, m in errs)[:300])
        d = out["datasets"][k]
        print(f"{k}: status={d['status']} last_date={d.get('last_date')} rows={len(d.get('days', []))} "
              f"{d.get('error', '')}", file=sys.stderr)
    out["last_date"] = max([d.get("last_date") or "" for d in out["datasets"].values()]) or None
    # skip rewrite if nothing but timestamps changed
    def strip(o):
        o = json.loads(json.dumps(o)); o.pop("updated", None)
        for d in o.get("datasets", {}).values():
            d.pop("fetched", None)
        return o
    if prev and strip(prev) == strip(out):
        print("etf.json: no data change"); return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    write_json(OUT, out)
    print("etf.json written")


if __name__ == "__main__":
    main()
