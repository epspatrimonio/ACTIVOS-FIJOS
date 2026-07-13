import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("--- unique departments ---")
        res = await conn.execute(text("SELECT DISTINCT departamento FROM af.dim_puesto WHERE tipo_contexto = 'SEDE_CENTRAL'"))
        for row in res.fetchall():
            print(row)

if __name__ == '__main__':
    asyncio.run(main())
