"""Update existing certificacion_presupuestal values in the database to be 4 digits (padded with 0)."""
import asyncio
import sys
sys.path.insert(0, '.')
from sqlalchemy import text
from app.core.database import engine as async_engine

async def main():
    async with async_engine.connect() as conn:
        # Check current values
        r = await conn.execute(text("""
            SELECT n_doc, certificacion_presupuestal
            FROM af.fct_compra
            WHERE certificacion_presupuestal IS NOT NULL 
              AND LENGTH(certificacion_presupuestal) < 4 
              AND certificacion_presupuestal ~ '^[0-9]+$'
        """))
        rows = r.fetchall()
        print(f"Encontrados {len(rows)} registros numéricos con menos de 4 dígitos.")
        
        updated_count = 0
        for n_doc, cert in rows:
            if cert:
                padded = cert.zfill(4)
                await conn.execute(text("""
                    UPDATE af.fct_compra
                    SET certificacion_presupuestal = :padded
                    WHERE n_doc = :n_doc
                """), {"padded": padded, "n_doc": n_doc})
                updated_count += 1
                
        await conn.commit()
        print(f"Actualizados {updated_count} registros en fct_compra.")

if __name__ == "__main__":
    asyncio.run(main())
