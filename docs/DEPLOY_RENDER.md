# Deploying the backend to Render

The repository ships a Render Blueprint (`render.yaml`) that creates two resources:

| Resource | Type | Purpose |
| --- | --- | --- |
| `hms-postgres` | Render Postgres | Application database |
| `hms-api` | Python web service | The Flask REST API served by Gunicorn |

Supporting files, all under `backend/`:

| File | Role |
| --- | --- |
| `render_start.sh` | Start command: applies migrations, then execs Gunicorn |
| `gunicorn.conf.py` | Worker/timeout/logging configuration, all env-overridable |
| `.python-version` | Pins the Python minor version (`3.14`) |

`.python-version` exists at the repository root as well. Render's documentation
places the file at the repo root, while the build itself runs inside `rootDir`;
keeping a copy in both places makes the pin hold either way. The patch version
is intentionally omitted so Render tracks the latest 3.14.x. To pin an exact
patch instead, set `PYTHON_VERSION=3.14.3` — that takes precedence and must be
fully qualified.
| `wsgi.py` | WSGI entry point (`wsgi:app`) |

---

## 1. Deploy

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In the Render Dashboard choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml` and shows the resources it will create. It then
   prompts for the variables marked `sync: false` — see the next section.
4. Click **Apply**. The first deploy takes a few minutes: it installs
   dependencies, runs `flask db upgrade` to create all 26 tables, runs
   `flask post-deploy`, then starts Gunicorn.

The service URL is `https://<service-name>.onrender.com`.

### Values Render prompts for

| Variable | Required | Example / notes |
| --- | --- | --- |
| `CORS_ORIGINS` | **Yes** | `https://hms-web.onrender.com` — comma-separated browser origins. The API refuses to start if this is empty. |
| `FRONTEND_BASE_URL` | **Yes** | `https://hms-web.onrender.com` — used to build password-reset links. |
| `BOOTSTRAP_ADMIN_EMAIL` | Recommended | `admin@yourhostel.com` — the first administrator. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Recommended | Min 8 characters with upper, lower, and digit. Change it after signing in. |
| `MAIL_SERVER`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` | No | Leave blank unless you also set `MAIL_ENABLED=true`. |

`SECRET_KEY` and `JWT_SECRET_KEY` use `generateValue: true`: Render mints a
random 256-bit value on the first sync and keeps it stable across deploys. Do
not replace them with literals — the app rejects any secret shorter than 32
characters or matching a known development placeholder.

`DATABASE_URL` is wired automatically from `hms-postgres`. Render hands out a
`postgresql://` URL; `normalize_database_url()` in `app/config.py` rewrites it
to `postgresql+psycopg://` for the psycopg 3 driver.

---

## 2. The first administrator

Only an administrator can create another administrator, and a fresh database
has none. `flask post-deploy` closes that gap:

- creates the default progress categories, then
- runs `bootstrap-admin`, which creates one super administrator from
  `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

It is idempotent: once any administrator exists it logs
`An administrator already exists - skipped.` and does nothing. Safe to run on
every deploy. If you leave the variables unset, it logs that it skipped, and
you will need a shell (paid plans) to run `flask create-admin` instead.

---

## 3. Verify the deploy

```bash
curl https://<service>.onrender.com/api/healthz
```

```json
{
  "success": true,
  "message": "Hostel Management System API",
  "data": { "status": "ok", "database": "up", "environment": "production" }
}
```

Then confirm the bootstrap account works:

```bash
curl -X POST https://<service>.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@yourhostel.com","password":"<your password>"}'
```

The field is `identifier`, not `email` — it also accepts a username or phone
number. A success response carries `data.access_token` and
`data.refresh_token`.

Two things to know about the probe:

- The path is **`/api/healthz`** (aliased at `/api/status`), *not*
  `/api/health` — that one serves student health records.
- It returns HTTP 200 even when the database is unreachable, with
  `data.status: "degraded"`. That is deliberate: a transient database outage
  should not make Render restart or roll back an otherwise healthy container.
  Alert on the `status` field, not the HTTP code.

The endpoint is also exempt from rate limiting. Without that exemption the
platform's health checker — one address polling every few seconds — would burn
through `RATELIMIT_DEFAULT` and get the service marked unhealthy.

---

## 4. Connecting the frontend

The React app is a static build; it is not covered by this blueprint. Deploy it
as a Render Static Site (or Netlify/Vercel/S3) with:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Rewrite rule | `/*` → `/index.html` (needed for client-side routing) |

Build-time environment variables:

```
VITE_API_BASE_URL=https://<service>.onrender.com/api
VITE_MEDIA_BASE_URL=https://<service>.onrender.com/api/media
```

These are read at build time, not runtime, so changing them requires a rebuild.
Omit them only when the frontend is served from the same origin as the API
(the defaults are `/api` and `/api/media`).

Finally, add the static site's URL to the API's `CORS_ORIGINS` and
`FRONTEND_BASE_URL`. Mismatched origins show up as CORS errors in the browser
console with no server-side error.

---

## 5. Free plan limits that will affect you

Verified against Render's documentation
([free plan](https://render.com/free),
[Postgres plans](https://render.com/docs/postgresql-refresh)) — summarised here,
content rephrased for compliance with licensing restrictions:

- **Web services spin down after 15 minutes without traffic.** The next request
  wakes the container and takes tens of seconds. Logging in after an idle period
  will look like a hang.
- **Free Postgres instances expire 30 days after creation** and have 1 GB of
  storage. Expect to move to a paid plan before then, or to lose the data.
- **The filesystem is ephemeral.** See the next section.
- **No shell and no pre-deploy command.** This is why migrations run inside the
  start command.

## 6. Uploaded files are not durable by default

Profile photos, meal photos, and activity media are written to the container
filesystem, which is discarded on every deploy and restart. The app logs a
warning about this at boot in production. Three ways to handle it:

1. **Accept it.** Fine for a demo; records keep working, images 404 after a
   redeploy.
2. **Attach a persistent disk** (paid plans only). Uncomment the `disk:` block
   and the `UPLOAD_FOLDER` / `UPLOADS_ARE_PERSISTENT` variables in
   `render.yaml`. A disk pins the service to a single instance, so it rules out
   horizontal scaling.
3. **Use object storage.** Serve media from a bucket/CDN and set
   `PUBLIC_MEDIA_BASE_URL`. This needs an S3/GCS implementation of the
   `StorageBackend` interface in `app/utils/storage.py`.

Setting `UPLOADS_ARE_PERSISTENT=true` only silences the warning. It does not
make storage durable.

## 7. Rate limits across workers

The default `memory://` store counts per worker process, so with
`WEB_CONCURRENCY=2` the effective limit is twice what you configured. The app
logs a warning when it detects this in production.

To share one counter, uncomment the `hms-keyvalue` service and the `REDIS_URL`
variable in `render.yaml`. `app/config.py` picks up `REDIS_URL` (or
`REDIS_PRIVATE_URL`) automatically; `RATELIMIT_STORAGE_URI` overrides it when
set explicitly. The `redis` package is already in `requirements.txt`.

---

## 8. Migrations

`render_start.sh` runs `flask db upgrade && flask post-deploy` before starting
Gunicorn. Both are safe to repeat.

Keep the service at a single instance while this is enabled: two containers
running `alembic upgrade` simultaneously can collide. On a paid plan, move
migrations to Render's pre-deploy command and set
`RUN_MIGRATIONS_ON_START=false`:

```yaml
preDeployCommand: flask db upgrade && flask post-deploy
```

That runs once per deploy, before the new version takes traffic, which is the
correct place for it. It requires a paid instance type.

---

## 9. Tuning Gunicorn

Everything in `gunicorn.conf.py` is overridable with environment variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `WEB_CONCURRENCY` | 2 on Render, else 2–4 by CPU count | Worker processes |
| `GUNICORN_THREADS` | `4` | Threads per worker; this API is I/O bound |
| `GUNICORN_TIMEOUT` | `60` | Raise if large PDF/CSV exports time out |
| `GUNICORN_MAX_REQUESTS` | `1000` | Recycles workers to cap slow leaks |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `5` / `5` | **Per worker** |

Total database connections are
`WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW)` — 20 at the defaults.
Keep that under your Postgres plan's connection cap when you scale up.

`preload_app` is deliberately `False`: forking after `create_app()` would share
one SQLAlchemy engine and its sockets across workers, which corrupts connection
state.

---

## 10. Checking configuration

The app validates its own production configuration at startup and raises rather
than serving traffic with an unsafe setup. To see the same report without
starting a server:

```bash
cd backend && flask check-config
```

```
Environment: production
Database:    postgresql+psycopg://hms:***@dpg-xxxx/hostel_db
Rate limits: memory://
Uploads:     /opt/render/project/src/uploads
CORS:        https://hms-web.onrender.com

No production configuration problems found.
```

It exits non-zero when something would block a production start.

---

## 11. Troubleshooting

| Symptom | Cause |
| --- | --- |
| Deploy fails with `Refusing to start: the production configuration is incomplete` | Read the bullet list in the log. Usually `CORS_ORIGINS` is empty or `DATABASE_URL` is missing. |
| `DATABASE_URL is not set, so the app would fall back to SQLite` | The `fromDatabase` reference did not resolve. Check that the database name in `render.yaml` matches the created instance. |
| Health check fails, logs show the app started | `healthCheckPath` must be `/api/healthz`. `/api/health` requires authentication and returns 401. |
| First request after idle takes ~30 s | Free plan spin-down. Expected. |
| Login works, then every request returns 401 | Access tokens expire after `JWT_ACCESS_TOKEN_MINUTES` (60). The frontend refreshes automatically; a stale build may not. |
| Browser shows CORS errors | The exact frontend origin, including scheme, must be in `CORS_ORIGINS`. |
| Uploaded images 404 after a deploy | Ephemeral filesystem. See section 6. |
| `429 Too Many Requests` under light load | `memory://` per-worker counters, or a proxy hiding client IPs. Check that `TRUST_PROXY_HEADERS` is on (it defaults to on in production). |
| Images upload but never appear | `MAX_CONTENT_LENGTH` (8 MB) rejects larger files with 413. |

---

## 12. Deploying without the blueprint

If you prefer to create the service by hand:

| Setting | Value |
| --- | --- |
| Environment | Python |
| Root directory | `backend` |
| Build command | `pip install --upgrade pip && pip install -r requirements.txt` |
| Start command | `bash ./render_start.sh` |
| Health check path | `/api/healthz` |

Then set, at minimum: `FLASK_ENV=production`, `FLASK_APP=wsgi:app`,
`DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`,
`FRONTEND_BASE_URL`. `backend/.env.example` documents every supported variable.

The same files work on any platform that injects `PORT` — Railway, Fly.io,
Heroku, or a plain container. Only `render.yaml` is Render-specific.
