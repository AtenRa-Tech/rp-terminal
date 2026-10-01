# RP Terminal

Single-file web app (crypto charts and signals), hosted on GitHub Pages:
https://atenra-tech.github.io/rp-terminal/

## Data files (refreshed by `.github/workflows/data.yml`)

| File | Refresh | Contents |
| --- | --- | --- |
| `data/macro.json` | every 6h | FRED series, euro area / Japan / China M2 from ECB / BOJ / PBoC, computed global M2 in USD |
| `data/etf.json` | every 6h | US spot BTC & ETH ETF daily net flows (US$m) from Farside |
| `data/india.json` | hourly | CoinDCX BTCINR/USDTINR, Coinbase BTC-USD, USD/INR, premiums, 30-day hourly history |
| `data/calendar.json` | static | FOMC / CPI / jobs dates in UTC with sources and verification status |

Every file has a top-level `updated` (ISO UTC) plus `last_date` per dataset so the app can flag stale data.

Fetch from the Pages origin: `./data/macro.json` (same-origin).
Local-file fallback (CORS `*`): `https://raw.githubusercontent.com/AtenRa-Tech/rp-terminal/main/data/macro.json`.
The app sets `window.RP_DATA_BASE` to pick between the two automatically.
