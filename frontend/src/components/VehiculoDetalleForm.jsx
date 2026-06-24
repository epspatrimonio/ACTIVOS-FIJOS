import React, { useState, useEffect } from 'react';
import { Car, AlertCircle, Loader2, Save, ChevronDown } from 'lucide-react';
import { fetchVehiculoDetalle, upsertVehiculoDetalle } from '../utils/api';

const TIPOS_VEHICULO = ['CAMIONETA', 'CAMION', 'AUTOMOVIL', 'MOTO', 'MINIBUS', 'COMBI', 'OTRO'];
const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'GAS', 'ELECTRICO', 'HIBRIDO', 'PETROLEO'];

const EMPTY_VEH = {
  placa: '',
  anio_fabricacion: '',
  tipo_vehiculo: '',
  combustible: '',
  cilindrada_cc: '',
  nro_motor: '',
  nro_chasis: '',
  nro_tarjeta_prop: '',
  carroceria: '',
  categoria_vehiculo: '',
  vencimiento_rev_tec: '',
};

/**
 * Subformulario de datos particulares del vehículo.
 * Se muestra dentro del ActivoForm cuando la categoría es VEHÍCULO.
 * Props:
 *  - codPatrimonial: string | null  — activo ya guardado
 *  - onChange: (data) => void       — callback con datos del subformulario
 *  - initialData: object | null     — datos existentes al editar
 */
export default function VehiculoDetalleForm({ codPatrimonial, onChange, initialData, selectedSubcategory }) {
  const [form, setForm] = useState(EMPTY_VEH);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Cargar datos existentes si ya hay codPatrimonial (modo edición)
  useEffect(() => {
    if (initialData) {
      setForm({
        placa: initialData.placa || '',
        anio_fabricacion: initialData.anio_fabricacion || '',
        tipo_vehiculo: initialData.tipo_vehiculo || '',
        combustible: initialData.combustible || '',
        cilindrada_cc: initialData.cilindrada_cc || '',
        nro_motor: initialData.nro_motor || '',
        nro_chasis: initialData.nro_chasis || '',
        nro_tarjeta_prop: initialData.nro_tarjeta_prop || '',
        carroceria: initialData.carroceria || '',
        categoria_vehiculo: initialData.categoria_vehiculo || '',
        vencimiento_rev_tec: initialData.vencimiento_rev_tec || '',
      });
    } else if (codPatrimonial) {
      setLoading(true);
      fetchVehiculoDetalle(codPatrimonial)
        .then(data => {
          if (data) {
            setForm({
              placa: data.placa || '',
              anio_fabricacion: data.anio_fabricacion || '',
              tipo_vehiculo: data.tipo_vehiculo || '',
              combustible: data.combustible || '',
              cilindrada_cc: data.cilindrada_cc || '',
              nro_motor: data.nro_motor || '',
              nro_chasis: data.nro_chasis || '',
              nro_tarjeta_prop: data.nro_tarjeta_prop || '',
              carroceria: data.carroceria || '',
              categoria_vehiculo: data.categoria_vehiculo || '',
              vencimiento_rev_tec: data.vencimiento_rev_tec || '',
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [codPatrimonial, initialData]);

  // Sincronizar tipo_vehiculo con la subcategoría seleccionada del padre
  useEffect(() => {
    if (selectedSubcategory && form.tipo_vehiculo !== selectedSubcategory) {
      setForm(prev => ({ ...prev, tipo_vehiculo: selectedSubcategory }));
    }
  }, [selectedSubcategory, form.tipo_vehiculo]);

  // Notificar al padre con los datos actualizados
  useEffect(() => {
    if (onChange) {
      onChange({
        ...form,
        anio_fabricacion: form.anio_fabricacion ? Number(form.anio_fabricacion) : null,
        cilindrada_cc: form.cilindrada_cc ? Number(form.cilindrada_cc) : null,
        vencimiento_rev_tec: form.vencimiento_rev_tec || null,
      });
    }
  }, [form]);

  const handleChange = (field, value) => {
    setSaved(false);
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Guardar directamente desde este subformulario (cuando ya existe el cod_patrimonial)
  const handleSaveDirect = async () => {
    if (!codPatrimonial) return;
    if (!form.placa) { setSaveError('La placa es obligatoria.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await upsertVehiculoDetalle(codPatrimonial, {
        ...form,
        anio_fabricacion: form.anio_fabricacion ? Number(form.anio_fabricacion) : null,
        cilindrada_cc: form.cilindrada_cc ? Number(form.cilindrada_cc) : null,
        vencimiento_rev_tec: form.vencimiento_rev_tec || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Calcular vigencia de revisión técnica
  const revTecStatus = (() => {
    if (!form.vencimiento_rev_tec) return null;
    const diffTime = new Date(form.vencimiento_rev_tec + 'T00:00:00').getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { text: `Vencido hace ${Math.abs(diffDays)}d`, pill: 'bg-rose-50 text-rose-700 ring-rose-200' };
    } else if (diffDays <= 30) {
      return { text: `Por vencer (${diffDays}d restantes)`, pill: 'bg-amber-50 text-amber-700 ring-amber-200' };
    } else {
      return { text: `Vigente (${diffDays}d restantes)`, pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    }
  })();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Cargando datos del vehículo...</span>
      </div>
    );
  }

  return (
    <div className="mt-1 p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Car className="w-4 h-4 text-amber-600" />
        <h4 className="text-sm font-bold text-amber-800">Datos Particulares del Vehículo</h4>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
          Requerido para activos de categoría Vehículo
        </span>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Placa */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Placa *</label>
          <input
            type="text"
            value={form.placa}
            onChange={e => handleChange('placa', e.target.value.toUpperCase())}
            placeholder="ABC-123"
            maxLength={10}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Tipo de Vehículo */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de Vehículo</label>
          <input
            type="text"
            value={form.tipo_vehiculo || selectedSubcategory || ''}
            disabled
            readOnly
            className="block w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 cursor-not-allowed"
            placeholder="Autodetectado por subcategoría..."
          />
        </div>

        {/* Año de fabricación / Modelo */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Año Modelo / Fabricación</label>
          <input
            type="number"
            value={form.anio_fabricacion}
            onChange={e => handleChange('anio_fabricacion', e.target.value)}
            placeholder={new Date().getFullYear()}
            min={1900}
            max={2100}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Carrocería */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Carrocería</label>
          <input
            type="text"
            value={form.carroceria}
            onChange={e => handleChange('carroceria', e.target.value)}
            placeholder="Ej: PICKUP, CISTERNA"
            maxLength={60}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
          <input
            type="text"
            value={form.categoria_vehiculo}
            onChange={e => handleChange('categoria_vehiculo', e.target.value.toUpperCase())}
            placeholder="Ej: M1, N1, L3"
            maxLength={30}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Combustible */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Combustible</label>
          <div className="relative">
            <select
              value={form.combustible}
              onChange={e => handleChange('combustible', e.target.value)}
              className="appearance-none w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            >
              <option value="">Seleccionar...</option>
              {COMBUSTIBLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Cilindrada */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cilindrada (cc)</label>
          <input
            type="number"
            value={form.cilindrada_cc}
            onChange={e => handleChange('cilindrada_cc', e.target.value)}
            placeholder="2000"
            min={0}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Nro. Tarjeta de Propiedad */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nro. Tarjeta de Propiedad</label>
          <input
            type="text"
            value={form.nro_tarjeta_prop}
            onChange={e => handleChange('nro_tarjeta_prop', e.target.value)}
            placeholder="Tarjeta Propiedad"
            maxLength={40}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Nro. Motor */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nro. Motor</label>
          <input
            type="text"
            value={form.nro_motor}
            onChange={e => handleChange('nro_motor', e.target.value)}
            placeholder="Número de motor"
            maxLength={60}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Nro. Chasis */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nro. Chasis / VIN</label>
          <input
            type="text"
            value={form.nro_chasis}
            onChange={e => handleChange('nro_chasis', e.target.value)}
            placeholder="Número de Chasis"
            maxLength={60}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Vencimiento Revisión Técnica */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600">Vencimiento Rev. Técnica</label>
            {revTecStatus && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${revTecStatus.pill}`}>
                {revTecStatus.text}
              </span>
            )}
          </div>
          <input
            type="date"
            value={form.vencimiento_rev_tec}
            onChange={e => handleChange('vencimiento_rev_tec', e.target.value)}
            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>
      </div>

      {/* Botón guardar directo (solo cuando ya existe el activo) */}
      {codPatrimonial && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-amber-200">
          {saved && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              ✓ Datos guardados correctamente
            </span>
          )}
          <button
            onClick={handleSaveDirect}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Guardando...' : 'Guardar Datos del Vehículo'}
          </button>
        </div>
      )}
    </div>
  );
}
