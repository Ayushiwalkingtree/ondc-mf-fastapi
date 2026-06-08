from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
import sqlalchemy as sa
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)

if settings.NO_DATABASE:
    target_metadata = None
else:
    from app.models.ondc import Base

    target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # type: ignore[no-untyped-def]
    connection.execute(sa.text(f'CREATE SCHEMA IF NOT EXISTS "{settings.DATABASE_SCHEMA}"'))
    connection.commit()
    connection.execute(sa.text(f'SET search_path TO "{settings.DATABASE_SCHEMA}"'))
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=settings.DATABASE_SCHEMA,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
        connect_args={'server_settings': {'search_path': settings.DATABASE_SCHEMA}},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    if settings.NO_DATABASE:
        print('Alembic skipped because NO_DATABASE=true')
    else:
        run_migrations_offline()
else:
    if settings.NO_DATABASE:
        print('Alembic skipped because NO_DATABASE=true')
    else:
        asyncio.run(run_migrations_online())
