import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ClipboardList, FolderOpen, PlusCircle, Smartphone, Car, ShieldCheck, 
  RefreshCw, LayoutDashboard, LogOut, Mail, Lock, AlertCircle,
  ClipboardCheck, Users, Hammer, Coins, FileSpreadsheet, FileText, ArrowLeftRight,
  ChevronDown, Menu, X, ExternalLink, Package, HardHat
} from 'lucide-react';

import Filters from './components/Filters';
import ActivosTable from './components/ActivosTable';
import ActivoForm from './components/ActivoForm';
import { fetchActivos, getDashboardUrl } from './utils/api';
import { generateStandardPDF } from './utils/pdfExportHelper';

// Carga diferida (Lazy Loading) de módulos pesados para optimizar el bundle inicial
const SyncPanel = React.lazy(() => import('./components/SyncPanel'));
const DocumentosPanel = React.lazy(() => import('./components/DocumentosPanel'));
const CelularesModule = React.lazy(() => import('./components/CelularesModule'));
const SoatModule = React.lazy(() => import('./components/SoatModule'));
const VehiculosModule = React.lazy(() => import('./components/VehiculosModule'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const InventarioFisicoPanel = React.lazy(() => import('./components/InventarioFisicoPanel'));
const BienesTercerosPanel = React.lazy(() => import('./components/BienesTercerosPanel'));
const ReporteContable = React.lazy(() => import('./components/ReporteContable'));
const SalidaBienesPanel = React.lazy(() => import('./components/SalidaBienesPanel'));
const TransferenciasPanel = React.lazy(() => import('./components/TransferenciasPanel'));


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

// Componente para pestañas desplegables (Dropdowns) en la barra superior
function NavDropdown({ label, icon: Icon, active, isOpen, onToggle, items }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
          active || isOpen
            ? 'bg-white text-[#00509d] shadow-md shadow-black/10 font-extrabold ring-1 ring-white/30'
            : 'text-white/90 hover:text-white hover:bg-white/15'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn">
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => item.onClick()}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                item.active
                  ? 'bg-brand-50 text-[#00509d] font-extrabold'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs ${item.active ? 'bg-[#000080] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [activeTab, setActiveTab] = useState('INVENTARIO'); // INVENTARIO | OBRAS | REGISTRO | DOCUMENTOS | CELULARES | VEHICULOS | SOAT | SINCRONIZAR
  const [filters, setFilters] = useState({ search: '', estado_activo: '', id_sucursal: '', n_doc: '', categoria: '', subcategoria: '', anio: '', mes: '' });
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

  const handleExportActivosPDF = async (data, title) => {
    const headers = [["Código", "Documento\nCta Contable", "Ubicación\nFinanciado", "Denominación del Activo\nCategoría del Activo", "Características\nEspecificaciones", "Estado", "Valor Libros", "Valor Neto", "Responsable"]];
    
    const getUbicacionFinanciado = (v) => {
      const sucursal = (v.sucursal || '—').trim();
      const localidad = v.localidad ? v.localidad.trim() : '';

      const codPat = String(v.cod_patrimonial || '').trim();
      const ctaContable = String(v.cuenta_contable || '').trim();
      const docTipo = (v.documento_tipo || '').toUpperCase().trim();
      const fuenteStr = (
        v.fuente || 
        v.fuente_origen || 
        v.documento_concepto || 
        v.concepto || 
        v.observaciones || 
        v.n_doc || 
        ''
      ).trim().toUpperCase();

      let financiado = '';
      if (codPat.startsWith('339') || ctaContable.startsWith('339') || docTipo === 'OBRA') {
        financiado = 'Obra en curso';
      } else if (fuenteStr.includes('TRANSF') || fuenteStr.includes('TRANSFERENCIA')) {
        financiado = 'Transferencia';
      } else if (fuenteStr.includes('OBRA') || fuenteStr.includes('LIQ')) {
        financiado = 'Liq. Obra';
      } else if (fuenteStr.includes('DONAC')) {
        financiado = 'Donación';
      } else if (docTipo === 'COMPRA') {
        financiado = '';
      } else if (docTipo === 'INCORPORACION') {
        financiado = (v.fuente || v.fuente_origen || '').trim();
      }

      const lines = [sucursal];
      if (localidad && localidad.toUpperCase() !== sucursal.toUpperCase()) {
        lines.push(localidad);
      }
      if (financiado) {
        lines.push(financiado);
      }

      return lines.join('\n');
    };

    const tableRows = data.map(item => {
      const docCode = item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—';
      const docObj = {
        content: `${docCode}\n${item.cuenta_contable || '—'}`,
        doc: docCode,
        cta: item.cuenta_contable || '—'
      };

      const getFinanciadoText = (v) => {
        const codPat = String(v.cod_patrimonial || '').trim();
        const ctaContable = String(v.cuenta_contable || '').trim();
        const docTipo = (v.documento_tipo || '').toUpperCase().trim();
        const fuenteStr = (
          v.fuente || 
          v.fuente_origen || 
          v.documento_concepto || 
          v.concepto || 
          v.observaciones || 
          v.n_doc || 
          ''
        ).trim().toUpperCase();

        if (codPat.startsWith('339') || ctaContable.startsWith('339') || docTipo === 'OBRA') {
          return 'Obra en curso';
        } else if (fuenteStr.includes('TRANSF') || fuenteStr.includes('TRANSFERENCIA')) {
          return 'Transferencia';
        } else if (fuenteStr.includes('OBRA') || fuenteStr.includes('LIQ')) {
          return 'Liq. Obra';
        } else if (fuenteStr.includes('DONAC')) {
          return 'Donación';
        } else if (docTipo === 'COMPRA') {
          return '';
        } else if (docTipo === 'INCORPORACION') {
          return (v.fuente || v.fuente_origen || '').trim();
        }
        return '';
      };

      const ubiObj = {
        content: getUbicacionFinanciado(item),
        sucursal: (item.sucursal || '—').trim(),
        localidad: (item.localidad && item.localidad.trim().toUpperCase() !== (item.sucursal || '').trim().toUpperCase()) ? item.localidad.trim() : '',
        financiado: getFinanciadoText(item)
      };

      const denomObj = {
        content: `${(item.denominacion || '').toUpperCase()}\n${(item.subcategoria || item.categoria || '—').toUpperCase()}`,
        denom: item.denominacion || '',
        cat: item.subcategoria || item.categoria || '—'
      };

      const isVehiculo = (item.categoria && item.categoria.toLowerCase().includes('vehiculo')) ||
                         (item.subcategoria && item.subcategoria.toLowerCase().includes('vehiculo')) ||
                         (item.cod_categoria && String(item.cod_categoria).startsWith('4')) ||
                         (item.placa && item.placa !== '');

      let especsFormatted = '';
      if (isVehiculo) {
        const catVeh = item.categoria_vehiculo || item.subcategoria || item.categoria || 'VEHÍCULO';
        const anioVeh = item.vehiculo_anio || item.anio_fabricacion || item.anio_modelo || '—';
        especsFormatted = `Color: ${item.color || '—'}\nMarca: ${item.marca || '—'}\nModelo: ${item.modelo || '—'}\nPlaca: ${item.placa || '—'}\nMotor: ${item.nro_motor || '—'}\nChasis: ${item.nro_chasis || '—'}\nCategoría: ${catVeh}\nAño Modelo: ${anioVeh}`;
      } else {
        const especStr = (item.especificaciones || item.especificacion || item.caracteristicas_accesorios || item.observaciones || '').trim();
        const lines = [
          `Color: ${item.color || '—'}`,
          `Marca: ${item.marca || '—'}`,
          `Modelo: ${item.modelo || '—'}`,
          `Serie: ${item.numero_serie || '—'}`
        ];
        if (especStr) lines.push(`Especificaciones: ${especStr}`);
        especsFormatted = lines.join('\n');
      }

      const respObj = {
        content: `${item.responsable || 'Sin asignar'}${item.puesto ? `\n${item.puesto}` : ''}`,
        resp: item.responsable || 'Sin asignar',
        puesto: item.puesto || ''
      };

      return [
        item.cod_patrimonial,
        docObj,
        ubiObj,
        denomObj,
        especsFormatted,
        item.estado_activo,
        new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(item.valor_en_libros) || 0),
        new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(item.valor_neto) || 0),
        respObj
      ];
    });

    const columnStyles = {
      0: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 44 },
      4: { cellWidth: 50 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 32 }
    };

    await generateStandardPDF({
      title: "CONTROL PATRIMONIAL",
      subtitle: title,
      headers: headers,
      data: tableRows,
      columnStyles: columnStyles,
      filename: `${title}_${new Date().toISOString().split('T')[0]}.pdf`,
      orientation: "landscape"
    });
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

  // Filtro del buscador global, categoría, subcategoría y documento en memoria local
  useEffect(() => {
    let result = activos;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((act) => {
        const matchCod = act.cod_patrimonial?.toLowerCase().includes(searchLower);
        const matchDenom = act.denominacion?.toLowerCase().includes(searchLower);
        const matchMarca = act.marca?.toLowerCase().includes(searchLower);
        const matchModelo = act.modelo?.toLowerCase().includes(searchLower);
        const matchResp = act.responsable?.toLowerCase().includes(searchLower);
        const matchPuesto = act.puesto?.toLowerCase().includes(searchLower);
        const matchActa = act.n_acta?.toString().toLowerCase().includes(searchLower);
        const matchSubcat = act.subcategoria?.toLowerCase().includes(searchLower);
        const matchCat = act.categoria?.toLowerCase().includes(searchLower);
        return matchCod || matchDenom || matchMarca || matchModelo || matchResp || matchPuesto || matchActa || matchSubcat || matchCat;
      });
    }

    if (filters.categoria) {
      result = result.filter((act) => {
        const cat = act.categoria || (act.cod_categoria ? `Categoría ${act.cod_categoria}` : null);
        return cat === filters.categoria;
      });
    }

    if (filters.subcategoria) {
      result = result.filter((act) => act.subcategoria === filters.subcategoria);
    }

    if (filters.n_doc) {
      result = result.filter((act) => act.n_doc === filters.n_doc);
    }

    if (filters.cuenta_contable) {
      result = result.filter((act) => act.cuenta_contable === filters.cuenta_contable);
    }

    const parseYearMonth = (dateVal) => {
      if (!dateVal || dateVal === '—') return { year: null, month: null };
      const dateStr = String(dateVal).trim();
      if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return { year: null, month: null };
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts.length >= 2) {
          if (parts[0].length === 4) return { year: parts[0], month: parseInt(parts[1], 10).toString() };
          if (parts[2]?.length === 4) return { year: parts[2], month: parseInt(parts[1], 10).toString() };
        }
      } else if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length >= 3) {
          if (parts[2].length === 4) return { year: parts[2], month: parseInt(parts[1], 10).toString() };
          if (parts[0].length === 4) return { year: parts[0], month: parseInt(parts[1], 10).toString() };
        }
      }
      return { year: null, month: null };
    };

    if (filters.anio) {
      result = result.filter((act) => {
        const dateStr = act.fecha_alta_factura || act.fecha_registro_contable || act.fecha_asignacion || act.fecha_ingreso || act.fecha_alta || act.created_at;
        const { year } = parseYearMonth(dateStr);
        return year === filters.anio;
      });
    }

    if (filters.mes) {
      result = result.filter((act) => {
        const dateStr = act.fecha_alta_factura || act.fecha_registro_contable || act.fecha_asignacion || act.fecha_ingreso || act.fecha_alta || act.created_at;
        const { month } = parseYearMonth(dateStr);
        return month === filters.mes;
      });
    }

    // Dividir los bienes muebles en Activos Fijos generales y Obras en Curso (inician con 339)
    const assetsOnly = result.filter((act) => !act.cod_patrimonial?.startsWith('339'));
    const obrasOnly = result.filter((act) => act.cod_patrimonial?.startsWith('339'));

    setFilteredActivos(assetsOnly);
    setFilteredObras(obrasOnly);
  }, [filters.search, filters.categoria, filters.subcategoria, filters.n_doc, filters.cuenta_contable, filters.anio, filters.mes, activos]);

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val || 0);
  };

  const totalValorLibrosActivos = useMemo(() => {
    return filteredActivos.reduce((sum, a) => sum + (Number(a.valor_en_libros) || 0), 0);
  }, [filteredActivos]);

  const totalValorNetoActivos = useMemo(() => {
    return filteredActivos.reduce((sum, a) => sum + (Number(a.valor_neto) || 0), 0);
  }, [filteredActivos]);

  const totalValorLibrosObras = useMemo(() => {
    return filteredObras.reduce((sum, a) => sum + (Number(a.valor_en_libros) || 0), 0);
  }, [filteredObras]);

  const totalValorNetoObras = useMemo(() => {
    return filteredObras.reduce((sum, a) => sum + (Number(a.valor_neto) || 0), 0);
  }, [filteredObras]);

  const [openDropdown, setOpenDropdown] = useState(null);
  const navRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col">
      {/* Barra de Navegación Superior */}
      <header className="app-topbar shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fila Principal: Logo + Título + Menús Desplegables + Logout */}
          <div className="flex items-center justify-between py-2.5 gap-4">
            <div className="flex items-center space-x-3 shrink-0">
              <img 
                src="/logo.jpg" 
                alt="Logo EPS Selva Central" 
                className="w-10 h-10 object-contain rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-white/20" 
              />
              <div>
                <span className="bg-white/20 text-white text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  EPS SELVA CENTRAL
                </span>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight mt-0.5">Control Patrimonial</h1>
              </div>
            </div>

            {/* Menús Desplegables Organizados (Dropdown Menus) */}
            <div ref={navRef} className="hidden lg:flex items-center gap-2 relative">
              <NavDropdown
                label="Operaciones y Registro"
                icon={FolderOpen}
                isOpen={openDropdown === 'OPERACIONES'}
                onToggle={() => setOpenDropdown(openDropdown === 'OPERACIONES' ? null : 'OPERACIONES')}
                active={['DOCUMENTOS', 'REGISTRO', 'SALIDAS_REGISTRO', 'TRANSFERENCIAS_REGISTRO', 'TERCEROS_REGISTRO'].includes(activeTab)}
                items={[
                  { label: 'Documentos', icon: <FolderOpen className="w-3.5 h-3.5" />, active: activeTab === 'DOCUMENTOS', onClick: () => { handleTabChange('DOCUMENTOS'); setOpenDropdown(null); } },
                  { label: 'Registrar Activo', icon: <PlusCircle className="w-3.5 h-3.5" />, active: activeTab === 'REGISTRO', onClick: () => { handleTabChange('REGISTRO'); setOpenDropdown(null); } },
                  { label: 'Salida de Bienes (Registro)', icon: <LogOut className="w-3.5 h-3.5 rotate-180" />, active: activeTab === 'SALIDAS_REGISTRO', onClick: () => { handleTabChange('SALIDAS_REGISTRO'); setOpenDropdown(null); } },
                  { label: 'Reasignación (Registro)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, active: activeTab === 'TRANSFERENCIAS_REGISTRO', onClick: () => { handleTabChange('TRANSFERENCIAS_REGISTRO'); setOpenDropdown(null); } },
                  { label: 'Bienes de Terceros (Registro)', icon: <Users className="w-3.5 h-3.5" />, active: activeTab === 'TERCEROS_REGISTRO', onClick: () => { handleTabChange('TERCEROS_REGISTRO'); setOpenDropdown(null); } },
                ]}
              />

              <NavDropdown
                label="Tablas y Consultas"
                icon={ClipboardList}
                isOpen={openDropdown === 'CONSULTAS'}
                onToggle={() => setOpenDropdown(openDropdown === 'CONSULTAS' ? null : 'CONSULTAS')}
                active={['INVENTARIO', 'OBRAS', 'SOAT', 'CELULARES', 'INVENTARIO_FISICO', 'TERCEROS_TABLA', 'SALIDAS_TABLA', 'TRANSFERENCIAS_TABLA'].includes(activeTab)}
                items={[
                  { label: 'Activos Fijos', icon: <ClipboardList className="w-3.5 h-3.5" />, active: activeTab === 'INVENTARIO', onClick: () => { handleTabChange('INVENTARIO'); setOpenDropdown(null); } },
                  { label: 'Obras en Curso', icon: <Hammer className="w-3.5 h-3.5" />, active: activeTab === 'OBRAS', onClick: () => { handleTabChange('OBRAS'); setOpenDropdown(null); } },
                  { label: 'SOAT y Rev. Técnica', icon: <ShieldCheck className="w-3.5 h-3.5" />, active: activeTab === 'SOAT', onClick: () => { handleTabChange('SOAT'); setOpenDropdown(null); } },
                  { label: 'Equipos Celulares', icon: <Smartphone className="w-3.5 h-3.5" />, active: activeTab === 'CELULARES', onClick: () => { handleTabChange('CELULARES'); setOpenDropdown(null); } },
                  { label: 'Sobrantes/Faltantes', icon: <ClipboardCheck className="w-3.5 h-3.5" />, active: activeTab === 'INVENTARIO_FISICO', onClick: () => { handleTabChange('INVENTARIO_FISICO'); setOpenDropdown(null); } },
                  { label: 'Bienes de Terceros (Tabla)', icon: <Users className="w-3.5 h-3.5" />, active: activeTab === 'TERCEROS_TABLA', onClick: () => { handleTabChange('TERCEROS_TABLA'); setOpenDropdown(null); } },
                  { label: 'Salida de Bienes (Historial)', icon: <LogOut className="w-3.5 h-3.5 rotate-180" />, active: activeTab === 'SALIDAS_TABLA', onClick: () => { handleTabChange('SALIDAS_TABLA'); setOpenDropdown(null); } },
                  { label: 'Reasignaciones (Historial)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, active: activeTab === 'TRANSFERENCIAS_TABLA', onClick: () => { handleTabChange('TRANSFERENCIAS_TABLA'); setOpenDropdown(null); } },
                ]}
              />

              <NavDropdown
                label="Reportes y Procesos"
                icon={Coins}
                isOpen={openDropdown === 'REPORTES'}
                onToggle={() => setOpenDropdown(openDropdown === 'REPORTES' ? null : 'REPORTES')}
                active={['CONTABLE', 'DASHBOARD'].includes(activeTab)}
                items={[
                  { label: 'Reporte Contable Agrupado', icon: <Coins className="w-3.5 h-3.5" />, active: activeTab === 'CONTABLE', onClick: () => { handleTabChange('CONTABLE'); setOpenDropdown(null); } },
                  { label: 'Dashboard Administrativo', icon: <LayoutDashboard className="w-3.5 h-3.5" />, active: activeTab === 'DASHBOARD', onClick: () => { handleTabChange('DASHBOARD'); setOpenDropdown(null); } },
                ]}
              />

              <NavDropdown
                label="Configuración"
                icon={RefreshCw}
                isOpen={openDropdown === 'CONFIG'}
                onToggle={() => setOpenDropdown(openDropdown === 'CONFIG' ? null : 'CONFIG')}
                active={['SINCRONIZAR', 'ADMIN'].includes(activeTab)}
                items={[
                  { label: 'Sincronizar Dashboard Público', icon: <RefreshCw className="w-3.5 h-3.5" />, active: activeTab === 'SINCRONIZAR', onClick: () => { handleTabChange('SINCRONIZAR'); setOpenDropdown(null); } },
                  { label: 'Abrir Dashboard Público ↗', icon: <ExternalLink className="w-3.5 h-3.5" />, onClick: () => { window.open(getDashboardUrl(), '_blank'); setOpenDropdown(null); } },
                  { label: 'Administración del Sistema', icon: <Lock className="w-3.5 h-3.5" />, active: activeTab === 'ADMIN', onClick: () => { handleTabChange('ADMIN'); setOpenDropdown(null); } }
                ]}
              />
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 text-xs font-bold border border-white/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>
          </div>

          {/* Selector de Pestañas Rápido Estilo public_dashboard (Single row pill switcher) */}
          <div className="py-2 overflow-x-auto border-t border-white/10 flex items-center gap-1.5 no-scrollbar">
            <button
              onClick={() => handleTabChange('DOCUMENTOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'DOCUMENTOS' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📄 Documentos
            </button>
            <button
              onClick={() => handleTabChange('INVENTARIO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'INVENTARIO' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              💼 Activos Fijos
            </button>
            <button
              onClick={() => handleTabChange('OBRAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'OBRAS' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              🚧 Obras en Curso
            </button>
            <button
              onClick={() => handleTabChange('SOAT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SOAT' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              🛡️ SOAT
            </button>
            <button
              onClick={() => handleTabChange('CELULARES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'CELULARES' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📱 Celulares
            </button>
            <button
              onClick={() => handleTabChange('INVENTARIO_FISICO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'INVENTARIO_FISICO' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              🔍 Sobrantes/Faltantes
            </button>
            <button
              onClick={() => handleTabChange('TERCEROS_TABLA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                ['BIENES_TERCEROS', 'TERCEROS_TABLA', 'TERCEROS_REGISTRO'].includes(activeTab) ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              🤝 Bienes de Terceros
            </button>
            <button
              onClick={() => handleTabChange('REGISTRO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'REGISTRO' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              ➕ Registrar Activo
            </button>
            <button
              onClick={() => handleTabChange('CONTABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'CONTABLE' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📊 Rep. Contable
            </button>
            <button
              onClick={() => handleTabChange('SINCRONIZAR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SINCRONIZAR' ? 'bg-white text-[#00509d] shadow-sm font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              ☁️ Sincronizar
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-4 min-w-0 ${
        ['DOCUMENTOS', 'INVENTARIO', 'OBRAS', 'CONTABLE', 'VEHICULOS', 'SOAT', 'CELULARES', 'INVENTARIO_FISICO', 'BIENES_TERCEROS', 'TERCEROS_REGISTRO', 'TERCEROS_TABLA', 'TRANSFERENCIAS', 'TRANSFERENCIAS_REGISTRO', 'TRANSFERENCIAS_TABLA', 'SALIDAS', 'SALIDAS_REGISTRO', 'SALIDAS_TABLA', 'DASHBOARD', 'ADMIN'].includes(activeTab) ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
      }`}>
        <React.Suspense fallback={
          <div className="flex items-center justify-center p-12 text-slate-500 font-semibold space-x-2 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
            <span>Cargando módulo...</span>
          </div>
        }>
          {activeTab === 'INVENTARIO' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-fadeIn w-full max-w-full overflow-hidden">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between shrink-0 mb-1">
              <div className="module-heading">
                <p className="module-kicker">Inventario operativo</p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="inline-flex items-center justify-center p-1.5 rounded-xl bg-brand-50 text-[#00509d] border border-brand-100/60 shadow-xs">
                    <Package className="w-5 h-5" />
                  </span>
                  <span>ACTIVOS FIJOS REGISTRADOS</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Listado y control patrimonial de bienes muebles.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="metric-pill">
                  Total encontrados: <strong>{filteredActivos.length}</strong>
                </div>
                <div className="metric-pill bg-blue-50/90 text-blue-800 border border-blue-200/80">
                  Valor Libros: <strong>{formatMoney(totalValorLibrosActivos)}</strong>
                </div>
                <div className="metric-pill bg-emerald-50/90 text-emerald-800 border border-emerald-200/80">
                  Valor Neto: <strong>{formatMoney(totalValorNetoActivos)}</strong>
                </div>
                <button
                  onClick={() => handleExportActivosExcel(filteredActivos, 'Inventario')}
                  className="flex items-center justify-center gap-1.5 bg-[#00b074] hover:bg-[#009b66] text-white font-extrabold py-1.5 px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => handleExportActivosPDF(filteredActivos, 'Inventario')}
                  className="flex items-center justify-center gap-1.5 bg-[#ff3b5c] hover:bg-[#e02e4d] text-white font-extrabold py-1.5 px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileText className="w-3.5 h-3.5 text-white" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
            
            <div className="shrink-0">
              <Filters filters={filters} onChange={setFilters} activeTab={activeTab} activos={activos} />
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
          <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-fadeIn w-full max-w-full overflow-hidden">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between shrink-0 mb-1">
              <div className="module-heading">
                <p className="module-kicker">Obras en ejecución y proyectos</p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="inline-flex items-center justify-center p-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/60 shadow-xs">
                    <HardHat className="w-5 h-5" />
                  </span>
                  <span>OBRAS EN CURSO (CUENTA 339)</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Listado de bienes patrimoniales asociados a proyectos y obras en curso (PMO).</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="metric-pill">
                  Total encontrados: <strong>{filteredObras.length}</strong>
                </div>
                <div className="metric-pill bg-amber-50/90 text-amber-800 border border-amber-200/80">
                  Valor Libros: <strong>{formatMoney(totalValorLibrosObras)}</strong>
                </div>
                <div className="metric-pill bg-emerald-50/90 text-emerald-800 border border-emerald-200/80">
                  Valor Neto: <strong>{formatMoney(totalValorNetoObras)}</strong>
                </div>
                <button
                  onClick={() => handleExportActivosExcel(filteredObras, 'Obras_En_Curso')}
                  className="flex items-center justify-center gap-1.5 bg-[#00b074] hover:bg-[#009b66] text-white font-extrabold py-1.5 px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => handleExportActivosPDF(filteredObras, 'Obras_En_Curso')}
                  className="flex items-center justify-center gap-1.5 bg-[#ff3b5c] hover:bg-[#e02e4d] text-white font-extrabold py-1.5 px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none h-8"
                >
                  <FileText className="w-3.5 h-3.5 text-white" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
            
            <div className="shrink-0">
              <Filters filters={filters} onChange={setFilters} activeTab={activeTab} activos={activos} />
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
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
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

        {(activeTab === 'BIENES_TERCEROS' || activeTab === 'TERCEROS_TABLA') && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <BienesTercerosPanel initialSubTab="CONSULTAS" />
          </div>
        )}

        {activeTab === 'TERCEROS_REGISTRO' && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <BienesTercerosPanel initialSubTab="REGISTRO" />
          </div>
        )}

        {(activeTab === 'DASHBOARD' || activeTab === 'ADMIN') && (
          <div className="space-y-4 animate-fadeIn pt-2 flex flex-col flex-1 min-h-0">
            <AdminDashboard />
          </div>
        )}

        {(activeTab === 'SALIDAS' || activeTab === 'SALIDAS_REGISTRO') && (
          <SalidaBienesPanel initialSubTab="MODULE" />
        )}
        {activeTab === 'SALIDAS_TABLA' && (
          <SalidaBienesPanel initialSubTab="TABLE" />
        )}

        {(activeTab === 'TRANSFERENCIAS' || activeTab === 'TRANSFERENCIAS_REGISTRO') && (
          <TransferenciasPanel initialSubTab="REGISTRO" />
        )}
        {activeTab === 'TRANSFERENCIAS_TABLA' && (
          <TransferenciasPanel initialSubTab="CONSULTAS" />
        )}
        </React.Suspense>
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
