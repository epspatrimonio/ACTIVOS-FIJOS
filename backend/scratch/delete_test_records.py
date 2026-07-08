import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        print("Eliminando detalles de vehiculos de prueba...")
        res = await conn.execute(text("""
            DELETE FROM af.fct_vehiculo_detalle 
            WHERE cod_patrimonial IN (
                SELECT cod_patrimonial 
                FROM af.fct_registro_activos 
                WHERE cod_patrimonial LIKE '33900%' AND denominacion = 'Vehiculo de obras de prueba'
            );
        """))
        print(f"Detalles eliminados: {res.rowcount}")

        print("Eliminando activos fijos de prueba...")
        res = await conn.execute(text("""
            DELETE FROM af.fct_registro_activos 
            WHERE cod_patrimonial LIKE '33900%' AND denominacion = 'Vehiculo de obras de prueba';
        """))
        print(f"Activos eliminados: {res.rowcount}")

        print("Eliminando obras en curso de prueba...")
        res = await conn.execute(text("""
            DELETE FROM af.fct_obra 
            WHERE n_doc LIKE 'OBR-2026-TEST%';
        """))
        print(f"Obras de prueba eliminadas: {res.rowcount}")

if __name__ == '__main__':
    asyncio.run(main())
