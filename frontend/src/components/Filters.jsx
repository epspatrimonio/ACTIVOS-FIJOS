import React, { useEffect, useState } from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { fetchSucursales, fetchPersonal, fetchCompras, fetchIncorporaciones } from '../utils/api';
import SearchableSelect from './SearchableSelect';

const MESES = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export default function Filters({ filters, onChange, activeTab, activos = [] }) {
  const [sucursales, setSucursales] = useState([]);
  const [compras, setCompras] = useState([]);
  const [incorporaciones, setIncorporaciones] = useState([]);

  useEffect(() => {
    fetchSucursales()
      .then(setSucursales)
      .catch(() => setSucursales([]));

    if (activeTab === 'INVENTARIO') {
      fetchCompras()
        .then(setCompras)
        .catch(() => setCompras([]));
      fetchIncorporaciones()
        .then(setIncorporaciones)
        .catch(() => setIncorporaciones([]));
    }
  }, [activeTab]);

  const handleTextChange = (e) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleSelectChange = (field, value) => {
    if (field === 'categoria') {
      // Reset subcategoria if category changes
      onChange({ ...filters, categoria: value, subcategoria: '' });
    } else {
      onChange({ ...filters, [field]: value });
    }
  };

  const handleReset = () => {
    onChange({ search: '', estado_activo: '', id_sucursal: '', n_doc: '', categoria: '', subcategoria: '', anio: '', mes: '' });
  };

  // Categorías y Subcategorías dinámicas extraídas del dataset
  const categoriaOptions = React.useMemo(() => {
    const set = new Set();
    activos.forEach(a => {
      const cat = a.categoria || (a.cod_categoria ? `Categoría ${a.cod_categoria}` : null);
      if (cat) set.add(cat);
    });
    return Array.from(set).sort().map(c => ({ value: c, label: c }));
  }, [activos]);

  const subcategoriaOptions = React.useMemo(() => {
    const set = new Set();
    activos.forEach(a => {
      if (filters.categoria) {
        const cat = a.categoria || (a.cod_categoria ? `Categoría ${a.cod_categoria}` : null);
        if (cat === filters.categoria && a.subcategoria) {
          set.add(a.subcategoria);
        }
      } else {
        if (a.subcategoria) set.add(a.subcategoria);
      }
    });
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [activos, filters.categoria]);

  // Años dinámicos del dataset
  const anioOptions = React.useMemo(() => {
    const set = new Set();
    activos.forEach(a => {
      const dateVal = a.fecha_alta_factura || a.fecha_registro_contable || a.fecha_asignacion || a.fecha_ingreso || a.fecha_alta || a.created_at;
      if (dateVal) {
        const dateStr = String(dateVal).trim();
        const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        let year = null;
        if (clean.includes('-')) {
          const parts = clean.split('-');
          if (parts[0].length === 4) year = parts[0];
          else if (parts[2]?.length === 4) year = parts[2];
        } else if (clean.includes('/')) {
          const parts = clean.split('/');
          if (parts[2]?.length === 4) year = parts[2];
          else if (parts[0]?.length === 4) year = parts[0];
        }
        if (year && year.length === 4 && !isNaN(year)) {
          set.add(year);
        }
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a)).map(y => ({ value: y, label: y }));
  }, [activos]);

  // Cuentas contables dinámicas del dataset
  const cuentaContableOptions = React.useMemo(() => {
    const set = new Set();
    activos.forEach(a => {
      if (a.cuenta_contable) {
        const cta = String(a.cuenta_contable).trim();
        if (cta && cta !== '—') set.add(cta);
      }
    });
    return Array.from(set).sort().map(c => ({ value: c, label: c }));
  }, [activos]);

  const documentoOptions = [
    ...compras.map(c => ({
      value: c.n_doc,
      label: `OC-${c.n_doc}`
    })),
    ...incorporaciones.map(i => ({
      value: i.n_doc,
      label: `INC-${i.n_doc}`
    }))
  ];

  const gridColsClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end";

  return (
    <div className="glass-panel rounded-xl p-3 sm:p-3.5 mb-2.5 relative z-30">
      {/* Cabecera superior del panel de filtros con Año y Mes a la derecha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 border-b border-slate-100 pb-2">
        <div className="flex items-center space-x-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 border border-brand-100/40 shrink-0">
            <Filter className="w-3.5 h-3.5" />
          </span>
          <div>
            <span className="text-xs font-bold text-slate-800">Filtros de búsqueda</span>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Refina los activos fijos por documento, sucursal, categoría, subcategoría, cuenta contable, año y mes.
            </p>
          </div>
        </div>

        {/* Filtros de Cta. Contable, Año y Mes ubicados en la parte superior derecha */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {activeTab === 'INVENTARIO' && (
            <div className="w-32 sm:w-36">
              <SearchableSelect
                label="Cta. Contable"
                name="cuenta_contable"
                value={filters.cuenta_contable || ''}
                onChange={(e) => handleSelectChange('cuenta_contable', e.target.value)}
                options={cuentaContableOptions}
                placeholder="Todas"
              />
            </div>
          )}
          <div className="w-24 sm:w-28">
            <SearchableSelect
              label="Año"
              name="anio"
              value={filters.anio || ''}
              onChange={(e) => handleSelectChange('anio', e.target.value)}
              options={anioOptions}
              placeholder="Todos"
            />
          </div>
          <div className="w-28 sm:w-32">
            <SearchableSelect
              label="Mes"
              name="mes"
              value={filters.mes || ''}
              onChange={(e) => handleSelectChange('mes', e.target.value)}
              options={MESES}
              placeholder="Todos"
            />
          </div>
        </div>
      </div>

      <div className={gridColsClass}>
        {/* 1. Búsqueda Rápida / Inteligente (Ampliado col-span-2 para mayor comodidad) */}
        <div className="lg:col-span-2 relative">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Búsqueda rápida</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </span>
            <input
              type="text"
              value={filters.search || ''}
              onChange={handleTextChange}
              placeholder="Escribe código, denominación, responsable, N° acta..."
              className="block w-full pl-8 pr-3 py-1.5 bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 transition-all placeholder-slate-400 text-[11.5px]"
            />
          </div>
        </div>

        {/* 2. N° Documento */}
        <div>
          <SearchableSelect
            label="N° Documento"
            name="n_doc"
            value={filters.n_doc || ''}
            onChange={(e) => handleSelectChange('n_doc', e.target.value)}
            options={documentoOptions}
            placeholder="Todos los documentos"
          />
        </div>

        {/* 3. Sucursal */}
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

        {/* 4. Categoría */}
        <div>
          <SearchableSelect
            label="Categoría"
            name="categoria"
            value={filters.categoria || ''}
            onChange={(e) => handleSelectChange('categoria', e.target.value)}
            options={categoriaOptions}
            placeholder="Todas las categorías"
          />
        </div>

        {/* 5. Subcategoría + Botón Restablecer */}
        <div>
          <div className="flex items-end space-x-1.5 w-full">
            <div className="flex-grow min-w-0">
              <SearchableSelect
                label="Sub Categoría"
                name="subcategoria"
                value={filters.subcategoria || ''}
                onChange={(e) => handleSelectChange('subcategoria', e.target.value)}
                options={subcategoriaOptions}
                placeholder="Todas las subcategorías"
              />
            </div>
            <button
              onClick={handleReset}
              title="Restablecer filtros"
              className="h-[32px] w-9 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center justify-center flex-shrink-0 shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
