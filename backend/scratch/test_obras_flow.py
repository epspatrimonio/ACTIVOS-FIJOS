import urllib.request
import json
import sys
import random

API_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
        jsondata = json.dumps(data).encode('utf-8')
        req.data = jsondata
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 0, str(e)

def test_flow():
    print("Testing Obras en Curso Flow and Activos Retrieval...")
    
    # 1. Fetch current list of Obras
    status, res = make_request(f"{API_URL}/obras")
    print(f"Fetch Obras list status: {status}")
    if status != 200:
        print(f"Error fetching: {res}")
        sys.exit(1)
    
    # 1.5 Fetch valid lists
    status, subcats = make_request(f"{API_URL}/listas/subcategorias")
    valid_cod_cat = int(subcats[0]['value'])
    status, personal = make_request(f"{API_URL}/listas/personal")
    valid_personal = personal[0]['value']
    status, sucs = make_request(f"{API_URL}/listas/sucursales")
    valid_sucursal = int(sucs[0]['value'])
    status, puestos = make_request(f"{API_URL}/listas/puestos?id_sucursal={valid_sucursal}")
    valid_puesto = int(puestos[0]['value'])
    valid_unidad = puestos[0]['departamento'] or puestos[0]['label']
    
    # 2. Create a new Obra document
    obra_doc_name = f"OBR-2026-TEST{random.randint(100,999)}"
    obra_payload = {
        "n_doc": obra_doc_name,
        "fecha_doc": "2026-07-06",
        "fecha_alta": "2026-07-06",
        "id_localidad": 101,
        "id_fuente": 5,
        "fuente_origen": "LIQ OBRAS",
        "origen": "GOBIERNO REGIONAL",
        "cuenta_contable": "3391010101",
        "centro_costo": "90133301",
        "concepto": "Expediente de prueba de obras"
    }
    
    status, res = make_request(f"{API_URL}/obras", method="POST", data=obra_payload)
    print(f"Create Obra document status: {status}")
    if status not in [200, 201]:
        print(f"Error creating obra: {res}")
        sys.exit(1)
    
    # 3. Create a new asset of type OBRA referencing this document
    asset_cod = f"33900{random.randint(100, 999)}"
    asset_payload = {
        "cod_patrimonial": asset_cod,
        "documento_tipo": "OBRA",
        "n_doc_obra": obra_doc_name,
        "cod_categoria": valid_cod_cat,
        "denominacion": "Vehiculo de obras de prueba",
        "color": "Blanco",
        "marca": "Toyota",
        "modelo": "Hilux",
        "numero_serie": "SERIE12345",
        "caracteristicas_accesorios": "Ninguno",
        "vida_util_anios": 5,
        "id_sucursal": valid_sucursal,
        "unidad": valid_unidad,
        "puesto_id": valid_puesto,
        "cod_personal": valid_personal,
        "numero_factura": "F001-99",
        "fecha_alta_factura": "2026-07-06",
        "fecha_registro_contable": "2026-07-06",
        "fecha_asignacion": "2026-07-06",
        "valor_en_libros": 120000.0,
        "igv": 18.0,
        "informe_conformidad": "INF-001",
        "n_acta": "ACTA-001",
        "estado_activo": "BUENO"
    }
    
    status, res = make_request(f"{API_URL}/activos", method="POST", data=asset_payload)
    print(f"Create Asset status: {status}")
    if status not in [200, 201]:
        print(f"Error creating asset: {res}")
        sys.exit(1)
            
    # 4. Fetch the entire active assets list to verify GET /api/activos is 200
    status, activos = make_request(f"{API_URL}/activos")
    print(f"GET /api/activos list status: {status}")
    if status != 200:
        print(f"Error getting assets list: {activos}")
        sys.exit(1)
    
    # Verify the created asset is in the list
    found = False
    for a in activos:
        if a["cod_patrimonial"] == asset_cod:
            found = True
            print(f"Found created asset in list! Document type: {a['documento_tipo']}, Document name: {a['n_doc']}")
            break
    assert found, "Asset was not found in listing!"
    
    print("Verification successfully completed!")

if __name__ == "__main__":
    test_flow()
