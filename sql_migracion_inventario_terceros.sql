-- ============================================================
-- 1. POBLAR DIM_FUENTE CON NUEVOS REGISTROS
-- ============================================================
INSERT INTO af.dim_fuente (id_fuente, fuente, activo) 
VALUES 
    (8, 'FALTANTES', true),
    (9, 'SOBRANTES', true),
    (10, 'TERCEROS', true)
ON CONFLICT (id_fuente) DO UPDATE SET fuente = EXCLUDED.fuente, activo = EXCLUDED.activo;

-- ============================================================
-- 2. TABLA: INVENTARIO FÍSICO (Faltantes y Sobrantes)
-- ============================================================
CREATE TABLE IF NOT EXISTS af.fct_inventario_fisico (
    cod_patrimonial             VARCHAR(30) PRIMARY KEY,
    tipo                        VARCHAR(15) NOT NULL,
    cod_categoria               INTEGER NOT NULL REFERENCES af.dim_categoria(cod_categoria),
    denominacion                VARCHAR(300) NOT NULL,
    marca                       VARCHAR(160),
    modelo                      VARCHAR(180),
    numero_serie                VARCHAR(180),
    color                       VARCHAR(120),
    caracteristicas_accesorios  TEXT,
    observaciones               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_fct_inventario_fisico_tipo CHECK (tipo IN ('FALTANTE', 'SOBRANTE'))
);

CREATE INDEX IF NOT EXISTS ix_fct_inventario_fisico_tipo ON af.fct_inventario_fisico (tipo);
CREATE INDEX IF NOT EXISTS ix_fct_inventario_fisico_categoria ON af.fct_inventario_fisico (cod_categoria);

DROP TRIGGER IF EXISTS trg_fct_inventario_fisico_updated_at ON af.fct_inventario_fisico;
CREATE TRIGGER trg_fct_inventario_fisico_updated_at
    BEFORE UPDATE ON af.fct_inventario_fisico
    FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

-- ============================================================
-- 3. TABLA: BIENES DE TERCEROS Y CONTROL
-- ============================================================
CREATE TABLE IF NOT EXISTS af.fct_bienes_terceros (
    cod_patrimonial             VARCHAR(30) PRIMARY KEY,
    tipo                        VARCHAR(15) NOT NULL,
    denominacion                VARCHAR(300) NOT NULL,
    marca                       VARCHAR(160),
    modelo                      VARCHAR(180),
    numero_serie                VARCHAR(180),
    color                       VARCHAR(120),
    caracteristicas_accesorios  TEXT,
    cod_personal                VARCHAR(20) REFERENCES af.dim_personal(cod_personal),
    observaciones               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_fct_bienes_terceros_tipo CHECK (tipo IN ('TERCERO', 'CONTROL'))
);

CREATE INDEX IF NOT EXISTS ix_fct_bienes_terceros_tipo ON af.fct_bienes_terceros (tipo);
CREATE INDEX IF NOT EXISTS ix_fct_bienes_terceros_personal ON af.fct_bienes_terceros (cod_personal);

DROP TRIGGER IF EXISTS trg_fct_bienes_terceros_updated_at ON af.fct_bienes_terceros;
CREATE TRIGGER trg_fct_bienes_terceros_updated_at
    BEFORE UPDATE ON af.fct_bienes_terceros
    FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

-- ============================================================
-- 4. VISTA: INVENTARIO FÍSICO CON JOINS
-- ============================================================
CREATE OR REPLACE VIEW af.vw_inventario_fisico_detalle AS
SELECT 
    i.cod_patrimonial,
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
    i.updated_at
FROM af.fct_inventario_fisico i
JOIN af.dim_categoria c ON c.cod_categoria = i.cod_categoria;

-- ============================================================
-- 5. VISTA: BIENES DE TERCEROS Y CONTROL CON JOINS
-- ============================================================
CREATE OR REPLACE VIEW af.vw_bienes_terceros_detalle AS
SELECT 
    t.cod_patrimonial,
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
    t.updated_at
FROM af.fct_bienes_terceros t
LEFT JOIN af.dim_personal p ON p.cod_personal = t.cod_personal;
