# RP Terminal refresh timer (Cloudflare Worker)

GitHub drops many of `data.yml`'s scheduled runs. This Worker is an outside timer that starts **Refresh data** only when there is something new to fetch. GitHub's own crons (:17, :47, 00:20 UTC, Thu 21:00) stay on as the backup.

The code is plain JavaScript with no npm dependencies. `tests/tworker.js` tests it with a mocked fetch and no network; it runs in `tests/run-all.sh` and in CI.

## What one tick does (cron `7 * * * *`, hourly at :07 UTC)

1. It reads the live `data/derivs.json`, `data/_runs.json`, `data/macro.json` and `data/etf.json`, each with `?v=<now>` so no cache is involved.
2. It decides whether a refresh has anything to fetch:
   - **Derivatives are 3h old or more.** It takes every asset's `latest.oi_t` and `latest.basis_t` (the fields `runs_log.py` and `data_age.py` use) and looks at the oldest one. An OKX hour is stored once it is 2h settled, so at 3h a new settled hour is out.
   - **The daily batch is due.** It uses the same rule as `refresh_slot.py batch_due()`, which `data.yml` uses for its own catch-up. The batch is due when the older of `macro.json` `checked_at` and `etf.json` `checked_at`/`updated` is before the most recent 00:20 UTC slot. If either is unreadable, the batch counts as due.
   - If neither is true, it does nothing on GitHub at all, not even an API read.
3. When there is something to fetch, it asks the GitHub API about `data.yml`:
   - It skips if any run is `queued`, `in_progress`, `waiting`, `requested` or `pending`.
   - It skips if a `workflow_dispatch` run was created in the last 55 minutes. Together with the hourly tick, this is the one-dispatch-an-hour cap, and it also counts dispatches that someone or something else started.
   - Otherwise it sends **one** `workflow_dispatch` on `main` with `inputs.full = "true"` when the batch is due and `"false"` otherwise. There are no retries.
4. Heartbeat (optional `HEARTBEAT_URL`, for healthchecks.io):
   - On a clean tick it pings `<url>`.
   - It pings `<url>/fail` with the reasons when any feed is past its shared limit. These are the same checks as `data_age.py` and the stale alarm: each feed's `lim_h` from `_runs.json` (OI and basis 5h, funding 12h), market `limit_h` (3h), any macro series with `ok: false`, the macro fetch older than 26h, and `last_run` older than 90 minutes.
   - It also pings `/fail` when the timer itself is broken: a live file is unreadable, the GitHub API refuses (for example an expired token), the dispatch is refused, or `GH_TOKEN` is missing.
   - If the Worker stops ticking at all, healthchecks.io alerts on the silence.

Limits that are not written into `_runs.json` live in `src/limits.js`. `tests/tworker.js` fails if they drift from `data_age.py` or `refresh_slot.py`, and it checks the JavaScript stale check and batch rule against the Python versions on the same inputs.

Secrets come from the environment only (`GH_TOKEN`, `HEARTBEAT_URL`). They are never logged, never put in the heartbeat body, and the token is only sent to `api.github.com`. The Worker has no public URL (`workers_dev = false`, and its HTTP handler returns 404), so nobody can trigger it from outside.

## Setup (RP, about 15 minutes; never paste keys in the room)

1. **Cloudflare account:** sign up for the free plan at dash.cloudflare.com. Cron Triggers are included.
2. **GitHub fine-grained token:** go to github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Resource owner: **AtenRa-Tech**. Repository access: **Only select repositories → rp-terminal**.
   - Repository permissions: **Actions: Read and write**. Metadata: Read-only is added automatically. Nothing else.
   - Expiration: **90 days**. Set a reminder, because when it expires the heartbeat goes to `/fail` with "HTTP 401".
   - If the org requires approval for fine-grained tokens, approve it under AtenRa-Tech → Settings → Personal access tokens → Pending requests.
   - The supervisor's plan prefers creating the token on a separate bot account that has access to the repo.
3. **Heartbeat (optional but recommended):** at healthchecks.io create a check with period **1 hour** and grace **20 minutes**, and copy its ping URL (`https://hc-ping.com/<uuid>`). Add an email or other notification to the check.
4. **Deploy** from a computer with Node 20+:
   ```
   cd worker
   npx wrangler login                     # opens Cloudflare in the browser
   npx wrangler secret put GH_TOKEN       # paste the token when asked (it is not echoed)
   npx wrangler secret put HEARTBEAT_URL  # paste the healthchecks ping URL
   npx wrangler deploy
   ```
   You can set the secrets the same way in the Cloudflare dashboard instead: Workers & Pages → rpt-refresh-timer → Settings → Variables and Secrets → type **Secret**.
5. **Check it:** run `npx wrangler tail`, or open the dashboard → the Worker → Logs. The next :07 tick prints one JSON line with `reason`, `dispatched`, `skip` and `problems`, and no secrets.

To stop the timer, delete the Worker or remove the cron trigger in the dashboard. GitHub's crons keep running either way.
