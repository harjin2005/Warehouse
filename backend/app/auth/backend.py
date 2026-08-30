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
    # user_db is intentionally None: UserManager overrides every
    # BaseUserManager method whose base implementation would otherwise
    # touch `self.user_db` directly, because each one needs custom
    # RLS-aware session/role handling that a plain SQLAlchemyUserDatabase
    # bound to one fixed session can't provide (see app/auth/manager.py
    # for the full rationale on each):
    #
    #   - get_by_email -- login lookup (via `authenticate()`) and
    #     registration's cross-tenant duplicate-email check, before any
    #     tenant context exists.
    #   - get -- JWT token validation on every protected request
    #     (`JWTStrategy.read_token()` calls this); the token carries a
    #     user id, not a tenant id, so the same chicken-and-egg problem
    #     as login applies.
    #   - create -- registration's insert, which must run through
    #     `tenant_scoped_session` (the new user's own tenant) to satisfy
    #     RLS's WITH CHECK clause, not through a single fixed session.
    #   - authenticate -- its inherited password-rehash-and-persist
    #     branch calls `self.user_db.update(...)` directly, which would
    #     crash with `user_db=None`; overridden to persist through
    #     `tenant_scoped_session` instead, same pattern as `create`.
    #
    # If a future change needs any *other* BaseUserManager method that
    # touches `self.user_db` (e.g. `delete`, `_update`'s email-change
    # path), that method must be added to this list and overridden the
    # same way -- do not assume `user_db=None` is safe by default; verify
    # against the installed fastapi-users source first.
    yield UserManager(user_db=None)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
