"""ONE NYSE trading-day calendar, Python twin of shared/nyse.js (15 Nov ruling). tests/tnyse.py asserts both give identical holiday
lists for 2024-2030 and identical trading-day counts. NYSE holidays only, never the bond-market list (runs_log.us_hol closes Columbus
and Veterans Day, when NYSE and ETFs trade). Saturday holiday -> Friday before closed, except New Year's Day (1 Jan on a Saturday:
Fri 31 Dec stays open); Sunday holiday -> Monday after closed. All dates UTC. Used by scripts/runs_log.py (_runs.json etf) and
.github/scripts/data_age.py (the stale alarm)."""
import datetime as _dt
from functools import lru_cache
D, ONE = _dt.date, _dt.timedelta(1)


def easter(y):
    a, b, c = y % 19, y // 100, y % 100; d, e = b // 4, b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i, k = c // 4, c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7; m = (a + 11 * h + 22 * l) // 451
    return D(y, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1)


@lru_cache(maxsize=None)
def holidays(y):
    def obs(m, d, new_year=False):
        t = D(y, m, d); w = t.weekday()  # Monday=0
        return t + ONE if w == 6 else (None if new_year else t - ONE) if w == 5 else t
    def nth(m, wd, n):
        t = D(y, m, 1); return t + _dt.timedelta((wd - t.weekday()) % 7 + 7 * (n - 1))
    def last(m, wd):
        t = (D(y, m + 1, 1) if m < 12 else D(y + 1, 1, 1)) - ONE; return t - _dt.timedelta((t.weekday() - wd) % 7)
    h = [obs(1, 1, True), nth(1, 0, 3), nth(2, 0, 3), easter(y) - 2 * ONE, last(5, 0), obs(6, 19) if y >= 2022 else None,
         obs(7, 4), nth(9, 0, 1), nth(11, 3, 4), obs(12, 25)]
    return frozenset(x for x in h if x)


def is_open(x):
    x = D.fromisoformat(str(x)[:10]) if not isinstance(x, D) else x
    return x.weekday() < 5 and x not in holidays(x.year)


def biz_days(last_ymd, now_ms):
    """NYSE trading days after last_ymd, up to and including the UTC date of now_ms (Fri -> Mon = 1); same as NYSE.bizDays."""
    x = D.fromisoformat(str(last_ymd)[:10]); e = _dt.datetime.fromtimestamp(now_ms / 1000, _dt.timezone.utc).date(); n = 0
    while x < e:
        x += ONE
        if is_open(x): n += 1
    return n
