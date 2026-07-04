import asyncio
import os
import re
import sys
import json
import pandas as pd
from decimal import Decimal
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Append backend directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.activos import (
    Activo,
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

# Mapeos de Sucursales
SUCURSAL_MAP = {
    'LA MERCED': 10,
    'SAN RAMON': 20,
    'PICHANAQUI': 40,
    'PICHANAKI': 40,
    'OXAPAMPA': 50,
    'VILLA RICA': 51,
    'SATIPO': 60,
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

def parse_numeric(val):
    if pd.isna(val):
        return Decimal('0')
    try:
        return Decimal(str(val).strip())
    except Exception:
        return Decimal('0')

def normalize_text(val):
    if not val or pd.isna(val):
        return ""
    s = str(val).lower().strip()
    s = re.sub(r'[áäâà]', 'a', s)
    s = re.sub(r'[éëêè]', 'e', s)
    s = re.sub(r'[íïîì]', 'i', s)
    s = re.sub(r'[óöôò]', 'o', s)
    s = re.sub(r'[úüûù]', 'u', s)
    s = re.sub(r'[ñ]', 'n', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

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
    file_path = os.path.join(datos_dir, "ACTIVOS FIJOS.xlsx")
    
    print("Cargando archivo ACTIVOS FIJOS.xlsx...")
    df = pd.read_excel(file_path)
    
    async with async_session() as session:
        # 1. Cargar datos existentes de activos
        res_cps = await session.execute(text("SELECT cod_patrimonial FROM af.fct_registro_activos"))
        db_cps = {row[0] for row in res_cps.fetchall()}
        print(f"Total activos registrados actualmente en la BD: {len(db_cps)}")
        
        res_personal = await session.execute(text("SELECT cod_personal, personal FROM af.dim_personal WHERE activo = True"))
        db_persons = res_personal.fetchall()
        
        # Cargar categorías en BD y construir el mapeador por nombre de subcategoría normalizado
        res_cats = await session.execute(text("SELECT cod_categoria, subcategoria FROM af.dim_categoria"))
        db_cats_raw = res_cats.fetchall()
        db_subcat_map = {normalize_text(row[1]): row[0] for row in db_cats_raw}
        print(f"Total subcategorías cargadas desde BD: {len(db_subcat_map)}")
        
        # 2. Diccionario de códigos en uso durante la importación
        used_cps = set(db_cps)
        
        # Lógica para normalizar y complementar códigos patrimoniales a 9 dígitos
        def resolve_cod_patrimonial(cp_raw):
            if pd.isna(cp_raw):
                return None, False
            cp = str(cp_raw).strip().split('.')[0]
            if cp.endswith('.0'):
                cp = cp[:-2]
            
            if cp in used_cps or len(cp) != 9:
                cat_prefix = cp[:5]
                if len(cat_prefix) < 5:
                    cat_prefix = cat_prefix.ljust(5, '0')
                
                try:
                    seq = int(cp[5:]) if len(cp) > 5 else 1
                except ValueError:
                    seq = 1
                
                # Buscar un código libre
                while True:
                    candidate = f"{cat_prefix}{seq:04d}"
                    if candidate not in used_cps:
                        used_cps.add(candidate)
                        return candidate, True
                    seq += 1
            else:
                # Si tiene 9 dígitos y está libre, se usa
                used_cps.add(cp)
                return cp, False

        inserted_count = 0
        skipped_count = 0
        
        for idx, row in df.iterrows():
            cp_raw = row.get('COD PATRIMONIAL')
            if pd.isna(cp_raw):
                continue
            
            cod_patrimonial, is_observed = resolve_cod_patrimonial(cp_raw)
            if not cod_patrimonial:
                continue
                
            # Evitar insertar duplicados (vehículos y laptop ya registrados)
            # Solo saltamos si el código patrimonial FINAL ya estaba en la base de datos antes de correr el script
            if cod_patrimonial in db_cps:
                skipped_count += 1
                continue
                
            # Mapear categoría por subcategoría normalizada
            subcat_raw = row.get('SUBCATEGORIA')
            norm_sub = normalize_text(subcat_raw)
            cod_categoria = db_subcat_map.get(norm_sub)
            
            if not cod_categoria:
                cod_categoria = int(cod_patrimonial[:5])
            
            # Obtener datos de la fila
            oc_raw = row.get('OC')
            n_doc_compra = str(oc_raw).strip().split('.')[0] if not pd.isna(oc_raw) else '0000000'
            if n_doc_compra == 'nan':
                n_doc_compra = '0000000'
                
            denominacion = str(row.get('DENOMINACIÓN', 'ACTIVO SIN NOMBRE')).strip().upper()
            color = str(row.get('COLOR', '')).strip().upper() if not pd.isna(row.get('COLOR')) else None
            marca = str(row.get('MARCA', '')).strip().upper() if not pd.isna(row.get('MARCA')) else None
            modelo = str(row.get('MODELO', '')).strip().upper() if not pd.isna(row.get('MODELO')) else None
            
            serie_raw = row.get('NUMERO DE SERIE')
            numero_serie = str(serie_raw).strip().upper() if not pd.isna(serie_raw) else None
            
            caract_raw = row.get('CARACTERISTICAS / ACCESORIOS')
            caracteristicas_accesorios = str(caract_raw).strip() if not pd.isna(caract_raw) else None
            
            excel_life = row.get('VIDA UTIL (AÑOS)')
            vida_util_anios = int(float(str(excel_life).strip())) if not pd.isna(excel_life) else 10
            
            # Sucursal
            loc_raw = str(row.get('LOCALIDAD', '')).strip().upper()
            id_sucursal = SUCURSAL_MAP.get(loc_raw, 10) # 10 es LA MERCED por defecto
            
            unidad = str(row.get('UNIDAD', '')).strip().upper() if not pd.isna(row.get('UNIDAD')) else None
            
            # Match Responsable
            responsable_raw = row.get('RESPONSABLE')
            cod_personal = None
            if not pd.isna(responsable_raw):
                cod_personal = find_best_personal_match(responsable_raw, db_persons)
            
            factura_raw = row.get('Nº FACTURA')
            numero_factura = str(factura_raw).strip().split('.')[0] if not pd.isna(factura_raw) else None
            
            fecha_alta_factura = parse_excel_date(row.get('FECHA ALTA\n(FACTURA)'))
            fecha_registro_contable = parse_excel_date(row.get('FECHA DE REGISTRO CONTABLE'))
            
            valor_en_libros = parse_numeric(row.get('VALOR EN LIBROS'))
            igv = parse_numeric(row.get('IGV'))
            
            # Informe de conformidad: si fue observado, escribimos "OBSERVADO COD"
            informe_conformidad = 'OBSERVADO COD' if is_observed else None
            if not is_observed:
                inf_raw = row.get('Nº INF\nCONFORM')
                informe_conformidad = str(inf_raw).strip() if not pd.isna(inf_raw) else None
                
            n_acta_raw = row.get('Nº ACTA')
            n_acta = str(n_acta_raw).strip() if not pd.isna(n_acta_raw) else None
            
            # Insertar el activo
            new_activo = Activo(
                cod_patrimonial=cod_patrimonial,
                documento_tipo='COMPRA',
                n_doc_compra=n_doc_compra,
                n_doc_incorporacion=None,
                cod_categoria=cod_categoria,
                denominacion=denominacion,
                color=color,
                marca=marca,
                modelo=modelo,
                numero_serie=numero_serie,
                caracteristicas_accesorios=caracteristicas_accesorios,
                vida_util_anios=vida_util_anios,
                id_sucursal=id_sucursal,
                unidad=unidad,
                puesto_id=None,
                cod_personal=cod_personal,
                numero_factura=numero_factura,
                fecha_alta_factura=fecha_alta_factura,
                fecha_registro_contable=fecha_registro_contable,
                fecha_asignacion=None,
                valor_en_libros=valor_en_libros,
                igv=igv,
                informe_conformidad=informe_conformidad,
                n_acta=n_acta,
                estado_activo='BUENO'
            )
            session.add(new_activo)
            inserted_count += 1
            
        print(f"Total activos omitidos (ya existentes): {skipped_count}")
        print(f"Total activos nuevos a registrar: {inserted_count}")
        
        await session.commit()
        print("Transacción en la base de datos completada con éxito.")

    # 4. Sincronizar archivos JSON para la consulta pública
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
