FROM python:3.12-slim AS builder

WORKDIR /app
COPY pyproject.toml .
COPY refseeker/ refseeker/
COPY config.json .
RUN pip install --no-cache-dir .

# ── Runtime stage ──────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Alembic migrations
COPY alembic/ alembic/
COPY alembic.ini .

# Application
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /app/refseeker/ refseeker/
COPY --from=builder /app/config.json .

# Alembic needs the refseeker package importable
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "refseeker.api:app", "--host", "0.0.0.0", "--port", "8000"]
