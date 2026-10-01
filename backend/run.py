"""Development entry point.

Production uses a WSGI server instead, e.g.
``gunicorn --workers 4 --bind 0.0.0.0:8000 wsgi:app``
"""

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_ENV", "development").lower() in ("development", "dev")
    # Flask's built-in server is for local development only.
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=port, debug=debug)
