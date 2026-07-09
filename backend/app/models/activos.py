from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Integer, SmallInteger, BigInteger, Numeric, Date, Text, Boolean, FetchedValue
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Activo(Base):
    """
    Modelo ORM para la tabla de registro de activos fijos.
    Representa af.fct_registro_activos.
    """
    __tablename__ = "fct_registro_activos"
    __table_args__ = {"schema": "af"}
    
    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    documento_tipo: Mapped[str] = mapped_column(String(20), default="COMPRA")
    n_doc_compra: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    n_doc_incorporacion: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    n_doc_obra: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    
    # Campo autogenerado en la base de datos (STORED: COALESCE(n_doc_compra, n_doc_incorporacion, n_doc_obra))
    n_doc: Mapped[Optional[str]] = mapped_column(String(30), server_default=FetchedValue())
    
    cod_categoria: Mapped[int] = mapped_column(Integer)
    denominacion: Mapped[str] = mapped_column(String(300))
    color: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    marca: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    modelo: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vida_util_anios: Mapped[int] = mapped_column(SmallInteger, default=0)
    id_sucursal: Mapped[int] = mapped_column(Integer)
    unidad: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    puesto_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    numero_factura: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    fecha_alta_factura: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_registro_contable: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_asignacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valor_en_libros: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0000"))
    igv: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    informe_conformidad: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    n_acta: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    
    # Campo autogenerado en la base de datos (STORED: n_acta + anio de fecha_alta_factura)
    n_acta_entrega: Mapped[Optional[str]] = mapped_column(String(80), server_default=FetchedValue())
    
    estado_activo: Mapped[str] = mapped_column(String(30), default="BUENO")
    cuenta_contable: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    centro_costo: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Campos de auditoria autogenerados
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwRegistroActivosDetalle(Base):
    """
    Modelo ORM de solo lectura mapeado a la vista de detalle de activos.
    Representa af.vw_registro_activos_detalle.
    """
    __tablename__ = "vw_registro_activos_detalle"
    __table_args__ = {"schema": "af"}
    
    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    n_doc: Mapped[Optional[str]] = mapped_column(String(30))
    documento_tipo: Mapped[str] = mapped_column(String(20))
    
    cod_categoria: Mapped[int] = mapped_column(Integer) # ID de categoría
    categoria: Mapped[str] = mapped_column(String(180))
    subcategoria: Mapped[str] = mapped_column(String(220))
    
    denominacion: Mapped[str] = mapped_column(String(300))
    color: Mapped[Optional[str]] = mapped_column(String(120))
    marca: Mapped[Optional[str]] = mapped_column(String(160))
    modelo: Mapped[Optional[str]] = mapped_column(String(180))
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180))
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text)
    vida_util_anios: Mapped[int] = mapped_column(SmallInteger)
    
    id_sucursal: Mapped[int] = mapped_column(Integer) # ID de sucursal
    sucursal: Mapped[str] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    unidad: Mapped[Optional[str]] = mapped_column(String(180))
    
    puesto_id: Mapped[Optional[int]] = mapped_column(BigInteger) # ID de puesto
    puesto: Mapped[Optional[str]] = mapped_column(String(220))
    
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20)) # Código de personal
    responsable: Mapped[Optional[str]] = mapped_column(String(260))
    
    numero_factura: Mapped[Optional[str]] = mapped_column(String(80))
    fecha_alta_factura: Mapped[Optional[date]] = mapped_column(Date)
    fecha_registro_contable: Mapped[Optional[date]] = mapped_column(Date)
    fecha_asignacion: Mapped[Optional[date]] = mapped_column(Date)
    valor_en_libros: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    igv: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    informe_conformidad: Mapped[Optional[str]] = mapped_column(String(80))
    n_acta: Mapped[Optional[str]] = mapped_column(String(40))
    n_acta_entrega: Mapped[Optional[str]] = mapped_column(String(80))
    depreciacion_acumulada: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    valor_neto: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    estado_activo: Mapped[str] = mapped_column(String(30))
    cuenta_contable: Mapped[Optional[str]] = mapped_column(String(20))

    # Campos de vehículo detalle
    placa: Mapped[Optional[str]] = mapped_column(String(10))
    vehiculo_anio: Mapped[Optional[int]] = mapped_column(SmallInteger)
    tipo_vehiculo: Mapped[Optional[str]] = mapped_column(String(60))
    combustible: Mapped[Optional[str]] = mapped_column(String(30))
    cilindrada_cc: Mapped[Optional[int]] = mapped_column(Integer)
    nro_motor: Mapped[Optional[str]] = mapped_column(String(60))
    nro_chasis: Mapped[Optional[str]] = mapped_column(String(60))
    nro_tarjeta_prop: Mapped[Optional[str]] = mapped_column(String(40))
    carroceria: Mapped[Optional[str]] = mapped_column(String(60))
    categoria_vehiculo: Mapped[Optional[str]] = mapped_column(String(30))
    vencimiento_rev_tec: Mapped[Optional[date]] = mapped_column(Date)
    dias_vigencia_rev_tec: Mapped[Optional[int]] = mapped_column(Integer)
    estado_rev_tec: Mapped[Optional[str]] = mapped_column(String(20))

    # Campos del último SOAT asociado
    soat_poliza: Mapped[Optional[str]] = mapped_column(String(60))
    soat_compania: Mapped[Optional[str]] = mapped_column(String(120))
    soat_vencimiento: Mapped[Optional[date]] = mapped_column(Date)
    soat_dias_vigencia: Mapped[Optional[int]] = mapped_column(Integer)
    soat_estado: Mapped[Optional[str]] = mapped_column(String(20))

    # Nuevos campos para reportes
    fuente: Mapped[Optional[str]] = mapped_column(String(100))
    nota_pedido: Mapped[Optional[str]] = mapped_column(String(80))
    certificacion_presupuestal: Mapped[Optional[str]] = mapped_column(String(80))
    centro_costo: Mapped[Optional[str]] = mapped_column(String(20))
    requerido_por: Mapped[Optional[str]] = mapped_column(String(260))
    fecha_alta: Mapped[Optional[date]] = mapped_column(Date)



class VwListaSucursal(Base):
    """Vista de lista de sucursales activas para selectores."""
    __tablename__ = "vw_lista_sucursal"
    __table_args__ = {"schema": "af"}

    value: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    tipo_sucursal: Mapped[str] = mapped_column(String(30))


class VwListaSubcategoria(Base):
    """Vista de subcategorías activas para selectores del formulario."""
    __tablename__ = "vw_lista_subcategoria"
    __table_args__ = {"schema": "af"}

    value: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(220))
    categoria: Mapped[str] = mapped_column(String(180))
    vida_util_anios: Mapped[int] = mapped_column(SmallInteger)
    porcentaje_dep: Mapped[Decimal] = mapped_column(Numeric(9, 4))
    no_deprecia: Mapped[bool] = mapped_column(Boolean)
    c_cont_3: Mapped[Optional[str]] = mapped_column(String(3))


class VwListaPuestoPorSucursal(Base):
    """Vista de puestos filtrados por sucursal. PK compuesta porque un puesto
    puede aparecer con varias sucursales del mismo tipo de contexto."""
    __tablename__ = "vw_lista_puesto_por_sucursal"
    __table_args__ = {"schema": "af"}

    id_sucursal: Mapped[int] = mapped_column(Integer, primary_key=True)
    value: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    label: Mapped[str] = mapped_column(String(220))
    sucursal: Mapped[str] = mapped_column(String(160))
    departamento: Mapped[Optional[str]] = mapped_column(String(160))
    tipo_contexto: Mapped[str] = mapped_column(String(30))


class VwListaPersonal(Base):
    """Vista de personal activo para selectores."""
    __tablename__ = "vw_lista_personal"
    __table_args__ = {"schema": "af"}

    value: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(260))


class Compra(Base):
    """
    Modelo ORM para la tabla af.fct_compra.
    """
    __tablename__ = "fct_compra"
    __table_args__ = {"schema": "af"}

    n_doc: Mapped[str] = mapped_column(String(30), primary_key=True)
    fecha_oc: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    id_localidad: Mapped[int] = mapped_column(Integer, nullable=False)
    nota_pedido: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    certificacion_presupuestal: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    c_cont_3: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    id_fuente: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    requerido_por: Mapped[Optional[str]] = mapped_column(String(260), nullable=True)
    concepto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class Incorporacion(Base):
    """
    Modelo ORM para la tabla af.fct_incorporacion_af.
    """
    __tablename__ = "fct_incorporacion_af"
    __table_args__ = {"schema": "af"}

    n_doc: Mapped[str] = mapped_column(String(30), primary_key=True)
    fecha_doc: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    id_localidad: Mapped[int] = mapped_column(Integer, nullable=False)
    id_fuente: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fuente_origen: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    origen: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    fecha_alta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    nota_pedido: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    certificacion_presupuestal: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    concepto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class Obra(Base):
    """
    Modelo ORM para la tabla af.fct_obra.
    """
    __tablename__ = "fct_obra"
    __table_args__ = {"schema": "af"}

    n_doc: Mapped[str] = mapped_column(String(30), primary_key=True)
    fecha_doc: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    id_localidad: Mapped[int] = mapped_column(Integer, nullable=False)
    id_fuente: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fuente_origen: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    origen: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    fecha_alta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    nota_pedido: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    certificacion_presupuestal: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    concepto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwListaLocalidad(Base):
    """Vista de lista de localidades activas para selectores."""
    __tablename__ = "vw_lista_localidad"
    __table_args__ = {"schema": "af"}

    value: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(120))


class VwListaCuentaContable(Base):
    """Vista de lista de cuentas contables para selectores."""
    __tablename__ = "vw_lista_cuenta_contable"
    __table_args__ = {"schema": "af"}

    value: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(275))
    c_cont_3: Mapped[Optional[str]] = mapped_column(String(3))


class VwListaCentroCosto(Base):
    """Vista de lista de centros de costo para selectores."""
    __tablename__ = "vw_lista_centro_costo"
    __table_args__ = {"schema": "af"}

    value: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(275))
    proceso: Mapped[Optional[str]] = mapped_column(String(120))


class VwListaFuente(Base):
    """Vista de lista de fuentes de financiamiento para selectores."""
    __tablename__ = "vw_lista_fuente"
    __table_args__ = {"schema": "af"}

    value: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(80))


class DimEstado(Base):
    """Modelo ORM para la tabla af.dim_estado."""
    __tablename__ = "dim_estado"
    __table_args__ = {"schema": "af"}

    id_estado: Mapped[int] = mapped_column(Integer, primary_key=True)
    estado: Mapped[str] = mapped_column(String(50), unique=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


# ═══════════════════════════════════════════════════════════
# MÓDULO CELULARES (activos sujetos a control, no activos fijos)
# ═══════════════════════════════════════════════════════════

class Celular(Base):
    """
    Modelo ORM para af.fct_celulares.
    Celulares son activos SUJETOS A CONTROL, no activos fijos contables.
    """
    __tablename__ = "fct_celulares"
    __table_args__ = {"schema": "af"}

    id_celular: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cod_control: Mapped[str] = mapped_column(String(30), unique=True)
    marca: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    modelo: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    imei: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    numero_linea: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    operador: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    id_sucursal: Mapped[int] = mapped_column(Integer)
    puesto_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fecha_ingreso: Mapped[date] = mapped_column(Date, server_default=FetchedValue())
    fecha_asignacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(30), default="ACTIVO")
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwCelularesDetalle(Base):
    """
    Vista de solo lectura af.vw_celulares_detalle con joins a dimensiones
    y campos de vida útil calculados (3 años desde fecha_ingreso).
    """
    __tablename__ = "vw_celulares_detalle"
    __table_args__ = {"schema": "af"}

    id_celular: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cod_control: Mapped[str] = mapped_column(String(30))
    marca: Mapped[Optional[str]] = mapped_column(String(100))
    modelo: Mapped[Optional[str]] = mapped_column(String(150))
    imei: Mapped[Optional[str]] = mapped_column(String(20))
    numero_linea: Mapped[Optional[str]] = mapped_column(String(20))
    operador: Mapped[Optional[str]] = mapped_column(String(60))
    id_sucursal: Mapped[int] = mapped_column(Integer)
    sucursal: Mapped[str] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    puesto_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    puesto: Mapped[Optional[str]] = mapped_column(String(220))
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20))
    responsable: Mapped[Optional[str]] = mapped_column(String(260))
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    fecha_asignacion: Mapped[Optional[date]] = mapped_column(Date)
    fecha_renovacion: Mapped[Optional[date]] = mapped_column(Date)
    dias_para_renovar: Mapped[Optional[int]] = mapped_column(Integer)
    vida_util_estado: Mapped[Optional[str]] = mapped_column(String(20))
    estado: Mapped[str] = mapped_column(String(30))
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


# ═══════════════════════════════════════════════════════════
# MÓDULO VEHÍCULOS (detalle satélite 1:1 con fct_registro_activos)
# ═══════════════════════════════════════════════════════════

class VehiculoDetalle(Base):
    """
    Modelo ORM para af.fct_vehiculo_detalle.
    Relación 1:1 con fct_registro_activos. Almacena atributos
    exclusivos de vehículos (placa, motor, chasis, etc.).
    """
    __tablename__ = "fct_vehiculo_detalle"
    __table_args__ = {"schema": "af"}

    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    placa: Mapped[str] = mapped_column(String(10), unique=True)
    anio_fabricacion: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    tipo_vehiculo: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    combustible: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    cilindrada_cc: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    nro_motor: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    nro_chasis: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    nro_tarjeta_prop: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    carroceria: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    categoria_vehiculo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    vencimiento_rev_tec: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())



# ═══════════════════════════════════════════════════════════
# MÓDULO SOAT (seguro obligatorio anual por vehículo)
# ═══════════════════════════════════════════════════════════

class Soat(Base):
    """
    Modelo ORM para af.fct_soat.
    Cada registro es una póliza SOAT emitida para un vehículo.
    El campo dias_vigencia se calcula en la vista vw_soat_vigencia.
    """
    __tablename__ = "fct_soat"
    __table_args__ = {"schema": "af"}

    id_soat: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cod_patrimonial: Mapped[str] = mapped_column(String(30))
    numero_poliza: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    compania_aseguradora: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date)
    fecha_vencimiento: Mapped[date] = mapped_column(Date)
    monto: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwSoatVigencia(Base):
    """
    Vista de solo lectura af.vw_soat_vigencia con días de vigencia
    y estado (VIGENTE / POR_VENCER / VENCIDO) calculados en BD.
    """
    __tablename__ = "vw_soat_vigencia"
    __table_args__ = {"schema": "af"}

    id_soat: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cod_patrimonial: Mapped[str] = mapped_column(String(30))
    placa: Mapped[Optional[str]] = mapped_column(String(10))
    denominacion: Mapped[str] = mapped_column(String(300))
    numero_poliza: Mapped[Optional[str]] = mapped_column(String(60))
    compania_aseguradora: Mapped[Optional[str]] = mapped_column(String(120))
    fecha_inicio: Mapped[date] = mapped_column(Date)
    fecha_vencimiento: Mapped[date] = mapped_column(Date)
    dias_vigencia: Mapped[Optional[int]] = mapped_column(Integer)
    estado_soat: Mapped[str] = mapped_column(String(20))
    monto: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    id_sucursal: Mapped[Optional[int]] = mapped_column(Integer)
    sucursal: Mapped[Optional[str]] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


# ═══════════════════════════════════════════════════════════
# MÓDULOS DE INVENTARIO FÍSICO Y BIENES DE TERCEROS/CONTROL
# ═══════════════════════════════════════════════════════════

class InventarioFisico(Base):
    """
    Modelo ORM para af.fct_inventario_fisico.
    """
    __tablename__ = "fct_inventario_fisico"
    __table_args__ = {"schema": "af"}

    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(15))
    cod_categoria: Mapped[int] = mapped_column(Integer)
    denominacion: Mapped[str] = mapped_column(String(300))
    marca: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    modelo: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    id_sucursal: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    localidad: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwInventarioFisicoDetalle(Base):
    """
    Modelo ORM para la vista af.vw_inventario_fisico_detalle.
    """
    __tablename__ = "vw_inventario_fisico_detalle"
    __table_args__ = {"schema": "af"}

    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(15))
    cod_categoria: Mapped[int] = mapped_column(Integer)
    categoria: Mapped[str] = mapped_column(String(180))
    subcategoria: Mapped[str] = mapped_column(String(220))
    denominacion: Mapped[str] = mapped_column(String(300))
    marca: Mapped[Optional[str]] = mapped_column(String(160))
    modelo: Mapped[Optional[str]] = mapped_column(String(180))
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180))
    color: Mapped[Optional[str]] = mapped_column(String(120))
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text)
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    id_sucursal: Mapped[Optional[int]] = mapped_column(Integer)
    sucursal: Mapped[Optional[str]] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class BienTercero(Base):
    """
    Modelo ORM para af.fct_bienes_terceros.
    """
    __tablename__ = "fct_bienes_terceros"
    __table_args__ = {"schema": "af"}

    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(15))
    denominacion: Mapped[str] = mapped_column(String(300))
    marca: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    modelo: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    id_sucursal: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    localidad: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())


class VwBienesTercerosDetalle(Base):
    """
    Modelo ORM para la vista af.vw_bienes_terceros_detalle.
    """
    __tablename__ = "vw_bienes_terceros_detalle"
    __table_args__ = {"schema": "af"}

    cod_patrimonial: Mapped[str] = mapped_column(String(30), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(15))
    denominacion: Mapped[str] = mapped_column(String(300))
    marca: Mapped[Optional[str]] = mapped_column(String(160))
    modelo: Mapped[Optional[str]] = mapped_column(String(180))
    numero_serie: Mapped[Optional[str]] = mapped_column(String(180))
    color: Mapped[Optional[str]] = mapped_column(String(120))
    caracteristicas_accesorios: Mapped[Optional[str]] = mapped_column(Text)
    cod_personal: Mapped[Optional[str]] = mapped_column(String(20))
    responsable: Mapped[Optional[str]] = mapped_column(String(260))
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    id_sucursal: Mapped[Optional[int]] = mapped_column(Integer)
    sucursal: Mapped[Optional[str]] = mapped_column(String(160))
    localidad: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(server_default=FetchedValue())

