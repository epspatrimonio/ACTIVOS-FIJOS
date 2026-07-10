import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Search, Trash2, Edit3, X, AlertCircle, CheckCircle2, ChevronDown,
  FileSpreadsheet, FileText
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Modal from './Modal';
import ExcelHeaderFilter from './ExcelHeaderFilter';
import { 
  fetchBienesTerceros, saveBienTercero, deleteBienTercero, fetchGenerarCodigoTerceroControl,
  fetchPersonal, fetchSucursales, fetchLocalidades
} from '../utils/api';

const INITIAL_FORM_STATE = {
  cod_patrimonial: '',
  tipo: 'TERCERO', // TERCERO | CONTROL
  denominacion: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  caracteristicas_accesorios: '',
  cod_personal: '',
  observaciones: '',
  id_sucursal: '',
  localidad: ''
};

export default function BienesTercerosPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Datos auxiliares para el formulario
  const [personal, setPersonal] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  
  // Pestañas y búsqueda
  const [currentTab, setCurrentTab] = useState('ALL'); // ALL | TERCERO | CONTROL
  const [searchTerm, setSearchTerm] = useState('');

  const [colFilters, setColFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Reset filters only when data is reloaded (length changes)
  const itemsCount = items.length;
  useEffect(() => {
    setColFilters({});
    setSortConfig({ key: null, direction: null });
  }, [itemsCount]);

  const handleFilterChange = (columnKey, values) => {
    setColFilters(prev => ({
      ...prev,
      [columnKey]: values
    }));
  };

  const handleSortChange = (columnKey, direction) => {
    setSortConfig({ key: columnKey, direction });
  };

  const getColValue = (item, key) => {
    switch (key) {
      case 'cod_patrimonial': return item.cod_patrimonial || '';
      case 'tipo': return item.tipo || '';
      case 'ubicacion': return `${item.sucursal || ''} / ${item.localidad || ''}`;
      case 'denominacion': return item.denominacion || '';
      case 'caracteristicas': return `${item.marca || ''} ${item.modelo || ''} ${item.numero_serie || ''}`;
      case 'responsable': return item.responsable || '';
      case 'observaciones': return item.observaciones || '';
      default: return '';
    }
  };

  // Control del modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Cargar datos principales
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBienesTerceros();
      const sorted = data.sort((a, b) => (b.cod_patrimonial || '').localeCompare(a.cod_patrimonial || ''));
      setItems(sorted);
    } catch (err) {
      setError(err.message || 'Error al cargar los bienes.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar listas auxiliares
  const loadAuxData = async () => {
    try {
      const [personalData, sucursalData, localidadData] = await Promise.all([
        fetchPersonal(),
        fetchSucursales(),
        fetchLocalidades()
      ]);
      setPersonal(personalData);
      setSucursales(sucursalData);
      setLocalidades(localidadData);
    } catch (err) {
      console.error('Error al cargar personal:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadAuxData();
  }, []);

  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert('La librería SheetJS no está cargada.');
      return;
    }
    const parseTimestampToJSDate = (tsStr) => {
      if (!tsStr) return null;
      const cleanStr = tsStr.includes('T') ? tsStr.split('T')[0] : tsStr;
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        return new Date(Date.UTC(y, m - 1, d));
      }
      return null;
    };

    const sheetData = filteredItems.map(item => ({
      "Código": item.cod_patrimonial,
      "Tipo": item.tipo === 'TERCERO' ? 'Bienes de Terceros' : 'Control Interno',
      "Denominación": item.denominacion,
      "Marca": item.marca || '—',
      "Modelo": item.modelo || '—',
      "N° Serie": item.numero_serie || '—',
      "Color": item.color || '—',
      "Sucursal": item.sucursal || '—',
      "Localidad": item.localidad || '—',
      "Responsable": item.responsable || '—',
      "Puesto": item.puesto || '—',
      "Observaciones": item.observaciones || '—',
      "Fecha Registro": parseTimestampToJSDate(item.created_at)
    }));
    const ws = window.XLSX.utils.json_to_sheet(sheetData, { cellDates: true });

    // Force dd/mm/yyyy format on date cells
    for (const cellId in ws) {
      if (ws[cellId] && ws[cellId].t === 'd') {
        ws[cellId].z = 'dd/mm/yyyy';
      }
    }

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "BienesTerceros");
    window.XLSX.writeFile(wb, `Reporte_Bienes_Terceros_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no está cargada.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("EPS SELVA CENTRAL - CONTROL PATRIMONIAL", 14, 18);
    doc.setFontSize(12);
    doc.text("REPORTE DE BIENES DE TERCEROS Y CONTROL INTERNO", 14, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 31);

    const headers = [["Código", "Tipo", "Denominación", "Marca/Modelo/Serie", "Sucursal / Localidad", "Responsable / Cargo", "Observaciones"]];
    const tableRows = filteredItems.map(item => [
      item.cod_patrimonial,
      item.tipo === 'TERCERO' ? 'Tercero' : 'Control Int.',
      item.denominacion,
      `M: ${item.marca || 'S/M'}\nMod: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}`,
      `${item.sucursal || '—'}\n(${item.localidad || '—'})`,
      `${item.responsable || 'Sin asignar'}${item.puesto ? `\n(${item.puesto})` : ''}`,
      item.observaciones || '—'
    ]);

    doc.autoTable({
      startY: 36,
      head: headers,
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 45 },
        4: { cellWidth: 45 },
        5: { cellWidth: 50 },
        6: { cellWidth: 45 }
      }
    });
    doc.save(`Reporte_Bienes_Terceros_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Filtrado local de items
  const filteredItems = items.filter(item => {
    const matchesTab = currentTab === 'ALL' || item.tipo === currentTab;
    if (filtroSucursal && Number(item.id_sucursal) !== Number(filtroSucursal)) return false;
    if (filtroLocalidad && item.localidad !== filtroLocalidad) return false;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.cod_patrimonial?.toLowerCase().includes(searchLower) ||
      item.denominacion?.toLowerCase().includes(searchLower) ||
      item.marca?.toLowerCase().includes(searchLower) ||
      item.modelo?.toLowerCase().includes(searchLower) ||
      item.numero_serie?.toLowerCase().includes(searchLower) ||
      item.responsable?.toLowerCase().includes(searchLower) ||
      item.localidad?.toLowerCase().includes(searchLower) ||
      item.sucursal?.toLowerCase().includes(searchLower);
    return matchesTab && matchesSearch;
  });

  const filteredAndSortedItems = useMemo(() => {
    let result = [...filteredItems];

    // Apply column filters
    Object.keys(colFilters).forEach(key => {
      const selected = colFilters[key];
      if (selected && selected.length > 0) {
        result = result.filter(item => {
          const val = String(getColValue(item, key)).trim();
          return selected.includes(val);
        });
      }
    });

    // Apply sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = getColValue(a, sortConfig.key);
        const valB = getColValue(b, sortConfig.key);

        const strA = String(valA);
        const strB = String(valB);
        const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [filteredItems, colFilters, sortConfig]);

  // Métricas
  const totalTerceros = items.filter(i => i.tipo === 'TERCERO').length;
  const totalControles = items.filter(i => i.tipo === 'CONTROL').length;

  // Generar código cuando cambia el tipo
  const handleTypeChange = async (newTipo) => {
    setForm(prev => ({
      ...prev,
      tipo: newTipo,
      cod_patrimonial: ''
    }));
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetchGenerarCodigoTerceroControl(newTipo);
      setForm(prev => ({ ...prev, cod_patrimonial: res.codigo }));
    } catch (err) {
      setModalError(err.message || 'Error al generar código autogenerado.');
    } finally {
      setModalLoading(false);
    }
  };

  // Abrir modal de creación
  const handleOpenCreate = async () => {
    setForm(INITIAL_FORM_STATE);
    setIsEditMode(false);
    setModalError(null);
    setShowModal(true);
    // Generar código por defecto para TERCERO
    setModalLoading(true);
    try {
      const res = await fetchGenerarCodigoTerceroControl('TERCERO');
      setForm(prev => ({ ...prev, cod_patrimonial: res.codigo }));
    } catch (err) {
      setModalError(err.message || 'Error al generar código.');
    } finally {
      setModalLoading(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEdit = (item) => {
    setForm({
      cod_patrimonial: item.cod_patrimonial,
      tipo: item.tipo,
      denominacion: item.denominacion,
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      color: item.color || '',
      caracteristicas_accesorios: item.caracteristicas_accesorios || '',
      cod_personal: item.cod_personal || '',
      observaciones: item.observaciones || '',
      id_sucursal: item.id_sucursal || '',
      localidad: item.localidad || ''
    });
    setIsEditMode(true);
    setModalError(null);
    setShowModal(true);
  };

  // Enviar formulario (creación/actualización)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cod_patrimonial) {
      setModalError('El código patrimonial es obligatorio.');
      return;
    }
    setModalLoading(true);
    setModalError(null);
    try {
      await saveBienTercero(form.cod_patrimonial, form, isEditMode);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setShowModal(false);
      loadData();
    } catch (err) {
      setModalError(err.message || 'Error al guardar el registro.');
    } finally {
      setModalLoading(false);
    }
  };

  // Eliminar registro
  const handleDelete = async (cod) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro '${cod}'?`)) {
      return;
    }
    try {
      await deleteBienTercero(cod);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al eliminar el registro.');
    }
  };

  // Opciones de personal responsable
  const personalOptions = personal.map(p => ({
    value: p.value,
    label: `${p.value} - ${p.label}`
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0 mb-2">
        <div className="module-heading">
          <p className="module-kicker">Módulo de Bienes No Patrimoniales</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">TERCEROS Y CONTROL</h2>
          <p className="text-sm text-slate-500">
            Registro y seguimiento de bienes ajenos (Terceros) y activos no fijos menores controlados internamente.
          </p>
        </div>
        
        {/* Métricas */}
        <div className="flex flex-wrap gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-purple-500"></span>
            <span className="text-slate-500 font-semibold">Terceros:</span>
            <strong className="text-slate-800">{totalTerceros}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span className="text-slate-500 font-semibold">Control Interno:</span>
            <strong className="text-slate-800">{totalControles}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">Total bienes:</span>
            <strong className="text-slate-800">{items.length}</strong>
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Pestañas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/60 shrink-0">
        <div className="flex rounded-xl bg-slate-100 p-1 self-start">
          <button
            onClick={() => setCurrentTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'ALL' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setCurrentTab('TERCERO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'TERCERO' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Terceros
          </button>
          <button
            onClick={() => setCurrentTab('CONTROL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'CONTROL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Control Interno
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, denominación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 min-h-0 text-sm bg-white border-slate-200 rounded-xl focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>

          <div className="relative">
            <select value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)}
              className="appearance-none block w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all cursor-pointer" style={{ minHeight: '2.25rem' }}>
              <option value="">Todas las localidades</option>
              {localidades.map(l => <option key={l.value} value={l.label}>{l.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
              className="appearance-none block w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all cursor-pointer" style={{ minHeight: '2.25rem' }}>
              <option value="">Todas las sucursales</option>
              {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md shadow-emerald-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-[2.25rem] shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md shadow-rose-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-[2.25rem] shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center space-x-2 text-xs animate-fadeIn shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>¡Bien guardado correctamente!</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center space-x-2 text-xs animate-fadeIn shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de Resultados */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm py-12">
              Cargando bienes...
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-16 space-y-2">
              <Users className="w-10 h-10 text-slate-300" />
              <span>No se encontraron bienes de terceros ni de control.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 sticky top-0 z-10 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Código"
                      columnKey="cod_patrimonial"
                      data={items}
                      selectedValues={colFilters.cod_patrimonial}
                      onFilterChange={(vals) => handleFilterChange('cod_patrimonial', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'cod_patrimonial')}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <ExcelHeaderFilter
                      title="Tipo"
                      columnKey="tipo"
                      data={items}
                      selectedValues={colFilters.tipo}
                      onFilterChange={(vals) => handleFilterChange('tipo', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'tipo')}
                    />
                  </th>
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Ubicación"
                      columnKey="ubicacion"
                      data={items}
                      selectedValues={colFilters.ubicacion}
                      onFilterChange={(vals) => handleFilterChange('ubicacion', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'ubicacion')}
                    />
                  </th>
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Denominación"
                      columnKey="denominacion"
                      data={items}
                      selectedValues={colFilters.denominacion}
                      onFilterChange={(vals) => handleFilterChange('denominacion', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'denominacion')}
                    />
                  </th>
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Características"
                      columnKey="caracteristicas"
                      data={items}
                      selectedValues={colFilters.caracteristicas}
                      onFilterChange={(vals) => handleFilterChange('caracteristicas', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'caracteristicas')}
                    />
                  </th>
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Responsable"
                      columnKey="responsable"
                      data={items}
                      selectedValues={colFilters.responsable}
                      onFilterChange={(vals) => handleFilterChange('responsable', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'responsable')}
                    />
                  </th>
                  <th className="px-5 py-3">
                    <ExcelHeaderFilter
                      title="Observaciones"
                      columnKey="observaciones"
                      data={items}
                      selectedValues={colFilters.observaciones}
                      onFilterChange={(vals) => handleFilterChange('observaciones', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'observaciones')}
                    />
                  </th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[0.8125rem]">
                {filteredAndSortedItems.map((item) => (
                  <tr key={item.cod_patrimonial} className="table-row-hover text-slate-700">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{item.cod_patrimonial}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold uppercase ${
                        item.tipo === 'TERCERO'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                      }`}>
                        {item.tipo === 'TERCERO' ? 'Tercero' : 'Control'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800 leading-tight">{item.sucursal || '—'}</div>
                      <div className="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">{item.localidad || '—'}</div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={item.denominacion}>
                      {item.denominacion}
                    </td>
                    <td className="px-5 py-3">
                      <div className="leading-normal">
                        {item.marca && <span>Marca: <strong className="text-slate-800">{item.marca}</strong></span>}
                        {item.modelo && <span> \| Modelo: <strong className="text-slate-800">{item.modelo}</strong></span>}
                        {item.numero_serie && <span> \| Serie: <strong className="text-slate-800 font-mono">{item.numero_serie}</strong></span>}
                        {item.color && <span> \| Color: <strong className="text-slate-800">{item.color}</strong></span>}
                      </div>
                      {item.caracteristicas_accesorios && (
                        <div className="text-[0.6875rem] text-slate-400 mt-1 italic max-w-xs truncate" title={item.caracteristicas_accesorios}>
                          {item.caracteristicas_accesorios}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800 leading-tight">{item.responsable || <span className="text-slate-400 italic">No asignado</span>}</div>
                      {item.cod_personal && <div className="text-[0.6875rem] text-slate-400 mt-0.5 font-mono font-bold uppercase">{item.cod_personal}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[150px] truncate" title={item.observaciones}>
                      {item.observaciones || <span className="text-slate-300 italic">-</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Editar Registro"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.cod_patrimonial)}
                          title="Eliminar Registro"
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DE REGISTRO / EDICIÓN */}
      <Modal open={showModal} onClose={() => setShowModal(false)} maxWidth="520px">
        <div className="p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEditMode ? 'Editar Registro' : 'Registrar Bien de Terceros / Control'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingresa los detalles técnicos y selecciona al personal responsable del bien.
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Selector de Tipo (Tercero / Control) */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de Registro</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isEditMode}
                  onClick={() => handleTypeChange('TERCERO')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    form.tipo === 'TERCERO'
                      ? 'bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                  }`}
                >
                  TERCERO (Bienes de terceros)
                </button>
                <button
                  type="button"
                  disabled={isEditMode}
                  onClick={() => handleTypeChange('CONTROL')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    form.tipo === 'CONTROL'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                  }`}
                >
                  CONTROL (Activos no fijos controlados)
                </button>
              </div>
            </div>

            {/* Código generado */}
            <div>
              <label className="field-label">Código Patrimonial</label>
              <input
                type="text"
                disabled
                value={form.cod_patrimonial}
                className="field-input bg-slate-100 font-mono font-bold text-slate-600"
              />
              {!isEditMode && modalLoading && (
                <span className="text-[10px] text-brand-600 mt-1 block italic animate-pulse">Generando código disponible...</span>
              )}
            </div>

            {/* Características básicas */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="form-section-label">Características del Bien</span>

              <div>
                <label className="field-label">Denominación</label>
                <input
                  type="text"
                  required
                  value={form.denominacion}
                  onChange={(e) => setForm(p => ({ ...p, denominacion: e.target.value }))}
                  placeholder="Ej: TALADRO PERMANENTE DE BANCO"
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Marca</label>
                  <input
                    type="text"
                    value={form.marca}
                    onChange={(e) => setForm(p => ({ ...p, marca: e.target.value }))}
                    placeholder="Ej: BOSCH"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Modelo</label>
                  <input
                    type="text"
                    value={form.modelo}
                    onChange={(e) => setForm(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ej: GSB 13 RE"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Número de Serie</label>
                  <input
                    type="text"
                    value={form.numero_serie}
                    onChange={(e) => setForm(p => ({ ...p, numero_serie: e.target.value }))}
                    placeholder="Ej: 3601B17100"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Color</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))}
                    placeholder="Ej: AZUL"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Localidad</label>
                  <select
                    value={form.localidad}
                    onChange={(e) => setForm(p => ({ ...p, localidad: e.target.value }))}
                    className="field-input cursor-pointer"
                  >
                    <option value="">Seleccionar localidad...</option>
                    {localidades.map(l => <option key={l.value} value={l.label}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Sucursal</label>
                  <select
                    value={form.id_sucursal}
                    onChange={(e) => setForm(p => ({ ...p, id_sucursal: e.target.value ? Number(e.target.value) : '' }))}
                    className="field-input cursor-pointer"
                  >
                    <option value="">Seleccionar sucursal...</option>
                    {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Características / Accesorios</label>
                <textarea
                  rows="2"
                  value={form.caracteristicas_accesorios}
                  onChange={(e) => setForm(p => ({ ...p, caracteristicas_accesorios: e.target.value }))}
                  placeholder="Especificaciones o accesorios adicionales del bien..."
                  className="field-input resize-none py-2"
                />
              </div>

              {/* Selector de Personal Responsable */}
              <div>
                <SearchableSelect
                  label="Personal Responsable"
                  name="cod_personal"
                  value={form.cod_personal}
                  onChange={(e) => setForm(p => ({ ...p, cod_personal: e.target.value }))}
                  options={personalOptions}
                  placeholder="Busca y selecciona al responsable..."
                />
              </div>

              <div>
                <label className="field-label">Observaciones</label>
                <textarea
                  rows="2"
                  value={form.observaciones}
                  onChange={(e) => setForm(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Observaciones o comentarios acerca del origen o estado del bien..."
                  className="field-input resize-none py-2"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                disabled={modalLoading}
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-60 flex items-center space-x-1"
              >
                {modalLoading && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>}
                <span>{isEditMode ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
