// Limits the worker needs that are NOT already written into live data/_runs.json.
// Per-feed limits (OI/basis 5h, funding 12h) and the market limit (3h) are read from _runs.json itself (feeds[*].lim_h, market.limit_h),
// which scripts/runs_log.py writes from shared/freshness.json, so the worker, the app, smoke and data_age.py share one source.
// tests/tworker.js fails if any value below drifts from the Python it mirrors.
export const DISPATCH_DERIVS_H = 3;        // supervisor ruling 15 Nov: dispatch when the newest OI/basis hour is >= 3h old (a new settled OKX hour is out)
export const LAST_RUN_MAX_MIN = 90;        // = .github/scripts/data_age.py LAST_RUN_MAX_MIN
export const MACRO_FETCH_LIMIT_H = 26;     // = .github/scripts/data_age.py MACRO_FETCH_LIMIT_H
export const BATCH_UTC = [0, 20];          // = .github/scripts/refresh_slot.py BATCH_UTC (data.yml '20 0 * * *')
export const ONE_PER_HOUR_MIN = 55;        // no dispatch if a workflow_dispatch run of data.yml was created in the last 55 minutes
export const ACTIVE = ["queued", "in_progress", "waiting", "requested", "pending"]; // GitHub run statuses that mean "a run is already coming"
export const BATCH_MAX_FAILED = 3;         // supervisor back-off: after 3 failed daily-batch attempts in one UTC day ...
export const BATCH_RETRY_H = 6;            // ... only one more full=true try every 6h
export const FULL_TITLE = "Refresh data (full)"; // = data.yml run-name for a dispatch with full=true
