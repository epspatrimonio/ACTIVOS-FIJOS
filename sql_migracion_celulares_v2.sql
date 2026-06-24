-- Migración: fecha_ingreso + vida útil para fct_celulares
-- Ejecutar con: psql -U postgres -d activos_fijos -f sql_migracion_celulares_v2.sql

-- 1. Recrear la vista sin columnas que conflicten
DROP VIEW IF EXISTS af.vw_celulares_detalle;

-- 2. Asegurarse de que la columna existe
ALTER TABLE af.fct_celulares
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE;

-- 3. Recrear la vista con campos de vida útil calculados
CREATE VIEW af.vw_celulares_detalle AS
SELECT
    c.id_celular,
    c.cod_control,
    c.marca,
    c.modelo,
    c.imei,
    c.numero_linea,
    c.operador,
    c.id_sucursal,
    s.sucursal,
    l.localidad,
    c.puesto_id,
    p.puesto,
    c.cod_personal,
    per.personal                                              AS responsable,
    c.fecha_ingreso,
    c.fecha_asignacion,
    (c.fecha_ingreso + INTERVAL '3 years')::DATE             AS fecha_renovacion,
    ((c.fecha_ingreso + INTERVAL '3 years')::DATE - CURRENT_DATE)::INTEGER
                                                             AS dias_para_renovar,
    CASE
        WHEN ((c.fecha_ingreso + INTERVAL '3 years')::DATE - CURRENT_DATE) < 0
            THEN 'VENCIDA'
        WHEN ((c.fecha_ingreso + INTERVAL '3 years')::DATE - CURRENT_DATE) <= 90
            THEN 'POR_RENOVAR'
        ELSE 'VIGENTE'
    END                                                      AS vida_util_estado,
    c.estado,
    c.observaciones,
    c.created_at,
    c.updated_at
FROM af.fct_celulares c
JOIN af.dim_sucursal s ON s.id_sucursal = c.id_sucursal
LEFT JOIN af.dim_localidad l ON l.id_localidad = s.id_localidad
LEFT JOIN af.dim_puesto p ON p.puesto_id = c.puesto_id
LEFT JOIN af.dim_personal per ON per.cod_personal = c.cod_personal;

SELECT 'Migración fct_celulares completada OK' AS resultado;
