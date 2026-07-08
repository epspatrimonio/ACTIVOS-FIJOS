import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, Plus, Search, Trash2, Edit3, X, AlertCircle, CheckCircle2, ChevronDown,
  FileSpreadsheet, FileText
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Modal from './Modal';
import ExcelHeaderFilter from './ExcelHeaderFilter';
import { 
  fetchInventarioFisico, saveInventarioFisico, deleteInventarioFisico, fetchGenerarCodigoSobrante,
  fetchActivos, fetchSubcategorias, fetchSucursales, fetchLocalidades
} from '../utils/api';

const INITIAL_FORM_STATE = {
  cod_patrimonial: '',
  tipo: 'FALTANTE', // FALTANTE | SOBRANTE
  cod_categoria: '',
  denominacion: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  caracteristicas_accesorios: '',
  observaciones: '',
  id_sucursal: '',
  localidad: ''
};

export default function InventarioFisicoPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Datos auxiliares para el formulario
  const [activos, setActivos] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  
  // Pestañas y búsqueda
  const [currentTab, setCurrentTab] = useState('ALL'); // ALL | FALTANTE | SOBRANTE
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
      case 'subcategoria': return item.subcategoria || '';
      case 'ubicacion': return `${item.sucursal || ''} / ${item.localidad || ''}`;
      case 'denominacion': return item.denominacion || '';
      case 'caracteristicas': return `${item.marca || ''} ${item.modelo || ''} ${item.numero_serie || ''}`;
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
      const data = await fetchInventarioFisico();
      setItems(data);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos del inventario físico.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar listas auxiliares para el formulario
  const loadAuxData = async () => {
    try {
      const [activosData, subcatData, sucursalData, localidadData] = await Promise.all([
        fetchActivos(),
        fetchSubcategorias(),
        fetchSucursales(),
        fetchLocalidades()
      ]);
      setActivos(activosData);
      setSubcategorias(subcatData);
      setSucursales(sucursalData);
      setLocalidades(localidadData);
    } catch (err) {
      console.error('Error al cargar datos auxiliares del formulario:', err);
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
      "Tipo": item.tipo,
      "Denominación": item.denominacion,
      "Marca": item.marca || '—',
      "Modelo": item.modelo || '—',
      "N° Serie": item.numero_serie || '—',
      "Color": item.color || '—',
      "Subcategoría": item.subcategoria || '—',
      "Sucursal": item.sucursal || '—',
      "Localidad": item.localidad || '—',
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
    window.XLSX.utils.book_append_sheet(wb, ws, "InventarioFisico");
    window.XLSX.writeFile(wb, `Reporte_Inventario_Fisico_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    doc.text("REPORTE DE INVENTARIO FÍSICO (FALTANTES Y SOBRANTES)", 14, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 31);

    const headers = [["Código", "Tipo", "Denominación", "Marca/Modelo/Serie", "Sucursal / Localidad", "Fecha Reg.", "Observaciones"]];
    const tableRows = filteredItems.map(item => [
      item.cod_patrimonial,
      item.tipo,
      item.denominacion,
      `M: ${item.marca || 'S/M'}\nMod: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}`,
      `${item.sucursal || '—'}\n(${item.localidad || '—'})`,
      item.created_at ? new Date(item.created_at).toLocaleDateString('es-PE') : '—',
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
        2: { cellWidth: 70 },
        3: { cellWidth: 45 },
        4: { cellWidth: 45 },
        5: { cellWidth: 20 },
        6: { cellWidth: 55 }
      }
    });
    doc.save(`Reporte_Inventario_Fisico_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Filtrado de items local
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
      item.subcategoria?.toLowerCase().includes(searchLower) ||
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
  const totalFaltantes = items.filter(i => i.tipo === 'FALTANTE').length;
  const totalSobrantes = items.filter(i => i.tipo === 'SOBRANTE').length;

  // Manejar cambio de tipo en el formulario
  const handleTypeChange = (newTipo) => {
    setForm(prev => ({
      ...INITIAL_FORM_STATE,
      tipo: newTipo,
      cod_categoria: newTipo === 'FALTANTE' ? '' : prev.cod_categoria
    }));
    setSelectedCategory('');
    setModalError(null);
  };

  // Autocompletar cuando se selecciona un activo (para Faltantes)
  const handleActivoSelect = (activoCod) => {
    if (!activoCod) {
      setForm(prev => ({ ...prev, cod_patrimonial: '' }));
      setSelectedCategory('');
      return;
    }
    const act = activos.find(a => a.cod_patrimonial === activoCod);
    if (act) {
      const foundSubcat = subcategorias.find(s => Number(s.value) === Number(act.cod_categoria));
      if (foundSubcat) {
        setSelectedCategory(foundSubcat.categoria);
      } else {
        setSelectedCategory('');
      }
      setForm(prev => ({
        ...prev,
        cod_patrimonial: act.cod_patrimonial,
        cod_categoria: act.cod_categoria,
        denominacion: act.denominacion || '',
        marca: act.marca || '',
        modelo: act.modelo || '',
        numero_serie: act.numero_serie || '',
        color: act.color || '',
        caracteristicas_accesorios: act.caracteristicas_accesorios || '',
        id_sucursal: act.id_sucursal || '',
        localidad: act.localidad || '',
        observaciones: prev.observaciones
      }));
    }
  };

  // Manejar cambio de categoría para Sobrantes
  const handleCategoryChange = (catName) => {
    setSelectedCategory(catName);
    setForm(prev => ({
      ...prev,
      cod_categoria: '',
      cod_patrimonial: ''
    }));
  };

  // Generar código y autocompletar para Sobrantes cuando cambia la subcategoría
  const handleCategorySelect = async (catId) => {
    if (!catId) {
      setForm(prev => ({ ...prev, cod_categoria: '', cod_patrimonial: isEditMode ? prev.cod_patrimonial : '' }));
      return;
    }
    setForm(prev => ({ ...prev, cod_categoria: Number(catId) }));
    if (isEditMode) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetchGenerarCodigoSobrante(catId);
      setForm(prev => ({ ...prev, cod_patrimonial: res.codigo }));
    } catch (err) {
      setModalError(err.message || 'Error al generar código para sobrante.');
    } finally {
      setModalLoading(false);
    }
  };

  // Abrir modal de creación
  const handleOpenCreate = () => {
    setForm(INITIAL_FORM_STATE);
    setSelectedCategory('');
    setIsEditMode(false);
    setModalError(null);
    setShowModal(true);
  };

  // Abrir modal de edición
  const handleOpenEdit = (item) => {
    const foundSubcat = subcategorias.find(s => Number(s.value) === Number(item.cod_categoria));
    if (foundSubcat) {
      setSelectedCategory(foundSubcat.categoria);
    } else {
      setSelectedCategory('');
    }
    setForm({
      cod_patrimonial: item.cod_patrimonial,
      tipo: item.tipo,
      cod_categoria: item.cod_categoria,
      denominacion: item.denominacion,
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      color: item.color || '',
      caracteristicas_accesorios: item.caracteristicas_accesorios || '',
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
    if (form.tipo === 'FALTANTE' && !form.cod_patrimonial) {
      setModalError('Debe seleccionar un activo fijo existente para registrar un faltante.');
      return;
    }
    if (!form.cod_patrimonial) {
      setModalError('El código patrimonial es obligatorio.');
      return;
    }
    if (!form.cod_categoria) {
      setModalError('Debe seleccionar una categoría y subcategoría.');
      return;
    }
    setModalLoading(true);
    setModalError(null);
    try {
      await saveInventarioFisico(form.cod_patrimonial, form, isEditMode);
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
    if (!window.confirm(`¿Está seguro de eliminar el registro '${cod}' de la base de datos de inventario físico?`)) {
      return;
    }
    try {
      await deleteInventarioFisico(cod);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al eliminar el registro.');
    }
  };

  // Opciones de activos para el selector de Faltantes
  const activoOptions = activos.map(a => ({
    value: a.cod_patrimonial,
    label: `${a.cod_patrimonial} - ${a.denominacion || ''} (${a.marca || ''} / ${a.modelo || ''})`
  }));

  // Obtener categorías únicas
  const uniqueCategories = [...new Set(subcategorias.map(s => s.categoria))].sort();

  // Obtener subcategorías filtradas por la categoría seleccionada
  const filteredSubcats = subcategorias
    .filter(s => s.categoria === selectedCategory)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0 mb-2">
        <div className="module-heading">
          <p className="module-kicker">Módulo de Conciliación</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">INVENTARIO FÍSICO</h2>
          <p className="text-sm text-slate-500">
            Registro de Faltantes (bienes no hallados) y Sobrantes (bienes encontrados sin registro patrimonial).
          </p>
        </div>
        
        {/* Métricas */}
        <div className="flex flex-wrap gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span className="text-slate-500 font-semibold">Faltantes:</span>
            <strong className="text-slate-800">{totalFaltantes}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-500 font-semibold">Sobrantes:</span>
            <strong className="text-slate-800">{totalSobrantes}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">Total items:</span>
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
            onClick={() => setCurrentTab('FALTANTE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'FALTANTE' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Faltantes
          </button>
          <button
            onClick={() => setCurrentTab('SOBRANTE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'SOBRANTE' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sobrantes
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
          <span>¡Registro guardado correctamente!</span>
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
              Cargando registros...
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-16 space-y-2">
              <ClipboardCheck className="w-10 h-10 text-slate-300" />
              <span>No se encontraron registros de inventario físico.</span>
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
                      title="Subcategoría"
                      columnKey="subcategoria"
                      data={items}
                      selectedValues={colFilters.subcategoria}
                      onFilterChange={(vals) => handleFilterChange('subcategoria', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'subcategoria')}
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
                        item.tipo === 'FALTANTE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800 leading-tight">{item.subcategoria}</div>
                      <div className="text-[0.6875rem] text-slate-400 mt-0.5 font-bold uppercase">{item.categoria}</div>
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
                        {item.numero_serie && <span> \| N° Serie: <strong className="text-slate-800 font-mono">{item.numero_serie}</strong></span>}
                        {item.color && <span> \| Color: <strong className="text-slate-800">{item.color}</strong></span>}
                      </div>
                      {item.caracteristicas_accesorios && (
                        <div className="text-[0.6875rem] text-slate-400 mt-1 italic max-w-xs truncate" title={item.caracteristicas_accesorios}>
                          {item.caracteristicas_accesorios}
                        </div>
                      )}
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
                {isEditMode ? 'Editar Registro de Inventario' : 'Registrar Conciliación de Inventario'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingresa los datos del faltante o sobrante del inventario físico.
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

            {/* Selector de Tipo (Faltante / Sobrante) */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de Hallazgo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isEditMode}
                  onClick={() => handleTypeChange('FALTANTE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    form.tipo === 'FALTANTE'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                  }`}
                >
                  FALTANTE (Activo Faltante)
                </button>
                <button
                  type="button"
                  disabled={isEditMode}
                  onClick={() => handleTypeChange('SOBRANTE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    form.tipo === 'SOBRANTE'
                      ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                  }`}
                >
                  SOBRANTE (Activo Sobrante)
                </button>
              </div>
            </div>

            {/* Selección de Código / Activo */}
            {form.tipo === 'FALTANTE' ? (
              <div className="space-y-4">
                {isEditMode ? (
                  <div>
                    <label className="field-label">Código Patrimonial</label>
                    <input
                      type="text"
                      disabled
                      value={form.cod_patrimonial}
                      className="field-input bg-slate-100 font-mono font-bold text-slate-600"
                    />
                  </div>
                ) : (
                  <SearchableSelect
                    label="Seleccionar Activo Fijo Faltante"
                    name="cod_patrimonial"
                    value={form.cod_patrimonial}
                    onChange={(e) => handleActivoSelect(e.target.value)}
                    options={activoOptions}
                    required
                    placeholder="Busca por código o denominación..."
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="field-label">Categoría</label>
                    <input
                      type="text"
                      disabled
                      value={selectedCategory || '—'}
                      className="field-input bg-slate-50 text-slate-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="field-label">Subcategoría</label>
                    <input
                      type="text"
                      disabled
                      value={subcategorias.find(s => Number(s.value) === Number(form.cod_categoria))?.label || '—'}
                      className="field-input bg-slate-50 text-slate-500 font-medium"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // SOBRANTE
              <div className="space-y-4">
                {isEditMode ? (
                  <div>
                    <label className="field-label">Código Patrimonial</label>
                    <input
                      type="text"
                      disabled
                      value={form.cod_patrimonial}
                      className="field-input bg-slate-100 font-mono font-bold text-slate-600"
                    />
                  </div>
                ) : (
                  form.cod_patrimonial && (
                    <div className="text-[0.8125rem] text-slate-600 bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between animate-fadeIn">
                      <span>Código sugerido generado:</span>
                      <strong className="font-mono text-emerald-800 text-sm font-bold bg-white px-2.5 py-0.5 rounded shadow-sm border border-emerald-200">{form.cod_patrimonial}</strong>
                    </div>
                  )
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Categoría <span className="text-rose-500">*</span></label>
                    <select
                      required
                      value={selectedCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="field-input cursor-pointer"
                    >
                      <option value="">Seleccionar categoría...</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedCategory && (
                    <div className="animate-fadeIn">
                      <label className="field-label">Subcategoría <span className="text-rose-500">*</span></label>
                      <select
                        required
                        value={form.cod_categoria}
                        onChange={(e) => handleCategorySelect(e.target.value)}
                        className="field-input cursor-pointer"
                      >
                        <option value="">Seleccionar subcategoría...</option>
                        {filteredSubcats.map(subcat => (
                          <option key={subcat.value} value={subcat.value}>{subcat.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Características básicas del bien (autocompletados para faltantes, editables para todos) */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="form-section-label">Características del Bien</span>

              <div>
                <label className="field-label">Denominación</label>
                <input
                  type="text"
                  required
                  disabled={form.tipo === 'FALTANTE' && !isEditMode}
                  value={form.denominacion}
                  onChange={(e) => setForm(p => ({ ...p, denominacion: e.target.value }))}
                  placeholder="Ej: LAPTOP LENOVO THINKPAD E14"
                  className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Marca</label>
                  <input
                    type="text"
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.marca}
                    onChange={(e) => setForm(p => ({ ...p, marca: e.target.value }))}
                    placeholder="Ej: LENOVO"
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="field-label">Modelo</label>
                  <input
                    type="text"
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.modelo}
                    onChange={(e) => setForm(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ej: THINKPAD E14 G4"
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Número de Serie</label>
                  <input
                    type="text"
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.numero_serie}
                    onChange={(e) => setForm(p => ({ ...p, numero_serie: e.target.value }))}
                    placeholder="Ej: PF3XG82Y"
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                  >
                  </input>
                </div>
                <div>
                  <label className="field-label">Color</label>
                  <input
                    type="text"
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.color}
                    onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))}
                    placeholder="Ej: NEGRO"
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Localidad</label>
                  <select
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.localidad}
                    onChange={(e) => setForm(p => ({ ...p, localidad: e.target.value }))}
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''} cursor-pointer`}
                  >
                    <option value="">Seleccionar localidad...</option>
                    {localidades.map(l => <option key={l.value} value={l.label}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Sucursal</label>
                  <select
                    disabled={form.tipo === 'FALTANTE' && !isEditMode}
                    value={form.id_sucursal}
                    onChange={(e) => setForm(p => ({ ...p, id_sucursal: e.target.value ? Number(e.target.value) : '' }))}
                    className={`field-input ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''} cursor-pointer`}
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
                  disabled={form.tipo === 'FALTANTE' && !isEditMode}
                  value={form.caracteristicas_accesorios}
                  onChange={(e) => setForm(p => ({ ...p, caracteristicas_accesorios: e.target.value }))}
                  placeholder="Características físicas o accesorios incluidos..."
                  className={`field-input resize-none py-2 ${form.tipo === 'FALTANTE' && !isEditMode ? 'bg-slate-50 text-slate-500' : ''}`}
                />
              </div>

              <div>
                <label className="field-label">Observaciones de Inventario</label>
                <textarea
                  rows="2"
                  value={form.observaciones}
                  onChange={(e) => setForm(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Detalles del por qué falta o por qué sobra..."
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
