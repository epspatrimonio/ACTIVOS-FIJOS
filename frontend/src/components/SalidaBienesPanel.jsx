import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, FileText, Plus, Trash2, Search, Check, Info, 
  Download, Sparkles, User, Settings, Calendar, RefreshCw, Layers
} from 'lucide-react';
import { fetchSalidas, createSalida } from '../utils/api';

export default function SalidaBienesPanel({ activos, loadingActivos, loadActivos }) {
  const [tab, setTab] = useState('REGISTRAR'); // REGISTRAR | HISTORIAL
  const [modo, setModo] = useState('AUTOMATICO'); // AUTOMATICO | MANUAL
  
  // Datos del formulario de cabecera
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipoSalida, setTipoSalida] = useState('Mantenimiento');
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [cargo, setCargo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [respTecnico, setRespTecnico] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Autocompletar Responsables del Sistema
  const [searchResp, setSearchResp] = useState('');
  const [showRespSuggestions, setShowRespSuggestions] = useState(false);
  const [uniqueResponsables, setUniqueResponsables] = useState([]);

  // Búsqueda global de activos en modo manual
  const [searchActivoQuery, setSearchActivoQuery] = useState('');
  const [showActivoSuggestions, setShowActivoSuggestions] = useState(false);

  // Bienes agregados a la orden
  const [bienesSeleccionados, setBienesSeleccionados] = useState([]);

  // Historial de salidas
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(null);

  // Extraer responsables únicos al montar o cuando cambian los activos
  useEffect(() => {
    if (activos && activos.length > 0) {
      const names = Array.from(
        new Set(
          activos
            .map(a => a.responsable)
            .filter(r => r && r.trim() !== '' && r !== '—' && r !== 'Sin asignar')
        )
      ).sort();
      setUniqueResponsables(names);
    }
  }, [activos]);

  // Cargar historial al alternar pestaña
  useEffect(() => {
    if (tab === 'HISTORIAL') {
      cargarHistorial();
    }
  }, [tab]);

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    setErrorHistorial(null);
    try {
      const data = await fetchSalidas();
      setHistorial(data);
    } catch (err) {
      setErrorHistorial(err.message || 'Error al cargar el historial.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Filtrar responsables sugeridos
  const sugerenciasResponsables = uniqueResponsables.filter(name => 
    name.toLowerCase().includes(searchResp.toLowerCase())
  ).slice(0, 8);

  // Seleccionar responsable del sistema
  const handleSelectResponsable = (name) => {
    setResponsable(name);
    setSearchResp('');
    setShowRespSuggestions(false);

    // Intentar pre-completar Cargo y Ubicación basándose en sus activos asignados
    const primerActivo = activos.find(a => a.responsable === name);
    if (primerActivo) {
      setCargo(primerActivo.subcategoria || 'PERSONAL OPERATIVO');
      setUbicacion(`${primerActivo.sucursal || ''} - ${primerActivo.localidad || ''}`.replace(/^ \- /, ''));
    }

    // Si estamos en modo AUTOMATICO, cargar inmediatamente todos los activos de este responsable
    if (modo === 'AUTOMATICO') {
      const activosAsignados = activos.filter(a => a.responsable === name);
      const bienesMapeados = activosAsignados.map(act => ({
        cod_patrimonial: act.cod_patrimonial || '',
        denominacion: act.denominacion || '',
        color: act.color || 'NEGRO',
        marca: act.marca || 'S/M',
        modelo: act.modelo || 'S/M',
        numero_serie: act.numero_serie || 'S/S',
        estado_activo: act.estado_activo || 'BUENO',
        accesorios: '',
        seleccionado: true, // Por defecto marcados
        original_id: act.id || act.cod_patrimonial
      }));
      setBienesSeleccionados(bienesMapeados);
    }
  };

  // Cambiar selección de activos en modo automático
  const handleToggleActivoAutomatico = (originalId) => {
    setBienesSeleccionados(prev => 
      prev.map(b => b.original_id === originalId ? { ...b, seleccionado: !b.seleccionado } : b)
    );
  };

  // Filtrar sugerencias de activos para modo manual
  const sugerenciasActivos = activos.filter(a => {
    const query = searchActivoQuery.toLowerCase();
    const cod = a.cod_patrimonial?.toLowerCase() || '';
    const denom = a.denominacion?.toLowerCase() || '';
    return query && (cod.includes(query) || denom.includes(query));
  }).slice(0, 8);

  // Agregar activo del sistema en modo manual
  const handleAddActivoManual = (act) => {
    // Evitar agregar duplicados
    if (bienesSeleccionados.some(b => b.cod_patrimonial === act.cod_patrimonial)) {
      alert('Este bien ya está en la lista.');
      return;
    }
    const nuevoBien = {
      cod_patrimonial: act.cod_patrimonial || '',
      denominacion: act.denominacion || '',
      color: act.color || 'NEGRO',
      marca: act.marca || 'S/M',
      modelo: act.modelo || 'S/M',
      numero_serie: act.numero_serie || 'S/S',
      estado_activo: act.estado_activo || 'BUENO',
      accesorios: '',
      seleccionado: true,
      original_id: act.id || act.cod_patrimonial
    };
    setBienesSeleccionados([...bienesSeleccionados, nuevoBien]);
    setSearchActivoQuery('');
    setShowActivoSuggestions(false);
  };

  // Agregar fila completamente vacía en modo manual
  const handleAddFilaVacia = () => {
    const nuevoBien = {
      cod_patrimonial: '',
      denominacion: '',
      color: 'NEGRO',
      marca: 'S/M',
      modelo: 'S/M',
      numero_serie: 'S/S',
      estado_activo: 'BUENO',
      accesorios: '',
      seleccionado: true,
      original_id: 'manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    };
    setBienesSeleccionados([...bienesSeleccionados, nuevoBien]);
  };

  // Actualizar un campo específico de un bien en la tabla
  const handleUpdateBienField = (index, field, value) => {
    setBienesSeleccionados(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  // Eliminar bien de la tabla
  const handleRemoveBien = (index) => {
    setBienesSeleccionados(prev => prev.filter((_, i) => i !== index));
  };

  // Alternar entre modo automático y manual
  const handleChangeModo = (nuevoModo) => {
    setModo(nuevoModo);
    setBienesSeleccionados([]);
    setResponsable('');
    setCargo('');
    setUbicacion('');
  };

  // Limpiar todo el formulario
  const handleLimpiarFormulario = () => {
    if (window.confirm('¿Está seguro de limpiar todos los campos del formulario y vaciar la lista de bienes?')) {
      setFecha(new Date().toISOString().split('T')[0]);
      setTipoSalida('Mantenimiento');
      setMotivo('');
      setResponsable('');
      setCargo('');
      setUbicacion('');
      setRespTecnico('');
      setObservaciones('');
      setBienesSeleccionados([]);
    }
  };

  // Registrar orden de salida y descargar PDF
  const handleGenerarOrden = async (e) => {
    e.preventDefault();

    // Validar cabecera obligatoria
    if (!fecha || !responsable.trim() || !cargo.trim() || !ubicacion.trim() || !motivo.trim()) {
      alert('Por favor complete todos los datos obligatorios (Fecha, Motivo, Responsable, Cargo y Ubicación).');
      return;
    }

    // Filtrar sólo bienes seleccionados/activos
    const bienesEnviar = bienesSeleccionados.filter(b => b.seleccionado);

    if (bienesEnviar.length === 0) {
      alert('Por favor agregue y seleccione al menos un bien patrimonial.');
      return;
    }

    // Validar que los bienes tengan denominación
    for (let i = 0; i < bienesEnviar.length; i++) {
      if (!bienesEnviar[i].denominacion.trim()) {
        alert(`El bien N° ${i + 1} no tiene una denominación válida.`);
        return;
      }
    }

    try {
      const payload = {
        fecha_orden: fecha,
        tipo_salida: tipoSalida,
        motivo: motivo.trim(),
        responsable: responsable.trim(),
        cargo: cargo.trim(),
        ubicacion: ubicacion.trim(),
        resp_tecnico: respTecnico.trim() || null,
        observaciones: observaciones.trim() || null,
        bienes: bienesEnviar.map(b => ({
          cod_patrimonial: b.cod_patrimonial || null,
          denominacion: b.denominacion.trim(),
          color: b.color || null,
          marca: b.marca || null,
          modelo: b.modelo || null,
          numero_serie: b.numero_serie || null,
          estado_activo: b.estado_activo,
          accesorios: b.accesorios || null
        }))
      };

      const result = await createSalida(payload);

      // Cargar imágenes
      const [logoImg, selloImg] = await Promise.all([
        loadImage('/logo_eps2.png').catch(() => null),
        loadImage('/Sello Post Firma - CP1.png').catch(() => null)
      ]);

      // Generar PDF
      await generarOrdenSalidaPDF(result, logoImg, selloImg);

      alert(`Orden de Salida ${result.n_orden} registrada y descargada con éxito.`);

      // Resetear formulario
      setMotivo('');
      setResponsable('');
      setCargo('');
      setUbicacion('');
      setRespTecnico('');
      setObservaciones('');
      setBienesSeleccionados([]);
      if (loadActivos) loadActivos(); // Recargar activos en App
      
    } catch (err) {
      alert(`Hubo un error al registrar la orden: ${err.message}`);
    }
  };

  // Cargar imágenes de forma asíncrona
  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`));
      img.src = url;
    });
  };

  // Generar PDF de una orden individual
  const generarOrdenSalidaPDF = async (salidaData, logoImg, selloImg) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no está disponible.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const marginX = 15;
    let posY = 15;
    
    // 1. Encabezado
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', marginX, posY, 22, 11);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text('E.P.S. "SELVA CENTRAL" S.A.', marginX + 24, posY + 2.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text('CHANCHAMAYO - OXAPAMPA - SATIPO', marginX + 24, posY + 5);
    doc.text('RUC: N° 20121876290', marginX + 24, posY + 7.5);

    const rawFecha = salidaData.fecha_orden;
    const dateParts = rawFecha.split('-');
    const fechaFormateada = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : rawFecha;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`FECHA: ${fechaFormateada}`, 195, posY + 5, { align: 'right' });

    // Título
    posY += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ORDEN DE SALIDA DE BIENES", 105, posY, { align: 'center' });
    
    const titleWidth = doc.getTextWidth("ORDEN DE SALIDA DE BIENES");
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(105 - (titleWidth / 2), posY + 1.5, 105 + (titleWidth / 2), posY + 1.5);

    // 2. Solicito (Tipo de Salida)
    posY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SOLICITO", marginX, posY);
    
    posY += 5;
    const selectedTipo = salidaData.tipo_salida;
    const tipos = [
      { label: 'Mantenimiento', key: 'Mantenimiento' },
      { label: 'Trabajo de campo', key: 'Trabajo de campo' },
      { label: 'Evento institucional', key: 'Evento institucional' },
      { label: 'Otros', key: 'Otros' }
    ];

    let posX = marginX;
    tipos.forEach(t => {
      const isChecked = selectedTipo.toLowerCase() === t.key.toLowerCase() || 
                       (t.key === 'Otros' && !['mantenimiento', 'trabajo de campo', 'evento institucional'].includes(selectedTipo.toLowerCase()));
      
      doc.setLineWidth(0.3);
      doc.setDrawColor(100, 100, 100);
      doc.setFillColor(255, 255, 255);
      doc.circle(posX + 2, posY - 1.5, 1.8, 'FD');

      if (isChecked) {
        doc.setFillColor(0, 176, 240);
        doc.circle(posX + 2, posY - 1.5, 1, 'FD');
      }

      doc.setFont("helvetica", isChecked ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(t.label, posX + 6, posY - 0.5);
      posX += 44;
    });

    // 3. Motivo
    posY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("MOTIVO", marginX, posY);

    posY += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const motivoText = salidaData.motivo.trim().toUpperCase();
    const splitMotivo = doc.splitTextToSize(motivoText, 180);
    doc.text(splitMotivo, marginX, posY);
    
    posY += (splitMotivo.length * 4) + 2;

    // 4. Titular del Bien
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("TITULAR DEL BIEN", marginX, posY);

    posY += 3;
    const respName = salidaData.responsable.trim().toUpperCase();
    const respCargo = salidaData.cargo.trim().toUpperCase();
    const respUbicacion = salidaData.ubicacion.trim().toUpperCase();

    doc.autoTable({
      body: [
        [{ content: 'RESPONSABLE:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, respName],
        [{ content: 'CARGO:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, respCargo],
        [{ content: 'UBICACIÓN-DEPENDENCIA:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, respUbicacion]
      ],
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
      margin: { left: marginX, right: marginX }
    });
    
    posY = doc.lastAutoTable.finalY + 6;

    // 5. Descripción del Bien
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DESCRIPCIÓN DEL BIEN", marginX, posY);

    posY += 3;

    const headers = [
      [
        { content: 'NÚMERO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'DENOMINACIÓN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'CARACTERÍSTICAS DEL BIEN', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'ESTADO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'ACCESORIOS', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } }
      ],
      [
        { content: 'COLOR', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'MARCA', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'MODELO', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'SERIE', styles: { halign: 'center', fontStyle: 'bold' } }
      ]
    ];

    const tableData = salidaData.bienes.map((b, idx) => [
      idx + 1,
      b.denominacion.toUpperCase(),
      (b.color || 'NEGRO').toUpperCase(),
      (b.marca || 'S/M').toUpperCase(),
      (b.modelo || 'S/M').toUpperCase(),
      (b.numero_serie || 'S/S').toUpperCase(),
      (b.estado_activo || 'BUENO').toUpperCase(),
      (b.accesorios || '—').toUpperCase()
    ]);

    doc.autoTable({
      head: headers,
      body: tableData,
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 35 },
        2: { cellWidth: 18 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 24 }
      },
      margin: { left: marginX, right: marginX }
    });

    posY = doc.lastAutoTable.finalY + 6;
    const pageHeight = doc.internal.pageSize.height;
    if (posY + 55 > pageHeight) {
      doc.addPage();
      posY = 20;
    }

    // 6. Observaciones
    const obsText = salidaData.observaciones ? salidaData.observaciones.trim().toUpperCase() : 'SIN OBSERVACIONES ADICIONALES.';
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBSERVACIONES:", marginX, posY);
    
    posY += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const splitObs = doc.splitTextToSize(obsText, 180);
    doc.text(splitObs, marginX, posY);
    
    posY += (splitObs.length * 4) + 6;

    // 7. Nota Legal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text("NOTA", marginX, posY);

    posY += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    const notaText = "EL TRABAJADOR ES RESPONSABLE DIRECTO Y ABSOLUTO DE LA EXISTENCIA, PERMANENCIA, CONSERVACIÓN DEL BIEN EN USO, EVITAR PERDIDA, SUSTRACCIÓN, DETERIODO ETC. EN CASO DE PÉRDIDA, EXTRAVIO O DETERIORO POR EL MAL USO DE LOS BIENES PATRIMONIALES DESCRITOS, ESTOS SERÁN REPUESTOS O REPARADOS POR EL TRABAJADOR RESPONSABLE DE LOS MISMOS. CUALQUIER MOVIMIENTOS DENTRO O FUERA DE LA ENTIDAD DEBERA SER COMUNICADO AL RESPONSABLE DE CONTROL PATRIMONIAL, BAJO RESPONSABILIDAD.";
    const splitNota = doc.splitTextToSize(notaText, 180);
    doc.text(splitNota, marginX, posY);

    // 8. Firmas
    const yLine = pageHeight - 35;
    if (posY + (splitNota.length * 3) + 5 > yLine - 10) {
      doc.addPage();
    }

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.25);
    doc.line(15, yLine, 65, yLine);
    doc.line(80, yLine, 130, yLine);
    doc.line(145, yLine, 195, yLine);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("TITULAR DEL BIEN", 40, yLine + 4, { align: 'center' });
    
    const cargoSalidaText = salidaData.resp_tecnico ? salidaData.resp_tecnico.trim().toUpperCase() : 'ÁREA TÉCNICA';
    doc.text("RESPONSABLE A CARGO DE SALIDA", 105, yLine + 4, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`(${cargoSalidaText})`, 105, yLine + 7.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.text("CONTROL PATRIMONIAL", 170, yLine + 4, { align: 'center' });

    if (selloImg) {
      doc.addImage(selloImg, 'PNG', 147, yLine - 22, 45, 20);
    }

    const sanitizeName = salidaData.responsable.replace(/\s+/g, '_').toUpperCase();
    doc.save(`Orden_Salida_Bienes_${salidaData.n_orden}_${sanitizeName}.pdf`);
  };

  // Descargar el historial de salidas completo en EXCEL
  const handleExportHistorialExcel = () => {
    if (!window.XLSX) {
      alert('La librería SheetJS no está cargada.');
      return;
    }
    const data = historial.map(s => ({
      "N° Orden": s.n_orden,
      "Fecha": s.fecha_orden,
      "Tipo de Salida": s.tipo_salida,
      "Responsable": s.responsable,
      "Cargo": s.cargo,
      "Ubicación / Dependencia": s.ubicacion,
      "Motivo de Salida": s.motivo,
      "Resp. Técnico Salida": s.resp_tecnico || '—',
      "Cantidad de Bienes": s.bienes ? s.bienes.length : 0,
      "Observaciones": s.observaciones || '—'
    }));

    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Historial Salidas");
    window.XLSX.writeFile(wb, `Historial_Salidas_Bienes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Descargar el historial de salidas completo en PDF
  const handleExportHistorialPDF = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La librería jsPDF no está cargada.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("EPS SELVA CENTRAL - CONTROL PATRIMONIAL", 14, 15);
    doc.setFontSize(11);
    doc.text("HISTORIAL GENERAL DE SALIDAS DE BIENES MUEBLES", 14, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 27);

    const headers = [["N° Orden", "Fecha", "Responsable", "Cargo / Dependencia", "Tipo Salida", "Motivo de Salida", "Bienes"]];
    const tableRows = historial.map(s => [
      s.n_orden,
      s.fecha_orden.split('-').reverse().join('/'),
      s.responsable.toUpperCase(),
      `${s.cargo.toUpperCase()}\n(${s.ubicacion.toUpperCase()})`,
      s.tipo_salida.toUpperCase(),
      s.motivo.toUpperCase(),
      s.bienes ? s.bienes.length : 0
    ]);

    doc.autoTable({
      startY: 32,
      head: headers,
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 45 },
        3: { cellWidth: 55 },
        4: { cellWidth: 35 },
        5: { cellWidth: 80 },
        6: { cellWidth: 15, halign: 'center' }
      }
    });

    doc.save(`Historial_Salidas_Bienes_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Re-descargar una orden específica desde la tabla de historial
  const handleDownloadSingleReceipt = async (salida) => {
    try {
      const [logoImg, selloImg] = await Promise.all([
        loadImage('/logo_eps2.png').catch(() => null),
        loadImage('/Sello Post Firma - CP1.png').catch(() => null)
      ]);
      await generarOrdenSalidaPDF(salida, logoImg, selloImg);
    } catch (err) {
      alert('Error al generar el acta PDF: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      
      {/* Encabezado del Módulo */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between shrink-0 mb-1">
        <div className="module-heading">
          <p className="module-kicker">Gestión de Movimientos</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">SALIDA DE BIENES</h2>
          <p className="text-sm text-slate-500">Genera y consulta actas de salida por mantenimiento, campo o eventos.</p>
        </div>

        {/* Tabs de Selección */}
        <div className="flex bg-slate-100 rounded-xl p-1 shrink-0 border border-slate-200">
          <button
            onClick={() => setTab('REGISTRAR')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'REGISTRAR'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Nueva Orden
          </button>
          <button
            onClick={() => setTab('HISTORIAL')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'HISTORIAL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Historial de Salidas
          </button>
        </div>
      </div>

      {tab === 'REGISTRAR' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-y-auto pr-1">
          
          {/* Columna Izquierda: Datos de la Orden */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Card 1: Modo de Registro */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Modo de Registro</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChangeModo('AUTOMATICO')}
                  className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-center transition-all ${
                    modo === 'AUTOMATICO'
                      ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mb-1" />
                  <span className="text-[10px]">Autogenerar</span>
                  <span className="text-[8px] opacity-75 font-normal">Datos del Sistema</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeModo('MANUAL')}
                  className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-center transition-all ${
                    modo === 'MANUAL'
                      ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Settings className="w-4 h-4 mb-1" />
                  <span className="text-[10px]">Registro Manual</span>
                  <span className="text-[8px] opacity-75 font-normal">Escribir Todo</span>
                </button>
              </div>
            </div>

            {/* Card 2: Información General */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 space-y-3.5">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5">Información General</h3>
              
              {/* Fecha y Tipo de Salida */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Tipo de Salida</label>
                  <select
                    value={tipoSalida}
                    onChange={(e) => setTipoSalida(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  >
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Trabajo de campo">Trabajo de campo</option>
                    <option value="Evento institucional">Evento inst.</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>

              {/* Motivo de Salida */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Motivo detallado *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Ej: Salida para mantenimiento correctivo del disco..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Autocompletar Responsable */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Buscar Responsable {modo === 'AUTOMATICO' ? '*' : '(Opcional)'}
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Escriba nombre del responsable..."
                    value={searchResp}
                    onChange={(e) => {
                      setSearchResp(e.target.value);
                      setShowRespSuggestions(true);
                      if (modo === 'MANUAL') {
                        setResponsable(e.target.value);
                      }
                    }}
                    onFocus={() => setShowRespSuggestions(true)}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {showRespSuggestions && searchResp.trim() !== '' && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {sugerenciasResponsables.length > 0 ? (
                      sugerenciasResponsables.map((name, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectResponsable(name)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 font-medium border-b border-slate-100 last:border-b-0"
                        >
                          {name}
                        </button>
                      ))
                    ) : (
                      <div className="p-2.5 text-xs text-slate-400 text-center">No se encontraron responsables</div>
                    )}
                  </div>
                )}
              </div>

              {/* Datos de Responsable (Editables / Autocompletados) */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Nombre Responsable *</label>
                  <input
                    type="text"
                    required
                    readOnly={modo === 'AUTOMATICO'}
                    placeholder="Nombre completo"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none ${
                      modo === 'AUTOMATICO' ? 'bg-slate-50 border-slate-200 text-slate-700 font-medium' : 'border-slate-300 focus:border-brand-500'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Cargo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: JEFE..."
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Ubicación *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: LA MERCED..."
                      value={ubicacion}
                      onChange={(e) => setUbicacion(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Datos de entrega */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5">Firmas y Adicionales</h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Resp. Cargo Salida (Área Técnica)</label>
                <input
                  type="text"
                  placeholder="Persona o área que entrega (ej: SOPORTE)"
                  value={respTecnico}
                  onChange={(e) => setRespTecnico(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Observaciones</label>
                <textarea
                  rows="1"
                  placeholder="Opcional..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

          </div>

          {/* Columna Derecha: Selección de Bienes */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 text-slate-800">
            
            {/* Buscador de Activos en modo manual */}
            {modo === 'MANUAL' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 shrink-0">
                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Buscar y agregar activo del sistema</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por código patrimonial o descripción..."
                      value={searchActivoQuery}
                      onChange={(e) => {
                        setSearchActivoQuery(e.target.value);
                        setShowActivoSuggestions(true);
                      }}
                      onFocus={() => setShowActivoSuggestions(true)}
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs focus:border-brand-500 focus:outline-none bg-slate-50"
                    />
                  </div>

                  {showActivoSuggestions && searchActivoQuery.trim() !== '' && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {sugerenciasActivos.length > 0 ? (
                        sugerenciasActivos.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleAddActivoManual(act)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                          >
                            <span className="font-semibold text-slate-900">{act.cod_patrimonial}</span>
                            <span className="text-slate-500 font-medium truncate max-w-[300px]">{act.denominacion}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{act.responsable || 'Sin asignar'}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-2.5 text-xs text-slate-400 text-center">No se encontraron activos</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Listado de Bienes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex flex-col flex-1 min-h-0">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    {modo === 'AUTOMATICO' ? 'Bienes Asignados a su Cargo' : 'Bienes de la Orden'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {modo === 'AUTOMATICO' 
                      ? 'Selecciona los bienes del responsable que saldrán de la empresa.' 
                      : 'Agrega bienes buscando en el sistema o de forma manual.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {modo === 'MANUAL' && (
                    <button
                      type="button"
                      onClick={handleAddFilaVacia}
                      className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer border-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Fila</span>
                    </button>
                  )}
                  <span className="bg-slate-100 text-slate-600 text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center">
                    {bienesSeleccionados.filter(b => b.seleccionado).length} de {bienesSeleccionados.length} Seleccionados
                  </span>
                </div>
              </div>

              {/* Tabla de Bienes */}
              <div className="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[9px] sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-center w-10">Sel</th>
                      <th className="p-2 w-32">Cód. Patrimonial</th>
                      <th className="p-2">Denominación</th>
                      <th className="p-2 w-48">Características</th>
                      <th className="p-2 w-20">Estado</th>
                      <th className="p-2 w-32">Accesorios</th>
                      <th className="p-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bienesSeleccionados.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-400 text-xs font-medium">
                          {modo === 'AUTOMATICO' 
                            ? 'Seleccione un responsable con activos asignados para cargarlos automáticamente.'
                            : 'No hay bienes en la lista. Agregue uno manualmente o búsquelo arriba.'}
                        </td>
                      </tr>
                    ) : (
                      bienesSeleccionados.map((b, idx) => (
                        <tr key={b.original_id} className={`hover:bg-slate-50/30 transition-colors ${!b.seleccionado ? 'opacity-50' : ''}`}>
                          {/* Checkbox */}
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={b.seleccionado}
                              onChange={() => handleToggleActivoAutomatico(b.original_id)}
                              className="w-4 h-4 rounded text-brand-500 focus:ring-brand-400 border-slate-300 cursor-pointer"
                            />
                          </td>

                          {/* Cód. Patrimonial */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.cod_patrimonial}
                              readOnly={modo === 'AUTOMATICO'}
                              onChange={(e) => handleUpdateBienField(idx, 'cod_patrimonial', e.target.value)}
                              placeholder="Manual"
                              className={`w-full rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:border-brand-500 font-mono ${
                                modo === 'AUTOMATICO' ? 'bg-transparent border-transparent' : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>

                          {/* Denominación */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.denominacion}
                              readOnly={modo === 'AUTOMATICO'}
                              onChange={(e) => handleUpdateBienField(idx, 'denominacion', e.target.value)}
                              placeholder="Ej: LAPTOP..."
                              className={`w-full rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:border-brand-500 font-semibold ${
                                modo === 'AUTOMATICO' ? 'bg-transparent border-transparent' : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>

                          {/* Características */}
                          <td className="p-2">
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="text"
                                value={b.color}
                                placeholder="Color"
                                onChange={(e) => handleUpdateBienField(idx, 'color', e.target.value)}
                                className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                              />
                              <input
                                type="text"
                                value={b.marca}
                                placeholder="Marca"
                                onChange={(e) => handleUpdateBienField(idx, 'marca', e.target.value)}
                                className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                              />
                              <input
                                type="text"
                                value={b.modelo}
                                placeholder="Modelo"
                                onChange={(e) => handleUpdateBienField(idx, 'modelo', e.target.value)}
                                className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                              />
                              <input
                                type="text"
                                value={b.numero_serie}
                                placeholder="Serie"
                                onChange={(e) => handleUpdateBienField(idx, 'numero_serie', e.target.value)}
                                className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                              />
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="p-2">
                            <select
                              value={b.estado_activo}
                              onChange={(e) => handleUpdateBienField(idx, 'estado_activo', e.target.value)}
                              className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                            >
                              <option value="BUENO">BUENO</option>
                              <option value="REGULAR">REGULAR</option>
                              <option value="MALO">MALO</option>
                              <option value="NUEVO">NUEVO</option>
                            </select>
                          </td>

                          {/* Accesorios */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.accesorios}
                              placeholder="Cargador, etc."
                              onChange={(e) => handleUpdateBienField(idx, 'accesorios', e.target.value)}
                              className="w-full rounded border border-slate-200 px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-brand-500 bg-white"
                            />
                          </td>

                          {/* Acciones */}
                          <td className="p-2 text-center">
                            {modo === 'MANUAL' ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveBien(idx)}
                                className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer border-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-bold font-mono">SIS</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Botonera de Acción */}
              <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={handleLimpiarFormulario}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all border-none cursor-pointer"
                >
                  Limpiar Formulario
                </button>
                <button
                  type="submit"
                  onClick={handleGenerarOrden}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white font-bold text-xs py-2 px-5 rounded-xl shadow-md transition-all cursor-pointer border-none"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Generar Orden de Salida (PDF)</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {tab === 'HISTORIAL' && (
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex flex-col min-h-0 text-slate-800">
          
          {/* Barra de Herramientas de Historial */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Salidas Registradas</h3>
              <p className="text-[11px] text-slate-500">Historial completo de salidas de bienes muebles de la empresa.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="metric-pill text-xs">
                Total órdenes: <strong>{historial.length}</strong>
              </div>
              <button
                type="button"
                onClick={handleExportHistorialExcel}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm cursor-pointer border-none"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportHistorialPDF}
                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm cursor-pointer border-none"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Exportar PDF</span>
              </button>
              <button
                type="button"
                onClick={cargarHistorial}
                title="Actualizar Historial"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg shadow-sm cursor-pointer border-none"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          <div className="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-28">N° Orden</th>
                  <th className="p-3 w-24">Fecha</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3 w-36">Tipo Salida</th>
                  <th className="p-3">Motivo de Salida</th>
                  <th className="p-3 w-24 text-center">Bienes</th>
                  <th className="p-3 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingHistorial ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-400 text-xs font-semibold">
                      <div className="flex justify-center items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                        <span>Cargando historial de salidas...</span>
                      </div>
                    </td>
                  </tr>
                ) : errorHistorial ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-rose-600 font-medium text-xs">
                      {errorHistorial}
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-400 font-medium text-xs">
                      No hay registros de salidas en el sistema.
                    </td>
                  </tr>
                ) : (
                  historial.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-900 font-mono">{s.n_orden}</td>
                      <td className="p-3 text-slate-600 font-medium">
                        {s.fecha_orden.split('-').reverse().join('/')}
                      </td>
                      <td className="p-3 text-slate-800">
                        <div className="font-semibold text-slate-900">{s.responsable.toUpperCase()}</div>
                        <div className="text-[10px] text-slate-500">{s.cargo} | {s.ubicacion}</div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.tipo_salida.toLowerCase() === 'mantenimiento' ? 'bg-blue-50 text-blue-700' :
                          s.tipo_salida.toLowerCase() === 'trabajo de campo' ? 'bg-amber-50 text-amber-700' :
                          s.tipo_salida.toLowerCase() === 'evento institucional' ? 'bg-indigo-50 text-indigo-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {s.tipo_salida}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 truncate max-w-[250px] font-medium" title={s.motivo}>
                        {s.motivo}
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          {s.bienes ? s.bienes.length : 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleReceipt(s)}
                          className="inline-flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] shadow-sm transition-all border-none cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Acta PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
