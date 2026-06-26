import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Plus, Pencil, Trash2, X, Save, Search, RefreshCw, Loader2,
  AlertCircle, Phone, Building2, User, Calendar, Tag, Signal,
  CheckCircle2, WifiOff, Wrench, ChevronDown, Clock, AlertTriangle,
  Sparkles, RotateCcw
} from 'lucide-react';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import {
  fetchCelulares, createCelular, updateCelular, deleteCelular,
  fetchSucursales, fetchPuestos, fetchPersonal, fetchGenerarCodigoCelular,
  fetchLocalidades,
} from '../utils/api';

// ─── Config estados ───────────────────────────────────────────────────────────
const ESTADOS = [
  { value: 'ACTIVO',        label: 'Activo',       icon: CheckCircle2, pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  { value: 'BAJA',          label: 'Baja',          icon: WifiOff,     pill: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' },
  { value: 'EXTRAVIADO',    label: 'Extraviado',    icon: AlertCircle, pill: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  { value: 'EN REPARACION', label: 'En Reparación', icon: Wrench,      pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
];
const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.value, e]));

const VIDA_UTIL = {
  VIGENTE:    { label: 'Vigente',     color: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200', icon: CheckCircle2 },
  POR_RENOVAR:{ label: 'Por Vencer', color: 'text-amber-700 bg-amber-50 ring-1 ring-amber-200',       icon: AlertTriangle },
  VENCIDA:    { label: 'Vencido', color: 'text-rose-700 bg-rose-50 ring-1 ring-rose-200',   icon: AlertCircle },
};

const OPERADORES = ['CLARO', 'MOVISTAR', 'ENTEL', 'BITEL', 'OTRO'];

const EMPTY = {
  cod_control: '', marca: '', modelo: '', imei: '',
  numero_linea: '', operador: '', id_sucursal: '', puesto_id: '',
  cod_personal: '', fecha_ingreso: new Date().toISOString().split('T')[0],
  fecha_asignacion: '', estado: 'ACTIVO', observaciones: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function badge(cfg) {
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.pill}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Indicador de vida útil ───────────────────────────────────────────────────
function VidaUtilIndicator({ dias, estado, fechaRenovacion }) {
  if (!estado) return null;
  const cfg = VIDA_UTIL[estado] ?? VIDA_UTIL.VIGENTE;
  const Icon = cfg.icon;
  const pct = Math.max(0, Math.min(100, ((dias ?? 0) / 1095) * 100));
  const barColor = estado === 'VIGENTE' ? '#22c55e' : estado === 'POR_RENOVAR' ? '#f59e0b' : '#ef4444';
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.color}`}>
          <Icon className="w-2.5 h-2.5" />{cfg.label}
        </span>
        {dias !== null && (
          <span className="text-[10px] text-slate-400">
            {dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : `${dias}d restantes`}
            {fechaRenovacion && ` · renova: ${fmt(fechaRenovacion)}`}
          </span>
        )}
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 9999, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ─── Fila de input de formulario ─────────────────────────────────────────────
function Field({ label, required, icon: Icon, children, hint, half }) {
  return (
    <div style={{ gridColumn: half ? 'span 1' : undefined }}>
      <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'0.35rem' }}>
        {Icon && <Icon style={{display:'inline',width:13,height:13,marginRight:4,opacity:.6}} />}
        {label}{required && <span style={{color:'#f43f5e',marginLeft:2}}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize:'0.68rem', color:'#94a3b8', marginTop:3 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  display:'block', width:'100%', padding:'0.55rem 0.8rem',
  background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'0.6rem',
  fontSize:'0.875rem', color:'#1e293b', outline:'none',
  transition:'border-color .15s,box-shadow .15s,background .15s',
  boxSizing:'border-box',
};

function Inp({ style, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      style={{ ...inputStyle, ...(focus ? { background:'#fff', borderColor:'#0e6fdc', boxShadow:'0 0 0 3px rgba(14,111,220,.12)' } : {}), ...style }}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest}
    />
  );
}

function Sel({ children, style, ...rest }) {
  return (
    <div style={{ position:'relative' }}>
      <select style={{ ...inputStyle, appearance:'none', paddingRight:'2rem', cursor:'pointer', ...style }} {...rest}>
        {children}
      </select>
      <ChevronDown style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'#94a3b8', pointerEvents:'none' }} />
    </div>
  );
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────
function CelularFormModal({ open, item, sucursales, personal, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [puestos, setPuestos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('equipo');
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('equipo'); setError(null);
    if (item) {
      setForm({
        cod_control: item.cod_control ?? '',
        marca: item.marca ?? '',
        modelo: item.modelo ?? '',
        imei: item.imei ?? '',
        numero_linea: item.numero_linea ?? '',
        operador: item.operador ?? '',
        id_sucursal: item.id_sucursal ?? '',
        puesto_id: item.puesto_id ?? '',
        cod_personal: item.cod_personal ?? '',
        fecha_ingreso: item.fecha_ingreso ?? new Date().toISOString().split('T')[0],
        fecha_asignacion: item.fecha_asignacion ?? '',
        estado: item.estado ?? 'ACTIVO',
        observaciones: item.observaciones ?? '',
      });
    } else {
      setForm({ ...EMPTY, fecha_ingreso: new Date().toISOString().split('T')[0] });
    }
  }, [open, item]);

  useEffect(() => {
    if (form.id_sucursal) fetchPuestos(form.id_sucursal).then(setPuestos).catch(() => setPuestos([]));
    else setPuestos([]);
  }, [form.id_sucursal]);

  const set = (k, v) => { setError(null); setForm(p => ({ ...p, [k]: v })); };

  const generarCodigo = async () => {
    if (!form.id_sucursal) { setError('Selecciona primero la sucursal para generar el código.'); setTab('equipo'); return; }
    setGenerando(true);
    try {
      const res = await fetchGenerarCodigoCelular(form.id_sucursal);
      set('cod_control', res.codigo);
    } catch (e) { setError(e.message); }
    finally { setGenerando(false); }
  };

  const validate = () => {
    if (!form.id_sucursal) { setError('La Sucursal es obligatoria.'); setTab('equipo'); return false; }
    if (!form.cod_control.trim()) { setError('El Código de Control es obligatorio.'); setTab('equipo'); return false; }
    if (!form.fecha_ingreso) { setError('La Fecha de Ingreso es obligatoria.'); setTab('equipo'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        id_sucursal: Number(form.id_sucursal),
        puesto_id: form.puesto_id ? Number(form.puesto_id) : null,
        cod_personal: form.cod_personal || null,
        fecha_ingreso: form.fecha_ingreso || null,
        fecha_asignacion: form.fecha_asignacion || null,
      };
      if (item) await updateCelular(item.id_celular, payload);
      else await createCelular(payload);
      onSave();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // Calcular vida útil en preview
  const previewDias = form.fecha_ingreso
    ? Math.round((new Date(form.fecha_ingreso + 'T00:00:00').getTime() + 3 * 365.25 * 86400000 - Date.now()) / 86400000)
    : null;
  const previewEstado = previewDias === null ? null : previewDias < 0 ? 'VENCIDA' : previewDias <= 90 ? 'POR_RENOVAR' : 'VIGENTE';

  const tabs = [
    { id: 'equipo', label: '📱 Equipo' },
    { id: 'asignacion', label: '👤 Asignación' },
  ];

  return (
    <Modal open={open} onClose={onClose} maxWidth="700px">
      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding:'1.25rem 1.5rem', borderBottom:'1px solid #f1f5f9' }}>
        <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#0e6fdc,#00B0F0)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(14,111,220,.3)' }}>
          <Smartphone style={{ width:22, height:22, color:'#fff' }} />
        </div>
        <div style={{ flex:1 }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:'#0f172a' }}>
            {item ? 'Editar Celular' : 'Registrar Nuevo Celular'}
          </h2>
          <p style={{ margin:'2px 0 0', fontSize:'0.75rem', color:'#64748b' }}>
            Activo sujeto a control — vida útil: 3 años desde el ingreso
          </p>
        </div>
        <button onClick={onClose} style={{ padding:8, borderRadius:10, border:'none', background:'none', cursor:'pointer', color:'#94a3b8' }}>
          <X style={{ width:20, height:20 }} />
        </button>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:6, padding:'1rem 1.5rem 0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding:'7px 16px', borderRadius:10, border:'none', cursor:'pointer',
              fontSize:'0.8125rem', fontWeight:700, transition:'all .15s',
              background: tab === t.id ? '#0e6fdc' : '#f1f5f9',
              color: tab === t.id ? '#fff' : '#64748b',
              boxShadow: tab === t.id ? '0 2px 8px rgba(14,111,220,.25)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:16 }}>
        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff1f2', border:'1px solid #fecdd3', color:'#be123c', padding:'10px 14px', borderRadius:10, fontSize:'0.875rem' }}>
            <AlertCircle style={{ width:16, height:16, flexShrink:0 }} />{error}
          </div>
        )}

        {/* ── TAB EQUIPO ── */}
        {tab === 'equipo' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeIn .2s' }}>
            {/* Sucursal */}
            <Field label="Sucursal" required icon={Building2}>
              <SearchableSelect
                options={sucursales.map(s => ({ value: s.value, label: s.label }))}
                value={form.id_sucursal}
                onChange={e => { set('id_sucursal', e.target.value); set('puesto_id', ''); }}
                placeholder="Selecciona una sucursal..."
              />
            </Field>

            {/* Código + Generar */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'end' }}>
              <Field label="Código de Control" required icon={Tag}>
                <Inp value={form.cod_control} onChange={e => set('cod_control', e.target.value.toUpperCase())}
                  placeholder="Ej: 10-001" maxLength={30}
                  style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:'0.05em' }} />
              </Field>
              <button onClick={generarCodigo} disabled={generando}
                title="Generar código automático según sucursal"
                style={{
                  display:'flex', alignItems:'center', gap:6, padding:'0.55rem 1rem',
                  background: form.id_sucursal ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#e2e8f0',
                  color: form.id_sucursal ? '#fff' : '#94a3b8',
                  border:'none', borderRadius:'0.6rem', fontSize:'0.8125rem', fontWeight:700,
                  cursor: form.id_sucursal ? 'pointer' : 'not-allowed', whiteSpace:'nowrap',
                  boxShadow: form.id_sucursal ? '0 2px 8px rgba(124,58,237,.3)' : 'none',
                  transition:'all .15s', height:39,
                }}>
                {generando ? <Loader2 style={{width:14,height:14,animation:'spin 1s linear infinite'}} /> : <Sparkles style={{width:14,height:14}} />}
                Auto-código
              </button>
            </div>
            {!form.id_sucursal && <p style={{ fontSize:'0.7rem', color:'#f59e0b', marginTop:-10 }}>💡 Selecciona la sucursal primero para generar el código automático.</p>}

            {/* Fecha de Ingreso */}
            <Field label="Fecha de Ingreso / Registro" required icon={Calendar}
              hint="Fecha en que el equipo entra al inventario">
              <Inp type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </Field>

            {/* Estado */}
            <Field label="Estado del Equipo">
              <Sel value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </Sel>
            </Field>

            {/* Marca / Modelo */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Marca" icon={Smartphone}>
                <Inp value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Samsung, Apple, Motorola..." maxLength={100} />
              </Field>
              <Field label="Modelo">
                <Inp value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Galaxy A54, iPhone 15..." maxLength={150} />
              </Field>
            </div>

            {/* ─ Comunicaciones ─ */}
            <div style={{ fontSize:'0.7rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:8 }}>
              Comunicaciones
              <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="IMEI" icon={Tag} hint="15 dígitos del dispositivo">
                <Inp value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="354123456789012" maxLength={20}
                  style={{ fontFamily:'monospace', letterSpacing:'0.04em' }} />
              </Field>
              <Field label="Número de Línea" icon={Phone}>
                <Inp value={form.numero_linea} onChange={e => set('numero_linea', e.target.value)} placeholder="9XXXXXXXX" maxLength={20} />
              </Field>
            </div>

            <Field label="Operador" icon={Signal}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {OPERADORES.map(op => (
                  <button key={op} type="button" onClick={() => set('operador', form.operador === op ? '' : op)}
                    style={{
                      padding:'6px 14px', borderRadius:8, border:'1.5px solid', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', transition:'all .15s',
                      background: form.operador === op ? '#0e6fdc' : '#f8fafc',
                      color: form.operador === op ? '#fff' : '#475569',
                      borderColor: form.operador === op ? '#0e6fdc' : '#e2e8f0',
                      boxShadow: form.operador === op ? '0 2px 6px rgba(14,111,220,.25)' : 'none',
                    }}>{op}</button>
                ))}
              </div>
            </Field>

            <Field label="Observaciones">
              <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                rows={2} placeholder="Notas adicionales sobre el equipo..."
                style={{ ...inputStyle, resize:'none' }} />
            </Field>

            <button onClick={() => { 
              if (!form.id_sucursal) { setError('La Sucursal es obligatoria.'); return; }
              if (!form.cod_control.trim()) { setError('El Código de Control es obligatorio.'); return; }
              if (!form.fecha_ingreso) { setError('La Fecha de Ingreso es obligatoria.'); return; }
              setTab('asignacion'); 
              setError(null); 
            }}
              style={{ padding:'10px', background:'#0f172a', color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:'0.875rem', cursor:'pointer', marginTop:4 }}>
              Continuar → Asignación
            </button>
          </div>
        )}

        {/* ── TAB ASIGNACIÓN ── */}
        {tab === 'asignacion' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeIn .2s' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Puesto">
                <SearchableSelect
                  options={puestos.map(p => ({ value: p.value, label: p.label }))}
                  value={form.puesto_id}
                  onChange={e => set('puesto_id', e.target.value)}
                  placeholder={form.id_sucursal ? 'Selecciona...' : 'Elige sucursal primero'}
                  disabled={!form.id_sucursal}
                />
              </Field>
              <Field label="Responsable" icon={User}>
                <SearchableSelect
                  options={personal.map(p => ({ value: p.value, label: p.label }))}
                  value={form.cod_personal}
                  onChange={e => set('cod_personal', e.target.value)}
                  placeholder="Buscar personal..."
                />
              </Field>
            </div>

            {/* ─ Fechas ─ */}
            <div style={{ fontSize:'0.7rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:8 }}>
              Fechas de Asignación
              <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
            </div>

            <Field label="Fecha de Asignación" icon={Calendar}
              hint="Modifica cada vez que se reasigna a otra persona">
              <Inp type="date" value={form.fecha_asignacion} onChange={e => set('fecha_asignacion', e.target.value)} />
            </Field>

            {/* Preview vida útil */}
            {form.fecha_ingreso && previewEstado && (
              <div style={{ background: previewEstado === 'VIGENTE' ? '#f0fdf4' : previewEstado === 'POR_RENOVAR' ? '#fffbeb' : '#fff1f2', border:'1px solid', borderColor: previewEstado === 'VIGENTE' ? '#bbf7d0' : previewEstado === 'POR_RENOVAR' ? '#fde68a' : '#fecdd3', borderRadius:12, padding:'12px 16px' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:6 }}>
                  📅 Vida útil estimada (3 años desde fecha de ingreso)
                </div>
                <VidaUtilIndicator dias={previewDias} estado={previewEstado}
                  fechaRenovacion={form.fecha_ingreso ? new Date(new Date(form.fecha_ingreso+'T00:00:00').getTime() + 3*365.25*86400000).toISOString().split('T')[0] : null} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.5rem', borderTop:'1px solid #f1f5f9', background:'#f8fafc', borderRadius:'0 0 1.25rem 1.25rem' }}>
        <button onClick={onClose} disabled={saving}
          style={{ padding:'8px 16px', background:'none', border:'none', color:'#64748b', fontWeight:600, fontSize:'0.875rem', cursor:'pointer', borderRadius:10 }}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{
            display:'flex', alignItems:'center', gap:8, padding:'9px 22px',
            background:'linear-gradient(135deg,#0e6fdc,#00B0F0)', color:'#fff',
            border:'none', borderRadius:12, fontWeight:700, fontSize:'0.875rem', cursor:'pointer',
            boxShadow:'0 2px 12px rgba(14,111,220,.3)', transition:'all .15s',
            opacity: saving ? 0.65 : 1,
          }}>
          {saving ? <Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> : <Save style={{ width:16, height:16 }} />}
          {saving ? 'Guardando...' : item ? 'Actualizar Celular' : 'Registrar Celular'}
        </button>
      </div>
    </Modal>
  );
}

// ─── CONFIRMACIÓN ─────────────────────────────────────────────────────────────
function ConfirmModal({ item, onConfirm, onClose, title, msg }) {
  if (!item) return null;
  return (
    <Modal open={!!item} onClose={onClose} maxWidth="400px">
      <div style={{ padding:'1.5rem' }}>
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:9999, background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Trash2 style={{ width:20, height:20, color:'#dc2626' }} />
          </div>
          <div>
            <h3 style={{ margin:0, fontWeight:800, color:'#0f172a', fontSize:'1rem' }}>{title}</h3>
            <p style={{ margin:'2px 0 0', fontSize:'0.75rem', color:'#64748b' }}>Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p style={{ fontSize:'0.875rem', color:'#475569', marginBottom:20 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px', background:'#f1f5f9', border:'none', borderRadius:10, fontWeight:600, cursor:'pointer', color:'#475569' }}>Cancelar</button>
          <button onClick={() => onConfirm(item)} style={{ flex:1, padding:'9px', background:'#dc2626', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', color:'#fff' }}>Eliminar</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function CelularesModule() {
  const [celulares, setCelulares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroVida, setFiltroVida] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [personal, setPersonal] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await fetchCelulares({ estado: filtroEstado || undefined }); setCelulares(d); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filtroEstado]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => {});
    fetchPersonal().then(setPersonal).catch(() => {});
    fetchLocalidades().then(setLocalidades).catch(() => {});
  }, []);

  const filtered = celulares.filter(c => {
    if (filtroVida && c.vida_util_estado !== filtroVida) return false;
    if (filtroSucursal && String(c.id_sucursal) !== filtroSucursal) return false;
    if (filtroLocalidad && c.localidad !== filtroLocalidad) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.cod_control, c.marca, c.modelo, c.imei, c.numero_linea, c.responsable, c.sucursal, c.localidad]
      .some(v => v?.toLowerCase().includes(q));
  });

  const openNew = () => { setEditItem(null); setShowForm(true); };
  const openEdit = (item) => { setEditItem(item); setShowForm(true); };
  const onSaved = () => { setShowForm(false); setEditItem(null); load(); };
  const handleDelete = async (item) => {
    try { await deleteCelular(item.id_celular); setDeleteItem(null); load(); }
    catch (e) { setError(e.message); }
  };

  // Alertas
  const porRenovar = celulares.filter(c => c.vida_util_estado === 'POR_RENOVAR').length;
  const vencida = celulares.filter(c => c.vida_util_estado === 'VENCIDA').length;
  const activos = celulares.filter(c => c.estado === 'ACTIVO').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
        <div style={{ borderLeft:'4px solid #0e6fdc', paddingLeft:16 }}>
          <p style={{ margin:0, fontSize:'0.6875rem', fontWeight:800, color:'#0e6fdc', textTransform:'uppercase', letterSpacing:'0.06em' }}>Activos sujetos a control</p>
          <h2 style={{ margin:'4px 0', fontSize:'1.5rem', fontWeight:900, color:'#0f172a', display:'flex', alignItems:'center', gap:8 }}>
            <Smartphone style={{ width:24, height:24, color:'#0e6fdc' }} /> Celulares
          </h2>
          <p style={{ margin:0, fontSize:'0.875rem', color:'#64748b' }}>Control, asignación y vida útil de equipos móviles</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={load} style={{ padding:8, border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', cursor:'pointer', color:'#64748b' }} title="Actualizar">
            <RefreshCw style={{ width:16, height:16 }} />
          </button>
          <button onClick={openNew}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'linear-gradient(135deg,#0e6fdc,#00B0F0)', color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:'0.875rem', cursor:'pointer', boxShadow:'0 2px 12px rgba(14,111,220,.3)' }}>
            <Plus style={{ width:16, height:16 }} /> Registrar Celular
          </button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Total', value: celulares.length,  color:'#0e6fdc', bg:'#eff6ff', icon: Smartphone },
          { label:'Activos',  value: activos,         color:'#16a34a', bg:'#f0fdf4', icon: CheckCircle2 },
          { label:'Por Renovar (90d)', value: porRenovar, color:'#d97706', bg:'#fffbeb', icon: Clock },
          { label:'Vida Útil Vencida', value: vencida, color:'#dc2626', bg:'#fff1f2', icon: AlertCircle },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon style={{ width:18, height:18, color:m.color }} />
              </div>
              <div>
                <p style={{ margin:0, fontSize:'1.5rem', fontWeight:900, color:'#0f172a', lineHeight:1 }}>{m.value}</p>
                <p style={{ margin:'3px 0 0', fontSize:'0.7rem', color:'#64748b', fontWeight:600 }}>{m.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ALERTA */}
      {(vencida > 0 || porRenovar > 0) && (
        <div style={{ display:'flex', gap:10, padding:'10px 16px', background: vencida > 0 ? '#fff1f2' : '#fffbeb', borderLeft:'4px solid', borderLeftColor: vencida > 0 ? '#ef4444' : '#f59e0b', borderRadius:'0 10px 10px 0', alignItems:'center', fontSize:'0.875rem', fontWeight:600, color: vencida > 0 ? '#b91c1c' : '#92400e' }}>
          {vencida > 0 ? <AlertCircle style={{width:16,height:16,flexShrink:0}} /> : <AlertTriangle style={{width:16,height:16,flexShrink:0}} />}
          {vencida > 0
            ? `${vencida} equipo(s) con vida útil vencida — considera la renovación para cumplir el control de activos.`
            : `${porRenovar} equipo(s) próximos a renovación en los siguientes 90 días.`}
        </div>
      )}

      {/* FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:items-center gap-3">
        <div className="relative flex-grow min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Inp value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, marca, IMEI, responsable..."
            style={{ paddingLeft:36, paddingRight:32 }} />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 border-none bg-none cursor-pointer text-slate-400 hover:text-slate-600 p-1 flex items-center justify-center"
              title="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="w-full lg:w-48">
          <Sel value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)} style={{ width:'100%' }}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Sel>
        </div>
        <div className="w-full lg:w-48">
          <Sel value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)} style={{ width:'100%' }}>
            <option value="">Todas las localidades</option>
            {localidades.map(l => (
              <option key={l.value} value={l.label}>
                {l.label}
              </option>
            ))}
          </Sel>
        </div>
        <div className="w-full lg:w-40">
          <Sel value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width:'100%' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </Sel>
        </div>
        <div className="w-full lg:w-40">
          <Sel value={filtroVida} onChange={e => setFiltroVida(e.target.value)} style={{ width:'100%' }}>
            <option value="">Vida útil: todas</option>
            {Object.entries(VIDA_UTIL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Sel>
        </div>
        {(search || filtroSucursal || filtroLocalidad || filtroEstado || filtroVida) && (
          <button 
            onClick={() => {
              setSearch('');
              setFiltroSucursal('');
              setFiltroLocalidad('');
              setFiltroEstado('');
              setFiltroVida('');
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer h-10 w-full lg:w-auto shrink-0 transition-all active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            Borrar filtros
          </button>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ display:'flex', gap:8, alignItems:'center', background:'#fff1f2', border:'1px solid #fecdd3', color:'#be123c', padding:'10px 14px', borderRadius:10, fontSize:'0.875rem' }}>
          <AlertCircle style={{ width:16, height:16, flexShrink:0 }} />{error}
        </div>
      )}

      {/* TABLA */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:'5rem', gap:10, color:'#94a3b8' }}>
            <Loader2 style={{ width:20, height:20, animation:'spin 1s linear infinite' }} />
            <span style={{ fontSize:'0.875rem' }}>Cargando celulares...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'5rem 2rem' }}>
            <Smartphone style={{ width:48, height:48, color:'#e2e8f0', margin:'0 auto 12px' }} />
            <p style={{ color:'#64748b', fontWeight:600, margin:'0 0 4px' }}>No hay celulares que mostrar</p>
            <p style={{ color:'#94a3b8', fontSize:'0.875rem', margin:'0 0 16px' }}>
              {search || filtroEstado || filtroVida || filtroSucursal ? 'Prueba con otros filtros' : 'Registra el primer celular'}
            </p>
            {!search && !filtroEstado && !filtroVida && !filtroSucursal && (
              <button onClick={openNew} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 20px', background:'#0e6fdc', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>
                <Plus style={{ width:16, height:16 }} /> Registrar Celular
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
              <thead>
                <tr style={{ background:'linear-gradient(to right,#f8fafc,#f1f5f9)', borderBottom:'1px solid #e2e8f0' }}>
                  {['Cód. Control','IMEI / Línea','Equipo','Sucursal','Responsable','Ingreso','Asignación','Vida Útil','Estado',''].map(h => (
                    <th key={h} style={{ padding:'10px 8px', textAlign:'left', fontSize:'0.6875rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const estadoCfg = ESTADO_MAP[c.estado] ?? ESTADO_MAP['ACTIVO'];
                  return (
                    <tr key={c.id_celular} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                      <td style={{ padding:'10px 8px' }}>
                        <span style={{ fontFamily:'monospace', fontSize:'0.75rem', fontWeight:800, color:'#0e6fdc', background:'#eff6ff', padding:'2px 8px', borderRadius:6 }}>{c.cod_control}</span>
                      </td>
                      <td style={{ padding:'10px 8px', fontSize:'0.75rem', color:'#475569' }}>
                        <p style={{ margin:0, fontWeight:700, color:'#0e6fdc' }}>{c.numero_linea || '—'}</p>
                        <p style={{ margin:'2px 0 0', fontFamily:'monospace', color:'#475569' }}>{c.imei || '—'}</p>
                        {c.operador && <p style={{ margin:'2px 0 0', color:'#94a3b8', fontWeight:600 }}>{c.operador}</p>}
                      </td>
                      <td style={{ padding:'10px 8px' }}>
                        <p style={{ margin:0, fontWeight:700, color:'#0f172a' }}>{c.marca || '—'}</p>
                        <p style={{ margin:'2px 0 0', fontSize:'0.75rem', color:'#64748b' }}>{c.modelo || ''}</p>
                      </td>
                      <td style={{ padding:'10px 8px', fontSize:'0.75rem' }}>
                        <p style={{ margin:0, fontWeight:600, color:'#334155' }}>{c.sucursal || '—'}</p>
                        {c.localidad && <p style={{ margin:'2px 0 0', fontSize:'0.6875rem', color:'#64748b' }}>{c.localidad}</p>}
                      </td>
                      <td style={{ padding:'10px 8px', fontSize:'0.8125rem' }}>
                        {c.responsable ? (
                          <div>
                            <span style={{ fontWeight:600, color:'#334155', display:'block' }}>{c.responsable}</span>
                            {c.puesto && (
                              <span style={{ fontSize:'0.6875rem', color:'#64748b', fontWeight:600, display:'block', textTransform:'uppercase', letterSpacing:'0.02em', marginTop:2 }}>
                                {c.puesto}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color:'#94a3b8', fontStyle:'italic' }}>Sin asignar</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 8px', fontSize:'0.75rem', color:'#475569' }}>{fmt(c.fecha_ingreso)}</td>
                      <td style={{ padding:'10px 8px', fontSize:'0.75rem', color:'#475569' }}>{fmt(c.fecha_asignacion)}</td>
                      <td style={{ padding:'10px 8px', minWidth:120 }}>
                        <VidaUtilIndicator dias={c.dias_para_renovar} estado={c.vida_util_estado} fechaRenovacion={c.fecha_renovacion} />
                      </td>
                      <td style={{ padding:'10px 8px' }}>{badge(estadoCfg)}</td>
                      <td style={{ padding:'10px 8px' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => openEdit(c)} title="Editar"
                            style={{ padding:6, border:'none', borderRadius:8, background:'none', cursor:'pointer', color:'#94a3b8' }}
                            onMouseEnter={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.color='#0e6fdc'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#94a3b8'; }}>
                            <Pencil style={{ width:14, height:14 }} />
                          </button>
                          <button onClick={() => setDeleteItem(c)} title="Eliminar"
                            style={{ padding:6, border:'none', borderRadius:8, background:'none', cursor:'pointer', color:'#94a3b8' }}
                            onMouseEnter={e => { e.currentTarget.style.background='#fff1f2'; e.currentTarget.style.color='#dc2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#94a3b8'; }}>
                            <Trash2 style={{ width:14, height:14 }} />
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
        {!loading && filtered.length > 0 && (
          <div style={{ padding:'8px 16px', borderTop:'1px solid #f1f5f9', background:'#f8fafc', fontSize:'0.75rem', color:'#94a3b8' }}>
            Mostrando <strong>{filtered.length}</strong> de <strong>{celulares.length}</strong> celulares
          </div>
        )}
      </div>

      {/* MODALES */}
      <CelularFormModal open={showForm} item={editItem} sucursales={sucursales} personal={personal}
        onSave={onSaved} onClose={() => { setShowForm(false); setEditItem(null); }} />
      <ConfirmModal item={deleteItem} onConfirm={handleDelete} onClose={() => setDeleteItem(null)}
        title="Eliminar Celular"
        msg={deleteItem ? `¿Confirmas la eliminación de ${deleteItem.cod_control} (${deleteItem.marca || 'sin marca'})?` : ''} />
    </div>
  );
}
