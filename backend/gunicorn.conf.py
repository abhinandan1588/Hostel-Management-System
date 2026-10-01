"""Gunicorn configuration for the Hostel Management System API.

Used by ``render_start.sh`` (and usable anywhere else):

    gunicorn --config gunicorn.conf.py wsgi:app

Every value can be overridden with an environment variable so the same file
works on a 512 MB free instance and on a larger paid one.
"""

import multiprocessing
import os


def _str(name, default):
    """Treat an empty variable as unset - an exported-but-blank PORT would
    otherwise produce the unbindable address ``0.0.0.0:``."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip()


def _int(name, default):
    raw = _str(name, None)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _default_workers():
    """Keep the default conservative.

    The usual ``2 * cpu + 1`` formula overcommits on small shared instances:
    Render reports the host's CPU count, not the container's share, and each
    worker holds its own SQLAlchemy connection pool against a managed Postgres
    plan with a hard connection cap.
    """
    cpus = multiprocessing.cpu_count() or 1
    return max(2, min(4, cpus))


# --- Socket ----------------------------------------------------------------
# Render (and most PaaS) inject the port the platform routes traffic to.
bind = f"0.0.0.0:{_str('PORT', '8000')}"

# --- Worker processes ------------------------------------------------------
# WEB_CONCURRENCY is the conventional name and is read by Gunicorn itself too.
workers = _int("WEB_CONCURRENCY", _default_workers())

# Threads let a worker overlap request handling while another request waits on
# the database or on SMTP, which is where this API spends most of its time.
worker_class = _str("GUNICORN_WORKER_CLASS", "gthread")
threads = _int("GUNICORN_THREADS", 4)

# --- Timeouts --------------------------------------------------------------
# PDF/CSV report generation is the slowest endpoint; give it room.
timeout = _int("GUNICORN_TIMEOUT", 60)
graceful_timeout = _int("GUNICORN_GRACEFUL_TIMEOUT", 30)
# Must stay above the platform load balancer's idle timeout to avoid races
# where the proxy reuses a connection the worker just closed.
keepalive = _int("GUNICORN_KEEPALIVE", 5)

# --- Worker recycling ------------------------------------------------------
# Restart workers periodically so a slow leak cannot grow unbounded. The
# jitter stops every worker from recycling on the same request.
max_requests = _int("GUNICORN_MAX_REQUESTS", 1000)
max_requests_jitter = _int("GUNICORN_MAX_REQUESTS_JITTER", 100)

# --- Proxy -----------------------------------------------------------------
# The platform load balancer is the only thing that can reach the container, so
# its X-Forwarded-* headers are trustworthy. Flask's ProxyFix (enabled via
# TRUST_PROXY_HEADERS) then recovers the real client IP for rate limiting.
forwarded_allow_ips = _str("GUNICORN_FORWARDED_ALLOW_IPS", "*")
proxy_allow_ips = forwarded_allow_ips

# --- Logging ---------------------------------------------------------------
# Stream to stdout/stderr; the platform collects container output.
accesslog = "-"
errorlog = "-"
loglevel = _str("GUNICORN_LOG_LEVEL", "info")
# Add the forwarded client IP and the response time to the access log.
access_log_format = (
    '%({x-forwarded-for}i)s %(h)s "%(r)s" %(s)s %(b)s %(M)sms "%(f)s" "%(a)s"'
)

# --- Application loading ---------------------------------------------------
# Do NOT preload: forking after create_app() would share one SQLAlchemy engine
# (and its sockets) across workers, which corrupts connection state.
preload_app = False

proc_name = "hms-api"
