# Operations

Day-to-day running of the deployed system. For what is currently broken, see
[LIMITATIONS.md](LIMITATIONS.md).

## Topology

The production host runs Docker Compose with **three services** — `db`, `redis`, and `app`
(the `app` service also contains the built frontend). Public traffic arrives through
**Cloudflare, which runs as a separate systemd unit** (`cloudflared.service`), not as a compose
service. There is no inbound port on the host.

`app` runs four processes under supervisord (`supervisord.conf`):

| Program | Purpose |
|---|---|
| `nginx` | static React build, `/api` and `/ws` reverse proxy |
| `uvicorn` | FastAPI API and WebSocket server |
| `celery worker` | background task execution |
| `celery beat` | task scheduler |

Migrations run automatically on container start via `entrypoint.sh` (`alembic upgrade head`
before supervisord execs).

## Deploying

```bash
git pull
docker compose build app
docker compose up -d
docker compose ps          # db, redis, app should all be healthy
docker compose logs -f app
```

Verify the healthcheck is genuinely reporting, not just running:

```bash
curl -s localhost:8000/api/health
# {"status":"healthy","version":"1.1.0"}
```

Note that `/api/health` only confirms that the API process is up — it reports `status` and
`version` and nothing else. It does **not** verify the database or Redis.

Those are checked separately, per service, by their own healthchecks:

| Service | Check |
|---|---|
| `db` | `pg_isready -U finance_user -d finance_db` |
| `redis` | `redis-cli ... ping` with `REDIS_PASSWORD` |
| `backend` | `curl -f http://127.0.0.1:80/health \|\| curl -f .../api/health` |

So `docker compose ps` showing all services `healthy` *does* mean PostgreSQL and Redis are
reachable, but that guarantee comes from their own probes, not from `/api/health`.

## Deploying with `deploy.sh` — read this first

`deploy.sh` is a **second, divergent** deployment path (systemd + native nginx + native
Postgres/Redis). It is not kept in sync with the Compose setup and has three defects:

1. **It installs bare `postgresql` with no pgvector.** Migration `a3b8c9d0e1f2` then prints a
   message and succeeds without creating the `vector` column, so the entire memory/copilot RAG
   layer is broken on that path — silently, because migrations report success.
2. **It writes `REDIS_URL=redis://localhost:6379/0` with no password**, which will not connect to
   a password-protected Redis.
3. **Its nginx config has no `/ws` location block**, so WebSocket upgrades 404 and live dashboard
   updates do not work.

If you must use it: install `postgresql-15-pgvector`, run `CREATE EXTENSION vector;`, set a Redis
password, and add a `/ws` block proxying with `Upgrade`/`Connection` headers.

## Migrations

Single linear chain, 9 revisions, head `f1a2b3c4d5e6`.

```bash
cd backend
alembic current                 # what is applied
alembic heads                   # should print exactly one head
alembic upgrade head
alembic downgrade -1
```

Applied automatically at container start. `f1a2b3c4d5e6` creates the five indexes that were
declared on models but had never been migrated, using `if_not_exists=True` so it is idempotent.

**When adding a migration:** create it with `alembic revision --autogenerate`, then read the
generated file. Autogenerate compares models against the database, and because models declare
indexes the database never had, it can propose dropping indexes that exist only in the ORM
definition. Review the `upgrade()` body before committing.

## Rotating `OLLAMA_API_KEY`

This is the fix for the largest outstanding problem, and the restart requirement is easy to get
wrong.

```bash
nano .env                                  # set a valid OLLAMA_API_KEY
docker compose up -d --force-recreate app
```

Restarting the container restarts all three processes. **If you restart only uvicorn the fix will
appear not to work**, because `EmbeddingService` builds its `Authorization` header once at
construction; the Celery worker and beat keep using the stale key. Always recreate the whole
`app` container.

Confirm it worked:

```bash
docker compose logs app | grep -i "401\|unauthorized"
```

## Troubleshooting

**Bills or another list page renders nothing / throws**
A list consumer is reading the raw paginated envelope. Wrap the read in `toList()`. See
[API.md](API.md#read-this-before-writing-a-client-the-list-endpoint-contract-is-inconsistent).

**Copilot returns 500, or insights never appear**
`OLLAMA_API_KEY` is invalid or unset. Check the key, then recreate the `app` container as above.

**Receipt scan fails, or the worker restarts on a scan**
PaddleOCR segfaults natively on ARM64. Ensure `OCR_ENGINE=auto`; never force `paddle` on this
host. If OCR broke after an image rebuild, check that `Pillow` is still below 11 — EasyOCR 1.7.2
requires `Pillow<11` and the requirement is currently unpinned.

**`docker compose ps` shows the `app` service restarting**
Check for the OCR warmup thread or a migration failure:
`docker compose logs app | tail -50`. A migration that fails at startup will crash-loop
before supervisord starts.

**Redis connection refused**
`REDIS_PASSWORD` must be set. The URLs in `config.py` are built from it, so an empty value yields
an empty password in the URL and authentication fails.

**WebSocket never connects**
`/ws` must be proxied with the `Upgrade` and `Connection` headers. Verify the nginx config and
check browser devtools for a 404 on the handshake.

**Transient 502 on first load after a deploy**
Should not happen — the healthcheck gates the container. If it does, the API is failing its
startup migrations; see above.

## Backups

The system of record is the `db` container. Back it up with `pg_dump` rather than copying the
volume, and test restores:

```bash
docker compose exec -T db pg_dump -U finance_user finance_db | gzip > backup-$(date +%F).sql.gz
```

Uploaded receipts live on disk under `UPLOAD_DIR` and are **not** in the database dump. Back them
up separately or those files are lost.
