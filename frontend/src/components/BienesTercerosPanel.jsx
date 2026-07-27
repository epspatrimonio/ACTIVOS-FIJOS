import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Search, Trash2, Edit3, X, AlertCircle, CheckCircle2, ChevronDown,
  FileSpreadsheet, FileText, PlusCircle, ClipboardList, Calendar, Check,
  UserCheck, Tag
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Modal from './Modal';
import ExcelHeaderFilter from './ExcelHeaderFilter';
import { 
  fetchBienesTerceros, saveBienTercero, deleteBienTercero, fetchGenerarCodigoTerceroControl,
  fetchPersonal, fetchSucursales, fetchLocalidades, updateFechaSalidaTercero
} from '../utils/api';

const getTodayDate = () => new Date().toISOString().split('T')[0];

const INITIAL_FORM_STATE = {
  cod_patrimonial: '',
  tipo: 'TERCERO', // TERCERO | CONTROL
  denominacion: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  caracteristicas_accesorios: '',
  ownerType: 'PERSONAL', // PERSONAL (Personal EPS) | MANUAL (Personal Externo)
  cod_personal: '',
  propietario_manual: '',
  observaciones: '',
  id_sucursal: '',
  localidad: '',
  fecha_ingreso: getTodayDate(),
  fecha_salida: ''
};

const extractString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.target?.value !== undefined) {
    const res = String(val.target.value).trim();
    return res || null;
  }
  if (typeof val === 'object' && val.value !== undefined) {
    const res = String(val.value).trim();
    return res || null;
  }
  if (typeof val === 'string') {
    const res = val.trim();
    return res || null;
  }
  return String(val).trim() || null;
};

export default function BienesTercerosPanel({ initialSubTab = 'REGISTRO' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'REGISTRO' | 'CONSULTAS'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('¡Operación realizada correctamente!');

  // Datos auxiliares para el formulario
  const [personal, setPersonal] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  
  // Pestañas y búsqueda en la tabla
  const [currentTab, setCurrentTab] = useState('ALL'); // ALL | TERCERO | CONTROL
  const [searchTerm, setSearchTerm] = useState('');

  const [colFilters, setColFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Formulario principal (Registro y Gestión)
  const [regForm, setRegForm] = useState(INITIAL_FORM_STATE);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);

  // Control del modal de edición en la vista de tablas
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState(INITIAL_FORM_STATE);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Edición rápida de fecha de salida por ítem
  const [editingFechaSalida, setEditingFechaSalida] = useState({}); // { [cod]: dateString }
  const [savingFechaSalida, setSavingFechaSalida] = useState({});

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Cargar datos principales
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBienesTerceros();
      const sorted = data.sort((a, b) => (b.created_at || b.cod_patrimonial || '').localeCompare(a.created_at || a.cod_patrimonial || ''));
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
      console.error('Error al cargar datos auxiliares:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadAuxData();
    generarCodigoParaRegistro('TERCERO');
  }, []);

  // Generar código autogenerado para el formulario principal de registro
  const generarCodigoParaRegistro = async (tipoVal = 'TERCERO') => {
    try {
      const res = await fetchGenerarCodigoTerceroControl(tipoVal);
      setRegForm(prev => ({
        ...prev,
        tipo: tipoVal,
        cod_patrimonial: res.codigo
      }));
    } catch (err) {
      console.error('Error al generar código:', err);
    }
  };

  // Reset filter configuration when data reloads
  const itemsCount = items.length;
  useEffect(() => {
    setColFilters({});
    setSortConfig({ key: null, direction: null });
  }, [itemsCount]);

  const handleFilterChange = (columnKey, values) => {
    setColFilters(prev => ({ ...prev, [columnKey]: values }));
  };

  const handleSortChange = (columnKey, direction) => {
    setSortConfig({ key: columnKey, direction });
  };

  const getColValue = (item, key) => {
    switch (key) {
      case 'cod_patrimonial': return item.cod_patrimonial || '';
      case 'tipo': return item.tipo === 'TERCERO' ? 'Bienes de Terceros' : 'Control Interno';
      case 'ubicacion': return `${item.sucursal || ''} / ${item.localidad || ''}`;
      case 'denominacion': return item.denominacion || '';
      case 'caracteristicas': return `M:${item.marca || ''} Mod:${item.modelo || ''} S:${item.numero_serie || ''} C:${item.color || ''}`;
      case 'responsable': return item.responsable || item.propietario_manual || 'Sin asignar';
      case 'fecha_ingreso': return item.fecha_ingreso || (item.created_at ? String(item.created_at).split('T')[0] : '');
      case 'fecha_salida': return item.fecha_salida || '';
      case 'observaciones': return item.observaciones || '';
      default: return '';
    }
  };

  // Opciones de personal responsable: Solo el nombre completo, sin código
  const personalOptions = useMemo(() => {
    return personal.map(p => ({
      value: p.value,
      label: p.label
    }));
  }, [personal]);

  // Generar PDF Acta de Ingreso de Tercero
  const generarActaPDF = async (itemData) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no está disponible.');
      return;
    }

    const loadImage = (url) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });

    const logoImg = await loadImage('/logo_eps2.png');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const marginX = 14;
    let posY = 10;

    // Encabezado con Logo Mascota y Datos de Empresa
    if (logoImg) {
      doc.addImage(logoImg, 'JPEG', marginX, posY, 18, 21);
    }
    const textX = marginX + 21;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, posY + 5);

    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(0, 176, 240);
    doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, posY + 9.5);

    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105);
    doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, posY + 13.5);

    // Fecha y Código en la esquina superior derecha
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
    const fechaIng = itemData.fecha_ingreso ? itemData.fecha_ingreso.split('-').reverse().join('/') : new Date().toLocaleDateString('es-PE');
    doc.text(`FECHA INGRESO: ${fechaIng}`, 196, posY + 5, { align: 'right' });

    if (itemData.cod_patrimonial) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0, 176, 240);
      doc.text(`CÓDIGO: ${itemData.cod_patrimonial}`, 196, posY + 10.5, { align: 'right' });
    }

    // Línea separadora
    doc.setLineWidth(0.4); doc.setDrawColor(226, 232, 240);
    doc.line(14, posY + 22, 196, posY + 22);

    // Título Principal Centrado
    posY += 30;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
    doc.text("ACTA DE REGISTRO E INGRESO DE BIENES DE TERCEROS", 105, posY, { align: 'center' });

    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(0, 176, 240);
    doc.text("SISTEMA DE CONTROL PATRIMONIAL", 105, posY + 5, { align: 'center' });

    // Cuadro Informativo
    posY += 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, posY, 182, 30, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, posY, 182, 30, 'D');

    const respNombre = itemData.responsable || itemData.propietario_manual || 'Sin asignar';
    const sucursalNombre = itemData.sucursal || (sucursales.find(s => String(s.value) === String(itemData.id_sucursal))?.label) || 'Sede Central';
    const fechaSalidaVal = itemData.fecha_salida ? itemData.fecha_salida.split('-').reverse().join('/') : 'POSTERIOR / PENDIENTE';

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59); doc.text("PROPIETARIO DEL BIEN:", marginX + 4, posY + 7);
    doc.setFont("helvetica", "normal"); doc.text(respNombre.toUpperCase(), marginX + 56, posY + 7);

    doc.setFont("helvetica", "bold"); doc.text("SUCURSAL / DEPENDENCIA:", marginX + 4, posY + 13);
    doc.setFont("helvetica", "normal"); doc.text(sucursalNombre.toUpperCase(), marginX + 56, posY + 13);

    doc.setFont("helvetica", "bold"); doc.text("FECHA ESTIMADA DE SALIDA:", marginX + 4, posY + 19);
    doc.setFont("helvetica", "normal"); doc.text(fechaSalidaVal, marginX + 56, posY + 19);

    doc.setFont("helvetica", "bold"); doc.text("TIPO DE PROPIETARIO:", marginX + 4, posY + 25);
    doc.setFont("helvetica", "normal"); doc.text(itemData.cod_personal ? 'PERSONAL EPS SELVA CENTRAL' : 'PERSONAL EXTERNO (ESCRITURA MANUAL)', marginX + 56, posY + 25);

    // Tabla de Especificaciones del Bien
    posY += 36;
    doc.autoTable({
      startY: posY,
      head: [['CARACTERÍSTICA / ESPECIFICACIÓN', 'DETALLE REGISTRADO']],
      body: [
        ['Denominación del Bien', itemData.denominacion || '—'],
        ['Color', itemData.color || '—'],
        ['Marca', itemData.marca || 'S/M (Sin Marca)'],
        ['Modelo', itemData.modelo || 'S/M (Sin Modelo)'],
        ['Número de Serie', itemData.numero_serie || 'S/S (Sin Serie)'],
        ['Especificaciones / Accesorios', itemData.caracteristicas_accesorios || '—'],
        ['Observaciones de Ingreso', itemData.observaciones || '—']
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 3.5, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [241, 245, 249] }, 1: { cellWidth: 127 } }
    });

    // Bloque de Firmas Punteadas Centradas
    const finalY = (doc.lastAutoTable.finalY || posY + 70) + 32;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);

    // Firma Izquierda (Propietario del Bien) - Centrado en X = 55
    doc.text("--------------------------------------------------", 55, finalY, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text("PROPIETARIO DEL BIEN", 55, finalY + 5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(respNombre.toUpperCase(), 55, finalY + 9.5, { align: 'center' });

    // Firma Derecha (Control Patrimonial) - Centrado en X = 155
    doc.text("--------------------------------------------------", 155, finalY, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text("CONTROL PATRIMONIAL", 155, finalY + 5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text("E.P.S. SELVA CENTRAL S.A.", 155, finalY + 9.5, { align: 'center' });

    doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(225, 29, 72);
    doc.text("Nota: El presente documento valida el ingreso del bien a las instalaciones de EPS Selva Central S.A.", 14, finalY + 22);

    doc.save(`Acta_Tercero_${itemData.cod_patrimonial || 'REG'}_${(itemData.denominacion || 'BIEN').replace(/\s+/g, '_')}.pdf`);
  };

  // Enviar Formulario Principal (Pestaña Registro y Gestión)
  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.cod_patrimonial || !regForm.denominacion) {
      setRegError('El código patrimonial y la denominación son obligatorios.');
      return;
    }

    const codPersonalClean = regForm.ownerType === 'PERSONAL' ? extractString(regForm.cod_personal) : null;
    const propietarioManualClean = regForm.ownerType === 'MANUAL' ? extractString(regForm.propietario_manual) : null;

    if (regForm.ownerType === 'PERSONAL' && !codPersonalClean) {
      setRegError('Debe seleccionar el nombre de un personal de la empresa de la lista.');
      return;
    }
    if (regForm.ownerType === 'MANUAL' && !propietarioManualClean) {
      setRegError('Debe escribir el nombre del propietario externo.');
      return;
    }

    setRegLoading(true);
    setRegError(null);

    const payload = {
      cod_patrimonial: extractString(regForm.cod_patrimonial),
      tipo: regForm.tipo,
      denominacion: extractString(regForm.denominacion),
      marca: extractString(regForm.marca),
      modelo: extractString(regForm.modelo),
      numero_serie: extractString(regForm.numero_serie),
      color: extractString(regForm.color),
      caracteristicas_accesorios: extractString(regForm.caracteristicas_accesorios),
      cod_personal: codPersonalClean,
      propietario_manual: propietarioManualClean,
      id_sucursal: regForm.id_sucursal ? Number(regForm.id_sucursal) : null,
      localidad: regForm.localidad,
      fecha_ingreso: regForm.fecha_ingreso || null,
      fecha_salida: regForm.fecha_salida || null,
      observaciones: extractString(regForm.observaciones)
    };

    try {
      const respItem = await saveBienTercero(regForm.cod_patrimonial, payload, false);
      setSuccessMessage(`¡Bien de Tercero '${regForm.cod_patrimonial}' registrado exitosamente!`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Generar Acta PDF automáticamente
      const personalObj = personal.find(p => String(p.value) === String(codPersonalClean));
      await generarActaPDF({
        ...payload,
        responsable: regForm.ownerType === 'PERSONAL' 
          ? (personalObj?.label || codPersonalClean)
          : propietarioManualClean,
        sucursal: sucursales.find(s => String(s.value) === String(regForm.id_sucursal))?.label
      });

      // Recargar lista y limpiar formulario para el siguiente registro
      await loadData();
      const nuevoCodigo = await fetchGenerarCodigoTerceroControl(regForm.tipo);
      setRegForm({
        ...INITIAL_FORM_STATE,
        tipo: regForm.tipo,
        cod_patrimonial: nuevoCodigo.codigo,
        id_sucursal: regForm.id_sucursal,
        localidad: regForm.localidad
      });
    } catch (err) {
      setRegError(err.message || 'Error al registrar bien de terceros.');
    } finally {
      setRegLoading(false);
    }
  };

  // Guardado rápido de fecha de salida en la vista tabular
  const handleSaveFechaSalida = async (item, newFecha) => {
    setSavingFechaSalida(prev => ({ ...prev, [item.cod_patrimonial]: true }));
    try {
      await updateFechaSalidaTercero(item.cod_patrimonial, newFecha);
      setItems(prev => prev.map(i => i.cod_patrimonial === item.cod_patrimonial ? { ...i, fecha_salida: newFecha } : i));
      setEditingFechaSalida(prev => ({ ...prev, [item.cod_patrimonial]: false }));
    } catch (err) {
      alert(`Error al actualizar la fecha de salida: ${err.message}`);
    } finally {
      setSavingFechaSalida(prev => ({ ...prev, [item.cod_patrimonial]: false }));
    }
  };

  // Exportar Excel de la tabla
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

    const sheetData = filteredAndSortedItems.map(item => ({
      "Código": item.cod_patrimonial,
      "Tipo": item.tipo === 'TERCERO' ? 'Bienes de Terceros' : 'Control Interno',
      "Denominación": item.denominacion,
      "Marca": item.marca || '—',
      "Modelo": item.modelo || '—',
      "N° Serie": item.numero_serie || '—',
      "Color": item.color || '—',
      "Especificaciones": item.caracteristicas_accesorios || '—',
      "Sucursal": item.sucursal || '—',
      "Localidad": item.localidad || '—',
      "Propietario del Bien": item.responsable || item.propietario_manual || '—',
      "Fecha Ingreso": parseTimestampToJSDate(item.fecha_ingreso),
      "Fecha Salida": parseTimestampToJSDate(item.fecha_salida),
      "Observaciones": item.observaciones || '—'
    }));
    const ws = window.XLSX.utils.json_to_sheet(sheetData, { cellDates: true });

    for (const cellId in ws) {
      if (ws[cellId] && ws[cellId].t === 'd') {
        ws[cellId].z = 'dd/mm/yyyy';
      }
    }

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "BienesTerceros");
    window.XLSX.writeFile(wb, `Reporte_Bienes_Terceros_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar PDF de la lista tabular completa
  const handleExportListPDF = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no está cargada.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(15, 23, 42);
    doc.text("EPS SELVA CENTRAL S.A. - CONTROL PATRIMONIAL", 14, 15);
    doc.setFontSize(11); doc.setTextColor(0, 176, 240);
    doc.text("REPORTE GENERAL DE BIENES DE TERCEROS Y CONTROL INTERNO", 14, 21);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 283, 15, { align: 'right' });

    doc.setLineWidth(0.4); doc.setDrawColor(226, 232, 240); doc.line(14, 25, 283, 25);

    const headers = [["Código", "Tipo", "Denominación", "Marca/Modelo/Serie/Color", "Ubicación", "Propietario del Bien", "F. Ingreso", "F. Salida"]];
    const tableRows = filteredAndSortedItems.map(item => [
      item.cod_patrimonial,
      item.tipo === 'TERCERO' ? 'Tercero' : 'Control',
      item.denominacion,
      `M: ${item.marca || 'S/M'}\nMod: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}\nColor: ${item.color || '—'}`,
      `${item.sucursal || '—'}\n(${item.localidad || '—'})`,
      item.responsable || item.propietario_manual || 'Sin asignar',
      item.fecha_ingreso ? item.fecha_ingreso.split('-').reverse().join('/') : '—',
      item.fecha_salida ? item.fecha_salida.split('-').reverse().join('/') : 'Pendiente'
    ]);

    doc.autoTable({
      startY: 28,
      head: headers,
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 55 },
        3: { cellWidth: 50 },
        4: { cellWidth: 35 },
        5: { cellWidth: 45 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 }
      }
    });
    doc.save(`Historial_Bienes_Terceros_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Filtrado local de items en la tabla
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
      item.color?.toLowerCase().includes(searchLower) ||
      item.responsable?.toLowerCase().includes(searchLower) ||
      item.propietario_manual?.toLowerCase().includes(searchLower) ||
      item.localidad?.toLowerCase().includes(searchLower) ||
      item.sucursal?.toLowerCase().includes(searchLower);
    return matchesTab && matchesSearch;
  });

  const filteredAndSortedItems = useMemo(() => {
    let result = [...filteredItems];
    Object.keys(colFilters).forEach(key => {
      const selected = colFilters[key];
      if (selected && selected.length > 0) {
        result = result.filter(item => {
          const val = String(getColValue(item, key)).trim();
          return selected.includes(val);
        });
      }
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = getColValue(a, sortConfig.key);
        const valB = getColValue(b, sortConfig.key);
        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [filteredItems, colFilters, sortConfig]);

  // Métricas
  const totalTerceros = items.filter(i => i.tipo === 'TERCERO').length;
  const totalControles = items.filter(i => i.tipo === 'CONTROL').length;

  // Abrir modal de edición en la tabla
  const handleOpenEdit = (item) => {
    setEditForm({
      cod_patrimonial: item.cod_patrimonial,
      tipo: item.tipo,
      denominacion: item.denominacion,
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      color: item.color || '',
      caracteristicas_accesorios: item.caracteristicas_accesorios || '',
      ownerType: item.cod_personal ? 'PERSONAL' : 'MANUAL',
      cod_personal: item.cod_personal || '',
      propietario_manual: item.propietario_manual || '',
      observaciones: item.observaciones || '',
      id_sucursal: item.id_sucursal || '',
      localidad: item.localidad || '',
      fecha_ingreso: item.fecha_ingreso || getTodayDate(),
      fecha_salida: item.fecha_salida || ''
    });
    setIsEditMode(true);
    setModalError(null);
    setShowModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.cod_patrimonial || !editForm.denominacion) {
      setModalError('El código patrimonial y la denominación son obligatorios.');
      return;
    }

    const codPersonalClean = editForm.ownerType === 'PERSONAL' ? extractString(editForm.cod_personal) : null;
    const propietarioManualClean = editForm.ownerType === 'MANUAL' ? extractString(editForm.propietario_manual) : null;

    if (editForm.ownerType === 'PERSONAL' && !codPersonalClean) {
      setModalError('Debe seleccionar el nombre de un personal de la empresa de la lista.');
      return;
    }
    if (editForm.ownerType === 'MANUAL' && !propietarioManualClean) {
      setModalError('Debe escribir el nombre del propietario externo.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    const payload = {
      cod_patrimonial: extractString(editForm.cod_patrimonial),
      tipo: editForm.tipo,
      denominacion: extractString(editForm.denominacion),
      marca: extractString(editForm.marca),
      modelo: extractString(editForm.modelo),
      numero_serie: extractString(editForm.numero_serie),
      color: extractString(editForm.color),
      caracteristicas_accesorios: extractString(editForm.caracteristicas_accesorios),
      cod_personal: codPersonalClean,
      propietario_manual: propietarioManualClean,
      id_sucursal: editForm.id_sucursal ? Number(editForm.id_sucursal) : null,
      localidad: editForm.localidad,
      fecha_ingreso: editForm.fecha_ingreso || null,
      fecha_salida: editForm.fecha_salida || null,
      observaciones: extractString(editForm.observaciones)
    };

    try {
      await saveBienTercero(editForm.cod_patrimonial, payload, true);
      setSuccessMessage('¡Registro actualizado correctamente!');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setShowModal(false);
      await loadData();
    } catch (err) {
      setModalError(err.message || 'Error al actualizar registro.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (cod) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro '${cod}'?`)) return;
    try {
      await deleteBienTercero(cod);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al eliminar el registro.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Módulo Kicker & Título Principal */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0 mb-1">
        <div className="module-heading">
          <p className="module-kicker">Módulo de Ingreso y Control</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span>BIENES DE TERCEROS</span>
          </h2>
          <p className="text-sm text-slate-500">
            Registro de propietarios (Personal EPS / Externo), fechas de ingreso/salida y emisión de actas PDF.
          </p>
        </div>

        {/* Pestañas Principales (Registro y Gestión VS Tablas y Consultas) */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('REGISTRO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'REGISTRO'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registro y Gestión</span>
          </button>
          <button
            onClick={() => setActiveSubTab('CONSULTAS')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'CONSULTAS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Tablas y Consultas</span>
          </button>
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center space-x-2 text-xs animate-fadeIn shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center space-x-2 text-xs animate-fadeIn shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: REGISTRO Y GESTIÓN (Formulario de Ingreso de Bienes de Terceros)   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'REGISTRO' && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 overflow-y-auto">
          <form onSubmit={handleRegSubmit} className="max-w-4xl mx-auto space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-purple-600" />
                <span>Formulario de Ingreso y Registro de Bienes de Terceros</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Complete los datos del bien y seleccione si pertenece a Personal EPS o a un Personal Externo.
              </p>
            </div>

            {regError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{regError}</span>
              </div>
            )}

            {/* Fila 1: Tipo de Registro y Código Patrimonial */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Registro
                </label>
                <select
                  value={regForm.ownerType === 'PERSONAL' ? 'PERSONAL_EPS' : 'PERSONAL_EXTERNO'}
                  onChange={(e) => {
                    const sel = e.target.value;
                    if (sel === 'PERSONAL_EPS') {
                      setRegForm(prev => ({
                        ...prev,
                        tipo: 'TERCERO',
                        ownerType: 'PERSONAL',
                        propietario_manual: ''
                      }));
                    } else {
                      setRegForm(prev => ({
                        ...prev,
                        tipo: 'TERCERO',
                        ownerType: 'MANUAL',
                        cod_personal: ''
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-purple-50/80 border border-purple-200 rounded-xl font-extrabold text-purple-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
                >
                  <option value="PERSONAL_EPS">Persona EPS (Personal de la Empresa)</option>
                  <option value="PERSONAL_EXTERNO">Personal Externo (Escritura Manual)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código de Registro (Autogenerado)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={regForm.cod_patrimonial}
                    onChange={(e) => setRegForm(prev => ({ ...prev, cod_patrimonial: e.target.value }))}
                    className="flex-1 px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-purple-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => generarCodigoParaRegistro(regForm.tipo)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                    title="Regenerar Código"
                  >
                    Generar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sucursal de Ingreso
                </label>
                <select
                  value={regForm.id_sucursal}
                  onChange={(e) => {
                    const sucId = e.target.value;
                    const sucObj = sucursales.find(s => String(s.value) === String(sucId));
                    setRegForm(prev => ({
                      ...prev,
                      id_sucursal: sucId,
                      localidad: sucObj ? sucObj.label : prev.localidad
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">Seleccione Sucursal...</option>
                  {sucursales.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* SECCIÓN PROPIETARIO DEL BIEN */}
            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100/80 pb-2">
                <label className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>PROPIETARIO DEL BIEN</span>
                </label>

                <span className="text-[0.6875rem] font-extrabold text-purple-700 bg-white px-2.5 py-1 rounded-lg border border-purple-200">
                  {regForm.ownerType === 'PERSONAL' ? 'Personal EPS (Lista Automática)' : 'Personal Externo (Escritura Manual)'}
                </span>
              </div>

              {regForm.ownerType === 'PERSONAL' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Seleccione Nombre del Personal de la Empresa
                  </label>
                  <SearchableSelect
                    options={personalOptions}
                    value={typeof regForm.cod_personal === 'object' ? (regForm.cod_personal?.target?.value || '') : (regForm.cod_personal || '')}
                    onChange={(val) => {
                      const clean = extractString(val);
                      setRegForm(prev => ({ ...prev, cod_personal: clean || '' }));
                    }}
                    placeholder="Buscar personal por nombre..."
                    className="text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre del Propietario Externo (Escritura Manual)
                  </label>
                  <input
                    type="text"
                    placeholder="Escriba el nombre completo del propietario externo o visitante..."
                    value={regForm.propietario_manual}
                    onChange={(e) => setRegForm(prev => ({ ...prev, propietario_manual: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    required={regForm.ownerType === 'MANUAL'}
                  />
                </div>
              )}
            </div>

            {/* CARACTERÍSTICAS BÁSICAS DEL BIEN */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-600" />
                <span>Características del Bien</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Denominación del Bien / Equipo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Laptop Lenovo ThinkPad i7, Estación Total Leica, Generador 5KW..."
                  value={regForm.denominacion}
                  onChange={(e) => setRegForm(prev => ({ ...prev, denominacion: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                  <input
                    type="text"
                    placeholder="Ej. Negro / Gris"
                    value={regForm.color}
                    onChange={(e) => setRegForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej. Lenovo / HP"
                    value={regForm.marca}
                    onChange={(e) => setRegForm(prev => ({ ...prev, marca: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    placeholder="Ej. T14 Gen 2"
                    value={regForm.modelo}
                    onChange={(e) => setRegForm(prev => ({ ...prev, modelo: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">N° de Serie</label>
                  <input
                    type="text"
                    placeholder="Ej. SN-99887766"
                    value={regForm.numero_serie}
                    onChange={(e) => setRegForm(prev => ({ ...prev, numero_serie: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Especificaciones Técnicas / Accesorios Incluidos
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Incluye cargador original, estuche de protección, mouse inalámbrico..."
                  value={regForm.caracteristicas_accesorios}
                  onChange={(e) => setRegForm(prev => ({ ...prev, caracteristicas_accesorios: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            {/* FECHAS DE INGRESO Y SALIDA ESTIMADA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span>Fecha de Ingreso <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  value={regForm.fecha_ingreso}
                  onChange={(e) => setRegForm(prev => ({ ...prev, fecha_ingreso: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                  required
                />
                <p className="text-[0.6875rem] text-slate-400 mt-1">Fecha oficial registrada en el Acta PDF y Excel.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fecha de Salida (Opcional / Posterior)</span>
                </label>
                <input
                  type="date"
                  value={regForm.fecha_salida}
                  onChange={(e) => setRegForm(prev => ({ ...prev, fecha_salida: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                />
                <p className="text-[0.6875rem] text-slate-400 mt-1">Puede actualizarse posteriormente desde la vista de tablas.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones Generales</label>
              <textarea
                rows={2}
                placeholder="Observaciones adicionales sobre el estado del bien o motivo de ingreso..."
                value={regForm.observaciones}
                onChange={(e) => setRegForm(prev => ({ ...prev, observaciones: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
              />
            </div>

            {/* BOTÓN REGISTRAR Y GENERAR ACTA */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={regLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-xs shadow-lg shadow-purple-600/20 active:scale-95 transition-all cursor-pointer border-none"
              >
                <FileText className="w-4 h-4" />
                <span>{regLoading ? 'Registrando...' : 'Registrar Bien de Tercero y Generar Acta (PDF)'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: TABLAS Y CONSULTAS (Historial Tabular, Filtros, Edición y Salidas) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'CONSULTAS' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Métricas rápidas */}
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-purple-500"></span>
              <span className="text-slate-500 font-semibold">Terceros (Externos):</span>
              <strong className="text-slate-800">{totalTerceros}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span className="text-slate-500 font-semibold">Control Interno:</span>
              <strong className="text-slate-800">{totalControles}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[0.8125rem] shadow-sm flex items-center space-x-2">
              <span className="text-slate-500 font-semibold">Total Registros:</span>
              <strong className="text-slate-800">{items.length}</strong>
            </div>
          </div>

          {/* Bar de Controles y Búsqueda */}
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
                  placeholder="Buscar por código, denominación, propietario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 min-h-0 text-sm bg-white border-slate-200 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10"
                />
              </div>

              <div className="relative">
                <select 
                  value={filtroSucursal} 
                  onChange={e => setFiltroSucursal(e.target.value)}
                  className="appearance-none block w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 cursor-pointer" 
                  style={{ minHeight: '2.25rem' }}
                >
                  <option value="">Todas las sucursales</option>
                  {sucursales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer border-none h-[2.25rem] shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={handleExportListPDF}
                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer border-none h-[2.25rem] shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span>PDF Historial</span>
              </button>
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm py-12">
                  <span>Cargando bienes de terceros...</span>
                </div>
              ) : filteredAndSortedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <Users className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No se encontraron registros de terceros.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 font-bold text-slate-700">
                    <tr>
                      <th className="p-3 w-28">
                        <div className="flex items-center justify-between">
                          <span>Código</span>
                          <ExcelHeaderFilter columnKey="cod_patrimonial" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3 w-24">
                        <div className="flex items-center justify-between">
                          <span>Tipo</span>
                          <ExcelHeaderFilter columnKey="tipo" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3">
                        <div className="flex items-center justify-between">
                          <span>Denominación del Bien</span>
                          <ExcelHeaderFilter columnKey="denominacion" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3">
                        <div className="flex items-center justify-between">
                          <span>Propietario del Bien</span>
                          <ExcelHeaderFilter columnKey="responsable" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3">
                        <div className="flex items-center justify-between">
                          <span>Características</span>
                          <ExcelHeaderFilter columnKey="caracteristicas" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3 w-32">
                        <div className="flex items-center justify-between">
                          <span>Ubicación</span>
                          <ExcelHeaderFilter columnKey="ubicacion" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3 w-28">
                        <div className="flex items-center justify-between">
                          <span>Fecha Ingreso</span>
                          <ExcelHeaderFilter columnKey="fecha_ingreso" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3 w-36">
                        <div className="flex items-center justify-between">
                          <span>Fecha Salida</span>
                          <ExcelHeaderFilter columnKey="fecha_salida" items={filteredItems} getColValue={getColValue} onFilterChange={handleFilterChange} onSortChange={handleSortChange} currentSort={sortConfig} />
                        </div>
                      </th>
                      <th className="p-3 w-24 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedItems.map((item) => (
                      <tr key={item.cod_patrimonial} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-purple-700">{item.cod_patrimonial}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-bold ${
                            item.tipo === 'TERCERO' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {item.tipo === 'TERCERO' ? 'Tercero' : 'Control'}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{item.denominacion}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            {item.responsable || item.propietario_manual || 'Sin asignar'}
                          </div>
                          {item.propietario_manual ? (
                            <span className="text-[0.625rem] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                              Personal Externo
                            </span>
                          ) : (
                            <span className="text-[0.625rem] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 inline-block mt-0.5">
                              Personal EPS
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 leading-snug">
                          <div><span className="font-semibold text-slate-700">M:</span> {item.marca || 'S/M'}</div>
                          <div><span className="font-semibold text-slate-700">Mod:</span> {item.modelo || 'S/M'}</div>
                          <div><span className="font-semibold text-slate-700">Serie:</span> {item.numero_serie || 'S/S'}</div>
                          {item.color && <div><span className="font-semibold text-slate-700">Color:</span> {item.color}</div>}
                        </td>
                        <td className="p-3 text-slate-600">
                          <div className="font-semibold text-slate-800">{item.sucursal || '—'}</div>
                          {item.localidad && <div className="text-[0.6875rem] text-slate-400">({item.localidad})</div>}
                        </td>
                        <td className="p-3 text-slate-700 font-semibold">
                          {(() => {
                            const val = item.fecha_ingreso || (item.created_at ? String(item.created_at).split('T')[0] : null);
                            return val ? val.split('-').reverse().join('/') : '—';
                          })()}
                        </td>
                        {/* Celda Interactivia de Fecha de Salida */}
                        <td className="p-3">
                          {editingFechaSalida[item.cod_patrimonial] ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                defaultValue={item.fecha_salida || ''}
                                id={`input_fs_${item.cod_patrimonial}`}
                                className="px-1.5 py-1 text-xs border border-purple-300 rounded-lg bg-white"
                              />
                              <button
                                onClick={() => {
                                  const val = document.getElementById(`input_fs_${item.cod_patrimonial}`).value;
                                  handleSaveFechaSalida(item, val);
                                }}
                                disabled={savingFechaSalida[item.cod_patrimonial]}
                                className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                                title="Guardar Fecha Salida"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingFechaSalida(prev => ({ ...prev, [item.cod_patrimonial]: false }))}
                                className="p-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className={`font-semibold ${item.fecha_salida ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                                {item.fecha_salida ? item.fecha_salida.split('-').reverse().join('/') : 'Pendiente'}
                              </span>
                              <button
                                onClick={() => setEditingFechaSalida(prev => ({ ...prev, [item.cod_patrimonial]: true }))}
                                className="p-1 text-slate-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Editar Fecha de Salida"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => generarActaPDF(item)}
                              title="Descargar Acta PDF"
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              title="Editar Registro"
                              className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.cod_patrimonial)}
                              title="Eliminar Registro"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
        </div>
      )}

      {/* Modal de Edición */}
      {showModal && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={`Editar Registro (${editForm.cod_patrimonial})`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Denominación del Bien</label>
              <input
                type="text"
                value={editForm.denominacion}
                onChange={(e) => setEditForm(prev => ({ ...prev, denominacion: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                required
              />
            </div>

            {/* Propietario en Edición */}
            <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>PROPIETARIO DEL BIEN</span>
                <div className="flex gap-2 text-[0.6875rem]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="editOwnerType"
                      checked={editForm.ownerType === 'PERSONAL'}
                      onChange={() => setEditForm(prev => ({ ...prev, ownerType: 'PERSONAL', propietario_manual: '' }))}
                    />
                    <span>Personal EPS</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="editOwnerType"
                      checked={editForm.ownerType === 'MANUAL'}
                      onChange={() => setEditForm(prev => ({ ...prev, ownerType: 'MANUAL', cod_personal: '' }))}
                    />
                    <span>Personal Externo</span>
                  </label>
                </div>
              </div>

              {editForm.ownerType === 'PERSONAL' ? (
                <SearchableSelect
                  options={personalOptions}
                  value={typeof editForm.cod_personal === 'object' ? (editForm.cod_personal?.target?.value || '') : (editForm.cod_personal || '')}
                  onChange={(val) => {
                    const clean = extractString(val);
                    setEditForm(prev => ({ ...prev, cod_personal: clean || '' }));
                  }}
                  placeholder="Buscar personal por nombre..."
                  className="text-xs"
                />
              ) : (
                <input
                  type="text"
                  value={editForm.propietario_manual}
                  onChange={(e) => setEditForm(prev => ({ ...prev, propietario_manual: e.target.value }))}
                  placeholder="Nombre del propietario externo..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                <input
                  type="text"
                  value={editForm.color}
                  onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                <input
                  type="text"
                  value={editForm.marca}
                  onChange={(e) => setEditForm(prev => ({ ...prev, marca: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                <input
                  type="text"
                  value={editForm.modelo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, modelo: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Serie</label>
                <input
                  type="text"
                  value={editForm.numero_serie}
                  onChange={(e) => setEditForm(prev => ({ ...prev, numero_serie: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Ingreso</label>
                <input
                  type="date"
                  value={editForm.fecha_ingreso}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fecha_ingreso: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Salida</label>
                <input
                  type="date"
                  value={editForm.fecha_salida}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fecha_salida: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalLoading}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all"
              >
                {modalLoading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
