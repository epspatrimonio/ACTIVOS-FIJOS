import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import engine
from app.models.activos import Base

async def main():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT to_regclass('af.fct_transferencia_bienes')"))
        table_name = res.scalar()
        print("Table af.fct_transferencia_bienes exists:", table_name)
        if not table_name:
            print("Creating table af.fct_transferencia_bienes...")
            await conn.run_sync(Base.metadata.create_all)
            print("Table created successfully!")

if __name__ == '__main__':
    asyncio.run(main())
