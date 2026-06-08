from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path
from sqlalchemy.engine import make_url
import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings


async def main() -> None:
    settings = get_settings()
    url = make_url(settings.DATABASE_URL)
    database_name = url.database
    if not database_name:
        raise SystemExit('DATABASE_URL must include a database name')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', database_name):
        raise SystemExit('DATABASE_URL database name must be a simple PostgreSQL identifier')

    maintenance_db = 'postgres'
    password = url.password
    user = url.username or 'postgres'
    host = url.host or 'localhost'
    port = url.port or 5432

    conn = await asyncpg.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=maintenance_db,
    )
    try:
        exists = await conn.fetchval('SELECT 1 FROM pg_database WHERE datname = $1', database_name)
        if exists:
            print(f'database exists: {database_name}')
            return
        await conn.execute(f'CREATE DATABASE "{database_name}"')
        print(f'database created: {database_name}')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
