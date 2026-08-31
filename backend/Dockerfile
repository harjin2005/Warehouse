FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
# app/ must exist before `pip install -e .` runs: setuptools' automatic
# package discovery for an editable install only finds packages present at
# install time. Installing before copying app/ (as a naive reading of the
# brief's Dockerfile would do) silently produces an editable install with no
# `app` package registered at all, so `alembic upgrade head` fails at
# container startup with `ModuleNotFoundError: No module named 'app'` --
# caught by actually booting this stack, not just eyeballing the Dockerfile.
COPY app app
COPY migrations migrations
COPY alembic.ini .
RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
