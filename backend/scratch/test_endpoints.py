import httpx
import json

def test_new_endpoints():
    client = httpx.Client(base_url="http://127.0.0.1:8000/api")
    
    print("1. Testing GET /inventario-fisico...")
    r = client.get("/inventario-fisico")
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()[:2]} (truncated)")
    assert r.status_code == 200
    
    print("\n2. Testing GET /bienes-terceros...")
    r = client.get("/bienes-terceros")
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()[:2]} (truncated)")
    assert r.status_code == 200
    
    print("\n3. Testing GET /bienes-terceros/generar-codigo/TERCERO...")
    r = client.get("/bienes-terceros/generar-codigo/TERCERO")
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    assert r.status_code == 200
    ter_code = r.json()["codigo"]
    
    print("\n4. Testing GET /bienes-terceros/generar-codigo/CONTROL...")
    r = client.get("/bienes-terceros/generar-codigo/CONTROL")
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    assert r.status_code == 200
    con_code = r.json()["codigo"]
    
    # Insert a dummy Tercero
    print("\n5. Testing POST /bienes-terceros (TERCERO)...")
    payload = {
        "cod_patrimonial": ter_code,
        "tipo": "TERCERO",
        "denominacion": "TALADRO DE PRUEBA TERCERO",
        "marca": "DEWALT",
        "modelo": "DWD112",
        "numero_serie": "SER-TEST-99",
        "color": "AMARILLO",
        "caracteristicas_accesorios": "Estuche plástico y 3 brocas",
        "cod_personal": "A001",
        "observaciones": "Prueba de registro"
    }
    r = client.post("/bienes-terceros", json=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    assert r.status_code == 201
    
    # Insert a dummy Control
    print("\n6. Testing POST /bienes-terceros (CONTROL)...")
    payload = {
        "cod_patrimonial": con_code,
        "tipo": "CONTROL",
        "denominacion": "HERRAMIENTA MENOR CONTROL INTERNO",
        "marca": "STANLEY",
        "modelo": "ST-99",
        "numero_serie": "SER-CTRL-88",
        "color": "NEGRO",
        "caracteristicas_accesorios": "Juego de llaves mixtas",
        "cod_personal": "A002",
        "observaciones": "Prueba de control"
    }
    r = client.post("/bienes-terceros", json=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    assert r.status_code == 201

    # Cleanup the inserted records
    print(f"\n7. Cleaning up TERCERO {ter_code}...")
    r = client.delete(f"/bienes-terceros/{ter_code}")
    print(f"Status: {r.status_code}")
    assert r.status_code == 204

    print(f"\n8. Cleaning up CONTROL {con_code}...")
    r = client.delete(f"/bienes-terceros/{con_code}")
    print(f"Status: {r.status_code}")
    assert r.status_code == 204

    print("\nAll new endpoints tests passed successfully!")

if __name__ == '__main__':
    test_new_endpoints()
