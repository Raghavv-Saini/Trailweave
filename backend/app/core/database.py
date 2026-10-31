import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings

# Supabase pooler (pgbouncer/Supavisor) does not support prepared statement caches across transactions
connect_args = {
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0
}

if "supabase.co" in settings.DATABASE_URL or "supabase.com" in settings.DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args=connect_args
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Reads schema.sql and executes it against the database to provision tables and PostGIS."""
    schema_path = os.path.join(os.path.dirname(__file__), "..", "db", "schema.sql")
    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema file not found at {schema_path}")

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    async with engine.begin() as conn:
        await conn.execute(text(schema_sql))
