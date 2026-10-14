"""tbreadth.py: fetch_market.py breadth is rebuilt for the WHOLE history on every run with the CURRENT coin list (steering 8 Oct).
Synthetic closes: BTC + 40 current coins + 6 coins from an older top-50 list that are still in `data` (as if cached). Every breadth row must
count only current-list coins, every date must get a row, and main() must not reuse a previous market.json breadth. stdlib only."""
import datetime as dt, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("fm", os.path.join(HERE, "..", "scripts", "fetch_market.py"))
fm = importlib.util.module_from_spec(spec); spec.loader.exec_module(fm)
fails = []


def ok(c, name, x=None):
    print(("PASS " if c else "FAIL ") + name + ("" if c or x is None else " :: " + json.dumps(x)[:600]))
    if not c:
        fails.append(name)


d0 = dt.date(2025, 1, 1)
days = [(d0 + dt.timedelta(days=i)).isoformat() for i in range(400)]
data = {"BTC": {d: (100 * (1.001 ** i), 1) for i, d in enumerate(days)}}
cur = ["C%02d" % k for k in range(40)]
old = ["OLD%d" % k for k in range(6)]
for k, s in enumerate(cur):
    start = 0 if k < 35 else 250  # 5 current coins are too young for the first rows (MIN_HIST eligibility per date)
    data[s] = {d: (10 * ((1 + (k - 20) / 20000) ** i), 1) for i, d in enumerate(days) if i >= start}
for k, s in enumerate(old):
    data[s] = {d: (5 * (1.01 ** i), 1) for i, d in enumerate(days)}  # strong movers: would change every row if they leaked in

rows, mem = fm.build_breadth(days, data, cur)
ok(len(rows) == len(days) and [r[0] for r in rows] == days, "breadth: one row for EVERY date (whole history rebuilt)", [len(rows), len(days)])
leak = sorted({s for m in mem for s in m if s not in cur})
ok(not leak, "breadth: every row counts only coins on the current list (no coin from an older list)", leak)
want = []
for d in days:
    elig = [s for s in cur if fm.hist_len(data, s, d) >= fm.MIN_HIST and fm.ret(data, s, d, 30) is not None]
    want.append(elig)
ok(mem == want, "breadth: each row's coins = the current list's coins eligible on that date (>= %d days of closes)" % fm.MIN_HIST)
rows2, _ = fm.build_breadth(days, data, cur + old[:2])
ok(any(a[2] != b[2] for a, b in zip(rows, rows2) if a[2] is not None), "breadth: changing the current list changes past rows too (history follows the list)")
# main(): breadth comes only from build_breadth over all dates; nothing read back from the previous file
src = open(os.path.join(HERE, "..", "scripts", "fetch_market.py"), encoding="utf-8").read()
main_src = src[src.index("def main():"):]
ok(re.search(r"br, _members = build_breadth\(dates, data, uni_syms\)", main_src) is not None and 'prev.get("breadth"' not in src and "prev[\"breadth\"]" not in src,
   "fetch_market.py main(): breadth = build_breadth(all dates, current universe); previous market.json breadth never reused")
ok('"universe_syms": uni_syms' in main_src, "market.json breadth records the current list it was built from (universe_syms)")
print("\nFAILS:", len(fails), json.dumps(fails))
sys.exit(1 if fails else 0)
