import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        views = [
            'vw_registro_activos_detalle',
            'vw_soat_vigencia',
            'vw_inventario_fisico_detalle',
            'vw_bienes_terceros_detalle'
        ]
        for view_name in views:
            print(f"=== VIEW: {view_name} ===")
            try:
                res = await conn.execute(text(f"SELECT pg_get_viewdef('af.{view_name}', true);"))
                row = res.fetchone()
                if row:
                    print(row[0])
                else:
                    print("No definition found")
            except Exception as e:
                print(f"Error fetching definition for {view_name}: {e}")
            print("\n" + "="*40 + "\n")

if __name__ == '__main__':
    asyncio.run(main())
