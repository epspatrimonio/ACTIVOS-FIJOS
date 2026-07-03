/*
  Base de datos: activos_fijos
  Fuente: BD ACTIVOS FIJOS V1.0.xlsx
  Motor: PostgreSQL

  Este modelo esta alineado al aplicativo:
  - Las tablas FCT se actualizan por n_doc o cod_patrimonial.
  - Las listas desplegables salen de dimensiones y vistas.
  - Categoria se deriva desde subcategoria.
  - N acta de entrega se genera desde n_acta + anio de fecha_alta_factura.
  - La depreciacion lineal se almacena por codigo patrimonial.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS af;

DROP TABLE IF EXISTS af.fct_depreciacion_activo CASCADE;
DROP TABLE IF EXISTS af.fct_registro_activos CASCADE;
DROP TABLE IF EXISTS af.fct_incorporacion_af CASCADE;
DROP TABLE IF EXISTS af.fct_compra CASCADE;
DROP TABLE IF EXISTS af.dim_personal CASCADE;
DROP TABLE IF EXISTS af.dim_puesto CASCADE;
DROP TABLE IF EXISTS af.dim_fuente CASCADE;
DROP TABLE IF EXISTS af.dim_centro_costo CASCADE;
DROP TABLE IF EXISTS af.dim_cuenta_contable CASCADE;
DROP TABLE IF EXISTS af.dim_categoria CASCADE;
DROP TABLE IF EXISTS af.dim_sucursal CASCADE;
DROP TABLE IF EXISTS af.dim_localidad CASCADE;
DROP TABLE IF EXISTS af.dim_proceso CASCADE;
DROP TABLE IF EXISTS af.dim_estado CASCADE;

CREATE TABLE af.dim_estado (
    id_estado         INTEGER PRIMARY KEY,
    estado            VARCHAR(50) NOT NULL UNIQUE,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.dim_proceso (
    id_proceso        INTEGER PRIMARY KEY,
    proceso           VARCHAR(120) NOT NULL UNIQUE,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.dim_localidad (
    id_localidad      INTEGER PRIMARY KEY,
    localidad         VARCHAR(120) NOT NULL UNIQUE,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.dim_sucursal (
    id_sucursal       INTEGER PRIMARY KEY,
    sucursal          VARCHAR(160) NOT NULL UNIQUE,
    id_localidad      INTEGER REFERENCES af.dim_localidad(id_localidad),
    tipo_sucursal     VARCHAR(30) NOT NULL DEFAULT 'UNIDAD_OPERATIVA',
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dim_sucursal_tipo CHECK (tipo_sucursal IN ('SEDE_CENTRAL','UNIDAD_OPERATIVA','NINGUNA'))
);

CREATE TABLE af.dim_fuente (
    id_fuente         INTEGER PRIMARY KEY,
    fuente            VARCHAR(80) NOT NULL UNIQUE,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.dim_cuenta_contable (
    cuenta_contable   VARCHAR(20) PRIMARY KEY,
    descripcion       VARCHAR(250),
    c_cont_3          VARCHAR(3) GENERATED ALWAYS AS (left(cuenta_contable, 3)) STORED,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dim_cuenta_contable_num CHECK (cuenta_contable ~ '^[0-9]+$')
);

CREATE TABLE af.dim_centro_costo (
    centro_costo      VARCHAR(20) PRIMARY KEY,
    descripcion       VARCHAR(250),
    id_proceso        INTEGER REFERENCES af.dim_proceso(id_proceso),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dim_centro_costo_num CHECK (centro_costo ~ '^[0-9]+$')
);

CREATE TABLE af.dim_categoria (
    cod_categoria     INTEGER PRIMARY KEY,
    categoria         VARCHAR(180) NOT NULL,
    subcategoria      VARCHAR(220) NOT NULL UNIQUE,
    vida_util_anios   SMALLINT NOT NULL DEFAULT 0,
    porcentaje_dep    NUMERIC(9,4) NOT NULL DEFAULT 0,
    no_deprecia       BOOLEAN NOT NULL DEFAULT FALSE,
    c_cont_3          VARCHAR(3),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dim_categoria_vida CHECK (vida_util_anios BETWEEN 0 AND 100),
    CONSTRAINT ck_dim_categoria_dep CHECK (porcentaje_dep >= 0),
    CONSTRAINT ck_dim_categoria_no_deprecia CHECK (NOT no_deprecia OR (vida_util_anios = 0 AND porcentaje_dep = 0))
);

CREATE INDEX ix_dim_categoria_categoria ON af.dim_categoria (categoria);

CREATE TABLE af.dim_puesto (
    puesto_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_contexto     VARCHAR(30) NOT NULL,
    id_sede           INTEGER,
    id_uo             INTEGER,
    departamento      VARCHAR(160),
    puesto            VARCHAR(220) NOT NULL,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dim_puesto_contexto CHECK (tipo_contexto IN ('SEDE_CENTRAL','UNIDAD_OPERATIVA'))
);

CREATE UNIQUE INDEX uq_dim_puesto
    ON af.dim_puesto (tipo_contexto, COALESCE(id_sede, -1), COALESCE(id_uo, -1), puesto);

CREATE TABLE af.dim_personal (
    cod_personal      VARCHAR(20) PRIMARY KEY,
    personal          VARCHAR(260) NOT NULL,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.fct_compra (
    n_doc                      VARCHAR(30) PRIMARY KEY,
    fecha_oc                   DATE,
    id_localidad               INTEGER NOT NULL REFERENCES af.dim_localidad(id_localidad),
    nota_pedido                VARCHAR(80),
    certificacion_presupuestal VARCHAR(80),
    c_cont_3                   VARCHAR(3),
    cuenta_contable            VARCHAR(20) NOT NULL REFERENCES af.dim_cuenta_contable(cuenta_contable),
    centro_costo               VARCHAR(20) REFERENCES af.dim_centro_costo(centro_costo),
    id_fuente                  INTEGER REFERENCES af.dim_fuente(id_fuente),
    requerido_por              VARCHAR(260),
    concepto                   TEXT,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.fct_incorporacion_af (
    n_doc            VARCHAR(30) PRIMARY KEY,
    fecha_doc        DATE,
    id_localidad     INTEGER NOT NULL REFERENCES af.dim_localidad(id_localidad),
    cuenta_contable  VARCHAR(20) NOT NULL REFERENCES af.dim_cuenta_contable(cuenta_contable),
    centro_costo     VARCHAR(20) REFERENCES af.dim_centro_costo(centro_costo),
    id_fuente        INTEGER REFERENCES af.dim_fuente(id_fuente),
    fuente_origen    VARCHAR(100),
    origen           VARCHAR(150),
    fecha_alta       DATE,
    concepto         TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE af.fct_registro_activos (
    cod_patrimonial             VARCHAR(30) PRIMARY KEY,
    documento_tipo              VARCHAR(20) NOT NULL DEFAULT 'COMPRA',
    n_doc_compra                VARCHAR(30) REFERENCES af.fct_compra(n_doc),
    n_doc_incorporacion         VARCHAR(30) REFERENCES af.fct_incorporacion_af(n_doc),
    n_doc                       VARCHAR(30) GENERATED ALWAYS AS (
        COALESCE(n_doc_compra, n_doc_incorporacion)
    ) STORED,
    cod_categoria               INTEGER NOT NULL REFERENCES af.dim_categoria(cod_categoria),
    denominacion                VARCHAR(300) NOT NULL,
    color                       VARCHAR(120),
    marca                       VARCHAR(160),
    modelo                      VARCHAR(180),
    numero_serie                VARCHAR(180),
    caracteristicas_accesorios  TEXT,
    vida_util_anios             SMALLINT NOT NULL DEFAULT 0,
    id_sucursal                 INTEGER NOT NULL REFERENCES af.dim_sucursal(id_sucursal),
    unidad                      VARCHAR(180),
    puesto_id                   BIGINT REFERENCES af.dim_puesto(puesto_id),
    cod_personal                VARCHAR(20) REFERENCES af.dim_personal(cod_personal),
    numero_factura              VARCHAR(80),
    fecha_alta_factura          DATE,
    fecha_registro_contable     DATE,
    fecha_asignacion            DATE,
    valor_en_libros             NUMERIC(18,4) NOT NULL DEFAULT 0,
    igv                         NUMERIC(18,4),
    informe_conformidad         VARCHAR(80),
    n_acta                      VARCHAR(40),
    n_acta_entrega              VARCHAR(80) GENERATED ALWAYS AS (
        CASE
            WHEN n_acta IS NULL OR btrim(n_acta) = '' OR fecha_alta_factura IS NULL THEN NULL
            WHEN btrim(n_acta) !~ '[0-9A-Za-z]' THEN NULL
            WHEN btrim(n_acta) ~ '^[0-9]+$' THEN lpad(btrim(n_acta), 3, '0') || ' - ' || EXTRACT(YEAR FROM fecha_alta_factura)::TEXT
            ELSE btrim(n_acta) || ' - ' || EXTRACT(YEAR FROM fecha_alta_factura)::TEXT
        END
    ) STORED,
    estado_activo               VARCHAR(30) NOT NULL DEFAULT 'BUENO' REFERENCES af.dim_estado(estado),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_fct_registro_documento_tipo CHECK (documento_tipo IN ('COMPRA','INCORPORACION')),
    CONSTRAINT ck_fct_registro_n_doc_tipo CHECK (
        (documento_tipo = 'COMPRA' AND n_doc_compra IS NOT NULL AND n_doc_incorporacion IS NULL)
        OR (documento_tipo = 'INCORPORACION' AND n_doc_incorporacion IS NOT NULL AND n_doc_compra IS NULL)
    ),
    CONSTRAINT ck_fct_registro_vida CHECK (vida_util_anios BETWEEN 0 AND 100),
    CONSTRAINT ck_fct_registro_valor CHECK (valor_en_libros >= 0)
);

CREATE INDEX ix_fct_registro_n_doc ON af.fct_registro_activos (n_doc);
CREATE INDEX ix_fct_registro_categoria ON af.fct_registro_activos (cod_categoria);
CREATE INDEX ix_fct_registro_sucursal ON af.fct_registro_activos (id_sucursal);

CREATE TABLE af.fct_depreciacion_activo (
    depreciacion_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cod_patrimonial             VARCHAR(30) NOT NULL REFERENCES af.fct_registro_activos(cod_patrimonial) ON UPDATE CASCADE ON DELETE CASCADE,
    periodo                     DATE NOT NULL,
    descripcion_bien            VARCHAR(300) NOT NULL,
    vida_util_anios             SMALLINT NOT NULL,
    valor_base                  NUMERIC(18,4) NOT NULL,
    depreciacion_mensual        NUMERIC(18,4) NOT NULL,
    depreciacion_periodo        NUMERIC(18,4) NOT NULL,
    depreciacion_acumulada      NUMERIC(18,4) NOT NULL,
    valor_neto                  NUMERIC(18,4) NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_depreciacion_activo_periodo UNIQUE (cod_patrimonial, periodo),
    CONSTRAINT ck_depreciacion_vida CHECK (vida_util_anios >= 0),
    CONSTRAINT ck_depreciacion_valores CHECK (
        valor_base >= 0
        AND depreciacion_mensual >= 0
        AND depreciacion_periodo >= 0
        AND depreciacion_acumulada >= 0
        AND valor_neto >= 0
    )
);

CREATE OR REPLACE FUNCTION af.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION af.fn_registro_activo_validaciones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_sucursal VARCHAR(30);
    v_tipo_puesto   VARCHAR(30);
    v_vida          SMALLINT;
    v_no_deprecia   BOOLEAN;
BEGIN
    SELECT tipo_sucursal INTO v_tipo_sucursal
    FROM af.dim_sucursal
    WHERE id_sucursal = NEW.id_sucursal;

    IF NEW.puesto_id IS NOT NULL THEN
        SELECT tipo_contexto INTO v_tipo_puesto
        FROM af.dim_puesto
        WHERE puesto_id = NEW.puesto_id;

        IF v_tipo_sucursal IS DISTINCT FROM 'NINGUNA' AND v_tipo_puesto IS DISTINCT FROM v_tipo_sucursal THEN
            RAISE EXCEPTION 'El puesto % no corresponde al tipo de sucursal %', NEW.puesto_id, v_tipo_sucursal;
        END IF;
    END IF;

    SELECT vida_util_anios, no_deprecia INTO v_vida, v_no_deprecia
    FROM af.dim_categoria
    WHERE cod_categoria = NEW.cod_categoria;

    IF v_no_deprecia THEN
        NEW.vida_util_anios = 0;
    ELSIF COALESCE(NEW.vida_util_anios, 0) = 0 THEN
        NEW.vida_util_anios = COALESCE(v_vida, 0);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION af.fn_recalcular_depreciacion(p_cod_patrimonial VARCHAR DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM af.fct_depreciacion_activo d
    WHERE p_cod_patrimonial IS NULL OR d.cod_patrimonial = p_cod_patrimonial;

    INSERT INTO af.fct_depreciacion_activo (
        cod_patrimonial,
        periodo,
        descripcion_bien,
        vida_util_anios,
        valor_base,
        depreciacion_mensual,
        depreciacion_periodo,
        depreciacion_acumulada,
        valor_neto
    )
    SELECT
        a.cod_patrimonial,
        (date_trunc('month', a.fecha_alta_factura)::DATE + (g.n || ' month')::INTERVAL)::DATE AS periodo,
        a.denominacion,
        a.vida_util_anios,
        a.valor_en_libros,
        ROUND(a.valor_en_libros / NULLIF(a.vida_util_anios * 12, 0), 4) AS depreciacion_mensual,
        ROUND(a.valor_en_libros / NULLIF(a.vida_util_anios * 12, 0), 4) AS depreciacion_periodo,
        LEAST(
            a.valor_en_libros,
            ROUND((a.valor_en_libros / NULLIF(a.vida_util_anios * 12, 0)) * (g.n + 1), 4)
        ) AS depreciacion_acumulada,
        GREATEST(
            0,
            a.valor_en_libros - LEAST(
                a.valor_en_libros,
                ROUND((a.valor_en_libros / NULLIF(a.vida_util_anios * 12, 0)) * (g.n + 1), 4)
            )
        ) AS valor_neto
    FROM af.fct_registro_activos a
    JOIN af.dim_categoria c ON c.cod_categoria = a.cod_categoria
    CROSS JOIN LATERAL generate_series(0, GREATEST(a.vida_util_anios * 12 - 1, 0)) AS g(n)
    WHERE a.fecha_alta_factura IS NOT NULL
      AND a.valor_en_libros > 0
      AND a.vida_util_anios > 0
      AND NOT c.no_deprecia
      AND (p_cod_patrimonial IS NULL OR a.cod_patrimonial = p_cod_patrimonial);
END;
$$;

CREATE TRIGGER trg_dim_proceso_updated_at BEFORE UPDATE ON af.dim_proceso FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_localidad_updated_at BEFORE UPDATE ON af.dim_localidad FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_estado_updated_at BEFORE UPDATE ON af.dim_estado FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_sucursal_updated_at BEFORE UPDATE ON af.dim_sucursal FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_fuente_updated_at BEFORE UPDATE ON af.dim_fuente FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_cuenta_updated_at BEFORE UPDATE ON af.dim_cuenta_contable FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_centro_updated_at BEFORE UPDATE ON af.dim_centro_costo FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_categoria_updated_at BEFORE UPDATE ON af.dim_categoria FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_puesto_updated_at BEFORE UPDATE ON af.dim_puesto FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_dim_personal_updated_at BEFORE UPDATE ON af.dim_personal FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_fct_compra_updated_at BEFORE UPDATE ON af.fct_compra FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_fct_incorporacion_updated_at BEFORE UPDATE ON af.fct_incorporacion_af FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();
CREATE TRIGGER trg_fct_registro_validaciones BEFORE INSERT OR UPDATE ON af.fct_registro_activos FOR EACH ROW EXECUTE FUNCTION af.fn_registro_activo_validaciones();
CREATE TRIGGER trg_fct_registro_updated_at BEFORE UPDATE ON af.fct_registro_activos FOR EACH ROW EXECUTE FUNCTION af.fn_set_updated_at();

CREATE OR REPLACE FUNCTION af.fn_depreciacion_activo_validaciones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_no_deprecia BOOLEAN;
BEGIN
    SELECT c.no_deprecia
    INTO v_no_deprecia
    FROM af.fct_registro_activos a
    JOIN af.dim_categoria c ON c.cod_categoria = a.cod_categoria
    WHERE a.cod_patrimonial = NEW.cod_patrimonial;

    IF v_no_deprecia THEN
        RAISE EXCEPTION 'El activo % pertenece a una categoría no depreciable y no puede registrar depreciación', NEW.cod_patrimonial;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fct_depreciacion_validaciones BEFORE INSERT OR UPDATE ON af.fct_depreciacion_activo FOR EACH ROW EXECUTE FUNCTION af.fn_depreciacion_activo_validaciones();

CREATE OR REPLACE VIEW af.vw_lista_localidad AS
SELECT id_localidad AS value, localidad AS label
FROM af.dim_localidad
WHERE activo
  AND localidad NOT IN ('RETIRADAS', 'SELVA CENTRAL', 'SIN ASIGNAR')
ORDER BY id_localidad;

CREATE OR REPLACE VIEW af.vw_lista_sucursal AS
SELECT s.id_sucursal AS value, s.sucursal AS label, l.localidad, s.tipo_sucursal
FROM af.dim_sucursal s
LEFT JOIN af.dim_localidad l ON l.id_localidad = s.id_localidad
WHERE s.activo AND (l.localidad IS NULL OR l.localidad != 'RETIRADAS')
ORDER BY s.id_sucursal;

CREATE OR REPLACE VIEW af.vw_lista_cuenta_contable AS
SELECT cuenta_contable AS value, concat(cuenta_contable, ' - ', COALESCE(descripcion, '')) AS label, c_cont_3
FROM af.dim_cuenta_contable
WHERE activo
ORDER BY cuenta_contable;

CREATE OR REPLACE VIEW af.vw_lista_centro_costo AS
SELECT cc.centro_costo AS value, concat(cc.centro_costo, ' - ', COALESCE(cc.descripcion, '')) AS label, p.proceso
FROM af.dim_centro_costo cc
LEFT JOIN af.dim_proceso p ON p.id_proceso = cc.id_proceso
WHERE cc.activo
ORDER BY cc.centro_costo;

CREATE OR REPLACE VIEW af.vw_lista_subcategoria AS
SELECT
    cod_categoria AS value,
    subcategoria AS label,
    categoria,
    vida_util_anios,
    porcentaje_dep,
    no_deprecia,
    c_cont_3
FROM af.dim_categoria
WHERE activo
ORDER BY categoria, subcategoria;

CREATE OR REPLACE VIEW af.vw_lista_puesto_por_sucursal AS
SELECT
    s.id_sucursal,
    s.sucursal,
    p.puesto_id AS value,
    p.puesto AS label,
    p.departamento,
    p.tipo_contexto
FROM af.dim_sucursal s
JOIN af.dim_puesto p ON p.tipo_contexto = s.tipo_sucursal
LEFT JOIN af.dim_localidad l ON l.id_localidad = s.id_localidad
WHERE s.activo AND p.activo AND (l.localidad IS NULL OR l.localidad != 'RETIRADAS')
ORDER BY s.id_sucursal, p.puesto;

CREATE OR REPLACE VIEW af.vw_lista_personal AS
SELECT cod_personal AS value, personal AS label
FROM af.dim_personal
WHERE activo
ORDER BY personal;

CREATE OR REPLACE VIEW af.vw_lista_fuente AS
SELECT id_fuente AS value, fuente AS label
FROM af.dim_fuente
WHERE activo
ORDER BY fuente;

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
    COALESCE(lc.localidad, li.localidad) AS localidad,
    a.unidad,
    a.puesto_id,
    p.puesto,
    a.cod_personal,
    per.personal AS responsable,
    a.numero_factura,
    a.fecha_alta_factura,
    a.fecha_registro_contable,
    a.fecha_asignacion,
    a.valor_en_libros,
    a.igv,
    a.informe_conformidad,
    a.n_acta,
    a.n_acta_entrega,
    /* Depreciación acumulada – NIC 16 Línea Recta (mensual)
       dep_mensual = valor_en_libros / (vida_util_anios * 12)
       meses = meses transcurridos desde fecha_registro_contable hasta hoy
       dep_acumulada = LEAST(dep_mensual * meses, valor_en_libros)        */
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
    /* Valor Neto = Valor en Libros – Depreciación Acumulada  (piso en 0) */
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
    a.estado_activo
FROM af.fct_registro_activos a
JOIN af.dim_categoria c ON c.cod_categoria = a.cod_categoria
JOIN af.dim_sucursal s ON s.id_sucursal = a.id_sucursal
LEFT JOIN af.fct_compra cop ON cop.n_doc = a.n_doc_compra
LEFT JOIN af.dim_localidad lc ON lc.id_localidad = cop.id_localidad
LEFT JOIN af.fct_incorporacion_af inc ON inc.n_doc = a.n_doc_incorporacion
LEFT JOIN af.dim_localidad li ON li.id_localidad = inc.id_localidad
LEFT JOIN af.dim_puesto p ON p.puesto_id = a.puesto_id
LEFT JOIN af.dim_personal per ON per.cod_personal = a.cod_personal;
