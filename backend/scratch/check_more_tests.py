import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT cod_patrimonial, denominacion, created_at FROM af.fct_registro_activos WHERE created_at > '2026-07-05' ORDER BY created_at DESC;"))
        print("Activos after 2026-07-05:")
        for row in res.fetchall():
            print(row)

if __name__ == '__main__':
    asyncio.run(main())
