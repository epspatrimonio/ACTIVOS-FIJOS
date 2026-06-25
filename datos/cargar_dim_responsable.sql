/*
  Carga masiva: datos/dim_responsable.csv  →  af.dim_personal

  El CSV usa separador ";", tiene encabezado, y sus columnas son:
    cod_responsable  →  cod_personal
    responsable      →  personal

  Se usa una tabla temporal + INSERT … ON CONFLICT para no duplicar
  registros que ya existan y actualizar los nombres si cambiaron.
*/

-- 1. Crear tabla temporal con la misma estructura del CSV
CREATE TEMP TABLE tmp_responsable (
    cod_personal  VARCHAR(20),
    personal      VARCHAR(260)
);

-- 2. Cargar el CSV en la tabla temporal
\copy tmp_responsable(cod_personal, personal) FROM 'c:/APP ActivosFijos/datos/dim_responsable.csv' WITH (FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'UTF8')

-- 3. Insertar en dim_personal con upsert (actualizar si ya existe)
INSERT INTO af.dim_personal (cod_personal, personal)
SELECT cod_personal, personal
FROM tmp_responsable
WHERE cod_personal IS NOT NULL AND btrim(cod_personal) != ''
ON CONFLICT (cod_personal) DO UPDATE
SET personal   = EXCLUDED.personal,
    updated_at = now();

-- 4. Mostrar resumen
SELECT
    'dim_personal' AS tabla,
    count(*) AS total_registros
FROM af.dim_personal;

-- 5. Limpiar
DROP TABLE IF EXISTS tmp_responsable;
