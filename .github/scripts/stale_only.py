#!/usr/bin/env python3
"""Narrow no-rollback ruling (supervisor, 12 Nov). After a FAILED live smoke (tests/tsmoke.js run with SMOKE_OUT=<smoke_dir>):
  stale_only.py <smoke_dir> <before_dir>
exit 0 = skip the rollback: the smoke run completed, EVERY failing check is a data-age (freshness) check, and EACH stale data file is byte-identical
         to what live served before this deploy (<before_dir>, saved by `no_regress.py files`): the deploy did not make anything worse, the data just
         has not been refreshed yet.
exit 1 = roll back: any other failure, no/partial smoke summary (crash), a stale file with no pre-deploy copy, or a stale file whose bytes changed
         (for example data that went backwards). Fails closed on anything unreadable.
17 Nov ruling: an etf.json change confined to the pending row (still pending, total null; complete rows, last_date, labels identical; only
updated/checked_at/light_checked_at/fetched differ elsewhere; last_date never backwards) counts as unchanged: etf_same(). A change of ONLY updated/checked_at/light_checked_at/fetched counts as
unchanged too (run stamps, never data)."""
import copy, json, os, sys


def _pending_split(d):
    """(dataset without its pending row, pending row or None). The pending row = the NEWEST row (max date) when it is flagged pending."""
    days = [x for x in (d.get("days") or []) if isinstance(x, dict)]
    if not days: return d, None
    newest = max(days, key=lambda x: str(x.get("date", "")))
    if newest.get("pending") is not True: return d, None
    o = copy.deepcopy(d); o["days"] = [x for x in days if x is not newest]; o.pop("fetched", None); return o, newest


def etf_same(after_b, before_b):
    """Supervisor ruling (17 Nov, final): an etf.json change confined to the pending row counts as UNCHANGED only if ALL hold:
    1. with the pending row removed, every complete row (BTC and ETH), last_date and any stale/status labels equal pre-deploy live;
    2. the pending row (in the new file) still has pending: true and total: null (a pending row that was there before must still be there, same date);
    3. outside the pending row only `updated`, `checked_at`, `light_checked_at` (top level) and `fetched` (per dataset) may differ (also when there is no pending row);
    4. last_date never moves backwards (top level or per dataset).
    Returns (True, why) or (False, why). Anything unreadable -> (False, ...)."""
    try:
        A, B = json.loads(after_b), json.loads(before_b)
        da, db = A.get("datasets"), B.get("datasets")
        if not isinstance(da, dict) or not isinstance(db, dict) or set(da) != set(db): return False, "etf.json datasets differ"
    except Exception as e:
        return False, f"etf.json unreadable ({e})"
    def lt(x, y): return x is not None and y is not None and str(x) < str(y)
    if lt(A.get("last_date"), B.get("last_date")): return False, f"etf.json last_date went backwards ({B.get('last_date')} -> {A.get('last_date')})"
    TS = ("updated", "checked_at", "light_checked_at", "datasets")  # 17 Nov: run stamps checked_at (full batch) and light_checked_at (light re-fetch) may differ too
    sa, sb = {k: v for k, v in A.items() if k not in TS}, {k: v for k, v in B.items() if k not in TS}
    if sa != sb: return False, "etf.json differs outside the pending rows (top-level fields other than updated/checked_at/light_checked_at)"
    for k in sorted(da):
        a, b = da[k], db[k]
        if not isinstance(a, dict) or not isinstance(b, dict): return False, f"etf.json {k} dataset unreadable"
        if lt(a.get("last_date"), b.get("last_date")): return False, f"etf.json {k} last_date went backwards"
        ca, pa = _pending_split(a); cb, pb = _pending_split(b)
        if pa is not None and not (pa.get("pending") is True and pa.get("total") is None): return False, f"etf.json {k} pending row has a total"
        if pb is not None and (pa is None or pa.get("date") != pb.get("date")): return False, f"etf.json {k} pending row {pb.get('date')} is no longer pending"
        if pa is not None and any(str(x.get("date", "")) >= str(pa.get("date")) for x in ca.get("days") or []): return False, f"etf.json {k} pending row is not the newest"
        ca = {x: y for x, y in ca.items() if x != "fetched"}; cb = {x: y for x, y in cb.items() if x != "fetched"}
        if ca != cb: return False, f"etf.json {k} differs outside its pending row (complete rows, last_date, status or another field)"
    return True, "etf.json differs only in updated/checked_at/light_checked_at/fetched and/or inside the pending row(s) (still pending, total null)"


def decide(smoke_dir, before_dir):
    try:
        S = json.load(open(os.path.join(smoke_dir, "summary.json")))
    except Exception as e:
        return False, [f"no smoke summary ({e}): smoke did not complete"]
    fails = S.get("fails")
    if S.get("complete") is not True or not isinstance(fails, list):
        return False, ["smoke summary is incomplete"]
    if not fails:
        return False, ["smoke failed with no failing check recorded (crash or exit error)"]
    why, files, notes = [], [], []
    for f in fails:
        if not (isinstance(f, dict) and f.get("fresh") is True and f.get("file")):
            why.append(f"not a freshness check: {f.get('name') if isinstance(f, dict) else f}")
        elif f["file"] not in files:
            files.append(f["file"])
    for name in files:
        if os.path.basename(name) != name:
            why.append(f"bad file name {name}"); continue
        try:
            a = open(os.path.join(smoke_dir, "data", name), "rb").read()
        except Exception:
            why.append(f"{name}: smoke kept no copy of the stale file"); continue
        try:
            b = open(os.path.join(before_dir, name), "rb").read()
        except Exception:
            why.append(f"{name}: no copy of what live served before this deploy"); continue
        if a != b:
            same, w = etf_same(a, b) if name == "etf.json" else (False, "")
            if same: notes.append(w)
            else: why.append(f"{name}: stale AND changed by this deploy (not byte-identical to pre-deploy live{'; ' + w if w else ''})")
    if why:
        return False, why
    return True, [f"stale but unchanged since before this deploy: {', '.join(files)} ({len(fails)} freshness check(s))"] + notes

if __name__ == "__main__":
    ok, why = decide(sys.argv[1], sys.argv[2])
    for w in why:
        print(("NO ROLLBACK: " if ok else "ROLLBACK: ") + w)
    if ok:
        print("::warning title=Live smoke: stale data only, no rollback::" + "; ".join(why) + ". The deploy did not change the stale file(s); the data refresh is late.")
    sys.exit(0 if ok else 1)
