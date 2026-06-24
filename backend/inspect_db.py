import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.connect() as conn:
        print("--- COMPRAS ---")
        res = await conn.execute(text("SELECT n_doc, id_localidad FROM af.fct_compra"))
        for row in res.fetchall():
            print(row)
            
        print("--- INCORPORACIONES ---")
        res = await conn.execute(text("SELECT n_doc, id_localidad FROM af.fct_incorporacion_af"))
        for row in res.fetchall():
            print(row)
            
        print("--- ACTIVOS ---")
        res2 = await conn.execute(text("SELECT cod_patrimonial, n_doc_compra, n_doc_incorporacion FROM af.fct_registro_activos"))
        for row in res2.fetchall():
            print(row)
            
        print("--- DETALLE EN VISTA ---")
        res3 = await conn.execute(text("SELECT cod_patrimonial, localidad, id_sucursal FROM af.vw_registro_activos_detalle"))
        for row in res3.fetchall():
            print(row)

if __name__ == '__main__':
    asyncio.run(main())
