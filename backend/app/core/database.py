from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Crear motor de base de datos asíncrono para PostgreSQL usando asyncpg
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Cambiar a True para debuguear consultas SQL en desarrollo
    future=True
)

# Constructor de sesiones asíncronas
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Clase base declarativa para los modelos ORM
class Base(DeclarativeBase):
    pass

# Generador de sesión de base de datos dependiente (DI) para inyectar en endpoints
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
