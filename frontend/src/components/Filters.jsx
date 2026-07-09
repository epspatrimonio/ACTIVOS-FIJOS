import React, { useEffect, useState } from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { fetchSucursales, fetchPersonal, fetchCuentasContables, fetchCentrosCosto } from '../utils/api';
import SearchableSelect from './SearchableSelect';

const ESTADOS_ACTIVO = [
  { value: 'BUENO', label: 'BUENO' },
  { value: 'REGULAR', label: 'REGULAR' },
  { value: 'MALO', label: 'MALO' },
  { value: 'PARA BAJA', label: 'PARA BAJA' },
  { value: 'BAJA', label: 'BAJA' },
];

export default function Filters({ filters, onChange }) {
  const [sucursales, setSucursales] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [centros, setCentros] = useState([]);

  useEffect(() => {
    fetchSucursales()
      .then(setSucursales)
      .catch(() => setSucursales([]));

    fetchPersonal()
      .then(setPersonal)
      .catch(() => setPersonal([]));

    fetchCuentasContables()
      .then(setCuentas)
      .catch(() => setCuentas([]));

    fetchCentrosCosto()
      .then(setCentros)
      .catch(() => setCentros([]));
  }, []);

  const handleTextChange = (e) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleSelectChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    onChange({ search: '', estado_activo: '', id_sucursal: '', cod_personal: '', cuenta_contable: '', centro_costo: '' });
  };

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-5 mb-6 relative z-30">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 border border-brand-100/40">
            <Filter className="w-4 h-4" />
          </span>
          <div>
            <span className="text-sm font-bold text-slate-800">Filtros de búsqueda</span>
            <p className="text-[0.75rem] text-slate-500">Refina el inventario por ubicación, estado, responsable, cuenta o centro de costo.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Buscador Global */}
        <div className="relative">
          <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-1.5">Búsqueda rápida</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              value={filters.search || ''}
              onChange={handleTextChange}
              placeholder="Buscar por código, denominación..."
              className="block w-full pl-9 pr-3 py-2 bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 transition-all placeholder-slate-400 text-xs"
            />
          </div>
        </div>

        {/* Estado del Activo */}
        <div>
          <SearchableSelect
            label="Estado Operativo"
            name="estado_activo"
            value={filters.estado_activo || ''}
            onChange={(e) => handleSelectChange('estado_activo', e.target.value)}
            options={ESTADOS_ACTIVO}
            placeholder="Todos los estados"
          />
        </div>

        {/* Sucursales */}
        <div>
          <SearchableSelect
            label="Sucursal"
            name="id_sucursal"
            value={filters.id_sucursal || ''}
            onChange={(e) => handleSelectChange('id_sucursal', e.target.value ? Number(e.target.value) : '')}
            options={sucursales.map((suc) => ({
              value: suc.value,
              label: suc.label
            }))}
            placeholder="Todas las sucursales"
          />
        </div>

        {/* Responsable */}
        <div>
          <SearchableSelect
            label="Responsable"
            name="cod_personal"
            value={filters.cod_personal || ''}
            onChange={(e) => handleSelectChange('cod_personal', e.target.value)}
            options={personal}
            placeholder="Todos los responsables"
          />
        </div>

        {/* Cuenta Contable */}
        <div>
          <SearchableSelect
            label="Cuenta Contable"
            name="cuenta_contable"
            value={filters.cuenta_contable || ''}
            onChange={(e) => handleSelectChange('cuenta_contable', e.target.value)}
            options={cuentas.map(cta => ({
              value: cta.value,
              label: cta.label
            }))}
            placeholder="Todas las cuentas"
          />
        </div>

        {/* Centro de Costo */}
        <div>
          <div className="flex items-end space-x-2 w-full">
            <div className="flex-grow">
              <SearchableSelect
                label="Centro de Costo"
                name="centro_costo"
                value={filters.centro_costo || ''}
                onChange={(e) => handleSelectChange('centro_costo', e.target.value)}
                options={centros.map(cc => ({
                  value: cc.value,
                  label: cc.label
                }))}
                placeholder="Todos los centros"
              />
            </div>

            <button
              onClick={handleReset}
              title="Restablecer filtros"
              className="h-11 w-11 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center justify-center flex-shrink-0 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
