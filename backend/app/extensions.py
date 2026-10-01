"""Flask extension singletons.

Kept in their own module so models/services can import them without creating a
circular dependency on the application factory.
"""

from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

# Explicit naming convention so Alembic can autogenerate reliable migrations
# for constraints on every supported backend (notably SQLite).
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

db = SQLAlchemy(metadata=MetaData(naming_convention=NAMING_CONVENTION))
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
mail = Mail()
limiter = Limiter(key_func=get_remote_address)
