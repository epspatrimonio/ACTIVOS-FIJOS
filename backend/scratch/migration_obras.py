import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        print("Executing migration...")

        # 1. Crear tabla af.fct_obra
        await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS af.fct_obra (
            n_doc                      VARCHAR(30) PRIMARY KEY,
            fecha_doc                  DATE,
            id_localidad               INTEGER NOT NULL REFERENCES af.dim_localidad(id_localidad),
            cuenta_contable            VARCHAR(20) NOT NULL REFERENCES af.dim_cuenta_contable(cuenta_contable),
            centro_costo               VARCHAR(20) REFERENCES af.dim_centro_costo(centro_costo),
            id_fuente                  INTEGER REFERENCES af.dim_fuente(id_fuente),
            fuente_origen              VARCHAR(100),
            origen                     VARCHAR(150),
            fecha_alta                 DATE,
            concepto                   TEXT,
            created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """))

        # 2. Crear trigger para updated_at en af.fct_obra
        await conn.execute(text("""
        CREATE OR REPLACE TRIGGER tr_fct_obra_updated_at 
        BEFORE UPDATE ON af.fct_obra 
        FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
        """))

        # 3. Modificar fct_registro_activos
        # Añadir columna n_doc_obra
        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos ADD COLUMN IF NOT EXISTS n_doc_obra VARCHAR(30) REFERENCES af.fct_obra(n_doc);
        """))

        # Actualizar restricciones
        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos DROP CONSTRAINT IF EXISTS ck_fct_registro_documento_tipo;
        """))
        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos ADD CONSTRAINT ck_fct_registro_documento_tipo CHECK (documento_tipo IN ('COMPRA','INCORPORACION','OBRA'));
        """))

        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos DROP CONSTRAINT IF EXISTS ck_fct_registro_n_doc_tipo;
        """))
        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos ADD CONSTRAINT ck_fct_registro_n_doc_tipo CHECK (
            (documento_tipo = 'COMPRA' AND n_doc_compra IS NOT NULL AND n_doc_incorporacion IS NULL AND n_doc_obra IS NULL)
            OR (documento_tipo = 'INCORPORACION' AND n_doc_incorporacion IS NOT NULL AND n_doc_compra IS NULL AND n_doc_obra IS NULL)
            OR (documento_tipo = 'OBRA' AND n_doc_obra IS NOT NULL AND n_doc_compra IS NULL AND n_doc_incorporacion IS NULL)
        );
        """))

        # Drop view first because it depends on column n_doc
        await conn.execute(text("DROP VIEW IF EXISTS af.vw_registro_activos_detalle;"))

        # Recrear columna n_doc y su índice
        await conn.execute(text("DROP INDEX IF EXISTS af.ix_fct_registro_n_doc;"))
        await conn.execute(text("ALTER TABLE af.fct_registro_activos DROP COLUMN IF EXISTS n_doc;"))
        await conn.execute(text("""
        ALTER TABLE af.fct_registro_activos ADD COLUMN n_doc VARCHAR(30) GENERATED ALWAYS AS (
            COALESCE(n_doc_compra, n_doc_incorporacion, n_doc_obra)
        ) STORED;
        """))
        await conn.execute(text("CREATE INDEX ix_fct_registro_n_doc ON af.fct_registro_activos (n_doc);"))

        # 4. Actualizar la vista vw_registro_activos_detalle
        await conn.execute(text("""
        CREATE OR REPLACE VIEW af.vw_registro_activos_detalle AS
        SELECT
            a.cod_patrimonial,
            a.n_doc,
            a.documento_tipo,
            a.cod_categoria,
            c.categoria,
            c.subcategoria,
            a.denominacion,
            a.color,
            a.marca,
            a.modelo,
            a.numero_serie,
            a.caracteristicas_accesorios,
            a.vida_util_anios,
            a.id_sucursal,
            s.sucursal,
            COALESCE(lc.localidad, li.localidad, lo_loc.localidad) AS localidad,
            a.unidad,
            a.puesto_id,
            p.puesto,
            a.cod_personal,
            per.personal AS responsable,
            COALESCE(cop.cuenta_contable, inc.cuenta_contable, lo.cuenta_contable) AS cuenta_contable,
            a.numero_factura,
            a.fecha_alta_factura,
            a.fecha_registro_contable,
            a.fecha_asignacion,
            a.valor_en_libros,
            a.igv,
            a.informe_conformidad,
            a.n_acta,
            a.n_acta_entrega,
            COALESCE(
                (SELECT d.depreciacion_acumulada FROM af.fct_depreciacion_activo d
                 WHERE d.cod_patrimonial = a.cod_patrimonial ORDER BY d.periodo DESC LIMIT 1),
                CASE
                    WHEN a.vida_util_anios IS NOT NULL AND a.vida_util_anios > 0
                         AND a.valor_en_libros IS NOT NULL AND a.valor_en_libros > 0
                         AND a.fecha_registro_contable IS NOT NULL
                    THEN LEAST(
                        ROUND(
                            (a.valor_en_libros / (a.vida_util_anios * 12.0))
                            * GREATEST(
                                (EXTRACT(YEAR FROM age(CURRENT_DATE, a.fecha_registro_contable)) * 12
                                 + EXTRACT(MONTH FROM age(CURRENT_DATE, a.fecha_registro_contable))),
                                0
                              ),
                            2
                        ),
                        a.valor_en_libros
                    )
                    ELSE 0
                END
            ) AS depreciacion_acumulada,
            COALESCE(
                (SELECT d.valor_neto FROM af.fct_depreciacion_activo d
                 WHERE d.cod_patrimonial = a.cod_patrimonial ORDER BY d.periodo DESC LIMIT 1),
                CASE
                    WHEN a.vida_util_anios IS NOT NULL AND a.vida_util_anios > 0
                         AND a.valor_en_libros IS NOT NULL AND a.valor_en_libros > 0
                         AND a.fecha_registro_contable IS NOT NULL
                    THEN GREATEST(
                        a.valor_en_libros - ROUND(
                            (a.valor_en_libros / (a.vida_util_anios * 12.0))
                            * GREATEST(
                                (EXTRACT(YEAR FROM age(CURRENT_DATE, a.fecha_registro_contable)) * 12
                                 + EXTRACT(MONTH FROM age(CURRENT_DATE, a.fecha_registro_contable))),
                                0
                              ),
                            2
                        ),
                        0
                    )
                    ELSE a.valor_en_libros
                END
            ) AS valor_neto,
            a.estado_activo,
            
            -- Campos de fct_vehiculo_detalle
            vd.placa,
            vd.anio_fabricacion AS vehiculo_anio,
            vd.tipo_vehiculo,
            vd.combustible,
            vd.cilindrada_cc,
            vd.nro_motor,
            vd.nro_chasis,
            vd.nro_tarjeta_prop,
            vd.carroceria,
            vd.categoria_vehiculo,
            vd.vencimiento_rev_tec,
            (vd.vencimiento_rev_tec - CURRENT_DATE)::INTEGER AS dias_vigencia_rev_tec,
            CASE 
                WHEN vd.vencimiento_rev_tec IS NULL THEN NULL 
                WHEN vd.vencimiento_rev_tec < CURRENT_DATE THEN 'VENCIDO' 
                WHEN vd.vencimiento_rev_tec <= CURRENT_DATE + 30 THEN 'POR_VENCER' 
                ELSE 'VIGENTE' 
            END AS estado_rev_tec,
            
            -- Campos del último SOAT asociado
            s_latest.numero_poliza AS soat_poliza,
            s_latest.compania_aseguradora AS soat_compania,
            s_latest.fecha_vencimiento AS soat_vencimiento,
            (s_latest.fecha_vencimiento - CURRENT_DATE)::INTEGER AS soat_dias_vigencia,
            CASE 
                WHEN s_latest.fecha_vencimiento IS NULL THEN NULL 
                WHEN s_latest.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO' 
                WHEN s_latest.fecha_vencimiento <= CURRENT_DATE + 30 THEN 'POR_VENCER' 
                ELSE 'VIGENTE' 
            END AS soat_estado
        FROM af.fct_registro_activos a
        JOIN af.dim_categoria c ON c.cod_categoria = a.cod_categoria
        JOIN af.dim_sucursal s ON s.id_sucursal = a.id_sucursal
        LEFT JOIN af.fct_compra cop ON cop.n_doc = a.n_doc_compra
        LEFT JOIN af.dim_localidad lc ON lc.id_localidad = cop.id_localidad
        LEFT JOIN af.fct_incorporacion_af inc ON inc.n_doc = a.n_doc_incorporacion
        LEFT JOIN af.dim_localidad li ON li.id_localidad = inc.id_localidad
        LEFT JOIN af.fct_obra lo ON lo.n_doc = a.n_doc_obra
        LEFT JOIN af.dim_localidad lo_loc ON lo_loc.id_localidad = lo.id_localidad
        LEFT JOIN af.dim_puesto p ON p.puesto_id = a.puesto_id
        LEFT JOIN af.dim_personal per ON per.cod_personal = a.cod_personal
        LEFT JOIN af.fct_vehiculo_detalle vd ON vd.cod_patrimonial = a.cod_patrimonial
        LEFT JOIN (
            SELECT DISTINCT ON (cod_patrimonial) 
                cod_patrimonial,
                numero_poliza,
                compania_aseguradora,
                fecha_vencimiento
            FROM af.fct_soat
            ORDER BY cod_patrimonial, fecha_vencimiento DESC
        ) s_latest ON s_latest.cod_patrimonial = a.cod_patrimonial;
        """))

    print("Migration completed successfully!")

if __name__ == '__main__':
    asyncio.run(main())
