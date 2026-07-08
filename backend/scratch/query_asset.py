import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        r = await conn.execute(text("SELECT cod_patrimonial, fecha_alta_factura, fecha_registro_contable FROM af.fct_registro_activos WHERE cod_patrimonial = '630011245'"))
        print(r.fetchone())

if __name__ == '__main__':
    asyncio.run(main())
