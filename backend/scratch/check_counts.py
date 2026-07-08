"""Verify the 339 accounts that are filtered as 'Obras en Curso'."""
import asyncio, sys
sys.path.insert(0, '.')
from sqlalchemy import text
from app.core.database import engine as async_engine

async def main():
    async with async_engine.connect() as conn:
        # How many start with '339' in cod_patrimonial?
        r = await conn.execute(text("""
            SELECT cod_patrimonial, denominacion, cuenta_contable, localidad, estado_activo
            FROM af.vw_registro_activos_detalle
            WHERE cod_patrimonial LIKE '339%'
            ORDER BY cod_patrimonial
        """))
        rows = r.fetchall()
        print(f"Activos con código patrimonial '339...' (van a Obras en Curso): {len(rows)}")
        for row in rows:
            print(f"  {row[0]} | {row[1][:40] if row[1] else ''} | cc:{row[2]} | {row[3]} | {row[4]}")

        # Verify the split
        r2 = await conn.execute(text("SELECT COUNT(*) FROM af.vw_registro_activos_detalle WHERE cod_patrimonial NOT LIKE '339%'"))
        activos_count = r2.scalar()
        r3 = await conn.execute(text("SELECT COUNT(*) FROM af.vw_registro_activos_detalle WHERE cod_patrimonial LIKE '339%'"))
        obras_count = r3.scalar()
        print(f"\nResumen:")
        print(f"  Inventario (no '339%'): {activos_count}")
        print(f"  Obras en Curso ('339%'): {obras_count}")
        print(f"  Total: {activos_count + obras_count}")

asyncio.run(main())
