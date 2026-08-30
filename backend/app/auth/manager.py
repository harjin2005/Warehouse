import uuid
from typing import Optional

from fastapi import Request
from fastapi.security import OAuth2PasswordRequestForm
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
        codebase, and it has exactly two direct callers (`get_by_email` and
        `get`), reached from three legitimate flows, all of which need to
        find a user before the caller's tenant is known:

        - `get_by_email` -- login (this class's own `authenticate()`
          override calls this before any tenant context exists), and
          registration's cross-tenant duplicate-email check (`create()`,
          see its docstring).
        - `get` -- JWT token validation (`JWTStrategy.read_token()` calls
          this for every protected request; the token carries a user id,
          not a tenant id, so this is the same chicken-and-egg problem as
          login).

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

        if safe:
            # `create_update_dict()` (used whenever `safe=True`, i.e. for
            # every call from the anonymous `/auth/register` endpoint) only
            # strips fastapi-users' own built-in fields
            # (id/is_superuser/is_active/is_verified/oauth_accounts) -- see
            # the installed `fastapi_users/schemas.py`. It does NOT know
            # about this app's custom `role` field on `UserCreate`
            # (app/auth/schemas.py), so an anonymous caller could otherwise
            # set `{"role": "admin", ...}` in the registration payload and
            # have it written straight into `users.role` unfiltered -- a
            # privilege-escalation-at-signup bug. `role` is not currently
            # checked by any authz path, but every future plan treats
            # `User.role` as a real trust boundary, so any account created
            # today must not be pre-escalated. Force it to the safe
            # default here, ignoring whatever the request body contained.
            # A privileged/authenticated caller wanting to provision a user
            # with a non-default role is a separate, authenticated code
            # path that does not exist yet (`safe=False` is never reached
            # from any current route) -- not built here, out of scope.
            user_dict["role"] = "member"

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

    async def authenticate(
        self, credentials: OAuth2PasswordRequestForm
    ) -> Optional[User]:
        """Authenticate a user by email and password.

        Overridden rather than left to `BaseUserManager.authenticate()`
        because that base implementation's password-rehash branch
        (verified against the installed fastapi-users 14.0.0 source,
        `fastapi_users/manager.py`) calls `self.user_db.update(user, ...)`
        directly, and `self.user_db` is `None` in this codebase (see
        `get_user_manager()` in app/auth/backend.py) -- it would raise
        `AttributeError: 'NoneType' object has no attribute 'update'` the
        moment a stored hash actually needs upgrading (e.g. after a
        `PasswordHelper`/Argon2-parameter change makes an existing hash's
        scheme no longer preferred). This is dormant today only because
        every test-created hash already matches the current preferred
        scheme, so the branch never fires in the existing test suite.

        The control flow below is an exact copy of
        `BaseUserManager.authenticate()` -- same lookup, same
        timing-attack mitigation on a missing user, same
        verify-then-maybe-rehash sequence, same return values -- with only
        the final persistence step changed: the rehashed password is
        written through `tenant_scoped_session(user.tenant_id)` (the same
        RLS-satisfying pattern `create()` uses for its insert) instead of
        the unusable `self.user_db.update()`.
        """
        try:
            user = await self.get_by_email(credentials.username)
        except exceptions.UserNotExists:
            # Run the hasher anyway to mitigate a timing attack that would
            # otherwise let a caller distinguish "no such user" from "wrong
            # password" by response time (inspired by Django's approach:
            # https://code.djangoproject.com/ticket/20760), same as the
            # base implementation.
            self.password_helper.hash(credentials.password)
            return None

        verified, updated_password_hash = self.password_helper.verify_and_update(
            credentials.password, user.hashed_password
        )
        if not verified:
            return None

        if updated_password_hash is not None:
            async with tenant_scoped_session(user.tenant_id) as session:
                db_user = await session.get(User, user.id)
                db_user.hashed_password = updated_password_hash
                await session.flush()
            user.hashed_password = updated_password_hash

        return user

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        pass
