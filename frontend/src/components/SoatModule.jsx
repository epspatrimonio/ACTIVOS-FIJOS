import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Save, Search,
  AlertTriangle, AlertCircle, CheckCircle2, Loader2, RefreshCw,
  History, Car, Calendar, Building2, DollarSign, Hash,
  Clock, TrendingDown, ChevronDown, ChevronRight
} from 'lucide-react';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import { fetchSoat, createSoat, updateSoat, deleteSoat, fetchSoatPorVehiculo, fetchActivos, fetchSucursales, fetchLocalidades, fetchVehiculos } from '../utils/api';

// ─── Config estados SOAT ──────────────────────────────────────────────────────
const ESTADOS = {
  VIGENTE:    { label: 'Vigente',      icon: CheckCircle2, bar: '#22c55e', row: '',                   card: 'border-emerald-200 bg-emerald-50/30', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  POR_VENCER: { label: 'Por Vencer',   icon: AlertTriangle, bar: '#f59e0b', row: 'bg-amber-50/50',    card: 'border-amber-200 bg-amber-50/40',    badge: 'bg-amber-50  text-amber-700  ring-amber-200' },
  VENCIDO:    { label: 'Vencido',      icon: AlertCircle,  bar: '#ef4444', row: 'bg-rose-50/40',      card: 'border-rose-200 bg-rose-50/30',      badge: 'bg-rose-50   text-rose-700   ring-rose-200' },
};

const COMPANIAS = ['Rímac', 'Mapfre', 'La Positiva', 'Pacífico', 'HDI', 'Secrex'];

const EMPTY = {
  cod_patrimonial: '', numero_poliza: '', compania_aseguradora: '',
  fecha_inicio: '', fecha_vencimiento: '', monto: '', observaciones: '',
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function SoatBadge({ estado }) {
  const cfg = ESTADOS[estado] ?? ESTADOS.VIGENTE;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${cfg.badge}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Barra de días vigencia ───────────────────────────────────────────────────
function VigenciaBar({ dias, estado }) {
  const max = 365;
  const pct = Math.max(0, Math.min(100, (dias / max) * 100));
  const cfg = ESTADOS[estado] ?? ESTADOS.VIGENTE;
  return (
    <div className="vigor-bar-track" style={{width:'80px'}}>
      <div className="vigor-bar-fill" style={{ width: `${pct}%`, background: cfg.bar }} />
    </div>
  );
}

// ─── Tarjeta de resumen superior ─────────────────────────────────────────────
function ResumenCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${bg}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} bg-white/60`}>
        <Icon className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── CAMPO DE FORMULARIO ─────────────────────────────────────────────────────
function Field({ label, required, icon: Icon, children, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="field-label">
        {Icon && <Icon className="inline w-3.5 h-3.5 mr-1 opacity-60" />}
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── MODAL HISTORIAL ─────────────────────────────────────────────────────────
function HistorialModal({ open, vehiculo, onClose }) {
  const [hist, setHist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehiculo) return;
    fetchSoatPorVehiculo(vehiculo.cod_patrimonial)
      .then(setHist).catch(() => {}).finally(() => setLoading(false));
  }, [vehiculo]);

  return (
    <Modal open={open} onClose={onClose} maxWidth="560px">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-slate-900 text-base">Historial SOAT</h3>
          <p className="text-xs text-slate-500 truncate">
            {vehiculo?.placa ? `Placa ${vehiculo.placa} — ` : ''}{vehiculo?.denominacion}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : hist.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Sin registros SOAT para este vehículo.</p>
        ) : (
          hist.map((r, i) => {
            const cfg = ESTADOS[r.estado_soat] ?? ESTADOS.VIGENTE;
            const isLatest = i === 0;
            return (
              <div key={r.id_soat} className={`relative p-4 rounded-xl border-2 ${isLatest ? cfg.card : 'border-slate-200 bg-slate-50 opacity-75'}`}>
                {isLatest && (
                  <span className="absolute top-3 right-3 text-[10px] font-extrabold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full ring-1 ring-brand-200">
                    Actual
                  </span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <SoatBadge estado={r.estado_soat} />
                  {r.numero_poliza && (
                    <span className="text-[11px] font-mono text-slate-400 ml-auto">#{r.numero_poliza}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-600">
                  <div><span className="font-semibold text-slate-500">Aseguradora:</span> {r.compania_aseguradora || '—'}</div>
                  <div><span className="font-semibold text-slate-500">Inicio:</span> {r.fecha_inicio ? new Date(r.fecha_inicio+'T00:00:00').toLocaleDateString('es-PE') : '—'}</div>
                  <div><span className="font-semibold text-slate-500">Vencimiento:</span> <strong>{r.fecha_vencimiento ? new Date(r.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE') : '—'}</strong></div>
                  {r.monto && <div><span className="font-semibold text-slate-500">Monto:</span> S/ {parseFloat(r.monto).toFixed(2)}</div>}
                </div>
                {r.dias_vigencia !== null && (
                  <div className="flex items-center gap-2 mt-3">
                    <VigenciaBar dias={r.dias_vigencia} estado={r.estado_soat} />
                    <span className={`text-[11px] font-bold ${r.dias_vigencia < 0 ? 'text-rose-600' : r.dias_vigencia <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {r.dias_vigencia < 0 ? `Venció hace ${Math.abs(r.dias_vigencia)} días` : `${r.dias_vigencia} días restantes`}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

// ─── MODAL FORMULARIO ─────────────────────────────────────────────────────────
function SoatFormModal({ open, item, vehicles = [], onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      setForm({
        cod_patrimonial: item.cod_patrimonial ?? '',
        numero_poliza: item.numero_poliza ?? '',
        compania_aseguradora: item.compania_aseguradora ?? '',
        fecha_inicio: item.fecha_inicio ?? '',
        fecha_vencimiento: item.fecha_vencimiento ?? '',
        monto: item.monto ?? '',
        observaciones: item.observaciones ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, item]);

  const set = (k, v) => { setError(null); setForm(p => ({ ...p, [k]: v })); };

  // Calcular opciones del select
  const vehicleOptions = vehicles.map(v => {
    const placaStr = v.placa ? `[${v.placa}]` : '[Sin Placa]';
    return {
      value: v.cod_patrimonial,
      label: `${placaStr} ${v.cod_patrimonial} - ${v.denominacion}`
    };
  });

  // Calcular días de vigencia en tiempo real
  const diasVigencia = (() => {
    if (!form.fecha_vencimiento) return null;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const venc = new Date(form.fecha_vencimiento + 'T00:00:00');
    return Math.round((venc - hoy) / 86400000);
  })();

  const estadoPreview = diasVigencia === null ? null : diasVigencia < 0 ? 'VENCIDO' : diasVigencia <= 30 ? 'POR_VENCER' : 'VIGENTE';

  const handleSave = async () => {
    if (!form.cod_patrimonial.trim()) { setError('El Código Patrimonial es obligatorio.'); return; }
    if (!form.fecha_inicio)           { setError('La Fecha de Inicio es obligatoria.'); return; }
    if (!form.fecha_vencimiento)      { setError('La Fecha de Vencimiento es obligatoria.'); return; }
    if (form.fecha_vencimiento <= form.fecha_inicio) { setError('La fecha de vencimiento debe ser posterior a la de inicio.'); return; }

    setSaving(true); setError(null);
    try {
      const payload = { ...form, monto: form.monto ? parseFloat(form.monto) : null };
      if (item) { await updateSoat(item.id_soat, payload); }
      else       { await createSoat(payload); }
      onSave();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const isRenew = !!item;

  return (
    <Modal open={open} onClose={onClose} maxWidth="620px">
      {/* HEADER */}
      <div className={`flex items-center gap-4 px-6 py-5 border-b border-slate-100 ${isRenew ? 'bg-gradient-to-r from-amber-50 to-white' : ''}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${isRenew ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-400/30' : 'bg-gradient-to-br from-brand-600 to-[#00B0F0] shadow-brand-500/30'}`}>
          {isRenew ? <RefreshCw className="w-5 h-5 text-white" /> : <ShieldCheck className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">
            {isRenew ? 'Renovar / Editar SOAT' : 'Registrar Nuevo SOAT'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRenew
              ? 'Actualiza la fecha de vencimiento para renovar el seguro'
              : 'Registra una nueva póliza SOAT para un vehículo de la flota'}
          </p>
        </div>
        {isRenew && item.placa && (
          <div className="shrink-0 bg-slate-900 text-white text-xs font-bold font-mono px-3 py-1.5 rounded-xl shadow-sm">
            {item.placa}
          </div>
        )}
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{minHeight:0}}>
        {error && (
          <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Vehículo */}
        <div>
          <div className="form-section-label">Vehículo</div>
          {isRenew ? (
            <Field label="Vehículo (No modificable en renovación)" icon={Car}>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold text-sm">
                {item?.placa ? `[${item.placa}] ` : ''}{form.cod_patrimonial} — {item?.denominacion || ''}
              </div>
            </Field>
          ) : (
            <Field label="Buscar Vehículo (por Placa o Código)" required icon={Car}>
              <SearchableSelect
                options={vehicleOptions}
                value={form.cod_patrimonial}
                onChange={e => set('cod_patrimonial', e.target.value)}
                placeholder="Buscar por placa o código patrimonial..."
              />
            </Field>
          )}
        </div>



        {/* Vigencia */}
        <div>
          <div className="form-section-label">Período de Vigencia</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha de Inicio" required icon={Calendar}>
              <input type="date" className="field-input"
                value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </Field>

            <Field label="Fecha de Vencimiento" required icon={Calendar}
              hint={isRenew ? '⟳ Cambia solo esta fecha para renovar' : undefined}>
              <input type="date" className={`field-input ${isRenew ? 'ring-2 ring-amber-400/40 border-amber-400 bg-amber-50' : ''}`}
                value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
            </Field>
          </div>

          {/* Preview vigencia en tiempo real */}
          {estadoPreview && (
            <div className={`mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${ESTADOS[estadoPreview].card}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <SoatBadge estado={estadoPreview} />
                  <span className="text-xs text-slate-500 font-semibold">con las fechas ingresadas</span>
                </div>
                <VigenciaBar dias={diasVigencia} estado={estadoPreview} />
              </div>
              <div className={`text-right text-sm font-extrabold ${diasVigencia < 0 ? 'text-rose-700' : diasVigencia <= 30 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {diasVigencia < 0
                  ? `${Math.abs(diasVigencia)} días vencido`
                  : `${diasVigencia} días vigentes`}
              </div>
            </div>
          )}
        </div>

        {/* Observaciones */}
        <Field label="Observaciones">
          <textarea className="field-input resize-none" rows={2}
            placeholder="Notas adicionales sobre la póliza..."
            value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </Field>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <button onClick={onClose} disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-60 ${
            isRenew
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-400/25 hover:from-amber-600 hover:to-orange-600'
              : 'bg-gradient-to-r from-brand-600 to-[#00B0F0] shadow-brand-500/25 hover:from-brand-700 hover:to-[#009FD6]'
          }`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {saving ? 'Guardando...' : (isRenew ? 'Guardar Renovación' : 'Registrar SOAT')}
        </button>
      </div>
    </Modal>
  );
}

// ─── MODAL ELIMINAR ───────────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, onConfirm, onClose }) {
  return (
    <Modal open={!!item} onClose={onClose} maxWidth="400px">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Eliminar Registro SOAT</h3>
            <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          ¿Confirmas la eliminación del SOAT de{' '}
          <strong className="text-slate-800">{item?.denominacion}</strong>
          {item?.placa ? ` — placa ${item.placa}` : ''}?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={() => onConfirm(item)} className="flex-1 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">Eliminar</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function SoatModule() {
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const [registros, setRegistros] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [historialItem, setHistorialItem] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [localidades, setLocalidades] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, activosList, techDetails] = await Promise.all([
        fetchSoat(),
        fetchActivos(),
        fetchVehiculos()
      ]);

      const combined = d.map(r => {
        const detail = techDetails.find(v => v.cod_patrimonial === r.cod_patrimonial) || {};
        const asset = activosList.find(v => v.cod_patrimonial === r.cod_patrimonial) || {};
        return {
          ...r,
          tipo_vehiculo: detail.tipo_vehiculo || '—',
          vencimiento_rev_tec: detail.vencimiento_rev_tec || '',
          dias_vigencia_rev_tec: detail.dias_vigencia_rev_tec !== undefined ? detail.dias_vigencia_rev_tec : null,
          estado_rev_tec: detail.estado_rev_tec || null,
          fecha_alta_factura: asset.fecha_alta_factura || '',
          fecha_registro_contable: asset.fecha_registro_contable || '',
          estado_activo: asset.estado_activo || '',
        };
      }).filter(r => r.estado_activo !== 'PARA BAJA' && r.estado_activo !== 'BAJA');

      setRegistros(combined);
      
      const baseVehicles = activosList.filter(
        a => ((a.categoria && a.categoria.toLowerCase().startsWith('vehiculo')) ||
             (a.cod_categoria && String(a.cod_categoria).startsWith('4'))) &&
             a.estado_activo !== 'PARA BAJA' && a.estado_activo !== 'BAJA'
      );
      setVehicles(baseVehicles);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    fetchSucursales().then(setSucursales).catch(() => {});
    fetchLocalidades().then(setLocalidades).catch(() => {});
  }, [load]);

  const filtered = registros.filter(r => {
    if (filtroEstado && r.estado_soat !== filtroEstado) return false;
    if (filtroSucursal && Number(r.id_sucursal) !== Number(filtroSucursal)) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return [r.placa, r.denominacion, r.tipo_vehiculo, r.numero_poliza].some(v => v?.toLowerCase().includes(q));
  });

  const vencidos = registros.filter(r => r.estado_soat === 'VENCIDO').length;
  const porVencer = registros.filter(r => r.estado_soat === 'POR_VENCER').length;
  const vigentes = registros.filter(r => r.estado_soat === 'VIGENTE').length;

  const onSaved = () => { setShowForm(false); setEditItem(null); load(); };
  const handleDelete = async (item) => {
    try { await deleteSoat(item.id_soat); setDeleteItem(null); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="module-heading">
          <p className="module-kicker">Control de seguros obligatorios</p>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            SOAT — Vigencia de Seguros
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Seguimiento de renovaciones anuales con alertas de vencimiento automáticas
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditItem(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-[#00B0F0] text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/25 hover:from-brand-700 hover:to-[#009FD6] transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4" />
            Registrar SOAT
          </button>
        </div>
      </div>

      {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
      {registros.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <ResumenCard label="SOAT Vigentes"         value={vigentes}  icon={CheckCircle2} color="text-emerald-700" bg="border-emerald-200 bg-emerald-50/60" />
          <ResumenCard label="Por Vencer (≤30 días)" value={porVencer} icon={AlertTriangle} color="text-amber-700"  bg={`border-amber-200 ${porVencer > 0 ? 'bg-amber-50/80' : 'bg-slate-50'}`} />
          <ResumenCard label="SOAT Vencidos"         value={vencidos}  icon={AlertCircle}  color="text-rose-700"   bg={`border-rose-200 ${vencidos > 0 ? 'bg-rose-50/80' : 'bg-slate-50'}`} />
        </div>
      )}

      {/* ── AVISO URGENTE ───────────────────────────────────────────────── */}
      {(vencidos > 0 || porVencer > 0) && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 ${
          vencidos > 0 ? 'bg-rose-50 border-rose-500 text-rose-800' : 'bg-amber-50 border-amber-500 text-amber-800'
        }`}>
          {vencidos > 0
            ? <><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span className="text-sm font-semibold"><strong>{vencidos}</strong> vehículo(s) con SOAT <strong>vencido</strong>. Renueva inmediatamente para cumplir con la normativa.</span></>
            : <><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span className="text-sm font-semibold"><strong>{porVencer}</strong> SOAT próximo(s) a vencer en los próximos 30 días.</span></>
          }
        </div>
      )}

      {/* ── FILTROS ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar por placa, vehículo, aseguradora..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="field-input pl-9" style={{minHeight:'2.5rem', borderRadius:'0.75rem'}} />
        </div>



        <div className="relative">
          <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
            className="appearance-none block w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all cursor-pointer" style={{ minHeight: '2.5rem' }}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        {/* Filtros de estado tipo chips */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {[['', 'Todos'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label])].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroEstado(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroEstado === val
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ERROR ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* ── TABLA ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando registros SOAT...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No hay registros SOAT</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">
              {busqueda || filtroEstado ? 'Prueba con otros filtros' : 'Registra el primer SOAT de tu flota'}
            </p>
            {!busqueda && !filtroEstado && (
              <button onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors">
                <Plus className="w-4 h-4" /> Registrar SOAT
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  {['Cód. Patrimonial', 'Placa', 'Tipo de Vehículo', 'Sucursal', 'Vigencia SOAT', 'Rev. Técnica', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const cfg = ESTADOS[r.estado_soat] ?? ESTADOS.VIGENTE;
                  return (
                    <tr key={r.id_soat} className={`transition-colors group hover:brightness-[0.97] ${cfg.row}`}>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-mono font-bold text-slate-800 text-xs">{r.cod_patrimonial}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5 truncate max-w-[180px]" title={r.denominacion}>{r.denominacion}</p>
                        <button onClick={() => setHistorialItem(r)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 hover:underline mt-1 bg-transparent border-none p-0 cursor-pointer">
                          <History className="w-2.5 h-2.5" /> Ver Historial
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.placa
                          ? <span className="font-mono font-bold text-slate-700 bg-slate-900 text-white px-2 py-0.5 rounded-lg text-xs whitespace-nowrap">{r.placa}</span>
                          : <span className="text-slate-400 text-xs italic">Sin placa</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-650 font-medium">
                        <p className="font-bold text-slate-800">{r.tipo_vehiculo || '—'}</p>
                        <div className="text-[10px] text-slate-400 mt-1 space-y-0.5 font-medium leading-none">
                          <p>Ingreso: <strong className="text-slate-500 font-normal">{formatDate(r.fecha_alta_factura)}</strong></p>
                          <p>Asignación: <strong className="text-slate-500 font-normal">{formatDate(r.fecha_registro_contable)}</strong></p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-semibold text-slate-700">
                        {r.sucursal || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <div>
                            <SoatBadge estado={r.estado_soat} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            vence: <strong>{r.fecha_vencimiento ? new Date(r.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-PE') : '—'}</strong>
                            {r.dias_vigencia !== null && (
                              <span className={`ml-1 font-bold ${r.dias_vigencia < 0 ? 'text-rose-600' : r.dias_vigencia <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ({r.dias_vigencia < 0 ? `venció hace ${Math.abs(r.dias_vigencia)}d` : `${r.dias_vigencia}d rest.`})
                              </span>
                            )}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {(() => {
                          if (!r.vencimiento_rev_tec) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 bg-slate-100 text-slate-500 ring-slate-200">
                                Sin Rev. Tec.
                              </span>
                            );
                          }
                          const revState = r.estado_rev_tec || 'VIGENTE';
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
                                vence: <strong>{new Date(r.vencimiento_rev_tec + 'T00:00:00').toLocaleDateString('es-PE')}</strong>
                                {r.dias_vigencia_rev_tec !== null && (
                                  <span className={`ml-1 font-bold ${r.dias_vigencia_rev_tec < 0 ? 'text-rose-600' : r.dias_vigencia_rev_tec <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    ({r.dias_vigencia_rev_tec < 0 ? `venció hace ${Math.abs(r.dias_vigencia_rev_tec)}d` : `${r.dias_vigencia_rev_tec}d rest.`})
                                  </span>
                                )}
                              </p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditItem(r); setShowForm(true); }} title="Renovar / Editar"
                            className="p-1.5 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors border-none bg-transparent cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteItem(r)} title="Eliminar"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border-none bg-transparent cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Mostrando <strong>{filtered.length}</strong> de <strong>{registros.length}</strong> registros SOAT
          </div>
        )}
      </div>

      {/* ── MODALES ─────────────────────────────────────────────────────── */}
      <SoatFormModal open={showForm} item={editItem} vehicles={vehicles} onSave={onSaved} onClose={() => { setShowForm(false); setEditItem(null); }} />
      {historialItem && <HistorialModal open={!!historialItem} vehiculo={historialItem} onClose={() => setHistorialItem(null)} />}
      <ConfirmDeleteModal item={deleteItem} onConfirm={handleDelete} onClose={() => setDeleteItem(null)} />
    </div>
  );
}
