import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        print("Añadiendo columnas nota_pedido y certificacion_presupuestal a af.fct_incorporacion_af y af.fct_obra...")
        
        await conn.execute(text("""
            ALTER TABLE af.fct_incorporacion_af 
            ADD COLUMN IF NOT EXISTS nota_pedido VARCHAR(80),
            ADD COLUMN IF NOT EXISTS certificacion_presupuestal VARCHAR(80);
        """))
        print("Columnas añadidas a fct_incorporacion_af.")
        
        await conn.execute(text("""
            ALTER TABLE af.fct_obra 
            ADD COLUMN IF NOT EXISTS nota_pedido VARCHAR(80),
            ADD COLUMN IF NOT EXISTS certificacion_presupuestal VARCHAR(80);
        """))
        print("Columnas añadidas a fct_obra.")
        
        print("Migración completada con éxito!")

if __name__ == '__main__':
    asyncio.run(main())
