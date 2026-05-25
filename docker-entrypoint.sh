#!/bin/sh
set -e

echo "=== Waiting for PostgreSQL ==="
python -c "
import asyncio, asyncpg, os, sys

url = os.environ['DATABASE_URL'].replace('+asyncpg', '')
dsn = url.replace('postgresql://', '')

async def wait():
    for i in range(30):
        try:
            conn = await asyncpg.connect(dsn, timeout=2)
            await conn.close()
            print('PostgreSQL is ready')
            return
        except Exception:
            await asyncio.sleep(1)
    print('PostgreSQL did not become ready in 30 seconds')
    sys.exit(1)

asyncio.run(wait())
"

echo "=== Running database migrations ==="
alembic upgrade head

echo "=== Starting uvicorn ==="
exec uvicorn refseeker.api:app --host 0.0.0.0 --port 8000
