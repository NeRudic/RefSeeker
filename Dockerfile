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

# Entrypoint — waits for DB, runs migrations, starts uvicorn
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
