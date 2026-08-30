import uuid

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)

from app.auth.manager import UserManager
from app.config import get_settings
from app.models.user import User


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=get_settings().jwt_secret, lifetime_seconds=3600)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


async def get_user_manager():
    # user_db is intentionally None: UserManager overrides both methods
    # (get_by_email, create) that BaseUserManager would otherwise delegate
    # to a UserDatabase, because both need custom RLS-aware session/role
    # handling that a plain SQLAlchemyUserDatabase bound to one fixed
    # session can't provide (see app/auth/manager.py). No other
    # BaseUserManager method that would touch self.user_db is exercised by
    # the register/login/me flow this codebase implements.
    yield UserManager(user_db=None)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
