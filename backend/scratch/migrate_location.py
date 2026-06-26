import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("Starting migrations...")
        
        # 1. Alter tables to add id_sucursal and localidad
        try:
            print("Altering fct_inventario_fisico...")
            await conn.execute(text("ALTER TABLE af.fct_inventario_fisico ADD COLUMN IF NOT EXISTS id_sucursal INTEGER;"))
            await conn.execute(text("ALTER TABLE af.fct_inventario_fisico ADD COLUMN IF NOT EXISTS localidad VARCHAR(120);"))
            print("Altering fct_bienes_terceros...")
            await conn.execute(text("ALTER TABLE af.fct_bienes_terceros ADD COLUMN IF NOT EXISTS id_sucursal INTEGER;"))
            await conn.execute(text("ALTER TABLE af.fct_bienes_terceros ADD COLUMN IF NOT EXISTS localidad VARCHAR(120);"))
            await conn.commit()
            print("Tables altered successfully.")
        except Exception as e:
            print(f"Error altering tables: {e}")
            await conn.rollback()
            return

        # 2. Recreate vw_inventario_fisico_detalle view
        try:
            print("Recreating af.vw_inventario_fisico_detalle...")
            sql_inv = """
            CREATE OR REPLACE VIEW af.vw_inventario_fisico_detalle AS
             SELECT i.cod_patrimonial,
                i.tipo,
                i.cod_categoria,
                c.categoria,
                c.subcategoria,
                i.denominacion,
                i.marca,
                i.modelo,
                i.numero_serie,
                i.color,
                i.caracteristicas_accesorios,
                i.observaciones,
                i.created_at,
                i.updated_at,
                i.id_sucursal,
                s.sucursal,
                i.localidad
               FROM af.fct_inventario_fisico i
                 JOIN af.dim_categoria c ON c.cod_categoria = i.cod_categoria
                 LEFT JOIN af.dim_sucursal s ON s.id_sucursal = i.id_sucursal;
            """
            await conn.execute(text(sql_inv))
            await conn.commit()
            print("View af.vw_inventario_fisico_detalle recreated successfully.")
        except Exception as e:
            print(f"Error recreating view af.vw_inventario_fisico_detalle: {e}")
            await conn.rollback()
            return

        # 3. Recreate vw_bienes_terceros_detalle view
        try:
            print("Recreating af.vw_bienes_terceros_detalle...")
            sql_ter = """
            CREATE OR REPLACE VIEW af.vw_bienes_terceros_detalle AS
             SELECT t.cod_patrimonial,
                t.tipo,
                t.denominacion,
                t.marca,
                t.modelo,
                t.numero_serie,
                t.color,
                t.caracteristicas_accesorios,
                t.cod_personal,
                p.personal AS responsable,
                t.observaciones,
                t.created_at,
                t.updated_at,
                t.id_sucursal,
                s.sucursal,
                t.localidad
               FROM af.fct_bienes_terceros t
                 LEFT JOIN af.dim_personal p ON p.cod_personal::text = t.cod_personal::text
                 LEFT JOIN af.dim_sucursal s ON s.id_sucursal = t.id_sucursal;
            """
            await conn.execute(text(sql_ter))
            await conn.commit()
            print("View af.vw_bienes_terceros_detalle recreated successfully.")
        except Exception as e:
            print(f"Error recreating view af.vw_bienes_terceros_detalle: {e}")
            await conn.rollback()
            return

        # 4. Recreate vw_soat_vigencia view
        try:
            print("Recreating af.vw_soat_vigencia...")
            sql_soat = """
            CREATE OR REPLACE VIEW af.vw_soat_vigencia AS
             SELECT soa.id_soat,
                soa.cod_patrimonial,
                vd.placa,
                a.denominacion,
                soa.numero_poliza,
                soa.compania_aseguradora,
                soa.fecha_inicio,
                soa.fecha_vencimiento,
                soa.fecha_vencimiento - CURRENT_DATE AS dias_vigencia,
                    CASE
                        WHEN soa.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO'::text
                        WHEN soa.fecha_vencimiento <= (CURRENT_DATE + 30) THEN 'POR_VENCER'::text
                        ELSE 'VIGENTE'::text
                    END AS estado_soat,
                soa.monto,
                soa.observaciones,
                soa.created_at,
                soa.updated_at,
                a.id_sucursal,
                s.sucursal,
                COALESCE(lc.localidad, li.localidad) AS localidad
               FROM af.fct_soat soa
                 JOIN af.fct_registro_activos a ON a.cod_patrimonial::text = soa.cod_patrimonial::text
                 LEFT JOIN af.fct_vehiculo_detalle vd ON vd.cod_patrimonial::text = soa.cod_patrimonial::text
                 LEFT JOIN af.dim_sucursal s ON s.id_sucursal = a.id_sucursal
                 LEFT JOIN af.fct_compra cop ON cop.n_doc::text = a.n_doc_compra::text
                 LEFT JOIN af.dim_localidad lc ON lc.id_localidad = cop.id_localidad
                 LEFT JOIN af.fct_incorporacion_af inc ON inc.n_doc::text = a.n_doc_incorporacion::text
                 LEFT JOIN af.dim_localidad li ON li.id_localidad = inc.id_localidad;
            """
            await conn.execute(text(sql_soat))
            await conn.commit()
            print("View af.vw_soat_vigencia recreated successfully.")
        except Exception as e:
            print(f"Error recreating view af.vw_soat_vigencia: {e}")
            await conn.rollback()
            return
            
        print("All migrations completed successfully!")

if __name__ == '__main__':
    asyncio.run(main())
