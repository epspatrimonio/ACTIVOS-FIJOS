import os
import json
import asyncio
import subprocess
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.models.activos import (
    Activo, VwRegistroActivosDetalle,
    VwListaSucursal, VwListaSubcategoria, VwListaPuestoPorSucursal, VwListaPersonal,
    Compra, Incorporacion, Obra, VwListaLocalidad, VwListaCuentaContable, VwListaCentroCosto, VwListaFuente,
    Celular, VwCelularesDetalle,
    VehiculoDetalle,
    Soat, VwSoatVigencia,
    InventarioFisico, VwInventarioFisicoDetalle,
    BienTercero, VwBienesTercerosDetalle,
)
from app.schemas.activos import (
    ActivoCreate, ActivoResponse, ActivoPublicoDTO,
    SucursalDTO, SubcategoriaDTO, PuestoDTO, PersonalDTO,
    LocalidadDTO, CuentaContableDTO, CentroCostoDTO, FuenteDTO,
    CompraCreate, CompraResponse, IncorporacionCreate, IncorporacionResponse,
    ObraCreate, ObraResponse,
    CelularCreate, CelularResponse,
    VehiculoDetalleCreate, VehiculoDetalleResponse,
    SoatCreate, SoatResponse, SoatVigenciaDTO,
    DocumentRename,
    InventarioFisicoCreate, InventarioFisicoResponse,
    BienTerceroCreate, BienTerceroResponse,
)

router = APIRouter()

@router.get("/activos", response_model=List[ActivoResponse])
async def get_activos(
    estado_activo: Optional[str] = None,
    id_sucursal: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene la lista de activos fijos con filtros opcionales por estado de activo y sucursal,
    cargando detalles unidos de dimensiones.
    """
    try:
        query = select(VwRegistroActivosDetalle)
        if estado_activo:
            query = query.where(VwRegistroActivosDetalle.estado_activo == estado_activo)
        if id_sucursal:
            query = query.where(VwRegistroActivosDetalle.id_sucursal == id_sucursal)
            
        result = await db.execute(query)
        activos = result.scalars().all()
        return activos
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener los activos: {str(e)}"
        )


from sqlalchemy import text

def clean_digits(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    cleaned = "".join(filter(str.isdigit, val))
    return cleaned if cleaned else None

async def ensure_cuenta_contable_exists(db: AsyncSession, cuenta: str):
    if not cuenta:
        return
    res = await db.execute(
        text("SELECT 1 FROM af.dim_cuenta_contable WHERE cuenta_contable = :cc"),
        {"cc": cuenta}
    )
    if not res.scalar():
        await db.execute(
            text("INSERT INTO af.dim_cuenta_contable (cuenta_contable, descripcion) VALUES (:cc, :desc)"),
            {"cc": cuenta, "desc": f"Cuenta {cuenta} (10 digitos)"}
        )

async def ensure_centro_costo_exists(db: AsyncSession, cc: str):
    if not cc:
        return
    res = await db.execute(
        text("SELECT 1 FROM af.dim_centro_costo WHERE centro_costo = :cc"),
        {"cc": cc}
    )
    if not res.scalar():
        await db.execute(
            text("INSERT INTO af.dim_centro_costo (centro_costo, descripcion) VALUES (:cc, :desc)"),
            {"cc": cc, "desc": f"Centro Costo {cc} (8 digitos)"}
        )

async def upsert_acquisition_document(db: AsyncSession, activo_in: ActivoCreate):
    if activo_in.documento_tipo == "COMPRA":
        n_doc_clean = clean_digits(activo_in.n_doc_compra)
        if not n_doc_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="N° Doc Compra es requerido para Tipo de Adquisición COMPRA."
            )
        if len(n_doc_clean) != 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El N° Documento de la orden de compra debe tener exactamente 7 dígitos."
            )
        activo_in.n_doc_compra = n_doc_clean

        # Primero buscamos si ya existe el documento
        result = await db.execute(select(Compra).where(Compra.n_doc == n_doc_clean))
        db_compra = result.scalar_one_or_none()

        np_clean = clean_digits(activo_in.compra_nota_pedido)
        if np_clean:
            if len(np_clean) > 7:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Nota de Pedido no debe tener más de 7 dígitos."
                )
        activo_in.compra_nota_pedido = np_clean

        cert_clean = clean_digits(activo_in.compra_certificacion_presupuestal)
        if cert_clean:
            if len(cert_clean) < 4:
                cert_clean = cert_clean.zfill(4)
        activo_in.compra_certificacion_presupuestal = cert_clean

        cuenta_clean = clean_digits(activo_in.compra_cuenta_contable)
        if not cuenta_clean:
            if not db_compra:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable es requerida."
                )
            else:
                cuenta_clean = db_compra.cuenta_contable
        else:
            if len(cuenta_clean) != 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable debe tener exactamente 10 dígitos."
                )
            activo_in.compra_cuenta_contable = cuenta_clean
            await ensure_cuenta_contable_exists(db, cuenta_clean)

        cc_clean = clean_digits(activo_in.compra_centro_costo)
        if cc_clean:
            if len(cc_clean) != 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El Centro de Costo debe tener exactamente 8 dígitos."
                )
            activo_in.compra_centro_costo = cc_clean
            await ensure_centro_costo_exists(db, cc_clean)
        elif db_compra:
            cc_clean = db_compra.centro_costo

        c_cont_3 = cuenta_clean[:3] if cuenta_clean else None

        if db_compra:
            db_compra.fecha_oc = activo_in.compra_fecha_oc or db_compra.fecha_oc
            db_compra.id_localidad = activo_in.compra_id_localidad or db_compra.id_localidad
            db_compra.nota_pedido = np_clean or db_compra.nota_pedido
            db_compra.certificacion_presupuestal = cert_clean or db_compra.certificacion_presupuestal
            db_compra.c_cont_3 = c_cont_3 or db_compra.c_cont_3
            db_compra.cuenta_contable = cuenta_clean or db_compra.cuenta_contable
            db_compra.centro_costo = cc_clean or db_compra.centro_costo
            db_compra.id_fuente = activo_in.compra_id_fuente or db_compra.id_fuente
            db_compra.requerido_por = activo_in.compra_requerido_por or db_compra.requerido_por
            db_compra.concepto = activo_in.compra_concepto or db_compra.concepto
        else:
            db_compra = Compra(
                n_doc=n_doc_clean,
                fecha_oc=activo_in.compra_fecha_oc,
                id_localidad=activo_in.compra_id_localidad or 1,
                nota_pedido=np_clean,
                certificacion_presupuestal=cert_clean,
                c_cont_3=c_cont_3,
                cuenta_contable=cuenta_clean,
                centro_costo=cc_clean,
                id_fuente=activo_in.compra_id_fuente,
                requerido_por=activo_in.compra_requerido_por,
                concepto=activo_in.compra_concepto
            )
            db.add(db_compra)
            
    elif activo_in.documento_tipo == "INCORPORACION":
        n_doc_clean = activo_in.n_doc_incorporacion.strip() if activo_in.n_doc_incorporacion else None
        if not n_doc_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="N° Doc Incorporación es requerido para Tipo de Adquisición INCORPORACION."
            )
        if len(n_doc_clean) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El N° Expediente de Incorporación no debe exceder los 30 caracteres."
            )
        activo_in.n_doc_incorporacion = n_doc_clean

        # Buscar si ya existe el documento
        result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == n_doc_clean))
        db_inc = result.scalar_one_or_none()

        cuenta_clean = clean_digits(activo_in.inc_cuenta_contable)
        if not cuenta_clean:
            if not db_inc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable es requerida."
                )
            else:
                cuenta_clean = db_inc.cuenta_contable
        else:
            if len(cuenta_clean) != 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable debe tener exactamente 10 dígitos."
                )
            activo_in.inc_cuenta_contable = cuenta_clean
            await ensure_cuenta_contable_exists(db, cuenta_clean)

        cc_clean = clean_digits(activo_in.inc_centro_costo)
        if cc_clean:
            if len(cc_clean) != 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El Centro de Costo debe tener exactamente 8 dígitos."
                )
            activo_in.inc_centro_costo = cc_clean
            await ensure_centro_costo_exists(db, cc_clean)
        elif db_inc:
            cc_clean = db_inc.centro_costo
            
        if db_inc:
            db_inc.fecha_doc = activo_in.inc_fecha_doc or db_inc.fecha_doc
            db_inc.id_localidad = activo_in.inc_id_localidad or db_inc.id_localidad
            db_inc.cuenta_contable = cuenta_clean or db_inc.cuenta_contable
            db_inc.centro_costo = cc_clean or db_inc.centro_costo
            db_inc.id_fuente = activo_in.inc_id_fuente or db_inc.id_fuente
            db_inc.fuente_origen = activo_in.inc_fuente_origen or db_inc.fuente_origen
            db_inc.origen = activo_in.inc_origen or db_inc.origen
            db_inc.fecha_alta = activo_in.inc_fecha_alta or db_inc.fecha_alta
            db_inc.concepto = activo_in.inc_concepto or db_inc.concepto
        else:
            db_inc = Incorporacion(
                n_doc=n_doc_clean,
                fecha_doc=activo_in.inc_fecha_doc,
                id_localidad=activo_in.inc_id_localidad or 1,
                cuenta_contable=cuenta_clean,
                centro_costo=cc_clean,
                id_fuente=activo_in.inc_id_fuente,
                fuente_origen=activo_in.inc_fuente_origen,
                origen=activo_in.inc_origen,
                fecha_alta=activo_in.inc_fecha_alta,
                concepto=activo_in.inc_concepto
            )
            db.add(db_inc)
            
    elif activo_in.documento_tipo == "OBRA":
        n_doc_clean = activo_in.n_doc_obra.strip() if activo_in.n_doc_obra else None
        if not n_doc_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="N° Doc Obra es requerido para Tipo de Adquisición OBRA."
            )
        if len(n_doc_clean) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El N° Expediente de Obra no debe exceder los 30 caracteres."
            )
        activo_in.n_doc_obra = n_doc_clean

        # Buscar si ya existe el documento
        result = await db.execute(select(Obra).where(Obra.n_doc == n_doc_clean))
        db_obra = result.scalar_one_or_none()

        cuenta_clean = clean_digits(activo_in.obra_cuenta_contable)
        if not cuenta_clean:
            if not db_obra:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable es requerida."
                )
            else:
                cuenta_clean = db_obra.cuenta_contable
        else:
            if len(cuenta_clean) != 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La Cuenta Contable debe tener exactamente 10 dígitos."
                )
            activo_in.obra_cuenta_contable = cuenta_clean
            await ensure_cuenta_contable_exists(db, cuenta_clean)

        cc_clean = clean_digits(activo_in.obra_centro_costo)
        if cc_clean:
            if len(cc_clean) != 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El Centro de Costo debe tener exactamente 8 dígitos."
                )
            activo_in.obra_centro_costo = cc_clean
            await ensure_centro_costo_exists(db, cc_clean)
        elif db_obra:
            cc_clean = db_obra.centro_costo
            
        if db_obra:
            db_obra.fecha_doc = activo_in.obra_fecha_doc or db_obra.fecha_doc
            db_obra.id_localidad = activo_in.obra_id_localidad or db_obra.id_localidad
            db_obra.cuenta_contable = cuenta_clean or db_obra.cuenta_contable
            db_obra.centro_costo = cc_clean or db_obra.centro_costo
            db_obra.id_fuente = activo_in.obra_id_fuente or db_obra.id_fuente
            db_obra.fuente_origen = activo_in.obra_fuente_origen or db_obra.fuente_origen
            db_obra.origen = activo_in.obra_origen or db_obra.origen
            db_obra.fecha_alta = activo_in.obra_fecha_alta or db_obra.fecha_alta
            db_obra.concepto = activo_in.obra_concepto or db_obra.concepto
        else:
            db_obra = Obra(
                n_doc=n_doc_clean,
                fecha_doc=activo_in.obra_fecha_doc,
                id_localidad=activo_in.obra_id_localidad or 1,
                cuenta_contable=cuenta_clean,
                centro_costo=cc_clean,
                id_fuente=activo_in.obra_id_fuente,
                fuente_origen=activo_in.obra_fuente_origen,
                origen=activo_in.obra_origen,
                fecha_alta=activo_in.obra_fecha_alta,
                concepto=activo_in.obra_concepto
            )
            db.add(db_obra)


def clean_db_error_message(e: Exception) -> str:
    err_str = str(e)
    if "fct_registro_activos_id_sucursal_fkey" in err_str:
        return "La sucursal seleccionada no existe en la base de datos o es inválida."
    if "fct_registro_activos_cod_categoria_fkey" in err_str:
        return "La subcategoría seleccionada no existe en la base de datos o es inválida."
    if "fct_registro_activos_puesto_id_fkey" in err_str:
        return "El puesto seleccionado no existe en la base de datos."
    if "fct_registro_activos_cod_personal_fkey" in err_str:
        return "El personal responsable seleccionado no existe en la base de datos."
    if "fct_vehiculo_detalle_placa_key" in err_str or ("placa" in err_str and "duplicate key" in err_str.lower()):
        return "La placa ingresada ya está registrada para otro vehículo."
    if "duplicate key" in err_str.lower() or "llave duplicada" in err_str.lower():
        return "El código patrimonial ingresado ya está registrado para otro activo."
    
    import re
    match = re.search(r"DETAIL:\s*(.+)", err_str)
    if match:
        return f"Error de restricciones e integridad de datos: {match.group(1)}"
    return f"Error de integridad en los datos: {err_str}"


@router.post("/activos", response_model=ActivoResponse, status_code=status.HTTP_201_CREATED)
async def create_activo(
    activo_in: ActivoCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra un nuevo activo fijo en af.fct_registro_activos.
    """
    db_activo_check = await db.get(Activo, activo_in.cod_patrimonial)
    if db_activo_check:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El activo con código patrimonial '{activo_in.cod_patrimonial}' ya existe."
        )
        
    await upsert_acquisition_document(db, activo_in)
    await db.flush()
    
    activo_data = activo_in.model_dump()
    for field in list(activo_data.keys()):
        if field.startswith("compra_") or field.startswith("inc_") or field.startswith("obra_"):
            del activo_data[field]
            
    db_activo = Activo(**activo_data)
    db.add(db_activo)
    try:
        await db.commit()
        await db.refresh(db_activo)
        return db_activo
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar el activo: {clean_db_error_message(e)}"
        )


@router.put("/activos/{cod_patrimonial}", response_model=ActivoResponse)
async def update_activo(
    cod_patrimonial: str,
    activo_in: ActivoCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza los datos de un activo fijo existente por su código patrimonial.
    """
    db_activo = await db.get(Activo, cod_patrimonial)
    if not db_activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El activo con código patrimonial '{cod_patrimonial}' no existe."
        )
        
    await upsert_acquisition_document(db, activo_in)
    await db.flush()
    
    update_data = activo_in.model_dump(exclude_unset=True)
    for field in list(update_data.keys()):
        if field.startswith("compra_") or field.startswith("inc_") or field.startswith("obra_"):
            del update_data[field]
            
    for field, value in update_data.items():
        setattr(db_activo, field, value)
        
    try:
        await db.commit()
        await db.refresh(db_activo)
        return db_activo
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al actualizar el activo: {clean_db_error_message(e)}"
        )


@router.delete("/activos/{cod_patrimonial}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activo(
    cod_patrimonial: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina un activo fijo de la base de datos por su código patrimonial.
    """
    db_activo = await db.get(Activo, cod_patrimonial)
    if not db_activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El activo con código patrimonial '{cod_patrimonial}' no existe."
        )
    try:
        await db.delete(db_activo)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al eliminar el activo: {str(e)}"
        )


@router.post("/activos/sincronizar-publico", status_code=status.HTTP_200_OK)
async def sincronizar_publico(db: AsyncSession = Depends(get_db)):
    """
    Consulta la vista af.vw_registro_activos_detalle y af.vw_celulares_detalle,
    mapea a sus DTOs correspondientes, exporta físicamente los archivos JSON,
    y sincroniza automáticamente con GitHub.
    """
    try:
        # 1. Consultar y serializar activos (incluyendo vehículos)
        query = select(VwRegistroActivosDetalle)
        result = await db.execute(query)
        items = result.scalars().all()
        
        serialized_data = [
            ActivoPublicoDTO.model_validate(item).model_dump(mode="json") 
            for item in items
        ]
        
        # 2. Consultar y serializar celulares
        cel_query = select(VwCelularesDetalle)
        cel_result = await db.execute(cel_query)
        cel_items = cel_result.scalars().all()
        
        serialized_celulares = [
            CelularResponse.model_validate(item).model_dump(mode="json")
            for item in cel_items
        ]
        
        # 3. Consultar y serializar inventario físico (faltantes y sobrantes)
        inv_query = select(VwInventarioFisicoDetalle)
        inv_result = await db.execute(inv_query)
        inv_items = inv_result.scalars().all()
        
        serialized_inv = [
            InventarioFisicoResponse.model_validate(item).model_dump(mode="json")
            for item in inv_items
        ]
        
        # 4. Consultar y serializar bienes de terceros y control
        ter_query = select(VwBienesTercerosDetalle)
        ter_result = await db.execute(ter_query)
        ter_items = ter_result.scalars().all()
        
        serialized_ter = [
            BienTerceroResponse.model_validate(item).model_dump(mode="json")
            for item in ter_items
        ]
        
        # Obtener ruta física del config
        export_path = settings.PUBLIC_EXPORT_PATH
        dir_name = os.path.dirname(export_path)
        cel_export_path = os.path.join(dir_name, "celulares.json")
        inv_export_path = os.path.join(dir_name, "inventario_fisico.json")
        ter_export_path = os.path.join(dir_name, "bienes_terceros.json")
        
        # Crear directorios si no existen
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
            
        # Escribir físicamente los JSONs sin bloquear el event loop
        def save_files():
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(serialized_data, f, ensure_ascii=False, indent=2)
            with open(cel_export_path, "w", encoding="utf-8") as f:
                json.dump(serialized_celulares, f, ensure_ascii=False, indent=2)
            with open(inv_export_path, "w", encoding="utf-8") as f:
                json.dump(serialized_inv, f, ensure_ascii=False, indent=2)
            with open(ter_export_path, "w", encoding="utf-8") as f:
                json.dump(serialized_ter, f, ensure_ascii=False, indent=2)
        await asyncio.to_thread(save_files)
        
        # Sincronización automática con Git/GitHub
        git_status = None
        def git_sync():
            try:
                # El repositorio git está en public_dir
                public_dir = dir_name
                if not os.path.exists(os.path.join(public_dir, ".git")):
                    return {"status": "skipped", "message": "No se detectó repositorio Git en la carpeta del dashboard."}
                
                # Configurar entorno para evitar prompts interactivos que congelen el proceso
                env = os.environ.copy()
                env["GIT_TERMINAL_PROMPT"] = "0"
                
                # 1. Comprobar si hay cambios
                status_res = subprocess.run(
                    ["git", "status", "--porcelain"],
                    cwd=public_dir,
                    capture_output=True,
                    text=True,
                    check=True,
                    env=env
                )
                if not status_res.stdout.strip():
                    return {"status": "skipped", "message": "El dashboard ya está al día. No hay cambios pendientes."}
                
                # 2. git add -A
                subprocess.run(
                    ["git", "add", "-A"],
                    cwd=public_dir,
                    check=True,
                    capture_output=True,
                    env=env
                )
                
                # 3. git commit -m "Sincronización automática de activos y celulares"
                subprocess.run(
                    ["git", "commit", "-m", "Sincronización automática de activos y celulares"],
                    cwd=public_dir,
                    check=True,
                    capture_output=True,
                    env=env
                )
                
                # 4. git push origin main
                push_res = subprocess.run(
                    ["git", "push", "origin", "main"],
                    cwd=public_dir,
                    check=True,
                    capture_output=True,
                    text=True,
                    env=env
                )
                return {
                    "status": "success",
                    "message": "Cambios subidos a GitHub correctamente.",
                    "detail": (push_res.stderr or push_res.stdout or "").strip()
                }
            except subprocess.CalledProcessError as e:
                return {
                    "status": "error",
                    "message": "Fallo al ejecutar comandos de Git.",
                    "detail": (e.stderr or e.stdout or str(e)).strip()
                }
            except Exception as ex:
                return {
                    "status": "error",
                    "message": "Error inesperado durante la sincronización Git.",
                    "detail": str(ex)
                }

        git_status = await asyncio.to_thread(git_sync)
            
        return {
            "status": "success",
            "message": f"Sincronización completada exitosamente. Se exportaron {len(serialized_data)} activos y {len(serialized_celulares)} celulares.",
            "export_path": export_path,
            "total_records": len(serialized_data),
            "total_celulares": len(serialized_celulares),
            "git_sync": git_status
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante el proceso de exportación y sincronización: {str(e)}"
        )


# ── Endpoints de listas de dimensiones (para selectores del formulario) ──────

@router.get("/listas/sucursales", response_model=List[SucursalDTO], tags=["Listas"])
async def get_lista_sucursales(db: AsyncSession = Depends(get_db)):
    """Retorna las sucursales activas desde vw_lista_sucursal."""
    try:
        result = await db.execute(select(VwListaSucursal))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/subcategorias", response_model=List[SubcategoriaDTO], tags=["Listas"])
async def get_lista_subcategorias(db: AsyncSession = Depends(get_db)):
    """Retorna las subcategorías activas desde vw_lista_subcategoria."""
    try:
        result = await db.execute(select(VwListaSubcategoria))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/puestos", response_model=List[PuestoDTO], tags=["Listas"])
async def get_lista_puestos(
    id_sucursal: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retorna los puestos activos, filtrados opcionalmente por id_sucursal."""
    try:
        query = select(VwListaPuestoPorSucursal)
        if id_sucursal:
            query = query.where(VwListaPuestoPorSucursal.id_sucursal == id_sucursal)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/personal", response_model=List[PersonalDTO], tags=["Listas"])
async def get_lista_personal(db: AsyncSession = Depends(get_db)):
    """Retorna el personal activo desde vw_lista_personal."""
    try:
        result = await db.execute(select(VwListaPersonal))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/localidades", response_model=List[LocalidadDTO], tags=["Listas"])
async def get_lista_localidades(db: AsyncSession = Depends(get_db)):
    """Retorna las localidades seleccionables ordenadas por id_localidad.
    Excluye SELVA CENTRAL (usada como agrupador), SIN ASIGNAR y RETIRADAS.
    """
    try:
        result = await db.execute(
            select(VwListaLocalidad).order_by(VwListaLocalidad.value)
        )
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/cuentas-contables", response_model=List[CuentaContableDTO], tags=["Listas"])
async def get_lista_cuentas_contables(db: AsyncSession = Depends(get_db)):
    """Retorna las cuentas contables desde vw_lista_cuenta_contable."""
    try:
        result = await db.execute(select(VwListaCuentaContable))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/centros-costo", response_model=List[CentroCostoDTO], tags=["Listas"])
async def get_lista_centros_costo(db: AsyncSession = Depends(get_db)):
    """Retorna los centros de costo desde vw_lista_centro_costo."""
    try:
        result = await db.execute(select(VwListaCentroCosto))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listas/fuentes", response_model=List[FuenteDTO], tags=["Listas"])
async def get_lista_fuentes(db: AsyncSession = Depends(get_db)):
    """Retorna las fuentes de financiamiento desde vw_lista_fuente."""
    try:
        result = await db.execute(select(VwListaFuente))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compras", response_model=List[CompraResponse], tags=["Documentos"])
async def get_compras(db: AsyncSession = Depends(get_db)):
    """Obtiene la lista de todos los expedientes de compra registrados."""
    try:
        result = await db.execute(select(Compra).order_by(Compra.n_doc))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compras", response_model=CompraResponse, tags=["Documentos"])
async def create_compra(compra_in: CompraCreate, db: AsyncSession = Depends(get_db)):
    """Registra o actualiza un expediente de compra directamente."""
    n_doc_clean = clean_digits(compra_in.n_doc)
    if not n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(n_doc_clean) != 7:
        raise HTTPException(status_code=400, detail="El N° Documento de Orden de Compra debe tener exactamente 7 dígitos.")
    compra_in.n_doc = n_doc_clean

    np_clean = clean_digits(compra_in.nota_pedido)
    if np_clean:
        if len(np_clean) > 7:
            raise HTTPException(status_code=400, detail="La Nota de Pedido no debe tener más de 7 dígitos.")
    compra_in.nota_pedido = np_clean

    cert_clean = clean_digits(compra_in.certificacion_presupuestal)
    if cert_clean:
        if len(cert_clean) < 4:
            cert_clean = cert_clean.zfill(4)
    compra_in.certificacion_presupuestal = cert_clean

    cuenta_clean = clean_digits(compra_in.cuenta_contable)
    if not cuenta_clean:
        raise HTTPException(status_code=400, detail="La Cuenta Contable es obligatoria.")
    if len(cuenta_clean) != 10:
        raise HTTPException(status_code=400, detail="La Cuenta Contable debe tener exactamente 10 dígitos.")
    compra_in.cuenta_contable = cuenta_clean
    await ensure_cuenta_contable_exists(db, cuenta_clean)

    cc_clean = clean_digits(compra_in.centro_costo)
    if cc_clean:
        if len(cc_clean) != 8:
            raise HTTPException(status_code=400, detail="El Centro de Costo debe tener exactamente 8 dígitos.")
        compra_in.centro_costo = cc_clean
        await ensure_centro_costo_exists(db, cc_clean)

    result = await db.execute(select(Compra).where(Compra.n_doc == n_doc_clean))
    db_compra = result.scalar_one_or_none()
    
    c_cont_3 = cuenta_clean[:3]

    if db_compra:
        db_compra.fecha_oc = compra_in.fecha_oc
        db_compra.id_localidad = compra_in.id_localidad
        db_compra.nota_pedido = np_clean
        db_compra.certificacion_presupuestal = cert_clean
        db_compra.c_cont_3 = c_cont_3
        db_compra.cuenta_contable = cuenta_clean
        db_compra.centro_costo = cc_clean
        db_compra.id_fuente = compra_in.id_fuente
        db_compra.requerido_por = compra_in.requerido_por
        db_compra.concepto = compra_in.concepto
    else:
        db_compra = Compra(
            n_doc=n_doc_clean,
            fecha_oc=compra_in.fecha_oc,
            id_localidad=compra_in.id_localidad,
            nota_pedido=np_clean,
            certificacion_presupuestal=cert_clean,
            c_cont_3=c_cont_3,
            cuenta_contable=cuenta_clean,
            centro_costo=cc_clean,
            id_fuente=compra_in.id_fuente,
            requerido_por=compra_in.requerido_por,
            concepto=compra_in.concepto
        )
        db.add(db_compra)
        
    try:
        await db.commit()
        await db.refresh(db_compra)
        return db_compra
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar la compra: {str(e)}")


@router.get("/compras/{n_doc}", tags=["Documentos"])
async def get_compra(n_doc: str, db: AsyncSession = Depends(get_db)):
    """Busca un expediente de compra por su número de documento."""
    result = await db.execute(select(Compra).where(Compra.n_doc == n_doc))
    db_compra = result.scalar_one_or_none()
    if not db_compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada.")
    return db_compra


@router.put("/compras/{n_doc}/rename", response_model=CompraResponse, tags=["Documentos"])
async def rename_compra(n_doc: str, rename_in: DocumentRename, db: AsyncSession = Depends(get_db)):
    """Renombra un expediente de compra modificando su clave primaria y propagando a activos fijos."""
    result = await db.execute(select(Compra).where(Compra.n_doc == n_doc))
    db_compra = result.scalar_one_or_none()
    if not db_compra:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada.")

    new_n_doc_clean = clean_digits(rename_in.new_n_doc)
    if not new_n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(new_n_doc_clean) != 7:
        raise HTTPException(status_code=400, detail="El nuevo N° Documento de Orden de Compra debe tener exactamente 7 dígitos.")

    if new_n_doc_clean == n_doc:
        return db_compra

    exist_result = await db.execute(select(Compra).where(Compra.n_doc == new_n_doc_clean))
    if exist_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe otra orden de compra con el nuevo número de documento.")

    try:
        await db.execute(
            text("UPDATE af.fct_compra SET n_doc = :new_doc WHERE n_doc = :old_doc"),
            {"new_doc": new_n_doc_clean, "old_doc": n_doc}
        )
        await db.commit()
        new_result = await db.execute(select(Compra).where(Compra.n_doc == new_n_doc_clean))
        return new_result.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al renombrar la orden de compra: {str(e)}")


@router.get("/incorporaciones", response_model=List[IncorporacionResponse], tags=["Documentos"])
async def get_incorporaciones(db: AsyncSession = Depends(get_db)):
    """Obtiene la lista de todas las incorporaciones registradas."""
    try:
        result = await db.execute(select(Incorporacion).order_by(Incorporacion.n_doc))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/incorporaciones", response_model=IncorporacionResponse, tags=["Documentos"])
async def create_incorporacion(inc_in: IncorporacionCreate, db: AsyncSession = Depends(get_db)):
    """Registra o actualiza una incorporación directamente."""
    n_doc_clean = inc_in.n_doc.strip() if inc_in.n_doc else None
    if not n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(n_doc_clean) > 30:
        raise HTTPException(status_code=400, detail="El N° Expediente de Incorporación no debe exceder los 30 caracteres.")
    inc_in.n_doc = n_doc_clean

    cuenta_clean = clean_digits(inc_in.cuenta_contable)
    if not cuenta_clean:
        raise HTTPException(status_code=400, detail="La Cuenta Contable es obligatoria.")
    if len(cuenta_clean) != 10:
        raise HTTPException(status_code=400, detail="La Cuenta Contable debe tener exactamente 10 dígitos.")
    inc_in.cuenta_contable = cuenta_clean
    await ensure_cuenta_contable_exists(db, cuenta_clean)

    cc_clean = clean_digits(inc_in.centro_costo)
    if cc_clean:
        if len(cc_clean) != 8:
            raise HTTPException(status_code=400, detail="El Centro de Costo debe tener exactamente 8 dígitos.")
        inc_in.centro_costo = cc_clean
        await ensure_centro_costo_exists(db, cc_clean)
        
    result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == n_doc_clean))
    db_inc = result.scalar_one_or_none()
    
    if db_inc:
        db_inc.fecha_doc = inc_in.fecha_doc
        db_inc.id_localidad = inc_in.id_localidad
        db_inc.cuenta_contable = cuenta_clean
        db_inc.centro_costo = cc_clean
        db_inc.id_fuente = inc_in.id_fuente
        db_inc.fuente_origen = inc_in.fuente_origen
        db_inc.origen = inc_in.origen
        db_inc.fecha_alta = inc_in.fecha_alta
        db_inc.concepto = inc_in.concepto
    else:
        db_inc = Incorporacion(
            n_doc=n_doc_clean,
            fecha_doc=inc_in.fecha_doc,
            id_localidad=inc_in.id_localidad,
            cuenta_contable=cuenta_clean,
            centro_costo=cc_clean,
            id_fuente=inc_in.id_fuente,
            fuente_origen=inc_in.fuente_origen,
            origen=inc_in.origen,
            fecha_alta=inc_in.fecha_alta,
            concepto=inc_in.concepto
        )
        db.add(db_inc)
        
    try:
        await db.commit()
        await db.refresh(db_inc)
        return db_inc
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar la incorporación: {str(e)}")


@router.get("/incorporaciones/{n_doc}", tags=["Documentos"])
async def get_incorporacion(n_doc: str, db: AsyncSession = Depends(get_db)):
    """Busca un documento de incorporación por su número de documento."""
    result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == n_doc))
    db_inc = result.scalar_one_or_none()
    if not db_inc:
        raise HTTPException(status_code=404, detail="Incorporación no encontrada.")
    return db_inc


@router.put("/incorporaciones/{n_doc}/rename", response_model=IncorporacionResponse, tags=["Documentos"])
async def rename_incorporacion(n_doc: str, rename_in: DocumentRename, db: AsyncSession = Depends(get_db)):
    """Renombra un expediente de incorporación modificando su clave primaria y propagando a activos fijos."""
    result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == n_doc))
    db_inc = result.scalar_one_or_none()
    if not db_inc:
        raise HTTPException(status_code=404, detail="Resolución de incorporación no encontrada.")

    new_n_doc_clean = rename_in.new_n_doc.strip() if rename_in.new_n_doc else None
    if not new_n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(new_n_doc_clean) > 30:
        raise HTTPException(status_code=400, detail="El nuevo N° Expediente de Incorporación no debe exceder los 30 caracteres.")

    if new_n_doc_clean == n_doc:
        return db_inc

    exist_result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == new_n_doc_clean))
    if exist_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe otra resolución de incorporación con el nuevo número de documento.")

    try:
        await db.execute(
            text("UPDATE af.fct_incorporacion_af SET n_doc = :new_doc WHERE n_doc = :old_doc"),
            {"new_doc": new_n_doc_clean, "old_doc": n_doc}
        )
        await db.commit()
        new_result = await db.execute(select(Incorporacion).where(Incorporacion.n_doc == new_n_doc_clean))
        return new_result.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al renombrar la resolución de incorporación: {str(e)}")


@router.get("/obras", response_model=List[ObraResponse], tags=["Documentos"])
async def get_obras(db: AsyncSession = Depends(get_db)):
    """Obtiene la lista de todas las obras en curso registradas."""
    try:
        result = await db.execute(select(Obra).order_by(Obra.n_doc))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/obras", response_model=ObraResponse, tags=["Documentos"])
async def create_obra(obra_in: ObraCreate, db: AsyncSession = Depends(get_db)):
    """Registra o actualiza una obra en curso directamente."""
    n_doc_clean = obra_in.n_doc.strip() if obra_in.n_doc else None
    if not n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(n_doc_clean) > 30:
        raise HTTPException(status_code=400, detail="El N° Expediente de Obra no debe exceder los 30 caracteres.")
    obra_in.n_doc = n_doc_clean

    cuenta_clean = clean_digits(obra_in.cuenta_contable)
    if not cuenta_clean:
        raise HTTPException(status_code=400, detail="La Cuenta Contable es obligatoria.")
    if len(cuenta_clean) != 10:
        raise HTTPException(status_code=400, detail="La Cuenta Contable debe tener exactamente 10 dígitos.")
    obra_in.cuenta_contable = cuenta_clean
    await ensure_cuenta_contable_exists(db, cuenta_clean)

    cc_clean = clean_digits(obra_in.centro_costo)
    if cc_clean:
        if len(cc_clean) != 8:
            raise HTTPException(status_code=400, detail="El Centro de Costo debe tener exactamente 8 dígitos.")
        obra_in.centro_costo = cc_clean
        await ensure_centro_costo_exists(db, cc_clean)
        
    result = await db.execute(select(Obra).where(Obra.n_doc == n_doc_clean))
    db_obra = result.scalar_one_or_none()
    
    if db_obra:
        db_obra.fecha_doc = obra_in.fecha_doc
        db_obra.id_localidad = obra_in.id_localidad
        db_obra.cuenta_contable = cuenta_clean
        db_obra.centro_costo = cc_clean
        db_obra.id_fuente = obra_in.id_fuente
        db_obra.fuente_origen = obra_in.fuente_origen
        db_obra.origen = obra_in.origen
        db_obra.fecha_alta = obra_in.fecha_alta
        db_obra.concepto = obra_in.concepto
    else:
        db_obra = Obra(
            n_doc=n_doc_clean,
            fecha_doc=obra_in.fecha_doc,
            id_localidad=obra_in.id_localidad,
            cuenta_contable=cuenta_clean,
            centro_costo=cc_clean,
            id_fuente=obra_in.id_fuente,
            fuente_origen=obra_in.fuente_origen,
            origen=obra_in.origen,
            fecha_alta=obra_in.fecha_alta,
            concepto=obra_in.concepto
        )
        db.add(db_obra)
        
    try:
        await db.commit()
        await db.refresh(db_obra)
        return db_obra
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar el expediente de obra: {str(e)}")


@router.get("/obras/{n_doc}", tags=["Documentos"])
async def get_obra(n_doc: str, db: AsyncSession = Depends(get_db)):
    """Busca un expediente de obra en curso por su número de documento."""
    result = await db.execute(select(Obra).where(Obra.n_doc == n_doc))
    db_obra = result.scalar_one_or_none()
    if not db_obra:
        raise HTTPException(status_code=404, detail="Expediente de obra no encontrado.")
    return db_obra


@router.put("/obras/{n_doc}/rename", response_model=ObraResponse, tags=["Documentos"])
async def rename_obra(n_doc: str, rename_in: DocumentRename, db: AsyncSession = Depends(get_db)):
    """Renombra un expediente de obra modificando su clave primaria y propagando a activos fijos."""
    result = await db.execute(select(Obra).where(Obra.n_doc == n_doc))
    db_obra = result.scalar_one_or_none()
    if not db_obra:
        raise HTTPException(status_code=404, detail="Expediente de obra no encontrado.")

    new_n_doc_clean = rename_in.new_n_doc.strip() if rename_in.new_n_doc else None
    if not new_n_doc_clean:
        raise HTTPException(status_code=400, detail="El número de documento es obligatorio.")
    if len(new_n_doc_clean) > 30:
        raise HTTPException(status_code=400, detail="El nuevo N° Expediente de Obra no debe exceder los 30 caracteres.")

    if new_n_doc_clean == n_doc:
        return db_obra

    exist_result = await db.execute(select(Obra).where(Obra.n_doc == new_n_doc_clean))
    if exist_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe otro expediente de obra con el nuevo número de documento.")

    try:
        await db.execute(
            text("UPDATE af.fct_obra SET n_doc = :new_doc WHERE n_doc = :old_doc"),
            {"new_doc": new_n_doc_clean, "old_doc": n_doc}
        )
        await db.commit()
        new_result = await db.execute(select(Obra).where(Obra.n_doc == new_n_doc_clean))
        return new_result.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al renombrar el expediente de obra: {str(e)}")


# ═══════════════════════════════════════════════════════════
# ENDPOINTS MÓDULO CELULARES
# ═══════════════════════════════════════════════════════════

@router.get("/celulares/generar-codigo/{id_sucursal}", tags=["Celulares"])
async def generar_codigo_celular(id_sucursal: int, db: AsyncSession = Depends(get_db)):
    """
    Genera el siguiente código de control disponible para un celular
    en la sucursal indicada. Formato: {id_sucursal}-{siguiente:03d}
    """
    try:
        # Obtener la sucursal para validar que existe
        suc_result = await db.execute(
            select(VwListaSucursal).where(VwListaSucursal.value == id_sucursal)
        )
        suc = suc_result.scalar_one_or_none()
        if not suc:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada.")

        # Obtener los celulares registrados en esta sucursal
        result = await db.execute(
            select(Celular).where(Celular.id_sucursal == id_sucursal)
        )
        celulares = result.scalars().all()

        # Parsear los códigos existentes para encontrar el secuencial máximo
        max_seq = 0
        import re
        for c in celulares:
            if c.cod_control:
                # Buscar patrón numerico: {id_sucursal}-{secuencial}
                match = re.match(rf"^{id_sucursal}-(\d+)$", c.cod_control)
                if match:
                    try:
                        seq = int(match.group(1))
                        if seq > max_seq:
                            max_seq = seq
                    except ValueError:
                        pass

        siguiente = max_seq + 1
        codigo = f"{id_sucursal}-{siguiente:03d}"

        # Verificar unicidad just in case
        for _ in range(100):
            existe = await db.execute(select(Celular).where(Celular.cod_control == codigo))
            if not existe.scalar_one_or_none():
                break
            siguiente += 1
            codigo = f"{id_sucursal}-{siguiente:03d}"

        return {"codigo": codigo, "siguiente": siguiente}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/celulares", response_model=List[CelularResponse], tags=["Celulares"])
async def get_celulares(
    id_sucursal: Optional[int] = None,
    estado: Optional[str] = None,
    cod_personal: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lista todos los celulares con datos de dimensiones resueltos."""
    try:
        query = select(VwCelularesDetalle)
        if id_sucursal:
            query = query.where(VwCelularesDetalle.id_sucursal == id_sucursal)
        if estado:
            query = query.where(VwCelularesDetalle.estado == estado)
        if cod_personal:
            query = query.where(VwCelularesDetalle.cod_personal == cod_personal)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/celulares", response_model=CelularResponse, status_code=status.HTTP_201_CREATED, tags=["Celulares"])
async def create_celular(celular_in: CelularCreate, db: AsyncSession = Depends(get_db)):
    """Registra un nuevo celular como activo sujeto a control."""
    # Verificar que el cod_control no exista
    result = await db.execute(select(Celular).where(Celular.cod_control == celular_in.cod_control))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"El código de control '{celular_in.cod_control}' ya existe.")
    data = celular_in.model_dump()
    # Si no viene fecha_ingreso, usar fecha actual
    if not data.get('fecha_ingreso'):
        from datetime import date as date_type
        data['fecha_ingreso'] = date_type.today()
    db_celular = Celular(**data)
    db.add(db_celular)
    try:
        await db.commit()
        await db.refresh(db_celular)
        # Retornar desde la vista con joins resueltos
        res = await db.execute(select(VwCelularesDetalle).where(VwCelularesDetalle.id_celular == db_celular.id_celular))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar celular: {str(e)}")


@router.get("/celulares/{id_celular}", response_model=CelularResponse, tags=["Celulares"])
async def get_celular(id_celular: int, db: AsyncSession = Depends(get_db)):
    """Obtiene un celular por ID con datos de dimensiones."""
    result = await db.execute(select(VwCelularesDetalle).where(VwCelularesDetalle.id_celular == id_celular))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Celular no encontrado.")
    return row


@router.put("/celulares/{id_celular}", response_model=CelularResponse, tags=["Celulares"])
async def update_celular(id_celular: int, celular_in: CelularCreate, db: AsyncSession = Depends(get_db)):
    """Actualiza los datos de un celular existente."""
    db_celular = await db.get(Celular, id_celular)
    if not db_celular:
        raise HTTPException(status_code=404, detail="Celular no encontrado.")
    # Verificar unicidad de cod_control si cambió
    if celular_in.cod_control != db_celular.cod_control:
        res = await db.execute(select(Celular).where(Celular.cod_control == celular_in.cod_control))
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"El código de control '{celular_in.cod_control}' ya está en uso.")
    for field, value in celular_in.model_dump().items():
        setattr(db_celular, field, value)
    try:
        await db.commit()
        await db.refresh(db_celular)
        res = await db.execute(select(VwCelularesDetalle).where(VwCelularesDetalle.id_celular == db_celular.id_celular))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar celular: {str(e)}")


@router.delete("/celulares/{id_celular}", status_code=status.HTTP_204_NO_CONTENT, tags=["Celulares"])
async def delete_celular(id_celular: int, db: AsyncSession = Depends(get_db)):
    """Elimina un celular del registro."""
    db_celular = await db.get(Celular, id_celular)
    if not db_celular:
        raise HTTPException(status_code=404, detail="Celular no encontrado.")
    try:
        await db.delete(db_celular)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar celular: {str(e)}")


# ═══════════════════════════════════════════════════════════
# ENDPOINTS MÓDULO VEHÍCULO DETALLE
# ═══════════════════════════════════════════════════════════

@router.get("/vehiculos/generar-codigo/{id_sucursal}", tags=["Vehículos"])
async def generar_codigo_vehiculo(id_sucursal: int, db: AsyncSession = Depends(get_db)):
    """
    Genera el siguiente código de control disponible para un vehículo sujeto a control
    en la sucursal indicada. Formato: 339{id_sucursal}{siguiente:03d}
    """
    try:
        # Validar sucursal
        suc_result = await db.execute(
            select(VwListaSucursal).where(VwListaSucursal.value == id_sucursal)
        )
        suc = suc_result.scalar_one_or_none()
        if not suc:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada.")

        # Obtener todos los activos que empiecen con '339'
        result = await db.execute(
            select(Activo).where(Activo.cod_patrimonial.like("339%"))
        )
        activos = result.scalars().all()

        # Parsear secuencial máximo para esta sucursal
        max_seq = 0
        import re
        for a in activos:
            if a.cod_patrimonial:
                # Primero intentar el nuevo formato de 9 dígitos: 339 + sucursal (2d) + secuencia (4d)
                match = re.match(rf"^339{id_sucursal:02d}(\d{{4}})$", a.cod_patrimonial)
                if match:
                    try:
                        seq = int(match.group(1))
                        if seq > max_seq:
                            max_seq = seq
                    except ValueError:
                        pass
                else:
                    # Si no coincide, intentar el formato antiguo de 8 dígitos: 339 + sucursal + secuencia (3d)
                    match_old = re.match(rf"^339{id_sucursal}(\d{{3}})$", a.cod_patrimonial)
                    if match_old:
                        try:
                            seq = int(match_old.group(1))
                            if seq > max_seq:
                                max_seq = seq
                        except ValueError:
                            pass

        siguiente = max_seq + 1
        codigo = f"339{id_sucursal:02d}{siguiente:04d}"

        # Verificar que sea único
        for _ in range(100):
            existe = await db.execute(select(Activo).where(Activo.cod_patrimonial == codigo))
            if not existe.scalar_one_or_none():
                break
            siguiente += 1
            codigo = f"339{id_sucursal:02d}{siguiente:04d}"

        return {"codigo": codigo, "siguiente": siguiente}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vehiculos/{cod_patrimonial}/detalle", response_model=VehiculoDetalleResponse, tags=["Vehículos"])
async def get_vehiculo_detalle(cod_patrimonial: str, db: AsyncSession = Depends(get_db)):
    """Obtiene el detalle particular de un vehículo por su código patrimonial."""
    db_veh = await db.get(VehiculoDetalle, cod_patrimonial)
    if not db_veh:
        raise HTTPException(status_code=404, detail="Detalle de vehículo no encontrado.")
    return db_veh


@router.post("/vehiculos/{cod_patrimonial}/detalle", response_model=VehiculoDetalleResponse, tags=["Vehículos"])
async def upsert_vehiculo_detalle(
    cod_patrimonial: str,
    veh_in: VehiculoDetalleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea o actualiza el detalle particular de un vehículo. Hace upsert por cod_patrimonial."""
    # Verificar que el activo existe en fct_registro_activos
    db_activo = await db.get(Activo, cod_patrimonial)
    if not db_activo:
        raise HTTPException(status_code=404, detail=f"No existe el activo '{cod_patrimonial}' en el registro de activos.")

    db_veh = await db.get(VehiculoDetalle, cod_patrimonial)
    if db_veh:
        for field, value in veh_in.model_dump().items():
            setattr(db_veh, field, value)
    else:
        db_veh = VehiculoDetalle(cod_patrimonial=cod_patrimonial, **veh_in.model_dump())
        db.add(db_veh)
    try:
        await db.commit()
        await db.refresh(db_veh)
        return db_veh
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al guardar detalle de vehículo: {clean_db_error_message(e)}")


@router.get("/vehiculos", response_model=List[VehiculoDetalleResponse], tags=["Vehículos"])
async def get_vehiculos(db: AsyncSession = Depends(get_db)):
    """Lista todos los vehículos con su detalle particular."""
    try:
        result = await db.execute(select(VehiculoDetalle))
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════
# ENDPOINTS MÓDULO SOAT
# ═══════════════════════════════════════════════════════════

@router.get("/soat", response_model=List[SoatVigenciaDTO], tags=["SOAT"])
async def get_soat_todos(db: AsyncSession = Depends(get_db)):
    """
    Lista todos los registros SOAT con días de vigencia y estado calculados,
    ordenados por días de vigencia ascendente (los más urgentes primero).
    """
    try:
        from sqlalchemy import asc, nulls_first
        query = select(VwSoatVigencia).order_by(asc(VwSoatVigencia.dias_vigencia))
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/soat/vehiculo/{cod_patrimonial}", response_model=List[SoatVigenciaDTO], tags=["SOAT"])
async def get_soat_por_vehiculo(cod_patrimonial: str, db: AsyncSession = Depends(get_db)):
    """Lista el historial SOAT de un vehículo específico."""
    try:
        result = await db.execute(
            select(VwSoatVigencia)
            .where(VwSoatVigencia.cod_patrimonial == cod_patrimonial)
            .order_by(VwSoatVigencia.fecha_vencimiento.desc())
        )
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/soat", response_model=SoatVigenciaDTO, status_code=status.HTTP_201_CREATED, tags=["SOAT"])
async def create_soat(soat_in: SoatCreate, db: AsyncSession = Depends(get_db)):
    """Registra una nueva póliza SOAT para un vehículo."""
    if soat_in.fecha_vencimiento <= soat_in.fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha de vencimiento debe ser posterior a la fecha de inicio.")
    # Verificar que el vehículo existe
    db_activo = await db.get(Activo, soat_in.cod_patrimonial)
    if not db_activo:
        raise HTTPException(status_code=404, detail=f"El activo '{soat_in.cod_patrimonial}' no existe.")
    db_soat = Soat(**soat_in.model_dump())
    db.add(db_soat)
    try:
        await db.commit()
        await db.refresh(db_soat)
        res = await db.execute(select(VwSoatVigencia).where(VwSoatVigencia.id_soat == db_soat.id_soat))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar SOAT: {clean_db_error_message(e)}")


@router.put("/soat/{id_soat}", response_model=SoatVigenciaDTO, tags=["SOAT"])
async def update_soat(id_soat: int, soat_in: SoatCreate, db: AsyncSession = Depends(get_db)):
    """Actualiza una póliza SOAT (p. ej. renovación anual: nueva fecha de vencimiento)."""
    if soat_in.fecha_vencimiento <= soat_in.fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha de vencimiento debe ser posterior a la fecha de inicio.")
    db_soat = await db.get(Soat, id_soat)
    if not db_soat:
        raise HTTPException(status_code=404, detail="Registro SOAT no encontrado.")
    for field, value in soat_in.model_dump().items():
        setattr(db_soat, field, value)
    try:
        await db.commit()
        await db.refresh(db_soat)
        res = await db.execute(select(VwSoatVigencia).where(VwSoatVigencia.id_soat == db_soat.id_soat))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar SOAT: {clean_db_error_message(e)}")


@router.delete("/soat/{id_soat}", status_code=status.HTTP_204_NO_CONTENT, tags=["SOAT"])
async def delete_soat(id_soat: int, db: AsyncSession = Depends(get_db)):
    """Elimina un registro SOAT."""
    db_soat = await db.get(Soat, id_soat)
    if not db_soat:
        raise HTTPException(status_code=404, detail="Registro SOAT no encontrado.")
    try:
        await db.delete(db_soat)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar SOAT: {str(e)}")


# ═══════════════════════════════════════════════════════════
# ENDPOINTS MÓDULO INVENTARIO FÍSICO (Faltantes y Sobrantes)
# ═══════════════════════════════════════════════════════════

@router.get("/inventario-fisico/generar-codigo/{cod_categoria}", tags=["Inventario Físico"])
async def generar_codigo_sobrante(cod_categoria: int, db: AsyncSession = Depends(get_db)):
    """Genera el siguiente código disponible para un Sobrante en base a su subcategoría (c_cont_3)."""
    try:
        cat_result = await db.execute(
            select(VwListaSubcategoria).where(VwListaSubcategoria.value == cod_categoria)
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=404, detail="Categoría no encontrada.")

        c_cont_3 = cat.c_cont_3 or "330"
        prefix = f"SOB-{c_cont_3}-"
        result = await db.execute(
            select(InventarioFisico).where(InventarioFisico.cod_patrimonial.like(f"{prefix}%"))
        )
        items = result.scalars().all()
        
        max_seq = 0
        import re
        for i in items:
            if i.cod_patrimonial:
                match = re.match(rf"^SOB-{c_cont_3}-(\d{{3}})$", i.cod_patrimonial)
                if match:
                    try:
                        seq = int(match.group(1))
                        if seq > max_seq:
                            max_seq = seq
                    except ValueError:
                        pass
        
        siguiente = max_seq + 1
        codigo = f"{prefix}{siguiente:03d}"
        
        for _ in range(100):
            existe = await db.execute(select(InventarioFisico).where(InventarioFisico.cod_patrimonial == codigo))
            if not existe.scalar_one_or_none():
                break
            siguiente += 1
            codigo = f"{prefix}{siguiente:03d}"
            
        return {"codigo": codigo, "siguiente": siguiente}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/inventario-fisico", response_model=List[InventarioFisicoResponse], tags=["Inventario Físico"])
async def get_inventario_fisico(tipo: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Lista todos los registros del inventario físico (faltantes/sobrantes) con joins."""
    try:
        query = select(VwInventarioFisicoDetalle)
        if tipo:
            query = query.where(VwInventarioFisicoDetalle.tipo == tipo)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inventario-fisico", response_model=InventarioFisicoResponse, status_code=status.HTTP_201_CREATED, tags=["Inventario Físico"])
async def create_inventario_fisico(item_in: InventarioFisicoCreate, db: AsyncSession = Depends(get_db)):
    """Registra un nuevo faltante o sobrante en el inventario físico."""
    if item_in.tipo == 'FALTANTE':
        db_activo = await db.get(Activo, item_in.cod_patrimonial)
        if not db_activo:
            raise HTTPException(
                status_code=404, 
                detail=f"No se encontró un activo con el código patrimonial '{item_in.cod_patrimonial}' en el registro principal para ser marcado como Faltante."
            )
            
    existe = await db.get(InventarioFisico, item_in.cod_patrimonial)
    if existe:
        raise HTTPException(
            status_code=400, 
            detail=f"El código patrimonial '{item_in.cod_patrimonial}' ya está registrado en el Inventario Físico."
        )
        
    db_item = InventarioFisico(**item_in.model_dump())
    db.add(db_item)
    try:
        await db.commit()
        await db.refresh(db_item)
        res = await db.execute(select(VwInventarioFisicoDetalle).where(VwInventarioFisicoDetalle.cod_patrimonial == db_item.cod_patrimonial))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar en inventario físico: {str(e)}")


@router.put("/inventario-fisico/{cod_patrimonial}", response_model=InventarioFisicoResponse, tags=["Inventario Físico"])
async def update_inventario_fisico(cod_patrimonial: str, item_in: InventarioFisicoCreate, db: AsyncSession = Depends(get_db)):
    """Actualiza los datos básicos de un registro del inventario físico."""
    db_item = await db.get(InventarioFisico, cod_patrimonial)
    if not db_item:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")
        
    for field, value in item_in.model_dump().items():
        if field not in ('cod_patrimonial', 'tipo'):
            setattr(db_item, field, value)
            
    try:
        await db.commit()
        await db.refresh(db_item)
        res = await db.execute(select(VwInventarioFisicoDetalle).where(VwInventarioFisicoDetalle.cod_patrimonial == cod_patrimonial))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar registro de inventario físico: {str(e)}")


@router.delete("/inventario-fisico/{cod_patrimonial}", status_code=status.HTTP_204_NO_CONTENT, tags=["Inventario Físico"])
async def delete_inventario_fisico(cod_patrimonial: str, db: AsyncSession = Depends(get_db)):
    """Elimina un registro del inventario físico."""
    db_item = await db.get(InventarioFisico, cod_patrimonial)
    if not db_item:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")
    try:
        await db.delete(db_item)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar registro de inventario físico: {str(e)}")


# ═══════════════════════════════════════════════════════════
# ENDPOINTS MÓDULO BIENES DE TERCEROS Y CONTROL
# ═══════════════════════════════════════════════════════════

@router.get("/bienes-terceros/generar-codigo/{tipo}", tags=["Bienes de Terceros"])
async def generar_codigo_tercero_control(tipo: str, db: AsyncSession = Depends(get_db)):
    """Genera el siguiente código disponible para un bien de tercero (TER-xxxxx) o control (CON-xxxxx)."""
    if tipo not in ('TERCERO', 'CONTROL'):
        raise HTTPException(status_code=400, detail="Tipo inválido. Debe ser TERCERO o CONTROL.")
    try:
        prefix = "TER-" if tipo == "TERCERO" else "CON-"
        result = await db.execute(
            select(BienTercero).where(BienTercero.cod_patrimonial.like(f"{prefix}%"))
        )
        items = result.scalars().all()
        
        max_seq = 0
        import re
        for i in items:
            if i.cod_patrimonial:
                match = re.match(rf"^{prefix}(\d{{5}})$", i.cod_patrimonial)
                if match:
                    try:
                        seq = int(match.group(1))
                        if seq > max_seq:
                            max_seq = seq
                    except ValueError:
                        pass
                        
        siguiente = max_seq + 1
        codigo = f"{prefix}{siguiente:05d}"
        
        for _ in range(100):
            existe = await db.execute(select(BienTercero).where(BienTercero.cod_patrimonial == codigo))
            if not existe.scalar_one_or_none():
                break
            siguiente += 1
            codigo = f"{prefix}{siguiente:05d}"
            
        return {"codigo": codigo, "siguiente": siguiente}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bienes-terceros", response_model=List[BienTerceroResponse], tags=["Bienes de Terceros"])
async def get_bienes_terceros(tipo: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Lista todos los bienes de terceros o activos no fijos controlados."""
    try:
        query = select(VwBienesTercerosDetalle)
        if tipo:
            query = query.where(VwBienesTercerosDetalle.tipo == tipo)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bienes-terceros", response_model=BienTerceroResponse, status_code=status.HTTP_201_CREATED, tags=["Bienes de Terceros"])
async def create_bien_tercero(bien_in: BienTerceroCreate, db: AsyncSession = Depends(get_db)):
    """Registra un nuevo bien de terceros o activo no fijo controlado."""
    existe = await db.get(BienTercero, bien_in.cod_patrimonial)
    if existe:
        raise HTTPException(status_code=400, detail=f"El código '{bien_in.cod_patrimonial}' ya está registrado.")
        
    db_bien = BienTercero(**bien_in.model_dump())
    db.add(db_bien)
    try:
        await db.commit()
        await db.refresh(db_bien)
        res = await db.execute(select(VwBienesTercerosDetalle).where(VwBienesTercerosDetalle.cod_patrimonial == db_bien.cod_patrimonial))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al registrar bien: {str(e)}")


@router.put("/bienes-terceros/{cod_patrimonial}", response_model=BienTerceroResponse, tags=["Bienes de Terceros"])
async def update_bien_tercero(cod_patrimonial: str, bien_in: BienTerceroCreate, db: AsyncSession = Depends(get_db)):
    """Actualiza los datos de un bien de terceros o activo no fijo controlado."""
    db_bien = await db.get(BienTercero, cod_patrimonial)
    if not db_bien:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")
        
    for field, value in bien_in.model_dump().items():
        if field not in ('cod_patrimonial', 'tipo'):
            setattr(db_bien, field, value)
            
    try:
        await db.commit()
        await db.refresh(db_bien)
        res = await db.execute(select(VwBienesTercerosDetalle).where(VwBienesTercerosDetalle.cod_patrimonial == cod_patrimonial))
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar bien: {str(e)}")


@router.delete("/bienes-terceros/{cod_patrimonial}", status_code=status.HTTP_204_NO_CONTENT, tags=["Bienes de Terceros"])
async def delete_bien_tercero(cod_patrimonial: str, db: AsyncSession = Depends(get_db)):
    """Elimina un registro de bien de terceros o activo no fijo controlado."""
    db_bien = await db.get(BienTercero, cod_patrimonial)
    if not db_bien:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")
    try:
        await db.delete(db_bien)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar bien: {str(e)}")

