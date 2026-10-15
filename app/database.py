import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

db_url = settings.get_async_db_url()
# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            # Create tables
            await conn.run_sync(Base.metadata.create_all)
            # Safe column migrations for SQLite / PostgreSQL
            try:
                await conn.exec_driver_sql("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT 0")
            except Exception:
                pass
            try:
                await conn.exec_driver_sql("ALTER TABLE messages ADD COLUMN updated_at DATETIME NULL")
            except Exception:
                pass
            try:
                await conn.exec_driver_sql("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER NULL")
            except Exception:
                pass
            logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to connect using configured DATABASE_URL ({db_url}): {e}")
        # Fallback to local SQLite if remote/configured PostgreSQL is unavailable
        if "sqlite" not in db_url:
            fallback_url = "sqlite+aiosqlite:///./chat.db"
            logger.info(f"Falling back to local SQLite at {fallback_url}")
            engine = create_async_engine(fallback_url, connect_args={"check_same_thread": False})
            AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("SQLite fallback database initialized successfully.")
        else:
            raise e
