import React, { useState, useEffect } from 'react';
import { Save, Plus, FileText, CheckCircle2, AlertCircle, ChevronDown, Edit3 } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Modal from './Modal';
import { 
  fetchCompras, fetchIncorporaciones, createCompra, createIncorporacion,
  fetchLocalidades, fetchCuentasContables, fetchCentrosCosto, fetchFuentes, fetchPersonal,
  renameCompra, renameIncorporacion,
  fetchObras, createObra, renameObra
} from '../utils/api';

export default function DocumentosPanel() {
  const [docType, setDocType] = useState('COMPRA'); // COMPRA | INCORPORACION | OBRA
  const [compras, setCompras] = useState([]);
  const [incorporaciones, setIncorporaciones] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // Renombrar Documento
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newDocNum, setNewDocNum] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState(null);

  // Filtros de la lista de expedientes
  const [tableFilters, setTableFilters] = useState({
    id_localidad: '',
    fecha_desde: '',
    fecha_hasta: '',
    cuenta_contable: '',
  });

  // Combos
  const [localidades, setLocalidades] = useState([]);
  const [cuentasContables, setCuentasContables] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [fuentes, setFuentes] = useState([]);
  const [personal, setPersonal] = useState([]);

  // Form states
  const [compraForm, setCompraForm] = useState({
    n_doc: '',
    fecha_oc: '',
    id_localidad: '101',
    nota_pedido: '',
    certificacion_presupuestal: '',
    cuenta_contable: '',
    centro_costo: '',
    id_fuente: '',
    requerido_por: '',
    concepto: '',
  });

  const [incForm, setIncForm] = useState({
    n_doc: '',
    fecha_doc: '',
    id_localidad: '101',
    cuenta_contable: '',
    centro_costo: '',
    id_fuente: '',
    fuente_origen: '',
    origen: '',
    fecha_alta: '',
    concepto: '',
  });

  const [obraForm, setObraForm] = useState({
    n_doc: '',
    fecha_doc: '',
    id_localidad: '101',
    cuenta_contable: '',
    centro_costo: '',
    id_fuente: '',
    fuente_origen: '',
    origen: '',
    fecha_alta: '',
    concepto: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cps, incs, obrs, locs, ctas, ccs, ftes, pers] = await Promise.all([
        fetchCompras(),
        fetchIncorporaciones(),
        fetchObras(),
        fetchLocalidades(),
        fetchCuentasContables(),
        fetchCentrosCosto(),
        fetchFuentes(),
        fetchPersonal()
      ]);
      setCompras(cps);
      setIncorporaciones(incs);
      setObras(obrs);
      setLocalidades(locs);
      setCuentasContables(ctas);
      setCentrosCosto(ccs);
      setFuentes(ftes);
      setPersonal(pers);
    } catch (err) {
      setError('Error al cargar la información del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompraChange = (e) => {
    const { name, value } = e.target;
    setCompraForm(prev => ({ ...prev, [name]: value }));
  };

  const handleIncChange = (e) => {
    const { name, value } = e.target;
    setIncForm(prev => ({ ...prev, [name]: value }));
  };

  const handleObraChange = (e) => {
    const { name, value } = e.target;
    setObraForm(prev => ({ ...prev, [name]: value }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  const formatDocNum = (n_doc, type) => {
    if (!n_doc) return '';
    let prefix = '';
    if (type === 'COMPRA') prefix = 'OC-';
    else if (type === 'INCORPORACION') prefix = 'INC-';
    else if (type === 'OBRA') prefix = 'OBR-';
    if (n_doc.startsWith(prefix)) {
      return n_doc;
    }
    return `${prefix}${n_doc}`;
  };

  const handleEditDoc = (type, doc) => {
    setEditingDoc(doc);
    setDocType(type);
    if (type === 'COMPRA') {
      setCompraForm({
        n_doc: doc.n_doc || '',
        fecha_oc: doc.fecha_oc ? doc.fecha_oc.split('T')[0] : '',
        id_localidad: doc.id_localidad !== undefined && doc.id_localidad !== null ? String(doc.id_localidad) : '',
        nota_pedido: doc.nota_pedido || '',
        certificacion_presupuestal: doc.certificacion_presupuestal || '',
        cuenta_contable: doc.cuenta_contable || '',
        centro_costo: doc.centro_costo || '',
        id_fuente: doc.id_fuente !== undefined && doc.id_fuente !== null ? String(doc.id_fuente) : '',
        requerido_por: doc.requerido_por || '',
        concepto: doc.concepto || '',
      });
    } else if (type === 'INCORPORACION') {
      setIncForm({
        n_doc: doc.n_doc || '',
        fecha_doc: doc.fecha_doc ? doc.fecha_doc.split('T')[0] : '',
        id_localidad: doc.id_localidad !== undefined && doc.id_localidad !== null ? String(doc.id_localidad) : '',
        cuenta_contable: doc.cuenta_contable || '',
        centro_costo: doc.centro_costo || '',
        id_fuente: doc.id_fuente !== undefined && doc.id_fuente !== null ? String(doc.id_fuente) : '',
        fuente_origen: doc.fuente_origen || '',
        origen: doc.origen || '',
        fecha_alta: doc.fecha_alta ? doc.fecha_alta.split('T')[0] : '',
        concepto: doc.concepto || '',
      });
    } else {
      setObraForm({
        n_doc: doc.n_doc || '',
        fecha_doc: doc.fecha_doc ? doc.fecha_doc.split('T')[0] : '',
        id_localidad: doc.id_localidad !== undefined && doc.id_localidad !== null ? String(doc.id_localidad) : '',
        cuenta_contable: doc.cuenta_contable || '',
        centro_costo: doc.centro_costo || '',
        id_fuente: doc.id_fuente !== undefined && doc.id_fuente !== null ? String(doc.id_fuente) : '',
        fuente_origen: doc.fuente_origen || '',
        origen: doc.origen || '',
        fecha_alta: doc.fecha_alta ? doc.fecha_alta.split('T')[0] : '',
        concepto: doc.concepto || '',
      });
    }
    setShowForm(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditingDoc(null);
    setCompraForm({
      n_doc: '',
      fecha_oc: '',
      id_localidad: '101',
      nota_pedido: '',
      certificacion_presupuestal: '',
      cuenta_contable: '',
      centro_costo: '',
      id_fuente: '',
      requerido_por: '',
      concepto: '',
    });
    setIncForm({
      n_doc: '',
      fecha_doc: '',
      id_localidad: '101',
      cuenta_contable: '',
      centro_costo: '',
      id_fuente: '',
      fuente_origen: '',
      origen: '',
      fecha_alta: '',
      concepto: '',
    });
    setObraForm({
      n_doc: '',
      fecha_doc: '',
      id_localidad: '101',
      cuenta_contable: '',
      centro_costo: '',
      id_fuente: '',
      fuente_origen: '',
      origen: '',
      fecha_alta: '',
      concepto: '',
    });
    setShowForm(false);
    setError(null);
    setSuccess(false);
  };

  const handleCompraSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
      
      const nDocClean = cleanDigits(compraForm.n_doc);
      if (nDocClean.length !== 7) {
        throw new Error('El N° de Documento debe tener exactamente 7 dígitos (números).');
      }

      const notaPedidoClean = cleanDigits(compraForm.nota_pedido);
      if (notaPedidoClean && notaPedidoClean.length !== 7) {
        throw new Error('La Nota de Pedido debe tener exactamente 7 dígitos (números).');
      }

      const certClean = cleanDigits(compraForm.certificacion_presupuestal);
      if (certClean && certClean.length < 4) {
        throw new Error('La Certificación Presupuestal debe tener como mínimo 4 dígitos (números).');
      }

      const cuentaClean = cleanDigits(compraForm.cuenta_contable);
      if (cuentaClean.length !== 10) {
        throw new Error('La Cuenta Contable debe tener exactamente 10 dígitos (números).');
      }

      const ccClean = cleanDigits(compraForm.centro_costo);
      if (ccClean && ccClean.length !== 8) {
        throw new Error('El Centro de Costo debe tener exactamente 8 dígitos (números).');
      }

      const payload = {
        ...compraForm,
        n_doc: nDocClean,
        fecha_oc: compraForm.fecha_oc || null,
        nota_pedido: notaPedidoClean || null,
        certificacion_presupuestal: certClean || null,
        cuenta_contable: cuentaClean,
        centro_costo: ccClean || null,
        id_localidad: Number(compraForm.id_localidad),
        id_fuente: compraForm.id_fuente ? Number(compraForm.id_fuente) : null,
      };

      await createCompra(payload);
      setSuccess(true);
      setEditingDoc(null);
      setCompraForm({
        n_doc: '',
        fecha_oc: '',
        id_localidad: '101',
        nota_pedido: '',
        certificacion_presupuestal: '',
        cuenta_contable: '',
        centro_costo: '',
        id_fuente: '',
        requerido_por: '',
        concepto: '',
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar la orden de compra.');
    }
  };

  const handleIncSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
      
      const nDocClean = incForm.n_doc ? incForm.n_doc.trim() : '';
      if (!nDocClean) {
        throw new Error('El N° de Expediente es requerido.');
      }
      if (nDocClean.length > 30) {
        throw new Error('El N° de Expediente no debe exceder los 30 caracteres.');
      }

      const cuentaClean = cleanDigits(incForm.cuenta_contable);
      if (cuentaClean.length !== 10) {
        throw new Error('La Cuenta Contable debe tener exactamente 10 dígitos (números).');
      }

      const ccClean = cleanDigits(incForm.centro_costo);
      if (ccClean && ccClean.length !== 8) {
        throw new Error('El Centro de Costo debe tener exactamente 8 dígitos (números).');
      }

      // Resolve fuente_origen from id_fuente automatically
      let resolvedFuenteOrigen = '';
      const selectedFuenteId = incForm.id_fuente ? Number(incForm.id_fuente) : null;
      if (selectedFuenteId === 5) resolvedFuenteOrigen = 'LIQ OBRAS';
      else if (selectedFuenteId === 6) resolvedFuenteOrigen = 'TRANSFERENCIA';
      else if (selectedFuenteId === 7) resolvedFuenteOrigen = 'DONACION';

      const payload = {
        ...incForm,
        n_doc: nDocClean,
        fecha_doc: incForm.fecha_doc || null,
        fecha_alta: incForm.fecha_alta || null,
        cuenta_contable: cuentaClean,
        centro_costo: ccClean || null,
        id_localidad: Number(incForm.id_localidad),
        id_fuente: selectedFuenteId,
        fuente_origen: resolvedFuenteOrigen,
      };

      await createIncorporacion(payload);
      setSuccess(true);
      setEditingDoc(null);
      setIncForm({
        n_doc: '',
        fecha_doc: '',
        id_localidad: '101',
        cuenta_contable: '',
        centro_costo: '',
        id_fuente: '',
        fuente_origen: '',
        origen: '',
        fecha_alta: '',
        concepto: '',
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar la incorporación.');
    }
  };

  const handleObraSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
      
      const nDocClean = obraForm.n_doc ? obraForm.n_doc.trim() : '';
      if (!nDocClean) {
        throw new Error('El N° de Expediente es requerido.');
      }
      if (nDocClean.length > 30) {
        throw new Error('El N° de Expediente no debe exceder los 30 caracteres.');
      }

      const cuentaClean = cleanDigits(obraForm.cuenta_contable);
      if (cuentaClean.length !== 10) {
        throw new Error('La Cuenta Contable debe tener exactamente 10 dígitos (números).');
      }

      const ccClean = cleanDigits(obraForm.centro_costo);
      if (ccClean && ccClean.length !== 8) {
        throw new Error('El Centro de Costo debe tener exactamente 8 dígitos (números).');
      }

      // Resolve fuente_origen from id_fuente automatically
      let resolvedFuenteOrigen = '';
      const selectedFuenteId = obraForm.id_fuente ? Number(obraForm.id_fuente) : null;
      if (selectedFuenteId === 5) resolvedFuenteOrigen = 'LIQ OBRAS';
      else if (selectedFuenteId === 6) resolvedFuenteOrigen = 'TRANSFERENCIA';
      else if (selectedFuenteId === 7) resolvedFuenteOrigen = 'DONACION';

      const payload = {
        ...obraForm,
        n_doc: nDocClean,
        fecha_doc: obraForm.fecha_doc || null,
        fecha_alta: obraForm.fecha_alta || null,
        cuenta_contable: cuentaClean,
        centro_costo: ccClean || null,
        id_localidad: Number(obraForm.id_localidad),
        id_fuente: selectedFuenteId,
        fuente_origen: resolvedFuenteOrigen,
      };

      await createObra(payload);
      setSuccess(true);
      setEditingDoc(null);
      setObraForm({
        n_doc: '',
        fecha_doc: '',
        id_localidad: '101',
        cuenta_contable: '',
        centro_costo: '',
        id_fuente: '',
        fuente_origen: '',
        origen: '',
        fecha_alta: '',
        concepto: '',
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar el expediente de obra.');
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    setRenameLoading(true);
    setRenameError(null);
    try {
      const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
      let targetNewNum = newDocNum;
      
      if (docType === 'COMPRA') {
        targetNewNum = cleanDigits(newDocNum);
        if (targetNewNum.length !== 7) {
          throw new Error('El nuevo número de documento debe tener exactamente 7 dígitos.');
        }
        await renameCompra(editingDoc.n_doc, targetNewNum);
      } else if (docType === 'INCORPORACION') {
        targetNewNum = newDocNum.strip ? newDocNum.strip() : newDocNum.trim();
        if (!targetNewNum) {
          throw new Error('El nuevo número de documento no puede estar vacío.');
        }
        if (targetNewNum.length > 30) {
          throw new Error('El nuevo número de documento no debe exceder los 30 caracteres.');
        }
        await renameIncorporacion(editingDoc.n_doc, targetNewNum);
      } else {
        targetNewNum = newDocNum.strip ? newDocNum.strip() : newDocNum.trim();
        if (!targetNewNum) {
          throw new Error('El nuevo número de documento no puede estar vacío.');
        }
        if (targetNewNum.length > 30) {
          throw new Error('El nuevo número de documento no debe exceder los 30 caracteres.');
        }
        await renameObra(editingDoc.n_doc, targetNewNum);
      }
      
      // Actualizar el estado del formulario con el nuevo n_doc
      if (docType === 'COMPRA') {
        setCompraForm(prev => ({ ...prev, n_doc: targetNewNum }));
      } else if (docType === 'INCORPORACION') {
        setIncForm(prev => ({ ...prev, n_doc: targetNewNum }));
      } else {
        setObraForm(prev => ({ ...prev, n_doc: targetNewNum }));
      }
      
      // Actualizar el editingDoc con la nueva clave primaria
      setEditingDoc(prev => ({ ...prev, n_doc: targetNewNum }));
      
      // Refrescar los expedientes
      await loadData();
      
      setSuccess(true);
      setShowRenameModal(false);
      setNewDocNum('');
    } catch (err) {
      setRenameError(err.message || 'Error al renombrar el documento.');
    } finally {
      setRenameLoading(false);
    }
  };

  // Combo Options
  const localidadOpts = localidades.map(l => ({ value: l.value, label: l.label }));
  
  // Al editar, si la localidad actual del doc no está en el listado estándar (ej: SELVA CENTRAL fue excluida),
  // la añadimos temporalmente para que el usuario pueda verla y migrarla a otra localidad.
  const getLocalidadOptsForEdit = (currentIdLocalidad) => {
    if (!currentIdLocalidad) return localidadOpts;
    const currentId = Number(currentIdLocalidad);
    const existsInOpts = localidadOpts.some(l => Number(l.value) === currentId);
    if (existsInOpts) return localidadOpts;
    // La localidad actual no está en el selector, la añadimos con indicador
    return [
      { value: String(currentIdLocalidad), label: `(Valor actual: ID ${currentId} — seleccione otra)` },
      ...localidadOpts,
    ];
  };
  
  const cuentaContableOpts = cuentasContables.map(c => ({ value: c.value, label: c.label }));
  const centroCostoOpts = centrosCosto.map(c => ({ value: c.value, label: c.label }));
  
  // Orden de Compra: Solo comprende RECURSOS ORDINARIOS (1), PMO (2), MRSE (3), PCC (4), ordenados por id_fuente (value)
  const compraFuenteOpts = fuentes
    .filter(f => [1, 2, 3, 4].includes(Number(f.value)))
    .map(f => {
      let label = f.label;
      if (Number(f.value) === 3) label = 'MRESE';
      return { value: String(f.value), label };
    })
    .sort((a, b) => Number(a.value) - Number(b.value));

  // Incorporación (Procedencia): Solo comprende Liquidación de obra (5), Transferencia (6), Donación (7), ordenados por id_fuente (value)
  const incProcedenciaOpts = fuentes
    .filter(f => [5, 6, 7].includes(Number(f.value)))
    .map(f => {
      let label = f.label;
      if (Number(f.value) === 5) label = 'LIQUIDACIÓN DE OBRAS';
      if (Number(f.value) === 6) label = 'TRANSFERENCIA';
      if (Number(f.value) === 7) label = 'DONACIÓN';
      return { value: String(f.value), label };
    })
    .sort((a, b) => Number(a.value) - Number(b.value));

  const personalOpts = personal.map(p => ({ value: p.value, label: p.label }));

  // Helper to resolve localidad label from id
  const getLocalidadLabel = (id) => {
    if (!id) return '—';
    const loc = localidades.find(l => Number(l.value) === Number(id));
    return loc ? loc.label : `ID ${id}`;
  };

  // Client-side filtering
  const filteredCompras = compras.filter(c => {
    if (tableFilters.id_localidad && Number(c.id_localidad) !== Number(tableFilters.id_localidad)) return false;
    if (tableFilters.cuenta_contable && c.cuenta_contable !== tableFilters.cuenta_contable) return false;
    if (tableFilters.fecha_desde && c.fecha_oc && c.fecha_oc.split('T')[0] < tableFilters.fecha_desde) return false;
    if (tableFilters.fecha_hasta && c.fecha_oc && c.fecha_oc.split('T')[0] > tableFilters.fecha_hasta) return false;
    return true;
  });

  const filteredIncorporaciones = incorporaciones.filter(i => {
    if (tableFilters.id_localidad && Number(i.id_localidad) !== Number(tableFilters.id_localidad)) return false;
    if (tableFilters.cuenta_contable && i.cuenta_contable !== tableFilters.cuenta_contable) return false;
    if (tableFilters.fecha_desde && i.fecha_doc && i.fecha_doc.split('T')[0] < tableFilters.fecha_desde) return false;
    if (tableFilters.fecha_hasta && i.fecha_doc && i.fecha_doc.split('T')[0] > tableFilters.fecha_hasta) return false;
    return true;
  });

  const filteredObras = obras.filter(o => {
    if (tableFilters.id_localidad && Number(o.id_localidad) !== Number(tableFilters.id_localidad)) return false;
    if (tableFilters.cuenta_contable && o.cuenta_contable !== tableFilters.cuenta_contable) return false;
    if (tableFilters.fecha_desde && o.fecha_doc && o.fecha_doc.split('T')[0] < tableFilters.fecha_desde) return false;
    if (tableFilters.fecha_hasta && o.fecha_doc && o.fecha_doc.split('T')[0] > tableFilters.fecha_hasta) return false;
    return true;
  });

  const fuenteOrigenOpts = [
    { value: 'LIQ OBRAS', label: 'LIQ OBRAS (Liquidación de Obras)' },
    { value: 'DONACION', label: 'DONACIÓN' },
    { value: 'TRANSFERENCIA', label: 'TRANSFERENCIA EXTERNA' },
    { value: 'OTROS', label: 'OTROS ORIGENES' },
  ];

  const origenOpts = [
    { value: 'MUNICIPALIDAD', label: 'MUNICIPALIDAD' },
    { value: 'GOBIERNO REGIONAL', label: 'GOBIERNO REGIONAL' },
    { value: 'MINISTERIO', label: 'MINISTERIO' },
    { value: 'PROYECTO ESPECIAL', label: 'PROYECTO ESPECIAL' },
    { value: 'OTROS', label: 'OTROS ENTIDADES' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="module-heading">
          <p className="module-kicker">Gestión documental</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Expedientes de Adquisición</h2>
          <p className="text-sm text-slate-500">Registra y administra órdenes de compra o resoluciones de incorporación.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              handleCancelEdit();
            } else {
              setEditingDoc(null);
              setShowForm(true);
              setError(null);
              setSuccess(false);
            }
          }}
          className="mt-2 md:mt-0 inline-flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white px-4 py-2.5 rounded-xl font-semibold text-[0.8125rem] shadow-md shadow-brand-600/10 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? (editingDoc ? 'Cancelar Edición' : 'Ver Expedientes') : 'Registrar Nuevo Documento'}</span>
        </button>
      </div>

      {success && (
        <div className="flex items-center space-x-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold">¡Documento registrado correctamente en el sistema!</span>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-3 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Error al registrar:</span>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
      )}

      {showForm ? (
        /* FORMULARIO DE REGISTRO */
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-fadeIn">
          {/* Tipo de Documento */}
          <div className="mb-6 max-w-xs">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Tipo de Documento</label>
            <select
              value={docType}
              disabled={!!editingDoc}
              onChange={(e) => {
                setDocType(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="COMPRA">Orden de Compra</option>
              <option value="INCORPORACION">Resolución de Incorporación</option>
              <option value="OBRA">Expediente de Obra en Curso</option>
            </select>
          </div>

          {docType === 'COMPRA' && (
            /* FORMULARIO COMPRA */
            <form onSubmit={handleCompraSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-[#00B0F0] uppercase tracking-wide mb-2">Datos de la Orden de Compra</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Documento (Orden Compra) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="n_doc"
                      required
                      disabled={!!editingDoc}
                      maxLength={7}
                      value={compraForm.n_doc}
                      onChange={handleCompraChange}
                      placeholder="Ej: 2510126"
                      className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono font-bold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {!!editingDoc && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewDocNum(compraForm.n_doc);
                          setRenameError(null);
                          setShowRenameModal(true);
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 hover:text-amber-800 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                      >
                        Renombrar
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha O/C</label>
                  <input
                    type="date"
                    name="fecha_oc"
                    value={compraForm.fecha_oc}
                    onChange={handleCompraChange}
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                  />
                </div>

                <SearchableSelect
                  label="Localidad"
                  name="id_localidad"
                  value={compraForm.id_localidad}
                  onChange={handleCompraChange}
                  options={editingDoc ? getLocalidadOptsForEdit(compraForm.id_localidad) : localidadOpts}
                  required
                  placeholder="Seleccionar localidad..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nota de Pedido (7 dígitos)</label>
                  <input
                    type="text"
                    name="nota_pedido"
                    maxLength={7}
                    pattern="[0-9]{7}"
                    value={compraForm.nota_pedido}
                    onChange={handleCompraChange}
                    placeholder="Ej: 0012456"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">N° Certificación Presupuestal</label>
                  <input
                    type="text"
                    name="certificacion_presupuestal"
                    maxLength={6}
                    value={compraForm.certificacion_presupuestal}
                    onChange={handleCompraChange}
                    placeholder="Ej: 1502"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                </div>

                <SearchableSelect
                  label="Solicitante (Personal)"
                  name="requerido_por"
                  value={compraForm.requerido_por}
                  onChange={handleCompraChange}
                  options={personalOpts}
                  required
                  placeholder="Seleccionar personal..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cuenta Contable <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cuenta_contable"
                    required
                    maxLength={10}
                    value={compraForm.cuenta_contable}
                    onChange={handleCompraChange}
                    list="cuentas-compras"
                    placeholder="Ej: 3341151101 (10 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cuentas-compras">
                    {cuentaContableOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Centro de Costo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="centro_costo"
                    required
                    maxLength={8}
                    value={compraForm.centro_costo}
                    onChange={handleCompraChange}
                    list="cc-compras"
                    placeholder="Ej: 90133301 (8 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cc-compras">
                    {centroCostoOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>

                <SearchableSelect
                  label="Fuente de Financiamiento"
                  name="id_fuente"
                  value={compraForm.id_fuente}
                  onChange={handleCompraChange}
                  options={compraFuenteOpts}
                  placeholder="Seleccionar fuente..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto / Detalle de la Adquisición</label>
                <textarea
                  name="concepto"
                  rows="3"
                  value={compraForm.concepto}
                  onChange={handleCompraChange}
                  placeholder="Escribe detalles complementarios de la compra de bienes..."
                  className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                {editingDoc && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98]"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-600/20 transition-all duration-200 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDoc ? 'Actualizar Orden de Compra' : 'Guardar Orden de Compra'}</span>
                </button>
              </div>
            </form>
          )}

          {docType === 'INCORPORACION' && (
            /* FORMULARIO INCORPORACION */
            <form onSubmit={handleIncSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-[#00B0F0] uppercase tracking-wide mb-2">Datos del Expediente de Incorporación</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Expediente / Resolución <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="n_doc"
                      required
                      disabled={!!editingDoc}
                      maxLength={30}
                      value={incForm.n_doc}
                      onChange={handleIncChange}
                      placeholder="Ej: INC-2026-001"
                      className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono font-bold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {!!editingDoc && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewDocNum(incForm.n_doc);
                          setRenameError(null);
                          setShowRenameModal(true);
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 hover:text-amber-800 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                      >
                        Renombrar
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del Pliego</label>
                  <input
                    type="date"
                    name="fecha_doc"
                    required
                    value={incForm.fecha_doc}
                    onChange={handleIncChange}
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Alta</label>
                  <input
                    type="date"
                    name="fecha_alta"
                    required
                    value={incForm.fecha_alta}
                    onChange={handleIncChange}
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SearchableSelect
                  label="Localidad"
                  name="id_localidad"
                  value={incForm.id_localidad}
                  onChange={handleIncChange}
                  options={editingDoc ? getLocalidadOptsForEdit(incForm.id_localidad) : localidadOpts}
                  required
                  placeholder="Seleccionar localidad..."
                />

                <SearchableSelect
                  label="Procedencia"
                  name="id_fuente"
                  value={incForm.id_fuente}
                  onChange={handleIncChange}
                  options={incProcedenciaOpts}
                  placeholder="Seleccionar procedencia..."
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Entidad de Origen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="origen"
                    required
                    value={incForm.origen}
                    onChange={handleIncChange}
                    placeholder="Ej: Municipalidad de cualquier distrito, tercero..."
                    className="block w-slate w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cuenta Contable <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cuenta_contable"
                    required
                    maxLength={10}
                    value={incForm.cuenta_contable}
                    onChange={handleIncChange}
                    list="cuentas-inc"
                    placeholder="Ej: 3341151101 (10 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cuentas-inc">
                    {cuentaContableOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Centro de Costo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="centro_costo"
                    required
                    maxLength={8}
                    value={incForm.centro_costo}
                    onChange={handleIncChange}
                    list="cc-inc"
                    placeholder="Ej: 90133301 (8 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cc-inc">
                    {centroCostoOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto/Detalle de Incorporación</label>
                <textarea
                  name="concepto"
                  rows="3"
                  value={incForm.concepto}
                  onChange={handleIncChange}
                  placeholder="Escribe detalles complementarios de la incorporación de bienes..."
                  className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                {editingDoc && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98]"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-600/20 transition-all duration-200 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDoc ? 'Actualizar Incorporación' : 'Guardar Incorporación'}</span>
                </button>
              </div>
            </form>
          )}

          {docType === 'OBRA' && (
            /* FORMULARIO OBRA */
            <form onSubmit={handleObraSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-[#00B0F0] uppercase tracking-wide mb-2">Datos del Expediente de Obra en Curso</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Expediente de Obra <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="n_doc"
                      required
                      disabled={!!editingDoc}
                      maxLength={30}
                      value={obraForm.n_doc}
                      onChange={handleObraChange}
                      placeholder="Ej: OBR-2026-001"
                      className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono font-bold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {!!editingDoc && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewDocNum(obraForm.n_doc);
                          setRenameError(null);
                          setShowRenameModal(true);
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 hover:text-amber-800 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                      >
                        Renombrar
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del Documento</label>
                  <input
                    type="date"
                    name="fecha_doc"
                    required
                    value={obraForm.fecha_doc}
                    onChange={handleObraChange}
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Alta</label>
                  <input
                    type="date"
                    name="fecha_alta"
                    required
                    value={obraForm.fecha_alta}
                    onChange={handleObraChange}
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SearchableSelect
                  label="Localidad"
                  name="id_localidad"
                  value={obraForm.id_localidad}
                  onChange={handleObraChange}
                  options={editingDoc ? getLocalidadOptsForEdit(obraForm.id_localidad) : localidadOpts}
                  required
                  placeholder="Seleccionar localidad..."
                />

                <SearchableSelect
                  label="Procedencia"
                  name="id_fuente"
                  value={obraForm.id_fuente}
                  onChange={handleObraChange}
                  options={incProcedenciaOpts}
                  placeholder="Seleccionar procedencia..."
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Entidad de Origen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="origen"
                    required
                    value={obraForm.origen}
                    onChange={handleObraChange}
                    placeholder="Ej: Municipalidad de cualquier distrito, tercero..."
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cuenta Contable <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cuenta_contable"
                    required
                    maxLength={10}
                    value={obraForm.cuenta_contable}
                    onChange={handleObraChange}
                    list="cuentas-obras"
                    placeholder="Ej: 339... (10 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cuentas-obras">
                    {cuentaContableOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Centro de Costo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="centro_costo"
                    required
                    maxLength={8}
                    value={obraForm.centro_costo}
                    onChange={handleObraChange}
                    list="cc-obras"
                    placeholder="Ej: 90133301 (8 dígitos)"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono"
                  />
                  <datalist id="cc-obras">
                    {centroCostoOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto/Detalle de Obra</label>
                <textarea
                  name="concepto"
                  rows="3"
                  value={obraForm.concepto}
                  onChange={handleObraChange}
                  placeholder="Escribe detalles complementarios del expediente de obra..."
                  className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all text-slate-700"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                {editingDoc && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98]"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-600/20 transition-all duration-200 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDoc ? 'Actualizar Expediente' : 'Guardar Expediente'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* TABLAS DE EXPEDIENTES EXISTENTES */
        <div className="space-y-6">
          {/* Navegación interna (Compras / Incorporaciones) */}
          <div className="flex space-x-2 border-b border-slate-100 pb-px">
            <button
              onClick={() => setDocType('COMPRA')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                docType === 'COMPRA'
                  ? 'border-[#00B0F0] text-[#00B0F0]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Órdenes de Compra ({filteredCompras.length})
            </button>
            <button
              onClick={() => setDocType('INCORPORACION')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                docType === 'INCORPORACION'
                  ? 'border-[#00B0F0] text-[#00B0F0]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Incorporaciones ({filteredIncorporaciones.length})
            </button>
            <button
              onClick={() => setDocType('OBRA')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                docType === 'OBRA'
                  ? 'border-[#00B0F0] text-[#00B0F0]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Obras en Curso ({filteredObras.length})
            </button>
          </div>

          {/* Barra de Filtros */}
          <div className="glass-panel rounded-xl p-4 relative z-30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableSelect
                label="Localidad"
                name="filter_localidad"
                value={tableFilters.id_localidad}
                onChange={(e) => setTableFilters(prev => ({ ...prev, id_localidad: e.target.value }))}
                options={localidadOpts}
                placeholder="Todas las localidades"
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Desde</label>
                <input
                  type="date"
                  value={tableFilters.fecha_desde}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
                  className="block w-full px-3 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  value={tableFilters.fecha_hasta}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                  className="block w-full px-3 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                />
              </div>
              <SearchableSelect
                label="Cuenta Contable"
                name="filter_cuenta"
                value={tableFilters.cuenta_contable}
                onChange={(e) => setTableFilters(prev => ({ ...prev, cuenta_contable: e.target.value }))}
                options={cuentaContableOpts}
                placeholder="Todas las cuentas"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center text-xs text-slate-400 py-12 animate-pulse">
              Cargando expedientes registrados...
            </div>
          ) : (
            <>
              {docType === 'COMPRA' && (
                /* TABLA COMPRAS */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">N° Documento</th>
                          <th className="px-6 py-3.5">Fecha O/C</th>
                          <th className="px-6 py-3.5">Localidad</th>
                          <th className="px-6 py-3.5">Nota Pedido</th>
                          <th className="px-6 py-3.5">Certificación</th>
                          <th className="px-6 py-3.5">Cuenta Contable</th>
                          <th className="px-6 py-3.5">Centro Costo</th>
                          <th className="px-6 py-3.5">Concepto</th>
                          <th className="px-6 py-3.5 text-center">Gestión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {filteredCompras.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="px-6 py-8 text-center text-slate-400">
                              No hay órdenes de compra que coincidan con los filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredCompras.map((c) => (
                            <tr key={c.n_doc} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3 font-bold font-mono text-slate-800">{formatDocNum(c.n_doc, 'COMPRA')}</td>
                              <td className="px-6 py-3">{formatDate(c.fecha_oc)}</td>
                              <td className="px-6 py-3 text-xs font-semibold text-slate-700">{getLocalidadLabel(c.id_localidad)}</td>
                              <td className="px-6 py-3 font-mono">{c.nota_pedido || '—'}</td>
                              <td className="px-6 py-3 font-mono">{c.certificacion_presupuestal || '—'}</td>
                              <td className="px-6 py-3 font-mono">{c.cuenta_contable}</td>
                              <td className="px-6 py-3 font-mono">{c.centro_costo || '—'}</td>
                              <td className="px-6 py-3 truncate max-w-xs" title={c.concepto}>{c.concepto || '—'}</td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => handleEditDoc('COMPRA', c)}
                                  title="Editar Documento"
                                  className="p-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-600 hover:text-brand-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
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

              {docType === 'INCORPORACION' && (
                /* TABLA INCORPORACIONES */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">N° Expediente</th>
                          <th className="px-6 py-3.5">Fecha Pliego</th>
                          <th className="px-6 py-3.5">Localidad</th>
                          <th className="px-6 py-3.5">Fuente Origen</th>
                          <th className="px-6 py-3.5">Origen</th>
                          <th className="px-6 py-3.5">Fecha Alta</th>
                          <th className="px-6 py-3.5">Cuenta Contable</th>
                          <th className="px-6 py-3.5">Centro Costo</th>
                          <th className="px-6 py-3.5">Concepto</th>
                          <th className="px-6 py-3.5 text-center">Gestión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {filteredIncorporaciones.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="px-6 py-8 text-center text-slate-400">
                              No hay incorporaciones que coincidan con los filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredIncorporaciones.map((i) => (
                            <tr key={i.n_doc} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3 font-bold font-mono text-slate-800">{formatDocNum(i.n_doc, 'INCORPORACION')}</td>
                              <td className="px-6 py-3">{formatDate(i.fecha_doc)}</td>
                              <td className="px-6 py-3 text-xs font-semibold text-slate-700">{getLocalidadLabel(i.id_localidad)}</td>
                              <td className="px-6 py-3">{i.fuente_origen || '—'}</td>
                              <td className="px-6 py-3">{i.origen || '—'}</td>
                              <td className="px-6 py-3">{formatDate(i.fecha_alta)}</td>
                              <td className="px-6 py-3 font-mono">{i.cuenta_contable}</td>
                              <td className="px-6 py-3 font-mono">{i.centro_costo || '—'}</td>
                              <td className="px-6 py-3 truncate max-w-xs" title={i.concepto}>{i.concepto || '—'}</td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => handleEditDoc('INCORPORACION', i)}
                                  title="Editar Documento"
                                  className="p-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-600 hover:text-brand-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
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

              {docType === 'OBRA' && (
                /* TABLA OBRAS */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">N° Expediente de Obra</th>
                          <th className="px-6 py-3.5">Fecha Pliego/Doc</th>
                          <th className="px-6 py-3.5">Localidad</th>
                          <th className="px-6 py-3.5">Fuente Origen</th>
                          <th className="px-6 py-3.5">Origen</th>
                          <th className="px-6 py-3.5">Fecha Alta</th>
                          <th className="px-6 py-3.5">Cuenta Contable</th>
                          <th className="px-6 py-3.5">Centro Costo</th>
                          <th className="px-6 py-3.5">Concepto</th>
                          <th className="px-6 py-3.5 text-center">Gestión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {filteredObras.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="px-6 py-8 text-center text-slate-400">
                              No hay expedientes de obra que coincidan con los filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredObras.map((o) => (
                            <tr key={o.n_doc} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3 font-bold font-mono text-slate-800">{formatDocNum(o.n_doc, 'OBRA')}</td>
                              <td className="px-6 py-3">{formatDate(o.fecha_doc)}</td>
                              <td className="px-6 py-3 text-xs font-semibold text-slate-700">{getLocalidadLabel(o.id_localidad)}</td>
                              <td className="px-6 py-3">{o.fuente_origen || '—'}</td>
                              <td className="px-6 py-3">{o.origen || '—'}</td>
                              <td className="px-6 py-3">{formatDate(o.fecha_alta)}</td>
                              <td className="px-6 py-3 font-mono">{o.cuenta_contable}</td>
                              <td className="px-6 py-3 font-mono">{o.centro_costo || '—'}</td>
                              <td className="px-6 py-3 truncate max-w-xs" title={o.concepto}>{o.concepto || '—'}</td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => handleEditDoc('OBRA', o)}
                                  title="Editar Documento"
                                  className="p-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-600 hover:text-brand-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
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
            </>
          )}
        </div>
      )}

      {/* MODAL DE RENOMBRADO */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} maxWidth="420px">
        <form onSubmit={handleRenameSubmit} className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Modificar Número de Documento</h3>
            <p className="text-xs text-slate-500 mt-1">
              Esta acción actualizará el número de documento en la base de datos y se propagará automáticamente a todos los activos vinculados.
            </p>
          </div>
          
          {renameError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl animate-fadeIn">
              {renameError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {docType === 'COMPRA' ? 'Nuevo N° de Orden (7 dígitos)' : 'Nuevo N° de Expediente (máx. 30 caracteres)'}
            </label>
            <input
              type="text"
              required
              value={newDocNum}
              onChange={(e) => setNewDocNum(e.target.value)}
              maxLength={docType === 'COMPRA' ? 7 : 30}
              placeholder={docType === 'COMPRA' ? 'Ej: 2510127' : 'Ej: INC-2026-002'}
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00B0F0]/20 focus:border-[#00B0F0] transition-all font-mono font-bold text-slate-700"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={renameLoading}
              onClick={() => setShowRenameModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={renameLoading}
              className="px-4 py-2 bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-60"
            >
              {renameLoading ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
