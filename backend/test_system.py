import asyncio
import json
import urllib.request
import urllib.error
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

BACKEND_URL = "http://127.0.0.1:8000"
DB_URL = "postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos"
JSON_PATH = "../public_dashboard/activos.json"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def log_info(msg):
    print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} {msg}")

def log_success(msg):
    print(f"{Colors.OKGREEN}[OK]{Colors.ENDC} {msg}")

def log_error(msg):
    print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {msg}")

def request_json(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
        jsondata = json.dumps(data).encode('utf-8')
    else:
        jsondata = None
        
    try:
        with urllib.request.urlopen(req, data=jsondata, timeout=5) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            err_detail = json.loads(body).get('detail', body)
        except Exception:
            err_detail = body
        raise Exception(f"HTTP Error {e.code}: {err_detail}")
    except Exception as e:
        raise Exception(f"Connection error: {str(e)}")

async def run_tests():
    print(f"{Colors.BOLD}{Colors.HEADER}=== INICIANDO OPTIMIZACIÓN Y PRUEBAS DEL SISTEMA ==={Colors.ENDC}\n")
    
    # 1. Validar conexión directa a la base de datos
    log_info("Paso 1: Validando conexión a PostgreSQL y estructura de tablas...")
    try:
        engine = create_async_engine(DB_URL)
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT version();"))
            ver = res.scalar()
            log_success(f"Conexión a PostgreSQL exitosa: {ver[:50]}...")
            
            # Verificar número de filas de referencia
            sucursales_count = (await conn.execute(text("SELECT COUNT(*) FROM af.dim_sucursal;"))).scalar()
            categorias_count = (await conn.execute(text("SELECT COUNT(*) FROM af.dim_categoria;"))).scalar()
            personal_count = (await conn.execute(text("SELECT COUNT(*) FROM af.dim_personal;"))).scalar()
            log_success(f"Datos semilla cargados: {sucursales_count} sucursales, {categorias_count} categorías, {personal_count} personal.")
            
            if sucursales_count == 0 or categorias_count == 0 or personal_count == 0:
                log_error("Faltan datos de referencia (semilla). Asegúrese de haber ejecutado el seeding.")
                sys.exit(1)
    except Exception as e:
        log_error(f"Fallo al conectar con la base de datos: {str(e)}")
        sys.exit(1)
        
    # 2. Validar que el servidor backend esté en línea
    log_info("Paso 2: Validando que el API backend (FastAPI) esté en línea...")
    try:
        status, res = request_json(f"{BACKEND_URL}/api/health")
        if status == 200 and res.get("status") == "online":
            log_success(f"Backend en línea: {res.get('app')} (v{res.get('documentation')})")
        else:
            log_error(f"Respuesta inesperada del root del backend: {res}")
            sys.exit(1)
    except Exception as e:
        log_error(f"El backend no está accesible en {BACKEND_URL}. ¿Está encendido el servidor? {str(e)}")
        sys.exit(1)

    # 3. Validar listas desplegables del API
    log_info("Paso 3: Validando endpoints de listas desplegables...")
    try:
        _, sucs = request_json(f"{BACKEND_URL}/api/listas/sucursales")
        _, subcats = request_json(f"{BACKEND_URL}/api/listas/subcategorias")
        _, personal = request_json(f"{BACKEND_URL}/api/listas/personal")
        
        log_success(f"Endpoints de listas funcionando. Se obtuvieron {len(sucs)} sucursales, {len(subcats)} subcategorías, {len(personal)} personal responsable.")
    except Exception as e:
        log_error(f"Error al llamar endpoints de listas desplegables: {str(e)}")
        sys.exit(1)

    # 4. Registrar activo fijo de prueba
    log_info("Paso 4: Registrando activo fijo de prueba en la base de datos...")
    test_asset = {
        "cod_patrimonial": "TEST-ACT-9999",
        "documento_tipo": "COMPRA",
        "n_doc_compra": "2510126",
        "cod_categoria": 20001,
        "denominacion": "LAPTOP DE PRUEBA INTEGRACION",
        "color": "Gris",
        "marca": "HP",
        "modelo": "EliteBook",
        "numero_serie": "SER-TEST-9999",
        "caracteristicas_accesorios": "Prueba automática",
        "vida_util_anios": 4,
        "id_sucursal": 1,
        "unidad": "Sistemas",
        "puesto_id": 1,
        "cod_personal": "A001",
        "numero_factura": "F-TEST-9999",
        "fecha_alta_factura": "2026-06-07",
        "fecha_registro_contable": "2026-06-07",
        "fecha_asignacion": "2026-06-07",
        "valor_en_libros": 1200.0,
        "igv": 216.0,
        "n_acta": "099",
        "estado_activo": "BUENO",
        "cuenta_contable": "3341151101",
        "centro_costo": "90133301",
        "compra_cuenta_contable": "3341151101",
        "compra_centro_costo": "90133301",
        "compra_id_localidad": 100
    }
    
    try:
        status, response = request_json(f"{BACKEND_URL}/api/activos", method="POST", data=test_asset)
        if status == 201:
            log_success(f"Activo registrado correctamente. ID: {response.get('cod_patrimonial')}")
            log_success(f"Documento autogenerado en DB (STORED): {response.get('n_doc')}")
            log_success(f"Número de acta autogenerado en DB (STORED): {response.get('n_acta_entrega')}")
        else:
            log_error(f"Fallo al registrar activo. Código de estado: {status}")
            sys.exit(1)
    except Exception as e:
        log_error(f"Fallo al registrar el activo: {str(e)}")
        sys.exit(1)

    # 5. Consultar activos y verificar existencia
    log_info("Paso 5: Validando que el activo registrado aparezca en el inventario...")
    try:
        status, activos = request_json(f"{BACKEND_URL}/api/activos")
        found = any(a.get("cod_patrimonial") == "TEST-ACT-9999" for a in activos)
        if found:
            log_success("El activo de prueba se encuentra listado en el catálogo del inventario.")
        else:
            log_error("El activo de prueba NO se encontró en la lista de inventario.")
            sys.exit(1)
    except Exception as e:
        log_error(f"Error al listar activos: {str(e)}")
        sys.exit(1)

    # 6. Sincronizar el dashboard público (exportar JSON)
    log_info("Paso 6: Sincronizando el dashboard público (generando activos.json)...")
    try:
        status, sync_res = request_json(f"{BACKEND_URL}/api/activos/sincronizar-publico", method="POST")
        if status == 200 and sync_res.get("status") == "success":
            log_success(f"Sincronización exitosa: {sync_res.get('message')}")
        else:
            log_error(f"Fallo en la sincronización: {sync_res}")
            sys.exit(1)
    except Exception as e:
        log_error(f"Error al invocar endpoint de sincronización: {str(e)}")
        sys.exit(1)

    # 7. Validar contenido del archivo JSON físicamente
    log_info("Paso 7: Validando existencia y contenido del archivo de salida...")
    try:
        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            found_in_json = any(item.get("cod_patrimonial") == "TEST-ACT-9999" for item in data)
            if found_in_json:
                log_success(f"El archivo '{JSON_PATH}' es válido y contiene el activo sincronizado.")
            else:
                log_error(f"El archivo '{JSON_PATH}' existe pero NO contiene el activo de prueba.")
                sys.exit(1)
        else:
            log_error(f"El archivo '{JSON_PATH}' no fue creado físicamente.")
            sys.exit(1)
    except Exception as e:
        log_error(f"Error al leer/validar archivo JSON: {str(e)}")
        sys.exit(1)

    # 8. Limpieza de datos
    log_info("Paso 8: Limpiando base de datos (eliminando activo de prueba)...")
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM af.fct_registro_activos WHERE cod_patrimonial = 'TEST-ACT-9999';"))
            log_success("Limpieza completada exitosamente.")
    except Exception as e:
        log_error(f"Fallo al eliminar el activo de prueba: {str(e)}")
        
    print(f"\n{Colors.BOLD}{Colors.OKGREEN}================================================")
    print("¡EL SISTEMA ESTÁ COMPLETAMENTE OPERATIVO!")
    print(f"================================================{Colors.ENDC}\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
