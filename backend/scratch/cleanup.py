import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM af.fct_inventario_fisico WHERE cod_patrimonial IN ('INV-001', 'INV-002')"))
        await conn.execute(text("DELETE FROM af.fct_bienes_terceros WHERE cod_patrimonial IN ('TERC-001', 'CTRL-001')"))
        print("Cleanup done successfully!")

if __name__ == '__main__':
    asyncio.run(main())
