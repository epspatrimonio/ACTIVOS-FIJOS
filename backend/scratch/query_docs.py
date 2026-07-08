import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("=== ALL COMPRAS ===")
        res = await conn.execute(text("SELECT n_doc, concepto, created_at FROM af.fct_compra ORDER BY created_at DESC;"))
        for row in res.fetchall():
            print(row)
            
        print("=== ALL INCORPORACIONES ===")
        res = await conn.execute(text("SELECT n_doc, concepto, created_at FROM af.fct_incorporacion_af ORDER BY created_at DESC;"))
        for row in res.fetchall():
            print(row)

if __name__ == '__main__':
    asyncio.run(main())
