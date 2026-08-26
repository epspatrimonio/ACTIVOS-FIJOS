import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileSpreadsheet, FileText, Download, RefreshCw, Pencil, X, Check, Layers,
  Plus, Trash2, Search, UserCheck, ShieldCheck, ClipboardCheck, ArrowRight,
  LogOut, PlusCircle, ArrowLeftRight, Users, FolderOpen
} from 'lucide-react';
import { fetchSalidas, fetchPersonal, fetchSucursales, fetchPuestos, fetchActivos, createSalida } from '../utils/api';

// ──────────────────────────────────────────────────────────────────────────────
// UTILIDAD: Cargar imágenes
// ──────────────────────────────────────────────────────────────────────────────
const loadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// ──────────────────────────────────────────────────────────────────────────────
// GENERAR PDF DE ORDEN DE SALIDA
// ──────────────────────────────────────────────────────────────────────────────
const generarOrdenSalidaPDF = async (salidaData) => {
  if (!window.jspdf?.jsPDF) { alert('La librería jsPDF no está disponible.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginX = 15;
  let posY = 12;

  const [logoImg, selloImg] = await Promise.all([
    loadImage('/logo_eps2.png'),
    loadImage('/Sello Post Firma - CP1.png'),
  ]);

  // 1. Logo Mascota (18x21mm)
  if (logoImg) doc.addImage(logoImg, 'JPEG', marginX, posY, 18, 21);

  // 2. Datos de Entidad
  const textX = marginX + 21;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, posY + 5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0, 176, 240);
  doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, posY + 9.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105);
  doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, posY + 13.5);

  // 3. Fecha y N° Orden (Derecha)
  const dateParts = (salidaData.fecha_orden || '').split('-');
  const fechaFmt = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : salidaData.fecha_orden;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
  doc.text(`FECHA: ${fechaFmt}`, 195, posY + 5, { align: 'right' });
  if (salidaData.n_orden) {
    doc.setFontSize(8.5); doc.setTextColor(0, 176, 240);
    doc.text(`N° ORDEN: ${salidaData.n_orden}`, 195, posY + 10, { align: 'right' });
  }

  // 4. Línea separadora
  doc.setLineWidth(0.4); doc.setDrawColor(226, 232, 240);
  doc.line(15, posY + 22, 195, posY + 22);

  // 5. Título Principal
  posY += 32;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
  doc.text('ORDEN DE SALIDA DE BIENES', 105, posY, { align: 'center' });
  const tw = doc.getTextWidth('ORDEN DE SALIDA DE BIENES');
  doc.setLineWidth(0.6); doc.setDrawColor(0, 176, 240);
  doc.line(105 - tw / 2, posY + 1.5, 105 + tw / 2, posY + 1.5);

  posY += 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('SOLICITO', marginX, posY);
  posY += 5;
  const selectedTipo = salidaData.tipo_salida || '';
  const tipos = ['Mantenimiento', 'Trabajo de campo', 'Evento institucional', 'Otros'];
  let posX = marginX;
  tipos.forEach(t => {
    const isChecked = selectedTipo.toLowerCase() === t.toLowerCase() ||
      (t === 'Otros' && !['mantenimiento', 'trabajo de campo', 'evento institucional'].includes(selectedTipo.toLowerCase()));
    doc.setLineWidth(0.3); doc.setDrawColor(100, 100, 100); doc.setFillColor(255, 255, 255);
    doc.circle(posX + 2, posY - 1.5, 1.8, 'FD');
    if (isChecked) { doc.setFillColor(0, 176, 240); doc.circle(posX + 2, posY - 1.5, 1, 'FD'); }
    doc.setFont('helvetica', isChecked ? 'bold' : 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text(t, posX + 6, posY - 0.5);
    posX += 44;
  });

  posY += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('MOTIVO', marginX, posY);
  posY += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
  const splitMotivo = doc.splitTextToSize((salidaData.motivo || '').trim().toUpperCase(), 180);
  doc.text(splitMotivo, marginX, posY);
  posY += splitMotivo.length * 4 + 2;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('TITULAR DEL BIEN', marginX, posY);
  posY += 3;
  doc.autoTable({
    body: [
      [{ content: 'RESPONSABLE:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, (salidaData.responsable || '').toUpperCase()],
      [{ content: 'CARGO:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, (salidaData.cargo || '').toUpperCase()],
      [{ content: 'UBICACIÓN-DEPENDENCIA:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, (salidaData.ubicacion || '').toUpperCase()],
    ],
    startY: posY, theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    margin: { left: marginX, right: marginX },
  });
  posY = doc.lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('DESCRIPCIÓN DEL BIEN', marginX, posY);
  posY += 3;
  const headers = [
    [
      { content: 'N°', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      { content: 'DENOMINACIÓN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      { content: 'CARACTERÍSTICAS DEL BIEN', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'ESTADO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      { content: 'ACCESORIOS', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
    ],
    [
      { content: 'COLOR', styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'MARCA', styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'MODELO', styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'SERIE', styles: { halign: 'center', fontStyle: 'bold' } },
    ],
  ];
  const bienes = salidaData.bienes || [];
  doc.autoTable({
    head: headers,
    body: bienes.map((b, idx) => [
      idx + 1, (b.denominacion || '').toUpperCase(),
      (b.color || 'NEGRO').toUpperCase(), (b.marca || 'S/M').toUpperCase(),
      (b.modelo || 'S/M').toUpperCase(), (b.numero_serie || 'S/S').toUpperCase(),
      (b.estado_activo || 'BUENO').toUpperCase(), (b.accesorios || '—').toUpperCase(),
    ]),
    startY: posY, theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
    headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 38 },
      2: { cellWidth: 18 }, 3: { cellWidth: 20 }, 4: { cellWidth: 22 },
      5: { cellWidth: 28 }, 6: { cellWidth: 18, halign: 'center' }, 7: { cellWidth: 24 },
    },
    margin: { left: marginX, right: marginX },
  });
  posY = doc.lastAutoTable.finalY + 6;

  const obsText = salidaData.observaciones ? salidaData.observaciones.trim().toUpperCase() : 'SIN OBSERVACIONES ADICIONALES.';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('OBSERVACIONES:', marginX, posY);
  posY += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
  const splitObs = doc.splitTextToSize(obsText, 180);
  doc.text(splitObs, marginX, posY);
  posY += splitObs.length * 4 + 6;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
  doc.text('NOTA', marginX, posY);
  posY += 3.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(30, 41, 59);
  const notaText = 'EL TRABAJADOR ES RESPONSABLE DIRECTO Y ABSOLUTO DE LA EXISTENCIA, PERMANENCIA, CONSERVACIÓN DEL BIEN EN USO, EVITAR PERDIDA, SUSTRACCIÓN, DETERIODO ETC. EN CASO DE PÉRDIDA, EXTRAVIO O DETERIORO POR EL MAL USO DE LOS BIENES PATRIMONIALES DESCRITOS, ESTOS SERÁN REPUESTOS O REPARADOS POR EL TRABAJADOR RESPONSABLE DE LOS MISMOS. CUALQUIER MOVIMIENTOS DENTRO O FUERA DE LA ENTIDAD DEBERA SER COMUNICADO AL RESPONSABLE DE CONTROL PATRIMONIAL, BAJO RESPONSABILIDAD.';
  const splitNota = doc.splitTextToSize(notaText, 180);
  doc.text(splitNota, marginX, posY);

  const pageHeight = doc.internal.pageSize.height;
  const yLine = pageHeight - 35;
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.25);
  doc.line(15, yLine, 65, yLine);
  doc.line(80, yLine, 130, yLine);
  doc.line(145, yLine, 195, yLine);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('TITULAR DEL BIEN', 40, yLine + 4, { align: 'center' });
  const cargoSalidaText = salidaData.resp_tecnico ? salidaData.resp_tecnico.trim().toUpperCase() : 'ÁREA TÉCNICA';
  doc.text('RESPONSABLE A CARGO DE SALIDA', 105, yLine + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.text(`(${cargoSalidaText})`, 105, yLine + 7.5, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.text('CONTROL PATRIMONIAL', 170, yLine + 4, { align: 'center' });
  if (selloImg) doc.addImage(selloImg, 'PNG', 147, yLine - 22, 45, 20);

  const sanitize = (salidaData.responsable || 'RESPONSABLE').replace(/\s+/g, '_').toUpperCase();
  doc.save(`Orden_Salida_${salidaData.n_orden || 'SN'}_${sanitize}.pdf`);
};

// ──────────────────────────────────────────────────────────────────────────────
// MODAL DE EDICIÓN
// ──────────────────────────────────────────────────────────────────────────────
function EditModal({ salida, onClose, onSave }) {
  const [form, setForm] = useState({
    fecha_orden: salida.fecha_orden || '',
    tipo_salida: salida.tipo_salida || 'Mantenimiento',
    motivo: salida.motivo || '',
    responsable: salida.responsable || '',
    cargo: salida.cargo || '',
    ubicacion: salida.ubicacion || '',
    resp_tecnico: salida.resp_tecnico || '',
    observaciones: salida.observaciones || '',
  });
  const [sucursales, setSucursales] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSucursales()
      .then(data => {
        if (Array.isArray(data)) {
          setSucursales(data.map(s => s.label || s.sucursal).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.responsable.trim() || !form.motivo.trim()) {
      alert('Responsable y motivo son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/activos/salidas/${salida.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
      onSave();
    } catch (err) {
      alert('Error al guardar los cambios: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none';
  const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Editar Orden de Salida</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">N° {salida.n_orden}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-none">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de la Orden</label>
              <input type="date" value={form.fecha_orden} onChange={e => setForm(f => ({ ...f, fecha_orden: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de Salida</label>
              <select value={form.tipo_salida} onChange={e => setForm(f => ({ ...f, tipo_salida: e.target.value }))} className={inputCls}>
                <option>Mantenimiento</option>
                <option>Trabajo de campo</option>
                <option>Evento institucional</option>
                <option>Otros</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Motivo detallado *</label>
            <textarea rows={2} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} className={inputCls} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className={labelCls}>Responsable *</label>
            <input type="text" value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cargo</label>
              <input type="text" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ubicación / Dependencia</label>
              <select value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} className={inputCls}>
                <option value="">-- Seleccionar --</option>
                {sucursales.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Resp. Área Técnica (Firma)</label>
            <input type="text" value={form.resp_tecnico} onChange={e => setForm(f => ({ ...f, resp_tecnico: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inputCls} style={{ resize: 'none' }} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border-none">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all cursor-pointer border-none disabled:opacity-60">
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FORMULARIO NATIVO REACT DE REGISTRO
// ──────────────────────────────────────────────────────────────────────────────
function SalidaBienesForm({ onSuccess }) {
  const [modo, setModo] = useState('SISTEMA'); // 'SISTEMA' | 'MANUAL'
  const [fechaOrden, setFechaOrden] = useState(new Date().toISOString().split('T')[0]);
  const [tipoSalida, setTipoSalida] = useState('Mantenimiento');
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [cargo, setCargo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [respTecnico, setRespTecnico] = useState('ÁREA TÉCNICA');
  const [observaciones, setObservaciones] = useState('');
  
  const [bienes, setBienes] = useState([]);
  const [allActivos, setAllActivos] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  
  const [searchActivo, setSearchActivo] = useState('');
  const [showActivoSug, setShowActivoSug] = useState(false);
  const [showRespSug, setShowRespSug] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchActivos().catch(() => []),
      fetchPersonal().catch(() => []),
      fetchSucursales().catch(() => []),
    ]).then(([activosData, personalData, sucursalesData]) => {
      setAllActivos(activosData || []);
      if (Array.isArray(personalData)) {
        setPersonalList(personalData.map(p => (p.label || p.personal || '').trim().toUpperCase()).filter(Boolean));
      }
      if (Array.isArray(sucursalesData)) {
        const EXCLUDED = new Set(['SELVA CENTRAL', 'EPS SELVA CENTRAL', 'SELVA CENTRAL S.A.', 'RETIRADAS', 'SIN ASIGNAR']);
        setSucursalesList(sucursalesData.map(s => (s.label || s.sucursal || '').trim().toUpperCase()).filter(s => s && !EXCLUDED.has(s)));
      }
    });
  }, []);

  const handleSelectResponsable = (name) => {
    setResponsable(name);
    setShowRespSug(false);
    if (modo === 'SISTEMA' && name) {
      const words = name.split(/\s+/).filter(Boolean);
      const assigned = allActivos.filter(a => {
        const r = (a.responsable || '').trim().toUpperCase();
        return words.every(w => r.includes(w));
      });
      if (assigned.length > 0) {
        setBienes(assigned.map(a => ({
          cod_patrimonial: a.cod_patrimonial || '',
          denominacion: a.denominacion || '',
          color: a.color || 'NEGRO',
          marca: a.marca || 'S/M',
          modelo: a.modelo || 'S/M',
          numero_serie: a.numero_serie || 'S/S',
          estado_activo: a.estado_activo || 'BUENO',
          accesorios: '',
          seleccionado: true
        })));
        if (assigned[0].puesto) setCargo(assigned[0].puesto.toUpperCase());
        if (assigned[0].sucursal) setUbicacion(assigned[0].sucursal.toUpperCase());
      }
    }
  };

  const handleAddActivo = (item) => {
    if (bienes.some(b => b.cod_patrimonial === item.cod_patrimonial)) {
      alert('Este bien ya ha sido agregado a la orden.');
      return;
    }
    setBienes(prev => [...prev, {
      cod_patrimonial: item.cod_patrimonial || '',
      denominacion: item.denominacion || '',
      color: item.color || 'NEGRO',
      marca: item.marca || 'S/M',
      modelo: item.modelo || 'S/M',
      numero_serie: item.numero_serie || 'S/S',
      estado_activo: item.estado_activo || 'BUENO',
      accesorios: '',
      seleccionado: true
    }]);
    setSearchActivo('');
    setShowActivoSug(false);
  };

  const handleAddManualRow = () => {
    setBienes(prev => [...prev, {
      cod_patrimonial: '',
      denominacion: '',
      color: 'NEGRO',
      marca: 'S/M',
      modelo: 'S/M',
      numero_serie: 'S/S',
      estado_activo: 'BUENO',
      accesorios: '',
      isManual: true,
      seleccionado: true
    }]);
  };

  const handleRemoveBien = (index) => {
    setBienes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fechaOrden || !responsable.trim() || !cargo.trim() || !ubicacion.trim() || !motivo.trim()) {
      alert('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    const bienesAEnviar = bienes.filter(b => b.seleccionado !== false);
    if (bienesAEnviar.length === 0) {
      alert('Por favor seleccione al menos un bien patrimonial para la orden de salida.');
      return;
    }

    for (let i = 0; i < bienesAEnviar.length; i++) {
      if (!bienesAEnviar[i].denominacion || !bienesAEnviar[i].denominacion.trim()) {
        alert(`Por favor ingrese la denominación para el bien N° ${i + 1}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        fecha_orden: fechaOrden,
        tipo_salida: tipoSalida,
        motivo: motivo.trim(),
        responsable: responsable.trim().toUpperCase(),
        cargo: cargo.trim().toUpperCase(),
        ubicacion: ubicacion.trim().toUpperCase(),
        resp_tecnico: respTecnico.trim().toUpperCase() || null,
        observaciones: observaciones.trim() || null,
        bienes: bienesAEnviar.map(b => ({
          cod_patrimonial: b.cod_patrimonial || null,
          denominacion: b.denominacion,
          color: b.color || null,
          marca: b.marca || null,
          modelo: b.modelo || null,
          numero_serie: b.numero_serie || null,
          estado_activo: b.estado_activo || 'BUENO',
          accesorios: b.accesorios || null
        }))
      };

      const result = await createSalida(payload);
      await generarOrdenSalidaPDF(result);
      alert(`Orden de Salida ${result.n_orden || ''} registrada y descargada exitosamente.`);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Error al registrar la orden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 bg-white text-slate-800 transition-all';
  const labelCls = 'block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6">
      
      {/* Selector de Modo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-150">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Nueva Orden de Salida</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Seleccione la modalidad de registro e ingrese los datos correspondientes.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => { setModo('SISTEMA'); setBienes([]); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border-none ${
              modo === 'SISTEMA' ? 'bg-brand-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            💻 Desde Sistema
          </button>
          <button
            type="button"
            onClick={() => { setModo('MANUAL'); setBienes([{ isManual: true, seleccionado: true, denominacion: '', color: 'NEGRO', marca: 'S/M', modelo: 'S/M', numero_serie: 'S/S', estado_activo: 'BUENO' }]); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border-none ${
              modo === 'MANUAL' ? 'bg-brand-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            ✍️ Ingreso Manual Libre
          </button>
        </div>
      </div>

      {/* Datos Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>Fecha de la Orden *</label>
          <input type="date" value={fechaOrden} onChange={e => setFechaOrden(e.target.value)} className={inputCls} required />
        </div>
        <div className="md:col-span-3">
          <label className={labelCls}>Tipo de Salida *</label>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {['Mantenimiento', 'Trabajo de campo', 'Evento institucional', 'Otros'].map(t => (
              <label key={t} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tipoSalida"
                  value={t}
                  checked={tipoSalida === t}
                  onChange={e => setTipoSalida(e.target.value)}
                  className="w-4 h-4 text-brand-500 border-slate-300 focus:ring-brand-500"
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Motivo Detallado de la Salida *</label>
        <textarea
          rows={2}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ingrese el motivo o destino de los bienes..."
          className={inputCls}
          style={{ resize: 'none' }}
          required
        />
      </div>

      {/* Titular del Bien */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-150 pb-1.5">Titular del Bien</h4>
        
        <div className="relative">
          <label className={labelCls}>NOMBRE RESPONSABLE *</label>
          <input
            type="text"
            value={responsable}
            onChange={e => {
              setResponsable(e.target.value);
              setShowRespSug(true);
            }}
            onFocus={() => setShowRespSug(true)}
            placeholder="Escriba para filtrar responsable..."
            className={inputCls}
            required
          />
          {showRespSug && responsable.trim() && (
            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
              {(() => {
                const words = responsable.trim().toUpperCase().split(/\s+/).filter(Boolean);
                const matches = personalList.filter(name => words.every(w => name.includes(w))).slice(0, 10);
                if (matches.length === 0) return null;
                return matches.map(name => (
                  <div
                    key={name}
                    onClick={() => handleSelectResponsable(name)}
                    className="p-2.5 hover:bg-brand-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-100 last:border-b-0"
                  >
                    {name}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>PUESTO *</label>
            <input
              type="text"
              value={cargo}
              onChange={e => setCargo(e.target.value)}
              placeholder="Escriba puesto..."
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className={labelCls}>SUCURSAL *</label>
            <select value={ubicacion} onChange={e => setUbicacion(e.target.value)} className={inputCls} required>
              <option value="">-- Seleccionar Sucursal --</option>
              {sucursalesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Búsqueda o Agregado de Bienes */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Descripción de los Bienes Patrimoniales ({bienes.length})
          </h4>
          {modo === 'SISTEMA' ? (
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchActivo}
                onChange={e => { setSearchActivo(e.target.value); setShowActivoSug(true); }}
                onFocus={() => setShowActivoSug(true)}
                placeholder="🔍 Buscar por Código o Descripción..."
                className={inputCls}
              />
              {showActivoSug && searchActivo.trim() && (
                <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {allActivos
                    .filter(a =>
                      (a.cod_patrimonial || '').toUpperCase().includes(searchActivo.trim().toUpperCase()) ||
                      (a.denominacion || '').toUpperCase().includes(searchActivo.trim().toUpperCase())
                    )
                    .slice(0, 8)
                    .map(a => (
                      <div
                        key={a.id || a.cod_patrimonial}
                        onClick={() => handleAddActivo(a)}
                        className="p-2.5 hover:bg-brand-50 cursor-pointer text-xs border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-extrabold text-brand-600 font-mono">{a.cod_patrimonial}</div>
                        <div className="font-semibold text-slate-800 truncate">{a.denominacion}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddManualRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition-all cursor-pointer border border-brand-200"
            >
              <Plus className="w-3.5 h-3.5" /> + Agregar Bien Manual
            </button>
          )}
        </div>

        {/* Tabla de Bienes */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
              <tr>
                {modo === 'SISTEMA' && <th className="p-2.5 w-10 text-center">Inc.</th>}
                <th className="p-2.5 w-12 text-center">N°</th>
                <th className="p-2.5 w-32">Cód. Patrimonial</th>
                <th className="p-2.5">Denominación / Descripción *</th>
                <th className="p-2.5 w-24">Color</th>
                <th className="p-2.5 w-28">Marca</th>
                <th className="p-2.5 w-28">Modelo</th>
                <th className="p-2.5 w-28">Serie</th>
                <th className="p-2.5 w-24 text-center">Estado</th>
                <th className="p-2.5 w-12 text-center">Quitar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bienes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 font-medium">
                    No se han agregado bienes a la orden. Seleccione un responsable arriba o busque un bien.
                  </td>
                </tr>
              ) : (
                bienes.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors align-middle">
                    {modo === 'SISTEMA' && (
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={b.seleccionado !== false}
                          onChange={e => {
                            const updated = [...bienes];
                            updated[idx].seleccionado = e.target.checked;
                            setBienes(updated);
                          }}
                          className="w-4 h-4 text-brand-500 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-2.5 text-center font-bold text-slate-500 text-[11px]">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-brand-600">
                      {b.isManual ? (
                        <input
                          type="text"
                          value={b.cod_patrimonial}
                          onChange={e => {
                            const updated = [...bienes];
                            updated[idx].cod_patrimonial = e.target.value;
                            setBienes(updated);
                          }}
                          placeholder="Opcional"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 font-mono"
                        />
                      ) : (
                        b.cod_patrimonial || '—'
                      )}
                    </td>
                    <td className="p-2.5">
                      {b.isManual ? (
                        <input
                          type="text"
                          value={b.denominacion}
                          onChange={e => {
                            const updated = [...bienes];
                            updated[idx].denominacion = e.target.value;
                            setBienes(updated);
                          }}
                          placeholder="Ej: LAPTOP LENOVO..."
                          className="w-full px-2 py-1 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                          required
                        />
                      ) : (
                        <span className="font-semibold text-slate-800">{b.denominacion}</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={b.color || ''}
                        onChange={e => {
                          const updated = [...bienes];
                          updated[idx].color = e.target.value;
                          setBienes(updated);
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={b.marca || ''}
                        onChange={e => {
                          const updated = [...bienes];
                          updated[idx].marca = e.target.value;
                          setBienes(updated);
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={b.modelo || ''}
                        onChange={e => {
                          const updated = [...bienes];
                          updated[idx].modelo = e.target.value;
                          setBienes(updated);
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={b.numero_serie || ''}
                        onChange={e => {
                          const updated = [...bienes];
                          updated[idx].numero_serie = e.target.value;
                          setBienes(updated);
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <select
                        value={b.estado_activo || 'BUENO'}
                        onChange={e => {
                          const updated = [...bienes];
                          updated[idx].estado_activo = e.target.value;
                          setBienes(updated);
                        }}
                        className="px-2 py-1 text-[11px] font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      >
                        <option value="BUENO">BUENO</option>
                        <option value="REGULAR">REGULAR</option>
                        <option value="MALO">MALO</option>
                      </select>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveBien(idx)}
                        className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer border-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firmas y Observaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Resp. Área Técnica / Firma de Salida</label>
          <input
            type="text"
            value={respTecnico}
            onChange={e => setRespTecnico(e.target.value)}
            placeholder="Ej: ÁREA TÉCNICA / INGENIERÍA"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Observaciones Adicionales</label>
          <input
            type="text"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Ej: Salida autorizada para mantenimiento correctivo..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="flex items-center justify-end pt-4 border-t border-slate-150">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-extrabold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer border-none disabled:opacity-60"
        >
          <FileText className="w-4 h-4" />
          {loading ? 'Generando y Guardando...' : 'Generar y Descargar Orden de Salida (PDF)'}
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL – Historial y Registro Nativo
// ──────────────────────────────────────────────────────────────────────────────
export default function SalidaBienesPanel({ initialSubTab = 'MODULE' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'MODULE' | 'TABLE'
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');
  const [sucursalesOptions, setSucursalesOptions] = useState([]);

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    fetchSucursales().then(data => {
      if (Array.isArray(data)) {
        const EXCLUDED = new Set(['SELVA CENTRAL', 'EPS SELVA CENTRAL', 'SELVA CENTRAL S.A.', 'RETIRADAS', 'SIN ASIGNAR']);
        const opts = data.map(s => (s.label || s.sucursal || '').trim().toUpperCase()).filter(s => s && !EXCLUDED.has(s));
        setSucursalesOptions([...new Set(opts)].sort());
      }
    }).catch(() => {});
  }, []);

  const cargarHistorial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSalidas();
      setHistorial(data);
    } catch (err) {
      setError(err.message || 'Error al cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const historialFiltrado = historial.filter(s => {
    if (filtroSucursal !== 'Todas' && (s.ubicacion || '').trim().toUpperCase() !== filtroSucursal) {
      return false;
    }
    return true;
  });

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const handleExcelExport = () => {
    if (!window.XLSX) { alert('La librería SheetJS no está cargada.'); return; }
    const data = historialFiltrado.map(s => ({
      'N° Orden': s.n_orden,
      'Fecha': s.fecha_orden,
      'Tipo de Salida': s.tipo_salida,
      'Responsable': s.responsable,
      'Cargo / Puesto': s.cargo,
      'Sucursal / Ubicación': s.ubicacion,
      'Motivo de Salida': s.motivo,
      'Resp. Técnico Salida': s.resp_tecnico || '—',
      'Cantidad de Bienes': s.bienes ? s.bienes.length : 0,
      'Observaciones': s.observaciones || '—',
    }));
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Historial Salidas');
    window.XLSX.writeFile(wb, `Historial_Salidas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Exportar PDF masivo ───────────────────────────────────────────────────
  const handlePDFExport = () => {
    if (!window.jspdf?.jsPDF) { alert('La librería jsPDF no está cargada.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('EPS SELVA CENTRAL - CONTROL PATRIMONIAL', 14, 15);
    doc.setFontSize(11);
    doc.text('HISTORIAL GENERAL DE SALIDAS DE BIENES MUEBLES', 14, 21);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 27);
    doc.autoTable({
      startY: 32,
      head: [['N° Orden', 'Fecha', 'Responsable', 'Cargo / Dependencia', 'Tipo Salida', 'Motivo de Salida', 'Bienes']],
      body: historialFiltrado.map(s => [
        s.n_orden,
        (s.fecha_orden || '').split('-').reverse().join('/'),
        (s.responsable || '').toUpperCase(),
        `${(s.cargo || '').toUpperCase()} (${(s.ubicacion || '').toUpperCase()})`,
        (s.tipo_salida || '').toUpperCase(),
        s.motivo,
        s.bienes ? s.bienes.length : 0,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' }, 1: { cellWidth: 22 },
        2: { cellWidth: 48 }, 3: { cellWidth: 55 },
        4: { cellWidth: 32 }, 5: { cellWidth: 80 },
        6: { cellWidth: 15, halign: 'center' },
      },
    });
    doc.save(`Historial_Salidas_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const tipoBadge = (tipo) => {
    const map = {
      mantenimiento: 'bg-blue-50 text-blue-700 border border-blue-100',
      'trabajo de campo': 'bg-amber-50 text-amber-700 border border-amber-100',
      'evento institucional': 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    };
    return map[(tipo || '').toLowerCase()] || 'bg-slate-100 text-slate-600';
  };

  return (
    <>
      {editando && (
        <EditModal
          salida={editando}
          onClose={() => setEditando(null)}
          onSave={() => { setEditando(null); cargarHistorial(); }}
        />
      )}

      <div className="flex-1 flex flex-col space-y-4 animate-fadeIn w-full max-w-full overflow-y-auto smooth-scroll pr-1 pb-8">

        {/* Encabezado del módulo */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between shrink-0 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-brand-500 uppercase tracking-widest">Control Patrimonial</p>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              ORDEN DE SALIDA DE BIENES
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Genera nuevas órdenes de salida y consulta el historial registrado.
            </p>
          </div>

          {/* Sub-Pestañas de Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('MODULE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                activeSubTab === 'MODULE'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              Registro y Gestión
            </button>
            <button
              onClick={() => setActiveSubTab('TABLE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                activeSubTab === 'TABLE'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              Tablas y Consultas
            </button>
          </div>

          {/* Herramientas (Solo en Vista Tabular) */}
          {activeSubTab === 'TABLE' && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Sucursal:</span>
                <select
                  value={filtroSucursal}
                  onChange={e => setFiltroSucursal(e.target.value)}
                  className="rounded-xl border border-slate-200 py-1.5 px-3 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 transition-all"
                >
                  <option value="Todas">Todas las Sucursales</option>
                  {sucursalesOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">
                  {historialFiltrado.length}&nbsp;<span className="font-normal text-slate-500">órdenes</span>
                </span>
              </div>
              <button
                type="button" onClick={handleExcelExport}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer border-none"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
              </button>
              <button
                type="button" onClick={handlePDFExport}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer border-none"
              >
                <FileText className="w-3.5 h-3.5" /> Exportar PDF
              </button>
              <button
                type="button" onClick={cargarHistorial} title="Actualizar historial"
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl shadow-sm border border-slate-200 cursor-pointer transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-500' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Formulario Nativo React */}
        {activeSubTab === 'MODULE' ? (
          <SalidaBienesForm onSuccess={() => { cargarHistorial(); setActiveSubTab('TABLE'); }} />
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#004C96] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="p-3 w-28">N° Orden</th>
                  <th className="p-3 w-24">Fecha</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3 w-36">Tipo Salida</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3 w-20 text-center">Bienes</th>
                  <th className="p-3 w-40 text-center">Devolución / Estado</th>
                  <th className="p-3 w-36 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400 font-medium">
                      <div className="flex justify-center items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                        <span>Cargando historial...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={8} className="p-10 text-center text-rose-600 font-semibold">{error}</td></tr>
                )}
                {!loading && !error && historialFiltrado.length === 0 && (
                  <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-medium">No hay registros de salidas en el sistema.</td></tr>
                )}
                {!loading && !error && historialFiltrado.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors align-middle">
                    <td className="p-3 font-black text-brand-600 font-mono text-sm">{s.n_orden}</td>
                    <td className="p-3 text-slate-600 font-semibold">
                      {(s.fecha_orden || '').split('-').reverse().join('/')}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 text-[11px]">{(s.responsable || '').toUpperCase()}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.cargo} · {s.ubicacion}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${tipoBadge(s.tipo_salida)}`}>
                        {s.tipo_salida}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 max-w-[260px] truncate font-medium" title={s.motivo}>
                      {s.motivo}
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                        {s.bienes ? s.bienes.length : 0}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <select
                        value={s.estado_devolucion || 'SALIDA'}
                        onChange={async (e) => {
                          const newEstado = e.target.value;
                          let newObs = s.obs_devolucion || '';
                          if (newEstado === 'OBSERVADO') {
                            const userObs = prompt('Ingrese la observación del retorno:', s.obs_devolucion || '');
                            if (userObs !== null) newObs = userObs.trim();
                          } else {
                            newObs = '';
                          }
                          try {
                            const res = await fetch(`/api/activos/salidas/${s.id}/devolucion`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ estado_devolucion: newEstado, obs_devolucion: newObs })
                            });
                            if (res.ok) {
                              setHistorial(prev => prev.map(item => item.id === s.id ? { ...item, estado_devolucion: newEstado, obs_devolucion: newObs } : item));
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer focus:outline-none ${
                          s.estado_devolucion === 'REGRESO' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                          s.estado_devolucion === 'OBSERVADO' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                          'bg-blue-50 text-blue-700 border-blue-300'
                        }`}
                      >
                        <option value="SALIDA">🔴 SALIDA</option>
                        <option value="REGRESO">🟢 REGRESO</option>
                        <option value="OBSERVADO">🟠 OBSERVADO</option>
                      </select>
                      {(s.estado_devolucion === 'OBSERVADO' || s.obs_devolucion) && (
                        <div
                          title={s.obs_devolucion ? `Observación: ${s.obs_devolucion}` : 'Clic para editar'}
                          onClick={async () => {
                            const userObs = prompt('Editar observación de retorno:', s.obs_devolucion || '');
                            if (userObs !== null) {
                              const newObs = userObs.trim();
                              try {
                                const res = await fetch(`/api/activos/salidas/${s.id}/devolucion`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ estado_devolucion: s.estado_devolucion || 'OBSERVADO', obs_devolucion: newObs })
                                });
                                if (res.ok) {
                                  setHistorial(prev => prev.map(item => item.id === s.id ? { ...item, obs_devolucion: newObs } : item));
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                          className="text-[9px] text-amber-700 italic mt-1 max-w-[130px] truncate cursor-pointer font-medium hover:underline mx-auto"
                        >
                          {s.obs_devolucion ? `💬 ${s.obs_devolucion}` : '+ Agregar obs.'}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="Descargar Acta PDF"
                          onClick={() => generarOrdenSalidaPDF(s)}
                          className="flex items-center gap-1 bg-slate-900 hover:bg-slate-700 text-white font-bold py-1.5 px-2.5 rounded-lg text-[10px] shadow-sm transition-all cursor-pointer border-none"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                        <button
                          type="button"
                          title="Editar registro"
                          onClick={() => setEditando(s)}
                          className="flex items-center gap-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 font-bold py-1.5 px-2.5 rounded-lg text-[10px] transition-all cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </>
  );
}
