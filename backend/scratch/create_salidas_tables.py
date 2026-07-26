import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DB_URL = "postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos"

CREATE_TABLE_HEADER = """
CREATE TABLE IF NOT EXISTS af.fct_salida_bienes (
    id SERIAL PRIMARY KEY,
    n_orden VARCHAR(40) NOT NULL UNIQUE,
    fecha_orden DATE NOT NULL,
    tipo_salida VARCHAR(60) NOT NULL,
    motivo TEXT NOT NULL,
    responsable VARCHAR(260) NOT NULL,
    cargo VARCHAR(220) NOT NULL,
    ubicacion VARCHAR(220) NOT NULL,
    resp_tecnico VARCHAR(260),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_TABLE_DETAIL = """
CREATE TABLE IF NOT EXISTS af.fct_salida_bienes_detalle (
    id SERIAL PRIMARY KEY,
    id_salida INTEGER NOT NULL REFERENCES af.fct_salida_bienes(id) ON DELETE CASCADE,
    cod_patrimonial VARCHAR(30) REFERENCES af.fct_registro_activos(cod_patrimonial) ON DELETE SET NULL,
    denominacion VARCHAR(300) NOT NULL,
    color VARCHAR(120),
    marca VARCHAR(160),
    modelo VARCHAR(180),
    numero_serie VARCHAR(180),
    estado_activo VARCHAR(30) NOT NULL DEFAULT 'BUENO',
    accesorios TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

async def main():
    print("Conectándose a la base de datos...")
    engine = create_async_engine(DB_URL, echo=True)
    async with engine.begin() as conn:
        print("Creando tablas para cabecera de salidas de bienes...")
        await conn.execute(text(CREATE_TABLE_HEADER))
        print("Creando tablas para detalle de salidas de bienes...")
        await conn.execute(text(CREATE_TABLE_DETAIL))
        print("Tablas creadas con éxito.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
