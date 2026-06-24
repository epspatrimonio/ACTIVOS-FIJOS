/*
  Módulos nuevos: Celulares, Vehículo Detalle y SOAT
  Base de datos: activos_fijos  |  Esquema: af
  Ejecutar DESPUÉS de haber aplicado AFIJOS PG.sql (tablas base ya existentes)
*/

-- ============================================================
-- 1. CELULARES: Activos sujetos a control (NO activos fijos)
-- ============================================================
CREATE TABLE IF NOT EXISTS af.fct_celulares (
    id_celular        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cod_control       VARCHAR(30) NOT NULL UNIQUE,
    marca             VARCHAR(100),
    modelo            VARCHAR(150),
    imei              VARCHAR(20),
    numero_linea      VARCHAR(20),
    operador          VARCHAR(60),
    id_sucursal       INTEGER NOT NULL REFERENCES af.dim_sucursal(id_sucursal),
    puesto_id         BIGINT REFERENCES af.dim_puesto(puesto_id),
    cod_personal      VARCHAR(20) REFERENCES af.dim_personal(cod_personal),
    fecha_asignacion  DATE,
    estado            VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_celular_estado CHECK (estado IN ('ACTIVO','BAJA','EXTRAVIADO','EN REPARACION'))
);

CREATE INDEX IF NOT EXISTS ix_fct_celulares_sucursal   ON af.fct_celulares (id_sucursal);
CREATE INDEX IF NOT EXISTS ix_fct_celulares_personal   ON af.fct_celulares (cod_personal);
CREATE INDEX IF NOT EXISTS ix_fct_celulares_estado     ON af.fct_celulares (estado);

CREATE TRIGGER trg_fct_celulares_updated_at
    BEFORE UPDATE ON af.fct_celulares
    FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

-- ============================================================
-- 2. VEHÍCULO DETALLE: datos particulares (1:1 con fct_registro_activos)
-- ============================================================
CREATE TABLE IF NOT EXISTS af.fct_vehiculo_detalle (
    cod_patrimonial   VARCHAR(30) PRIMARY KEY
                      REFERENCES af.fct_registro_activos(cod_patrimonial)
                      ON UPDATE CASCADE ON DELETE CASCADE,
    placa             VARCHAR(10) NOT NULL UNIQUE,
    anio_fabricacion  SMALLINT,
    tipo_vehiculo     VARCHAR(60),
    combustible       VARCHAR(30),
    cilindrada_cc     INTEGER,
    nro_motor         VARCHAR(60),
    nro_chasis        VARCHAR(60),
    nro_tarjeta_prop  VARCHAR(40),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_vehiculo_combustible
        CHECK (combustible IN ('GASOLINA','DIESEL','GAS','ELECTRICO','HIBRIDO') OR combustible IS NULL)
);

CREATE TRIGGER trg_fct_vehiculo_detalle_updated_at
    BEFORE UPDATE ON af.fct_vehiculo_detalle
    FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

-- ============================================================
-- 3. SOAT: Historial de renovaciones por vehículo (seguro anual)
-- ============================================================
CREATE TABLE IF NOT EXISTS af.fct_soat (
    id_soat              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cod_patrimonial      VARCHAR(30) NOT NULL
                         REFERENCES af.fct_registro_activos(cod_patrimonial)
                         ON UPDATE CASCADE,
    numero_poliza        VARCHAR(60),
    compania_aseguradora VARCHAR(120),
    fecha_inicio         DATE NOT NULL,
    fecha_vencimiento    DATE NOT NULL,
    monto                NUMERIC(12,2),
    observaciones        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_soat_fechas CHECK (fecha_vencimiento > fecha_inicio)
);

CREATE INDEX IF NOT EXISTS ix_fct_soat_vehiculo    ON af.fct_soat (cod_patrimonial);
CREATE INDEX IF NOT EXISTS ix_fct_soat_vencimiento ON af.fct_soat (fecha_vencimiento);

CREATE TRIGGER trg_fct_soat_updated_at
    BEFORE UPDATE ON af.fct_soat
    FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

-- ============================================================
-- 4. VISTA: Celulares con joins a dimensiones
-- ============================================================
CREATE OR REPLACE VIEW af.vw_celulares_detalle AS
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
    per.personal AS responsable,
    c.fecha_asignacion,
    c.estado,
    c.observaciones,
    c.created_at,
    c.updated_at
FROM af.fct_celulares c
JOIN af.dim_sucursal s ON s.id_sucursal = c.id_sucursal
LEFT JOIN af.dim_localidad l ON l.id_localidad = s.id_localidad
LEFT JOIN af.dim_puesto p ON p.puesto_id = c.puesto_id
LEFT JOIN af.dim_personal per ON per.cod_personal = c.cod_personal;

-- ============================================================
-- 5. VISTA: SOAT con días de vigencia y estado calculados
-- ============================================================
CREATE OR REPLACE VIEW af.vw_soat_vigencia AS
SELECT
    soa.id_soat,
    soa.cod_patrimonial,
    vd.placa,
    a.denominacion,
    soa.numero_poliza,
    soa.compania_aseguradora,
    soa.fecha_inicio,
    soa.fecha_vencimiento,
    (soa.fecha_vencimiento - CURRENT_DATE)::INTEGER AS dias_vigencia,
    CASE
        WHEN soa.fecha_vencimiento < CURRENT_DATE              THEN 'VENCIDO'
        WHEN soa.fecha_vencimiento <= CURRENT_DATE + 30        THEN 'POR_VENCER'
        ELSE                                                        'VIGENTE'
    END AS estado_soat,
    soa.monto,
    soa.observaciones,
    soa.created_at,
    soa.updated_at
FROM af.fct_soat soa
JOIN af.fct_registro_activos a ON a.cod_patrimonial = soa.cod_patrimonial
LEFT JOIN af.fct_vehiculo_detalle vd ON vd.cod_patrimonial = soa.cod_patrimonial;
