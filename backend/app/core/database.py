from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_reset_on_return="rollback",
    pool_timeout=30,
    connect_args={"command_timeout": 10, "server_settings": {"statement_timeout": "30000", "idle_in_transaction_session_timeout": "60000"}},
)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except BaseException:
            # Catches normal errors AND GeneratorExit (client disconnect / cancelled
            # request). Without this the connection can be returned to the pool
            # mid-transaction, poisoning it and causing intermittent 500s from
            # pool_pre_ping ("cannot use Connection.transaction() in a manually
            # started transaction").
            await session.rollback()
            raise
        finally:
            await session.close()
