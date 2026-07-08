import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("=== ACTIVOS ===")
        res = await conn.execute(text("SELECT cod_patrimonial, denominacion, created_at FROM af.fct_registro_activos ORDER BY created_at DESC LIMIT 20;"))
        for row in res.fetchall():
            print(row)
            
        print("\n=== CELULARES ===")
        res = await conn.execute(text("SELECT id_celular, cod_control, numero_linea, created_at FROM af.fct_celulares ORDER BY created_at DESC LIMIT 20;"))
        for row in res.fetchall():
            print(row)
            
        print("\n=== SOAT ===")
        res = await conn.execute(text("SELECT id_soat, cod_patrimonial, numero_poliza, created_at FROM af.fct_soat ORDER BY created_at DESC LIMIT 20;"))
        for row in res.fetchall():
            print(row)

        print("\n=== INVENTARIO FISICO ===")
        res = await conn.execute(text("SELECT cod_patrimonial, tipo, observaciones, created_at FROM af.fct_inventario_fisico ORDER BY created_at DESC LIMIT 20;"))
        for row in res.fetchall():
            print(row)

        print("\n=== BIENES TERCEROS ===")
        res = await conn.execute(text("SELECT cod_patrimonial, tipo, observaciones, created_at FROM af.fct_bienes_terceros ORDER BY created_at DESC LIMIT 20;"))
        for row in res.fetchall():
            print(row)

if __name__ == '__main__':
    asyncio.run(main())
