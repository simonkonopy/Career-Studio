# Career Studio operations

## Scope and launch status

This package is an API-backed pilot foundation. Customer subscription linking is not the launch architecture. The operator supplies AI access and must measure usage before deciding prices. Payment processing and subscription enforcement have not been implemented.

Start with [HANDOFF.md](../HANDOFF.md). Use [Security instructions](SECURITY.md) for the threat model, required hardening and release evidence, and [SaaS business and release plan](SAAS_BUSINESS_PLAN.md) for API setup, billing and customer delivery. The separate [customer-subscription specification](CUSTOMER_SUBSCRIPTION_DELIVERY.md) is future implementation work; these deployment commands do not install a ChatGPT plugin or companion.

Use a single application process and a local persistent SQLite volume. Do not run multiple replicas against this file, place it on an unreliable network filesystem, or deploy it on a host that discards its writable disk. Process concurrency limits and authentication throttles are not coordinated across replicas. Before scaling, design a shared database, distributed quotas and throttles, and a migration and recovery strategy.

## Configuration

The server reads environment variables. `npm start` also reads `.env` for local development; Docker receives its environment at runtime. Production requires `NODE_ENV=production`, an `https://` `APP_ORIGIN` without a path, a `PILOT_INVITE_CODE` at least 16 characters long, and an explicit trusted-proxy IP allowlist.

| Setting | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public origin, such as `https://careers.example.com`; controls host and request-origin validation. |
| `HOST`, `PORT` | Container uses `0.0.0.0` and `4174`; a direct local process defaults to loopback. |
| `TRUSTED_PROXY_IPS` | Comma-separated exact IP addresses of proxy peers that connect to the app. Determine these from the actual deployment network. |
| `DATA_DIR` | Private durable directory. Relative values resolve from this package; Docker defaults to `/app/data`. |
| `OPENAI_API_KEY` | Operator secret, supplied only to the server. |
| `OPENAI_MODEL` | API model; validate access and structured output behavior with the configured project. |
| `AI_DAILY_LIMIT` | Per-account daily attempt limit; default 40. |
| `AI_GLOBAL_DAILY_LIMIT` | Whole-service daily attempt ceiling; default 400. |
| `AI_CONCURRENCY` | Whole-process simultaneous AI requests; default 3, at most 20. |
| `PILOT_INVITE_CODE` | Privately distributed random pilot invitation code. Changing it restricts new registrations, not existing accounts. |
| `BACKUP_PATH` | Optional destination for the backup command; it must be a new filename each run. |

These are request-count controls, not a guaranteed dollar ceiling. Prompt length and model pricing affect spend; use a dedicated provider project, monitor provider usage and billing, and choose conservative allowances. Failed attempts may incur usage and still consume allowance. Daily counters reset at midnight UTC. Keep the private API key and invitation code in the host's secret configuration, outside repository and container layers.

## Single-server Docker deployment

Run from the product repository root. Create a private `deploy.env` outside the repository with the real domain, key, chosen model, and a random invitation code. The example domain below is a placeholder.

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4174
APP_ORIGIN=https://careers.example.com
TRUSTED_PROXY_IPS=replace-with-actual-proxy-peer-ip
DATA_DIR=/app/data
OPENAI_API_KEY=replace-in-private-secret-store
OPENAI_MODEL=replace-with-verified-model
PILOT_INVITE_CODE=replace-with-long-random-code
AI_DAILY_LIMIT=40
AI_GLOBAL_DAILY_LIMIT=400
AI_CONCURRENCY=3
```

```sh
docker build --tag career-studio:pilot .
docker volume create career-studio-data
docker run --detach --name career-studio --restart unless-stopped \
  --env-file /private/path/deploy.env \
  --publish 127.0.0.1:4174:4174 \
  --mount source=career-studio-data,target=/app/data \
  --memory=1g --cpus=1 \
  career-studio:pilot
```

Start with those resource limits and measure memory under concurrent upload, AI, and export activity; they are not a capacity claim. The container runs as UID/GID 1000. A new named volume inherits the image's data-directory ownership. An existing or bind-mounted directory must already be writable by that user and inaccessible to unrelated accounts. Encrypt storage using the hosting platform; file permissions do not encrypt the database.

Place an HTTPS reverse proxy on the same host in front of port 4174. Preserve the original `Host` header exactly as configured in `APP_ORIGIN` and preserve the browser's `Origin` header; otherwise requests are deliberately rejected. Set a 12 MB request-body cap and a 120-second upstream timeout. Restrict direct access to the app port. Handle HTTP-to-HTTPS redirects and certificate renewal at the proxy.

Configure the proxy to **overwrite** `X-Forwarded-For` with exactly one actual client IP, discarding any client-supplied value. The application uses that header only when the connecting peer appears in `TRUSTED_PROXY_IPS`. Determine the peer address from the actual Docker bridge or proxy-service network; do not assume it is loopback or copy an arbitrary bridge IP. This preserves per-client throttling without allowing internet callers to choose their apparent IP. Validate two separate clients and an attempted forwarded-header spoof before opening access, and add edge throttling as appropriate.

`GET /health` returns basic process health. The Docker health check supplies the configured host. This endpoint does not certify AI, job-provider availability, or backup health. Monitor response failures, disk capacity, restart count, quota exhaustion, backup age, and provider costs without recording request bodies, resumes, passwords, cookies, or API keys.

## Backup and restoration

Create backups with the supplied command, including while the application is running:

```sh
npm run backup -- --output /private/backups/career-2026-09-08.sqlite
```

The command uses [Node's SQLite online backup API](https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options), then checks database integrity. It reads `.env` without replacing existing environment settings and supports `--source FILE`. Relative paths resolve from the package directory. It refuses existing destinations and public asset paths, creates a private staging file, and publishes a complete snapshot with restrictive permissions. No database contents or secret values are printed. It does not encrypt, transfer, schedule, or prune backups.

In Docker, execute the same script in the running container and copy the completed file into controlled backup storage:

```sh
docker exec career-studio node scripts/backup.js --output /app/backups/career-2026-09-08.sqlite
docker cp career-studio:/app/backups/career-2026-09-08.sqlite /private/backups/career-2026-09-08.sqlite
```

The container's `/app/backups` directory is ephemeral unless separately mounted. Copy promptly, restrict the host copy to mode `0600`, encrypt it, and transfer it off-host. A backup on the application's only disk does not protect against host failure. Do not copy only the live `career.sqlite` file while writes continue; committed content may still be in its WAL sidecar.

Before a pilot, choose recovery targets and automate backup scheduling. A reasonable pilot starting policy is a daily encrypted off-host snapshot, a pre-release snapshot, and 14-day backup retention, subject to the published privacy policy and actual recovery needs. Test restoration before launch and after storage/schema changes.

Restore procedure:

1. Stop the application and keep traffic in maintenance mode. Preserve the current database directory and all sidecars as a separate recovery set.
2. Verify the backup's integrity in an isolated environment using SQLite `PRAGMA quick_check`; confirm it matches the application/schema version being restored. This release uses schema version 2 and upgrades version 1 when opening it; preserve a pre-upgrade snapshot before any schema migration and do not point an older server at a newer database.
3. Restore the snapshot as `career.sqlite` into a fresh private directory or volume. Do not mix it with old `-wal` or `-shm` files. Restore ownership to the application user and file mode `0600`.
4. Before serving traffic, use an administrative database connection to delete all `sessions` rows. Backups contain session hashes and account recovery hashes; restoration must not revive previous active sessions. Reconcile account deletions that occurred after the snapshot before access is reopened.
5. Start one instance with the restored volume. Verify health, sign-in, two-account isolation, saved profiles and resume downloads. Confirm quotas may reflect the snapshot rather than subsequent usage; keep conservative provider limits in place.
6. Reopen traffic after verification. Record the restore time and any lost data interval without copying customer content into logs.

## Accounts, privacy, and retention

Registration uses an email string as an account identifier; email ownership is not verified. A recovery code is displayed once during registration and replaced after successful recovery, which also revokes existing sessions. Users must keep the latest code privately. There is no email reset flow. Losing both password and recovery code has no self-service resolution; support must never issue a bypass solely on an unverified email claim.

Customer deletion removes that account's rows from the live database. It does not remove snapshots, provider records, or recoverable remnants immediately from SQLite pages, WAL files, or storage media. Define retention and secure disposal across database storage, logs, backups, and vendors. Keep a separate access-controlled deletion record so restores do not resurrect deleted accounts; do not store deleted resume content in that record. Do not promise immediate erasure from every backup when the process has not implemented it.

Uploads are parsed on the server. Confirmed profiles, imported text, interviews, and approved resume versions persist in the database. With explicit consent, selected career data and conversation context are sent to OpenAI for AI work. Contact redaction is best-effort, and job histories can still identify someone. Review the provider's current retention settings and terms for the configured project, publish an accurate privacy notice, and explain the customer's export and deletion options before collecting real resumes.

## Job sources and launch acceptance

Remotive's public remote-job feed has attribution, source-link, delay, and access conditions. Current code keeps the listings and their API publicly available and displays the 24-hour delay. Do not place that public feed behind registration, email collection, or a payment wall. Review the [source's usage conditions](https://github.com/remotive-com/remote-jobs-api) before launch and arrange licensed broader coverage before offering a paid comprehensive job search. User-pasted postings remain unverified; neither a source link nor AI relevance proves an active opening or a customer's eligibility.

Before inviting a small pilot, verify the hosted HTTPS configuration, real API behavior and costs, public job access, two-account ownership boundaries, recovery and consent revocation, restart persistence, export/deletion, and backup restoration. Complete customer-facing privacy/support information and an incident contact. Before accepting payments, additionally settle job-data rights, billing/taxes/refunds/cancellation, retention commitments, service monitoring, security review, and a measured cost model. This repository includes neither a payment system nor a completed production operations service.
