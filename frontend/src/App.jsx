import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, FolderOpen, PlusCircle, Smartphone, Car, ShieldCheck, 
  RefreshCw, LayoutDashboard, LogOut, Mail, Lock, AlertCircle,
  ClipboardCheck, Users, Hammer, Coins, FileSpreadsheet, FileText, ArrowLeftRight
} from 'lucide-react';

import Filters from './components/Filters';
import ActivosTable from './components/ActivosTable';
import ActivoForm from './components/ActivoForm';
import SyncPanel from './components/SyncPanel';
import DocumentosPanel from './components/DocumentosPanel';
import CelularesModule from './components/CelularesModule';
import SoatModule from './components/SoatModule';
import VehiculosModule from './components/VehiculosModule';
import AdminDashboard from './components/AdminDashboard';
import InventarioFisicoPanel from './components/InventarioFisicoPanel';
import BienesTercerosPanel from './components/BienesTercerosPanel';
import ReporteContable from './components/ReporteContable';
import SalidaBienesPanel from './components/SalidaBienesPanel';
import TransferenciasPanel from './components/TransferenciasPanel';
import { fetchActivos, getDashboardUrl } from './utils/api';

// Componente de Login alineado al diseño del prototipo
function Login({ onLogin }) {
  const [email, setEmail] = useState('eps.patrimonio@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (email === 'eps.patrimonio@gmail.com' && password === 'admin') {
      onLogin();
    } else {
      setError('Clave de seguridad o correo incorrectos.');
    }
  };

  return (
    <div className="min-h-screen app-shell flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 sm:p-8 max-w-md w-full shadow-xl shadow-slate-200/70 border border-slate-200/80 text-center animate-fadeIn">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <img src="/logo.jpg" alt="Logo EPS Selva Central" className="w-24 h-24 object-contain rounded-xl p-1 bg-white ring-1 ring-slate-200 shadow-sm" />
            <div className="absolute -right-2 -bottom-2 h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-500 to-[#00B0F0] text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
        
        {/* Título */}
        <p className="text-[0.6875rem] text-brand-700 font-extrabold tracking-wider uppercase">Juan Eder Systems</p>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">Control Patrimonial</h2>
        <div className="mt-1 mb-6 space-y-0.5">
          <p className="text-xs text-slate-500 font-medium">Registro, control y consulta de activos fijos</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl mb-4 text-left animate-fadeIn text-xs">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {/* Correo */}
          <div>
            <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-1.5">Correo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eps.patrimonio@gmail.com"
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Clave de Seguridad */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[0.8125rem] font-semibold text-slate-600">Clave de seguridad</label>
              <span className="text-[0.6875rem] text-brand-700 font-semibold cursor-help" title="La clave por defecto es 'admin'">
                Defecto: admin
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••"
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-600/20 transition-all active:scale-[0.98] text-sm mt-2"
          >
            Ingresar al Sistema
          </button>
        </form>

        <div className="border-t border-slate-100 mt-8 pt-4">
          <span className="text-[0.6875rem] font-bold text-slate-400 tracking-wider uppercase">
            Juan Eder Systems &copy; {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [activeTab, setActiveTab] = useState('INVENTARIO'); // INVENTARIO | OBRAS | REGISTRO | DOCUMENTOS | CELULARES | VEHICULOS | SOAT | SINCRONIZAR
  const [filters, setFilters] = useState({ search: '', estado_activo: '', id_sucursal: '', cod_personal: '', n_doc: '' });
  const [activos, setActivos] = useState([]);
  const [filteredActivos, setFilteredActivos] = useState([]);
  const [filteredObras, setFilteredObras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingActivo, setEditingActivo] = useState(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [preSelectedDoc, setPreSelectedDoc] = useState(null);

  const handleDocumentRegistered = (tipo, n_doc) => {
    const confirmRegisterAsset = window.confirm("¿Se va a registrar un activo fijo?");
    if (confirmRegisterAsset) {
      setPreSelectedDoc({ tipo, n_doc });
      setActiveTab('REGISTRO');
    }
  };

  const handleTabChange = (newTab) => {
    if (isFormDirty) {
      const confirmLeave = window.confirm("Tienes cambios sin guardar en el registro de activos. Si sales de esta pestaña, perderás el progreso. ¿Deseas salir de todos modos?");
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setEditingActivo(null);
    if (newTab !== 'REGISTRO') {
      setPreSelectedDoc(null);
    }
    setActiveTab(newTab);
  };

  const handleExportActivosExcel = (data, title) => {
    if (!window.XLSX) {
      alert('La librería SheetJS no está cargada.');
      return;
    }
    const dateToExcelSerial = (dateStr) => {
      if (!dateStr || dateStr === '—') return null;
      const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const baseDate = Date.UTC(1899, 11, 30);
        const targetDate = Date.UTC(y, m - 1, d);
        const msPerDay = 24 * 60 * 60 * 1000;
        return (targetDate - baseDate) / msPerDay;
      }
      return null;
    };

    const sheetData = data.map(item => ({
      "Código Patrimonial": item.cod_patrimonial,
      "Documento": item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—',
      "Fuente": item.fuente || '—',
      "Fecha de Alta": dateToExcelSerial(item.fecha_alta_factura || item.fecha_alta),
      "Fecha Reg. Contable": dateToExcelSerial(item.fecha_registro_contable),
      "Nota de Pedido": item.nota_pedido || '—',
      "Centro de Costo": item.centro_costo || '—',
      "Solicitado Por": item.requerido_por || '—',
      "F. Asignación": dateToExcelSerial(item.fecha_asignacion),
      "Sucursal": item.sucursal || '—',
      "Localidad": item.localidad || '—',
      "Denominación del Activo": item.denominacion,
      "Subcategoría": item.subcategoria || '—',
      "Marca": item.marca || '—',
      "Modelo": item.modelo || '—',
      "N° Serie": item.numero_serie || '—',
      "Color": item.color || '—',
      "Estado": item.estado_activo,
      "Valor Libros": item.valor_en_libros ? Number(Number(item.valor_en_libros).toFixed(4)) : 0,
      "Valor Neto": item.valor_neto ? Number(Number(item.valor_neto).toFixed(4)) : 0,
      "Responsable": item.responsable || '—',
      "Cuenta Contable": item.cuenta_contable || '—'
    }));
    const ws = window.XLSX.utils.json_to_sheet(sheetData);

    // Force dd/mm/yyyy format on date cells
    const dateHeaders = ["Fecha de Alta", "Fecha Reg. Contable", "F. Asignación", "Fecha Inicio", "Fecha Vencimiento", "Fecha Ingreso", "Fecha Registro"];
    if (ws['!ref']) {
      const range = window.XLSX.utils.decode_range(ws['!ref']);
      const dateCols = [];
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellAddress = window.XLSX.utils.encode_cell({ r: 0, c: c });
        const cell = ws[cellAddress];
        if (cell && dateHeaders.includes(cell.v)) {
          dateCols.push(c);
        }
      }
      for (let r = range.s.r + 1; r <= range.e.r; ++r) {
        for (const colIdx of dateCols) {
          const cellAddress = window.XLSX.utils.encode_cell({ r: r, c: colIdx });
          const cell = ws[cellAddress];
          if (cell && cell.t === 'n') {
            cell.z = 'dd/mm/yyyy';
          }
        }
      }
    }

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, title);
    window.XLSX.writeFile(wb, `${title}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportActivosPDF = (data, title) => {
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
    doc.text(title.toUpperCase().replace(/_/g, ' '), 14, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 31);

    const headers = [["Código", "Documento", "Sucursal / Localidad", "Denominación del Activo", "Marca/Modelo/Serie", "Estado", "Valor Libros", "Valor Neto", "Responsable"]];
    const tableRows = data.map(item => [
      item.cod_patrimonial,
      item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—',
      `${item.sucursal || '—'}\n(${item.localidad || '—'})`,
      item.denominacion,
      `M: ${item.marca || 'S/M'}\nMod: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}`,
      item.estado_activo,
      new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(item.valor_en_libros) || 0),
      new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(item.valor_neto) || 0),
      item.responsable || 'Sin asignar'
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
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 55 },
        4: { cellWidth: 45 },
        5: { cellWidth: 20 },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 35 }
      }
    });
    doc.save(`${title}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleEdit = (activo) => {
    setEditingActivo(activo);
    setActiveTab('REGISTRO');
  };

  const handleCancelEdit = () => {
    setIsFormDirty(false);
    setEditingActivo(null);
    setActiveTab('INVENTARIO');
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = () => {
    if (isFormDirty) {
      const confirmLeave = window.confirm("Tienes cambios sin guardar en el registro de activos. Si cierras sesión, perderás el progreso. ¿Deseas salir de todos modos?");
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  // Cargar activos desde el backend
  const loadActivos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActivos({
        estado_activo: filters.estado_activo,
        id_sucursal: filters.id_sucursal,
      });
      const sorted = [...data].sort((a, b) => {
        const dateA = a.fecha_alta_factura || a.fecha_registro_contable || a.fecha_asignacion || '0000-00-00';
        const dateB = b.fecha_alta_factura || b.fecha_registro_contable || b.fecha_asignacion || '0000-00-00';
        return dateB.localeCompare(dateA);
      });
      setActivos(sorted);
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar cada vez que cambian los filtros de base de datos o cuando se cambia a la pestaña de inventario, obras, contable o salidas
  useEffect(() => {
    if (isLoggedIn && (activeTab === 'INVENTARIO' || activeTab === 'OBRAS' || activeTab === 'CONTABLE' || activeTab === 'SALIDAS')) {
      loadActivos();
    }
  }, [filters.estado_activo, filters.id_sucursal, activeTab, isLoggedIn]);

  // Filtro del buscador y responsable en memoria local (cliente)
  useEffect(() => {
    let result = activos;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((act) => {
        const matchCod = act.cod_patrimonial?.toLowerCase().includes(searchLower);
        const matchDenom = act.denominacion?.toLowerCase().includes(searchLower);
        const matchMarca = act.marca?.toLowerCase().includes(searchLower);
        const matchModelo = act.modelo?.toLowerCase().includes(searchLower);
        return matchCod || matchDenom || matchMarca || matchModelo;
      });
    }

    if (filters.cod_personal) {
      result = result.filter((act) => act.cod_personal === filters.cod_personal);
    }

    if (filters.n_doc) {
      result = result.filter((act) => act.n_doc === filters.n_doc);
    }

    // Dividir los bienes muebles en Activos Fijos generales y Obras en Curso (inician con 339)
    const assetsOnly = result.filter((act) => !act.cod_patrimonial?.startsWith('339'));
    const obrasOnly = result.filter((act) => act.cod_patrimonial?.startsWith('339'));

    setFilteredActivos(assetsOnly);
    setFilteredObras(obrasOnly);
  }, [filters.search, filters.cod_personal, filters.n_doc, activos]);

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col">
      {/* Barra de Navegación Superior */}
      <header className="app-topbar">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fila 1: Logo + Título + Logout */}
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center space-x-3">
              <img 
                src="/logo.jpg" 
                alt="Logo EPS Selva Central" 
                className="w-10 h-10 object-contain rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-white/20" 
              />
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">Control Patrimonial</h1>
                <p className="text-[0.6875rem] text-brand-100 font-bold tracking-wide uppercase">Gestión de activos fijos</p>
              </div>
            </div>

            {/* Botón Salir */}
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Fila 2: Navegación de pestañas en 2 niveles */}
          <div className="pb-3 -mt-0.5 space-y-2.5">
            {/* Nivel 1: Registro y Gestión */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[0.6875rem] font-bold text-white/60 uppercase tracking-wider min-w-[125px] select-none py-1">
                Registro y Gestión:
              </span>
              <nav className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-1">
                <button
                  onClick={() => handleTabChange('DOCUMENTOS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'DOCUMENTOS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'DOCUMENTOS' ? 'bg-amber-50 text-amber-600' : 'bg-white/15 text-white/90'}`}>
                    <FolderOpen className="w-3 h-3" />
                  </span>
                  <span>Documentos</span>
                </button>

                <button
                  onClick={() => handleTabChange('REGISTRO')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'REGISTRO'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'REGISTRO' ? 'bg-emerald-50 text-emerald-600' : 'bg-white/15 text-white/90'}`}>
                    <PlusCircle className="w-3 h-3" />
                  </span>
                  <span>Registrar</span>
                </button>

                <button
                  onClick={() => handleTabChange('DASHBOARD')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'DASHBOARD'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'DASHBOARD' ? 'bg-indigo-50 text-indigo-600' : 'bg-white/15 text-white/90'}`}>
                    <LayoutDashboard className="w-3 h-3" />
                  </span>
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => handleTabChange('SINCRONIZAR')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'SINCRONIZAR'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'SINCRONIZAR' ? 'bg-slate-100 text-slate-600' : 'bg-white/15 text-white/90'}`}>
                    <RefreshCw className="w-3 h-3" />
                  </span>
                  <span>Sincronizar</span>
                </button>

                <button
                  onClick={() => handleTabChange('SALIDAS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'SALIDAS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'SALIDAS' ? 'bg-rose-50 text-rose-600' : 'bg-white/15 text-white/90'}`}>
                    <LogOut className="rotate-180 w-3 h-3" />
                  </span>
                  <span>Salida de Bienes</span>
                </button>
              </nav>
            </div>

            {/* Nivel 2: Tablas y Consultas */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[0.6875rem] font-bold text-white/60 uppercase tracking-wider min-w-[125px] select-none py-1">
                Tablas y Consultas:
              </span>
              <nav className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-1">
                <button
                  onClick={() => handleTabChange('INVENTARIO')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'INVENTARIO'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'INVENTARIO' ? 'bg-brand-50 text-brand-600' : 'bg-white/15 text-white/90'}`}>
                    <ClipboardList className="w-3 h-3" />
                  </span>
                  <span>Inventario</span>
                </button>

                <button
                  onClick={() => handleTabChange('OBRAS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'OBRAS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'OBRAS' ? 'bg-orange-50 text-orange-600' : 'bg-white/15 text-white/90'}`}>
                    <Hammer className="w-3 h-3" />
                  </span>
                  <span>Obras en Curso</span>
                </button>

                <button
                  onClick={() => handleTabChange('CONTABLE')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'CONTABLE'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'CONTABLE' ? 'bg-yellow-50 text-yellow-600' : 'bg-white/15 text-white/90'}`}>
                    <Coins className="w-3 h-3" />
                  </span>
                  <span>Rep. Contable</span>
                </button>

                <button
                  onClick={() => handleTabChange('VEHICULOS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'VEHICULOS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'VEHICULOS' ? 'bg-blue-50 text-blue-600' : 'bg-white/15 text-white/90'}`}>
                    <Car className="w-3 h-3" />
                  </span>
                  <span>Vehículos</span>
                </button>

                <button
                  onClick={() => handleTabChange('SOAT')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'SOAT'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'SOAT' ? 'bg-rose-50 text-rose-600' : 'bg-white/15 text-white/90'}`}>
                    <ShieldCheck className="w-3 h-3" />
                  </span>
                  <span>SOAT</span>
                </button>

                <button
                  onClick={() => handleTabChange('CELULARES')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'CELULARES'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'CELULARES' ? 'bg-cyan-50 text-cyan-600' : 'bg-white/15 text-white/90'}`}>
                    <Smartphone className="w-3 h-3" />
                  </span>
                  <span>Celulares</span>
                </button>

                <button
                  onClick={() => handleTabChange('INVENTARIO_FISICO')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'INVENTARIO_FISICO'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'INVENTARIO_FISICO' ? 'bg-amber-50 text-amber-600' : 'bg-white/15 text-white/90'}`}>
                    <ClipboardCheck className="w-3 h-3" />
                  </span>
                  <span>Inv. Físico</span>
                </button>

                <button
                  onClick={() => handleTabChange('BIENES_TERCEROS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'BIENES_TERCEROS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'BIENES_TERCEROS' ? 'bg-purple-50 text-purple-600' : 'bg-white/15 text-white/90'}`}>
                    <Users className="w-3 h-3" />
                  </span>
                  <span>Terceros</span>
                </button>

                <button
                  onClick={() => handleTabChange('TRANSFERENCIAS')}
                  className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all duration-200 ${
                    activeTab === 'TRANSFERENCIAS'
                      ? 'bg-white text-brand-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${activeTab === 'TRANSFERENCIAS' ? 'bg-emerald-50 text-emerald-600' : 'bg-white/15 text-white/90'}`}>
                    <ArrowLeftRight className="w-3 h-3" />
                  </span>
                  <span>Transferencias</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0 ${
        ['INVENTARIO', 'OBRAS', 'CONTABLE', 'VEHICULOS', 'SOAT', 'CELULARES', 'INVENTARIO_FISICO', 'BIENES_TERCEROS', 'TRANSFERENCIAS'].includes(activeTab) ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
      }`}>
        {activeTab === 'INVENTARIO' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0 mb-2">
              <div className="module-heading">
                <p className="module-kicker">Inventario operativo</p>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">ACTIVOS FIJOS REGISTRADOS</h2>
                <p className="text-sm text-slate-500">Listado de bienes muebles patrimoniales.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="metric-pill">
                  Total encontrados: <strong>{filteredActivos.length}</strong>
                </div>
                <button
                  onClick={() => handleExportActivosExcel(filteredActivos, 'Inventario')}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] shadow-md shadow-emerald-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => handleExportActivosPDF(filteredActivos, 'Inventario')}
                  className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] shadow-md shadow-rose-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
            
            <div className="shrink-0">
              <Filters filters={filters} onChange={setFilters} activeTab={activeTab} />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ActivosTable 
                activos={filteredActivos} 
                loading={loading} 
                error={error} 
                onEdit={handleEdit} 
                onDeleteSuccess={loadActivos} 
                activeTab={activeTab}
              />
            </div>
          </div>
        )}

        {activeTab === 'OBRAS' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0 mb-2">
              <div className="module-heading">
                <p className="module-kicker">Obras en ejecución y proyectos</p>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">OBRAS EN CURSO</h2>
                <p className="text-sm text-slate-500">Listado de bienes patrimoniales asociados a proyectos y obras en curso (PMO).</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="metric-pill">
                  Total encontrados: <strong>{filteredObras.length}</strong>
                </div>
                <button
                  onClick={() => handleExportActivosExcel(filteredObras, 'Obras_En_Curso')}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] shadow-md shadow-emerald-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => handleExportActivosPDF(filteredObras, 'Obras_En_Curso')}
                  className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] shadow-md shadow-rose-600/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
            
            <div className="shrink-0">
              <Filters filters={filters} onChange={setFilters} activeTab={activeTab} />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ActivosTable 
                activos={filteredObras} 
                loading={loading} 
                error={error} 
                onEdit={handleEdit} 
                onDeleteSuccess={loadActivos} 
                activeTab={activeTab}
              />
            </div>
          </div>
        )}

        {activeTab === 'CONTABLE' && (
          <ReporteContable 
            assets={activos} 
            loading={loading} 
            error={error} 
          />
        )}

        {activeTab === 'DOCUMENTOS' && (
          <div className="space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
            <DocumentosPanel onDocumentRegistered={handleDocumentRegistered} />
          </div>
        )}

        {activeTab === 'REGISTRO' && (
          <div className="space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
            <div className="mb-6 module-heading">
              <p className="module-kicker">Registro patrimonial</p>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {editingActivo ? 'Editar Activo Fijo' : 'Registrar Nuevo Activo Fijo'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingActivo 
                  ? 'Modifica los campos del activo seleccionado. Las restricciones se validan automáticamente.' 
                  : 'Introduce los datos del bien. Las validaciones de integridad se realizan automáticamente.'}
              </p>
            </div>
            
            <ActivoForm 
              onSuccess={loadActivos} 
              editingActivo={editingActivo} 
              onCancelEdit={handleCancelEdit}
              setIsDirty={setIsFormDirty}
              preSelectedDoc={preSelectedDoc}
              onClearPreSelectedDoc={() => setPreSelectedDoc(null)}
              onNavigateTab={handleTabChange}
            />
          </div>
        )}

        {activeTab === 'SINCRONIZAR' && (
          <div className="space-y-4 animate-fadeIn pt-4 w-full max-w-full overflow-hidden">
            <SyncPanel />
          </div>
        )}

        {activeTab === 'CELULARES' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <CelularesModule />
          </div>
        )}

        {activeTab === 'VEHICULOS' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <VehiculosModule onNavigateTab={handleTabChange} onEditActivo={handleEdit} />
          </div>
        )}

        {activeTab === 'SOAT' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <SoatModule />
          </div>
        )}

        {activeTab === 'INVENTARIO_FISICO' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <InventarioFisicoPanel />
          </div>
        )}

        {activeTab === 'BIENES_TERCEROS' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <BienesTercerosPanel />
          </div>
        )}

        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <AdminDashboard />
          </div>
        )}

        {activeTab === 'SALIDAS' && (
          <SalidaBienesPanel />
        )}

        {activeTab === 'TRANSFERENCIAS' && (
          <TransferenciasPanel />
        )}
      </main>

      {/* Pie de Página */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center text-[0.8125rem] text-slate-400">
          Control Patrimonial v1.0.0 © {new Date().getFullYear()} - Juan Eder Systems
        </div>
      </footer>
    </div>
  );
}
