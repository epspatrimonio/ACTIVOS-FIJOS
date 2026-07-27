import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT cod_patrimonial, tipo, denominacion, propietario_manual, fecha_ingreso, responsable, sucursal FROM af.vw_bienes_terceros_detalle LIMIT 5;"))
        rows = res.fetchall()
        print("ROWS RETURNED FROM VW_BIENES_TERCEROS_DETALLE:")
        for r in rows:
            print(dict(r._mapping))

if __name__ == '__main__':
    asyncio.run(main())
