import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async with engine.begin() as conn:
        # Clear existing to avoid duplicate key violations
        await conn.execute(text("DELETE FROM af.fct_inventario_fisico"))
        await conn.execute(text("DELETE FROM af.fct_bienes_terceros"))
        
        # Get an existing category code
        res = await conn.execute(text("SELECT cod_categoria FROM af.dim_categoria LIMIT 1"))
        row = res.fetchone()
        if row:
            cod_cat = row[0]
            print(f"Using category code: {cod_cat}")
        else:
            # Insert a category first if none exists
            await conn.execute(text("""
                INSERT INTO af.dim_categoria 
                (cod_categoria, categoria, subcategoria, vida_util_anios, porcentaje_dep, no_deprecia, c_cont_3, activo) 
                VALUES 
                (10, 'EQUIPOS DE COMPUTO', 'Laptops y Notebooks', 4, 25.0, false, '332', true)
                ON CONFLICT (cod_categoria) DO NOTHING
            """))
            cod_cat = 10
            print(f"Inserted and using category code: {cod_cat}")
        
        # Insert Inventario Físico
        await conn.execute(text("""
            INSERT INTO af.fct_inventario_fisico 
            (cod_patrimonial, tipo, cod_categoria, denominacion, marca, modelo, numero_serie, color, caracteristicas_accesorios, observaciones, id_sucursal, localidad) 
            VALUES 
            ('INV-001', 'FALTANTE', :cod_cat, 'MONITOR DE 24 PULGADAS', 'LG', '24MK430H', 'LG123456', 'NEGRO', 'Incluye cable HDMI y adaptador de corriente', 'Reportado como faltante en auditoría de TI', 10, 'LA MERCED'),
            ('INV-002', 'SOBRANTE', :cod_cat, 'IMPRESORA MULTIFUNCIONAL Laser', 'HP', 'LaserJet Pro M15w', 'HP789101', 'BLANCO', 'Cable USB y tóner instalado', 'Encontrada sin registrar en la oficina de contabilidad', 20, 'SAN RAMON')
        """), {"cod_cat": cod_cat})
        
        # Insert Bienes de Terceros
        await conn.execute(text("""
            INSERT INTO af.fct_bienes_terceros 
            (cod_patrimonial, tipo, denominacion, marca, modelo, numero_serie, color, caracteristicas_accesorios, cod_personal, observaciones, id_sucursal, localidad) 
            VALUES 
            ('TERC-001', 'TERCERO', 'COMPRESORA DE AIRE', 'SCHULZ', 'MSV6', 'SCH9876', 'AZUL', 'Manguera de 5 metros y manómetro', 'A001', 'Equipo en préstamo de empresa contratista', 10, 'LA MERCED'),
            ('CTRL-001', 'CONTROL', 'MESA DE ESCRITORIO DE MADERA', 'S/M', 'Estandar', 'S/S', 'MARRON', 'Cajón con llave', 'A002', 'Bien de control interno administrativamente catalogado', 20, 'SAN RAMON')
        """))
        
        print("Mock data inserted successfully!")

if __name__ == '__main__':
    asyncio.run(main())
