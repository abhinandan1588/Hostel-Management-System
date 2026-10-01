#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Render start command for the Hostel Management System API.
#
#   startCommand: bash ./render_start.sh
#
# Invoked through `bash` on purpose: a missing executable bit in Git would
# otherwise fail the deploy with "permission denied".
#
# Runs database migrations, then replaces this shell with Gunicorn so signals
# (SIGTERM on deploy/scale-down) reach the server directly.
# ---------------------------------------------------------------------------
set -euo pipefail

export FLASK_APP="${FLASK_APP:-wsgi:app}"
export FLASK_ENV="${FLASK_ENV:-production}"

log() { printf '[render_start] %s\n' "$1"; }

# --- Migrations ------------------------------------------------------------
# On the free plan there is no pre-deploy command and no shell, so migrations
# have to run here. Keep numInstances at 1 while this is enabled: two
# containers running `alembic upgrade` at the same time can collide.
#
# On a paid plan, prefer Render's preDeployCommand and set
# RUN_MIGRATIONS_ON_START=false.
if [ "${RUN_MIGRATIONS_ON_START:-true}" = "false" ]; then
  log "RUN_MIGRATIONS_ON_START=false - skipping migrations."
else
  log "Applying database migrations..."
  flask db upgrade
  log "Running post-deploy tasks..."
  flask post-deploy
fi

# --- Serve -----------------------------------------------------------------
log "Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn --config gunicorn.conf.py wsgi:app
