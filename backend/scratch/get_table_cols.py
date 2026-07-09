import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        for table in ['fct_registro_activos', 'fct_compra', 'fct_incorporacion_af', 'fct_obra']:
            print(f"=== TABLE: {table} ===")
            res = await conn.execute(text(f"""
                SELECT column_name, data_type, is_nullable, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_schema = 'af' AND table_name = '{table}';
            """))
            for row in res.fetchall():
                print(row)
            print()

if __name__ == '__main__':
    asyncio.run(main())
