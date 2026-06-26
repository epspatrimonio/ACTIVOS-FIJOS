import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        for code in ['INV-001', 'INV-002', 'TERC-001', 'CTRL-001']:
            res = await conn.execute(text(f"SELECT cod_patrimonial, id_sucursal FROM af.fct_registro_activos WHERE cod_patrimonial = '{code}';"))
            row = res.fetchone()
            print(f"{code} in assets: {row}")

if __name__ == '__main__':
    asyncio.run(main())
