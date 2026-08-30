import uuid
from typing import Optional

from fastapi import Request
from fastapi_users import BaseUserManager, UUIDIDMixin, exceptions, schemas
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import get_session_factory, tenant_scoped_session
from app.models.user import User


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = get_settings().jwt_secret
    verification_token_secret = get_settings().jwt_secret

    async def _get_cross_tenant(self, condition) -> Optional[User]:
        """Run a single SELECT on `users` under `app_bypass_auth`
        (BYPASSRLS, granted to `warehouse_runtime` by migration 0003),
        held only for the duration of that SELECT, then immediately reset.

        This is the one deliberate, narrow exception to RLS in the whole
        codebase, and it has exactly three legitimate callers, all of
        which need to find a user before the caller's tenant is known:

        - `get_by_email` -- login (`authenticate()` calls this before any
          tenant context exists).
        - `get` -- JWT token validation (`JWTStrategy.read_token()` calls
          this for every protected request; the token carries a user id,
          not a tenant id, so this is the same chicken-and-egg problem as
          login).
        - `create` -- registration's cross-tenant duplicate-email check
          (see its docstring).

        No other code path may use this pattern.
        """
        factory = get_session_factory()
        async with factory() as session:
            async with session.begin():
                await session.execute(text("SET ROLE app_bypass_auth"))
                try:
                    result = await session.execute(select(User).where(condition))
                    user = result.unique().scalar_one_or_none()
                finally:
                    await session.execute(text("RESET ROLE"))
        return user

    async def get(self, id: uuid.UUID) -> User:
        user = await self._get_cross_tenant(User.id == id)
        if user is None:
            raise exceptions.UserNotExists()
        return user

    async def get_by_email(self, user_email: str) -> User:
        user = await self._get_cross_tenant(User.email == user_email)
        if user is None:
            raise exceptions.UserNotExists()
        return user

    async def create(
        self,
        user_create: schemas.UC,
        safe: bool = False,
        request: Optional[Request] = None,
    ) -> User:
        """Register a new user in their tenant.

        This fully replaces `BaseUserManager.create()` rather than
        delegating to `self.user_db` (which is None -- see
        app/auth/backend.py) because registration has two RLS-shaped
        problems ordinary tenant-scoped queries don't:

        1. Email is globally unique (one UNIQUE constraint on
           `users.email`, not scoped per tenant), but the insert itself
           must run through a session scoped to the *new* user's tenant so
           it satisfies the `tenant_isolation_users` RLS policy's WITH
           CHECK clause. A session scoped to tenant B cannot see tenant
           A's rows, so a plain tenant-scoped duplicate check would miss
           a cross-tenant email collision and let the INSERT hit the
           UNIQUE constraint instead, surfacing as an unhandled
           IntegrityError/500 rather than a clean 400. So the duplicate
           check reuses the same cross-tenant `app_bypass_auth` lookup as
           login (via `self.get_by_email` above), and the INSERT itself
           still goes through the ordinary `warehouse_runtime` role with
           `app.tenant_id` set to the target tenant -- not through the
           bypass role, which has no INSERT grant on `users` and should
           not be given one.
        2. `tenant_id` on the incoming payload must reference a real row
           in `tenants`. That does NOT need `app_bypass_auth`: Postgres
           foreign-key checks always bypass row security on the
           referenced table (this is documented Postgres RLS behavior,
           specifically to keep referential integrity independent of
           which rows the referencing role's RLS policies let it see) --
           so a nonexistent tenant_id fails on the FK constraint
           regardless of whether `warehouse_runtime` could SELECT that
           tenant row, and an existing tenant_id succeeds the same way.

        The insert itself is built by hand (rather than delegating to
        `fastapi_users_db_sqlalchemy.SQLAlchemyUserDatabase.create()`,
        which `session.commit()`s and then `session.refresh()`s the new
        row) because that refresh runs in a new, separately auto-begun
        transaction *after* the commit -- by which point the `SET LOCAL`-
        scoped `app.tenant_id` from the insert's transaction has already
        reverted to Postgres's empty-string placeholder default for a
        referenced-but-unset custom GUC, and the `tenants`/`users` RLS
        policies' `::uuid` cast on that empty string raises instead of
        just seeing zero rows. Using `app.db.tenant_scoped_session` here
        keeps the whole insert -- flush and the follow-up refresh both --
        inside the one transaction where `app.tenant_id` is still valid.
        """
        await self.validate_password(user_create.password, user_create)

        try:
            await self.get_by_email(user_create.email)
        except exceptions.UserNotExists:
            pass
        else:
            raise exceptions.UserAlreadyExists()

        user_dict = (
            user_create.create_update_dict()
            if safe
            else user_create.create_update_dict_superuser()
        )
        password = user_dict.pop("password")
        user_dict["hashed_password"] = self.password_helper.hash(password)

        tenant_id = user_dict["tenant_id"]

        try:
            async with tenant_scoped_session(tenant_id) as session:
                created_user = User(**user_dict)
                session.add(created_user)
                await session.flush()
                await session.refresh(created_user)
        except IntegrityError:
            raise exceptions.UserAlreadyExists()

        await self.on_after_register(created_user, request)

        return created_user

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        pass
