import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT cuenta_contable, descripcion FROM af.dim_cuenta_contable ORDER BY cuenta_contable"))
        rows = res.fetchall()
        print(f"Chart of Accounts has {len(rows)} accounts:")
        for r in rows:
            print(f"  {r.cuenta_contable} | {r.descripcion}")

if __name__ == '__main__':
    asyncio.run(main())
