import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, AlertCircle, CheckCircle2, ChevronDown, FileText, Plus, X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import VehiculoDetalleForm from './VehiculoDetalleForm';
import { 
  createActivo, updateActivo, fetchSucursales, fetchSubcategorias, fetchPuestos, fetchPersonal,
  fetchLocalidades, fetchCuentasContables, fetchCentrosCosto, fetchFuentes, fetchCompra, fetchIncorporacion,
  fetchCompras, fetchIncorporaciones, fetchVehiculoDetalle, upsertVehiculoDetalle,
  fetchObras, fetchObra, fetchCodigoPatrimonialObra, fetchUltimasActas
} from '../utils/api';

const INITIAL_FORM_STATE = {
  cod_patrimonial: '',
  documento_tipo: 'COMPRA',
  n_doc_compra: '',
  n_doc_incorporacion: '',
  n_doc_obra: '',
  cod_categoria: '',
  denominacion: '',
  color: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  caracteristicas_accesorios: '',
  vida_util_anios: 0,
  id_sucursal: '',
  unidad: '',
  puesto_id: '',
  cod_personal: '',
  numero_factura: '',
  fecha_alta_factura: '',
  fecha_registro_contable: '',
  fecha_asignacion: '',
  valor_en_libros: '0.00',
  igv: '',
  informe_conformidad: '',
  n_acta: '',
  estado_activo: 'BUENO',
  
  // Campos Compra inline
  compra_fecha_oc: '',
  compra_id_localidad: '101',
  compra_nota_pedido: '',
  compra_certificacion_presupuestal: '',
  compra_id_fuente: '',
  compra_requerido_por: '',
  compra_concepto: '',

  // Campos Incorporacion inline
  inc_fecha_doc: '',
  inc_id_localidad: '101',
  inc_nota_pedido: '',
  inc_certificacion_presupuestal: '',
  inc_id_fuente: '',
  inc_fuente_origen: '',
  inc_origen: '',
  inc_fecha_alta: '',
  inc_concepto: '',

  // Campos Obras inline
  obra_fecha_doc: '',
  obra_id_localidad: '101',
  obra_nota_pedido: '',
  obra_certificacion_presupuestal: '',
  obra_id_fuente: '',
  obra_fuente_origen: '',
  obra_origen: '',
  obra_fecha_alta: '',
  obra_concepto: '',
  
  // Campos del Activo Fijo directamente
  cuenta_contable: '',
  centro_costo: '',
};


const formatMonetaryInput = (val) => {
  if (val === null || val === undefined) return '';
  let clean = String(val).replace(/[^\d.]/g, '');
  const parts = clean.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
    const newParts = clean.split('.');
    return newParts[0] + '.' + newParts[1].substring(0, 4);
  }
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1].substring(0, 4);
  }
  return parts[0];
};

const formatMonetaryValue = (val) => {
  if (val === null || val === undefined || val === '') return '';
  return formatMonetaryInput(String(val));
};

const cleanMoney = (val) => {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '');
  return Number(cleaned) || 0;
};

export default function ActivoForm({ onSuccess, editingActivo = null, onCancelEdit = null, setIsDirty, preSelectedDoc, onClearPreSelectedDoc, onNavigateTab }) {
  const [form, setForm] = useState(() => {
    if (editingActivo) {
      const initialDocCompra = editingActivo.n_doc_compra || (editingActivo.documento_tipo === 'COMPRA' ? editingActivo.n_doc : '') || '';
      const initialDocInc = editingActivo.n_doc_incorporacion || (editingActivo.documento_tipo === 'INCORPORACION' ? editingActivo.n_doc : '') || '';
      const initialDocObra = editingActivo.n_doc_obra || (editingActivo.documento_tipo === 'OBRA' ? editingActivo.n_doc : '') || '';

      return {
        ...INITIAL_FORM_STATE,
        cod_patrimonial: editingActivo.cod_patrimonial || '',
        documento_tipo: editingActivo.documento_tipo || 'COMPRA',
        n_doc_compra: initialDocCompra,
        n_doc_incorporacion: initialDocInc,
        n_doc_obra: initialDocObra,
        cod_categoria: editingActivo.cod_categoria || '',
        denominacion: editingActivo.denominacion || '',
        color: editingActivo.color || '',
        marca: editingActivo.marca || '',
        modelo: editingActivo.modelo || '',
        numero_serie: editingActivo.numero_serie || '',
        caracteristicas_accesorios: editingActivo.caracteristicas_accesorios || '',
        vida_util_anios: editingActivo.vida_util_anios || 0,
        id_sucursal: editingActivo.id_sucursal || '',
        unidad: editingActivo.unidad || '',
        puesto_id: editingActivo.puesto_id || '',
        cod_personal: editingActivo.cod_personal || '',
        numero_factura: editingActivo.numero_factura || '',
        fecha_alta_factura: editingActivo.fecha_alta_factura || '',
        fecha_registro_contable: editingActivo.fecha_registro_contable || '',
        fecha_asignacion: editingActivo.fecha_asignacion || '',
        valor_en_libros: formatMonetaryValue(editingActivo.valor_en_libros),
        igv: formatMonetaryValue(editingActivo.igv),
        informe_conformidad: editingActivo.informe_conformidad || '',
        n_acta: editingActivo.n_acta || '',
        estado_activo: editingActivo.estado_activo || 'REGISTRADO',
        cuenta_contable: editingActivo.cuenta_contable || '',
        centro_costo: editingActivo.centro_costo || '',
      };
    }
    return INITIAL_FORM_STATE;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const isEditMode = !!editingActivo;

  // Listas de dimensiones y documentos
  const [sucursales, setSucursales] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cuentasContables, setCuentasContables] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [fuentes, setFuentes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [incorporaciones, setIncorporaciones] = useState([]);
  const [obras, setObras] = useState([]);
  const [ultimasActas, setUltimasActas] = useState([]);
  
  const [docSelectionMode, setDocSelectionMode] = useState('EXISTING_COMPRA'); // EXISTING_COMPRA | EXISTING_INCORPORACION | EXISTING_OBRA | NEW_DOCUMENT
  const [selectedCompraDetail, setSelectedCompraDetail] = useState(null);
  const [selectedIncDetail, setSelectedIncDetail] = useState(null);
  const [selectedObraDetail, setSelectedObraDetail] = useState(null);
  const [loadingListas, setLoadingListas] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [vehiculoDetalleData, setVehiculoDetalleData] = useState(null);
  const [initialVehiculoDetalle, setInitialVehiculoDetalle] = useState(null);

  // Sincronizar selectedCategory cuando cambia cod_categoria o cuando se cargan las subcategorías
  useEffect(() => {
    if (form.cod_categoria && subcategorias.length > 0) {
      const found = subcategorias.find(s => Number(s.value) === Number(form.cod_categoria));
      if (found) {
        setSelectedCategory(found.categoria);
      }
    } else if (!form.cod_categoria) {
      setSelectedCategory('');
    }
  }, [form.cod_categoria, subcategorias]);

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setSelectedCategory(value);
    setForm((prev) => ({
      ...prev,
      cod_categoria: '',
      vida_util_anios: 0
    }));
  };

  const handleSubcategoryChange = (e) => {
    const value = e.target.value;
    const found = subcategorias.find((s) => Number(s.value) === Number(value));
    setForm((prev) => ({
      ...prev,
      cod_categoria: value,
      vida_util_anios: found ? found.vida_util_anios : 0
    }));
  };

  // Detectar si el formulario está modificado (sucio) para advertencias al salir
  useEffect(() => {
    const isFormDirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FORM_STATE);
    if (setIsDirty) {
      setIsDirty(isFormDirty);
    }
  }, [form, setIsDirty]);

  // Bloquear salida del navegador o recarga si hay cambios
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const isFormDirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FORM_STATE);
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue = ''; // Diálogo estándar del navegador
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [form]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  // Cargar listas y documentos al montar
  const reloadDocumentLists = async () => {
    try {
      const [cps, incs, obrs] = await Promise.all([fetchCompras(), fetchIncorporaciones(), fetchObras()]);
      setCompras(cps);
      setIncorporaciones(incs);
      setObras(obrs);
    } catch (err) {}
  };

  const reloadUltimasActas = async () => {
    try {
      const actas = await fetchUltimasActas();
      setUltimasActas(actas);
    } catch (err) {}
  };

  useEffect(() => {
    Promise.all([
      fetchSucursales(), 
      fetchSubcategorias(), 
      fetchPersonal(),
      fetchLocalidades(),
      fetchCuentasContables(),
      fetchCentrosCosto(),
      fetchFuentes(),
      fetchCompras(),
      fetchIncorporaciones(),
      fetchObras(),
      fetchUltimasActas().catch(() => [])
    ])
      .then(([suc, subcat, pers, loc, cta, cc, fte, cps, incs, obrs, actas]) => {
        setSucursales(suc);
        setSubcategorias(subcat);
        setPersonal(pers);
        setLocalidades(loc);
        setCuentasContables(cta);
        setCentrosCosto(cc);
        setFuentes(fte);
        setCompras(cps);
        setIncorporaciones(incs);
        setObras(obrs);
        setUltimasActas(actas);
      })
      .catch(() => {})
      .finally(() => setLoadingListas(false));
  }, []);

  // Cargar datos de activo y su documento de adquisición en modo edición
  useEffect(() => {
    if (editingActivo) {
      const initialDocCompra = editingActivo.n_doc_compra || (editingActivo.documento_tipo === 'COMPRA' ? editingActivo.n_doc : '') || '';
      const initialDocInc = editingActivo.n_doc_incorporacion || (editingActivo.documento_tipo === 'INCORPORACION' ? editingActivo.n_doc : '') || '';
      const initialDocObra = editingActivo.n_doc_obra || (editingActivo.documento_tipo === 'OBRA' ? editingActivo.n_doc : '') || '';

      setForm({
        ...INITIAL_FORM_STATE,
        cod_patrimonial: editingActivo.cod_patrimonial || '',
        documento_tipo: editingActivo.documento_tipo || 'COMPRA',
        n_doc_compra: initialDocCompra,
        n_doc_incorporacion: initialDocInc,
        n_doc_obra: initialDocObra,
        cod_categoria: editingActivo.cod_categoria || '',
        denominacion: editingActivo.denominacion || '',
        color: editingActivo.color || '',
        marca: editingActivo.marca || '',
        modelo: editingActivo.modelo || '',
        numero_serie: editingActivo.numero_serie || '',
        caracteristicas_accesorios: editingActivo.caracteristicas_accesorios || '',
        vida_util_anios: editingActivo.vida_util_anios || 0,
        id_sucursal: editingActivo.id_sucursal || '',
        unidad: editingActivo.unidad || '',
        puesto_id: editingActivo.puesto_id || '',
        cod_personal: editingActivo.cod_personal || '',
        numero_factura: editingActivo.numero_factura || '',
        fecha_alta_factura: editingActivo.fecha_alta_factura || '',
        fecha_registro_contable: editingActivo.fecha_registro_contable || '',
        fecha_asignacion: editingActivo.fecha_asignacion || '',
        valor_en_libros: formatMonetaryValue(editingActivo.valor_en_libros),
        igv: formatMonetaryValue(editingActivo.igv),
        informe_conformidad: editingActivo.informe_conformidad || '',
        n_acta: editingActivo.n_acta || '',
        estado_activo: editingActivo.estado_activo || 'REGISTRADO',
        cuenta_contable: editingActivo.cuenta_contable || '',
        centro_costo: editingActivo.centro_costo || '',
      });
      setError(null);
      setSuccess(false);

      if (editingActivo.documento_tipo === 'COMPRA' && initialDocCompra) {
        setDocSelectionMode('EXISTING_COMPRA');
        fetchCompra(initialDocCompra)
          .then((compra) => {
            setSelectedCompraDetail(compra);
            setForm((prev) => ({
              ...prev,
              compra_fecha_oc: compra.fecha_oc || '',
              compra_id_localidad: compra.id_localidad || '',
              compra_nota_pedido: compra.nota_pedido || '',
              compra_certificacion_presupuestal: compra.certificacion_presupuestal || '',
              compra_id_fuente: compra.id_fuente || '',
              compra_requerido_por: compra.requerido_por || '',
              compra_concepto: compra.concepto || '',
            }));
          })
          .catch(() => {
            // Si el documento no existe en BD, cambiar a registro manual manteniendo el número
            setDocSelectionMode('NEW_DOCUMENT');
          });
      } else if (editingActivo.documento_tipo === 'INCORPORACION' && initialDocInc) {
        setDocSelectionMode('EXISTING_INCORPORACION');
        fetchIncorporacion(initialDocInc)
          .then((inc) => {
            setSelectedIncDetail(inc);
            setForm((prev) => ({
              ...prev,
              inc_fecha_doc: inc.fecha_doc || '',
              inc_id_localidad: inc.id_localidad || '',
              inc_nota_pedido: inc.nota_pedido || '',
              inc_certificacion_presupuestal: inc.certificacion_presupuestal || '',
              inc_id_fuente: inc.id_fuente || '',
              inc_fuente_origen: inc.fuente_origen || '',
              inc_origen: inc.origen || '',
              inc_fecha_alta: inc.fecha_alta || '',
              inc_concepto: inc.concepto || '',
            }));
          })
          .catch(() => {
            // Si el documento no existe en BD, cambiar a registro manual manteniendo el número
            setDocSelectionMode('NEW_DOCUMENT');
          });
      } else if (editingActivo.documento_tipo === 'OBRA' && initialDocObra) {
        setDocSelectionMode('EXISTING_OBRA');
        fetchObra(initialDocObra)
          .then((obra) => {
            setSelectedObraDetail(obra);
            setForm((prev) => ({
              ...prev,
              obra_fecha_doc: obra.fecha_doc || '',
              obra_id_localidad: obra.id_localidad || '',
              obra_nota_pedido: obra.nota_pedido || '',
              obra_certificacion_presupuestal: obra.certificacion_presupuestal || '',
              obra_id_fuente: obra.id_fuente || '',
              obra_fuente_origen: obra.fuente_origen || '',
              obra_origen: obra.origen || '',
              obra_fecha_alta: obra.fecha_alta || '',
              obra_concepto: obra.concepto || '',
            }));
          })
          .catch(() => {
            // Si el documento no existe en BD, cambiar a registro manual manteniendo el número
            setDocSelectionMode('NEW_DOCUMENT');
          });
      }
      setInitialVehiculoDetalle(null);
      setVehiculoDetalleData(null);
      if (editingActivo.categoria && editingActivo.categoria.toLowerCase().startsWith('vehiculo')) {
        fetchVehiculoDetalle(editingActivo.cod_patrimonial)
          .then((vehDetail) => {
            if (vehDetail) {
              setInitialVehiculoDetalle(vehDetail);
              setVehiculoDetalleData(vehDetail);
            }
          })
          .catch(() => {});
      }
    } else {
      setForm(INITIAL_FORM_STATE);
      setSelectedCompraDetail(null);
      setSelectedIncDetail(null);
      setSelectedObraDetail(null);
      setDocSelectionMode('EXISTING_COMPRA');
      setInitialVehiculoDetalle(null);
      setVehiculoDetalleData(null);
    }
  }, [editingActivo]);

  // Manejar el documento pre-seleccionado que proviene de la pestaña Documentos
  useEffect(() => {
    if (preSelectedDoc) {
      const { tipo, n_doc } = preSelectedDoc;
      setForm(prev => ({
        ...prev,
        documento_tipo: tipo,
        n_doc_compra: tipo === 'COMPRA' ? n_doc : '',
        n_doc_incorporacion: tipo === 'INCORPORACION' ? n_doc : '',
        n_doc_obra: tipo === 'OBRA' ? n_doc : '',
      }));
      if (tipo === 'COMPRA') {
        setDocSelectionMode('EXISTING_COMPRA');
        fetchCompra(n_doc)
          .then((compra) => {
            setSelectedCompraDetail(compra);
            setForm((prev) => ({
              ...prev,
              compra_fecha_oc: compra.fecha_oc || '',
              compra_id_localidad: compra.id_localidad || '',
              compra_nota_pedido: compra.nota_pedido || '',
              compra_certificacion_presupuestal: compra.certificacion_presupuestal || '',
              compra_id_fuente: compra.id_fuente || '',
              compra_requerido_por: compra.requerido_por || '',
              compra_concepto: compra.concepto || '',
              cuenta_contable: compra.cuenta_contable || prev.cuenta_contable || '',
              centro_costo: compra.centro_costo || prev.centro_costo || '',
            }));
          })
          .catch(() => {});
      } else if (tipo === 'INCORPORACION') {
        setDocSelectionMode('EXISTING_INCORPORACION');
        fetchIncorporacion(n_doc)
          .then((inc) => {
            setSelectedIncDetail(inc);
            setForm((prev) => ({
              ...prev,
              inc_fecha_doc: inc.fecha_doc || '',
              inc_id_localidad: inc.id_localidad || '',
              inc_nota_pedido: inc.nota_pedido || '',
              inc_certificacion_presupuestal: inc.certificacion_presupuestal || '',
              inc_id_fuente: inc.id_fuente || '',
              inc_fuente_origen: inc.fuente_origen || '',
              inc_origen: inc.origen || '',
              inc_fecha_alta: inc.fecha_alta || '',
              inc_concepto: inc.concepto || '',
              cuenta_contable: inc.cuenta_contable || prev.cuenta_contable || '',
              centro_costo: inc.centro_costo || prev.centro_costo || '',
            }));
          })
          .catch(() => {});
      } else if (tipo === 'OBRA') {
        setDocSelectionMode('EXISTING_OBRA');
        fetchObra(n_doc)
          .then((obra) => {
            setSelectedObraDetail(obra);
            setForm((prev) => ({
              ...prev,
              obra_fecha_doc: obra.fecha_doc || '',
              obra_id_localidad: obra.id_localidad || '',
              obra_nota_pedido: obra.nota_pedido || '',
              obra_certificacion_presupuestal: obra.certificacion_presupuestal || '',
              obra_id_fuente: obra.id_fuente || '',
              obra_fuente_origen: obra.fuente_origen || '',
              obra_origen: obra.origen || '',
              obra_fecha_alta: obra.fecha_alta || '',
              obra_concepto: obra.concepto || '',
              cuenta_contable: obra.cuenta_contable || prev.cuenta_contable || '',
              centro_costo: obra.centro_costo || prev.centro_costo || '',
            }));
          })
          .catch(() => {});
      }
    }
  }, [preSelectedDoc]);

  // Recargar puestos al cambiar sucursal
  useEffect(() => {
    if (form.id_sucursal) {
      fetchPuestos(form.id_sucursal)
        .then(setPuestos)
        .catch(() => setPuestos([]));
      if (!editingActivo || Number(editingActivo.id_sucursal) !== Number(form.id_sucursal)) {
        setForm((prev) => ({ ...prev, puesto_id: '', unidad: '' }));
      }
    } else {
      setPuestos([]);
      setForm((prev) => ({ ...prev, puesto_id: '', unidad: '' }));
    }
  }, [form.id_sucursal]);

  const handleSelectExistingCompra = async (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      n_doc_compra: value,
      n_doc_incorporacion: '',
      n_doc_obra: '',
      documento_tipo: 'COMPRA'
    }));
    if (value) {
      try {
        const compra = await fetchCompra(value);
        setSelectedCompraDetail(compra);
        setForm((prev) => ({
          ...prev,
          cuenta_contable: compra.cuenta_contable || prev.cuenta_contable || '',
          centro_costo: compra.centro_costo || prev.centro_costo || '',
        }));
      } catch (err) {
        setSelectedCompraDetail(null);
      }
    } else {
      setSelectedCompraDetail(null);
    }
  };

  const handleSelectExistingInc = async (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      n_doc_incorporacion: value,
      n_doc_compra: '',
      n_doc_obra: '',
      documento_tipo: 'INCORPORACION'
    }));
    if (value) {
      try {
        const inc = await fetchIncorporacion(value);
        setSelectedIncDetail(inc);
        setForm((prev) => ({
          ...prev,
          cuenta_contable: inc.cuenta_contable || prev.cuenta_contable || '',
          centro_costo: inc.centro_costo || prev.centro_costo || '',
        }));
      } catch (err) {
        setSelectedIncDetail(null);
      }
    } else {
      setSelectedIncDetail(null);
    }
  };

  const handleSelectExistingObra = async (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      n_doc_obra: value,
      n_doc_compra: '',
      n_doc_incorporacion: '',
      documento_tipo: 'OBRA'
    }));
    if (value) {
      try {
        const obra = await fetchObra(value);
        setSelectedObraDetail(obra);
        
        let autogeneratedCode = '';
        if (obra.id_localidad) {
          try {
            const resCodigo = await fetchCodigoPatrimonialObra(obra.id_localidad);
            autogeneratedCode = resCodigo.codigo;
          } catch (err) {
            console.error("Error generating patrimonial code:", err);
          }
        }

        setForm((prev) => ({
          ...prev,
          cod_patrimonial: autogeneratedCode || prev.cod_patrimonial || '',
          cuenta_contable: obra.cuenta_contable || prev.cuenta_contable || '',
          centro_costo: '', // El centro de costo se elimina / no se requiere
        }));
      } catch (err) {
        setSelectedObraDetail(null);
      }
    } else {
      setSelectedObraDetail(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'valor_en_libros' || name === 'igv') {
      const formatted = formatMonetaryInput(value);
      setForm((prev) => ({ ...prev, [name]: formatted }));
    } else if (name === 'unidad') {
      const selectedSucursal = sucursales.find(s => Number(s.value) === Number(form.id_sucursal));
      const isSedeCentral = selectedSucursal?.tipo_sucursal === 'SEDE_CENTRAL';
      if (isSedeCentral) {
        setForm((prev) => ({
          ...prev,
          unidad: value,
          puesto_id: ''
        }));
      } else {
        const postObj = puestos.find(p => String(p.value) === String(value));
        setForm((prev) => ({
          ...prev,
          puesto_id: value,
          unidad: postObj ? postObj.label : ''
        }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Validaciones extras de negocio en frontend
      if (!form.id_sucursal) {
        throw new Error("Por favor, seleccione una Sucursal.");
      }
      if (!form.cod_categoria) {
        throw new Error("Por favor, seleccione una Subcategoría.");
      }
      if (!form.denominacion || !form.denominacion.trim()) {
        throw new Error("La Denominación del activo es obligatoria.");
      }
      if (form.cod_patrimonial.length !== 9 || !/^[0-9]+$/.test(form.cod_patrimonial)) {
        throw new Error("El Código Patrimonial debe tener exactamente 9 dígitos numéricos.");
      }

      const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
      const ccClean = cleanDigits(form.cuenta_contable);
      if (!ccClean) {
        throw new Error("La Cuenta Contable es obligatoria para el activo fijo.");
      }
      if (ccClean.length !== 10) {
        throw new Error("La Cuenta Contable debe tener exactamente 10 dígitos (números).");
      }

      let ccCostoClean = null;
      if (docSelectionMode !== 'EXISTING_OBRA') {
        ccCostoClean = cleanDigits(form.centro_costo);
        if (!ccCostoClean) {
          throw new Error("El Centro de Costo es obligatorio para el activo fijo.");
        }
        if (ccCostoClean.length !== 8) {
          throw new Error("El Centro de Costo debe tener exactamente 8 dígitos (números).");
        }
      }

      let docTipo = form.documento_tipo;
      let docCompra = form.n_doc_compra;
      let docInc = form.n_doc_incorporacion;
      let docObra = form.n_doc_obra;

      if (docSelectionMode === 'EXISTING_COMPRA') {
        docTipo = 'COMPRA';
        if (!docCompra) throw new Error("Por favor, seleccione una Orden de Compra registrada.");
      } else if (docSelectionMode === 'EXISTING_INCORPORACION') {
        docTipo = 'INCORPORACION';
        if (!docInc) throw new Error("Por favor, seleccione un Documento de Incorporación registrado.");
      } else if (docSelectionMode === 'EXISTING_OBRA') {
        docTipo = 'OBRA';
        if (!docObra) throw new Error("Por favor, seleccione un Expediente de Obra registrado.");
      } else {
        // NEW DOCUMENT
        const cleanDigits = (val) => val ? val.replace(/\D/g, '') : '';
        if (docTipo === 'COMPRA') {
          docCompra = cleanDigits(form.n_doc_compra);
          if (docCompra.length !== 7) {
            throw new Error("El N° de Orden de Compra debe tener exactamente 7 dígitos (números).");
          }
          
          const npClean = cleanDigits(form.compra_nota_pedido);
          if (npClean && npClean.length > 7) {
            throw new Error("La Nota de Pedido no debe tener más de 7 dígitos.");
          }
          form.compra_nota_pedido = npClean;

          let certClean = cleanDigits(form.compra_certificacion_presupuestal);
          if (certClean && certClean.length < 4) {
            certClean = certClean.padStart(4, '0');
          }
          form.compra_certificacion_presupuestal = certClean;
        } else if (docTipo === 'INCORPORACION') {
          docInc = form.n_doc_incorporacion ? form.n_doc_incorporacion.trim() : '';
          if (!docInc) {
            throw new Error("El N° de Resolución/Expediente es requerido.");
          }
          if (docInc.length > 30) {
            throw new Error("El N° de Resolución/Expediente no debe exceder los 30 caracteres.");
          }
          
          const npClean = cleanDigits(form.inc_nota_pedido);
          if (npClean && npClean.length > 7) {
            throw new Error("La Nota de Pedido de la incorporación no debe tener más de 7 dígitos.");
          }
          form.inc_nota_pedido = npClean || null;

          let certClean = cleanDigits(form.inc_certificacion_presupuestal);
          if (certClean && certClean.length < 4) {
            certClean = certClean.padStart(4, '0');
          }
          form.inc_certificacion_presupuestal = certClean || null;
        } else {
          docObra = form.n_doc_obra ? form.n_doc_obra.trim() : '';
          if (!docObra) {
            throw new Error("El N° de Resolución/Expediente de Obra es requerido.");
          }
          if (docObra.length > 30) {
            throw new Error("El N° de Resolución/Expediente de Obra no debe exceder los 30 caracteres.");
          }
          
          const npClean = cleanDigits(form.obra_nota_pedido);
          if (npClean && npClean.length > 7) {
            throw new Error("La Nota de Pedido de la obra no debe tener más de 7 dígitos.");
          }
          form.obra_nota_pedido = npClean || null;

          let certClean = cleanDigits(form.obra_certificacion_presupuestal);
          if (certClean && certClean.length < 4) {
            certClean = certClean.padStart(4, '0');
          }
          form.obra_certificacion_presupuestal = certClean || null;
        }
      }

      const payload = {
        ...form,
        documento_tipo: docTipo,
        n_doc_compra: docTipo === 'COMPRA' ? docCompra : null,
        n_doc_incorporacion: docTipo === 'INCORPORACION' ? docInc : null,
        n_doc_obra: docTipo === 'OBRA' ? docObra : null,
        cod_categoria: Number(form.cod_categoria),
        id_sucursal: Number(form.id_sucursal),
        vida_util_anios: Number(form.vida_util_anios) || 0,
        valor_en_libros: cleanMoney(form.valor_en_libros),
        puesto_id: form.puesto_id ? Number(form.puesto_id) : null,
        igv: form.igv ? cleanMoney(form.igv) : null,
        cuenta_contable: ccClean,
        centro_costo: ccCostoClean,
        
        // Mapear campos Compra
        compra_fecha_oc: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.fecha_oc : (form.compra_fecha_oc || null),
        compra_id_localidad: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.id_localidad : (form.compra_id_localidad ? Number(form.compra_id_localidad) : null),
        compra_nota_pedido: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.nota_pedido : (form.compra_nota_pedido || null),
        compra_certificacion_presupuestal: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.certificacion_presupuestal : (form.compra_certificacion_presupuestal || null),
        compra_id_fuente: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.id_fuente : (form.compra_id_fuente ? Number(form.compra_id_fuente) : null),
        compra_requerido_por: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.requerido_por : (form.compra_requerido_por || null),
        compra_concepto: docSelectionMode === 'EXISTING_COMPRA' && selectedCompraDetail ? selectedCompraDetail.concepto : (form.compra_concepto || null),

        // Mapear campos Incorporacion
        inc_fecha_doc: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.fecha_doc : (form.inc_fecha_doc || null),
        inc_id_localidad: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.id_localidad : (form.inc_id_localidad ? Number(form.inc_id_localidad) : null),
        inc_nota_pedido: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.nota_pedido : (form.inc_nota_pedido || null),
        inc_certificacion_presupuestal: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.certificacion_presupuestal : (form.inc_certificacion_presupuestal || null),
        inc_id_fuente: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.id_fuente : (form.inc_id_fuente ? Number(form.inc_id_fuente) : null),
        inc_fuente_origen: (() => {
          if (docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail) {
            return selectedIncDetail.fuente_origen;
          }
          const selectedFuenteId = form.inc_id_fuente ? Number(form.inc_id_fuente) : null;
          if (selectedFuenteId === 5) return 'LIQ OBRAS';
          if (selectedFuenteId === 6) return 'TRANSFERENCIA';
          if (selectedFuenteId === 7) return 'DONACION';
          return null;
        })(),
        inc_origen: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.origen : (form.inc_origen || null),
        inc_fecha_alta: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.fecha_alta : (form.inc_fecha_alta || null),
        inc_concepto: docSelectionMode === 'EXISTING_INCORPORACION' && selectedIncDetail ? selectedIncDetail.concepto : (form.inc_concepto || null),

        // Mapear campos Obras
        obra_fecha_doc: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.fecha_doc : (form.obra_fecha_doc || null),
        obra_id_localidad: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.id_localidad : (form.obra_id_localidad ? Number(form.obra_id_localidad) : null),
        obra_nota_pedido: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.nota_pedido : (form.obra_nota_pedido || null),
        obra_certificacion_presupuestal: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.certificacion_presupuestal : (form.obra_certificacion_presupuestal || null),
        obra_id_fuente: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.id_fuente : (form.obra_id_fuente ? Number(form.obra_id_fuente) : null),
        obra_fuente_origen: (() => {
          if (docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail) {
            return selectedObraDetail.fuente_origen;
          }
          const selectedFuenteId = form.obra_id_fuente ? Number(form.obra_id_fuente) : null;
          if (selectedFuenteId === 5) return 'LIQ OBRAS';
          if (selectedFuenteId === 6) return 'TRANSFERENCIA';
          if (selectedFuenteId === 7) return 'DONACION';
          return null;
        })(),
        obra_origen: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.origen : (form.obra_origen || null),
        obra_fecha_alta: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.fecha_alta : (form.obra_fecha_alta || null),
        obra_concepto: docSelectionMode === 'EXISTING_OBRA' && selectedObraDetail ? selectedObraDetail.concepto : (form.obra_concepto || null),

        color: form.color || null,
        marca: form.marca || null,
        modelo: form.modelo || null,
        numero_serie: form.numero_serie || null,
        caracteristicas_accesorios: form.caracteristicas_accesorios || null,
        unidad: form.unidad || null,
        cod_personal: form.cod_personal || null,
        numero_factura: form.numero_factura || null,
        fecha_alta_factura: form.fecha_alta_factura || null,
        fecha_registro_contable: form.fecha_registro_contable || null,
        fecha_asignacion: form.fecha_asignacion || null,
        informe_conformidad: form.informe_conformidad || null,
        n_acta: form.n_acta || null,
      };

      if (isEditMode) {
        await updateActivo(form.cod_patrimonial, payload);
        if (selectedCategory && selectedCategory.toLowerCase().startsWith('vehiculo') && vehiculoDetalleData) {
          await upsertVehiculoDetalle(form.cod_patrimonial, vehiculoDetalleData);
        }
        setSuccess(true);
        reloadUltimasActas();
        if (onSuccess) onSuccess();
        if (onCancelEdit) onCancelEdit();
      } else {
        await createActivo(payload);
        if (selectedCategory && selectedCategory.toLowerCase().startsWith('vehiculo') && vehiculoDetalleData) {
          await upsertVehiculoDetalle(form.cod_patrimonial, vehiculoDetalleData);
        }
        setSuccess(true);
        reloadUltimasActas();
        const confirmAnother = window.confirm("¿Desea registrar otro activo fijo?");
        if (confirmAnother) {
          setForm((prev) => ({
            ...INITIAL_FORM_STATE,
            documento_tipo: prev.documento_tipo,
            n_doc_compra: prev.n_doc_compra,
            n_doc_incorporacion: prev.n_doc_incorporacion,
            n_doc_obra: prev.n_doc_obra,
            cuenta_contable: prev.cuenta_contable,
            centro_costo: prev.centro_costo,
          }));
          if (onSuccess) onSuccess();
        } else {
          setForm(INITIAL_FORM_STATE);
          setSelectedCompraDetail(null);
          setSelectedIncDetail(null);
          setSelectedObraDetail(null);
          if (onClearPreSelectedDoc) onClearPreSelectedDoc();
          if (onSuccess) onSuccess();
          if (onNavigateTab) onNavigateTab('DOCUMENTOS');
        }
      }
    } catch (err) {
      setError(err.message || 'Error al guardar el activo fijo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Opciones de combos
  // Obtener categorías únicas
  const uniqueCategories = [...new Set(subcategorias.map(s => s.categoria))].sort();
  const categoryOpts = uniqueCategories.map(cat => ({ value: cat, label: cat }));

  // Obtener subcategorías filtradas por la categoría seleccionada
  const subcategoriaOpts = subcategorias
    .filter(s => s.categoria === selectedCategory)
    .map(s => ({
      value: String(s.value),
      label: s.label,
    }));


  const selectedSucursal = sucursales.find(s => Number(s.value) === Number(form.id_sucursal));
  const isSedeCentral = selectedSucursal?.tipo_sucursal === 'SEDE_CENTRAL';

  const sucursalOpts = sucursales.map((s) => ({
    value: s.value,
    label: s.label,
  }));

  // Unidad Orgánica options
  let unidadOpts = [];
  if (form.id_sucursal) {
    if (isSedeCentral) {
      const departments = Array.from(
        new Set(
          puestos
            .map(p => p.departamento)
            .filter(dept => dept && dept.trim() !== '')
        )
      ).sort();
      unidadOpts = departments.map(dept => ({
        value: dept,
        label: dept
      }));
    } else {
      unidadOpts = puestos.map(p => ({
        value: String(p.value),
        label: p.label
      }));
    }
  }

  // Puesto options (filtered only in Sede Central)
  let puestoOpts = [];
  if (form.id_sucursal) {
    if (isSedeCentral) {
      const filteredPuestos = form.unidad
        ? puestos.filter(p => p.departamento === form.unidad)
        : [];
      puestoOpts = filteredPuestos.map(p => ({
        value: String(p.value),
        label: p.label
      }));
    } else {
      puestoOpts = puestos.map(p => ({
        value: String(p.value),
        label: p.label
      }));
    }
  }

  const personalOpts = personal.map((p) => ({
    value: p.value,
    label: p.label,
  }));

  const localidadOpts = localidades.map((l) => ({
    value: l.value,
    label: l.label,
  }));

  const cuentaContableOpts = cuentasContables.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const centroCostoOpts = centrosCosto.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  // Orden de Compra: Solo comprende RECURSOS ORDINARIOS (1), PMO (2), MRSE (3), PCC (4), ordenados por value (id_fuente)
  const compraFuenteOpts = fuentes
    .filter(f => [1, 2, 3, 4].includes(Number(f.value)))
    .map(f => {
      let label = f.label;
      if (Number(f.value) === 3) label = 'MRESE';
      return { value: String(f.value), label };
    })
    .sort((a, b) => Number(a.value) - Number(b.value));

  // Incorporación (Procedencia): Solo comprende Liquidación de obra (5), Transferencia (6), Donación (7), ordenados por value (id_fuente)
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

  // Orígenes fijos sugeridos
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
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {createPortal(
        (success || error) && (
          <div className="fixed top-20 right-4 left-4 md:left-auto md:w-[32rem] z-50 space-y-3 pointer-events-auto">
            {success && (
              <div className="flex items-center justify-between space-x-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl shadow-xl animate-slideInRight">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-semibold">
                    {isEditMode ? '¡Activo y expediente actualizados exitosamente en la base de datos!' : '¡Activo y expediente registrados exitosamente en la base de datos!'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="text-emerald-500 hover:text-emerald-700 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start justify-between space-x-3 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl shadow-xl animate-slideInRight">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-semibold">Error al guardar:</span>
                    <p className="mt-1 text-xs">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ),
        document.body
      )}

      {loadingListas && (
        <div className="text-center text-xs text-slate-400 py-2 animate-pulse">
          Cargando listas de referencia y combos desde la base de datos...
        </div>
      )}

      {/* SECCIÓN 1: Documento de Adquisición */}
      <div className="glass-panel rounded-xl p-5 sm:p-6 relative focus-within:z-20">
        <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          1. Documento de Adquisición (Expediente de Compra o Incorporación)
        </h3>

        {/* Sub-pestañas para seleccionar modo de asociación de documento */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-px mb-5">
          <button
            type="button"
            onClick={() => {
              setDocSelectionMode('EXISTING_COMPRA');
              setForm(prev => ({ ...prev, documento_tipo: 'COMPRA', n_doc_incorporacion: '' }));
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              docSelectionMode === 'EXISTING_COMPRA'
                ? 'bg-[#00B0F0]/10 text-[#00B0F0]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Asociar Compra Existente</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setDocSelectionMode('EXISTING_INCORPORACION');
              setForm(prev => ({ ...prev, documento_tipo: 'INCORPORACION', n_doc_compra: '', n_doc_obra: '' }));
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              docSelectionMode === 'EXISTING_INCORPORACION'
                ? 'bg-[#00B0F0]/10 text-[#00B0F0]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Asociar Incorporación Existente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDocSelectionMode('EXISTING_OBRA');
              setForm(prev => ({ ...prev, documento_tipo: 'OBRA', n_doc_compra: '', n_doc_incorporacion: '' }));
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              docSelectionMode === 'EXISTING_OBRA'
                ? 'bg-[#00B0F0]/10 text-[#00B0F0]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Asociar Obra Existente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDocSelectionMode('NEW_DOCUMENT');
              if (!isEditMode) {
                setForm(prev => ({ ...prev, n_doc_compra: '', n_doc_incorporacion: '', n_doc_obra: '' }));
              }
              setSelectedCompraDetail(null);
              setSelectedIncDetail(null);
              setSelectedObraDetail(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              docSelectionMode === 'NEW_DOCUMENT'
                ? 'bg-[#00B0F0]/10 text-[#00B0F0]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Nuevo Documento</span>
          </button>
        </div>

        {/* 1. ASOCIAR COMPRA EXISTENTE */}
        {docSelectionMode === 'EXISTING_COMPRA' && (
          <div className="space-y-4">
            <SearchableSelect
              label="Seleccionar Órden de Compra Registrada"
              name="n_doc_compra"
              value={form.n_doc_compra}
              onChange={handleSelectExistingCompra}
              options={compras.map(c => ({ value: c.n_doc, label: `OC-${c.n_doc}` }))}
              required
              placeholder="Buscar orden de compra registrada..."
            />
            
            {selectedCompraDetail && (
              <div className="p-4 bg-slate-50/70 border border-slate-200/50 rounded-2xl space-y-2 text-xs animate-fadeIn">
                <h4 className="font-extrabold text-[#00B0F0] uppercase tracking-wider mb-2">Detalles del Documento Seleccionado</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">N° Documento:</span> 
                    <span className="font-mono text-slate-800 font-bold text-sm">OC-{selectedCompraDetail.n_doc}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fecha O/C:</span> 
                    <span className="text-slate-800 font-semibold">{formatDate(selectedCompraDetail.fecha_oc)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Nota Pedido:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedCompraDetail.nota_pedido || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Certificación:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedCompraDetail.certificacion_presupuestal || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Cuenta Contable:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedCompraDetail.cuenta_contable}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Centro Costo:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedCompraDetail.centro_costo || '—'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Requerido Por:</span> 
                    <span className="text-slate-800 font-semibold">{selectedCompraDetail.requerido_por || '—'}</span>
                  </div>
                </div>
                {selectedCompraDetail.concepto && (
                  <div className="mt-2 border-t border-slate-200/50 pt-2 text-slate-600">
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Concepto:</span>
                    <p className="italic text-slate-500">{selectedCompraDetail.concepto}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. ASOCIAR INCORPORACION EXISTENTE */}
        {docSelectionMode === 'EXISTING_INCORPORACION' && (
          <div className="space-y-4">
            <SearchableSelect
              label="Seleccionar Documento de Incorporación Registrado"
              name="n_doc_incorporacion"
              value={form.n_doc_incorporacion}
              onChange={handleSelectExistingInc}
              options={incorporaciones.map(i => ({ value: i.n_doc, label: `INC-${i.n_doc}` }))}
              required
              placeholder="Buscar resolución registrada..."
            />
            
            {selectedIncDetail && (
              <div className="p-4 bg-slate-50/70 border border-slate-200/50 rounded-2xl space-y-2 text-xs animate-fadeIn">
                <h4 className="font-extrabold text-[#00B0F0] uppercase tracking-wider mb-2">Detalles del Documento Seleccionado</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">N° Documento:</span> 
                    <span className="font-mono text-slate-800 font-bold text-sm">INC-{selectedIncDetail.n_doc}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fecha Pliego:</span> 
                    <span className="text-slate-800 font-semibold">{formatDate(selectedIncDetail.fecha_doc)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fecha Alta:</span> 
                    <span className="text-slate-800 font-semibold">{formatDate(selectedIncDetail.fecha_alta)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fuente Origen:</span> 
                    <span className="text-slate-800 font-semibold">{selectedIncDetail.fuente_origen || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Origen:</span> 
                    <span className="text-slate-800 font-semibold">{selectedIncDetail.origen || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Cuenta Contable:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedIncDetail.cuenta_contable}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Centro Costo:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedIncDetail.centro_costo || '—'}</span>
                  </div>
                </div>
                {selectedIncDetail.concepto && (
                  <div className="mt-2 border-t border-slate-200/50 pt-2 text-slate-600">
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Concepto:</span>
                    <p className="italic text-slate-500">{selectedIncDetail.concepto}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2.5 ASOCIAR OBRA EXISTENTE */}
        {docSelectionMode === 'EXISTING_OBRA' && (
          <div className="space-y-4">
            <SearchableSelect
              label="Seleccionar Expediente de Obra Registrado"
              name="n_doc_obra"
              value={form.n_doc_obra}
              onChange={handleSelectExistingObra}
              options={obras.map(o => ({ value: o.n_doc, label: `OC-${o.n_doc}` }))}
              required
              placeholder="Buscar expediente de obra registrado..."
            />
            
            {selectedObraDetail && (
              <div className="p-4 bg-slate-50/70 border border-slate-200/50 rounded-2xl space-y-2 text-xs animate-fadeIn">
                <h4 className="font-extrabold text-[#00B0F0] uppercase tracking-wider mb-2">Detalles del Documento Seleccionado</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">N° Documento:</span> 
                    <span className="font-mono text-slate-800 font-bold text-sm">OC-{selectedObraDetail.n_doc}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fecha Pliego/Doc:</span> 
                    <span className="text-slate-800 font-semibold">{formatDate(selectedObraDetail.fecha_doc)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fecha Alta:</span> 
                    <span className="text-slate-800 font-semibold">{formatDate(selectedObraDetail.fecha_alta)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Fuente:</span> 
                    <span className="text-slate-800 font-semibold">{selectedObraDetail.fuente_origen || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Origen:</span> 
                    <span className="text-slate-800 font-semibold">{selectedObraDetail.origen || '—'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Cuenta Contable:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedObraDetail.cuenta_contable}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Centro Costo:</span> 
                    <span className="font-mono text-slate-800 font-semibold">{selectedObraDetail.centro_costo || '—'}</span>
                  </div>
                </div>
                {selectedObraDetail.concepto && (
                  <div className="mt-2 border-t border-slate-200/50 pt-2 text-slate-600">
                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] mb-0.5">Concepto:</span>
                    <p className="italic text-slate-500">{selectedObraDetail.concepto}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. CREAR NUEVO DOCUMENTO (INLINE) */}
        {docSelectionMode === 'NEW_DOCUMENT' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Adquisición</label>
                <select
                  name="documento_tipo"
                  value={form.documento_tipo}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700 font-semibold"
                >
                  <option value="COMPRA">Compra</option>
                  <option value="INCORPORACION">Incorporación</option>
                  <option value="OBRA">Obra en Curso</option>
                </select>
              </div>

              {form.documento_tipo === 'COMPRA' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Documento (Orden Compra) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="n_doc_compra"
                    required
                    maxLength={7}
                    value={form.n_doc_compra}
                    onChange={handleChange}
                    placeholder="Ej: 2510126"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
              )}

              {form.documento_tipo === 'INCORPORACION' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Expediente / Documento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="n_doc_incorporacion"
                    required
                    maxLength={30}
                    value={form.n_doc_incorporacion}
                    onChange={handleChange}
                    placeholder="Ej: INC-2026-001"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
              )}

              {form.documento_tipo === 'OBRA' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    N° Expediente de Obra <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="n_doc_obra"
                    required
                    maxLength={30}
                    value={form.n_doc_obra}
                    onChange={handleChange}
                    placeholder="Ej: OC-2026-001"
                    className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
              )}
            </div>

            {/* CONTENEDOR DE CAMPOS ESPECÍFICOS DE COMPRA */}
            {form.documento_tipo === 'COMPRA' && (
              <div className="mt-5 p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-4 animate-slideDown">
                <h4 className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                  Datos del Expediente de Compra
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del Documento</label>
                    <input
                      type="date"
                      name="compra_fecha_oc"
                      value={form.compra_fecha_oc}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                    />
                  </div>

                  <SearchableSelect
                    label="Localidad"
                    name="compra_id_localidad"
                    value={form.compra_id_localidad}
                    onChange={handleChange}
                    options={localidadOpts}
                    required
                    placeholder="Seleccionar localidad..."
                  />

                  <SearchableSelect
                    label="Solicitante (Personal)"
                    name="compra_requerido_por"
                    value={form.compra_requerido_por}
                    onChange={handleChange}
                    options={personalOpts}
                    required
                    placeholder="Seleccionar personal..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nota de Pedido (7 dígitos)</label>
                    <input
                      type="text"
                      name="compra_nota_pedido"
                      maxLength={7}
                      pattern="[0-9]{7}"
                      value={form.compra_nota_pedido}
                      onChange={handleChange}
                      placeholder="Ej: 0012456"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">N° Certificación (Cert. Presupuestal)</label>
                    <input
                      type="text"
                      name="compra_certificacion_presupuestal"
                      maxLength={6}
                      value={form.compra_certificacion_presupuestal}
                      onChange={handleChange}
                      placeholder="Ej: 1502 (se autocompleta con 0)"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SearchableSelect
                    label="Fuente Financ."
                    name="compra_id_fuente"
                    value={form.compra_id_fuente}
                    onChange={handleChange}
                    options={compraFuenteOpts}
                    placeholder="Seleccionar fuente..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto / Detalle de la Adquisición</label>
                  <textarea
                    name="compra_concepto"
                    rows="2"
                    value={form.compra_concepto}
                    onChange={handleChange}
                    placeholder="Especifica el concepto de la adquisición..."
                    className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                  />
                </div>
              </div>
            )}

            {/* CONTENEDOR DE CAMPOS ESPECÍFICOS DE INCORPORACIÓN */}
            {form.documento_tipo === 'INCORPORACION' && (
              <div className="mt-5 p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-4 animate-slideDown">
                <h4 className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                  Datos de la Incorporación de Activos Fijos
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del Pliego / Documento</label>
                    <input
                      type="date"
                      name="inc_fecha_doc"
                      required
                      value={form.inc_fecha_doc}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Alta (Uso del Activo)</label>
                    <input
                      type="date"
                      name="inc_fecha_alta"
                      required
                      value={form.inc_fecha_alta}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                    />
                  </div>

                  <SearchableSelect
                    label="Localidad"
                    name="inc_id_localidad"
                    value={form.inc_id_localidad}
                    onChange={handleChange}
                    options={localidadOpts}
                    required
                    placeholder="Seleccionar localidad..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SearchableSelect
                    label="Procedencia"
                    name="inc_id_fuente"
                    value={form.inc_id_fuente}
                    onChange={handleChange}
                    options={incProcedenciaOpts}
                    placeholder="Seleccionar procedencia..."
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Entidad de Origen <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="inc_origen"
                      required
                      value={form.inc_origen}
                      onChange={handleChange}
                      placeholder="Ej: Municipalidad de cualquier distrito, tercero..."
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">N° Nota de Pedido</label>
                    <input
                      type="text"
                      name="inc_nota_pedido"
                      maxLength={7}
                      value={form.inc_nota_pedido}
                      onChange={handleChange}
                      placeholder="Ej: 0012456"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">N° Certificación Presupuestal</label>
                    <input
                      type="text"
                      name="inc_certificacion_presupuestal"
                      maxLength={6}
                      value={form.inc_certificacion_presupuestal}
                      onChange={handleChange}
                      placeholder="Ej: 1502"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>
                </div>


                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto/Detalle de Incorporación</label>
                  <textarea
                    name="inc_concepto"
                    rows="2"
                    value={form.inc_concepto}
                    onChange={handleChange}
                    placeholder="Especifica el concepto de la incorporación..."
                    className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                  />
                </div>
              </div>
            )}
            {/* CONTENEDOR DE CAMPOS ESPECÍFICOS DE OBRA */}
            {form.documento_tipo === 'OBRA' && (
              <div className="mt-5 p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-4 animate-slideDown">
                <h4 className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                  Datos del Expediente de Obra en Curso
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del Expediente / Documento</label>
                    <input
                      type="date"
                      name="obra_fecha_doc"
                      required
                      value={form.obra_fecha_doc}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Alta (Uso del Activo)</label>
                    <input
                      type="date"
                      name="obra_fecha_alta"
                      required
                      value={form.obra_fecha_alta}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                    />
                  </div>

                  <SearchableSelect
                    label="Localidad"
                    name="obra_id_localidad"
                    value={form.obra_id_localidad}
                    onChange={handleChange}
                    options={localidadOpts}
                    required
                    placeholder="Seleccionar localidad..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SearchableSelect
                    label="Procedencia"
                    name="obra_id_fuente"
                    value={form.obra_id_fuente}
                    onChange={handleChange}
                    options={incProcedenciaOpts}
                    placeholder="Seleccionar procedencia..."
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Entidad de Origen <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="obra_origen"
                      required
                      value={form.obra_origen}
                      onChange={handleChange}
                      placeholder="Ej: Municipalidad de cualquier distrito, tercero..."
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">N° Nota de Pedido</label>
                    <input
                      type="text"
                      name="obra_nota_pedido"
                      maxLength={7}
                      value={form.obra_nota_pedido}
                      onChange={handleChange}
                      placeholder="Ej: 0012456"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">N° Certificación Presupuestal</label>
                    <input
                      type="text"
                      name="obra_certificacion_presupuestal"
                      maxLength={6}
                      value={form.obra_certificacion_presupuestal}
                      onChange={handleChange}
                      placeholder="Ej: 1502"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono"
                    />
                  </div>
                </div>


                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto/Detalle de Obra</label>
                  <textarea
                    name="obra_concepto"
                    rows="2"
                    value={form.obra_concepto}
                    onChange={handleChange}
                    placeholder="Especifica el concepto del expediente de obra..."
                    className="block w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-700"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: Clasificación Contable y de Costos */}
      <div className="glass-panel rounded-xl p-5 sm:p-6 relative focus-within:z-20">
        <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          2. Clasificación Contable y de Costos del Activo Fijo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Cuenta Contable <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="cuenta_contable"
              required
              maxLength={10}
              value={form.cuenta_contable}
              onChange={handleChange}
              list="cuentas-activo-form"
              placeholder="Ej: 3341151101 (10 dígitos)"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono text-slate-800"
            />
            <datalist id="cuentas-activo-form">
              {cuentaContableOpts.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </datalist>
          </div>

          {docSelectionMode !== 'EXISTING_OBRA' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Centro de Costo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="centro_costo"
                required={docSelectionMode !== 'EXISTING_OBRA'}
                maxLength={8}
                value={form.centro_costo}
                onChange={handleChange}
                list="cc-activo-form"
                placeholder="Ej: 90133301 (8 dígitos)"
                className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono text-slate-800"
              />
              <datalist id="cc-activo-form">
                {centroCostoOpts.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </datalist>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 3: Características y Especificaciones Físicas del Activo */}
      <div className="glass-panel rounded-xl p-5 sm:p-6 relative focus-within:z-20">
        <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          3. Características y Especificaciones Físicas del Activo
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Cód. Patrimonial (9 dígitos) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="cod_patrimonial"
              required
              maxLength={9}
              pattern="[0-9]{9}"
              disabled={(docSelectionMode === 'EXISTING_OBRA' && !isEditMode) || isEditMode}
              value={form.cod_patrimonial}
              onChange={handleChange}
              placeholder={docSelectionMode === 'EXISTING_OBRA' && !isEditMode ? "Autogenerado al asociar obra..." : "Ej: 310040041"}
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <SearchableSelect
            label="Categoría"
            name="selected_category"
            value={selectedCategory}
            onChange={handleCategoryChange}
            options={categoryOpts}
            required
            placeholder="Seleccionar categoría..."
          />

          <SearchableSelect
            label="Subcategoría"
            name="cod_categoria"
            value={form.cod_categoria}
            onChange={handleSubcategoryChange}
            options={subcategoriaOpts}
            required
            placeholder={selectedCategory ? "Seleccionar subcategoría..." : "Seleccione categoría primero..."}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Denominación del Activo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="denominacion"
              required
              maxLength={300}
              value={form.denominacion}
              onChange={handleChange}
              placeholder="Descripción del bien (ej. LAPTOP HP PROBOOK 450 G9)"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Vida Útil (Años)</label>
            <input
              type="number"
              name="vida_util_anios"
              value={form.vida_util_anios}
              onChange={handleChange}
              placeholder="Años"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Marca</label>
            <input type="text" name="marca" value={form.marca} onChange={handleChange} placeholder="Ej: HP, Dell"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Modelo</label>
            <input type="text" name="modelo" value={form.modelo} onChange={handleChange} placeholder="Ej: ProBook 450"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">N° Serie</label>
            <input type="text" name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="N° de Serie de fábrica"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
            <input type="text" name="color" value={form.color} onChange={handleChange} placeholder="Ej: Negro, Gris"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Características / Accesorios</label>
          <textarea name="caracteristicas_accesorios" rows="3" value={form.caracteristicas_accesorios} onChange={handleChange}
            placeholder="Especificaciones técnicas adicionales o accesorios incluidos..."
            className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
        </div>
        {selectedCategory && selectedCategory.toLowerCase().startsWith('vehiculo') && (
          <VehiculoDetalleForm
            codPatrimonial={isEditMode ? form.cod_patrimonial : null}
            onChange={setVehiculoDetalleData}
            initialData={initialVehiculoDetalle}
            selectedSubcategory={
              subcategorias.find(s => Number(s.value) === Number(form.cod_categoria))?.label || ''
            }
          />
        )}
      </div>

      {/* SECCIÓN 4: Ubicación y Asignación */}
      <div className="glass-panel rounded-xl p-5 sm:p-6 relative focus-within:z-20">
        <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          4. Ubicación y Asignación de Responsable
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label="Sucursal"
            name="id_sucursal"
            value={form.id_sucursal}
            onChange={handleChange}
            options={sucursalOpts}
            required
            placeholder="Seleccionar sucursal..."
          />
          <SearchableSelect
            label="Unidad Orgánica"
            name="unidad"
            value={isSedeCentral ? form.unidad : form.puesto_id}
            onChange={handleChange}
            options={unidadOpts}
            disabled={!form.id_sucursal}
            placeholder={form.id_sucursal ? "Seleccionar unidad orgánica..." : "— Selecciona sucursal primero —"}
            required
          />
        </div>
        <div className={`grid grid-cols-1 ${isSedeCentral ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mt-4`}>
          {isSedeCentral && (
            <SearchableSelect
              label={form.unidad ? 'Puesto Responsable' : 'Puesto Responsable (selecciona unidad orgánica primero)'}
              name="puesto_id"
              value={form.puesto_id}
              onChange={handleChange}
              options={puestoOpts}
              disabled={!form.unidad}
              placeholder={form.unidad ? 'Seleccionar puesto...' : '— Selecciona unidad orgánica primero —'}
            />
          )}
          <SearchableSelect
            label="Personal Responsable"
            name="cod_personal"
            value={form.cod_personal}
            onChange={handleChange}
            options={personalOpts}
            placeholder="Seleccionar personal..."
          />
          <div>
            <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-1">Fecha de Asignación</label>
            <input type="date" name="fecha_asignacion" value={form.fecha_asignacion} onChange={handleChange}
              className="block w-full px-3 py-2 text-sm bg-slate-50/80 border border-slate-200 rounded-lg shadow-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 transition-all font-medium text-slate-800" />
          </div>
        </div>
      </div>

      {/* SECCIÓN 5: Datos Contables y Financieros */}
      <div className="glass-panel rounded-xl p-5 sm:p-6 relative focus-within:z-20">
        <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          5. Datos Contables, Financieros y Estado del Bien
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">N° Factura</label>
            <input type="text" name="numero_factura" value={form.numero_factura} onChange={handleChange} placeholder="F001-00021"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Factura / Alta</label>
            <input type="date" name="fecha_alta_factura" value={form.fecha_alta_factura} onChange={handleChange}
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Reg. Contable</label>
            <input type="date" name="fecha_registro_contable" value={form.fecha_registro_contable} onChange={handleChange}
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Informe Conformidad</label>
            <input type="text" name="informe_conformidad" value={form.informe_conformidad} onChange={handleChange} placeholder="INF-TI-2026-004"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Valor en Libros <span className="text-rose-500">*</span>
            </label>
            <input type="text" name="valor_en_libros" required value={form.valor_en_libros} onChange={handleChange} placeholder="0.00"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-semibold" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">IGV</label>
            <input type="text" name="igv" value={form.igv} onChange={handleChange} placeholder="Opcional"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">N° Acta (Física)</label>
            <input type="text" name="n_acta" value={form.n_acta} onChange={handleChange} placeholder="Ej: 004"
              className="block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
            {ultimasActas && ultimasActas.length > 0 && (
              <div className="mt-1 text-[10px] text-slate-400 font-medium max-w-[200px] leading-tight">
                Última registrada: <span className="font-semibold text-slate-500">{`${ultimasActas[0].n_acta} (${ultimasActas[0].anio})`}</span>
              </div>
            )}
          </div>
          <SearchableSelect
            label="Estado del Bien"
            name="estado_activo"
            value={form.estado_activo}
            onChange={handleChange}
            options={[
              { value: 'BUENO', label: 'BUENO' },
              { value: 'REGULAR', label: 'REGULAR' },
              { value: 'MALO', label: 'MALO' },
              { value: 'PARA BAJA', label: 'PARA BAJA' },
              { value: 'BAJA', label: 'BAJA' }
            ]}
            required
            placeholder="Seleccionar estado..."
          />
        </div>
      </div>



      {/* Botones de Guardar / Cancelar */}
      <div className="flex justify-end items-center space-x-3 pt-4">
        {isEditMode && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-6 py-3.5 rounded-xl font-semibold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            Cancelar Edición
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
            submitting
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white active:scale-[0.98] shadow-lg shadow-brand-600/20'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Registrar Activo Fijo'}</span>
        </button>
      </div>
    </form>
  );
}
