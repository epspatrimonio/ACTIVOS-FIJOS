import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, Search, CheckCircle, FileText, FileSpreadsheet, 
  RefreshCw, User, Building, Briefcase, Calendar, ShieldCheck, AlertCircle, Edit3, X
} from 'lucide-react';
import { 
  fetchTransferencias, createTransferencia, updateTransferencia, 
  fetchActivos, fetchPersonal, fetchSucursales, fetchPuestos
} from '../utils/api';

export default function TransferenciasPanel() {
  const [transferencias, setTransferencias] = useState([]);
  const [activos, setActivos] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [puestosList, setPuestosList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Buscador de Activo
  const [searchActivo, setSearchActivo] = useState('');
  const [activoSuggestions, setActivoSuggestions] = useState([]);
  const [selectedActivo, setSelectedActivo] = useState(null);

  // Formulario Nueva Transferencia
  const [formRespDestino, setFormRespDestino] = useState('');
  const [respSuggestions, setRespSuggestions] = useState([]);
  const [formCargoDestino, setFormCargoDestino] = useState('');
  const [cargoSuggestions, setCargoSuggestions] = useState([]);
  const [formSucursalDestino, setFormSucursalDestino] = useState('');
  const [formMotivo, setFormMotivo] = useState('Reasignación de personal');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formObservaciones, setFormObservaciones] = useState('');

  // Filtros en Historial
  const [searchHistory, setSearchHistory] = useState('');

  // Modal Edición
  const [editingTransf, setEditingTransf] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfData, activosData, personalData, sucData, puestosData] = await Promise.all([
        fetchTransferencias().catch(() => []),
        fetchActivos().catch(() => []),
        fetchPersonal().catch(() => []),
        fetchSucursales().catch(() => []),
        fetchPuestos().catch(() => [])
      ]);
      setTransferencias(transfData);
      setActivos(activosData);

      if (personalData && Array.isArray(personalData)) {
        setPersonalList(personalData);
      }

      if (sucData && Array.isArray(sucData)) {
        const EXCLUDED_SUCURSALES = new Set(['SELVA CENTRAL', 'EPS SELVA CENTRAL', 'SELVA CENTRAL S.A.', 'RETIRADAS', 'SIN ASIGNAR']);
        const sucs = sucData
          .map(s => (s.label || s.sucursal || '').toUpperCase().trim())
          .filter(s => s && !EXCLUDED_SUCURSALES.has(s));
        setSucursalesList(Array.from(new Set(sucs)));
      }

      if (puestosData && Array.isArray(puestosData)) {
        const psts = puestosData.map(p => (p.label || '').toUpperCase()).filter(Boolean);
        setPuestosList(Array.from(new Set(psts)));
      }
    } catch (err) {
      setError('Error al cargar datos iniciales: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Buscar Activo por Código Patrimonial o Denominación
  const handleSearchActivoChange = (val) => {
    setSearchActivo(val);
    if (!val.trim()) {
      setActivoSuggestions([]);
      return;
    }
    const query = val.trim().toLowerCase();
    const matches = activos.filter(a => 
      (a.cod_patrimonial && a.cod_patrimonial.toLowerCase().includes(query)) ||
      (a.denominacion && a.denominacion.toLowerCase().includes(query))
    ).slice(0, 8);
    setActivoSuggestions(matches);
  };

  const handleSelectActivo = (activo) => {
    setSelectedActivo(activo);
    setSearchActivo(activo.cod_patrimonial);
    setActivoSuggestions([]);
  };

  // Autocompletado del Nuevo Responsable (dim_personal / PersonalDTO)
  const handleRespDestinoChange = (val) => {
    setFormRespDestino(val);
    if (!val.trim()) {
      setRespSuggestions([]);
      return;
    }
    const query = val.trim().toLowerCase();
    const matches = personalList.filter(p => {
      const nombre = (p.label || p.personal || p.nombres_completos || '').toLowerCase();
      const codigo = (p.value || p.cod_personal || '').toLowerCase();
      return nombre.includes(query) || codigo.includes(query);
    }).slice(0, 10);
    setRespSuggestions(matches);
  };

  const handleSelectRespDestino = (persona) => {
    const nombreStr = persona.label || persona.personal || persona.nombres_completos || persona.value || '';
    setFormRespDestino(nombreStr);
    if (persona.puesto) setFormCargoDestino(persona.puesto);
    if (persona.sucursal) {
      const suc = persona.sucursal.toUpperCase();
      if (sucursalesList.includes(suc)) {
        setFormSucursalDestino(suc);
      }
    }
    setRespSuggestions([]);
  };

  // Autocompletado de Cargo / Puesto
  const handleCargoDestinoChange = (val) => {
    setFormCargoDestino(val);
    if (!val.trim()) {
      setCargoSuggestions([]);
      return;
    }
    const query = val.trim().toLowerCase();
    const matches = puestosList.filter(c => c.toLowerCase().includes(query)).slice(0, 8);
    setCargoSuggestions(matches);
  };

  const handleRegistrarTransferencia = async (e) => {
    e.preventDefault();
    if (!selectedActivo) {
      alert('Por favor busque y seleccione el activo patrimonial a transferir.');
      return;
    }
    if (!formRespDestino.trim()) {
      alert('Debe ingresar o seleccionar el Nuevo Responsable.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg('');

    try {
      const payload = {
        fecha_transferencia: formFecha,
        cod_patrimonial: selectedActivo.cod_patrimonial,
        denominacion: selectedActivo.denominacion,
        resp_origen: selectedActivo.responsable || 'SIN ASIGNAR',
        cargo_origen: selectedActivo.puesto || selectedActivo.unidad || '—',
        sucursal_origen: selectedActivo.sucursal || selectedActivo.localidad || 'SEDE CENTRAL',
        resp_destino: formRespDestino.trim().toUpperCase(),
        cargo_destino: formCargoDestino.trim().toUpperCase() || '—',
        sucursal_destino: formSucursalDestino || 'SEDE CENTRAL',
        motivo: formMotivo,
        observaciones: formObservaciones
      };

      const newTransf = await createTransferencia(payload);
      setSuccessMsg(`Transferencia ${newTransf.n_transferencia} registrada exitosamente.`);

      // Generar Acta PDF automáticamente
      await generarActaTransferenciaPDF(newTransf);

      // Limpiar formulario
      setSelectedActivo(null);
      setSearchActivo('');
      setFormRespDestino('');
      setFormCargoDestino('');
      setFormSucursalDestino('');
      setFormObservaciones('');

      // Recargar datos
      await loadData();
    } catch (err) {
      setError(err.message || 'Error al registrar la transferencia.');
    } finally {
      setSaving(false);
    }
  };

  // Generación de Acta de Transferencia en PDF
  const generarActaTransferenciaPDF = async (transf) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no se encuentra cargada.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginX = 14;
    let posY = 15;

    // Cargar logos institucionales
    const loadImage = (url) => new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    let logoImg = null;
    let selloImg = null;
    try {
      [logoImg, selloImg] = await Promise.all([
        loadImage('/logo_eps2.png').catch(() => null),
        loadImage('/Sello Post Firma - CP1.png').catch(() => null)
      ]);
    } catch (e) {
      console.warn('No se pudieron cargar imágenes para el PDF:', e);
    }

    if (logoImg) doc.addImage(logoImg, 'PNG', marginX, posY, 45, 15);
    if (selloImg) doc.addImage(selloImg, 'PNG', 150, posY, 45, 18);

    posY += 20;

    // Encabezado Principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ACTA DE TRANSFERENCIA Y CAMBIO DE RESPONSABLE', 105, posY, { align: 'center' });
    doc.setFontSize(11);
    doc.text('BIENES MUEBLES PATRIMONIALES', 105, posY + 6, { align: 'center' });

    posY += 13;
    doc.setFontSize(10);
    doc.setTextColor(0, 176, 240);
    doc.text(`N° ACTA: ${transf.n_transferencia}`, 105, posY, { align: 'center' });
    doc.setTextColor(30, 41, 59);

    posY += 8;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const fechaFormatted = new Date(transf.fecha_transferencia + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const textoIntro = `En la ciudad de Chanchamayo, con fecha ${fechaFormatted}, en cumplimiento de las directivas de Control Patrimonial de la EPS Selva Central S.A., se suscribe la presente Acta de Transferencia de Bien Mueble por cambio de asignación/responsable entre el personal que entrega (Cedente) y el personal que recibe (Receptor).`;
    const splitIntro = doc.splitTextToSize(textoIntro, 180);
    doc.text(splitIntro, marginX, posY);

    posY += splitIntro.length * 4.2 + 4;

    // Tabla 1: Datos del Bien
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('1. IDENTIFICACIÓN DEL BIEN PATRIMONIAL', marginX, posY);
    posY += 3;

    doc.autoTable({
      body: [
        [
          { content: 'CÓD. PATRIMONIAL:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 40 } },
          (transf.cod_patrimonial || '').toUpperCase()
        ],
        [
          { content: 'DENOMINACIÓN:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 40 } },
          (transf.denominacion || '').toUpperCase()
        ]
      ],
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      margin: { left: marginX, right: marginX }
    });

    posY = doc.lastAutoTable.finalY + 6;

    // Tabla 2: Responsable Entregante vs Responsable Receptor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('2. DATOS DEL TRASLADO / CAMBIO DE ASIGNACIÓN', marginX, posY);
    posY += 3;

    doc.autoTable({
      head: [
        [
          { content: 'DETALLE', styles: { halign: 'center', fontStyle: 'bold', fillColor: [51, 65, 85], textColor: [255, 255, 255] } },
          { content: 'RESPONSABLE ENTREGANTE (ORIGEN)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [225, 29, 72], textColor: [255, 255, 255] } },
          { content: 'NUEVO RESPONSABLE (DESTINO)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [16, 185, 129], textColor: [255, 255, 255] } }
        ]
      ],
      body: [
        ['PERSONAL / TITULAR', (transf.resp_origen || '—').toUpperCase(), (transf.resp_destino || '—').toUpperCase()],
        ['CARGO / U.O.', (transf.cargo_origen || '—').toUpperCase(), (transf.cargo_destino || '—').toUpperCase()],
        ['SUCURSAL / SEDE', (transf.sucursal_origen || '—').toUpperCase(), (transf.sucursal_destino || '—').toUpperCase()]
      ],
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      margin: { left: marginX, right: marginX },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold' },
        1: { cellWidth: 71 },
        2: { cellWidth: 71 }
      }
    });

    posY = doc.lastAutoTable.finalY + 6;

    // Tabla 3: Motivo y Observaciones
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('3. MOTIVO Y OBSERVACIONES DE LA TRANSFERENCIA', marginX, posY);
    posY += 3;

    doc.autoTable({
      body: [
        [
          { content: 'MOTIVO:', styles: { fontStyle: 'bold', cellWidth: 35, fillColor: [241, 245, 249] } },
          (transf.motivo || 'Reasignación de personal').toUpperCase()
        ],
        [
          { content: 'OBSERVACIONES:', styles: { fontStyle: 'bold', cellWidth: 35, fillColor: [241, 245, 249] } },
          (transf.observaciones || 'Sin observaciones adicionales. El bien se entrega en condiciones de operatividad.').toUpperCase()
        ]
      ],
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      margin: { left: marginX, right: marginX }
    });

    posY = doc.lastAutoTable.finalY + 25;

    // Firmas
    doc.setLineWidth(0.4);
    doc.setDrawColor(100, 100, 100);

    // Bloque 1: Entregó
    doc.line(marginX + 5, posY, marginX + 55, posY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('ENTREGADO POR', marginX + 30, posY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text((transf.resp_origen || '').toUpperCase(), marginX + 30, posY + 8, { align: 'center' });

    // Bloque 2: Recibió
    doc.line(78, posY, 128, posY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('RECIBIDO POR', 103, posY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text((transf.resp_destino || '').toUpperCase(), 103, posY + 8, { align: 'center' });

    // Bloque 3: Control Patrimonial
    doc.line(145, posY, 195, posY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('V°B° CONTROL PATRIMONIAL', 170, posY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('EPS SELVA CENTRAL S.A.', 170, posY + 8, { align: 'center' });

    doc.save(`Acta_Transferencia_${transf.n_transferencia}_${transf.cod_patrimonial}.pdf`);
  };

  // Exportar Excel del Historial
  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert('La librería XLSX no está cargada.');
      return;
    }
    const sheetData = filteredHistory.map(t => ({
      "N° Transferencia": t.n_transferencia,
      "Fecha": t.fecha_transferencia,
      "Cód. Patrimonial": t.cod_patrimonial,
      "Denominación del Bien": t.denominacion,
      "Responsable Origen": t.resp_origen || '—',
      "Cargo Origen": t.cargo_origen || '—',
      "Sucursal Origen": t.sucursal_origen || '—',
      "Nuevo Responsable (Destino)": t.resp_destino,
      "Cargo Destino": t.cargo_destino || '—',
      "Sucursal Destino": t.sucursal_destino || '—',
      "Motivo": t.motivo,
      "Observaciones": t.observaciones || ''
    }));

    const ws = window.XLSX.utils.json_to_sheet(sheetData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Transferencias");
    window.XLSX.writeFile(wb, `Transferencias_Bienes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Guardar Edición
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTransf) return;

    try {
      await updateTransferencia(editingTransf.id, editFormData);
      setEditingTransf(null);
      await loadData();
    } catch (err) {
      alert('Error al actualizar la transferencia: ' + err.message);
    }
  };

  // Filtrado de Historial
  const filteredHistory = transferencias.filter(t => {
    if (!searchHistory.trim()) return true;
    const q = searchHistory.trim().toLowerCase();
    return (
      (t.n_transferencia && t.n_transferencia.toLowerCase().includes(q)) ||
      (t.cod_patrimonial && t.cod_patrimonial.toLowerCase().includes(q)) ||
      (t.denominacion && t.denominacion.toLowerCase().includes(q)) ||
      (t.resp_origen && t.resp_origen.toLowerCase().includes(q)) ||
      (t.resp_destino && t.resp_destino.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-fadeIn w-full max-w-full overflow-y-auto pr-1">
      {/* Header del Módulo */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[0.6875rem] font-bold text-brand-600 tracking-wider uppercase">Módulo de Reasignación</span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">TRANSFERENCIA Y CAMBIO DE RESPONSABLE</h2>
            <p className="text-xs text-slate-500 font-medium">Reasigna bienes patrimoniales y genera las actas oficiales en PDF.</p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer border-none"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sección 1: Formulario Nueva Transferencia */}
      <form onSubmit={handleRegistrarTransferencia} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-brand-500 rounded-full"></span>
            <span>Nueva Transferencia de Bien</span>
          </h3>
          <span className="text-xs font-semibold text-slate-400">Paso 1: Seleccionar activo / Paso 2: Asignar nuevo responsable</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna Izquierda: Búsqueda y Datos del Activo */}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Search className="w-3.5 h-3.5 text-brand-600" />
                <span>Buscar Código Patrimonial o Denominación</span>
              </label>
              <input
                type="text"
                value={searchActivo}
                onChange={(e) => handleSearchActivoChange(e.target.value)}
                placeholder="Ingrese código patrimonial (ej: 742205560002)..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {activoSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto z-30 divide-y divide-slate-100">
                  {activoSuggestions.map((a) => (
                    <div
                      key={a.cod_patrimonial}
                      onClick={() => handleSelectActivo(a)}
                      className="p-3 hover:bg-brand-50/60 cursor-pointer transition-colors text-xs space-y-0.5"
                    >
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{a.cod_patrimonial}</span>
                        <span className="text-brand-600">{a.sucursal || 'SEDE CENTRAL'}</span>
                      </div>
                      <div className="text-slate-600 font-medium truncate">{a.denominacion}</div>
                      <div className="text-[0.7rem] text-slate-400">Resp. Actual: {a.responsable || 'SIN ASIGNAR'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tarjeta del Activo Seleccionado */}
            {selectedActivo ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs font-extrabold text-brand-700 bg-brand-100/70 px-2.5 py-1 rounded-lg">
                    {selectedActivo.cod_patrimonial}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Estado: <span className="text-slate-800">{selectedActivo.estado_activo || 'BUENO'}</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">{selectedActivo.denominacion}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Marca: <strong>{selectedActivo.marca || 'S/M'}</strong> | Modelo: <strong>{selectedActivo.modelo || 'S/M'}</strong> | Serie: <strong>{selectedActivo.numero_serie || 'S/S'}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[0.65rem]">Responsable Actual (Cedente)</span>
                    <span className="font-extrabold text-rose-700">{selectedActivo.responsable || 'SIN ASIGNAR'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[0.65rem]">Ubicación / Sede Actual</span>
                    <span className="font-bold text-slate-800">{selectedActivo.sucursal || selectedActivo.localidad || 'SEDE CENTRAL'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/70 rounded-xl p-6 border border-dashed border-slate-300 text-center text-slate-400 space-y-1">
                <Search className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Busque un activo por su código patrimonial para iniciar la transferencia.</p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Datos del Destino */}
          <div className="space-y-4">
            {/* Nuevo Responsable */}
            <div className="relative">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nuevo Responsable (Receptor) *</span>
              </label>
              <input
                type="text"
                required
                value={formRespDestino}
                onChange={(e) => handleRespDestinoChange(e.target.value)}
                placeholder="Escriba para filtrar personal..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {respSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 max-h-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto z-30 divide-y divide-slate-100">
                  {respSuggestions.map((p) => {
                    const nombreStr = p.label || p.personal || p.nombres_completos || '';
                    const codStr = p.value || p.cod_personal || '';
                    return (
                      <div
                        key={codStr || nombreStr}
                        onClick={() => handleSelectRespDestino(p)}
                        className="p-2.5 hover:bg-emerald-50/60 cursor-pointer transition-colors text-xs flex justify-between items-center"
                      >
                        <span className="font-bold text-slate-900">{nombreStr}</span>
                        <span className="text-[0.7rem] text-slate-400 font-mono">{codStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nuevo Cargo / U.O. y Nueva Sucursal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nuevo Cargo / Unidad Orgánica</span>
                </label>
                <input
                  type="text"
                  value={formCargoDestino}
                  onChange={(e) => handleCargoDestinoChange(e.target.value)}
                  placeholder="Ej: OPERADOR UO SATIPO"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold focus:border-brand-500 focus:outline-none"
                />
                {cargoSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto z-20 divide-y divide-slate-100">
                    {cargoSuggestions.map((c) => (
                      <div
                        key={c}
                        onClick={() => { setFormCargoDestino(c); setCargoSuggestions([]); }}
                        className="p-2 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700"
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nueva Sucursal / Sede *</span>
                </label>
                <select
                  required
                  value={formSucursalDestino}
                  onChange={(e) => setFormSucursalDestino(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Seleccionar Sucursal --</option>
                  {sucursalesList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Motivo y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Motivo de la Transferencia</label>
                <input
                  type="text"
                  required
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Ej: Reasignación de personal, Traslado de área..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Fecha de Transferencia</span>
                </label>
                <input
                  type="date"
                  required
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Observaciones</label>
              <textarea
                rows={2}
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                placeholder="Detalles sobre el estado del bien o motivo de entrega..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Botón de Envio */}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving || !selectedActivo}
            className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer border-none"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Registrar Transferencia y Generar Acta (PDF)'}</span>
          </button>
        </div>
      </form>

      {/* Sección 2: Historial de Transferencias */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Historial de Transferencias Registradas</h3>
            <p className="text-xs text-slate-500">Listado de cambios de responsable y actas generadas.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder="Filtrar por código, responsable..."
                className="pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:border-brand-500 w-56"
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer border-none shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Tabla de Historial */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-3">N° Acta</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Cód. Patrimonial</th>
                <th className="p-3">Denominación</th>
                <th className="p-3">Cedente (Origen)</th>
                <th className="p-3">Receptor (Nuevo)</th>
                <th className="p-3">Sucursal Destino</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-extrabold text-brand-600 whitespace-nowrap">{t.n_transferencia}</td>
                    <td className="p-3 whitespace-nowrap">{t.fecha_transferencia}</td>
                    <td className="p-3 font-bold whitespace-nowrap">{t.cod_patrimonial}</td>
                    <td className="p-3 max-w-[220px] truncate" title={t.denominacion}>{t.denominacion}</td>
                    <td className="p-3 text-rose-700 font-bold whitespace-nowrap">{t.resp_origen || '—'}</td>
                    <td className="p-3 text-emerald-700 font-bold whitespace-nowrap">{t.resp_destino}</td>
                    <td className="p-3 whitespace-nowrap">{t.sucursal_destino || '—'}</td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      <button
                        onClick={() => generarActaTransferenciaPDF(t)}
                        title="Descargar Acta PDF"
                        className="p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg transition-colors border-none cursor-pointer inline-flex items-center"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => { setEditingTransf(t); setEditFormData(t); }}
                        title="Editar Registro"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border-none cursor-pointer inline-flex items-center"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron registros de transferencias de bienes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edición de Transferencia */}
      {editingTransf && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Editar Registro {editingTransf.n_transferencia}</h3>
              <button onClick={() => setEditingTransf(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nuevo Responsable (Receptor)</label>
                <input
                  type="text"
                  required
                  value={editFormData.resp_destino || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, resp_destino: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cargo Destino</label>
                  <input
                    type="text"
                    value={editFormData.cargo_destino || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, cargo_destino: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sucursal Destino</label>
                  <select
                    value={editFormData.sucursal_destino || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, sucursal_destino: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                  >
                    {sucursalesList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo</label>
                <input
                  type="text"
                  value={editFormData.motivo || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, motivo: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={editFormData.observaciones || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, observaciones: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingTransf(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl border-none cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl border-none cursor-pointer">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
