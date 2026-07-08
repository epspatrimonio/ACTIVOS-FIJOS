import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        print("Actualizando la vista af.vw_registro_activos_detalle...")
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
                END AS soat_estado,

                -- Nuevos campos para reportes
                COALESCE(f_cop.fuente, f_inc.fuente, f_lo.fuente) AS fuente,
                cop.nota_pedido AS nota_pedido,
                COALESCE(cop.centro_costo, inc.centro_costo, lo.centro_costo) AS centro_costo,
                cop.requerido_por AS requerido_por,
                COALESCE(inc.fecha_alta, lo.fecha_alta, a.fecha_alta_factura) AS fecha_alta

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
            LEFT JOIN af.dim_fuente f_cop ON f_cop.id_fuente = cop.id_fuente
            LEFT JOIN af.dim_fuente f_inc ON f_inc.id_fuente = inc.id_fuente
            LEFT JOIN af.dim_fuente f_lo ON f_lo.id_fuente = lo.id_fuente
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
        print("Vista actualizada con éxito!")

if __name__ == '__main__':
    asyncio.run(main())
