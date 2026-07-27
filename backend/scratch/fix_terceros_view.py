import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("Executing DDL migrations for af.fct_bienes_terceros...")
        
        # 1. Add columns to fct_bienes_terceros
        await conn.execute(text("ALTER TABLE af.fct_bienes_terceros ADD COLUMN IF NOT EXISTS propietario_manual VARCHAR(260);"))
        await conn.execute(text("ALTER TABLE af.fct_bienes_terceros ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;"))
        await conn.execute(text("ALTER TABLE af.fct_bienes_terceros ADD COLUMN IF NOT EXISTS fecha_salida DATE;"))
        await conn.execute(text("UPDATE af.fct_bienes_terceros SET fecha_ingreso = created_at::date WHERE fecha_ingreso IS NULL AND created_at IS NOT NULL;"))
        await conn.execute(text("UPDATE af.fct_bienes_terceros SET fecha_ingreso = CURRENT_DATE WHERE fecha_ingreso IS NULL;"))
        await conn.commit()
        print("Columns added and updated.")

        # 2. Drop and recreate view
        print("Dropping af.vw_bienes_terceros_detalle...")
        await conn.execute(text("DROP VIEW IF EXISTS af.vw_bienes_terceros_detalle CASCADE;"))
        await conn.commit()

        print("Creating af.vw_bienes_terceros_detalle...")
        await conn.execute(text("""
            CREATE VIEW af.vw_bienes_terceros_detalle AS
            SELECT 
                b.cod_patrimonial,
                b.tipo,
                b.denominacion,
                b.marca,
                b.modelo,
                b.numero_serie,
                b.color,
                b.caracteristicas_accesorios,
                b.cod_personal,
                b.propietario_manual,
                COALESCE(b.fecha_ingreso, b.created_at::date, CURRENT_DATE) AS fecha_ingreso,
                b.fecha_salida,
                COALESCE(p.personal, b.propietario_manual, 'Sin asignar') AS responsable,
                b.observaciones,
                b.id_sucursal,
                s.sucursal AS sucursal,
                b.localidad,
                b.created_at,
                b.updated_at
            FROM af.fct_bienes_terceros b
            LEFT JOIN af.dim_personal p ON b.cod_personal = p.cod_personal
            LEFT JOIN af.dim_sucursal s ON b.id_sucursal = s.id_sucursal;
        """))
        await conn.commit()
        print("SUCCESS! View af.vw_bienes_terceros_detalle created successfully!")

if __name__ == '__main__':
    asyncio.run(main())
