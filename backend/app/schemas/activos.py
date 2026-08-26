from decimal import Decimal
from datetime import date, datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, ConfigDict, Field

class ActivoBase(BaseModel):
    cod_patrimonial: str = Field(..., max_length=30, description="Código patrimonial único del activo")
    documento_tipo: Literal["COMPRA", "INCORPORACION", "OBRA"] = Field("COMPRA", description="Tipo de documento de adquisición")
    n_doc_compra: Optional[str] = Field(None, max_length=30, description="Nro de documento de compra")
    n_doc_incorporacion: Optional[str] = Field(None, max_length=30, description="Nro de documento de incorporación")
    n_doc_obra: Optional[str] = Field(None, max_length=30, description="Nro de documento de obra")
    cod_categoria: int = Field(..., description="Código de la categoría (dim_categoria)")
    denominacion: str = Field(..., max_length=300, description="Denominación o descripción detallada")
    color: Optional[str] = Field(None, max_length=120)
    marca: Optional[str] = Field(None, max_length=160)
    modelo: Optional[str] = Field(None, max_length=180)
    numero_serie: Optional[str] = Field(None, max_length=180)
    caracteristicas_accesorios: Optional[str] = Field(None, description="Características adicionales o accesorios")
    vida_util_anios: int = Field(0, ge=0, le=100, description="Años de vida útil del activo")
    id_sucursal: int = Field(..., description="ID de la sucursal asignada")
    unidad: Optional[str] = Field(None, max_length=180)
    puesto_id: Optional[int] = Field(None, description="ID del puesto del personal asignado")
    cod_personal: Optional[str] = Field(None, max_length=20, description="Código del personal responsable")
    numero_factura: Optional[str] = Field(None, max_length=80)
    fecha_alta_factura: Optional[date] = Field(None)
    fecha_registro_contable: Optional[date] = Field(None)
    fecha_asignacion: Optional[date] = Field(None)
    valor_en_libros: Decimal = Field(Decimal("0.0000"), ge=0, description="Valor del activo registrado en libros")
    igv: Optional[Decimal] = Field(None, ge=0)
    informe_conformidad: Optional[str] = Field(None, max_length=80)
    n_acta: Optional[str] = Field(None, max_length=40)
    estado_activo: Literal["BUENO", "REGULAR", "MALO", "PARA BAJA", "BAJA"] = Field("BUENO")
    cuenta_contable: str = Field(..., max_length=20, description="Cuenta contable del activo")
    centro_costo: Optional[str] = Field(None, max_length=20, description="Centro de costo del activo")
    pdf_expediente_path: Optional[str] = Field(None, max_length=350, description="Ruta al expediente de adquisición en formato PDF")
    imagen_1_path: Optional[str] = Field(None, max_length=350, description="Ruta de la imagen 1 del activo")
    imagen_2_path: Optional[str] = Field(None, max_length=350, description="Ruta de la imagen 2 del activo")
    imagen_3_path: Optional[str] = Field(None, max_length=350, description="Ruta de la imagen 3 del activo")

class ActivoCreate(ActivoBase):
    # Campos opcionales para la creación/actualización del documento de adquisición inline
    compra_fecha_oc: Optional[date] = None
    compra_id_localidad: Optional[int] = None
    compra_nota_pedido: Optional[str] = None
    compra_certificacion_presupuestal: Optional[str] = None
    compra_id_fuente: Optional[int] = None
    compra_requerido_por: Optional[str] = None
    compra_concepto: Optional[str] = None

    inc_fecha_doc: Optional[date] = None
    inc_id_localidad: Optional[int] = None
    inc_nota_pedido: Optional[str] = None
    inc_certificacion_presupuestal: Optional[str] = None
    inc_id_fuente: Optional[int] = None
    inc_fuente_origen: Optional[str] = None
    inc_origen: Optional[str] = None
    inc_fecha_alta: Optional[date] = None
    inc_concepto: Optional[str] = None

    obra_fecha_doc: Optional[date] = None
    obra_id_localidad: Optional[int] = None
    obra_nota_pedido: Optional[str] = None
    obra_certificacion_presupuestal: Optional[str] = None
    obra_id_fuente: Optional[int] = None
    obra_fuente_origen: Optional[str] = None
    obra_origen: Optional[str] = None
    obra_fecha_alta: Optional[date] = None
    obra_concepto: Optional[str] = None

class ActivoResponse(ActivoBase):
    # Campos calculados u autogenerados en DB
    n_doc: Optional[str] = None
    n_acta_entrega: Optional[str] = None
    
    # Columnas opcionales de la vista unida
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    sucursal: Optional[str] = None
    localidad: Optional[str] = None
    puesto: Optional[str] = None
    responsable: Optional[str] = None
    depreciacion_acumulada: Optional[Decimal] = None
    valor_neto: Optional[Decimal] = None
    cuenta_contable: Optional[str] = None
    
    # Datos adicionales de vehículos
    placa: Optional[str] = None
    vehiculo_anio: Optional[int] = None
    tipo_vehiculo: Optional[str] = None
    combustible: Optional[str] = None
    cilindrada_cc: Optional[int] = None
    nro_motor: Optional[str] = None
    nro_chasis: Optional[str] = None
    nro_tarjeta_prop: Optional[str] = None
    carroceria: Optional[str] = None
    categoria_vehiculo: Optional[str] = None
    vencimiento_rev_tec: Optional[date] = None
    dias_vigencia_rev_tec: Optional[int] = None
    estado_rev_tec: Optional[str] = None

    # Datos del último SOAT
    soat_poliza: Optional[str] = None
    soat_compania: Optional[str] = None
    soat_vencimiento: Optional[date] = None
    soat_dias_vigencia: Optional[int] = None
    soat_estado: Optional[str] = None

    # Nuevos campos para reportes
    fuente: Optional[str] = None
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    centro_costo: Optional[str] = None
    requerido_por: Optional[str] = None
    fecha_alta: Optional[date] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ActivoPublicoDTO(BaseModel):
    """
    DTO simplificado para el dashboard público estático.
    Mapeado a partir de af.vw_registro_activos_detalle.
    """
    cod_patrimonial: str
    n_doc: Optional[str] = None
    documento_tipo: str
    categoria: str
    subcategoria: str
    denominacion: str
    color: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    caracteristicas_accesorios: Optional[str] = None
    vida_util_anios: int
    sucursal: str
    localidad: Optional[str] = None
    unidad: Optional[str] = None
    puesto: Optional[str] = None
    responsable: Optional[str] = None
    numero_factura: Optional[str] = None
    fecha_alta_factura: Optional[date] = None
    fecha_registro_contable: Optional[date] = None
    fecha_asignacion: Optional[date] = None
    valor_en_libros: Decimal
    igv: Optional[Decimal] = None
    informe_conformidad: Optional[str] = None
    n_acta: Optional[str] = None
    n_acta_entrega: Optional[str] = None
    depreciacion_acumulada: Optional[Decimal] = None
    valor_neto: Optional[Decimal] = None
    estado_activo: str
    cuenta_contable: Optional[str] = None
    centro_costo: Optional[str] = None
    requerido_por: Optional[str] = None
    fuente: Optional[str] = None
    fuente_origen: Optional[str] = None
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    pdf_expediente_path: Optional[str] = None
    imagen_1_path: Optional[str] = None
    imagen_2_path: Optional[str] = None
    imagen_3_path: Optional[str] = None

    # Datos adicionales de vehículos
    placa: Optional[str] = None
    vehiculo_anio: Optional[int] = None
    tipo_vehiculo: Optional[str] = None
    combustible: Optional[str] = None
    cilindrada_cc: Optional[int] = None
    nro_motor: Optional[str] = None
    nro_chasis: Optional[str] = None
    nro_tarjeta_prop: Optional[str] = None
    carroceria: Optional[str] = None
    categoria_vehiculo: Optional[str] = None
    vencimiento_rev_tec: Optional[date] = None
    dias_vigencia_rev_tec: Optional[int] = None
    estado_rev_tec: Optional[str] = None

    # Datos del último SOAT
    soat_poliza: Optional[str] = None
    soat_compania: Optional[str] = None
    soat_vencimiento: Optional[date] = None
    soat_dias_vigencia: Optional[int] = None
    soat_estado: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── DTOs de listas de dimensiones (para selectores del formulario) ──────────

class SucursalDTO(BaseModel):
    value: int
    label: str
    localidad: Optional[str] = None
    tipo_sucursal: str
    model_config = ConfigDict(from_attributes=True)


class SubcategoriaDTO(BaseModel):
    value: int
    label: str
    categoria: str
    vida_util_anios: int
    porcentaje_dep: Decimal
    no_deprecia: bool
    c_cont_3: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PuestoDTO(BaseModel):
    value: int
    label: str
    id_sucursal: int
    sucursal: str
    departamento: Optional[str] = None
    tipo_contexto: str
    model_config = ConfigDict(from_attributes=True)


class PersonalDTO(BaseModel):
    value: str
    label: str
    model_config = ConfigDict(from_attributes=True)


class LocalidadDTO(BaseModel):
    value: int
    label: str
    model_config = ConfigDict(from_attributes=True)


class CuentaContableDTO(BaseModel):
    value: str
    label: str
    c_cont_3: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CentroCostoDTO(BaseModel):
    value: str
    label: str
    proceso: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class FuenteDTO(BaseModel):
    value: int
    label: str
    model_config = ConfigDict(from_attributes=True)


class CompraCreate(BaseModel):
    n_doc: str = Field(..., max_length=30)
    fecha_oc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    requerido_por: Optional[str] = None
    concepto: Optional[str] = None

class CompraResponse(BaseModel):
    n_doc: str
    fecha_oc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    requerido_por: Optional[str] = None
    concepto: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    en_uso: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)

class IncorporacionCreate(BaseModel):
    n_doc: str = Field(..., max_length=30)
    fecha_doc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    fuente_origen: Optional[str] = None
    origen: Optional[str] = None
    fecha_alta: Optional[date] = None
    concepto: Optional[str] = None

class IncorporacionResponse(BaseModel):
    n_doc: str
    fecha_doc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    fuente_origen: Optional[str] = None
    origen: Optional[str] = None
    fecha_alta: Optional[date] = None
    concepto: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    en_uso: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)


class ObraCreate(BaseModel):
    n_doc: str = Field(..., max_length=30)
    fecha_doc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    fuente_origen: Optional[str] = None
    origen: Optional[str] = None
    fecha_alta: Optional[date] = None
    concepto: Optional[str] = None

class ObraResponse(BaseModel):
    n_doc: str
    fecha_doc: Optional[date] = None
    id_localidad: int
    nota_pedido: Optional[str] = None
    certificacion_presupuestal: Optional[str] = None
    id_fuente: Optional[int] = None
    fuente_origen: Optional[str] = None
    origen: Optional[str] = None
    fecha_alta: Optional[date] = None
    concepto: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    en_uso: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)


class DocumentRename(BaseModel):
    new_n_doc: str = Field(..., max_length=30)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO CELULARES
# ═══════════════════════════════════════════════════════════

class CelularBase(BaseModel):
    cod_control: str = Field(..., max_length=30, description="Código interno de control del celular")
    marca: Optional[str] = Field(None, max_length=100)
    modelo: Optional[str] = Field(None, max_length=150)
    imei: Optional[str] = Field(None, max_length=20)
    numero_linea: Optional[str] = Field(None, max_length=20)
    operador: Optional[str] = Field(None, max_length=60)
    id_sucursal: int = Field(..., description="ID de la sucursal asignada")
    puesto_id: Optional[int] = Field(None, description="ID del puesto")
    cod_personal: Optional[str] = Field(None, max_length=20, description="Código del responsable")
    fecha_ingreso: Optional[date] = Field(None, description="Fecha de registro/ingreso del equipo")
    fecha_asignacion: Optional[date] = Field(None)
    estado: str = Field("ACTIVO", description="Estado del celular")
    observaciones: Optional[str] = Field(None)


class CelularCreate(CelularBase):
    pass


class CelularResponse(CelularBase):
    id_celular: int
    # Campos de la vista con joins resueltos
    sucursal: Optional[str] = None
    localidad: Optional[str] = None
    puesto: Optional[str] = None
    responsable: Optional[str] = None
    # Vida útil (calculados en BD)
    fecha_renovacion: Optional[date] = None
    dias_para_renovar: Optional[int] = None
    vida_util_estado: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO VEHÍCULO DETALLE
# ═══════════════════════════════════════════════════════════

class VehiculoDetalleBase(BaseModel):
    placa: str = Field(..., max_length=10, description="Placa del vehículo")
    anio_fabricacion: Optional[int] = Field(None, ge=1900, le=2100)
    tipo_vehiculo: Optional[str] = Field(None, max_length=60)
    combustible: Optional[str] = Field(None, max_length=30)
    cilindrada_cc: Optional[int] = Field(None, ge=0)
    nro_motor: Optional[str] = Field(None, max_length=60)
    nro_chasis: Optional[str] = Field(None, max_length=60)
    nro_tarjeta_prop: Optional[str] = Field(None, max_length=40)
    carroceria: Optional[str] = Field(None, max_length=60)
    categoria_vehiculo: Optional[str] = Field(None, max_length=30)
    vencimiento_rev_tec: Optional[date] = None


class VehiculoDetalleCreate(VehiculoDetalleBase):
    pass


class VehiculoDetalleResponse(VehiculoDetalleBase):
    cod_patrimonial: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO SOAT
# ═══════════════════════════════════════════════════════════

class SoatBase(BaseModel):
    cod_patrimonial: str = Field(..., max_length=30)
    numero_poliza: Optional[str] = Field(None, max_length=60)
    compania_aseguradora: Optional[str] = Field(None, max_length=120)
    fecha_inicio: date
    fecha_vencimiento: date
    monto: Optional[Decimal] = Field(None, ge=0)
    observaciones: Optional[str] = Field(None)


class SoatCreate(SoatBase):
    pass


class SoatResponse(SoatBase):
    id_soat: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SoatVigenciaDTO(BaseModel):
    """DTO de la vista vw_soat_vigencia, incluye días de vigencia y estado calculados."""
    id_soat: int
    cod_patrimonial: str
    placa: Optional[str] = None
    denominacion: str
    numero_poliza: Optional[str] = None
    compania_aseguradora: Optional[str] = None
    fecha_inicio: date
    fecha_vencimiento: date
    dias_vigencia: Optional[int] = None
    estado_soat: str
    monto: Optional[Decimal] = None
    observaciones: Optional[str] = None
    id_sucursal: Optional[int] = None
    sucursal: Optional[str] = None
    localidad: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO INVENTARIO FÍSICO (Faltantes y Sobrantes)
# ═══════════════════════════════════════════════════════════

class InventarioFisicoBase(BaseModel):
    cod_patrimonial: str = Field(..., max_length=30)
    tipo: Literal["FALTANTE", "SOBRANTE"]
    cod_categoria: int
    denominacion: str = Field(..., max_length=300)
    marca: Optional[str] = Field(None, max_length=160)
    modelo: Optional[str] = Field(None, max_length=180)
    numero_serie: Optional[str] = Field(None, max_length=180)
    color: Optional[str] = Field(None, max_length=120)
    caracteristicas_accesorios: Optional[str] = None
    observaciones: Optional[str] = None
    id_sucursal: Optional[int] = None
    localidad: Optional[str] = None


class InventarioFisicoCreate(InventarioFisicoBase):
    pass


class InventarioFisicoResponse(InventarioFisicoBase):
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    sucursal: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO BIENES DE TERCEROS Y CONTROL
# ═══════════════════════════════════════════════════════════

class BienTerceroBase(BaseModel):
    cod_patrimonial: str = Field(..., max_length=30)
    tipo: Literal["TERCERO", "CONTROL"]
    denominacion: str = Field(..., max_length=300)
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    color: Optional[str] = None
    caracteristicas_accesorios: Optional[str] = None
    cod_personal: Optional[str] = None
    propietario_manual: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    fecha_salida: Optional[date] = None
    observaciones: Optional[str] = None
    id_sucursal: Optional[int] = None
    localidad: Optional[str] = None


class BienTerceroCreate(BienTerceroBase):
    pass


class BienTerceroResponse(BienTerceroBase):
    responsable: Optional[str] = None
    sucursal: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO SALIDA DE BIENES
# ═══════════════════════════════════════════════════════════

class SalidaBienesDetalleBase(BaseModel):
    cod_patrimonial: Optional[str] = Field(None, max_length=30)
    denominacion: str = Field(..., max_length=300)
    color: Optional[str] = Field(None, max_length=120)
    marca: Optional[str] = Field(None, max_length=160)
    modelo: Optional[str] = Field(None, max_length=180)
    numero_serie: Optional[str] = Field(None, max_length=180)
    estado_activo: str = Field("BUENO", max_length=30)
    accesorios: Optional[str] = None


class SalidaBienesDetalleCreate(SalidaBienesDetalleBase):
    pass


class SalidaBienesDetalleResponse(SalidaBienesDetalleBase):
    id: int
    id_salida: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SalidaBienesBase(BaseModel):
    fecha_orden: date
    tipo_salida: str = Field(..., max_length=60)
    motivo: str
    responsable: str = Field(..., max_length=260)
    cargo: str = Field(..., max_length=220)
    ubicacion: str = Field(..., max_length=220)
    resp_tecnico: Optional[str] = Field(None, max_length=260)
    observaciones: Optional[str] = None
    estado_devolucion: Optional[str] = Field("SALIDA", max_length=30)
    obs_devolucion: Optional[str] = None


class SalidaBienesCreate(SalidaBienesBase):
    bienes: List[SalidaBienesDetalleCreate] = []


class SalidaBienesResponse(SalidaBienesBase):
    id: int
    n_orden: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    bienes: List[SalidaBienesDetalleResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════
# SCHEMAS MÓDULO TRANSFERENCIA DE BIENES
# ═══════════════════════════════════════════════════════════

class TransferenciaBienesBase(BaseModel):
    fecha_transferencia: date
    cod_patrimonial: str = Field(..., max_length=30)
    denominacion: str = Field(..., max_length=300)
    
    resp_origen: Optional[str] = Field(None, max_length=260)
    cargo_origen: Optional[str] = Field(None, max_length=220)
    sucursal_origen: Optional[str] = Field(None, max_length=160)
    
    resp_destino: str = Field(..., max_length=260)
    cargo_destino: Optional[str] = Field(None, max_length=220)
    sucursal_destino: Optional[str] = Field(None, max_length=160)
    
    motivo: str
    observaciones: Optional[str] = None


class TransferenciaBienesCreate(TransferenciaBienesBase):
    pass


class TransferenciaBienesResponse(TransferenciaBienesBase):
    id: int
    n_transferencia: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)



