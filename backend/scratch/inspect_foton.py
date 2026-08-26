import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.core.database import async_session
from sqlalchemy import text

async def main():
    async with async_session() as session:
        res0 = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'af'"))
        print("TABLES IN AF SCHEMA:")
        for r in res0.fetchall():
            print("  ", r[0])

        res1 = await session.execute(text("SELECT * FROM af.vw_registro_activos_detalle WHERE cod_patrimonial = '410011007'"))
        row1 = res1.mappings().first()
        print("\nVW ROW (410011007):")
        if row1:
            for k, v in dict(row1).items():
                print(f"  {k}: {v}")

if __name__ == "__main__":
    asyncio.run(main())
