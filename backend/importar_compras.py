import asyncio
import os
import re
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
    Compra,
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

# Mapeos de Localidades y Fuentes
LOCALIDAD_MAP = {
    'LA MERCED': 101,
    'SAN RAMON': 102,
    'PICHANAQUI': 103,
    'PICHANAKI': 103,
    'OXAPAMPA': 104,
    'VILLA RICA': 105,
    'SATIPO': 106,
}

FUENTE_MAP = {
    'RECURSOS ORDINARIOS': 1,
    'PMO': 2,
    'MRSE': 3,
    'PCC': 4,
    'LIQ OBRAS': 5,
    'LIQUIDACION DE OBRAS': 5,
    'LIQUIDACIÓ DE OBRAS': 5,
    'LIQUIDACIÓN DE OBRAS': 5,
    'TRANSFERENCIA': 6,
    'DONACION': 7,
    'DONACIÓ': 7,
    'DONACIÓN': 7,
}

def parse_excel_date(val):
    if pd.isna(val):
        return None
    try:
        if isinstance(val, (int, float)):
            return pd.to_datetime(val, unit='D', origin='1899-12-30').date()
        s = str(val).strip()
        if s.isdigit():
            return pd.to_datetime(int(s), unit='D', origin='1899-12-30').date()
        return pd.to_datetime(s).date()
    except Exception:
        return None

def normalize_name(name):
    if not name or pd.isna(name):
        return set()
    s = str(name).lower().strip()
    s = re.sub(r'[áäâà]', 'a', s)
    s = re.sub(r'[éëêè]', 'e', s)
    s = re.sub(r'[íïîì]', 'i', s)
    s = re.sub(r'[óöôò]', 'o', s)
    s = re.sub(r'[úüûù]', 'u', s)
    s = re.sub(r'[ñ]', 'n', s)
    words = re.findall(r'[a-z0-9]+', s)
    ignored = {'de', 'del', 'la', 'y', 'los', 'las'}
    return {w for w in words if w not in ignored and len(w) > 1}

def find_best_personal_match(excel_name, db_persons):
    exc_words = normalize_name(excel_name)
    if not exc_words:
        return None
        
    best_match_cod = None
    best_score = 0
    best_ratio = 0.0
    
    for cod, db_name in db_persons:
        db_words = normalize_name(db_name)
        common = exc_words.intersection(db_words)
        score = len(common)
        
        if score >= 2:
            ratio = score / max(len(exc_words), len(db_words))
            if score > best_score:
                best_score = score
                best_match_cod = cod
                best_ratio = ratio
            elif score == best_score:
                if ratio > best_ratio:
                    best_match_cod = cod
                    best_ratio = ratio
                    
    return best_match_cod

async def main():
    engine = create_async_engine(settings.DATABASE_URL or 'postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    datos_dir = r"c:\APP ActivosFijos\datos"
    order_path = os.path.join(datos_dir, "ORDEN DE COMPRA.xlsx")
    
    print("Cargando archivo ORDEN DE COMPRA.xlsx...")
    df = pd.read_excel(order_path)
    
    # Agrupar por OC para recopilar las órdenes de compra únicas
    unique_ocs = {}
    asset_links = []
    
    for idx, row in df.iterrows():
        oc_raw = row['OC']
        if pd.isna(oc_raw):
            continue
        oc_num = str(oc_raw).strip().split('.')[0]
        if oc_num.endswith('.0'):
            oc_num = oc_num[:-2]
            
        cp_raw = row['COD PATRIMONIAL']
        if not pd.isna(cp_raw):
            cp = str(cp_raw).strip().split('.')[0]
            if cp.endswith('.0'):
                cp = cp[:-2]
            asset_links.append((cp, oc_num))
            
        if oc_num not in unique_ocs:
            unique_ocs[oc_num] = row

    print(f"Total órdenes de compra únicas a procesar: {len(unique_ocs)}")
    
    async with async_session() as session:
        # Cargar catálogo de personal
        res_personal = await session.execute(text("SELECT cod_personal, personal FROM af.dim_personal WHERE activo = True"))
        db_persons = res_personal.fetchall()
        
        # Cargar compras existentes
        res_compras = await session.execute(select(Compra))
        db_compras = {c.n_doc: c for c in res_compras.scalars().all()}
        
        inserted_po = 0
        updated_po = 0
        
        for oc_num, row in unique_ocs.items():
            fecha_oc = parse_excel_date(row.get('FECHA OC'))
            
            localidad_raw = str(row.get('LOCALIDAD\nCUENTA', '')).strip().upper()
            id_localidad = LOCALIDAD_MAP.get(localidad_raw, 101)
            
            nota_pedido = str(row.get('NOTA DE PEDIDO', '')).strip().split('.')[0] if not pd.isna(row.get('NOTA DE PEDIDO')) else None
            if nota_pedido == 'nan': nota_pedido = None
            
            certificacion = str(row.get('CERTIFICACION PRESUPUESTAL', '')).strip().split('.')[0] if not pd.isna(row.get('CERTIFICACION PRESUPUESTAL')) else None
            if certificacion == 'nan': certificacion = None
            
            cuenta_contable = str(row.get('CUENTA\nCONTABLE', '')).strip().split('.')[0] if not pd.isna(row.get('CUENTA\nCONTABLE')) else ''
            if cuenta_contable == 'nan': cuenta_contable = ''
            c_cont_3 = cuenta_contable[:3] if cuenta_contable else None
            
            centro_costo = str(row.get('CENTRO DE COSTOS', '')).strip().split('.')[0] if not pd.isna(row.get('CENTRO DE COSTOS')) else None
            if centro_costo == 'nan': centro_costo = None
            
            fuente_raw = str(row.get('FUENTE', '')).strip().upper()
            id_fuente = FUENTE_MAP.get(fuente_raw, None)
            
            # Match personal/requester
            requester_raw = row.get('REQUERIDO POR')
            cod_personal = None
            if not pd.isna(requester_raw):
                cod_personal = find_best_personal_match(requester_raw, db_persons)
            
            # Upsert Compra
            if oc_num in db_compras:
                c = db_compras[oc_num]
                c.fecha_oc = fecha_oc
                c.id_localidad = id_localidad
                c.nota_pedido = nota_pedido
                c.certificacion_presupuestal = certificacion
                c.cuenta_contable = cuenta_contable
                c.c_cont_3 = c_cont_3
                c.centro_costo = centro_costo
                c.id_fuente = id_fuente
                c.requerido_por = cod_personal
                updated_po += 1
            else:
                new_compra = Compra(
                    n_doc=oc_num,
                    fecha_oc=fecha_oc,
                    id_localidad=id_localidad,
                    nota_pedido=nota_pedido,
                    certificacion_presupuestal=certificacion,
                    cuenta_contable=cuenta_contable,
                    c_cont_3=c_cont_3,
                    centro_costo=centro_costo,
                    id_fuente=id_fuente,
                    requerido_por=cod_personal,
                    concepto='COMPRA DE ACTIVOS'
                )
                session.add(new_compra)
                inserted_po += 1
                
        print(f"Órdenes de Compra insertadas: {inserted_po}, actualizadas: {updated_po}")
        
        # Vincular los activos fijos
        print("Vinculando activos fijos...")
        res_act = await session.execute(select(Activo))
        db_activos = {a.cod_patrimonial: a for a in res_act.scalars().all()}
        
        linked_count = 0
        for cp, oc_num in asset_links:
            if cp in db_activos:
                db_act = db_activos[cp]
                if db_act.n_doc_compra != oc_num or db_act.documento_tipo != 'COMPRA':
                    db_act.n_doc_compra = oc_num
                    db_act.n_doc_incorporacion = None # Satisfies ck_fct_registro_n_doc_tipo
                    db_act.documento_tipo = 'COMPRA'
                    linked_count += 1
                    
        print(f"Se vincularon {linked_count} activos fijos con sus respectivas Órdenes de Compra.")
        await session.commit()
            
    # 4. Sincronizar archivos JSON
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
