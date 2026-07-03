import asyncio
import datetime
import os
import urllib.request
import urllib.error
import unicodedata
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Database Connection URL (same as backend .env)
DATABASE_URL = 'postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos'

# Sucursal name to id_sucursal mapping
SUCURSAL_MAPPING = {
    'LA MERCED': 10,
    'SAN RAMON': 20,
    'VILLA PERENE': 30,
    'PICHANAKI': 40,
    'SANGANI': 41,
    'OXAPAMPA': 50,
    'VILLA RICA': 51,
    'SATIPO': 60,
    'MAZAMARI': 62,
    'SEDE CENTRAL': 1
}

def clean_text_for_match(text_val):
    if not isinstance(text_val, str) or pd.isna(text_val):
        return []
    text_val = unicodedata.normalize('NFD', text_val)
    text_val = "".join([c for c in text_val if unicodedata.category(c) != 'Mn'])
    # Convert to lowercase and split into words
    words = [w.strip() for w in text_val.lower().replace("-", " ").replace("/", " ").split() if len(w.strip()) > 1]
    # Filter out common non-name words
    ignore_words = {"ubicacion", "uo", "galeria", "filtrante", "baja", "proyecto", "pmo", "no", "cuenta", "con", "placa", "en", "curso", "propietario", "pronap", "avalon", "folio", "registrado"}
    words = [w for w in words if w not in ignore_words]
    return words

def find_personal_code(obs, resp, db_personnel):
    words_obs = clean_text_for_match(str(obs))
    words_resp = clean_text_for_match(str(resp))
    
    best_match = None
    best_score = 0
    
    # Try checking observations first (where names are commonly stored), then responsible
    for words in [words_obs, words_resp]:
        if not words:
            continue
        words_set = set(words)
        for person in db_personnel:
            if not person["words"]:
                continue
            intersection = words_set.intersection(person["words"])
            score = len(intersection) / max(len(words_set), len(person["words"]))
            if score > best_score:
                best_score = score
                best_match = person
                
    if best_match and best_score >= 0.5:
        return best_match["code"]
    return None

def get_category_id(carroceria_str):
    carroceria_str = str(carroceria_str).upper()
    if 'CAMIONETA' in carroceria_str or 'PICK' in carroceria_str:
        return 40001 # CAMIONETAS
    elif 'MOTOCICLETA' in carroceria_str or 'MOTO ' in carroceria_str:
        return 40002 # MOTOCICLETAS
    elif 'TRIMOTO' in carroceria_str or 'MOTOCARGA' in carroceria_str:
        return 40003 # MOTOCARGA
    elif 'MOTOKAR' in carroceria_str:
        return 40004 # MOTOKAR
    elif 'RETROEXCAVADORA' in carroceria_str:
        return 40005 # RETROEXCAVADORA
    elif 'CISTERNA' in carroceria_str or 'CAMION' in carroceria_str:
        return 40006 # CAMIONES CISTERNAS
    elif 'BICICLETA' in carroceria_str:
        return 41001 # BICICLETAS
    else:
        return 40001 # Default to CAMIONETAS

def parse_date(val):
    if pd.isna(val) or val is pd.NaT:
        return None
    if isinstance(val, datetime.date):
        return val
    try:
        ts = pd.to_datetime(val)
        if pd.isna(ts) or ts is pd.NaT:
            return None
        return ts.date()
    except Exception:
        return None

def trigger_sync():
    url = "http://localhost:8000/api/activos/sincronizar-publico"
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Public dashboard sync triggered successfully! Status: {response.status}")
    except urllib.error.URLError as e:
        print("Warning: Could not trigger dashboard sync automatically. FastAPI server might not be running or reachable.", e)

async def main():
    engine = create_async_engine(DATABASE_URL)
    
    print("Connecting to database and reading master dimension 'dim_personal'...")
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT cod_personal, personal FROM af.dim_personal"))
        db_personnel = []
        for row in res.fetchall():
            db_personnel.append({
                "code": row[0],
                "name": row[1],
                "words": set(clean_text_for_match(row[1]))
            })
            
    excel_path = r"c:\APP ActivosFijos\datos\VEHICULOS.xlsx"
    if not os.path.exists(excel_path):
        print(f"Error: Excel file {excel_path} not found.")
        return
        
    print(f"Reading Excel file: {excel_path}...")
    df = pd.read_excel(excel_path)
    
    # Rename columns to standard, ASCII names to avoid encoding issues
    col_names = [
        'n_item', 'sucursal_name', 'placa', 'cod_patrimonial', 'fecha_ingreso',
        'estado', 'carroceria', 'color', 'marca', 'modelo', 'categoria_licencia',
        'anio_modelo', 'serie_chasis', 'nro_motor', 'tipo_combustible', 'tarjeta_propiedad',
        'vencimiento_soat', 'vigencia_soat', 'periodo_soat', 'vencimiento_rev_tec',
        'vigencia_rev_tec', 'responsable', 'observaciones'
    ]
    df.columns = col_names
    
    print(f"Total rows read from Excel: {len(df)}")
    
    # Counters for generating control assets (starting with 339) per sucursal
    # Format: 339{id_sucursal}{siguiente:03d}
    suc_counters = {1: 1, 10: 1, 20: 1, 30: 1, 40: 1, 41: 1, 50: 1, 51: 1, 60: 1, 62: 1}
    
    cleaned_rows = []
    
    for idx, row in df.iterrows():
        # 1. Sucursal
        suc_name = str(row['sucursal_name']).strip().upper()
        id_sucursal = SUCURSAL_MAPPING.get(suc_name, 1) # Default to 1 (SEDE CENTRAL) if not found
        
        # 2. Code Patrimonial & Control Asset Detection
        cp_val = row['cod_patrimonial']
        is_control = False
        
        if pd.isna(cp_val) or cp_val == 339 or str(cp_val).strip() == '339' or str(cp_val).strip() == '339.0':
            is_control = True
        
        if is_control:
            # Generate code: 339 + sucursal_id (2d) + 4-digit sequence
            next_seq = suc_counters[id_sucursal]
            cod_patrimonial = f"339{id_sucursal:02d}{next_seq:04d}"
            suc_counters[id_sucursal] += 1
        else:
            # Clean normal code: remove decimal point if any
            try:
                cod_patrimonial = str(int(float(cp_val)))
            except (ValueError, TypeError):
                cod_patrimonial = str(cp_val).strip()
                
        # 3. Category & Description
        carroceria = str(row['carroceria']).strip() if pd.notna(row['carroceria']) else ""
        marca = str(row['marca']).strip() if pd.notna(row['marca']) else ""
        modelo = str(row['modelo']).strip() if pd.notna(row['modelo']) else ""
        
        cod_categoria = get_category_id(carroceria)
        
        denominacion_parts = [carroceria, marca, modelo]
        denominacion = " ".join([p for p in denominacion_parts if p]).strip()
        if not denominacion:
            denominacion = "VEHICULO"
        # Truncate if too long (max 300)
        denominacion = denominacion[:300]
        
        # 4. Color, Serie/Chasis, Motor, Tarjeta
        color = str(row['color']).strip() if pd.notna(row['color']) else None
        # Clean double/leading spaces in color
        if color:
            color = " ".join(color.split())
            
        serie_chasis = str(row['serie_chasis']).strip() if pd.notna(row['serie_chasis']) else None
        
        nro_motor = str(row['nro_motor']).strip() if pd.notna(row['nro_motor']) else None
        if nro_motor and nro_motor.upper().startswith("MOTOR:"):
            nro_motor = nro_motor[len("MOTOR:"):].strip()
            
        tarjeta_propiedad = str(row['tarjeta_propiedad']).strip() if pd.notna(row['tarjeta_propiedad']) else None
        # Remove decimal suffix if pandas converted number
        if tarjeta_propiedad and tarjeta_propiedad.endswith(".0"):
            tarjeta_propiedad = tarjeta_propiedad[:-2]
            
        # 5. Placa (NOT NULL UNIQUE in database)
        placa = str(row['placa']).strip().upper() if pd.notna(row['placa']) else ""
        if not placa or placa == "NAN":
            placa = f"SP-{idx:03d}"
            
        # 6. Fuel (Combustible) - check constraint: GASOLINA, DIESEL, GAS, ELECTRICO, HIBRIDO, PETROLEO
        combustible = str(row['tipo_combustible']).strip().upper() if pd.notna(row['tipo_combustible']) else None
        if combustible not in {'GASOLINA', 'DIESEL', 'GAS', 'ELECTRICO', 'HIBRIDO', 'PETROLEO'}:
            combustible = None
            
        # 7. Fabrication Year
        anio_fabricacion = None
        if pd.notna(row['anio_modelo']):
            try:
                anio_fabricacion = int(float(row['anio_modelo']))
            except (ValueError, TypeError):
                pass
                
        # 8. Dates
        fecha_ingreso = parse_date(row['fecha_ingreso'])
        if not fecha_ingreso:
            fecha_ingreso = datetime.date(2025, 1, 1) # Default fallback
            
        vencimiento_rev_tec = parse_date(row['vencimiento_rev_tec'])
        vencimiento_soat = parse_date(row['vencimiento_soat'])
        
        # 9. Active State (dim_estado)
        estado_excel = str(row['estado']).strip().upper() if pd.notna(row['estado']) else "BUENO"
        if estado_excel not in {'BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'}:
            estado_excel = "BUENO"
            
        # 10. Custodian (Personal Responsable)
        cod_personal = find_personal_code(row['observaciones'], row['responsable'], db_personnel)
        
        cleaned_rows.append({
            "cod_patrimonial": cod_patrimonial,
            "id_sucursal": id_sucursal,
            "cod_categoria": cod_categoria,
            "denominacion": denominacion,
            "color": color,
            "marca": marca if marca else None,
            "modelo": modelo if modelo else None,
            "serie_chasis": serie_chasis,
            "nro_motor": nro_motor,
            "tarjeta_propiedad": tarjeta_propiedad,
            "placa": placa,
            "combustible": combustible,
            "anio_fabricacion": anio_fabricacion,
            "fecha_ingreso": fecha_ingreso,
            "vencimiento_rev_tec": vencimiento_rev_tec,
            "vencimiento_soat": vencimiento_soat,
            "estado_activo": estado_excel,
            "cod_personal": cod_personal
        })

    print("Parsed all rows. Ready to execute database transactions...")
    
    async with engine.begin() as conn:
        print("Clearing existing inventory tables...")
        await conn.execute(text("DELETE FROM af.fct_depreciacion_activo"))
        await conn.execute(text("DELETE FROM af.fct_soat"))
        await conn.execute(text("DELETE FROM af.fct_vehiculo_detalle"))
        await conn.execute(text("DELETE FROM af.fct_registro_activos"))
        await conn.execute(text("DELETE FROM af.fct_inventario_fisico"))
        await conn.execute(text("DELETE FROM af.fct_bienes_terceros"))
        await conn.execute(text("DELETE FROM af.fct_compra"))
        await conn.execute(text("DELETE FROM af.fct_incorporacion_af"))
        
        print("Inserting default purchase document ('0000000')...")
        await conn.execute(text("""
            INSERT INTO af.fct_compra 
            (n_doc, fecha_oc, id_localidad, concepto, cuenta_contable) 
            VALUES 
            ('0000000', :fecha, 101, 'REGISTRO VEHICULO MANUAL', '0000000000')
        """), {"fecha": datetime.date(2025, 1, 1)})
        
        print("Inserting vehicles into 'af.fct_registro_activos' and 'af.fct_vehiculo_detalle'...")
        for r in cleaned_rows:
            # 1. fct_registro_activos
            await conn.execute(text("""
                INSERT INTO af.fct_registro_activos 
                (cod_patrimonial, documento_tipo, n_doc_compra, cod_categoria, denominacion, 
                 color, marca, modelo, numero_serie, id_sucursal, cod_personal, 
                 fecha_alta_factura, fecha_registro_contable, valor_en_libros, igv, vida_util_anios, estado_activo) 
                VALUES 
                (:cod_patrimonial, 'COMPRA', '0000000', :cod_categoria, :denominacion, 
                 :color, :marca, :modelo, :serie_chasis, :id_sucursal, :cod_personal, 
                 :fecha_ingreso, :fecha_ingreso, 0, 0, 0, :estado_activo)
            """), {
                "cod_patrimonial": r["cod_patrimonial"],
                "cod_categoria": r["cod_categoria"],
                "denominacion": r["denominacion"],
                "color": r["color"],
                "marca": r["marca"],
                "modelo": r["modelo"],
                "serie_chasis": r["serie_chasis"],
                "id_sucursal": r["id_sucursal"],
                "cod_personal": r["cod_personal"],
                "fecha_ingreso": r["fecha_ingreso"],
                "estado_activo": r["estado_activo"]
            })
            
            # 2. fct_vehiculo_detalle
            await conn.execute(text("""
                INSERT INTO af.fct_vehiculo_detalle 
                (cod_patrimonial, placa, anio_fabricacion, tipo_vehiculo, combustible, 
                 nro_motor, nro_chasis, nro_tarjeta_prop, created_at, updated_at, vencimiento_rev_tec) 
                VALUES 
                (:cod_patrimonial, :placa, :anio_fabricacion, 
                 (SELECT subcategoria FROM af.dim_categoria WHERE cod_categoria = :cod_categoria), 
                 :combustible, :nro_motor, :serie_chasis, :tarjeta_propiedad, now(), now(), :vencimiento_rev_tec)
            """), {
                "cod_patrimonial": r["cod_patrimonial"],
                "placa": r["placa"],
                "anio_fabricacion": r["anio_fabricacion"],
                "cod_categoria": r["cod_categoria"],
                "combustible": r["combustible"],
                "nro_motor": r["nro_motor"],
                "serie_chasis": r["serie_chasis"],
                "tarjeta_propiedad": r["tarjeta_propiedad"],
                "vencimiento_rev_tec": r["vencimiento_rev_tec"]
            })
            
            # 3. fct_soat (only if date is valid)
            if r["vencimiento_soat"]:
                fecha_inicio = r["vencimiento_soat"] - datetime.timedelta(days=365)
                await conn.execute(text("""
                    INSERT INTO af.fct_soat 
                    (cod_patrimonial, numero_poliza, compania_aseguradora, fecha_inicio, fecha_vencimiento, monto, observaciones) 
                    VALUES 
                    (:cod_patrimonial, 'S/N', 'Por definir', :fecha_inicio, :fecha_vencimiento, 0, 'Carga inicial desde excel')
                """), {
                    "cod_patrimonial": r["cod_patrimonial"],
                    "fecha_inicio": fecha_inicio,
                    "fecha_vencimiento": r["vencimiento_soat"]
                })
                
    print("\nDatabase insertion completed successfully!")
    print(f"Total vehicles uploaded: {len(cleaned_rows)}")
    
    # 11. Sincronizar el Dashboard Público
    print("\nTriggering public dashboard static files sync...")
    trigger_sync()

if __name__ == '__main__':
    asyncio.run(main())
