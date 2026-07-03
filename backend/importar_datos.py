import asyncio
import os
import sys
import json
import pandas as pd
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Append backend directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.activos import (
    Activo,
    VehiculoDetalle,
    VwRegistroActivosDetalle,
    VwCelularesDetalle,
    VwInventarioFisicoDetalle,
    VwBienesTercerosDetalle
)
from app.schemas.activos import (
    ActivoPublicoDTO,
    CelularResponse,
    InventarioFisicoResponse,
    BienTerceroResponse
)
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL or 'postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    datos_dir = r"c:\APP ActivosFijos\datos"
    vehiculos1_path = os.path.join(datos_dir, "VEHICULOS 1.xlsx")
    reporte_path = os.path.join(datos_dir, "Reporte VEHICULOS.xlsx")
    
    print("Cargando archivos Excel...")
    df1 = pd.read_excel(vehiculos1_path)
    df2 = pd.read_excel(reporte_path)
    
    async with async_session() as session:
        async with session.begin():
            # 1. Update vehicle categories from VEHICULOS 1.xlsx
            print("Procesando VEHICULOS 1.xlsx...")
            res_veh = await session.execute(select(VehiculoDetalle))
            db_vehiculos = res_veh.scalars().all()
            
            veh_by_cp = {v.cod_patrimonial: v for v in db_vehiculos}
            veh_by_placa = {}
            for v in db_vehiculos:
                if v.placa:
                    key = v.placa.replace('-', '').strip().upper()
                    veh_by_placa[key] = v
            
            updated_cats = 0
            for idx, row in df1.iterrows():
                exc_cp_raw = row['CODIGO PATRIMONIAL']
                exc_cp = None
                if not pd.isna(exc_cp_raw):
                    exc_cp = str(exc_cp_raw).strip().split('.')[0]
                    if exc_cp.endswith('.0'):
                        exc_cp = exc_cp[:-2]
                    
                exc_placa = str(row['PLACA']).strip() if not pd.isna(row['PLACA']) else None
                exc_cat = str(row['CATEGORIA']).strip() if not pd.isna(row['CATEGORIA']) else None
                
                if not exc_cp and not exc_placa:
                    continue
                    
                if not exc_cat or exc_cat in ('-', 'nan'):
                    continue
                    
                # Match record
                target_veh = None
                if exc_cp and exc_cp in veh_by_cp:
                    target_veh = veh_by_cp[exc_cp]
                elif exc_placa:
                    key = exc_placa.replace('-', '').strip().upper()
                    if key in veh_by_placa:
                        target_veh = veh_by_placa[key]
                        
                if target_veh:
                    if target_veh.categoria_vehiculo != exc_cat:
                        target_veh.categoria_vehiculo = exc_cat
                        updated_cats += 1
                        
            print(f"Se actualizaron las categorias de {updated_cats} vehículos en la BD.")
            
            # 2. Update active asset details from Reporte VEHICULOS.xlsx
            print("Procesando Reporte VEHICULOS.xlsx...")
            res_act = await session.execute(select(Activo))
            db_activos = {a.cod_patrimonial: a for a in res_act.scalars().all()}
            
            updated_activos = 0
            for idx, row in df2.iterrows():
                cp = str(row['Código Patrimonial']).strip().split('.')[0]
                if cp not in db_activos:
                    continue
                    
                db_act = db_activos[cp]
                
                # Helper to clean text inputs
                def get_clean_text(exc_val, current_db_val):
                    if pd.isna(exc_val): return current_db_val
                    s = str(exc_val).strip()
                    if s in ('—', 'S/S', 'nan', '', 'None'): return current_db_val
                    return s
                    
                # Check and update fields
                changed = False
                
                # Denominacion
                exc_den = get_clean_text(row.get('Denominación'), db_act.denominacion)
                if exc_den != db_act.denominacion:
                    db_act.denominacion = exc_den
                    changed = True
                    
                # Marca
                exc_marca = get_clean_text(row.get('Marca'), db_act.marca)
                if exc_marca != db_act.marca:
                    db_act.marca = exc_marca
                    changed = True
                    
                # Modelo
                exc_modelo = get_clean_text(row.get('Modelo'), db_act.modelo)
                if exc_modelo != db_act.modelo:
                    db_act.modelo = exc_modelo
                    changed = True
                    
                # Color
                exc_color = get_clean_text(row.get('Color'), db_act.color)
                if exc_color != db_act.color:
                    db_act.color = exc_color
                    changed = True
                    
                # Estado
                exc_estado = get_clean_text(row.get('Estado'), db_act.estado_activo)
                if exc_estado != db_act.estado_activo:
                    db_act.estado_activo = exc_estado
                    changed = True
                    
                # Nº Factura
                exc_fact = get_clean_text(row.get('Nº Factura'), db_act.numero_factura)
                if exc_fact != db_act.numero_factura:
                    db_act.numero_factura = exc_fact
                    changed = True
                    
                # Nº Acta Entrega
                exc_acta = get_clean_text(row.get('Nº Acta Entrega'), db_act.n_acta)
                if exc_acta != db_act.n_acta:
                    db_act.n_acta = exc_acta
                    changed = True
                    
                # Nº Serie (only update if Excel has a valid series to avoid overwriting chasis numbers)
                exc_serie = str(row.get('Nº Serie', '')).strip()
                if not pd.isna(row.get('Nº Serie')) and exc_serie not in ('—', 'S/S', 'nan', ''):
                    if exc_serie != db_act.numero_serie:
                        db_act.numero_serie = exc_serie
                        changed = True
                        
                # Valor en libros
                exc_val = float(row.get('Valor en Libros (S/.)', 0.0)) if not pd.isna(row.get('Valor en Libros (S/.)')) else 0.0
                if exc_val > 0.0 and abs(exc_val - float(db_act.valor_en_libros or 0.0)) > 0.01:
                    db_act.valor_en_libros = exc_val
                    changed = True
                    
                # IGV
                exc_igv = float(row.get('IGV (S/.)', 0.0)) if not pd.isna(row.get('IGV (S/.)')) else 0.0
                if exc_igv > 0.0 and abs(exc_igv - float(db_act.igv or 0.0)) > 0.01:
                    db_act.igv = exc_igv
                    changed = True
                    
                # Fecha Alta Factura
                exc_fecha = pd.to_datetime(row.get('Fecha Alta')) if not pd.isna(row.get('Fecha Alta')) else None
                if exc_fecha:
                    exc_date = exc_fecha.date()
                    if exc_date != db_act.fecha_alta_factura:
                        db_act.fecha_alta_factura = exc_date
                        changed = True
                        
                # Document mapping
                exc_doc = get_clean_text(row.get('Documento'), None)
                if exc_doc:
                    doc_type = 'COMPRA' if exc_doc.startswith('OC-') else 'INCORPORACION' if exc_doc.startswith('INC-') else 'COMPRA'
                    doc_num = exc_doc.replace('OC-', '').replace('INC-', '').strip()
                    if db_act.documento_tipo != doc_type:
                        db_act.documento_tipo = doc_type
                        changed = True
                    if doc_type == 'COMPRA' and db_act.n_doc_compra != doc_num:
                        db_act.n_doc_compra = doc_num
                        changed = True
                    elif doc_type == 'INCORPORACION' and db_act.n_doc_incorporacion != doc_num:
                        db_act.n_doc_incorporacion = doc_num
                        changed = True
                        
                if changed:
                    updated_activos += 1
            
            print(f"Se actualizaron {updated_activos} activos en la BD.")
            
    # 3. Export to JSON files
    print("Sincronizando archivos JSON...")
    async with async_session() as session:
        # 1. Assets
        query = select(VwRegistroActivosDetalle)
        result = await session.execute(query)
        items = result.scalars().all()
        serialized_data = [ActivoPublicoDTO.model_validate(item).model_dump(mode="json") for item in items]
        
        # 2. Celulares
        cel_query = select(VwCelularesDetalle)
        cel_result = await session.execute(cel_query)
        cel_items = cel_result.scalars().all()
        serialized_celulares = [CelularResponse.model_validate(item).model_dump(mode="json") for item in cel_items]
        
        # 3. Inventario
        inv_query = select(VwInventarioFisicoDetalle)
        inv_result = await session.execute(inv_query)
        inv_items = inv_result.scalars().all()
        serialized_inv = [InventarioFisicoResponse.model_validate(item).model_dump(mode="json") for item in inv_items]
        
        # 4. Bienes de Terceros
        ter_query = select(VwBienesTercerosDetalle)
        ter_result = await session.execute(ter_query)
        ter_items = ter_result.scalars().all()
        serialized_ter = [BienTerceroResponse.model_validate(item).model_dump(mode="json") for item in ter_items]
        
        export_path = settings.PUBLIC_EXPORT_PATH
        dir_name = os.path.dirname(export_path)
        cel_export_path = os.path.join(dir_name, "celulares.json")
        inv_export_path = os.path.join(dir_name, "inventario_fisico.json")
        ter_export_path = os.path.join(dir_name, "bienes_terceros.json")
        
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
            
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(serialized_data, f, ensure_ascii=False, indent=2)
        with open(cel_export_path, "w", encoding="utf-8") as f:
            json.dump(serialized_celulares, f, ensure_ascii=False, indent=2)
        with open(inv_export_path, "w", encoding="utf-8") as f:
            json.dump(serialized_inv, f, ensure_ascii=False, indent=2)
        with open(ter_export_path, "w", encoding="utf-8") as f:
            json.dump(serialized_ter, f, ensure_ascii=False, indent=2)
            
        print("Sincronización de JSON completada con éxito.")

if __name__ == '__main__':
    asyncio.run(main())
