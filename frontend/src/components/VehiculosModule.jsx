import React, { useState, useEffect, useCallback } from 'react';
import {
  Car, Plus, Pencil, Trash2, X, Save, Search, RefreshCw, Loader2,
  AlertCircle, Building2, User, Calendar, Tag,
  AlertTriangle, CheckCircle2, Hash, ChevronDown, Settings2, Info
} from 'lucide-react';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import {
  fetchActivos, fetchVehiculos, upsertVehiculoDetalle,
  fetchSucursales, fetchPuestos, fetchPersonal,
  createActivo, updateActivo, deleteActivo,
  fetchGenerarCodigoVehiculo, sincronizarPublico
} from '../utils/api';

const TIPOS_VEHICULO = ['CAMIONETA', 'CAMION', 'AUTOMOVIL', 'MOTO', 'MINIBUS', 'COMBI', 'OTRO'];
const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'GAS', 'ELECTRICO', 'HIBRIDO', 'PETROLEO'];

const VEHICLE_CATEGORIES = [
  { value: 40001, label: '40001 — CAMIONETAS' },
  { value: 40002, label: '40002 — MOTOCICLETAS' },
  { value: 40003, label: '40003 — MOTOCARGA' },
  { value: 40004, label: '40004 — MOTOKAR' },
  { value: 40005, label: '40005 — RETROEXCAVADORA' },
  { value: 40006, label: '40006 — CAMIONES CISTERNAS' },
  { value: 41001, label: '41001 — BICICLETAS' },
];

function Field({ label, required, icon: Icon, children, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-600 mb-1.5">
        {Icon && <Icon className="inline w-3.5 h-3.5 mr-1 opacity-60" />}
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── MODAL REGISTRO/EDICIÓN DE VEHÍCULO (UNIFICADO) ──────────────────────────
function VehiculoFormModal({ open, item, sucursales, personal, onSave, onClose }) {
  const [form, setForm] = useState({
    tipo_registro: 'ACTIVO_FIJO', // ACTIVO_FIJO | CONTROL_SUJETO
    cod_patrimonial: '',
    cod_categoria: 40001,
    denominacion: '',
    marca: '',
    modelo: '',
    color: '',
    numero_serie: '',
    id_sucursal: '',
    unidad: '',
    puesto_id: '',
    cod_personal: '',
    estado_activo: 'BUENO',

    placa: '',
    tipo_vehiculo: '',
    combustible: '',
    anio_fabricacion: '',
    cilindrada_cc: '',
    nro_motor: '',
    nro_chasis: '',
    nro_tarjeta_prop: '',
    carroceria: '',
    categoria_vehiculo: '',
    vencimiento_rev_tec: '',
  });

  const [puestos, setPuestos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('generales'); // generales | tecnica
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('generales');
    setError(null);
    if (item) {
      const isControl = item.cod_patrimonial?.startsWith('339');
      setForm({
        tipo_registro: isControl ? 'CONTROL_SUJETO' : 'ACTIVO_FIJO',
        cod_patrimonial: item.cod_patrimonial ?? '',
        cod_categoria: item.cod_categoria ?? 40001,
        denominacion: item.denominacion ?? '',
        marca: item.marca ?? '',
        modelo: item.modelo ?? '',
        color: item.color ?? '',
        numero_serie: item.numero_serie ?? '',
        id_sucursal: item.id_sucursal ?? '',
        unidad: item.unidad ?? '',
        puesto_id: item.puesto_id ?? '',
        cod_personal: item.cod_personal ?? '',
        estado_activo: item.estado_activo ?? 'BUENO',

        placa: item.placa ?? '',
        tipo_vehiculo: item.tipo_vehiculo ?? '',
        combustible: item.combustible ?? '',
        anio_fabricacion: item.anio_fabricacion ?? '',
        cilindrada_cc: item.cilindrada_cc ?? '',
        nro_motor: item.nro_motor ?? '',
        nro_chasis: item.nro_chasis ?? '',
        nro_tarjeta_prop: item.nro_tarjeta_prop ?? '',
        carroceria: item.carroceria ?? '',
        categoria_vehiculo: item.categoria_vehiculo ?? '',
        vencimiento_rev_tec: item.vencimiento_rev_tec ?? '',
      });
    } else {
      setForm({
        tipo_registro: 'ACTIVO_FIJO',
        cod_patrimonial: '',
        cod_categoria: 40001,
        denominacion: '',
        marca: '',
        modelo: '',
        color: '',
        numero_serie: '',
        id_sucursal: '',
        unidad: '',
        puesto_id: '',
        cod_personal: '',
        estado_activo: 'BUENO',

        placa: '',
        tipo_vehiculo: '',
        combustible: '',
        anio_fabricacion: '',
        cilindrada_cc: '',
        nro_motor: '',
        nro_chasis: '',
        nro_tarjeta_prop: '',
        carroceria: '',
        categoria_vehiculo: '',
        vencimiento_rev_tec: '',
      });
    }
  }, [open, item]);

  useEffect(() => {
    if (form.id_sucursal) {
      fetchPuestos(form.id_sucursal).then(setPuestos).catch(() => setPuestos([]));
    } else {
      setPuestos([]);
    }
  }, [form.id_sucursal]);

  // Sincronizar tipo_vehiculo con la subcategoría seleccionada
  useEffect(() => {
    if (form.cod_categoria) {
      const catObj = VEHICLE_CATEGORIES.find(c => Number(c.value) === Number(form.cod_categoria));
      if (catObj) {
        const cleanLabel = catObj.label.includes(' — ') ? catObj.label.split(' — ')[1] : catObj.label;
        if (form.tipo_vehiculo !== cleanLabel) {
          setForm(prev => ({ ...prev, tipo_vehiculo: cleanLabel }));
        }
      }
    }
  }, [form.cod_categoria, form.tipo_vehiculo]);

  const set = (k, v) => {
    setError(null);
    setForm(p => ({ ...p, [k]: v }));
  };

  const generarCodigo = async () => {
    if (!form.id_sucursal) {
      setError('Selecciona primero la sucursal para generar el código.');
      return;
    }
    setGenerando(true);
    try {
      const res = await fetchGenerarCodigoVehiculo(form.id_sucursal);
      set('cod_patrimonial', res.codigo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const validate = () => {
    if (!form.id_sucursal) {
      setError('La Sucursal es obligatoria.');
      setTab('generales');
      return false;
    }
    if (!form.cod_patrimonial.trim()) {
      setError('El Código Patrimonial es obligatorio.');
      setTab('generales');
      return false;
    }
    if (!form.denominacion.trim()) {
      setError('La Denominación es obligatoria.');
      setTab('generales');
      return false;
    }
    if (!form.placa.trim()) {
      setError('La Placa es obligatoria.');
      setTab('tecnica');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const assetPayload = {
        cod_patrimonial: form.cod_patrimonial.trim().toUpperCase(),
        documento_tipo: 'COMPRA',
        n_doc_compra: '0000000',
        cod_categoria: Number(form.cod_categoria),
        denominacion: form.denominacion.trim(),
        color: form.color.trim() || null,
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        numero_serie: form.numero_serie.trim() || null,
        id_sucursal: Number(form.id_sucursal),
        unidad: form.unidad.trim() || null,
        puesto_id: form.puesto_id ? Number(form.puesto_id) : null,
        cod_personal: form.cod_personal || null,
        estado_activo: form.estado_activo,
        
        fecha_alta_factura: new Date().toISOString().split('T')[0],
        fecha_registro_contable: new Date().toISOString().split('T')[0],
        compra_fecha_oc: new Date().toISOString().split('T')[0],
        compra_id_localidad: 101,
        compra_nota_pedido: '0000000',
        compra_certificacion_presupuestal: '0000',
        compra_cuenta_contable: '0000000000',
        compra_centro_costo: '00000000',
        compra_id_fuente: 1,
        compra_requerido_por: 'CONTROL PATRIMONIAL',
        compra_concepto: 'REGISTRO VEHICULO',
        valor_en_libros: 0,
        igv: 0,
        vida_util_anios: 0,
      };

      if (item) {
        await updateActivo(item.cod_patrimonial, assetPayload);
      } else {
        await createActivo(assetPayload);
      }

      const vehicleDetailPayload = {
        placa: form.placa.trim().toUpperCase(),
        tipo_vehiculo: form.tipo_vehiculo || null,
        combustible: form.combustible || null,
        anio_fabricacion: form.anio_fabricacion ? Number(form.anio_fabricacion) : null,
        cilindrada_cc: form.cilindrada_cc ? Number(form.cilindrada_cc) : null,
        nro_motor: form.nro_motor.trim() || null,
        nro_chasis: form.nro_chasis.trim() || null,
        nro_tarjeta_prop: form.nro_tarjeta_prop.trim() || null,
        carroceria: form.carroceria.trim() || null,
        categoria_vehiculo: form.categoria_vehiculo.trim().toUpperCase() || null,
        vencimiento_rev_tec: form.vencimiento_rev_tec || null,
      };
      await upsertVehiculoDetalle(assetPayload.cod_patrimonial, vehicleDetailPayload);
      await sincronizarPublico().catch(() => {});

      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'generales', label: '📋 Datos Generales' },
    { id: 'tecnica', label: '🚗 Ficha Técnica' },
  ];

  return (
    <Modal open={open} onClose={onClose} maxWidth="650px">
      <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0 shadow-amber-500/30">
          <Car className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">
            {item ? 'Editar Vehículo' : 'Registrar Nuevo Vehículo'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro completo de vehículos (activos fijos o sujetos a control)
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 px-6 pt-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
              tab === t.id
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/25'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ minHeight: 0 }}>
        {error && (
          <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {tab === 'generales' && (
          <div className="space-y-4">
            {!item && (
              <Field label="Tipo de Registro">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo_registro"
                      value="ACTIVO_FIJO"
                      checked={form.tipo_registro === 'ACTIVO_FIJO'}
                      onChange={() => set('tipo_registro', 'ACTIVO_FIJO')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    Activo Fijo Contable
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo_registro"
                      value="CONTROL_SUJETO"
                      checked={form.tipo_registro === 'CONTROL_SUJETO'}
                      onChange={() => set('tipo_registro', 'CONTROL_SUJETO')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    Sujeto a Control (No Activo Fijo)
                  </label>
                </div>
              </Field>
            )}

            <Field label="Sucursal" required icon={Building2}>
              <SearchableSelect
                options={sucursales.map(s => ({ value: s.value, label: s.label }))}
                value={form.id_sucursal}
                onChange={e => {
                  set('id_sucursal', e.target.value);
                  set('puesto_id', '');
                }}
                placeholder="Selecciona una sucursal..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
              <Field label="Código Patrimonial" required icon={Tag} className="flex-1">
                <input
                  type="text"
                  value={form.cod_patrimonial}
                  onChange={e => set('cod_patrimonial', e.target.value.toUpperCase())}
                  placeholder="Ej: AF-2024-001"
                  disabled={form.tipo_registro === 'CONTROL_SUJETO' && !item}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </Field>
              {form.tipo_registro === 'CONTROL_SUJETO' && !item && (
                <button
                  onClick={generarCodigo}
                  disabled={generando}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer h-[38px] transition-all disabled:opacity-50 border-none"
                >
                  {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                  Auto-código
                </button>
              )}
            </div>

            <Field label="Categoría de Vehículo" required icon={Tag}>
              <div className="relative">
                <select
                  value={form.cod_categoria}
                  onChange={e => set('cod_categoria', e.target.value)}
                  className="appearance-none block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                >
                  {VEHICLE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </Field>

            <Field label="Denominación" required>
              <input
                type="text"
                value={form.denominacion}
                onChange={e => set('denominacion', e.target.value)}
                placeholder="Ej: CAMIONETA TOYOTA HILUX 4X4"
                maxLength={300}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Marca">
                <input
                  type="text"
                  value={form.marca}
                  onChange={e => set('marca', e.target.value)}
                  placeholder="Ej: Toyota"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </Field>
              <Field label="Modelo">
                <input
                  type="text"
                  value={form.modelo}
                  onChange={e => set('modelo', e.target.value)}
                  placeholder="Ej: Hilux"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </Field>
              <Field label="Color">
                <input
                  type="text"
                  value={form.color}
                  onChange={e => set('color', e.target.value)}
                  placeholder="Ej: Blanco"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </Field>
              <Field label="Nro. Serie / Motor Fab.">
                <input
                  type="text"
                  value={form.numero_serie}
                  onChange={e => set('numero_serie', e.target.value)}
                  placeholder="Ej: SER-XXXXXXX"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Responsable" icon={User}>
                <SearchableSelect
                  options={personal.map(p => ({ value: p.value, label: p.label }))}
                  value={form.cod_personal}
                  onChange={e => set('cod_personal', e.target.value)}
                  placeholder="Buscar personal..."
                />
              </Field>
              <Field label="Puesto">
                <SearchableSelect
                  options={puestos.map(p => ({ value: p.value, label: p.label }))}
                  value={form.puesto_id}
                  onChange={e => set('puesto_id', e.target.value)}
                  placeholder={form.id_sucursal ? 'Selecciona puesto...' : 'Elige sucursal primero'}
                  disabled={!form.id_sucursal}
                />
              </Field>
              <Field label="Unidad Orgánica">
                <input
                  type="text"
                  value={form.unidad}
                  onChange={e => set('unidad', e.target.value)}
                  placeholder="Ej: Servicios"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </Field>
              <Field label="Estado Físico">
                <div className="relative">
                  <select
                    value={form.estado_activo}
                    onChange={e => set('estado_activo', e.target.value)}
                    className="appearance-none block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                  >
                    <option value="BUENO">Bueno</option>
                    <option value="REGULAR">Regular</option>
                    <option value="MALO">Malo</option>
                    <option value="PARA BAJA">Para Baja</option>
                    <option value="BAJA">Baja</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </Field>
            </div>
            <button
              onClick={() => {
                if (!form.id_sucursal) { setError('La Sucursal es obligatoria.'); return; }
                if (!form.cod_patrimonial.trim()) { setError('El Código Patrimonial es obligatorio.'); return; }
                if (!form.denominacion.trim()) { setError('La Denominación es obligatoria.'); return; }
                setTab('tecnica');
                setError(null);
              }}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer border-none"
            >
              Continuar a Ficha Técnica →
            </button>
          </div>
        )}

        {tab === 'tecnica' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Placa *" required icon={Tag}>
              <input
                type="text"
                value={form.placa}
                onChange={e => set('placa', e.target.value.toUpperCase())}
                placeholder="ABC-123"
                maxLength={10}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Tipo de Vehículo">
              <input
                type="text"
                value={form.tipo_vehiculo}
                disabled
                className="block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 cursor-not-allowed"
                placeholder="Autodetectado por subcategoría..."
              />
            </Field>

            <Field label="Año de Fabricación">
              <input
                type="number"
                value={form.anio_fabricacion}
                onChange={e => set('anio_fabricacion', e.target.value)}
                placeholder={new Date().getFullYear()}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Combustible">
              <div className="relative">
                <select
                  value={form.combustible}
                  onChange={e => set('combustible', e.target.value)}
                  className="appearance-none block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="">Seleccionar...</option>
                  {COMBUSTIBLES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </Field>

            <Field label="Cilindrada (cc)">
              <input
                type="number"
                value={form.cilindrada_cc}
                onChange={e => set('cilindrada_cc', e.target.value)}
                placeholder="Ej: 2000"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Nro. Tarjeta de Propiedad">
              <input
                type="text"
                value={form.nro_tarjeta_prop}
                onChange={e => set('nro_tarjeta_prop', e.target.value)}
                placeholder="Ej: T00000000"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Nro. Motor">
              <input
                type="text"
                value={form.nro_motor}
                onChange={e => set('nro_motor', e.target.value)}
                placeholder="Motor"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Nro. Chasis / VIN">
              <input
                type="text"
                value={form.nro_chasis}
                onChange={e => set('nro_chasis', e.target.value)}
                placeholder="Chasis"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Carrocería">
              <input
                type="text"
                value={form.carroceria}
                onChange={e => set('carroceria', e.target.value)}
                placeholder="Ej: PICKUP, SEDAN"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Categoría">
              <input
                type="text"
                value={form.categoria_vehiculo}
                onChange={e => set('categoria_vehiculo', e.target.value.toUpperCase())}
                placeholder="Ej: M1, N1"
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>

            <Field label="Vencimiento Rev. Técnica">
              <input
                type="date"
                value={form.vencimiento_rev_tec}
                onChange={e => set('vencimiento_rev_tec', e.target.value)}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <button onClick={onClose} disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer bg-none">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 rounded-xl transition-all active:scale-[0.98] border-none cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : item ? 'Actualizar Vehículo' : 'Registrar Vehículo'}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteVehiculoModal({ item, onConfirm, onClose }) {
  return (
    <Modal open={!!item} onClose={onClose} maxWidth="400px">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Eliminar Vehículo</h3>
            <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          ¿Confirmas la eliminación de{' '}
          <strong className="text-slate-800">{item?.denominacion}</strong>
          {item?.placa ? ` con placa ${item.placa}` : ''}?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border-none cursor-pointer">Cancelar</button>
          <button onClick={() => onConfirm(item)} className="flex-1 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors border-none cursor-pointer">Eliminar</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function VehiculosModule() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [filtroEstadoRev, setFiltroEstadoRev] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [busqueda, setBusqueda] = useState('');
  
  const [sucursales, setSucursales] = useState([]);
  const [personal, setPersonal] = useState([]);
  
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activosList, techDetails] = await Promise.all([
        fetchActivos(),
        fetchVehiculos()
      ]);

      const baseVehicles = activosList.filter(
        a => (a.categoria && a.categoria.toLowerCase().startsWith('vehiculo')) ||
             (a.cod_categoria && String(a.cod_categoria).startsWith('4'))
      );

      const combined = baseVehicles.map(veh => {
        const detail = techDetails.find(d => d.cod_patrimonial === veh.cod_patrimonial) || {};
        return {
          ...veh,
          placa: detail.placa || '',
          anio_fabricacion: detail.anio_fabricacion || '',
          tipo_vehiculo: detail.tipo_vehiculo || '',
          combustible: detail.combustible || '',
          cilindrada_cc: detail.cilindrada_cc || '',
          nro_motor: detail.nro_motor || '',
          nro_chasis: detail.nro_chasis || '',
          nro_tarjeta_prop: detail.nro_tarjeta_prop || '',
          carroceria: detail.carroceria || '',
          categoria_vehiculo: detail.categoria_vehiculo || '',
          vencimiento_rev_tec: detail.vencimiento_rev_tec || '',
          dias_vigencia_rev_tec: detail.dias_vigencia_rev_tec !== undefined ? detail.dias_vigencia_rev_tec : null,
          estado_rev_tec: detail.estado_rev_tec || null,
        };
      });

      setVehicles(combined);
    } catch (e) {
      setError(e.message || 'Error al sincronizar datos del módulo vehículos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchSucursales().then(setSucursales).catch(() => {});
    fetchPersonal().then(setPersonal).catch(() => {});
  }, [loadData]);

  // Filtrado
  const filtered = vehicles.filter(v => {
    if (filtroEstadoRev) {
      if (filtroEstadoRev === 'SIN_REV' && v.vencimiento_rev_tec) return false;
      if (filtroEstadoRev !== 'SIN_REV' && v.estado_rev_tec !== filtroEstadoRev) return false;
    }
    if (filtroSucursal && Number(v.id_sucursal) !== Number(filtroSucursal)) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return [v.cod_patrimonial, v.denominacion, v.placa, v.responsable, v.marca, v.modelo]
      .some(val => val?.toLowerCase().includes(q));
  });

  const total = vehicles.length;
  const revVigentes = vehicles.filter(v => v.estado_rev_tec === 'VIGENTE').length;
  const revVencidas = vehicles.filter(v => v.estado_rev_tec === 'VENCIDO').length;
  const revPorVencer = vehicles.filter(v => v.estado_rev_tec === 'POR_VENCER').length;

  const onSaved = () => {
    setShowForm(false);
    setEditItem(null);
    loadData();
  };

  const handleDelete = async (item) => {
    try {
      await deleteActivo(item.cod_patrimonial);
      setDeleteItem(null);
      loadData();
      await sincronizarPublico().catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div className="module-heading">
          <p className="module-kicker">Gestión de activos vehiculares</p>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
            <Car className="w-6 h-6 text-brand-500" />
            Control de Vehículos
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Flota de vehículos y sus características técnicas particulares
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadData} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors border border-slate-200 cursor-pointer bg-white" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditItem(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-[#00B0F0] text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/25 hover:from-brand-700 hover:to-[#009FD6] transition-all active:scale-[0.98] border-none cursor-pointer">
            <Plus className="w-4 h-4" />
            Registrar Vehículo
          </button>
        </div>
      </div>

      {/* METRICAS */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Car className="w-4.5 h-4.5" /></div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 leading-none">{total}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Vehículos en Flota</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-4.5 h-4.5" /></div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-800 leading-none">{revVigentes}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Rev. Técnica Vigentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-amber-600"><AlertTriangle className="w-4.5 h-4.5" /></div>
            <div>
              <p className="text-2xl font-extrabold text-amber-800 leading-none">{revPorVencer}</p>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Rev. Técnica Por Vencer</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-rose-600"><AlertCircle className="w-4.5 h-4.5" /></div>
            <div>
              <p className="text-2xl font-extrabold text-rose-800 leading-none">{revVencidas}</p>
              <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Rev. Técnica Vencidas</p>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar por placa, denominación, responsable, marca..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="block w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-semibold" style={{ minHeight: '2.5rem' }} />
        </div>

        <div className="relative">
          <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
            className="appearance-none block w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all cursor-pointer" style={{ minHeight: '2.5rem' }}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {[['', 'Todas'], ['VIGENTE', 'Rev. Vigente'], ['POR_VENCER', 'Por Vencer'], ['VENCIDO', 'Rev. Vencida'], ['SIN_REV', 'Sin Rev. Técnica']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroEstadoRev(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                filtroEstadoRev === val
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 bg-none'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* TABLA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando flota de vehículos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Car className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No se encontraron vehículos</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">
              Prueba con otros filtros o registra el primer vehículo
            </p>
            {!busqueda && !filtroSucursal && !filtroEstadoRev && (
              <button onClick={() => { setEditItem(null); setShowForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl transition-all cursor-pointer border-none mx-auto">
                <Plus className="w-4 h-4" /> Registrar Vehículo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  {['Vehículo / Cod.', 'Placa', 'Tipo / Características', 'Sucursal / Asignado', 'Rev. Técnica', 'Estado Físico', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(v => (
                  <tr key={v.cod_patrimonial} className="transition-colors group hover:bg-slate-50/50">
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-semibold text-slate-800 text-xs leading-tight truncate" title={v.denominacion}>{v.denominacion}</p>
                      <p className="font-mono text-slate-400 text-[10px] mt-0.5">{v.cod_patrimonial}</p>
                    </td>
                    <td className="px-4 py-3">
                      {v.placa ? (
                        <span className="font-mono font-bold text-slate-700 bg-slate-900 text-white px-2 py-0.5 rounded-lg text-xs tracking-wider shadow-sm">
                          {v.placa}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sin placa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-700">
                        {v.tipo_vehiculo || '—'} {v.anio_fabricacion ? `(${v.anio_fabricacion})` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {v.carroceria ? `Carrocería: ${v.carroceria} ` : ''} 
                        {v.categoria_vehiculo ? `· Cat: ${v.categoria_vehiculo} ` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {v.combustible ? `${v.combustible}` : ''} {v.cilindrada_cc ? `· ${v.cilindrada_cc} cc` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-700">{v.sucursal || '—'}</p>
                      <p className="text-slate-400 mt-0.5">{v.responsable || 'Sin asignar'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        if (!v.vencimiento_rev_tec) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 bg-slate-100 text-slate-600 ring-slate-200">
                              Sin Rev. Tec.
                            </span>
                          );
                        }
                        const revState = v.estado_rev_tec || 'VIGENTE';
                        const badgeClass = revState === 'VIGENTE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                                           revState === 'POR_VENCER' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                                           'bg-rose-50 text-rose-700 ring-rose-200';
                        return (
                          <div className="flex flex-col gap-1">
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${badgeClass}`}>
                                {revState === 'POR_VENCER' ? 'Por Vencer' : revState}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              vence: <strong>{new Date(v.vencimiento_rev_tec + 'T00:00:00').toLocaleDateString('es-PE')}</strong>
                              {v.dias_vigencia_rev_tec !== null && (
                                <span className={`ml-1 font-bold ${v.dias_vigencia_rev_tec < 0 ? 'text-rose-600' : v.dias_vigencia_rev_tec <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  ({v.dias_vigencia_rev_tec < 0 ? `venció hace ${Math.abs(v.dias_vigencia_rev_tec)}d` : `${v.dias_vigencia_rev_tec}d rest.`})
                                </span>
                              )}
                            </p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.estado_activo === 'BUENO' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                        v.estado_activo === 'REGULAR' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                        'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                      }`}>{v.estado_activo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(v); setShowForm(true); }} title="Editar Vehículo"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors border-none cursor-pointer bg-none">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteItem(v)} title="Eliminar"
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border-none cursor-pointer bg-none">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Mostrando <strong>{filtered.length}</strong> de <strong>{vehicles.length}</strong> vehículos
          </div>
        )}
      </div>

      {/* MODALES */}
      <VehiculoFormModal
        open={showForm}
        item={editItem}
        sucursales={sucursales}
        personal={personal}
        onSave={onSaved}
        onClose={() => { setShowForm(false); setEditItem(null); }}
      />

      <ConfirmDeleteVehiculoModal
        item={deleteItem}
        onConfirm={handleDelete}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}
