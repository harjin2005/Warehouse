from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import every model module here, after `Base` is defined, so anything that
# imports `app.models` (directly or transitively -- e.g. `app.main` via
# `app.auth.backend` -> `app.models.user`) gets the FULL metadata registered
# on `Base`, not just whichever individual model module happened to be
# imported first.
#
# Without this, running the real app (not the test suite) crashed at
# request time: `app/main.py`'s import chain only ever reaches
# `app.models.user`, never `app.models.tenant`, so `Base.metadata` never
# registered the `tenants` table -- `User.tenant_id`'s
# `ForeignKey("tenants.id")` then failed to resolve on the first flush with
# `sqlalchemy.exc.NoReferencedTableError`. Every test suite run happened to
# avoid this by coincidence: `migrations/env.py` and `tests/conftest.py`
# both explicitly import `Tenant` for their own unrelated reasons (autogenerate
# support, fixture creation), which was enough to register the table before
# any test exercised registration -- masking this bug until the app was run
# for real outside pytest (caught while smoke-testing Task 4's docker-compose
# stack: POST /auth/register returned a real 500, not a stub response).
from app.models.tenant import Tenant  # noqa: E402,F401
from app.models.user import User  # noqa: E402,F401
