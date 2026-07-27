import asyncio
import httpx

async def test_transferencias_api():
    base_url = "http://127.0.0.1:8000/api"
    async with httpx.AsyncClient() as client:
        # 1. Fetch transferencias list
        r = await client.get(f"{base_url}/activos/transferencias")
        print("GET /activos/transferencias status:", r.status_code)
        if r.status_code == 200:
            print("Current transferencias count:", len(r.json()))
        else:
            print("Error GET:", r.text)

        # 2. Get an active asset to transfer
        r_act = await client.get(f"{base_url}/activos")
        if r_act.status_code == 200 and len(r_act.json()) > 0:
            activo = r_act.json()[0]
            cod_patrimonial = activo.get('cod_patrimonial')
            denominacion = activo.get('denominacion')
            print(f"Selected asset for test transfer: {cod_patrimonial} - {denominacion}")

            # Test creating a transferencia
            payload = {
                "fecha_transferencia": "2026-07-26",
                "cod_patrimonial": cod_patrimonial,
                "denominacion": denominacion,
                "resp_origen": activo.get('responsable') or "SIN ASIGNAR",
                "cargo_origen": activo.get('puesto') or activo.get('unidad') or "—",
                "sucursal_origen": activo.get('sucursal') or "SEDE CENTRAL",
                "resp_destino": "JUAN PEREZ TEST",
                "cargo_destino": "ANALISTA DE PRUEBA",
                "sucursal_destino": "LA MERCED",
                "motivo": "Prueba de transferencia de bien",
                "observaciones": "Registro de prueba via API test script"
            }
            r_create = await client.post(f"{base_url}/activos/transferencias", json=payload)
            print("POST /activos/transferencias status:", r_create.status_code)
            if r_create.status_code == 201:
                created = r_create.json()
                print("Created Transferencia:", created)

                # Test update
                transf_id = created['id']
                update_payload = {"observaciones": "Observación actualizada por test"}
                r_put = await client.put(f"{base_url}/activos/transferencias/{transf_id}", json=update_payload)
                print("PUT /activos/transferencias status:", r_put.status_code)
                if r_put.status_code == 200:
                    print("Updated Transferencia:", r_put.json())
            else:
                print("Error POST:", r_create.text)

if __name__ == "__main__":
    asyncio.run(test_transferencias_api())
