document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let celulares = [];
  let inventario = [];
  let terceros = [];
  let regularizacion = [];
  let vehiculosCompleto = [];
  let salidas = [];
  let transferencias = [];
  let catalogosUsuario = { personal: [], sucursales: [], puestos: [] };
  let usuarioSubModulo = 'SALIDA'; // SALIDA | TRANSFERENCIA
  let currentTab = 'activos'; // activos | vehiculos | celulares | inventario | terceros (regularizacion) | soat | asignacion | salidas (usuario)
  let inventarioSubFilter = 'ALL'; // ALL | ACTIVOS | OBRAS | CONCILIACION | TERCEROS | SOBRANTE | FALTANTE
  let regularizacionSubTab = 'ALL'; // ALL | CONCILIACION | SOBRANTE | FALTANTE | TERCERO | CONTROL
  let celularVidaFilter = ''; // '' | POR_RENOVAR | VENCIDA
  let hasAppliedFilters = false;
  let currentFilteredData = [];
  let cachedInventarioUnificado = null;
  let currentPage = 1;
  let pageSize = 100;
  let colFilters = {}; // { colKey: [val1, val2, ...] }
  let colSort = { key: null, direction: null }; // { key, direction: 'asc'|'desc'|null }
  let lastBaseFilteredForCols = [];
  let lastInventarioKpiBase = [];
  let lastRegSubTabBase = [];
  let lastActivosKpiBase = [];
  let lastVehiculosKpiBase = [];
  let lastCelularesKpiBase = [];
  let activeColPopoverKey = null;
  let responsablesMap = {};
  let selectedResponsableKey = null;

  function normUpperKey(val) {
    if (!val) return '';
    return String(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  // Orden oficial jerárquico de Sucursales (SEDE CENTRAL primero, luego LA MERCED, SAN RAMÓN, etc.)
  const SUCURSALES_ORDER = [
    'SEDE CENTRAL',
    'LA MERCED',
    'SAN RAMON',
    'SAN RAMÓN',
    'PICHANAKI',
    'SANGANI',
    'OXAPAMPA',
    'VILLA RICA',
    'SATIPO',
    'PERENE',
    'PERENÉ'
  ];

  function sortSucursales(list) {
    const EXCLUDED = new Set(['SELVA CENTRAL', 'EPS SELVA CENTRAL', 'SELVA CENTRAL S.A.', 'RETIRADAS', 'SIN ASIGNAR', 'TODAS', '']);
    const cleanList = [...new Set((list || []).map(s => (s || '').trim().toUpperCase()))].filter(s => s && !EXCLUDED.has(s));

    return cleanList.sort((a, b) => {
      let idxA = SUCURSALES_ORDER.indexOf(a);
      let idxB = SUCURSALES_ORDER.indexOf(b);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b);
    });
  }

  // Helper robusto para descomponer fechas YYYY-MM-DD sin desfasar por huso horario UTC (evita desfase UTC-5)
  function parseDateParts(dateVal) {
    if (!dateVal || dateVal === '—') return { year: null, month: null };
    const dateStr = String(dateVal).trim();
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return { year: null, month: null };
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length >= 2) {
        if (parts[0].length === 4) return { year: Number(parts[0]), month: parseInt(parts[1], 10) };
        if (parts[2] && parts[2].length === 4) return { year: Number(parts[2]), month: parseInt(parts[1], 10) };
      }
    } else if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length >= 3) {
        if (parts[2].length === 4) return { year: Number(parts[2]), month: parseInt(parts[1], 10) };
        if (parts[0].length === 4) return { year: Number(parts[0]), month: parseInt(parts[1], 10) };
      }
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
    return { year: null, month: null };
  }

  // Estructuras de datos para la pestaña de Asignación (Acta-céntrica)
  let actasMap = {};
  let selectedActaKey = null;
  let currentActaSubtab = 'activos'; // 'activos' | 'obras'
  let bienesSinActa = [];
  let responsablesSinActaMap = {};
  let agencyFontBase64 = null;
  
  // Estado de Filtros de Categoría y Subcategoría (Multiselección)
  let selectedCategories = [];
  let selectedSubcategories = [];
  
  // Elementos del DOM
  const searchInput = document.getElementById('search');
  const sucursalSelect = document.getElementById('filter-sucursal');
  const localidadSelect = document.getElementById('filter-localidad');
  const estadoSelect = document.getElementById('filter-estado');

  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');
  const mobileContainer = document.getElementById('assets-mobile-container');
  
  // Selectores de Categoría y Subcategoría (Multiselección)
  const btnSelectCategoria = document.getElementById('btn-select-categoria');
  const dropdownCategoria = document.getElementById('dropdown-categoria');
  const chkAllCategoria = document.getElementById('chk-all-categoria');
  const optionsContainerCategoria = document.getElementById('options-container-categoria');
  const labelSelectCategoria = document.getElementById('label-select-categoria');
  const iconCategoria = document.getElementById('icon-categoria');

  const btnSelectSubcategoria = document.getElementById('btn-select-subcategoria');
  const dropdownSubcategoria = document.getElementById('dropdown-subcategoria');
  const chkAllSubcategoria = document.getElementById('chk-all-subcategoria');
  const optionsContainerSubcategoria = document.getElementById('options-container-subcategoria');
  const labelSelectSubcategoria = document.getElementById('label-select-subcategoria');
  const iconSubcategoria = document.getElementById('icon-subcategoria');

  // Selector de Mes (Multiselección)
  let selectedMonths = [];
  const btnSelectMonth = document.getElementById('btn-select-month');
  const dropdownMonth = document.getElementById('dropdown-month');
  const chkAllMonth = document.getElementById('chk-all-month');
  const optionsContainerMonth = document.getElementById('options-container-month');
  const labelSelectMonth = document.getElementById('label-select-month');
  const iconMonth = document.getElementById('icon-month');
  
  const statusContainer = document.getElementById('status-container');
  const statusLoading = document.getElementById('status-loading');
  const statusError = document.getElementById('status-error');

  // Contenedores del dashboard y filtros
  const searchWrapper = document.getElementById('search-filter-wrapper');
  const estadoWrapper = document.getElementById('estado-filter-wrapper');
  const dashboardContainer = document.getElementById('dashboard-container');

  // Inicializar carga
  showLoading();
  loadData();

  async function loadData() {
    try {
      // cache: 'no-cache' permite validación ETag/304 con GitHub Pages CDN (carga instantánea en visitas repetidas sin datos obsoletos)
      const fetchOpts = { cache: 'no-cache' };
      const [assetsResponse, celularesResponse, inventarioResponse, tercerosResponse, salidasResponse, transfResponse, catResponse, regResponse, vehCompResponse] = await Promise.all([
        fetch('./activos.json', fetchOpts),
        fetch('./celulares.json', fetchOpts).catch(() => null),
        fetch('./inventario_fisico.json', fetchOpts).catch(() => null),
        fetch('./bienes_terceros.json', fetchOpts).catch(() => null),
        fetch('./salidas.json', fetchOpts).catch(() => null),
        fetch('./transferencias.json', fetchOpts).catch(() => null),
        fetch('./catalogos_usuario.json', fetchOpts).catch(() => null),
        fetch('./regularizacion.json', fetchOpts).catch(() => null),
        fetch('./vehiculos_completo.json', fetchOpts).catch(() => null)
      ]);
      
      if (!assetsResponse.ok) {
        throw new Error('No se pudo encontrar el archivo de sincronización.');
      }
      assets = await assetsResponse.json();
      
      if (celularesResponse && celularesResponse.ok) {
        celulares = await celularesResponse.json();
      } else {
        celulares = [];
      }

      if (inventarioResponse && inventarioResponse.ok) {
        inventario = await inventarioResponse.json();
      } else {
        inventario = [];
      }

      if (tercerosResponse && tercerosResponse.ok) {
        terceros = await tercerosResponse.json();
      } else {
        terceros = [];
      }

      if (salidasResponse && salidasResponse.ok) {
        salidas = await salidasResponse.json();
      } else {
        salidas = [];
      }

      if (transfResponse && transfResponse.ok) {
        transferencias = await transfResponse.json();
      } else {
        transferencias = [];
      }

      if (catResponse && catResponse.ok) {
        const parsedCat = await catResponse.json();
        if (parsedCat && typeof parsedCat === 'object') {
          catalogosUsuario = {
            personal: Array.isArray(parsedCat.personal) ? parsedCat.personal : [],
            sucursales: Array.isArray(parsedCat.sucursales) ? parsedCat.sucursales : [],
            puestos: Array.isArray(parsedCat.puestos) ? parsedCat.puestos : []
          };
        }
      }

      if (regResponse && regResponse.ok) {
        regularizacion = await regResponse.json();
      } else {
        regularizacion = [];
      }

      if (vehCompResponse && vehCompResponse.ok) {
        vehiculosCompleto = await vehCompResponse.json();
      } else {
        vehiculosCompleto = [];
      }

      // Cuando se ejecuta conectado al servidor local FastAPI, refrescar salidas y transferencias en vivo
      const isLocalBackend = window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io');
      if (isLocalBackend) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 2000);
          const [liveSal, liveTr] = await Promise.all([
            fetch('/api/activos/salidas', { signal: ctrl.signal }).catch(() => null),
            fetch('/api/activos/transferencias', { signal: ctrl.signal }).catch(() => null)
          ]);
          clearTimeout(tid);
          if (liveSal && liveSal.ok) {
            const sJson = await liveSal.json();
            if (Array.isArray(sJson)) salidas = sJson;
          }
          if (liveTr && liveTr.ok) {
            const tJson = await liveTr.json();
            if (Array.isArray(tJson)) transferencias = tJson;
          }
        } catch (e) {}
      }

      // Poblar datalist oficial de puestos para el módulo Usuario
      const puestosDatalist = document.getElementById('datalist-puestos-usuario');
      if (puestosDatalist) {
        const puestosSet = new Set(catalogosUsuario.puestos || []);
        assets.forEach(a => {
          if (a.puesto) puestosSet.add(a.puesto.trim().toUpperCase());
          if (a.unidad) puestosSet.add(a.unidad.trim().toUpperCase());
        });
        puestosDatalist.innerHTML = [...puestosSet].filter(Boolean).sort().map(p => `<option value="${p}"></option>`).join('');
      }

      // Fusionar órdenes almacenadas en localStorage para no perder registros locales recientes
      try {
        const localSaved = JSON.parse(localStorage.getItem('salidas_custom_history') || '[]');
        if (Array.isArray(localSaved) && localSaved.length > 0) {
          localSaved.forEach(localItem => {
            const exists = salidas.some(s => s.n_orden === localItem.n_orden || (s.id && localItem.id && s.id === localItem.id));
            if (!exists) {
              salidas.unshift(localItem);
            }
          });
        }
      } catch (e) {}

      // Fusionar transferencias almacenadas en localStorage
      try {
        const localTransfSaved = JSON.parse(localStorage.getItem('transferencias_custom_history') || '[]');
        if (Array.isArray(localTransfSaved) && localTransfSaved.length > 0) {
          localTransfSaved.forEach(localItem => {
            const exists = transferencias.some(t => t.n_transferencia === localItem.n_transferencia || (t.id && localItem.id && t.id === localItem.id));
            if (!exists) {
              transferencias.unshift(localItem);
            }
          });
        }
      } catch (e) {}

      // Normalizar formato de ordenes legacy OS-YYYY-XXX a XXX-YYYY (ej: OS-2026-035 -> 035-2026)
      salidas.forEach(s => {
        if (s && s.n_orden && String(s.n_orden).startsWith('OS-')) {
          const parts = String(s.n_orden).split('-');
          if (parts.length === 3) {
            s.n_orden = `${parts[2]}-${parts[1]}`;
          }
        }
      });
      try {
        const localSaved = JSON.parse(localStorage.getItem('salidas_custom_history') || '[]');
        if (Array.isArray(localSaved) && localSaved.length > 0) {
          let updated = false;
          localSaved.forEach(item => {
            if (item && item.n_orden && String(item.n_orden).startsWith('OS-')) {
              const parts = String(item.n_orden).split('-');
              if (parts.length === 3) {
                item.n_orden = `${parts[2]}-${parts[1]}`;
                updated = true;
              }
            }
          });
          if (updated) {
            localStorage.setItem('salidas_custom_history', JSON.stringify(localSaved));
          }
        }
      } catch (e) {}

      // Ordenar estrictamente salidas y transferencias de mayor a menor (más reciente a más antigua)
      salidas = sortSalidasDesc(salidas);
      transferencias = sortTransferenciasDesc(transferencias);

      // Cargar tipografía en paralelo
      loadAgencyFont();

      // Construir responsablesMap para la pestaña de asignación
      responsablesMap = {};
      assets.forEach(item => {
        const resp = item.responsable ? item.responsable.trim() : '';
        if (resp) {
          if (!responsablesMap[resp]) {
            responsablesMap[resp] = {
              nombre: resp,
              puesto: item.puesto || item.unidad || '',
              sucursal: item.sucursal || '',
              bienes: []
            };
          }
          responsablesMap[resp].bienes.push(item);
          if (!responsablesMap[resp].puesto && (item.puesto || item.unidad)) {
            responsablesMap[resp].puesto = item.puesto || item.unidad;
          }
          if (!responsablesMap[resp].sucursal && item.sucursal) {
            responsablesMap[resp].sucursal = item.sucursal;
          }
        }
      });
      // Fallbacks
      Object.keys(responsablesMap).forEach(k => {
        responsablesMap[k].puesto = responsablesMap[k].puesto || '—';
        responsablesMap[k].sucursal = responsablesMap[k].sucursal || '—';
      });

      // Agrupar bienes por Acta y recopilar bienes sin Acta
      actasMap = {};
      bienesSinActa = [];
      responsablesSinActaMap = {};

      assets.forEach(item => {
        let acta = (item.n_acta_entrega || (item.n_acta ? (String(item.n_acta).includes('-') ? item.n_acta : `0${item.n_acta}-2026`) : '')).trim();
        if (acta) {
          // Normalizar formato a XXX-YYYY (sin espacios)
          acta = acta.replace(/\s*-\s*/g, '-');
          if (!actasMap[acta]) {
            actasMap[acta] = {
              n_acta: acta,
              responsable: item.responsable || '—',
              puesto: item.puesto || item.unidad || '—',
              sucursal: item.sucursal || '—',
              localidad: item.localidad || '—',
              financiado: getFinanciadoText(item) || '—',
              bienes: []
            };
          }
          actasMap[acta].bienes.push(item);
          
          if (item.responsable) actasMap[acta].responsable = item.responsable;
          if (item.puesto || item.unidad) actasMap[acta].puesto = item.puesto || item.unidad;
          if (item.sucursal) actasMap[acta].sucursal = item.sucursal;
          if (item.localidad && (!actasMap[acta].localidad || actasMap[acta].localidad === '—')) actasMap[acta].localidad = item.localidad;
          const finActa = getFinanciadoText(item);
          if (finActa && (!actasMap[acta].financiado || actasMap[acta].financiado === '—')) actasMap[acta].financiado = finActa;
        } else {
          bienesSinActa.push(item);
          const resp = item.responsable ? item.responsable.trim() : '';
          if (resp) {
            if (!responsablesSinActaMap[resp]) {
              responsablesSinActaMap[resp] = {
                nombre: resp,
                puesto: item.puesto || item.unidad || '—',
                sucursal: item.sucursal || '—',
                localidad: item.localidad || '—',
                financiado: getFinanciadoText(item) || '—',
                bienes: []
              };
            }
            responsablesSinActaMap[resp].bienes.push(item);
            if (item.localidad && (!responsablesSinActaMap[resp].localidad || responsablesSinActaMap[resp].localidad === '—')) responsablesSinActaMap[resp].localidad = item.localidad;
            const finResp = getFinanciadoText(item);
            if (finResp && (!responsablesSinActaMap[resp].financiado || responsablesSinActaMap[resp].financiado === '—')) responsablesSinActaMap[resp].financiado = finResp;
          }
        }
      });

      hideStatus();
      
      // Inicializar controladores de pestañas y filtros
      initTabs();
      populateFilters();

      // Poblar años en reporte contable a partir de la fecha de registro contable
      const contableYearSelect = document.getElementById('contable-year-select');
      if (contableYearSelect) {
        contableYearSelect.innerHTML = '<option value="Todos">Todos</option>';
        const yearsSet = new Set();
        assets.forEach(item => {
          const dateStr = item.fecha_registro_contable || item.fecha_alta_factura || item.fecha_alta;
          if (dateStr) {
            const { year: y } = parseDateParts(dateStr);
            if (y && !isNaN(y)) yearsSet.add(y);
          }
        });
        Array.from(yearsSet).sort((a, b) => b - a).forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          contableYearSelect.appendChild(opt);
        });
      }

      // Poblar localidades en reporte contable
      const contableLocalidadSelect = document.getElementById('contable-localidad-select');
      if (contableLocalidadSelect) {
        contableLocalidadSelect.innerHTML = '<option value="Todos">Todas las Localidades</option>';
        const EXCLUDED_LOCALIDADES = new Set(['SEDE CENTRAL', 'SELVA CENTRAL', 'EPS SELVA CENTRAL', 'RETIRADAS', 'SIN ASIGNAR', 'TODAS', '']);
        const LOCALIDAD_ORDER_C = ['LA MERCED', 'SAN RAMON', 'SAN RAMÓN', 'PICHANAKI', 'OXAPAMPA', 'VILLA RICA', 'SATIPO'];
        const locsSet = new Set();
        assets.forEach(item => {
          const locUpper = (item.localidad || '').trim().toUpperCase();
          if (locUpper && !EXCLUDED_LOCALIDADES.has(locUpper)) locsSet.add(locUpper);
        });
        Array.from(locsSet).sort((a, b) => {
          const ia = LOCALIDAD_ORDER_C.findIndex(o => o === a);
          const ib = LOCALIDAD_ORDER_C.findIndex(o => o === b);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.localeCompare(b);
        }).forEach(loc => {
          const opt = document.createElement('option');
          opt.value = loc;
          opt.textContent = loc;
          contableLocalidadSelect.appendChild(opt);
        });
      }

      // Poblar años en filtro global (Prioridad Fecha de Registro Contable)
      const globalYearSelect = document.getElementById('filter-global-year');
      if (globalYearSelect) {
        globalYearSelect.innerHTML = '<option value="">Todos</option>';
        const yearsSet = new Set();
        [...assets, ...regularizacion, ...vehiculosCompleto].forEach(item => {
          const dateStr = item.fecha_registro_contable || item.fecha_alta_factura || item.fecha_alta || item.fecha_ingreso || item.fecha_asignacion;
          if (dateStr) {
            const { year: y } = parseDateParts(dateStr);
            if (y && !isNaN(y)) yearsSet.add(y);
          }
        });
        Array.from(yearsSet).sort((a, b) => b - a).forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          globalYearSelect.appendChild(opt);
        });
        globalYearSelect.addEventListener('change', applyFilters);
      }

      const globalMonthSelect = document.getElementById('filter-global-month');
      if (globalMonthSelect) {
        globalMonthSelect.addEventListener('change', applyFilters);
      }

      const globalValorSelect = document.getElementById('filter-global-valor');
      if (globalValorSelect) {
        globalValorSelect.addEventListener('change', applyFilters);
      }

      // Event listeners para controles del reporte contable
      const contableDigitSelect = document.getElementById('contable-digit-select');
      const contableMonthSelect = document.getElementById('contable-month-select');
      if (contableDigitSelect) contableDigitSelect.addEventListener('change', applyFilters);
      if (contableYearSelect) contableYearSelect.addEventListener('change', applyFilters);
      if (contableMonthSelect) contableMonthSelect.addEventListener('change', applyFilters);
      const contableTypeSelect = document.getElementById('contable-type-select');
      if (contableTypeSelect) contableTypeSelect.addEventListener('change', applyFilters);
      if (contableLocalidadSelect) contableLocalidadSelect.addEventListener('change', applyFilters);

      initSalidaModule();
      initTransferenciaModule();
      initUsuarioModuleSwitcher();
      buildFastIndexes();
      initPaginationBar();
      initExcelHeaderFilters();

      const applyUsuarioHash = () => {
        const h = (window.location.hash || '').toLowerCase();
        if (h.includes('transferencia')) {
          document.getElementById('tab-salidas')?.click();
          document.getElementById('btn-usuario-mod-transferencia')?.click();
          return true;
        } else if (h.includes('salida')) {
          document.getElementById('tab-salidas')?.click();
          document.getElementById('btn-usuario-mod-salida')?.click();
          return true;
        }
        return false;
      };
      window.addEventListener('hashchange', applyUsuarioHash);
      if (!applyUsuarioHash()) {
        applyFilters();
      }
      
      // Adjuntar event listeners (búsqueda con debounce de 150ms para respuesta fluida)
      let searchDebounceTimer = null;
      searchInput.addEventListener('input', () => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          applyFilters();
        }, 150);
      });
      if (localidadSelect) {
        localidadSelect.addEventListener('change', () => {
          applyFilters();
        });
      }
      sucursalSelect.addEventListener('change', () => {
        applyFilters();
      });
      estadoSelect.addEventListener('change', applyFilters);
      const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
      if (filterSoatEstadoSelect) {
        filterSoatEstadoSelect.addEventListener('change', applyFilters);
      }

      const searchCatOpt = document.getElementById('search-categoria-opt');
      const searchSubcatOpt = document.getElementById('search-subcategoria-opt');
      if (searchCatOpt) searchCatOpt.addEventListener('input', () => populateCategoryFilters(true));
      if (searchSubcatOpt) searchSubcatOpt.addEventListener('input', () => populateSubcategoryFilters());

      // Event listeners para los dropdowns de categorías y subcategorías
      if (btnSelectCategoria && dropdownCategoria) {
        btnSelectCategoria.addEventListener('click', (e) => {
          e.stopPropagation();
          closeColFilterPopover();
          dropdownCategoria.classList.toggle('hidden');
          dropdownSubcategoria.classList.add('hidden');
          if (dropdownMonth) dropdownMonth.classList.add('hidden');

          if (dropdownCategoria.classList.contains('hidden')) {
            iconCategoria.style.transform = 'rotate(0deg)';
          } else {
            iconCategoria.style.transform = 'rotate(180deg)';
            if (searchCatOpt) {
              searchCatOpt.value = '';
              populateCategoryFilters(true);
              setTimeout(() => searchCatOpt.focus(), 20);
            }
          }
          iconSubcategoria.style.transform = 'rotate(0deg)';
          if (iconMonth) iconMonth.style.transform = 'rotate(0deg)';
        });
      }

      if (btnSelectSubcategoria && dropdownSubcategoria) {
        btnSelectSubcategoria.addEventListener('click', (e) => {
          e.stopPropagation();
          closeColFilterPopover();
          dropdownSubcategoria.classList.toggle('hidden');
          dropdownCategoria.classList.add('hidden');
          if (dropdownMonth) dropdownMonth.classList.add('hidden');

          if (dropdownSubcategoria.classList.contains('hidden')) {
            iconSubcategoria.style.transform = 'rotate(0deg)';
          } else {
            iconSubcategoria.style.transform = 'rotate(180deg)';
            if (searchSubcatOpt) {
              searchSubcatOpt.value = '';
              populateSubcategoryFilters();
              setTimeout(() => searchSubcatOpt.focus(), 20);
            }
          }
          iconCategoria.style.transform = 'rotate(0deg)';
          if (iconMonth) iconMonth.style.transform = 'rotate(0deg)';
        });
      }

      if (btnSelectMonth && dropdownMonth) {
        btnSelectMonth.addEventListener('click', (e) => {
          e.stopPropagation();
          closeColFilterPopover();
          dropdownMonth.classList.toggle('hidden');
          if (dropdownCategoria) dropdownCategoria.classList.add('hidden');
          if (dropdownSubcategoria) dropdownSubcategoria.classList.add('hidden');

          if (dropdownMonth.classList.contains('hidden')) {
            if (iconMonth) iconMonth.style.transform = 'rotate(0deg)';
          } else {
            if (iconMonth) iconMonth.style.transform = 'rotate(180deg)';
          }
          if (iconCategoria) iconCategoria.style.transform = 'rotate(0deg)';
          if (iconSubcategoria) iconSubcategoria.style.transform = 'rotate(0deg)';
        });
      }

      // Evitar que el dropdown se cierre al hacer clic adentro
      if (dropdownCategoria) {
        dropdownCategoria.addEventListener('click', (e) => e.stopPropagation());
      }
      if (dropdownSubcategoria) {
        dropdownSubcategoria.addEventListener('click', (e) => e.stopPropagation());
      }
      if (dropdownMonth) {
        dropdownMonth.addEventListener('click', (e) => e.stopPropagation());
      }

      // Cerrar dropdowns al hacer clic fuera de ellos
      document.addEventListener('click', () => {
        if (dropdownCategoria) {
          dropdownCategoria.classList.add('hidden');
          iconCategoria.style.transform = 'rotate(0deg)';
        }
        if (dropdownSubcategoria) {
          dropdownSubcategoria.classList.add('hidden');
          iconSubcategoria.style.transform = 'rotate(0deg)';
        }
        if (dropdownMonth) {
          dropdownMonth.classList.add('hidden');
          if (iconMonth) iconMonth.style.transform = 'rotate(0deg)';
        }
      });

      // Manejar "Seleccionar Todas" en Categoría
      if (chkAllCategoria) {
        chkAllCategoria.addEventListener('change', () => {
          const isChecked = chkAllCategoria.checked;
          const checkboxes = optionsContainerCategoria.querySelectorAll('.chk-cat-option');
          selectedCategories = [];
          checkboxes.forEach(chk => {
            chk.checked = isChecked;
            if (isChecked) {
              selectedCategories.push(chk.value);
            }
          });
          updateCategoryState();
          populateSubcategoryFilters();
          applyFilters();
        });
      }

      // Manejar "Seleccionar Todas" en Subcategoría
      if (chkAllSubcategoria) {
        chkAllSubcategoria.addEventListener('change', () => {
          const isChecked = chkAllSubcategoria.checked;
          const checkboxes = optionsContainerSubcategoria.querySelectorAll('.chk-subcat-option');
          selectedSubcategories = [];
          checkboxes.forEach(chk => {
            chk.checked = isChecked;
            if (isChecked) {
              selectedSubcategories.push(chk.value);
            }
          });
          updateSubcategoryState();
          applyFilters();
        });
      }

      // Event listener para borrar búsqueda
      const btnClearSearch = document.getElementById('btn-clear-search');
      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          searchInput.value = '';
          applyFilters();
        });
      }

      // Event listener para borrar todos los filtros
      const btnClearFilters = document.getElementById('btn-clear-filters');
      if (btnClearFilters) {
        btnClearFilters.addEventListener('click', clearAllActiveFilters);
      }

      // Click handlers para tarjetas KPI interactivas (Activos Fijos, Vehículos, Celulares)
      document.querySelectorAll('.act-kpi-card').forEach(card => {
        if (!card.dataset.boundClick) {
          card.dataset.boundClick = '1';
          card.addEventListener('click', () => {
            const targetEst = card.getAttribute('data-estado-kpi') || '';
            if (estadoSelect) {
              estadoSelect.value = (estadoSelect.value === targetEst && targetEst !== '') ? '' : targetEst;
            }
            applyFilters();
          });
        }
      });

      document.querySelectorAll('.veh-kpi-card').forEach(card => {
        if (!card.dataset.boundClick) {
          card.dataset.boundClick = '1';
          card.addEventListener('click', () => {
            const targetSoat = card.getAttribute('data-soat-kpi') || '';
            const soatSel = document.getElementById('filter-soat-estado');
            if (soatSel) {
              soatSel.value = (soatSel.value === targetSoat && targetSoat !== '') ? '' : targetSoat;
            }
            applyFilters();
          });
        }
      });

      document.querySelectorAll('.cel-kpi-card').forEach(card => {
        if (!card.dataset.boundClick) {
          card.dataset.boundClick = '1';
          card.addEventListener('click', () => {
            const key = card.getAttribute('data-cel-kpi') || '';
            if (key === '') {
              celularVidaFilter = '';
              if (estadoSelect) estadoSelect.value = '';
            } else if (key === 'ACTIVO') {
              celularVidaFilter = '';
              if (estadoSelect) {
                estadoSelect.value = (normUpperKey(estadoSelect.value) === 'ACTIVO') ? '' : 'ACTIVO';
              }
            } else {
              celularVidaFilter = (celularVidaFilter === key) ? '' : key;
            }
            applyFilters();
          });
        }
      });

      // Toggle de filtros en móvil
      const btnToggleFilters = document.getElementById('btn-toggle-filters');
      const filtersContent = document.getElementById('filters-content');
      if (btnToggleFilters && filtersContent) {
        btnToggleFilters.addEventListener('click', () => {
          const isHidden = filtersContent.classList.contains('hidden');
          if (isHidden) {
            filtersContent.classList.remove('hidden');
            filtersContent.classList.add('flex');
            btnToggleFilters.innerHTML = '✕ Ocultar Filtros';
            filtersContent.dataset.mobileOpen = 'true';
          } else {
            filtersContent.classList.add('hidden');
            filtersContent.classList.remove('flex');
            btnToggleFilters.innerHTML = '🔍 Mostrar Filtros';
            delete filtersContent.dataset.mobileOpen;
          }
        });

        // Asegurar que al redimensionar a desktop, los filtros sean visibles (salvo en pestañas sin filtro superior)
        window.addEventListener('resize', () => {
          if (window.innerWidth >= 768) {
            if (currentTab !== 'contable' && currentTab !== 'asignacion' && currentTab !== 'ficha' && currentTab !== 'salidas') {
              filtersContent.classList.remove('hidden');
              filtersContent.classList.add('flex');
            }
          } else {
            // En móvil, mantener oculto por defecto salvo que el usuario lo haya abierto
            if (!filtersContent.dataset.mobileOpen) {
              filtersContent.classList.add('hidden');
              filtersContent.classList.remove('flex');
            }
          }
        });
      }
      
    } catch (error) {
      showError();
    }
  }

  // Filtrar vehículos unificados (Activos Fijos + Conciliación con SOAT & RT íntegros)
  function getVehicles() {
    if (Array.isArray(vehiculosCompleto) && vehiculosCompleto.length > 0) {
      return vehiculosCompleto;
    }
    return assets.filter(item => 
      (item.categoria && item.categoria.toLowerCase().includes('vehiculo')) ||
      (item.subcategoria && item.subcategoria.toLowerCase().includes('vehiculo')) ||
      (item.cod_categoria && String(item.cod_categoria).startsWith('4')) ||
      (item.placa && item.placa !== '') ||
      (item.cuenta_contable && String(item.cuenta_contable).startsWith('334'))
    );
  }

  // Normalización rápida sin tildes para búsqueda instantánea multi-palabra
  function normFastSearch(str) {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function indexItemFast(item) {
    if (!item) return;
    item._sucU = (item.sucursal || '').trim().toUpperCase();
    item._locU = (item.localidad || '').trim().toUpperCase();
    item._estU = (item.estado_activo || item.estado || '').trim().toUpperCase();
    item._sucKey = normUpperKey(item.sucursal);
    item._locKey = normUpperKey(item.localidad);
    item._estKey = normUpperKey(item.estado_activo || item.estado);
    const dStr = item.fecha_registro_contable || item.fecha_alta_factura || item.fecha_alta || item.fecha_ingreso || item.fecha_asignacion || '';
    if (dStr) {
      const parts = parseDateParts(dStr);
      item._year = parts.year || 0;
      item._month = parts.month || 0;
    } else {
      item._year = 0;
      item._month = 0;
    }
    item._blob = normFastSearch([
      item.cod_patrimonial, item.cod_control, item.denominacion, item.marca, item.modelo,
      item.numero_serie, item.placa, item.nro_motor, item.nro_chasis, item.n_doc,
      item.cuenta_contable, item.centro_costo, item.sucursal, item.localidad,
      item.categoria, item.subcategoria, item.responsable, item.propietario_manual,
      item.puesto, item.unidad, item.imei, item.numero_linea, item.operador,
      item.tipo_origen, item.sub_modulo, item.estado_activo, item.estado, item.n_acta, item.n_acta_entrega
    ].filter(Boolean).join(' '));
  }

  function buildFastIndexes() {
    cachedInventarioUnificado = null;
    const allSrc = [...(assets || []), ...(regularizacion || []), ...(vehiculosCompleto || []), ...(celulares || []), ...(terceros || [])];
    allSrc.forEach(item => {
      indexItemFast(item);
    });
    cachedInventarioUnificado = getInventarioUnificado();
    cachedInventarioUnificado.forEach(indexItemFast);
  }

  function clearAllActiveFilters() {
    if (searchInput) searchInput.value = '';
    if (sucursalSelect) sucursalSelect.value = '';
    if (localidadSelect) localidadSelect.value = '';
    if (estadoSelect) estadoSelect.value = '';
    const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
    if (filterSoatEstadoSelect) filterSoatEstadoSelect.value = '';
    const globalYearSelect = document.getElementById('filter-global-year');
    if (globalYearSelect) globalYearSelect.value = '';
    const globalMonthSelect = document.getElementById('filter-global-month');
    if (globalMonthSelect) globalMonthSelect.value = '';
    const globalValorSelect = document.getElementById('filter-global-valor');
    if (globalValorSelect) globalValorSelect.value = '';
    const searchCatOpt = document.getElementById('search-categoria-opt');
    if (searchCatOpt) searchCatOpt.value = '';
    const searchSubcatOpt = document.getElementById('search-subcategoria-opt');
    if (searchSubcatOpt) searchSubcatOpt.value = '';

    selectedCategories = [];
    selectedSubcategories = [];
    selectedMonths = [];
    inventarioSubFilter = 'ALL';
    regularizacionSubTab = 'ALL';
    celularVidaFilter = '';
    colFilters = {};
    colSort = { key: null, direction: null };
    closeColFilterPopover();
    populateFilters();
    applyFilters();
  }

  function renderActiveFilterChips() {
    const bar = document.getElementById('active-filters-bar');
    if (!bar) return;
    if (currentTab === 'contable' || currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
      bar.innerHTML = '';
      return;
    }

    const chips = [];
    const globalYearSelect = document.getElementById('filter-global-year');
    const filterSoatSelect = document.getElementById('filter-soat-estado');
    if (searchInput && searchInput.value.trim()) {
      chips.push({ label: `Búsqueda: "${searchInput.value.trim()}"`, clear: () => { searchInput.value = ''; } });
    }
    if (localidadSelect && localidadSelect.value) {
      chips.push({ label: `Localidad: ${localidadSelect.value}`, clear: () => { localidadSelect.value = ''; } });
    }
    if (sucursalSelect && sucursalSelect.value) {
      chips.push({ label: `Sucursal: ${sucursalSelect.value}`, clear: () => { sucursalSelect.value = ''; } });
    }
    selectedCategories.forEach(cat => {
      chips.push({
        label: `Cat: ${cat}`,
        clear: () => {
          selectedCategories = selectedCategories.filter(c => c !== cat);
          populateCategoryFilters();
        }
      });
    });
    selectedSubcategories.forEach(sub => {
      chips.push({
        label: `Subcat: ${sub}`,
        clear: () => {
          selectedSubcategories = selectedSubcategories.filter(s => s !== sub);
          populateSubcategoryFilters();
        }
      });
    });
    if (estadoSelect && estadoSelect.value) {
      chips.push({ label: `Estado: ${estadoSelect.value}`, clear: () => { estadoSelect.value = ''; } });
    }
    if (filterSoatSelect && filterSoatSelect.value) {
      chips.push({ label: `SOAT: ${filterSoatSelect.value}`, clear: () => { filterSoatSelect.value = ''; } });
    }
    if (currentTab === 'celulares' && celularVidaFilter) {
      chips.push({ label: `Renovación: ${celularVidaFilter.replace('_', ' ')}`, clear: () => { celularVidaFilter = ''; } });
    }
    if (globalYearSelect && globalYearSelect.value) {
      chips.push({ label: `Año: ${globalYearSelect.value}`, clear: () => { globalYearSelect.value = ''; } });
    }
    if (selectedMonths.length > 0) {
      const mText = selectedMonths.length === 12
        ? 'Todos'
        : selectedMonths.map(v => MONTH_NAMES.find(m => m.value === String(v))?.label.slice(0, 3) || v).join(', ');
      chips.push({ label: `Meses: ${mText}`, clear: () => { selectedMonths = []; populateMonthFilters(); } });
    }
    if (currentTab === 'inventario' && inventarioSubFilter && inventarioSubFilter !== 'ALL') {
      chips.push({ label: `Tipo: ${inventarioSubFilter}`, clear: () => { inventarioSubFilter = 'ALL'; } });
    }
    if (currentTab === 'terceros' && regularizacionSubTab && regularizacionSubTab !== 'ALL') {
      chips.push({ label: `Sub-módulo: ${regularizacionSubTab}`, clear: () => { regularizacionSubTab = 'ALL'; } });
    }
    Object.keys(colFilters).forEach(k => {
      const vals = colFilters[k];
      if (Array.isArray(vals) && vals.length > 0) {
        const preview = vals.length === 1 ? (vals[0] || '(Vacío)') : `${vals.length} sel.`;
        chips.push({
          label: `Col ${k}: ${preview}`,
          clear: () => { delete colFilters[k]; }
        });
      }
    });
    if (colSort.key && colSort.direction) {
      chips.push({
        label: `Orden: ${colSort.key} ${colSort.direction === 'asc' ? '↑' : '↓'}`,
        clear: () => { colSort = { key: null, direction: null }; }
      });
    }

    if (chips.length === 0) {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = '';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-0.5';
    titleSpan.textContent = 'Filtros activos:';
    bar.appendChild(titleSpan);

    chips.forEach(ch => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-brand-50 text-brand-700 border border-brand-200/80 hover:bg-brand-100 transition-colors cursor-pointer';
      pill.innerHTML = `<span>${ch.label}</span><span class="text-brand-500 font-black ml-0.5">✕</span>`;
      pill.addEventListener('click', () => {
        ch.clear();
        applyFilters();
      });
      bar.appendChild(pill);
    });

    if (chips.length > 1) {
      const clearAll = document.createElement('button');
      clearAll.type = 'button';
      clearAll.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer';
      clearAll.textContent = '✕ Borrar todos';
      clearAll.addEventListener('click', clearAllActiveFilters);
      bar.appendChild(clearAll);
    }

    bar.classList.remove('hidden');
    bar.classList.add('flex');
  }

  function updateDashboardKpis(finalData) {
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (currentTab === 'activos') {
      const kBase = lastActivosKpiBase;
      const total = kBase.length;
      const bueno = kBase.filter(x => (x._estKey || normUpperKey(x.estado_activo)) === 'BUENO').length;
      const regMalo = kBase.filter(x => {
        const e = x._estKey || normUpperKey(x.estado_activo);
        return e === 'REGULAR' || e === 'MALO';
      }).length;
      const baja = kBase.filter(x => {
        const e = x._estKey || normUpperKey(x.estado_activo);
        return e === 'PARA BAJA' || e === 'BAJA';
      }).length;
      const sumLibros = finalData.reduce((s, a) => s + (Number(a.valor_en_libros) || 0), 0);
      const sumNeto = finalData.reduce((s, a) => s + getNetValue(a), 0);
      setTxt('activos-kpi-total', total);
      setTxt('activos-kpi-bueno', bueno);
      setTxt('activos-kpi-regmalo', regMalo);
      setTxt('activos-kpi-baja', baja);
      setTxt('activos-kpi-libros', formatMoney(sumLibros));
      setTxt('activos-kpi-neto', formatMoney(sumNeto));

      const curEst = normUpperKey(estadoSelect ? estadoSelect.value : '');
      document.querySelectorAll('.act-kpi-card').forEach(card => {
        const target = normUpperKey(card.getAttribute('data-estado-kpi') || '');
        const active = (target === '' && !curEst) || (target !== '' && curEst === target);
        card.classList.toggle('ring-2', active);
        card.classList.toggle('ring-brand-500', active);
      });
    } else if (currentTab === 'obras') {
      const sumLibros = finalData.reduce((s, a) => s + (Number(a.valor_en_libros) || 0), 0);
      const sumNeto = finalData.reduce((s, a) => s + getNetValue(a), 0);
      setTxt('obras-kpi-total', finalData.length);
      setTxt('obras-kpi-libros', formatMoney(sumLibros));
      setTxt('obras-kpi-neto', formatMoney(sumNeto));
    } else if (currentTab === 'vehiculos' || currentTab === 'soat') {
      const kBase = lastVehiculosKpiBase;
      const isBajaVeh = (r) => {
        const e = r._estKey || normUpperKey(r.estado_activo);
        return e === 'PARA BAJA' || e === 'BAJA' || r.soat_estado === 'NO_REQUIERE' || r.estado_soat === 'NO_REQUIERE';
      };
      const vigente = kBase.filter(r => !isBajaVeh(r) && (r.soat_estado === 'VIGENTE' || r.estado_soat === 'VIGENTE')).length;
      const porVencer = kBase.filter(r => !isBajaVeh(r) && (r.soat_estado === 'POR_VENCER' || r.estado_soat === 'POR_VENCER')).length;
      const vencido = kBase.filter(r => !isBajaVeh(r) && (r.soat_estado === 'VENCIDO' || r.estado_soat === 'VENCIDO')).length;
      const baja = kBase.filter(r => isBajaVeh(r)).length;
      setTxt('veh-kpi-total', kBase.length);
      setTxt('veh-kpi-vigente', vigente);
      setTxt('veh-kpi-vencer', porVencer);
      setTxt('veh-kpi-vencido', vencido);
      setTxt('veh-kpi-baja', baja);

      const soatSel = document.getElementById('filter-soat-estado');
      const curSoat = soatSel ? soatSel.value : '';
      document.querySelectorAll('.veh-kpi-card').forEach(card => {
        const target = card.getAttribute('data-soat-kpi') || '';
        const active = (target === '' && !curSoat) || (target !== '' && curSoat === target);
        card.classList.toggle('ring-2', active);
        card.classList.toggle('ring-brand-500', active);
      });
    } else if (currentTab === 'celulares') {
      const kBase = lastCelularesKpiBase;
      const activos = kBase.filter(c => normUpperKey(c.estado) === 'ACTIVO').length;
      const renovar = kBase.filter(c => c.vida_util_estado === 'POR_RENOVAR').length;
      const vencida = kBase.filter(c => c.vida_util_estado === 'VENCIDA').length;
      setTxt('cel-kpi-total', kBase.length);
      setTxt('cel-kpi-activos', activos);
      setTxt('cel-kpi-renovar', renovar);
      setTxt('cel-kpi-vencida', vencida);

      const curEst = normUpperKey(estadoSelect ? estadoSelect.value : '');
      document.querySelectorAll('.cel-kpi-card').forEach(card => {
        const key = card.getAttribute('data-cel-kpi') || '';
        const active =
          (key === '' && !curEst && !celularVidaFilter) ||
          (key === 'ACTIVO' && curEst === 'ACTIVO' && !celularVidaFilter) ||
          (key !== '' && key !== 'ACTIVO' && celularVidaFilter === key);
        card.classList.toggle('ring-2', active);
        card.classList.toggle('ring-brand-500', active);
      });
    }
  }

  function initPaginationBar() {
    const sizeSel = document.getElementById('pg-size-select');
    const btnFirst = document.getElementById('pg-first');
    const btnPrev = document.getElementById('pg-prev');
    const btnNext = document.getElementById('pg-next');
    const btnLast = document.getElementById('pg-last');

    const goToPage = (p) => {
      const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(currentFilteredData.length / pageSize));
      currentPage = Math.max(1, Math.min(p, totalPages));
      renderData(currentFilteredData, false);
      const activeContainer = document.querySelector(`#${currentTab === 'activos' ? 'assets' : currentTab}-table-container .overflow-y-auto`);
      if (activeContainer) activeContainer.scrollTop = 0;
    };

    if (sizeSel && !sizeSel.dataset.bound) {
      sizeSel.dataset.bound = '1';
      sizeSel.addEventListener('change', () => {
        pageSize = Number(sizeSel.value) || 0;
        goToPage(1);
      });
    }
    if (btnFirst && !btnFirst.dataset.bound) { btnFirst.dataset.bound = '1'; btnFirst.addEventListener('click', () => goToPage(1)); }
    if (btnPrev && !btnPrev.dataset.bound) { btnPrev.dataset.bound = '1'; btnPrev.addEventListener('click', () => goToPage(currentPage - 1)); }
    if (btnNext && !btnNext.dataset.bound) { btnNext.dataset.bound = '1'; btnNext.addEventListener('click', () => goToPage(currentPage + 1)); }
    if (btnLast && !btnLast.dataset.bound) {
      btnLast.dataset.bound = '1';
      btnLast.addEventListener('click', () => {
        const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(currentFilteredData.length / pageSize));
        goToPage(totalPages);
      });
    }
  }

  // Obtener Inventario General Unificado (cacheado tras carga inicial para respuesta <1ms)
  function getInventarioUnificado() {
    if (cachedInventarioUnificado) return cachedInventarioUnificado;
    const faltantesMap = new Map();
    const sobrantesLegacy = [];

    (regularizacion || []).forEach(reg => {
      if (String(reg.sub_modulo || '').toUpperCase() === 'FALTANTE') {
        faltantesMap.set(String(reg.cod_patrimonial || '').trim(), reg);
      }
    });
    (inventario || []).forEach(inv => {
      const tipoUpper = String(inv.tipo || '').toUpperCase().trim();
      const cod = String(inv.cod_patrimonial || '').trim();
      if (tipoUpper === 'FALTANTE' && !faltantesMap.has(cod)) {
        faltantesMap.set(cod, inv);
      } else if (tipoUpper === 'SOBRANTE') {
        sobrantesLegacy.push(inv);
      }
    });

    const unifiedList = [];
    const seenCodes = new Set();

    // 1. Activos Fijos, Obras en Curso e Incorporaciones
    (assets || []).forEach(act => {
      const cod = String(act.cod_patrimonial || '').trim();
      if (cod) seenCodes.add(cod);
      const isFaltante = faltantesMap.has(cod);
      const faltanteInfo = isFaltante ? faltantesMap.get(cod) : null;

      let tipo_origen = 'ACTIVO FIJO';
      const cta = String(act.cuenta_contable || '').trim();
      const docTipo = (act.documento_tipo || '').toUpperCase().trim();
      if (cod.startsWith('339') || cta.startsWith('339') || docTipo === 'OBRA') {
        tipo_origen = 'OBRA EN CURSO';
      } else if (docTipo === 'INCORPORACION' || act.fuente_origen) {
        tipo_origen = 'INCORPORACIÓN';
      }

      const estadoFinal = isFaltante ? 'FALTANTE' : (act.estado_activo || 'BUENO');

      unifiedList.push({
        ...act,
        tipo_origen,
        estado_activo: estadoFinal,
        is_inventario_unified: true,
        observaciones_inventario: faltanteInfo ? (faltanteInfo.observaciones || 'Reportado como Faltante en inventario') : (act.observaciones || '')
      });
    });

    // 2. Registros del módulo Regularización (CONCILIACION, SOBRANTE, TERCERO, CONTROL)
    (regularizacion || []).forEach(reg => {
      const sub = String(reg.sub_modulo || '').toUpperCase().trim();
      const cod = String(reg.cod_patrimonial || '').trim();
      if (sub === 'FALTANTE') return;
      if (cod && seenCodes.has(cod)) return;
      if (cod) seenCodes.add(cod);
      const unidadOrg = reg.puesto || reg.unidad || '';

      if (sub === 'CONCILIACION') {
        unifiedList.push({
          ...reg,
          cod_patrimonial: cod || '—',
          denominacion: reg.denominacion || 'BIEN EN CONCILIACIÓN',
          tipo_origen: 'CONCILIACIÓN',
          estado_activo: reg.estado_activo || 'REGULAR',
          documento_tipo: 'CONCILIACION',
          n_doc: 'CONCILIACIÓN',
          cuenta_contable: reg.cuenta_contable || '—',
          centro_costo: reg.centro_costo || '—',
          fecha_alta_factura: reg.fecha_alta_factura || reg.fecha_ingreso || '',
          fecha_registro_contable: reg.fecha_registro_contable || reg.fecha_alta_factura || '',
          fecha_asignacion: reg.fecha_asignacion || '',
          sucursal: reg.sucursal || '—',
          localidad: reg.localidad || '—',
          fuente: 'CONCILIACIÓN',
          categoria: reg.categoria || 'CONCILIACIÓN',
          subcategoria: reg.subcategoria || reg.categoria || 'Pendiente O/C',
          especificaciones: reg.caracteristicas_accesorios || reg.observaciones || '',
          valor_en_libros: Number(reg.valor_en_libros) || 0,
          valor_neto: Number(reg.valor_en_libros) || 0,
          depreciacion_acumulada: 0,
          responsable: reg.responsable || 'Sin Asignar',
          puesto: unidadOrg,
          observaciones: reg.observaciones || reg.observaciones_calidad || '',
          is_conciliacion_origin: true
        });
      } else if (sub === 'SOBRANTE') {
        unifiedList.push({
          ...reg,
          cod_patrimonial: cod || '—',
          denominacion: reg.denominacion || 'BIEN SOBRANTE',
          tipo_origen: 'SOBRANTE',
          estado_activo: reg.estado_activo || 'REGULAR',
          documento_tipo: 'SOBRANTE',
          n_doc: cod || 'SOBRANTE',
          cuenta_contable: '—',
          centro_costo: '—',
          fecha_alta_factura: reg.fecha_ingreso || (reg.created_at ? String(reg.created_at).split('T')[0] : ''),
          fecha_registro_contable: reg.fecha_ingreso || '',
          fecha_asignacion: reg.fecha_asignacion || '',
          sucursal: reg.sucursal || '—',
          localidad: reg.localidad || '—',
          fuente: 'SOBRANTE',
          categoria: reg.categoria || 'SOBRANTES',
          subcategoria: reg.subcategoria || reg.categoria || 'Sobrante de Inventario',
          especificaciones: reg.caracteristicas_accesorios || reg.observaciones || '',
          valor_en_libros: Number(reg.valor_en_libros) || 0,
          valor_neto: Number(reg.valor_en_libros) || 0,
          depreciacion_acumulada: 0,
          responsable: reg.responsable || 'Sin Asignar',
          puesto: unidadOrg,
          observaciones: reg.observaciones || '',
          is_sobrante_origin: true
        });
      } else if (sub === 'TERCERO' || sub === 'CONTROL') {
        const isTer = sub === 'TERCERO';
        unifiedList.push({
          ...reg,
          cod_patrimonial: cod || '—',
          denominacion: reg.denominacion || (isTer ? 'BIEN DE TERCEROS' : 'BIEN DE CONTROL'),
          tipo_origen: isTer ? 'BIEN DE TERCEROS' : 'BIEN DE CONTROL',
          estado_activo: reg.estado_activo || 'BUENO',
          documento_tipo: isTer ? 'TERCEROS' : 'CONTROL',
          n_doc: cod || '—',
          cuenta_contable: '—',
          centro_costo: '—',
          fecha_alta_factura: reg.fecha_ingreso || '',
          fecha_registro_contable: reg.fecha_ingreso || '',
          fecha_asignacion: reg.fecha_asignacion || reg.fecha_ingreso || '',
          sucursal: reg.sucursal || '—',
          localidad: reg.localidad || '—',
          fuente: isTer ? 'Bienes de Terceros' : 'Bien de Control',
          categoria: reg.categoria || (isTer ? 'BIENES DE TERCEROS' : 'CONTROL'),
          subcategoria: reg.subcategoria || (isTer ? 'Custodia / Terceros' : 'Control Interno'),
          especificaciones: reg.caracteristicas_accesorios || '',
          valor_en_libros: Number(reg.valor_en_libros) || 0,
          valor_neto: Number(reg.valor_en_libros) || 0,
          depreciacion_acumulada: 0,
          responsable: isTer ? (reg.propietario_manual || reg.responsable || 'Tercero') : (reg.responsable || 'Sin Asignar'),
          puesto: unidadOrg || (isTer ? 'Propietario / Tercero' : ''),
          observaciones: reg.observaciones || '',
          is_terceros_origin: isTer
        });
      }
    });

    // 3. Fallback legacy Terceros / Sobrantes (sin duplicar códigos)
    (terceros || []).forEach(ter => {
      const cod = String(ter.cod_patrimonial || '').trim();
      if (cod && seenCodes.has(cod)) return;
      if (cod) seenCodes.add(cod);
      const propFinal = String(ter.propietario_manual || ter.responsable || '').trim();
      const hasOwner = Boolean(propFinal && propFinal !== 'Sin Asignar' && propFinal !== '—');
      unifiedList.push({
        cod_patrimonial: cod || '—',
        denominacion: ter.denominacion || 'BIEN DE TERCEROS',
        tipo_origen: hasOwner ? 'BIEN DE TERCEROS' : 'SOBRANTE',
        estado_activo: ter.estado_activo || 'REGULAR',
        documento_tipo: 'TERCEROS',
        n_doc: cod || '—',
        cuenta_contable: '—',
        centro_costo: '—',
        fecha_alta_factura: ter.fecha_ingreso || '',
        sucursal: ter.sucursal || '—',
        localidad: ter.localidad || '—',
        fuente: hasOwner ? 'Bienes de Terceros' : 'SOBRANTE',
        categoria: 'BIENES DE TERCEROS',
        subcategoria: ter.subcategoria || 'Custodia / Terceros',
        marca: ter.marca || '',
        modelo: ter.modelo || '',
        numero_serie: ter.numero_serie || '',
        color: ter.color || '',
        especificaciones: ter.caracteristicas_accesorios || '',
        valor_en_libros: 0,
        valor_neto: 0,
        depreciacion_acumulada: 0,
        responsable: hasOwner ? propFinal : 'Sin Asignar',
        puesto: ter.puesto || '',
        observaciones: ter.observaciones || '',
        is_terceros_origin: true
      });
    });

    sobrantesLegacy.forEach(sob => {
      const sobCod = String(sob.cod_patrimonial || '').trim();
      if (sobCod && seenCodes.has(sobCod)) return;
      if (sobCod) seenCodes.add(sobCod);
      unifiedList.push({
        cod_patrimonial: sobCod || '—',
        denominacion: sob.denominacion || 'BIEN SOBRANTE',
        tipo_origen: 'SOBRANTE',
        estado_activo: sob.estado_activo || 'REGULAR',
        documento_tipo: 'SOBRANTE',
        n_doc: sobCod || '—',
        cuenta_contable: '—',
        centro_costo: '—',
        fecha_alta_factura: sob.created_at ? sob.created_at.split('T')[0] : '',
        sucursal: sob.sucursal || '—',
        localidad: sob.localidad || '—',
        fuente: 'SOBRANTE',
        categoria: sob.categoria || 'SOBRANTES',
        subcategoria: sob.subcategoria || 'Sobrante de Inventario',
        marca: sob.marca || '',
        modelo: sob.modelo || '',
        numero_serie: sob.numero_serie || '',
        color: sob.color || '',
        especificaciones: sob.caracteristicas_accesorios || sob.observaciones || '',
        valor_en_libros: 0,
        valor_neto: 0,
        depreciacion_acumulada: 0,
        responsable: 'Sin Asignar',
        puesto: '',
        observaciones: sob.observaciones || '',
        is_sobrante_origin: true
      });
    });

    // 4. Faltantes sin coincidencia en Activos Fijos
    faltantesMap.forEach((falt, cod) => {
      if (!seenCodes.has(cod)) {
        seenCodes.add(cod);
        unifiedList.push({
          cod_patrimonial: cod,
          denominacion: falt.denominacion || 'BIEN FALTANTE',
          tipo_origen: 'FALTANTE',
          estado_activo: 'FALTANTE',
          documento_tipo: 'FALTANTE',
          n_doc: cod,
          cuenta_contable: falt.cuenta_contable || '—',
          centro_costo: falt.centro_costo || '—',
          fecha_alta_factura: falt.fecha_ingreso || (falt.created_at ? String(falt.created_at).split('T')[0] : ''),
          sucursal: falt.sucursal || '—',
          localidad: falt.localidad || '—',
          fuente: 'FALTANTE',
          categoria: falt.categoria || 'FALTANTES',
          subcategoria: falt.subcategoria || 'Faltante de Inventario',
          marca: falt.marca || '',
          modelo: falt.modelo || '',
          numero_serie: falt.numero_serie || '',
          color: falt.color || '',
          especificaciones: falt.caracteristicas_accesorios || falt.observaciones || '',
          valor_en_libros: Number(falt.valor_en_libros) || 0,
          valor_neto: 0,
          depreciacion_acumulada: 0,
          responsable: falt.responsable || 'PENDIENTE DE UBICACIÓN',
          puesto: falt.puesto || falt.unidad || '',
          observaciones: falt.observaciones || '',
          is_faltante_origin: true
        });
      }
    });

    return unifiedList;
  }

  function getCurrentModuleBaseDataset() {
    if (currentTab === 'activos') return assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
    if (currentTab === 'obras') return assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
    if (currentTab === 'vehiculos' || currentTab === 'soat') return getVehicles();
    if (currentTab === 'celulares') return celulares;
    if (currentTab === 'inventario') return getInventarioUnificado();
    if (currentTab === 'terceros') return regularizacion.length > 0 ? regularizacion : terceros;
    return [];
  }

  // Rellenar dinámicamente las categorías basadas en el módulo seleccionado
  function populateCategoryFilters(searchOnly = false) {
    if (!optionsContainerCategoria) return;
    optionsContainerCategoria.innerHTML = '';

    if (!['activos', 'obras', 'vehiculos', 'soat', 'inventario', 'terceros'].includes(currentTab)) {
      updateCategoryState();
      if (!searchOnly) populateSubcategoryFilters();
      return;
    }

    const dataset = getCurrentModuleBaseDataset();
    const catCounts = new Map();
    dataset.forEach(item => {
      if (item.categoria) catCounts.set(item.categoria, (catCounts.get(item.categoria) || 0) + 1);
    });

    const catSearchEl = document.getElementById('search-categoria-opt');
    const qCat = normFastSearch(catSearchEl ? catSearchEl.value : '');
    const uniqueCategories = Array.from(catCounts.keys()).sort();
    const visibleCategories = qCat
      ? uniqueCategories.filter(cat => normFastSearch(cat).includes(qCat))
      : uniqueCategories;

    if (visibleCategories.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-[11px] text-slate-400 text-center py-2 italic';
      emptyDiv.textContent = 'Sin coincidencias';
      optionsContainerCategoria.appendChild(emptyDiv);
    } else {
      visibleCategories.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-2 min-w-0';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = cat;
        chk.className = 'chk-cat-option rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer shrink-0';
        if (selectedCategories.includes(cat)) chk.checked = true;

        chk.addEventListener('change', () => {
          if (chk.checked) {
            if (!selectedCategories.includes(cat)) selectedCategories.push(cat);
          } else {
            selectedCategories = selectedCategories.filter(c => c !== cat);
          }
          updateCategoryState();
          populateSubcategoryFilters();
          applyFilters();
        });

        const span = document.createElement('span');
        span.className = 'truncate';
        span.textContent = cat;
        left.appendChild(chk);
        left.appendChild(span);

        const cnt = document.createElement('span');
        cnt.className = 'text-[10px] font-mono text-slate-400 shrink-0';
        cnt.textContent = catCounts.get(cat) || 0;

        label.appendChild(left);
        label.appendChild(cnt);
        optionsContainerCategoria.appendChild(label);
      });
    }

    updateCategoryState();
    if (!searchOnly) {
      populateSubcategoryFilters();
      populateMonthFilters();
    }
  }

  const MONTH_NAMES = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  function updateMonthState() {
    if (!labelSelectMonth || !chkAllMonth) return;
    const checkedCount = selectedMonths.length;
    if (checkedCount === 0) {
      labelSelectMonth.textContent = 'Todos';
      chkAllMonth.checked = false;
      chkAllMonth.indeterminate = false;
    } else if (checkedCount === 12) {
      labelSelectMonth.textContent = 'Todos (12)';
      chkAllMonth.checked = true;
      chkAllMonth.indeterminate = false;
    } else if (checkedCount === 1) {
      const found = MONTH_NAMES.find(m => m.value === selectedMonths[0]);
      labelSelectMonth.textContent = found ? found.label : '1 Mes';
      chkAllMonth.checked = false;
      chkAllMonth.indeterminate = true;
    } else if (checkedCount <= 2) {
      labelSelectMonth.textContent = selectedMonths
        .map(v => MONTH_NAMES.find(m => m.value === v)?.label.substring(0, 3))
        .filter(Boolean)
        .join(', ');
      chkAllMonth.checked = false;
      chkAllMonth.indeterminate = true;
    } else {
      labelSelectMonth.textContent = `${checkedCount} Meses`;
      chkAllMonth.checked = false;
      chkAllMonth.indeterminate = true;
    }
  }

  function populateMonthFilters() {
    if (!optionsContainerMonth) return;
    optionsContainerMonth.innerHTML = '';
    
    if (chkAllMonth) {
      chkAllMonth.onchange = () => {
        const isChecked = chkAllMonth.checked;
        const checkboxes = optionsContainerMonth.querySelectorAll('.chk-month-option');
        selectedMonths = [];
        checkboxes.forEach(chk => {
          chk.checked = isChecked;
          if (isChecked) {
            selectedMonths.push(chk.value);
          }
        });
        updateMonthState();
        applyFilters();
      };
    }

    MONTH_NAMES.forEach(m => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-1.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = m.value;
      chk.className = 'chk-month-option rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer';
      if (selectedMonths.includes(m.value)) chk.checked = true;
      chk.addEventListener('change', () => {
        if (chk.checked) {
          if (!selectedMonths.includes(m.value)) selectedMonths.push(m.value);
        } else {
          selectedMonths = selectedMonths.filter(v => v !== m.value);
        }
        updateMonthState();
        applyFilters();
      });
      label.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = m.label;
      span.className = 'truncate';
      label.appendChild(span);
      optionsContainerMonth.appendChild(label);
    });
    updateMonthState();
  }

  function updateCategoryState() {
    if (!optionsContainerCategoria || !labelSelectCategoria || !chkAllCategoria) return;
    const checkboxes = optionsContainerCategoria.querySelectorAll('.chk-cat-option');
    const checkedCount = selectedCategories.length;
    
    if (checkboxes.length === 0) {
      labelSelectCategoria.textContent = 'Todas';
      chkAllCategoria.checked = false;
      chkAllCategoria.disabled = true;
      return;
    }
    
    chkAllCategoria.disabled = false;
    if (checkedCount === 0) {
      labelSelectCategoria.textContent = 'Todas';
      chkAllCategoria.checked = false;
      chkAllCategoria.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
      labelSelectCategoria.textContent = 'Todas';
      chkAllCategoria.checked = true;
      chkAllCategoria.indeterminate = false;
    } else {
      labelSelectCategoria.textContent = checkedCount === 1 ? `${selectedCategories[0]}` : `${checkedCount} Categorías`;
      chkAllCategoria.checked = false;
      chkAllCategoria.indeterminate = true;
    }
  }

  // Rellenar dinámicamente las subcategorías dependientes de la categoría seleccionada
  function populateSubcategoryFilters() {
    if (!optionsContainerSubcategoria) return;
    optionsContainerSubcategoria.innerHTML = '';

    if (!['activos', 'obras', 'vehiculos', 'soat', 'inventario', 'terceros'].includes(currentTab)) {
      updateSubcategoryState();
      return;
    }

    const dataset = getCurrentModuleBaseDataset();
    let filteredDataset = dataset;
    if (selectedCategories.length > 0) {
      filteredDataset = dataset.filter(item => selectedCategories.includes(item.categoria));
    }

    const subCounts = new Map();
    filteredDataset.forEach(item => {
      if (item.subcategoria) subCounts.set(item.subcategoria, (subCounts.get(item.subcategoria) || 0) + 1);
    });

    const uniqueSubcategories = Array.from(subCounts.keys()).sort();
    selectedSubcategories = selectedSubcategories.filter(sub => uniqueSubcategories.includes(sub));

    const subSearchEl = document.getElementById('search-subcategoria-opt');
    const qSub = normFastSearch(subSearchEl ? subSearchEl.value : '');
    const visibleSubs = qSub
      ? uniqueSubcategories.filter(sub => normFastSearch(sub).includes(qSub))
      : uniqueSubcategories;

    if (visibleSubs.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-[11px] text-slate-400 text-center py-2 italic';
      emptyDiv.textContent = 'Sin coincidencias';
      optionsContainerSubcategoria.appendChild(emptyDiv);
    } else {
      visibleSubs.forEach(sub => {
        const label = document.createElement('label');
        label.className = 'flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-2 min-w-0';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = sub;
        chk.className = 'chk-subcat-option rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer shrink-0';
        if (selectedSubcategories.includes(sub)) chk.checked = true;

        chk.addEventListener('change', () => {
          if (chk.checked) {
            if (!selectedSubcategories.includes(sub)) selectedSubcategories.push(sub);
          } else {
            selectedSubcategories = selectedSubcategories.filter(s => s !== sub);
          }
          updateSubcategoryState();
          applyFilters();
        });

        const span = document.createElement('span');
        span.className = 'truncate';
        span.textContent = sub;
        left.appendChild(chk);
        left.appendChild(span);

        const cnt = document.createElement('span');
        cnt.className = 'text-[10px] font-mono text-slate-400 shrink-0';
        cnt.textContent = subCounts.get(sub) || 0;

        label.appendChild(left);
        label.appendChild(cnt);
        optionsContainerSubcategoria.appendChild(label);
      });
    }

    updateSubcategoryState();
  }

  function updateSubcategoryState() {
    if (!optionsContainerSubcategoria || !labelSelectSubcategoria || !chkAllSubcategoria) return;
    const checkboxes = optionsContainerSubcategoria.querySelectorAll('.chk-subcat-option');
    const checkedCount = selectedSubcategories.length;
    
    if (checkboxes.length === 0) {
      labelSelectSubcategoria.textContent = 'Todas';
      chkAllSubcategoria.checked = false;
      chkAllSubcategoria.disabled = true;
      return;
    }
    
    chkAllSubcategoria.disabled = false;
    if (checkedCount === 0) {
      labelSelectSubcategoria.textContent = 'Todas';
      chkAllSubcategoria.checked = false;
      chkAllSubcategoria.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
      labelSelectSubcategoria.textContent = 'Todas';
      chkAllSubcategoria.checked = true;
      chkAllSubcategoria.indeterminate = false;
    } else {
      labelSelectSubcategoria.textContent = checkedCount === 1 ? `${selectedSubcategories[0]}` : `${checkedCount} Subcategorías`;
      chkAllSubcategoria.checked = false;
      chkAllSubcategoria.indeterminate = true;
    }
  }

  function populateSucursalSelectOptions(preferredSucVal = null) {
    if (!sucursalSelect) return;
    const prevKey = normUpperKey(preferredSucVal !== null ? preferredSucVal : sucursalSelect.value);
    const allItems = [...assets, ...celulares, ...inventario, ...terceros, ...regularizacion, ...vehiculosCompleto];

    const sucCandidates = allItems
      .filter(item => Boolean(item.sucursal))
      .map(item => item.sucursal);

    const sucursalNames = sortSucursales(sucCandidates);
    sucursalSelect.innerHTML = '<option value="">Todas</option>';
    sucursalNames.forEach(suc => {
      const option = document.createElement('option');
      option.value = suc;
      option.textContent = suc;
      if (prevKey && normUpperKey(suc) === prevKey) {
        option.selected = true;
      }
      sucursalSelect.appendChild(option);
    });
  }

  // Rellenar dinámicamente las sucursales, localidades y estados basados en el módulo seleccionado
  function populateFilters() {
    const previousSucursal = sucursalSelect.value;
    const previousLocalidad = localidadSelect ? localidadSelect.value : '';
    const previousEstado = estadoSelect.value;

    const label = document.getElementById('filter-estado-label');
    const isVehiculo = currentTab === 'vehiculos' || currentTab === 'soat';
    if (label) {
      label.textContent = isVehiculo ? 'Estado Vehículo' : (currentTab === 'celulares' ? 'Estado Equipo' : 'Estado');
    }

    if (localidadSelect) {
      localidadSelect.innerHTML = '<option value="">Todas</option>';
    }
    estadoSelect.innerHTML = '<option value="">Todos</option>';

    let stateOptions = [];
    if (currentTab === 'celulares') {
      stateOptions = [...new Set(celulares.map(c => normUpperKey(c.estado)).filter(Boolean))];
      if (stateOptions.length === 0) stateOptions = ['ACTIVO', 'INACTIVO'];
    } else if (currentTab === 'inventario') {
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA', 'FALTANTE'];
    } else {
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    }

    const allItems = [...assets, ...celulares, ...inventario, ...terceros, ...regularizacion, ...vehiculosCompleto];

    // Poblar Localidades con orden oficial (de-duplicando variantes con/sin tilde)
    if (localidadSelect) {
      const EXCLUDED_LOCALIDADES = new Set(['SEDE CENTRAL', 'SELVA CENTRAL', 'EPS SELVA CENTRAL', 'RETIRADAS', 'SIN ASIGNAR', 'TODAS', '']);
      const LOCALIDAD_ORDER_KEYS = ['LA MERCED', 'SAN RAMON', 'PICHANAKI', 'OXAPAMPA', 'VILLA RICA', 'SATIPO'];
      const locByKey = new Map();
      allItems.forEach(item => {
        const raw = (item.localidad || '').trim().toUpperCase();
        const k = normUpperKey(raw);
        if (k && !EXCLUDED_LOCALIDADES.has(k) && !locByKey.has(k)) {
          locByKey.set(k, raw);
        }
      });
      const prevLocKey = normUpperKey(previousLocalidad);
      Array.from(locByKey.entries()).sort(([ka, la], [kb, lb]) => {
        const ia = LOCALIDAD_ORDER_KEYS.indexOf(ka);
        const ib = LOCALIDAD_ORDER_KEYS.indexOf(kb);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return la.localeCompare(lb);
      }).forEach(([k, locLabel]) => {
        const option = document.createElement('option');
        option.value = k;
        option.textContent = locLabel;
        if (prevLocKey && k === prevLocKey) {
          option.selected = true;
        }
        localidadSelect.appendChild(option);
      });
    }

    // Poblar todas las Sucursales de forma independiente a Localidad
    populateSucursalSelectOptions(previousSucursal);
    
    // Poblar Estados
    stateOptions.forEach(est => {
      const option = document.createElement('option');
      option.value = est;
      let labelText = est;
      if (currentTab === 'soat') {
        if (est === 'VIGENTE') labelText = 'Vigente';
        else if (est === 'POR_VENCER') labelText = 'Por Vencer';
        else if (est === 'VENCIDO') labelText = 'Vencido';
      }
      option.textContent = labelText;
      if (est === previousEstado) {
        option.selected = true;
      }
      estadoSelect.appendChild(option);
    });

    // Poblar filtros de categorías
    populateCategoryFilters();
  }

  function initTabs() {
    const tabActivos = document.getElementById('tab-activos');
    const tabFicha = document.getElementById('tab-ficha');
    const tabObras = document.getElementById('tab-obras');
    const tabVehiculos = document.getElementById('tab-vehiculos');
    const tabSalidas = document.getElementById('tab-salidas');
    const tabSoat = document.getElementById('tab-soat');
    const tabCelulares = document.getElementById('tab-celulares');
    const tabInventario = document.getElementById('tab-inventario');
    const tabTerceros = document.getElementById('tab-terceros');
    const tabAsignacion = document.getElementById('tab-asignacion');
    const tabContable = document.getElementById('tab-contable');
    const moduleTitle = document.getElementById('module-title');
    
    function switchTab(newTab) {
      currentTab = newTab;
      
      // Resetear filtros de categoría, subcategoría, estado específico y columnas al cambiar de pestaña
      selectedCategories = [];
      selectedSubcategories = [];
      celularVidaFilter = '';
      colFilters = {};
      colSort = { key: null, direction: null };
      const searchCatOpt = document.getElementById('search-categoria-opt');
      if (searchCatOpt) searchCatOpt.value = '';
      const searchSubcatOpt = document.getElementById('search-subcategoria-opt');
      if (searchSubcatOpt) searchSubcatOpt.value = '';
      closeColFilterPopover();
      
      // Resetear clases de pestañas
      [tabActivos, tabFicha, tabObras, tabVehiculos, tabSalidas, tabSoat, tabCelulares, tabInventario, tabTerceros, tabAsignacion, tabContable].forEach(btn => {
        if (btn) {
          btn.className = "px-3.5 py-2 text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 whitespace-nowrap shrink-0 flex-1 text-center";
        }
      });
      
      // Resetear clases de pestañas móviles
      const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');
      mobileMenuItems.forEach(btn => {
        const tabKey = btn.getAttribute('data-tab');
        if (tabKey === currentTab) {
          btn.className = "mobile-menu-item w-full flex items-center gap-3 px-4 py-3 text-[0.875rem] font-extrabold rounded-xl transition-all border-none bg-brand-500 text-white shadow-md shadow-brand-500/15 cursor-pointer text-left";
        } else {
          btn.className = "mobile-menu-item w-full flex items-center gap-3 px-4 py-3 text-[0.875rem] font-bold rounded-xl transition-all border-none text-slate-700 hover:bg-slate-200/60 cursor-pointer text-left";
        }
      });
      
      let activeBtn;
      if (currentTab === 'activos') {
        activeBtn = tabActivos;
        moduleTitle.textContent = 'CATÁLOGO DE ACTIVOS FIJOS';
      } else if (currentTab === 'ficha') {
        activeBtn = tabFicha;
        moduleTitle.textContent = 'FICHA DEL ACTIVO';
      } else if (currentTab === 'obras') {
        activeBtn = tabObras;
        moduleTitle.textContent = 'OBRAS EN CURSO (PMO)';
      } else if (currentTab === 'vehiculos') {
        activeBtn = tabVehiculos;
        moduleTitle.textContent = 'VEHÍCULOS - SOAT & REVISIÓN TÉCNICA VEHICULAR';
      } else if (currentTab === 'salidas') {
        activeBtn = tabSalidas;
        moduleTitle.textContent = usuarioSubModulo === 'TRANSFERENCIA'
          ? 'USUARIO — TRANSFERENCIA INTERNA DE BIENES'
          : 'USUARIO — SALIDA DE BIENES';
      } else if (currentTab === 'soat') {
        activeBtn = tabSoat;
        moduleTitle.textContent = 'MONITOREO DE SOAT Y REVISIÓN TÉCNICA VEHICULAR';
      } else if (currentTab === 'celulares') {
        activeBtn = tabCelulares;
        moduleTitle.textContent = 'EQUIPOS CELULARES';
      } else if (currentTab === 'inventario') {
        activeBtn = tabInventario;
        moduleTitle.textContent = 'INVENTARIO GENERAL DE ACTIVOS Y BIENES';
      } else if (currentTab === 'terceros') {
        activeBtn = tabTerceros;
        moduleTitle.textContent = 'REGULARIZACIÓN PATRIMONIAL (NIIF / NIC 16)';
      } else if (currentTab === 'asignacion') {
        activeBtn = tabAsignacion;
        moduleTitle.textContent = 'ACTA DE BIENES';
      } else if (currentTab === 'contable') {
        activeBtn = tabContable;
        moduleTitle.textContent = 'REPORTE CONTABLE';
      }
      
      if (activeBtn) {
        activeBtn.className = "px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-brand-500 text-white shadow-md shadow-brand-500/15 whitespace-nowrap shrink-0 flex-1 text-center";
      }

      // Mostrar/Ocultar el filtro de Sucursal y Localidad
      const sucursalWrapper = document.getElementById('sucursal-filter-wrapper');
      const localidadWrapper = document.getElementById('localidad-filter-wrapper');
      
      if (currentTab === 'contable' || currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
        if (sucursalWrapper) sucursalWrapper.classList.add('hidden');
        if (localidadWrapper) localidadWrapper.classList.add('hidden');
      } else {
        if (sucursalWrapper) sucursalWrapper.classList.remove('hidden');
        if (localidadWrapper) localidadWrapper.classList.remove('hidden');
      }

      // Actualizar etiqueta del filtro de Estado
      const filterEstadoLabel = document.getElementById('filter-estado-label');
      if (filterEstadoLabel) {
        if (currentTab === 'vehiculos' || currentTab === 'soat') {
          filterEstadoLabel.textContent = 'Estado Vehículo';
        } else {
          filterEstadoLabel.textContent = 'Estado del Activo';
        }
      }

      // Mostrar/Ocultar el filtro de Categoría y Subcategoría (sólo si aplica)
      const categoriaWrapper = document.getElementById('categoria-filter-wrapper');
      const subcategoriaWrapper = document.getElementById('subcategoria-filter-wrapper');
      const hasCategories = currentTab === 'activos' || currentTab === 'obras' || currentTab === 'inventario' || currentTab === 'terceros';
      if (hasCategories && currentTab !== 'contable' && currentTab !== 'asignacion' && currentTab !== 'ficha') {
        if (categoriaWrapper) categoriaWrapper.classList.remove('hidden');
        if (subcategoriaWrapper) subcategoriaWrapper.classList.remove('hidden');
      } else {
        if (categoriaWrapper) categoriaWrapper.classList.add('hidden');
        if (subcategoriaWrapper) subcategoriaWrapper.classList.add('hidden');
      }

      // Cerrar paneles desplegables de categorías y resetear rotaciones
      if (dropdownCategoria) dropdownCategoria.classList.add('hidden');
      if (dropdownSubcategoria) dropdownSubcategoria.classList.add('hidden');
      if (iconCategoria) iconCategoria.style.transform = 'rotate(0deg)';
      if (iconSubcategoria) iconSubcategoria.style.transform = 'rotate(0deg)';

      // Re-poblar filtros y aplicar
      populateFilters();
      applyFilters();

      // Mostrar/Ocultar contenedores de filtros y tablas según la pestaña
      const excelBtn = document.getElementById('btn-export-excel');
      const pdfBtn = document.getElementById('btn-export-pdf');

      // Ocultar filtros globales superiores para Reporte Contable, Asignación de Bienes y Ficha del Activo
      const globalYearWrapper = document.getElementById('global-year-filter-wrapper');
      const globalMonthWrapper = document.getElementById('global-month-filter-wrapper');
      const filtersContentContainer = document.getElementById('filters-content');

      if (currentTab === 'contable' || currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
        searchWrapper.classList.add('hidden');
        estadoWrapper.classList.add('hidden');
        if (globalYearWrapper) globalYearWrapper.classList.add('hidden');
        if (globalMonthWrapper) globalMonthWrapper.classList.add('hidden');
        if (filtersContentContainer) {
          filtersContentContainer.classList.add('hidden');
          filtersContentContainer.classList.remove('md:flex');
        }
        const btnClearFilters = document.getElementById('btn-clear-filters');
        if (btnClearFilters) btnClearFilters.classList.add('hidden');
      } else {
        searchWrapper.classList.remove('hidden');
        estadoWrapper.classList.remove('hidden');
        if (globalYearWrapper) globalYearWrapper.classList.remove('hidden');
        if (globalMonthWrapper) globalMonthWrapper.classList.remove('hidden');
        if (filtersContentContainer) {
          filtersContentContainer.classList.remove('hidden');
          filtersContentContainer.classList.add('md:flex');
        }
      }

      const soatEstadoWrapper = document.getElementById('soat-estado-filter-wrapper');
      if (soatEstadoWrapper) {
        if (currentTab === 'soat' || currentTab === 'vehiculos') {
          soatEstadoWrapper.classList.remove('hidden');
        } else {
          soatEstadoWrapper.classList.add('hidden');
        }
      }

      // Ocultar filtro Valor Libros / Neto para Activos Fijos y Obras en Curso
      const globalValorFilterWrapper = document.getElementById('global-valor-filter-wrapper');
      if (globalValorFilterWrapper) {
        if (currentTab === 'activos' || currentTab === 'obras' || currentTab === 'contable' || currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
          globalValorFilterWrapper.classList.add('hidden');
          const globalValorSelect = document.getElementById('filter-global-valor');
          if (globalValorSelect) globalValorSelect.value = '';
        } else {
          globalValorFilterWrapper.classList.remove('hidden');
        }
      }
      
      if (currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
        resultsCount.classList.add('hidden');
        if (excelBtn) excelBtn.classList.add('hidden');
        if (pdfBtn) pdfBtn.classList.add('hidden');
      } else {
        resultsCount.classList.remove('hidden');
        if (excelBtn) excelBtn.classList.remove('hidden');
        if (pdfBtn) pdfBtn.classList.remove('hidden');
      }
    }
    
    if (tabActivos) tabActivos.addEventListener('click', () => switchTab('activos'));
    if (tabFicha) tabFicha.addEventListener('click', () => switchTab('ficha'));
    if (tabObras) tabObras.addEventListener('click', () => switchTab('obras'));
    if (tabVehiculos) tabVehiculos.addEventListener('click', () => switchTab('vehiculos'));
    if (tabSalidas) tabSalidas.addEventListener('click', () => switchTab('salidas'));
    if (tabSoat) tabSoat.addEventListener('click', () => switchTab('soat'));
    if (tabCelulares) tabCelulares.addEventListener('click', () => switchTab('celulares'));
    if (tabInventario) tabInventario.addEventListener('click', () => switchTab('inventario'));
    if (tabTerceros) tabTerceros.addEventListener('click', () => switchTab('terceros'));
    if (tabAsignacion) tabAsignacion.addEventListener('click', () => switchTab('asignacion'));
    if (tabContable) tabContable.addEventListener('click', () => switchTab('contable'));

    // Controladores del Menú Lateral Móvil (Drawer)
    const drawer = document.getElementById('mobile-menu-drawer');
    const overlay = document.getElementById('mobile-menu-overlay');
    const drawerContent = document.getElementById('mobile-menu-content');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');

    function openMobileMenu() {
      if (!drawer) return;
      drawer.classList.remove('invisible');
      drawer.offsetWidth; // Forzar reflow
      overlay.classList.remove('opacity-0');
      overlay.classList.add('opacity-100');
      drawerContent.classList.remove('-translate-x-full');
      drawerContent.classList.add('translate-x-0');
      document.body.classList.add('overflow-hidden');
    }

    function closeMobileMenu() {
      if (!drawer) return;
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      drawerContent.classList.remove('translate-x-0');
      drawerContent.classList.add('-translate-x-full');
      
      setTimeout(() => {
        drawer.classList.add('invisible');
      }, 300);
      document.body.classList.remove('overflow-hidden');
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openMobileMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);

    // Configurar botones del menú móvil
    const mobileMenuItemsList = document.querySelectorAll('.mobile-menu-item');
    mobileMenuItemsList.forEach(item => {
      item.addEventListener('click', () => {
        const tabKey = item.getAttribute('data-tab');
        const desktopTabId = `tab-${tabKey === 'activos' ? 'activos' : tabKey}`;
        const desktopBtn = document.getElementById(desktopTabId);
        if (desktopBtn) {
          desktopBtn.click();
        }
        closeMobileMenu();
      });
    });

    // Inicializar estado del menú móvil
    const activeMobileMenuButton = Array.from(mobileMenuItemsList).find(item => item.getAttribute('data-tab') === currentTab);
    if (activeMobileMenuButton) {
      activeMobileMenuButton.className = "mobile-menu-item w-full flex items-center gap-3 px-4 py-3 text-[0.875rem] font-extrabold rounded-xl transition-all border-none bg-brand-500 text-white shadow-md shadow-brand-500/15 cursor-pointer text-left";
    }
  }

  // Filtrado del cliente
  function applyFilters() {
    hasAppliedFilters = true;
    if (currentTab === 'asignacion' || currentTab === 'ficha') {
      renderActiveFilterChips();
      renderData([]);
      return;
    }
    const query = searchInput.value.toLowerCase().trim();
    const selectedSucursal = sucursalSelect.value;
    const selectedLocalidad = localidadSelect ? localidadSelect.value : '';
    const selectedEstado = estadoSelect.value;
    const globalYearSelect = document.getElementById('filter-global-year');
    const selectedGlobalYear = globalYearSelect ? globalYearSelect.value : '';
    const globalMonthSelect = document.getElementById('filter-global-month');
    const selectedGlobalMonth = globalMonthSelect ? globalMonthSelect.value : '';
    const globalValorSelect = document.getElementById('filter-global-valor');
    const selectedGlobalValor = globalValorSelect ? globalValorSelect.value : '';

    // Show/hide X button inside search
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (btnClearSearch) {
      btnClearSearch.classList.toggle('hidden', searchInput.value.trim() === '');
    }

    const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
    const selectedSoatEstado = filterSoatEstadoSelect ? filterSoatEstadoSelect.value : '';

    // Show/hide Clear Filters button
    const btnClearFilters = document.getElementById('btn-clear-filters');
    const filtersContentContainer = document.getElementById('filters-content');
    if (currentTab === 'contable' || currentTab === 'asignacion' || currentTab === 'ficha' || currentTab === 'salidas') {
      if (filtersContentContainer) {
        filtersContentContainer.classList.add('hidden');
        filtersContentContainer.classList.remove('md:flex');
      }
      if (btnClearFilters) btnClearFilters.classList.add('hidden');
    } else if (btnClearFilters) {
      const hasActiveFilters =
        searchInput.value.trim() !== '' ||
        (selectedSucursal && selectedSucursal !== '') ||
        (selectedLocalidad && selectedLocalidad !== '') ||
        (selectedEstado && selectedEstado !== '') ||
        (selectedSoatEstado && selectedSoatEstado !== '') ||
        Boolean(celularVidaFilter) ||
        selectedCategories.length > 0 ||
        selectedSubcategories.length > 0 ||
        selectedMonths.length > 0 ||
        Object.keys(colFilters).length > 0 ||
        Boolean(colSort.key) ||
        selectedGlobalYear || selectedGlobalMonth || selectedGlobalValor;
      btnClearFilters.classList.toggle('hidden', !hasActiveFilters);
    }

    let baseData = [];
    if (currentTab === 'activos') {
      baseData = assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'obras') {
      baseData = assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'vehiculos' || currentTab === 'soat') {
      baseData = getVehicles();
    } else if (currentTab === 'celulares') {
      baseData = celulares;
    } else if (currentTab === 'inventario') {
      baseData = getInventarioUnificado();
    } else if (currentTab === 'terceros') {
      baseData = regularizacion.length > 0 ? regularizacion : terceros;
    } else if (currentTab === 'salida-tabla' || currentTab === 'salidas') {
      baseData = (usuarioSubModulo === 'TRANSFERENCIA') ? transferencias : salidas;
    } else if (currentTab === 'contable') {
      baseData = assets;
    }

    const selSucKey = normUpperKey(selectedSucursal);
    const selLocKey = normUpperKey(selectedLocalidad);
    const selEstKey = normUpperKey(selectedEstado);
    const selYearNum = selectedGlobalYear ? Number(selectedGlobalYear) : 0;
    const selMonthNum = selectedGlobalMonth ? Number(selectedGlobalMonth) : 0;
    const selMonthsSet = selectedMonths.length > 0 ? new Set(selectedMonths.map(Number)) : null;
    const searchTerms = query ? normFastSearch(query).split(/\s+/).filter(Boolean) : [];
    const hasCategoriesTab = ['activos', 'obras', 'vehiculos', 'soat', 'inventario', 'terceros'].includes(currentTab);
    const selCatsSet = (hasCategoriesTab && selectedCategories.length > 0) ? new Set(selectedCategories) : null;
    const selSubcatsSet = (hasCategoriesTab && selectedSubcategories.length > 0) ? new Set(selectedSubcategories) : null;

    const passesCommonFilters = (item) => {
      if (selSucKey && (item._sucKey ?? normUpperKey(item.sucursal)) !== selSucKey) return false;
      if (selLocKey && (item._locKey ?? normUpperKey(item.localidad)) !== selLocKey) return false;
      if (selCatsSet && !selCatsSet.has(item.categoria)) return false;
      if (selSubcatsSet && !selSubcatsSet.has(item.subcategoria)) return false;

      if (selYearNum && (item._year || 0) !== selYearNum) return false;
      if (selMonthsSet) {
        if (!item._month || !selMonthsSet.has(item._month)) return false;
      } else if (selMonthNum && (item._month || 0) !== selMonthNum) {
        return false;
      }

      if (selectedGlobalValor) {
        const valorLibros = Number(item.valor_en_libros) || 0;
        const depAcum = Number(item.depreciacion_acumulada) || 0;
        const valorNeto = Math.max(0, valorLibros - depAcum);
        if (selectedGlobalValor === 'MAJOR_0' && !(valorLibros > 0)) return false;
        if (selectedGlobalValor === '1_1000' && !(valorLibros > 0 && valorLibros <= 1000)) return false;
        if (selectedGlobalValor === '1000_10000' && !(valorLibros > 1000 && valorLibros <= 10000)) return false;
        if (selectedGlobalValor === '10000_PLUS' && !(valorLibros > 10000)) return false;
        if (selectedGlobalValor === 'DEPRECIADO' && !(valorLibros > 0 && valorNeto <= 1)) return false;
      }

      if (searchTerms.length > 0) {
        const blob = item._blob || '';
        for (let t = 0; t < searchTerms.length; t++) {
          if (!blob.includes(searchTerms[t])) return false;
        }
      }
      return true;
    };

    const passesEstadoAndSoat = (item, skipEstado = false, skipSoat = false) => {
      if (!skipEstado && selEstKey) {
        const itemEst = item._estKey ?? normUpperKey(currentTab === 'celulares' ? item.estado : item.estado_activo);
        if (itemEst !== selEstKey) return false;
      }
      if (!skipEstado && currentTab === 'celulares' && celularVidaFilter) {
        if (item.vida_util_estado !== celularVidaFilter) return false;
      }
      if (!skipSoat && selectedSoatEstado) {
        const itemEst = item._estKey ?? normUpperKey(item.estado_activo);
        const isBaja = itemEst === 'PARA BAJA' || itemEst === 'BAJA' || item.estado_soat === 'NO_REQUIERE' || item.soat_estado === 'NO_REQUIERE';
        if (selectedSoatEstado === 'NO_REQUIERE' || selectedSoatEstado === 'PARA_BAJA') {
          if (!isBaja) return false;
        } else {
          if (isBaja || (item.soat_estado !== selectedSoatEstado && item.estado_soat !== selectedSoatEstado)) return false;
        }
      }
      return true;
    };

    let filtered = [];
    if (currentTab === 'salida-tabla' || currentTab === 'salidas') {
      filtered = baseData.filter(item => {
        if (usuarioSubModulo === 'TRANSFERENCIA') {
          const queryTr = (document.getElementById('filter-transf-search')?.value || '').trim();
          const queryGlobal = (searchInput ? searchInput.value.trim() : '');
          const tokens = normFastSearch(queryTr || queryGlobal).split(/\s+/).filter(Boolean);
          const bienes = getBienesFromTransferencia_Public(item);
          const trBlob = normFastSearch([
            item.n_transferencia, item.resp_origen, item.cargo_origen, item.sucursal_origen,
            item.resp_destino, item.cargo_destino, item.sucursal_destino, item.motivo,
            item.tipo_transferencia, item.estado_transferencia,
            ...bienes.flatMap(b => [b.cod_patrimonial, b.denominacion, b.marca, b.modelo, b.numero_serie])
          ].filter(Boolean).join(' '));
          const searchMatch = tokens.length === 0 || tokens.every(t => trBlob.includes(t));

          let sucursalMatch = true;
          const selSuc = document.getElementById('filter-transf-sucursal')?.value;
          if (selSuc && selSuc !== 'Todas' && selSuc !== '') {
            const selU = normUpperKey(selSuc);
            sucursalMatch = (normUpperKey(item.sucursal_origen) === selU || normUpperKey(item.sucursal_destino) === selU);
          }

          let yearMatch = true;
          const selYear = document.getElementById('filter-transf-year')?.value;
          if (selYear && selYear !== 'Todos' && selYear !== '') {
            if (!item.fecha_transferencia) return false;
            const { year: y } = parseDateParts(item.fecha_transferencia);
            yearMatch = (y === Number(selYear));
          }

          let monthMatch = true;
          const selMonth = document.getElementById('filter-transf-month')?.value;
          if (selMonth && selMonth !== 'Todos' && selMonth !== '') {
            if (!item.fecha_transferencia) return false;
            const { month: m } = parseDateParts(item.fecha_transferencia);
            monthMatch = (m === Number(selMonth));
          }

          return searchMatch && sucursalMatch && yearMatch && monthMatch;
        }

        const querySalida = (document.getElementById('filter-salida-search')?.value || '').trim();
        const queryGlobal = (searchInput ? searchInput.value.trim() : '');
        const tokens = normFastSearch(querySalida || queryGlobal).split(/\s+/).filter(Boolean);
        const salBlob = normFastSearch([
          item.n_orden, item.responsable, item.cargo, item.ubicacion,
          item.motivo, item.tipo_salida, item.estado_devolucion,
          ...(item.bienes || []).flatMap(b => [b.cod_patrimonial, b.denominacion, b.marca, b.modelo, b.numero_serie])
        ].filter(Boolean).join(' '));
        const searchMatch = tokens.length === 0 || tokens.every(t => salBlob.includes(t));

        let sucursalMatch = true;
        const selectedSalidaSucursal = document.getElementById('filter-salida-sucursal')?.value;
        if (selectedSalidaSucursal && selectedSalidaSucursal !== 'Todas' && selectedSalidaSucursal !== '') {
          sucursalMatch = (normUpperKey(item.ubicacion) === normUpperKey(selectedSalidaSucursal));
        }

        let yearMatch = true;
        const selectedSalidaYear = document.getElementById('filter-salida-year')?.value || '';
        if (selectedSalidaYear && selectedSalidaYear !== 'Todos' && selectedSalidaYear !== '') {
          if (!item.fecha_orden) return false;
          const { year: y } = parseDateParts(item.fecha_orden);
          yearMatch = (y === Number(selectedSalidaYear));
        }

        let monthMatch = true;
        const selectedSalidaMonth = document.getElementById('filter-salida-month')?.value || '';
        if (selectedSalidaMonth && selectedSalidaMonth !== 'Todos' && selectedSalidaMonth !== '') {
          if (!item.fecha_orden) return false;
          const { month: m } = parseDateParts(item.fecha_orden);
          monthMatch = (m === Number(selectedSalidaMonth));
        }

        return searchMatch && sucursalMatch && yearMatch && monthMatch;
      });
    } else if (currentTab === 'contable') {
      filtered = baseData.filter(item => {
        const contableYearSelect = document.getElementById('contable-year-select');
        const contableMonthSelect = document.getElementById('contable-month-select');
        const contableLocalidadSelect = document.getElementById('contable-localidad-select');
        const selectedYear = contableYearSelect ? contableYearSelect.value : 'Todos';
        const selectedMonth = contableMonthSelect ? contableMonthSelect.value : 'Todos';
        const selectedLocalidad = contableLocalidadSelect ? contableLocalidadSelect.value : 'Todos';

        if (selectedLocalidad && selectedLocalidad !== 'Todos') {
          if ((item._locKey ?? normUpperKey(item.localidad)) !== normUpperKey(selectedLocalidad)) return false;
        }

        const dateStr = item.fecha_registro_contable || item.fecha_alta_factura || item.fecha_alta;
        if (!dateStr && (selectedYear !== 'Todos' || selectedMonth !== 'Todos')) return false;
        if (dateStr) {
          const { year: y, month: m } = parseDateParts(dateStr);
          if (!y && (selectedYear !== 'Todos' || selectedMonth !== 'Todos')) return false;
          if (selectedYear !== 'Todos' && y !== Number(selectedYear)) return false;
          if (selectedMonth !== 'Todos' && m !== Number(selectedMonth)) return false;
        }
        return true;
      });
    } else {
      const commonMatched = baseData.filter(passesCommonFilters);
      if (currentTab === 'activos') {
        lastActivosKpiBase = commonMatched.filter(i => passesEstadoAndSoat(i, true, false));
      } else if (currentTab === 'vehiculos' || currentTab === 'soat') {
        lastVehiculosKpiBase = commonMatched.filter(i => passesEstadoAndSoat(i, false, true));
      } else if (currentTab === 'celulares') {
        lastCelularesKpiBase = commonMatched;
      }
      filtered = commonMatched.filter(i => passesEstadoAndSoat(i, false, false));
    }

    // Guardar bases dinámicas para KPIs de Inventario y contadores de Regularización
    let workingFiltered = filtered;
    if (currentTab === 'inventario') {
      lastInventarioKpiBase = filtered;
      if (inventarioSubFilter === 'ACTIVOS') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'ACTIVO FIJO' || i.tipo_origen === 'INCORPORACIÓN');
      } else if (inventarioSubFilter === 'OBRAS') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'OBRA EN CURSO');
      } else if (inventarioSubFilter === 'CONCILIACION') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'CONCILIACIÓN');
      } else if (inventarioSubFilter === 'TERCEROS') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'BIEN DE TERCEROS');
      } else if (inventarioSubFilter === 'SOBRANTE') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'SOBRANTE');
      } else if (inventarioSubFilter === 'FALTANTE') {
        workingFiltered = filtered.filter(i => i.tipo_origen === 'FALTANTE' || i.estado_activo === 'FALTANTE');
      }
    } else if (currentTab === 'terceros') {
      lastRegSubTabBase = filtered;
      if (regularizacionSubTab && regularizacionSubTab !== 'ALL') {
        workingFiltered = filtered.filter(i => String(i.sub_modulo || i.tipo || '').toUpperCase() === regularizacionSubTab);
      }
    }

    lastBaseFilteredForCols = workingFiltered;

    // Aplicar filtros de columna tipo Excel (cascada) y ordenamiento si están activos
    let finalData = applyColFiltersAndSort(workingFiltered);

    if (!colSort.key && (currentTab === 'vehiculos' || currentTab === 'soat')) {
      finalData.sort((a, b) => {
        const sucA = (a.sucursal || '').trim();
        const sucB = (b.sucursal || '').trim();
        const compSuc = sucA.localeCompare(sucB, 'es', { sensitivity: 'base' });
        if (compSuc !== 0) return compSuc;

        const denA = (a.denominacion || '').trim();
        const denB = (b.denominacion || '').trim();
        return denA.localeCompare(denB, 'es', { sensitivity: 'base' });
      });
    }

    // Ordenar jerárquicamente por defecto: 1° Actas DESC > 2° Código Patrimonial DESC > 3° Fecha de Ingreso DESC > 4° O/C DESC
    if (!colSort.key && (currentTab === 'activos' || currentTab === 'obras' || currentTab === 'vehiculos')) {
      finalData.sort((a, b) => {
        // 1. Actas (de mayor a menor) para los activos que tengan Acta
        const actaA = (a.n_acta_entrega || a.n_acta || '').trim();
        const actaB = (b.n_acta_entrega || b.n_acta || '').trim();
        const hasActaA = actaA && actaA !== '—' && actaA !== '-' && actaA.toUpperCase() !== 'SIN ACTA';
        const hasActaB = actaB && actaB !== '—' && actaB !== '-' && actaB.toUpperCase() !== 'SIN ACTA';

        if (hasActaA && hasActaB) {
          const matchA = actaA.match(/(\d+)\s*[-/]\s*(\d{4})/);
          const matchB = actaB.match(/(\d+)\s*[-/]\s*(\d{4})/);
          if (matchA && matchB) {
            const yrA = parseInt(matchA[2], 10);
            const yrB = parseInt(matchB[2], 10);
            if (yrA !== yrB) return yrB - yrA;
            const numA = parseInt(matchA[1], 10);
            const numB = parseInt(matchB[1], 10);
            if (numA !== numB) return numB - numA;
          }
          const compActa = actaB.localeCompare(actaA, undefined, { numeric: true, sensitivity: 'base' });
          if (compActa !== 0) return compActa;
        } else if (hasActaA && !hasActaB) {
          return -1;
        } else if (!hasActaA && hasActaB) {
          return 1;
        }

        // 2. Código Patrimonial (mayor a menor)
        const codA = String(a.cod_patrimonial || '').trim();
        const codB = String(b.cod_patrimonial || '').trim();
        const numCodA = Number(codA);
        const numCodB = Number(codB);
        let compCod = 0;
        if (!isNaN(numCodA) && !isNaN(numCodB) && codA !== '' && codB !== '') {
          compCod = numCodB - numCodA;
        } else {
          compCod = codB.localeCompare(codA, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (compCod !== 0) return compCod;

        // 3. Fecha de Ingreso (más reciente primero)
        const dA = a.fecha_alta || a.fecha_alta_factura || a.fecha_registro_contable || a.fecha_asignacion || '0000-00-00';
        const dB = b.fecha_alta || b.fecha_alta_factura || b.fecha_registro_contable || b.fecha_asignacion || '0000-00-00';
        const compDate = String(dB).localeCompare(String(dA));
        if (compDate !== 0) return compDate;

        // 4. Orden de Compra (mayor a menor)
        const ocA = String(a.n_doc_compra || a.n_doc || '').trim();
        const ocB = String(b.n_doc_compra || b.n_doc || '').trim();
        const numOcA = Number(ocA);
        const numOcB = Number(ocB);
        let compOc = 0;
        if (!isNaN(numOcA) && !isNaN(numOcB) && ocA !== '' && ocB !== '') {
          compOc = numOcB - numOcA;
        } else {
          compOc = ocB.localeCompare(ocA, undefined, { numeric: true, sensitivity: 'base' });
        }
        return compOc;
      });
    }

    updateColFilterIndicators();
    updateDashboardKpis(finalData);
    renderActiveFilterChips();
    renderData(finalData);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MOTOR UNIVERSAL DE FILTROS DE COLUMNA TIPO EXCEL (MULTISELECCIÓN + ORDEN)
  // ══════════════════════════════════════════════════════════════════════════════
  function getColFilterValue(item, key) {
    if (!item) return '';
    switch (key) {
      case 'cod_patrimonial': return String(item.cod_patrimonial || '').trim();
      case 'n_doc': {
        if (!item.n_doc) return '';
        if (item.documento_tipo === 'COMPRA' || item.documento_tipo === 'OBRA') return `OC-${item.n_doc}`;
        if (item.documento_tipo === 'INCORPORACION') return `INC-${item.n_doc}`;
        return String(item.n_doc).trim();
      }
      case 'cuenta_contable': return String(item.cuenta_contable || '').trim();
      case 'centro_costo': return String(item.centro_costo || '').trim();
      case 'fecha_ingreso': return formatDate(item.fecha_alta_factura || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_alta || '');
      case 'fecha_asignacion': return formatDate(item.fecha_asignacion || '');
      case 'sucursal': return String(item.sucursal || '').trim();
      case 'localidad': return String(item.localidad || '').trim();
      case 'fuente': return String(getFinanciadoText(item) || item.fuente || '').trim();
      case 'denominacion': return String(item.denominacion || '').trim();
      case 'subcategoria': return String(item.subcategoria || item.categoria || '').trim();
      case 'n_acta': return String(item.n_acta || item.n_acta_entrega || '').trim();
      case 'marca': return String(item.marca || '').trim();
      case 'modelo': return String(item.modelo || '').trim();
      case 'especificaciones': return String(item.placa || item.especificaciones || item.caracteristicas_accesorios || '').trim();
      case 'estado_activo': return String(item.estado_activo || '').trim();
      case 'valor_en_libros': return formatMoney(item.valor_en_libros || 0);
      case 'valor_neto': return formatMoney(getNetValue(item));
      case 'responsable': return String(item.responsable || item.propietario_manual || 'Sin Asignar').trim();
      case 'puesto': return String(item.puesto || item.unidad || '').trim();
      case 'placa': return String(item.placa || '').trim();
      case 'tipo_vehiculo': return String(item.tipo_vehiculo || item.combustible || '').trim();
      case 'soat_estado': {
        const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
        return isBaja ? 'NO REQUIERE' : String(item.soat_estado || item.estado_soat || 'SIN REGISTRO').trim();
      }
      case 'estado_rev_tec': {
        const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
        return isBaja ? 'NO REQUIERE' : String(item.estado_rev_tec || 'SIN REGISTRO').trim();
      }
      case 'cod_control': return String(item.cod_control || '').trim();
      case 'numero_linea': return String(item.numero_linea || '').trim();
      case 'operador': return String(item.operador || '').trim();
      case 'estado_cel': return String(item.estado || '').trim();
      case 'sub_modulo': return String(item.sub_modulo || item.tipo || '').trim().toUpperCase();
      default: return String(item[key] || '').trim();
    }
  }

  function applyColFiltersAndSort(list) {
    const activeKeys = Object.keys(colFilters).filter(k => Array.isArray(colFilters[k]) && colFilters[k].length > 0);
    let out = activeKeys.length === 0
      ? [...list]
      : list.filter(item =>
          activeKeys.every(k => colFilters[k].includes(getColFilterValue(item, k)))
        );

    if (colSort.key && colSort.direction) {
      const dir = colSort.direction === 'asc' ? 1 : -1;
      const k = colSort.key;
      out.sort((a, b) => {
        if (k === 'valor_en_libros') {
          return ((Number(a.valor_en_libros) || 0) - (Number(b.valor_en_libros) || 0)) * dir;
        }
        if (k === 'valor_neto') {
          return (getNetValue(a) - getNetValue(b)) * dir;
        }
        const va = getColFilterValue(a, k);
        const vb = getColFilterValue(b, k);
        return va.localeCompare(vb, 'es', { numeric: true, sensitivity: 'base' }) * dir;
      });
    }
    return out;
  }

  function getCascadingDataForCol(excludeKey) {
    const otherKeys = Object.keys(colFilters).filter(k => k !== excludeKey && colFilters[k]?.length > 0);
    if (otherKeys.length === 0) return lastBaseFilteredForCols;
    return lastBaseFilteredForCols.filter(item =>
      otherKeys.every(k => colFilters[k].includes(getColFilterValue(item, k)))
    );
  }

  function closeColFilterPopover() {
    const pop = document.getElementById('excel-col-filter-popover');
    if (pop) pop.classList.add('hidden');
    activeColPopoverKey = null;
  }

  function updateColFilterIndicators() {
    const activeCount = Object.keys(colFilters).filter(k => colFilters[k]?.length > 0).length + (colSort.key ? 1 : 0);
    const clearBtn = document.getElementById('btn-clear-col-filters');
    const countSpan = document.getElementById('col-filters-count');
    if (clearBtn && countSpan) {
      countSpan.textContent = activeCount;
      if (activeCount > 0 && currentTab !== 'contable' && currentTab !== 'asignacion' && currentTab !== 'ficha' && currentTab !== 'salidas') {
        clearBtn.classList.remove('hidden');
        clearBtn.classList.add('inline-flex');
      } else {
        clearBtn.classList.add('hidden');
        clearBtn.classList.remove('inline-flex');
      }
    }

    document.querySelectorAll('.excel-col-trigger').forEach(btn => {
      const k = btn.getAttribute('data-col-key');
      const selected = colFilters[k] || [];
      const isSorted = colSort.key === k;
      const badge = btn.querySelector('.excel-col-badge');
      const icon = btn.querySelector('.excel-col-icon');
      if (selected.length > 0 || isSorted) {
        btn.classList.add('bg-amber-400/25', 'text-amber-100', 'ring-1', 'ring-amber-200/70');
        btn.classList.remove('hover:bg-white/15');
      } else {
        btn.classList.remove('bg-amber-400/25', 'text-amber-100', 'ring-1', 'ring-amber-200/70');
        btn.classList.add('hover:bg-white/15');
      }
      if (badge) {
        if (selected.length > 0) {
          badge.textContent = selected.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
      if (icon) {
        if (isSorted) {
          icon.textContent = colSort.direction === 'asc' ? '↑' : '↓';
        } else if (selected.length > 0) {
          icon.textContent = '⧨';
        } else {
          icon.textContent = '▾';
        }
      }
    });
  }

  function openColFilterPopover(colKey, labelText, triggerEl) {
    const pop = document.getElementById('excel-col-filter-popover');
    if (!pop) return;
    if (activeColPopoverKey === colKey && !pop.classList.contains('hidden')) {
      closeColFilterPopover();
      return;
    }
    activeColPopoverKey = colKey;

    const cascadeData = getCascadingDataForCol(colKey);
    const valueCounts = new Map();
    cascadeData.forEach(item => {
      const v = getColFilterValue(item, colKey);
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    });
    const activeColSet = new Set(colFilters[colKey] || []);
    const allUniqueVals = Array.from(valueCounts.keys()).sort((a, b) => {
      const aSel = activeColSet.has(a);
      const bSel = activeColSet.has(b);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
    });

    let draftSelected = new Set(colFilters[colKey] || []);
    let searchQ = '';

    pop.innerHTML = `
      <div class="px-3 py-2 bg-[#00B0F0] text-white flex items-center justify-between gap-2">
        <span class="font-extrabold text-[11px] uppercase tracking-wider truncate">${labelText}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          <span id="ecf-hdr-badge" class="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full"></span>
          <button type="button" id="ecf-close" class="text-white/80 hover:text-white font-bold text-xs px-1 cursor-pointer bg-transparent border-none">✕</button>
        </div>
      </div>
      <div class="p-2 border-b border-slate-100 grid grid-cols-2 gap-1.5 bg-slate-50">
        <button type="button" id="ecf-sort-asc" class="py-1 px-2 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${colSort.key === colKey && colSort.direction === 'asc' ? 'bg-[#00B0F0] text-white border-[#00B0F0]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}">↑ A → Z</button>
        <button type="button" id="ecf-sort-desc" class="py-1 px-2 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${colSort.key === colKey && colSort.direction === 'desc' ? 'bg-[#00B0F0] text-white border-[#00B0F0]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}">↓ Z → A</button>
      </div>
      <div class="p-2 border-b border-slate-100">
        <input type="text" id="ecf-search" placeholder="Buscar valor... (Enter para aplicar)" class="w-full h-7 px-2 text-[11px] bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500" />
      </div>
      <div class="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
          <input type="checkbox" id="ecf-select-all" class="rounded border-slate-300 text-brand-600 cursor-pointer" />
          <span>(Seleccionar todo)</span>
        </label>
        <span id="ecf-count-lbl" class="text-[10px] font-mono text-slate-500"></span>
      </div>
      <div id="ecf-list" class="max-h-52 overflow-y-auto p-1.5 space-y-0.5"></div>
      <div class="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
        <button type="button" id="ecf-clear" class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-[11px] cursor-pointer">Limpiar</button>
        <div class="flex items-center gap-1.5">
          <button type="button" id="ecf-cancel" class="px-2.5 py-1 rounded-lg bg-transparent border-none hover:bg-slate-200/70 text-slate-500 font-bold text-[11px] cursor-pointer">Cancelar</button>
          <button type="button" id="ecf-apply" class="px-3.5 py-1 rounded-lg bg-[#00B0F0] hover:bg-[#009ad4] text-white font-extrabold text-[11px] cursor-pointer border-none">Aceptar</button>
        </div>
      </div>
    `;

    const listEl = pop.querySelector('#ecf-list');
    const searchEl = pop.querySelector('#ecf-search');
    const selectAllEl = pop.querySelector('#ecf-select-all');
    const countLbl = pop.querySelector('#ecf-count-lbl');
    const hdrBadge = pop.querySelector('#ecf-hdr-badge');

    const getVisibleVals = () => {
      const qNorm = normFastSearch(searchQ).trim();
      if (!qNorm) return allUniqueVals;
      const tokens = qNorm.split(/\s+/).filter(Boolean);
      return allUniqueVals.filter(v => {
        const vNorm = normFastSearch(v || '(Vacío)');
        return tokens.every(t => vNorm.includes(t));
      });
    };

    const applyAndClose = () => {
      const visible = getVisibleVals();
      if (draftSelected.size > 0) {
        if (!searchQ.trim() && draftSelected.size === allUniqueVals.length) {
          delete colFilters[colKey];
        } else {
          colFilters[colKey] = Array.from(draftSelected);
        }
      } else if (searchQ.trim() !== '') {
        if (visible.length > 0 && visible.length < allUniqueVals.length) {
          colFilters[colKey] = visible;
        } else if (visible.length === 0) {
          colFilters[colKey] = ['__SIN_COINCIDENCIAS__'];
        } else {
          delete colFilters[colKey];
        }
      } else {
        delete colFilters[colKey];
      }
      closeColFilterPopover();
      applyFilters();
    };

    function renderValList() {
      const visible = getVisibleVals();
      const frag = document.createDocumentFragment();
      if (visible.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'py-4 text-center text-[11px] text-slate-400 italic';
        emptyMsg.textContent = 'No hay coincidencias';
        frag.appendChild(emptyMsg);
      } else {
        visible.slice(0, 400).forEach(val => {
          const row = document.createElement('div');
          row.className = 'group/row flex items-center justify-between gap-1.5 px-1.5 py-1 rounded hover:bg-blue-50/70 text-[11px]';

          const lbl = document.createElement('label');
          lbl.className = 'flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer';
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.className = 'rounded border-slate-300 text-brand-600 cursor-pointer shrink-0';
          chk.checked = draftSelected.has(val);
          chk.addEventListener('change', () => {
            if (chk.checked) draftSelected.add(val);
            else draftSelected.delete(val);
            syncMasterChk();
          });
          const txt = document.createElement('span');
          txt.className = val ? 'truncate text-slate-700' : 'truncate italic text-slate-400';
          txt.textContent = val || '(Vacío)';
          txt.title = val || '(Vacío)';
          lbl.appendChild(chk);
          lbl.appendChild(txt);

          const right = document.createElement('div');
          right.className = 'flex items-center gap-1 shrink-0';

          const soloBtn = document.createElement('button');
          soloBtn.type = 'button';
          soloBtn.className = 'opacity-0 group-hover/row:opacity-100 focus:opacity-100 px-1.5 py-0.5 text-[9.5px] font-extrabold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded transition-opacity cursor-pointer';
          soloBtn.textContent = 'Solo';
          soloBtn.title = `Filtrar solo "${val || '(Vacío)'}"`;
          soloBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            colFilters[colKey] = [val];
            closeColFilterPopover();
            applyFilters();
          });

          const cnt = document.createElement('span');
          cnt.className = 'text-[9.5px] font-mono text-slate-400 min-w-[18px] text-right';
          cnt.textContent = valueCounts.get(val) || 0;

          right.appendChild(soloBtn);
          right.appendChild(cnt);
          row.appendChild(lbl);
          row.appendChild(right);
          frag.appendChild(row);
        });
        if (visible.length > 400) {
          const note = document.createElement('div');
          note.className = 'px-2 py-1 text-[10px] text-amber-700 bg-amber-50 rounded text-center';
          note.textContent = `Mostrando 400 de ${visible.length}. Usa el buscador para acotar.`;
          frag.appendChild(note);
        }
      }
      listEl.innerHTML = '';
      listEl.appendChild(frag);
      syncMasterChk();
    }

    function syncMasterChk() {
      const visible = getVisibleVals();
      const selVisible = visible.filter(v => draftSelected.has(v)).length;
      selectAllEl.checked = visible.length > 0 && selVisible === visible.length;
      selectAllEl.indeterminate = selVisible > 0 && selVisible < visible.length;
      countLbl.textContent = `${draftSelected.size}/${allUniqueVals.length}`;
      if (hdrBadge) {
        hdrBadge.textContent = draftSelected.size > 0 ? `${draftSelected.size} sel.` : `${allUniqueVals.length} disp.`;
      }
    }

    selectAllEl.addEventListener('change', () => {
      const visible = getVisibleVals();
      if (selectAllEl.checked) {
        visible.forEach(v => draftSelected.add(v));
      } else {
        visible.forEach(v => draftSelected.delete(v));
      }
      renderValList();
    });

    searchEl.addEventListener('input', () => {
      searchQ = searchEl.value;
      renderValList();
    });
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyAndClose();
      } else if (e.key === 'Escape') {
        closeColFilterPopover();
      }
    });

    pop.querySelector('#ecf-sort-asc').addEventListener('click', () => {
      colSort = (colSort.key === colKey && colSort.direction === 'asc') ? { key: null, direction: null } : { key: colKey, direction: 'asc' };
      closeColFilterPopover();
      applyFilters();
    });
    pop.querySelector('#ecf-sort-desc').addEventListener('click', () => {
      colSort = (colSort.key === colKey && colSort.direction === 'desc') ? { key: null, direction: null } : { key: colKey, direction: 'desc' };
      closeColFilterPopover();
      applyFilters();
    });
    pop.querySelector('#ecf-close').addEventListener('click', closeColFilterPopover);
    pop.querySelector('#ecf-cancel').addEventListener('click', closeColFilterPopover);
    pop.querySelector('#ecf-clear').addEventListener('click', () => {
      delete colFilters[colKey];
      if (colSort.key === colKey) colSort = { key: null, direction: null };
      closeColFilterPopover();
      applyFilters();
    });
    pop.querySelector('#ecf-apply').addEventListener('click', applyAndClose);

    renderValList();

    // Posicionar flotante dentro del viewport
    pop.classList.remove('hidden');
    const rect = triggerEl.getBoundingClientRect();
    const popW = 288;
    const popH = Math.min(pop.offsetHeight || 360, 400);
    let left = rect.left;
    if (left + popW > window.innerWidth - 10) left = Math.max(8, window.innerWidth - popW - 10);
    let top = rect.bottom + 4;
    if (top + popH > window.innerHeight - 10) top = Math.max(8, rect.top - popH - 4);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    searchEl.focus();
  }

  function initExcelHeaderFilters() {
    document.querySelectorAll('th[data-col-filter]').forEach(th => {
      if (th.dataset.ecfBound) return;
      th.dataset.ecfBound = '1';
      const keys = th.getAttribute('data-col-filter').split('|').map(s => s.trim()).filter(Boolean);
      const rawLabels = th.getAttribute('data-col-labels')
        ? th.getAttribute('data-col-labels').split('|').map(s => s.trim())
        : [th.textContent.trim()];

      th.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = keys.length > 1 ? 'inline-flex flex-col items-stretch gap-0.5 w-full' : 'inline-flex items-center justify-center w-full';

      keys.forEach((k, idx) => {
        const lbl = rawLabels[idx] || k;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-col-key', k);
        btn.className = 'excel-col-trigger inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded text-[0.6rem] font-extrabold text-white uppercase tracking-wide hover:bg-white/15 transition-colors cursor-pointer bg-transparent border-none w-full';
        btn.title = `Filtrar / Ordenar por ${lbl}`;
        btn.innerHTML = `
          <span class="truncate">${lbl}</span>
          <span class="inline-flex items-center gap-0.5 shrink-0">
            <span class="excel-col-badge hidden px-1 rounded-full bg-amber-300 text-slate-900 text-[8.5px] font-black leading-tight"></span>
            <span class="excel-col-icon text-[9px] opacity-85 leading-none">▾</span>
          </span>
        `;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openColFilterPopover(k, lbl, btn);
        });
        wrap.appendChild(btn);
      });
      th.appendChild(wrap);
    });

    const clearColBtn = document.getElementById('btn-clear-col-filters');
    if (clearColBtn && !clearColBtn.dataset.bound) {
      clearColBtn.dataset.bound = '1';
      clearColBtn.addEventListener('click', () => {
        colFilters = {};
        colSort = { key: null, direction: null };
        closeColFilterPopover();
        applyFilters();
      });
    }

    const pop = document.getElementById('excel-col-filter-popover');
    if (pop && !pop.dataset.bound) {
      pop.dataset.bound = '1';
      pop.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', closeColFilterPopover);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeColFilterPopover(); });
    }
  }

  // Renderizado dinámico de datos y contenedores (con paginación rápida para respuesta instantánea)
  function updatePaginationBar(totalCount) {
    const pgBar = document.getElementById('dashboard-pagination-bar');
    if (!pgBar) return;
    const isPaginatedTab = ['activos', 'obras', 'vehiculos', 'soat', 'celulares', 'inventario', 'terceros'].includes(currentTab);
    if (!isPaginatedTab || totalCount === 0) {
      pgBar.classList.add('hidden');
      return;
    }
    pgBar.classList.remove('hidden');
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = pageSize === 0 ? 1 : (safePage - 1) * pageSize + 1;
    const endIdx = pageSize === 0 ? totalCount : Math.min(safePage * pageSize, totalCount);

    const rangeEl = document.getElementById('pg-range-info');
    const pageEl = document.getElementById('pg-page-info');
    const navEl = document.getElementById('pg-nav-controls');
    if (rangeEl) rangeEl.innerHTML = `Mostrando <strong class="font-mono text-slate-900">${startIdx}–${endIdx}</strong> de <strong class="font-mono text-slate-900">${totalCount}</strong> registros`;
    if (pageEl) pageEl.textContent = `Pág. ${safePage} / ${totalPages}`;
    if (navEl) navEl.classList.toggle('hidden', pageSize === 0 || totalPages <= 1);

    const btnFirst = document.getElementById('pg-first');
    const btnPrev = document.getElementById('pg-prev');
    const btnNext = document.getElementById('pg-next');
    const btnLast = document.getElementById('pg-last');
    if (btnFirst) btnFirst.disabled = safePage <= 1;
    if (btnPrev) btnPrev.disabled = safePage <= 1;
    if (btnNext) btnNext.disabled = safePage >= totalPages;
    if (btnLast) btnLast.disabled = safePage >= totalPages;
  }

  function renderData(data, resetPage = true) {
    currentFilteredData = data;
    if (resetPage) currentPage = 1;
    resultsCount.textContent = `Encontrados: ${data.length}`;
    updatePaginationBar(data.length);

    // Limpiar todas las tablas y contenedor de tarjetas móviles
    document.getElementById('assets-tbody').innerHTML = '';
    document.getElementById('obras-tbody').innerHTML = '';
    document.getElementById('vehiculos-tbody').innerHTML = '';
    if (document.getElementById('soat-tbody')) document.getElementById('soat-tbody').innerHTML = '';
    document.getElementById('celulares-tbody').innerHTML = '';
    document.getElementById('inventario-tbody').innerHTML = '';
    document.getElementById('terceros-tbody').innerHTML = '';
    if (document.getElementById('salidas-tbody')) document.getElementById('salidas-tbody').innerHTML = '';
    if (document.getElementById('transf-tbody')) document.getElementById('transf-tbody').innerHTML = '';
    if (document.getElementById('contable-tbody')) document.getElementById('contable-tbody').innerHTML = '';
    mobileContainer.innerHTML = '';

    const allContainers = [
      'assets-table-container',
      'obras-table-container',
      'vehiculos-table-container',
      'soat-table-container',
      'celulares-table-container',
      'inventario-table-container',
      'terceros-table-container',
      'salidas-table-container',
      'contable-table-container',
      'asignacion-table-container',
      'ficha-container'
    ];

    if (currentTab === 'salidas') {
      emptyState.classList.add('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'salidas-table-container') {
            el.classList.remove('hidden');
            el.classList.add('flex');
          } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
          }
        }
      });
      mobileContainer.classList.add('hidden');
      if (usuarioSubModulo === 'TRANSFERENCIA') {
        renderTransferenciasRows(data);
      } else {
        renderSalidasRows(data);
      }
      return;
    }

    if (currentTab === 'ficha') {
      emptyState.classList.add('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'ficha-container') el.classList.remove('hidden');
          else el.classList.add('hidden');
        }
      });
      mobileContainer.classList.add('hidden');
      renderFichaTab();
      return;
    }

    if (currentTab === 'asignacion') {
      emptyState.classList.add('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'asignacion-table-container') {
            el.classList.remove('hidden');
            el.classList.add('flex');
          } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
          }
        }
      });
      mobileContainer.classList.add('hidden');
      renderAsignacionTab();
      return;
    }

    if (currentTab === 'contable') {
      emptyState.classList.add('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'contable-table-container') {
            el.classList.remove('hidden');
            el.classList.add('flex');
          } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
          }
        }
      });
      mobileContainer.classList.add('hidden');
      renderContableRows(data);
      return;
    }

    const keepTableForControls = window.innerWidth >= 768;

    if (data.length === 0 && !keepTableForControls) {
      emptyState.classList.remove('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      mobileContainer.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    // Manejo adaptativo Desktop vs Móvil
    if (window.innerWidth >= 768) {
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      
      let activeTableId = `${currentTab === 'activos' ? 'assets' : currentTab}-table-container`;
      if (currentTab === 'salidas') {
        activeTableId = 'salidas-table-container';
      }
      const activeEl = document.getElementById(activeTableId);
      if (activeEl) activeEl.classList.remove('hidden');
      mobileContainer.classList.add('hidden');
    } else {
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      
      if (currentTab === 'contable' || currentTab === 'salidas') {
        const activeEl = document.getElementById(currentTab === 'salidas' ? 'salidas-table-container' : 'contable-table-container');
        if (activeEl) activeEl.classList.remove('hidden');
        mobileContainer.classList.add('hidden');
      } else {
        mobileContainer.classList.remove('hidden');
      }
    }

    // Inyectar datos específicos (con fila vacía amigable si un filtro de columna deja 0 resultados)
    if (data.length === 0 && currentTab !== 'inventario' && currentTab !== 'terceros') {
      const emptyMap = {
        activos: ['assets-tbody', 12],
        obras: ['obras-tbody', 12],
        vehiculos: ['vehiculos-tbody', 11],
        celulares: ['celulares-tbody', 10],
      };
      if (emptyMap[currentTab]) {
        const [tbId, cols] = emptyMap[currentTab];
        const tb = document.getElementById(tbId);
        if (tb) tb.innerHTML = `<tr><td colspan="${cols}" class="py-10 text-center text-slate-400 text-xs font-semibold">No hay registros que coincidan con los filtros de columna activos.</td></tr>`;
        return;
      }
    }

    // Slice de paginación para renderizado instantáneo (Excel/PDF y KPIs usan 100% de currentFilteredData)
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(data.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageSlice = (pageSize === 0 || data.length <= pageSize)
      ? data
      : data.slice((safePage - 1) * pageSize, safePage * pageSize);

    if (currentTab === 'activos') {
      renderActivosRows(pageSlice);
    } else if (currentTab === 'obras') {
      renderObrasRows(pageSlice);
    } else if (currentTab === 'vehiculos') {
      renderVehiculosRows(pageSlice);
    } else if (currentTab === 'soat') {
      renderSoatRows(pageSlice);
    } else if (currentTab === 'celulares') {
      renderCelularesRows(pageSlice);
    } else if (currentTab === 'inventario') {
      renderInventarioRows(pageSlice);
    } else if (currentTab === 'terceros') {
      renderTercerosRows(pageSlice);
    } else if (currentTab === 'salida-tabla') {
      renderSalidasRows(data);
    } else if (currentTab === 'salidas') {
      if (usuarioSubModulo === 'TRANSFERENCIA') renderTransferenciasRows(data);
      else renderSalidasRows(data);
    } else if (currentTab === 'contable') {
      renderContableRows(data);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // SALIDA DE BIENES: PDF GENERATOR & FORM INTERACTION (PUBLIC DASHBOARD)
  // ──────────────────────────────────────────────────────────────────────────────
  let salidaModo = 'SISTEMA';
  let salidaBienesSeleccionados = [];

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function loadImgAsBase64(rawPath) {
    if (!rawPath) return null;
    const clean = rawPath.replace(/^\.?\/+/, '');
    const fileName = clean.split('/').pop();
    
    // Candidate URLs in priority order
    const candidateUrls = [];
    if (window.location.protocol.startsWith('http')) {
      let base = window.location.pathname;
      if (!base.endsWith('/')) {
        base = base.substring(0, base.lastIndexOf('/') + 1);
      }
      candidateUrls.push(`${window.location.origin}${base}${clean}`);
      candidateUrls.push(`${window.location.origin}/${clean}`);
      candidateUrls.push(`${window.location.origin}/public/${clean}`);
    }
    candidateUrls.push(`/${clean}`);
    candidateUrls.push(`./${clean}`);
    candidateUrls.push(clean);
    candidateUrls.push(`uploads/${fileName}`);
    candidateUrls.push(`./uploads/${fileName}`);
    candidateUrls.push(`../uploads/${fileName}`);
    
    const uniqueUrls = [...new Set(candidateUrls.filter(Boolean))];

    for (const url of uniqueUrls) {
      // 1. Try fetch as blob (purest and prevents canvas taint)
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
            if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
              return dataUrl;
            }
          }
        }
      } catch (fetchErr) {
        // Fetch failed (e.g. file:// restriction), continue to Image element
      }

      // 2. Try Image with canvas (fallback for file:// protocol)
      try {
        const dataUrlFromImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width || 400;
              canvas.height = img.naturalHeight || img.height || 300;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.92));
            } catch (canvasErr) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
        if (dataUrlFromImg && typeof dataUrlFromImg === 'string' && dataUrlFromImg.startsWith('data:image')) {
          return dataUrlFromImg;
        }
      } catch (imgErr) {
        // continue
      }
    }
    return null;
  }

  async function generarOrdenSalidaPDF_Public(salidaData, skipConfirm = false) {
    if (!skipConfirm) {
      const verificado = confirm('¿Ha revisado y verificado que todos los datos consignados en la Orden de Salida de Bienes son correctos antes de generar e imprimir el documento PDF?');
      if (!verificado) return false;
    }
    if (!window.jspdf?.jsPDF) { alert('La librería jsPDF no está disponible.'); return false; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginX = 15;
    let posY = 12;

    const [logoImg, selloImg] = await Promise.all([
      loadImage('logo_eps2.png').catch(() => null),
      loadImage('Sello Post Firma - CP1.png').catch(() => null)
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
        [{ content: 'SUCURSAL-DEPENDENCIA:', styles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 42 } }, (salidaData.ubicacion || '').toUpperCase()],
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
    posY += splitNota.length * 3.1 + 5;

    // Recuadro de Control de Portería (Salida e Ingreso/Retorno)
    const pageHeight = doc.internal.pageSize.height;
    if (posY + 24 > pageHeight - 62) {
      doc.addPage();
      posY = 20;
    }
    doc.autoTable({
      head: [[
        { content: 'CONTROL DE SALIDA EN PORTERÍA (VIGILANCIA)', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'CONTROL DE RETORNO / INGRESO EN PORTERÍA', styles: { halign: 'center', fontStyle: 'bold' } }
      ]],
      body: [[
        'Fecha: ____/____/20____    Hora Salida: ________\nV°B° / Firma Vigilante: _________________________',
        'Fecha: ____/____/20____    Hora Ingreso: _______\nV°B° / Firma Vigilante: _________________________'
      ]],
      startY: posY,
      theme: 'grid',
      headStyles: { fillColor: [0, 76, 150], textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.8 },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59], valign: 'middle' },
      margin: { left: marginX, right: marginX },
    });

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
    if (selloImg) doc.addImage(selloImg, 'PNG', 143, yLine - 26, 54, 25);

    const sanitize = (salidaData.responsable || 'RESPONSABLE').replace(/\s+/g, '_').toUpperCase();
    doc.save(`Orden_Salida_${salidaData.n_orden || 'SN'}_${sanitize}.pdf`);
  }

  async function generarFichaPDF_Public(activo) {
    if (!window.jspdf?.jsPDF) {
      alert('La librería jsPDF no está cargada.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    
    const marginX = 14;
    let posY = 15;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("EPS SELVA CENTRAL S.A.", marginX, posY);
    posY += 4;
    doc.text(activo.localidad || "LA MERCED", marginX, posY);
    posY += 4;
    doc.text("Versión: 2026.1.1-Juan Eder Systems", marginX, posY);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-PE');
    const timeStr = now.toLocaleTimeString('es-PE');
    doc.text(`Fecha: ${dateStr}`, 196, 15, { align: 'right' });
    doc.text(`Hora: ${timeStr}`, 196, 19, { align: 'right' });
    
    posY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("FICHA DE REGISTRO DEL BIEN", 105, posY, { align: 'center' });
    
    posY += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${activo.cod_patrimonial}   ${activo.denominacion || ''}`, marginX, posY);
    
    posY += 2;
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    
    const formatDateStr = (dateVal) => {
      if (!dateVal) return '—';
      const parts = String(dateVal).split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateVal;
    };
    
    // Fila 1
    doc.setFont("helvetica", "bold"); doc.text("Ingreso:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_alta_factura || activo.fecha_registro_contable) || '—', marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Histórico:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Tipo ing:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("CO - Compra", 155 + 20, posY);
    
    // Fila 2
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Alta:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_alta || activo.fecha_asignacion) || '—', marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Libros:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Docum:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("OC - Orden de Compra", 155 + 20, posY);
    
    // Fila 3
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Fec Entrega:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_asignacion) || '—', marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Tasación:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("O/C:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.n_doc || '—', 155 + 20, posY);
    
    // Fila 4
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Estado:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.estado_activo || '—', marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Neto:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_neto || getNetValue(activo) || 0).toFixed(2)}`, 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Seguro:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("Si", 155 + 20, posY);
    
    // Fila 5
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Proyecto:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text("—", marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Depreciación:", 105, posY);
    const depAcum = (Number(activo.valor_en_libros || 0) - Number(activo.valor_neto || getNetValue(activo) || 0)).toFixed(2);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${depAcum}`, 105 + 22, posY);
    
    // Fila 6
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Principal:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text("Si", marginX + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Revaluado:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Vida util:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text(`${activo.vida_util_anios || 10} Años`, 155 + 20, posY);
    
    // Fila 7
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Dep Inic:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    doc.setFont("helvetica", "bold"); doc.text("Factor:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("—", 155 + 20, posY);

    // Segmento Independiente: Detalle Físico
    posY += 8;
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Detalle Físico del Activo / Especificaciones:", marginX, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Marca:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.marca || '—', marginX + 15, posY);
    doc.setFont("helvetica", "bold"); doc.text("Modelo:", 70, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.modelo || '—', 70 + 15, posY);
    doc.setFont("helvetica", "bold"); doc.text("Serie:", 135, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.numero_serie || '—', 135 + 15, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Especificaciones:", marginX, posY);
    const specText = activo.caracteristicas_accesorios || activo.especificaciones || '—';
    const splitSpecs = doc.splitTextToSize(specText, 150);
    doc.setFont("helvetica", "normal");
    doc.text(splitSpecs, marginX + 30, posY);
    
    posY += (splitSpecs.length * 4);
    
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "bold"); doc.text("Localización:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.sucursal || '—', marginX + 22, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Responsable:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.responsable || '—', marginX + 22, posY);

    const imagesToDraw = [];
    if (activo.imagen_1_path && activo.imagen_1_path.trim()) imagesToDraw.push(activo.imagen_1_path.trim());
    if (activo.imagen_2_path && activo.imagen_2_path.trim()) imagesToDraw.push(activo.imagen_2_path.trim());
    if (activo.imagen_3_path && activo.imagen_3_path.trim()) imagesToDraw.push(activo.imagen_3_path.trim());
    if (activo.imagen_4_path && activo.imagen_4_path.trim()) imagesToDraw.push(activo.imagen_4_path.trim());

    if (imagesToDraw.length > 0) {
      const contentWidth = 182; // 196 - 14
      const numImgs = imagesToDraw.length;
      let cols = 1;
      let imgWidth = 110;
      let imgHeight = 68;
      let gapX = 8;
      let gapY = 6;
      let neededHeight = 75;

      if (numImgs === 1) {
        cols = 1;
        imgWidth = 130;
        imgHeight = 95;
        neededHeight = 115;
      } else if (numImgs === 2) {
        cols = 2;
        gapX = 8;
        imgWidth = (contentWidth - gapX) / 2; // 87mm
        imgHeight = 82;
        neededHeight = 105;
      } else if (numImgs === 3) {
        cols = 2;
        gapX = 8;
        gapY = 6;
        imgWidth = (contentWidth - gapX) / 2; // 87mm
        imgHeight = 82;
        neededHeight = 82 * 2 + gapY + 15;
      } else { // 4 imágenes: cuadrícula 2x2
        cols = 2;
        gapX = 8;
        gapY = 6;
        imgWidth = (contentWidth - gapX) / 2; // 87mm
        imgHeight = 82; // Alargado de 52mm a 82mm para conservar nitidez y legibilidad del texto
        neededHeight = 82 * 2 + gapY + 15;
      }

      if (posY + neededHeight > 284) {
        doc.addPage();
        posY = 18;
      } else {
        posY += 8;
        doc.line(marginX, posY, 196, posY);
        posY += 5;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Imágenes del Activo:", marginX, posY);
      posY += 4;

      for (let i = 0; i < imagesToDraw.length; i++) {
        const rawPath = imagesToDraw[i];
        const base64Data = await loadImgAsBase64(rawPath);
        if (base64Data) {
          let posX = marginX;
          let currentY = posY;
          if (numImgs === 1) {
            posX = marginX + (contentWidth - imgWidth) / 2;
            currentY = posY;
          } else if (numImgs === 3 && i === 2) {
            posX = marginX + (contentWidth - imgWidth) / 2;
            currentY = posY + (imgHeight + gapY);
          } else if (cols === 2) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            posX = marginX + col * (imgWidth + gapX);
            currentY = posY + row * (imgHeight + gapY);
          }
          doc.addImage(base64Data, 'JPEG', posX, currentY, imgWidth, imgHeight);
        }
      }
    }

    doc.save(`Ficha_Activo_${activo.cod_patrimonial || 'SN'}.pdf`);
  }

  function initSalidaModule() {
    const btnSubtabForm = document.getElementById('btn-salidas-subtab-form');
    const btnSubtabHistory = document.getElementById('btn-salidas-subtab-history');
    const formView = document.getElementById('salidas-form-view');
    const historyView = document.getElementById('salidas-history-view');

    const btnModoSistema = document.getElementById('btn-salida-modo-sistema');
    const btnModoManual = document.getElementById('btn-salida-modo-manual');

    const fechaInput = document.getElementById('salida-fecha');
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }

    const ubicacionSelect = document.getElementById('salida-ubicacion');
    if (ubicacionSelect && ubicacionSelect.options.length <= 1) {
      const sucOpts = sortSucursales([
        ...(catalogosUsuario.sucursales || []),
        ...assets.map(a => a.sucursal)
      ]);
      sucOpts.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        ubicacionSelect.appendChild(opt);
      });
    }

    function populateSalidasFilters() {
      const sucursalSel = document.getElementById('filter-salida-sucursal');
      const yearSel = document.getElementById('filter-salida-year');
      if (!sucursalSel || !yearSel) return;

      const prevSuc = sucursalSel.value;
      const prevYear = yearSel.value;

      // Poblar Sucursales basadas en salidas y activos con SEDE CENTRAL primero
      const ubicaciones = sortSucursales([
        ...salidas.map(s => (s.ubicacion || '').trim().toUpperCase()),
        ...assets.map(a => (a.sucursal || '').trim().toUpperCase())
      ]);

      sucursalSel.innerHTML = '<option value="">Todas</option>' + 
        ubicaciones.map(u => `<option value="${u}" ${u === prevSuc ? 'selected' : ''}>${u}</option>`).join('');

      // Poblar Años basados en salidas
      const years = [...new Set(
        salidas.map(s => {
          if (!s.fecha_orden) return null;
          const parts = String(s.fecha_orden).split('-');
          return parts[0] ? Number(parts[0]) : new Date(s.fecha_orden).getFullYear();
        }).filter(Boolean)
      )].sort((a, b) => b - a);

      if (!years.includes(new Date().getFullYear())) {
        years.unshift(new Date().getFullYear());
      }

      yearSel.innerHTML = '<option value="">Todos</option>' +
        years.map(y => `<option value="${y}" ${String(y) === String(prevYear) ? 'selected' : ''}>${y}</option>`).join('');
    }

    // Subtab switching (Registro y Gestión vs Tablas y Consultas)
    if (btnSubtabForm && btnSubtabHistory && formView && historyView) {
      btnSubtabForm.addEventListener('click', () => {
        btnSubtabForm.className = "text-xs font-extrabold pb-0.5 border-b-2 border-brand-500 text-brand-600 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        btnSubtabHistory.className = "text-xs font-bold pb-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        formView.classList.remove('hidden');
        historyView.classList.add('hidden');
        const formCtrl = document.getElementById('salidas-form-controls');
        if (formCtrl) formCtrl.style.display = 'flex';
        const histFilt = document.getElementById('salidas-history-filters');
        if (histFilt) histFilt.style.display = 'none';
      });
      btnSubtabHistory.addEventListener('click', () => {
        btnSubtabHistory.className = "text-xs font-extrabold pb-0.5 border-b-2 border-brand-500 text-brand-600 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        btnSubtabForm.className = "text-xs font-bold pb-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        historyView.classList.remove('hidden');
        formView.classList.add('hidden');
        const formCtrl = document.getElementById('salidas-form-controls');
        if (formCtrl) formCtrl.style.display = 'none';
        const histFilt = document.getElementById('salidas-history-filters');
        if (histFilt) histFilt.style.display = 'flex';
        populateSalidasFilters();
        applyFilters();
      });
    }

    // Listeners de filtros de Salida de Bienes (Sucursal, Año, Mes, Búsqueda)
    ['filter-salida-sucursal', 'filter-salida-year', 'filter-salida-month'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFilters);
    });
    const salidaSearchInput = document.getElementById('filter-salida-search');
    if (salidaSearchInput) {
      salidaSearchInput.addEventListener('input', applyFilters);
    }
    const btnSalidaHistoryClear = document.getElementById('btn-salida-history-clear');
    if (btnSalidaHistoryClear) {
      btnSalidaHistoryClear.addEventListener('click', () => {
        ['filter-salida-sucursal', 'filter-salida-year', 'filter-salida-month', 'filter-salida-search'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        applyFilters();
      });
    }

    // Botón Exportar / Sincronizar JSON de Salidas
    const btnExportSalidasJson = document.getElementById('btn-salidas-export-json');
    if (btnExportSalidasJson) {
      btnExportSalidasJson.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(salidas, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `salidas_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        try {
          navigator.clipboard.writeText(JSON.stringify(salidas, null, 2)).then(() => {
            alert(`✅ Se descargó el archivo salidas.json (${salidas.length} órdenes) y se copió al portapapeles.\n\nPuedes importarlo directamente en el APP Control Patrimonial.`);
          }).catch(() => {
            alert(`✅ Se descargó el archivo salidas.json con ${salidas.length} órdenes.`);
          });
        } catch (e) {
          alert(`✅ Se descargó el archivo salidas.json con ${salidas.length} órdenes.`);
        }
      });
    }

    // Mode switching
    if (btnModoSistema && btnModoManual) {
      btnModoSistema.addEventListener('click', () => {
        salidaModo = 'SISTEMA';
        btnModoSistema.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer bg-brand-500 text-white shadow-xs";
        btnModoManual.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white bg-transparent";
        document.getElementById('salida-search-activo-wrapper')?.classList.remove('hidden');
        document.getElementById('btn-salida-add-manual')?.classList.add('hidden');
        document.getElementById('col-salida-chk')?.classList.remove('hidden');
        salidaBienesSeleccionados = [];
        renderSalidaBienesFormTable();
      });

      btnModoManual.addEventListener('click', () => {
        salidaModo = 'MANUAL';
        btnModoManual.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer bg-brand-500 text-white shadow-xs";
        btnModoSistema.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white bg-transparent";
        document.getElementById('salida-search-activo-wrapper')?.classList.add('hidden');
        document.getElementById('btn-salida-add-manual')?.classList.remove('hidden');
        document.getElementById('col-salida-chk')?.classList.add('hidden');
        salidaBienesSeleccionados = [{ isManual: true, seleccionado: true, cod_patrimonial: '', denominacion: '', color: 'NEGRO', marca: 'S/M', modelo: 'S/M', numero_serie: 'S/S', estado_activo: 'BUENO' }];
        renderSalidaBienesFormTable();
      });
    }

    // Autocompletado Responsable
    const respInput = document.getElementById('salida-responsable');
    const respSug = document.getElementById('salida-resp-sug');
    if (respInput && respSug) {
      respInput.addEventListener('input', () => {
        const q = respInput.value.trim().toUpperCase();
        if (!q) { respSug.classList.add('hidden'); return; }
        
        const allPeople = [
          ...(catalogosUsuario.personal || []),
          ...assets.map(a => a.responsable),
          ...celulares.map(c => c.responsable),
          ...inventario.map(i => i.responsable),
          ...terceros.map(t => t.responsable),
          ...salidas.map(s => s.responsable),
          ...transferencias.map(t => t.resp_origen),
          ...transferencias.map(t => t.resp_destino)
        ];
        const personalSet = [...new Set(allPeople.map(p => (p || '').trim().toUpperCase()).filter(Boolean))].sort();
        
        const words = q.split(/\s+/).filter(Boolean);
        const matches = personalSet.filter(p => words.every(w => p.includes(w))).slice(0, 10);
        
        if (matches.length === 0) { respSug.classList.add('hidden'); return; }
        respSug.innerHTML = matches.map(m => `
          <div class="p-2.5 hover:bg-brand-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-100 last:border-b-0" data-val="${m}">
            ${m}
          </div>
        `).join('');
        respSug.classList.remove('hidden');
        respSug.querySelectorAll('div').forEach(el => {
          el.addEventListener('click', () => {
            const name = el.getAttribute('data-val');
            respInput.value = name;
            respSug.classList.add('hidden');
            if (salidaModo === 'SISTEMA') {
              const nameWords = name.split(/\s+/).filter(Boolean);
              const assigned = assets.filter(a => {
                const rName = (a.responsable || '').trim().toUpperCase();
                return nameWords.every(w => rName.includes(w));
              });
              if (assigned.length > 0) {
                salidaBienesSeleccionados = assigned.map(a => ({
                  cod_patrimonial: a.cod_patrimonial || '',
                  denominacion: a.denominacion || '',
                  color: a.color || 'NEGRO',
                  marca: a.marca || 'S/M',
                  modelo: a.modelo || 'S/M',
                  numero_serie: a.numero_serie || 'S/S',
                  estado_activo: a.estado_activo || 'BUENO',
                  accesorios: '',
                  seleccionado: true
                }));
                const cargoInput = document.getElementById('salida-cargo');
                if (cargoInput && assigned[0].puesto) cargoInput.value = assigned[0].puesto.toUpperCase();
                if (ubicacionSelect && assigned[0].sucursal) ubicacionSelect.value = assigned[0].sucursal.toUpperCase();
                renderSalidaBienesFormTable();
              }
            }
          });
        });
      });
    }

    // Autocompletado Búsqueda Activo
    const activoInput = document.getElementById('salida-search-activo');
    const activoSug = document.getElementById('salida-activo-sug');
    if (activoInput && activoSug) {
      activoInput.addEventListener('input', () => {
        const q = activoInput.value.trim().toUpperCase();
        if (!q) { activoSug.classList.add('hidden'); return; }
        const matches = assets.filter(a =>
          (a.cod_patrimonial || '').toUpperCase().includes(q) ||
          (a.denominacion || '').toUpperCase().includes(q)
        ).slice(0, 8);
        if (matches.length === 0) { activoSug.classList.add('hidden'); return; }
        activoSug.innerHTML = matches.map(a => `
          <div class="p-2.5 hover:bg-brand-50 cursor-pointer text-xs border-b border-slate-100 last:border-b-0" data-code="${a.cod_patrimonial}">
            <div class="font-extrabold text-brand-600 font-mono">${a.cod_patrimonial}</div>
            <div class="font-semibold text-slate-800 truncate">${a.denominacion}</div>
          </div>
        `).join('');
        activoSug.classList.remove('hidden');
        activoSug.querySelectorAll('div').forEach(el => {
          el.addEventListener('click', () => {
            const code = el.getAttribute('data-code');
            const found = assets.find(a => a.cod_patrimonial === code);
            if (found) {
              if (!salidaBienesSeleccionados.some(b => b.cod_patrimonial === found.cod_patrimonial)) {
                salidaBienesSeleccionados.push({
                  cod_patrimonial: found.cod_patrimonial || '',
                  denominacion: found.denominacion || '',
                  color: found.color || 'NEGRO',
                  marca: found.marca || 'S/M',
                  modelo: found.modelo || 'S/M',
                  numero_serie: found.numero_serie || 'S/S',
                  estado_activo: found.estado_activo || 'BUENO',
                  accesorios: '',
                  seleccionado: true
                });
                renderSalidaBienesFormTable();
              }
            }
            activoInput.value = '';
            activoSug.classList.add('hidden');
          });
        });
      });
    }

    // Agregar manual row
    const btnAddManual = document.getElementById('btn-salida-add-manual');
    if (btnAddManual) {
      btnAddManual.addEventListener('click', () => {
        salidaBienesSeleccionados.push({
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
        });
        renderSalidaBienesFormTable();
      });
    }

  function generarProximoNumeroOrden(targetYear) {
    const year = targetYear || new Date().getFullYear();
    let maxNum = 0;
    (salidas || []).forEach(s => {
      if (!s || !s.n_orden) return;
      const str = String(s.n_orden).trim();
      const parts = str.split('-');
      if (parts.length === 2 && !isNaN(parts[0])) {
        const num = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        if (y === Number(year) && num > maxNum) {
          maxNum = num;
        }
      } else if (parts.length === 3 && !isNaN(parts[2])) {
        const y = parseInt(parts[1], 10);
        const num = parseInt(parts[2], 10);
        if (y === Number(year) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${String(nextNum).padStart(3, '0')}-${year}`;
  }

  function updateSalidaCodigoBadge() {
    const codigoBadge = document.getElementById('salida-codigo-badge');
    if (codigoBadge) {
      const fechaVal = document.getElementById('salida-fecha')?.value;
      const { year: parsedY } = parseDateParts(fechaVal);
      const year = parsedY || new Date().getFullYear();
      codigoBadge.textContent = generarProximoNumeroOrden(year);
    }
  }

  // Actualizar Badge N° Orden Correlativo
  updateSalidaCodigoBadge();

  // Actualizar Badge cuando cambie la fecha
  document.getElementById('salida-fecha')?.addEventListener('change', updateSalidaCodigoBadge);

  // Limpiar Formulario
  const btnLimpiar = document.getElementById('btn-salida-limpiar');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      if (confirm('¿Desea limpiar todos los campos del formulario?')) {
        if (document.getElementById('salida-motivo')) document.getElementById('salida-motivo').value = '';
        if (document.getElementById('salida-responsable')) document.getElementById('salida-responsable').value = '';
        if (document.getElementById('salida-cargo')) document.getElementById('salida-cargo').value = '';
        if (document.getElementById('salida-observaciones')) document.getElementById('salida-observaciones').value = '';
        salidaBienesSeleccionados = [];
        renderSalidaBienesFormTable();
      }
    });
  }

  // Cerrar sugerencias al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (respInput && e.target !== respInput && respSug) respSug.classList.add('hidden');
    if (activoInput && e.target !== activoInput && activoSug) activoSug.classList.add('hidden');
  });

  // Submit / Generar PDF
  const btnGenerarPDF = document.getElementById('btn-salida-generar-pdf');
  if (btnGenerarPDF) {
    btnGenerarPDF.addEventListener('click', async () => {
      const fecha = document.getElementById('salida-fecha')?.value;
      const tipoInput = document.querySelector('input[name="salida_tipo_public"]:checked');
      const tipo = tipoInput ? tipoInput.value : 'Mantenimiento';
      const motivo = document.getElementById('salida-motivo')?.value.trim();
      const responsable = document.getElementById('salida-responsable')?.value.trim().toUpperCase();
      const cargo = document.getElementById('salida-cargo')?.value.trim().toUpperCase();
      const ubicacion = document.getElementById('salida-ubicacion')?.value.trim().toUpperCase();
      const respTecnico = document.getElementById('salida-resp-tecnico')?.value.trim().toUpperCase() || 'ÁREA TÉCNICA';
      const observaciones = document.getElementById('salida-observaciones')?.value.trim().toUpperCase();

      if (!fecha || !responsable || !cargo || !ubicacion || !motivo) {
        alert('Por favor complete todos los datos obligatorios del formulario (Fecha, Motivo, Responsable, Cargo y Sucursal).');
        return;
      }

      const bienesAEnviar = salidaBienesSeleccionados.filter(b => b.seleccionado !== false);
      if (bienesAEnviar.length === 0) {
        alert('Por favor seleccione o agregue al menos un bien patrimonial para la orden de salida.');
        return;
      }

      for (let i = 0; i < bienesAEnviar.length; i++) {
        if (!bienesAEnviar[i].denominacion || !bienesAEnviar[i].denominacion.trim()) {
          alert(`Por favor ingrese la denominación para el bien N° ${i + 1}.`);
          return;
        }
      }

      const verificado = confirm('¿Ha revisado y verificado que todos los datos consignados en la Orden de Salida de Bienes son correctos antes de generar e imprimir el documento PDF?');
      if (!verificado) return;

      const { year: parsedY } = parseDateParts(fecha);
      const year = parsedY || new Date().getFullYear();
      const n_orden_local = generarProximoNumeroOrden(year);

        let payload = {
          n_orden: n_orden_local,
          fecha_orden: fecha,
          tipo_salida: tipo,
          motivo: motivo,
          responsable: responsable,
          cargo: cargo,
          ubicacion: ubicacion,
          resp_tecnico: respTecnico,
          observaciones: observaciones,
          estado_devolucion: 'SALIDA',
          bienes: bienesAEnviar
        };

        // Si existe backend FastAPI conectado, registrar primero vía /api/public/salidas para obtener el correlativo oficial
        const isLocalBackend = window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io');
        if (isLocalBackend) {
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch('/api/public/salidas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: ctrl.signal
            });
            clearTimeout(tid);
            if (res.ok) {
              const serverData = await res.json();
              if (serverData && serverData.n_orden) {
                payload = serverData;
              }
            }
          } catch (e) {}
        }

        await generarOrdenSalidaPDF_Public(payload, true);

        if (!salidas.some(s => s.n_orden === payload.n_orden)) {
          salidas.unshift(payload);
        }
        try {
          const localSaved = JSON.parse(localStorage.getItem('salidas_custom_history') || '[]');
          if (!localSaved.some(s => s.n_orden === payload.n_orden)) {
            localSaved.unshift(payload);
            localStorage.setItem('salidas_custom_history', JSON.stringify(localSaved));
          }
        } catch (e) {}
        applyFilters();

        alert(`Orden de Salida ${payload.n_orden} generada y descargada con éxito.`);

        // Limpiar formulario
        if (document.getElementById('salida-motivo')) document.getElementById('salida-motivo').value = '';
        if (document.getElementById('salida-responsable')) document.getElementById('salida-responsable').value = '';
        if (document.getElementById('salida-cargo')) document.getElementById('salida-cargo').value = '';
        if (document.getElementById('salida-observaciones')) document.getElementById('salida-observaciones').value = '';
        salidaBienesSeleccionados = [];
        renderSalidaBienesFormTable();

        // Actualizar N° Orden correlativo para el siguiente registro
        updateSalidaCodigoBadge();

        // Cambiar automáticamente a la subpestaña "Tablas y Consultas" para mostrar el nuevo registro inmediatamente
        if (btnSubtabHistory) {
          btnSubtabHistory.click();
        }
      });
    }
  }

  function renderSalidaBienesFormTable() {
    const tbody = document.getElementById('salida-bienes-form-tbody');
    const headerCount = document.getElementById('salida-bienes-header');
    if (!tbody) return;

    if (headerCount) {
      headerCount.textContent = `Descripción de los Bienes (${salidaBienesSeleccionados.length})`;
    }

    if (salidaBienesSeleccionados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="p-6 text-center text-slate-400 font-medium">
            No se han agregado bienes a la orden. Seleccione un responsable arriba o busque un bien.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = salidaBienesSeleccionados.map((b, idx) => `
      <tr class="hover:bg-slate-50 transition-colors align-middle">
        ${salidaModo === 'SISTEMA' ? `
          <td class="p-2.5 text-center">
            <input type="checkbox" data-idx="${idx}" class="chk-salida-item w-4 h-4 text-brand-500 rounded border-slate-300 cursor-pointer" ${b.seleccionado !== false ? 'checked' : ''} />
          </td>
        ` : ''}
        <td class="p-2.5 text-center font-bold text-slate-500 text-[11px]">${idx + 1}</td>
        <td class="p-2.5 font-mono font-bold text-brand-600">
          ${b.isManual ? `
            <input type="text" data-field="cod_patrimonial" data-idx="${idx}" value="${b.cod_patrimonial || ''}" placeholder="Opcional" class="salida-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono" />
          ` : (b.cod_patrimonial || '—')}
        </td>
        <td class="p-2.5">
          ${b.isManual ? `
            <input type="text" data-field="denominacion" data-idx="${idx}" value="${b.denominacion || ''}" placeholder="Ej: LAPTOP..." class="salida-input-cell w-full px-2 py-1 text-xs font-semibold border border-slate-200 rounded" required />
          ` : `<span class="font-semibold text-slate-800">${b.denominacion}</span>`}
        </td>
        <td class="p-2.5">
          <input type="text" data-field="color" data-idx="${idx}" value="${b.color || 'NEGRO'}" class="salida-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" />
        </td>
        <td class="p-2.5">
          <input type="text" data-field="marca" data-idx="${idx}" value="${b.marca || 'S/M'}" class="salida-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" />
        </td>
        <td class="p-2.5">
          <input type="text" data-field="modelo" data-idx="${idx}" value="${b.modelo || 'S/M'}" class="salida-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" />
        </td>
        <td class="p-2.5">
          <input type="text" data-field="numero_serie" data-idx="${idx}" value="${b.numero_serie || 'S/S'}" class="salida-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" />
        </td>
        <td class="p-2.5 text-center">
          <select data-field="estado_activo" data-idx="${idx}" class="salida-select-cell px-2 py-1 text-[11px] font-bold border border-slate-200 rounded">
            <option value="BUENO" ${b.estado_activo === 'BUENO' ? 'selected' : ''}>BUENO</option>
            <option value="REGULAR" ${b.estado_activo === 'REGULAR' ? 'selected' : ''}>REGULAR</option>
            <option value="MALO" ${b.estado_activo === 'MALO' ? 'selected' : ''}>MALO</option>
          </select>
        </td>
        <td class="p-2.5 text-center">
          <button type="button" data-del="${idx}" class="btn-del-salida-row p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer border-none font-bold">✕</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.salida-input-cell').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        if (salidaBienesSeleccionados[idx]) {
          salidaBienesSeleccionados[idx][field] = e.target.value;
        }
      });
    });

    tbody.querySelectorAll('.salida-select-cell').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        if (salidaBienesSeleccionados[idx]) {
          salidaBienesSeleccionados[idx][field] = e.target.value;
        }
      });
    });

    tbody.querySelectorAll('.chk-salida-item').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (salidaBienesSeleccionados[idx]) {
          salidaBienesSeleccionados[idx].seleccionado = e.target.checked;
        }
      });
    });

    tbody.querySelectorAll('.btn-del-salida-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.getAttribute('data-del'));
        salidaBienesSeleccionados.splice(idx, 1);
        renderSalidaBienesFormTable();
      });
    });
  }

  function parseSalidaOrder(item) {
    if (!item) return { year: 0, num: 0, dateStr: '', id: 0 };
    let year = 0;
    let num = 0;
    if (item.n_orden) {
      const str = String(item.n_orden).trim();
      const parts = str.split('-');
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Formato XXX-YYYY (ej: 038-2026)
        num = parseInt(parts[0], 10);
        year = parseInt(parts[1], 10);
      } else if (parts.length === 3 && !isNaN(parts[1]) && !isNaN(parts[2])) {
        // Formato OS-YYYY-XXX (ej: OS-2026-038)
        year = parseInt(parts[1], 10);
        num = parseInt(parts[2], 10);
      }
    }
    const dateStr = item.fecha_orden || '';
    return { year, num, dateStr, id: item.id || 0 };
  }

  function sortSalidasDesc(list) {
    return [...(list || [])].sort((a, b) => {
      const pA = parseSalidaOrder(a);
      const pB = parseSalidaOrder(b);

      // 1. Comparar Año del correlativo (mayor a menor)
      if (pA.year !== pB.year && pA.year > 0 && pB.year > 0) {
        return pB.year - pA.year;
      }

      // 2. Comparar Número de orden (mayor a menor: ej 038 > 037 > 036)
      if (pA.num !== pB.num && pA.num > 0 && pB.num > 0) {
        return pB.num - pA.num;
      }

      // 3. Comparar fecha_orden (más reciente a más antigua)
      if (pA.dateStr !== pB.dateStr && pA.dateStr && pB.dateStr) {
        return pB.dateStr.localeCompare(pA.dateStr);
      }

      // 4. Comparar ID (mayor a menor)
      return pB.id - pA.id;
    });
  }

  function renderSalidasRows(data) {
    const tbody = document.getElementById('salidas-tbody');
    if (!tbody) return;

    // Ordenamiento estricto de mayor a menor (más actual a más antiguo)
    const sortedData = sortSalidasDesc(data || []);

    if (sortedData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-slate-400 font-medium">
            No se encontraron órdenes de salida registradas.
          </td>
        </tr>
      `;
      return;
    }

    const tipoBadge = (tipo) => {
      const map = {
        mantenimiento: 'bg-blue-50 text-blue-700 border border-blue-100',
        'trabajo de campo': 'bg-amber-50 text-amber-700 border border-amber-100',
        'evento institucional': 'bg-indigo-50 text-indigo-700 border border-indigo-100',
      };
      return map[(tipo || '').toLowerCase()] || 'bg-slate-100 text-slate-600';
    };

    const estadoBadge = (est) => {
      const map = {
        REGRESO: 'bg-emerald-50 text-emerald-700 border border-emerald-300',
        OBSERVADO: 'bg-amber-50 text-amber-700 border border-amber-300',
        SALIDA: 'bg-blue-50 text-blue-700 border border-blue-300',
      };
      return map[est] || 'bg-slate-100 text-slate-600 border border-slate-200';
    };

    tbody.innerHTML = sortedData.map((s, idx) => `
      <tr class="hover:bg-slate-50/70 transition-colors align-middle">
        <td class="px-4 py-3 font-black text-brand-600 font-mono text-sm">${s.n_orden || '—'}</td>
        <td class="px-4 py-3 text-slate-600 font-semibold">${(s.fecha_orden || '').split('-').reverse().join('/')}</td>
        <td class="px-4 py-3">
          <div class="font-bold text-slate-900 text-xs">${(s.responsable || '').toUpperCase()}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${s.cargo || ''} · ${s.ubicacion || ''}</div>
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${tipoBadge(s.tipo_salida)}">
            ${s.tipo_salida || 'Mantenimiento'}
          </span>
        </td>
        <td class="px-4 py-3 text-slate-700 font-medium max-w-[260px] truncate" title="${s.motivo || ''}">${s.motivo || '—'}</td>
        <td class="px-4 py-3 text-center font-bold text-slate-800">
          <span class="bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-slate-200">${s.bienes ? s.bienes.length : 0}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-extrabold ${estadoBadge(s.estado_devolucion || 'SALIDA')}">
            ${(s.estado_devolucion || 'SALIDA') === 'REGRESO' ? '🟢 REGRESO' : (s.estado_devolucion === 'OBSERVADO' ? '🟠 OBSERVADO' : '🔴 SALIDA')}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <button type="button" data-history-pdf="${idx}" class="btn-download-history-pdf px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-white font-extrabold rounded-lg text-[10px] transition-all cursor-pointer border-none shadow-xs">
            📕 PDF
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-download-history-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-history-pdf'));
        if (sortedData[idx]) {
          generarOrdenSalidaPDF_Public(sortedData[idx]);
        }
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // USUARIO -> TRANSFERENCIA INTERNA & SELECTOR DE TRÁMITES (PUBLIC DASHBOARD)
  // ──────────────────────────────────────────────────────────────────────────────
  let transfModo = 'SISTEMA';
  let transfBienesSeleccionados = [];

  function initUsuarioModuleSwitcher() {
    const btnSalida = document.getElementById('btn-usuario-mod-salida');
    const btnTransf = document.getElementById('btn-usuario-mod-transferencia');
    const panelSalida = document.getElementById('usuario-modulo-salida');
    const panelTransf = document.getElementById('usuario-modulo-transferencia');
    const descEl = document.getElementById('usuario-mod-desc');
    const moduleTitle = document.getElementById('module-title');

    const switchModulo = (mod) => {
      usuarioSubModulo = mod;
      const isTransf = mod === 'TRANSFERENCIA';
      if (btnSalida) {
        btnSalida.className = !isTransf
          ? 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all border-none cursor-pointer bg-[#00B0F0] text-white shadow-xs whitespace-nowrap'
          : 'px-3 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white hover:text-slate-900 bg-transparent whitespace-nowrap';
      }
      if (btnTransf) {
        btnTransf.className = isTransf
          ? 'px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all border-none cursor-pointer bg-[#00B0F0] text-white shadow-xs whitespace-nowrap'
          : 'px-3 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white hover:text-slate-900 bg-transparent whitespace-nowrap';
      }
      if (panelSalida) panelSalida.classList.toggle('hidden', isTransf);
      if (panelTransf) panelTransf.classList.toggle('hidden', !isTransf);
      if (descEl) {
        descEl.textContent = isTransf
          ? 'Traslado interno de uno o más bienes patrimoniales entre responsables o áreas'
          : 'Control de salida temporal de activos e ingreso por portería';
      }
      if (currentTab === 'salidas' && moduleTitle) {
        moduleTitle.textContent = isTransf
          ? 'USUARIO — TRANSFERENCIA INTERNA DE BIENES'
          : 'USUARIO — SALIDA DE BIENES';
      }
      if (currentTab === 'salidas') {
        applyFilters();
      }
    };

    if (btnSalida) btnSalida.addEventListener('click', () => switchModulo('SALIDA'));
    if (btnTransf) btnTransf.addEventListener('click', () => switchModulo('TRANSFERENCIA'));
  }

  function getBienesFromTransferencia_Public(t) {
    if (t && Array.isArray(t.bienes) && t.bienes.length > 0) return t.bienes;
    if (t && (t.denominacion || t.cod_patrimonial)) {
      return [{
        cod_patrimonial: t.cod_patrimonial || '',
        denominacion: t.denominacion || '',
        color: 'NEGRO',
        marca: 'S/M',
        modelo: 'S/M',
        numero_serie: 'S/S',
        estado_activo: 'BUENO',
        accesorios: '—',
        es_manual: !t.cod_patrimonial
      }];
    }
    return [];
  }

  function parseTransferenciaOrder(item) {
    if (!item) return { year: 0, num: 0, dateStr: '', id: 0 };
    let year = 0;
    let num = 0;
    if (item.n_transferencia) {
      const parts = String(item.n_transferencia).trim().split('-');
      if (parts.length === 3 && !isNaN(parts[1]) && !isNaN(parts[2])) {
        num = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        num = parseInt(parts[0], 10);
        year = parseInt(parts[1], 10);
      }
    }
    return { year, num, dateStr: item.fecha_transferencia || '', id: item.id || 0 };
  }

  function sortTransferenciasDesc(list) {
    return [...(list || [])].sort((a, b) => {
      const pA = parseTransferenciaOrder(a);
      const pB = parseTransferenciaOrder(b);
      if (pA.year !== pB.year && pA.year > 0 && pB.year > 0) return pB.year - pA.year;
      if (pA.num !== pB.num && pA.num > 0 && pB.num > 0) return pB.num - pA.num;
      if (pA.dateStr !== pB.dateStr && pA.dateStr && pB.dateStr) return pB.dateStr.localeCompare(pA.dateStr);
      return (pB.id || 0) - (pA.id || 0);
    });
  }

  function generarProximoNumeroTransferencia(targetYear) {
    const year = targetYear || new Date().getFullYear();
    let maxNum = 0;
    (transferencias || []).forEach(t => {
      if (!t || !t.n_transferencia) return;
      const parts = String(t.n_transferencia).trim().split('-');
      if (parts.length === 3 && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const num = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (y === Number(year) && num > maxNum) maxNum = num;
      }
    });
    return `TR-${String(maxNum + 1).padStart(3, '0')}-${year}`;
  }

  async function generarTransferenciaPDF_Public(transfData, skipConfirm = false) {
    if (!skipConfirm) {
      const verificado = confirm('¿Ha revisado y verificado que todos los datos consignados en el formato de Transferencia Interna son correctos antes de generar e imprimir el PDF?');
      if (!verificado) return false;
    }
    if (!window.jspdf?.jsPDF) { alert('La librería jsPDF no está disponible.'); return false; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginX = 15;
    let posY = 12;

    const [logoImg, selloImg] = await Promise.all([
      loadImage('logo_eps2.png').catch(() => null),
      loadImage('Sello Post Firma - CP1.png').catch(() => null)
    ]);

    if (logoImg) doc.addImage(logoImg, 'JPEG', marginX, posY, 18, 21);

    const textX = marginX + 21;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, posY + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0, 176, 240);
    doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, posY + 9.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105);
    doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, posY + 13.5);

    const dateParts = (transfData.fecha_transferencia || '').split('-');
    const fechaFmt = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (transfData.fecha_transferencia || '');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
    doc.text(`FECHA: ${fechaFmt}`, 195, posY + 5, { align: 'right' });
    if (transfData.n_transferencia) {
      doc.setFontSize(8.5); doc.setTextColor(0, 176, 240);
      doc.text(`N° TRANSF.: ${transfData.n_transferencia}`, 195, posY + 10, { align: 'right' });
    }

    doc.setLineWidth(0.4); doc.setDrawColor(226, 232, 240);
    doc.line(15, posY + 22, 195, posY + 22);

    posY += 31;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(15, 23, 42);
    const titleStr = 'TRANSFERENCIA INTERNA DE BIENES PATRIMONIALES';
    doc.text(titleStr, 105, posY, { align: 'center' });
    const tw = doc.getTextWidth(titleStr);
    doc.setLineWidth(0.6); doc.setDrawColor(0, 176, 240);
    doc.line(105 - tw / 2, posY + 1.5, 105 + tw / 2, posY + 1.5);

    posY += 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text('TIPO DE TRANSFERENCIA', marginX, posY);
    posY += 5;
    const selectedTipo = (transfData.tipo_transferencia || 'Reasignación de personal').toLowerCase();
    const tipos = ['Reasignación de personal', 'Traslado de área / sede', 'Rotación / Encargatura', 'Otros'];
    let posX = marginX;
    tipos.forEach((t, idx) => {
      const isChecked = selectedTipo === t.toLowerCase() ||
        (t === 'Otros' && !['reasignación de personal', 'traslado de área / sede', 'rotación / encargatura'].includes(selectedTipo));
      doc.setLineWidth(0.3); doc.setDrawColor(100, 100, 100); doc.setFillColor(255, 255, 255);
      doc.circle(posX + 2, posY - 1.5, 1.8, 'FD');
      if (isChecked) { doc.setFillColor(0, 176, 240); doc.circle(posX + 2, posY - 1.5, 1, 'FD'); }
      doc.setFont('helvetica', isChecked ? 'bold' : 'normal'); doc.setFontSize(7.6); doc.setTextColor(30, 41, 59);
      doc.text(t, posX + 5.5, posY - 0.5);
      posX += (idx === 0 ? 48 : idx === 1 ? 47 : idx === 2 ? 47 : 38);
    });

    posY += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text('MOTIVO DETALLADO', marginX, posY);
    posY += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    const splitMotivo = doc.splitTextToSize((transfData.motivo || 'REASIGNACIÓN DE PERSONAL').trim().toUpperCase(), 180);
    doc.text(splitMotivo, marginX, posY);
    posY += splitMotivo.length * 4 + 3;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text('DATOS DEL TRASLADO (ORIGEN Y DESTINO)', marginX, posY);
    posY += 3;
    doc.autoTable({
      head: [[
        { content: 'CAMPO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [51, 65, 85], textColor: [255, 255, 255] } },
        { content: 'CEDENTE / ENTREGANTE (ORIGEN)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 76, 150], textColor: [255, 255, 255] } },
        { content: 'RECEPTOR / NUEVO RESPONSABLE (DESTINO)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 176, 240], textColor: [255, 255, 255] } },
      ]],
      body: [
        ['RESPONSABLE:', (transfData.resp_origen || '—').toUpperCase(), (transfData.resp_destino || '—').toUpperCase()],
        ['CARGO / PUESTO:', (transfData.cargo_origen || '—').toUpperCase(), (transfData.cargo_destino || '—').toUpperCase()],
        ['SUCURSAL - DEP.:', (transfData.sucursal_origen || '—').toUpperCase(), (transfData.sucursal_destino || '—').toUpperCase()],
      ],
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: 'bold', fillColor: [241, 245, 249] },
        1: { cellWidth: 73 },
        2: { cellWidth: 73 },
      },
      margin: { left: marginX, right: marginX },
    });
    posY = doc.lastAutoTable.finalY + 5;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text('DESCRIPCIÓN DE LOS BIENES TRANSFERIDOS', marginX, posY);
    posY += 3;

    const bienes = getBienesFromTransferencia_Public(transfData);
    const headers = [
      [
        { content: 'N°', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'CÓD. PAT.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'DENOMINACIÓN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'CARACTERÍSTICAS DEL BIEN', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'ESTADO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        { content: 'ACCES. / OBS.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      ],
      [
        { content: 'COLOR', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'MARCA', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'MODELO', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'SERIE', styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ];

    doc.autoTable({
      head: headers,
      body: bienes.map((b, idx) => [
        idx + 1,
        (b.cod_patrimonial || 'MANUAL').toUpperCase(),
        (b.denominacion || '').toUpperCase(),
        (b.color || 'NEGRO').toUpperCase(),
        (b.marca || 'S/M').toUpperCase(),
        (b.modelo || 'S/M').toUpperCase(),
        (b.numero_serie || 'S/S').toUpperCase(),
        (b.estado_activo || 'BUENO').toUpperCase(),
        (b.accesorios || '—').toUpperCase(),
      ]),
      startY: posY,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.8, valign: 'middle' },
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 34 },
        3: { cellWidth: 16 },
        4: { cellWidth: 18 },
        5: { cellWidth: 20 },
        6: { cellWidth: 24 },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 23 },
      },
      margin: { left: marginX, right: marginX },
    });
    posY = doc.lastAutoTable.finalY + 5;

    const pageHeight = doc.internal.pageSize.height;
    const obsText = transfData.observaciones ? transfData.observaciones.trim().toUpperCase() : 'SIN OBSERVACIONES ADICIONALES.';
    const splitObs = doc.splitTextToSize(obsText, 180);
    const notaText = 'EL TRABAJADOR RECEPTOR ASUME LA RESPONSABILIDAD DIRECTA DE LA CUSTODIA, CONSERVACIÓN Y USO ADECUADO DE LOS BIENES PATRIMONIALES DESCRITOS, QUEDANDO SUJETO A LAS DIRECTIVAS VIGENTES DE CONTROL PATRIMONIAL DE LA EPS SELVA CENTRAL S.A. CUALQUIER TRASLADO POSTERIOR DEBERÁ SER COMUNICADO OPORTUNAMENTE A CONTROL PATRIMONIAL.';
    const splitNota = doc.splitTextToSize(notaText, 180);

    const footerNeeded = 10 + splitObs.length * 4 + splitNota.length * 3.1 + 38;
    if (posY + footerNeeded > pageHeight - 10) {
      doc.addPage();
      posY = 20;
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text('OBSERVACIONES:', marginX, posY);
    posY += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text(splitObs, marginX, posY);
    posY += splitObs.length * 4 + 4;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
    doc.text('NOTA', marginX, posY);
    posY += 3.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(30, 41, 59);
    doc.text(splitNota, marginX, posY);

    const yLine = pageHeight - 34;
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.25);
    doc.line(15, yLine, 65, yLine);
    doc.line(80, yLine, 130, yLine);
    doc.line(145, yLine, 195, yLine);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(15, 23, 42);
    doc.text('ENTREGADO POR (CEDENTE)', 40, yLine + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.text((transfData.resp_origen || '').toUpperCase().slice(0, 32), 40, yLine + 7.5, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
    doc.text('RECIBIDO POR (RECEPTOR)', 105, yLine + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.text((transfData.resp_destino || '').toUpperCase().slice(0, 32), 105, yLine + 7.5, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
    doc.text('V°B° CONTROL PATRIMONIAL', 170, yLine + 4, { align: 'center' });
    if (selloImg) doc.addImage(selloImg, 'PNG', 143, yLine - 26, 54, 25);

    const sanitize = (transfData.resp_destino || 'RECEPTOR').replace(/\s+/g, '_').toUpperCase();
    doc.save(`Transferencia_Interna_${transfData.n_transferencia || 'SN'}_${sanitize}.pdf`);
    return true;
  }

  function renderTransfBienesFormTable() {
    const tbody = document.getElementById('transf-bienes-form-tbody');
    const headerCount = document.getElementById('transf-bienes-header');
    if (!tbody) return;

    const selectedCount = transfBienesSeleccionados.filter(b => b.seleccionado !== false).length;
    if (headerCount) {
      headerCount.textContent = `${selectedCount} Seleccionados`;
    }

    if (transfBienesSeleccionados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${transfModo === 'SISTEMA' ? 11 : 10}" class="p-6 text-center text-slate-400 font-medium text-xs">
            No se han agregado bienes para transferir. Busque arriba o use "+ Agregar Fila Manual".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = transfBienesSeleccionados.map((b, idx) => `
      <tr class="hover:bg-slate-50 transition-colors align-middle">
        ${transfModo === 'SISTEMA' ? `
          <td class="p-2 text-center">
            <input type="checkbox" data-idx="${idx}" class="chk-transf-item w-4 h-4 text-brand-500 rounded border-slate-300 cursor-pointer" ${b.seleccionado !== false ? 'checked' : ''} />
          </td>
        ` : ''}
        <td class="p-2 text-center font-bold text-slate-500 text-[11px]">${idx + 1}</td>
        <td class="p-2 font-mono font-bold text-brand-600">
          ${b.es_manual ? `
            <input type="text" data-field="cod_patrimonial" data-idx="${idx}" value="${b.cod_patrimonial || ''}" placeholder="Opcional" class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono" />
          ` : (b.cod_patrimonial || '—')}
        </td>
        <td class="p-2">
          ${b.es_manual ? `
            <input type="text" data-field="denominacion" data-idx="${idx}" value="${b.denominacion || ''}" placeholder="Ej: ESCRITORIO..." class="transf-input-cell w-full px-2 py-1 text-xs font-semibold border border-slate-200 rounded" />
          ` : `<span class="font-semibold text-slate-800">${b.denominacion}</span>`}
        </td>
        <td class="p-2"><input type="text" data-field="color" data-idx="${idx}" value="${b.color || 'NEGRO'}" class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" /></td>
        <td class="p-2"><input type="text" data-field="marca" data-idx="${idx}" value="${b.marca || 'S/M'}" class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" /></td>
        <td class="p-2"><input type="text" data-field="modelo" data-idx="${idx}" value="${b.modelo || 'S/M'}" class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" /></td>
        <td class="p-2"><input type="text" data-field="numero_serie" data-idx="${idx}" value="${b.numero_serie || 'S/S'}" class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" /></td>
        <td class="p-2 text-center">
          <select data-field="estado_activo" data-idx="${idx}" class="transf-select-cell px-2 py-1 text-[11px] font-bold border border-slate-200 rounded bg-white">
            <option value="BUENO" ${b.estado_activo === 'BUENO' ? 'selected' : ''}>BUENO</option>
            <option value="REGULAR" ${b.estado_activo === 'REGULAR' ? 'selected' : ''}>REGULAR</option>
            <option value="MALO" ${b.estado_activo === 'MALO' ? 'selected' : ''}>MALO</option>
          </select>
        </td>
        <td class="p-2"><input type="text" data-field="accesorios" data-idx="${idx}" value="${b.accesorios || ''}" placeholder="Obs./Acces." class="transf-input-cell w-full px-2 py-1 text-xs border border-slate-200 rounded" /></td>
        <td class="p-2 text-center">
          <button type="button" data-del="${idx}" class="btn-del-transf-row p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer border-none font-bold">✕</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.transf-input-cell').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        if (transfBienesSeleccionados[idx]) transfBienesSeleccionados[idx][field] = e.target.value;
      });
    });

    tbody.querySelectorAll('.transf-select-cell').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        if (transfBienesSeleccionados[idx]) transfBienesSeleccionados[idx][field] = e.target.value;
      });
    });

    tbody.querySelectorAll('.chk-transf-item').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (transfBienesSeleccionados[idx]) {
          transfBienesSeleccionados[idx].seleccionado = e.target.checked;
          if (headerCount) {
            const cnt = transfBienesSeleccionados.filter(x => x.seleccionado !== false).length;
            headerCount.textContent = `${cnt} Seleccionados`;
          }
        }
      });
    });

    tbody.querySelectorAll('.btn-del-transf-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.getAttribute('data-del'));
        transfBienesSeleccionados.splice(idx, 1);
        renderTransfBienesFormTable();
      });
    });
  }

  function renderTransferenciasRows(data) {
    const tbody = document.getElementById('transf-tbody');
    if (!tbody) return;
    const sortedData = sortTransferenciasDesc(data || []);

    if (sortedData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-slate-400 font-medium">
            No se encontraron transferencias internas registradas.
          </td>
        </tr>
      `;
      return;
    }

    const estadoBadge = (est) => {
      const e = (est || 'PENDIENTE').toUpperCase();
      if (e === 'APLICADA') return { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-300', lbl: '🟢 APLICADA' };
      if (e === 'OBSERVADA') return { cls: 'bg-amber-50 text-amber-700 border border-amber-300', lbl: '🟠 OBSERVADA' };
      if (e === 'ANULADA') return { cls: 'bg-slate-100 text-slate-500 border border-slate-300', lbl: '⚫ ANULADA' };
      return { cls: 'bg-blue-50 text-blue-700 border border-blue-300', lbl: '🟡 PENDIENTE' };
    };

    tbody.innerHTML = sortedData.map((t, idx) => {
      const bienes = getBienesFromTransferencia_Public(t);
      const badge = estadoBadge(t.estado_transferencia);
      const bienesSummary = bienes.map(b => `${b.cod_patrimonial || 'MANUAL'}: ${b.denominacion}`).join(' | ');
      return `
        <tr class="hover:bg-slate-50/70 transition-colors align-middle">
          <td class="px-4 py-3 font-black text-brand-600 font-mono text-sm">
            <div>${t.n_transferencia || '—'}</div>
            ${t.origen_registro === 'PUBLIC' ? '<span class="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-cyan-50 text-cyan-700 border border-cyan-200">WEB</span>' : ''}
          </td>
          <td class="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">${(t.fecha_transferencia || '').split('-').reverse().join('/')}</td>
          <td class="px-4 py-3">
            <div class="font-bold text-rose-700 text-xs">${(t.resp_origen || '—').toUpperCase()}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${t.cargo_origen || '—'} · ${t.sucursal_origen || '—'}</div>
          </td>
          <td class="px-4 py-3">
            <div class="font-bold text-emerald-700 text-xs">${(t.resp_destino || '—').toUpperCase()}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${t.cargo_destino || '—'} · ${t.sucursal_destino || '—'}</div>
          </td>
          <td class="px-4 py-3 text-slate-700 font-medium max-w-[260px]" title="${t.motivo || ''}">
            <div class="text-[10px] font-bold text-brand-700">${t.tipo_transferencia || 'Reasignación de personal'}</div>
            <div class="truncate">${t.motivo || '—'}</div>
          </td>
          <td class="px-4 py-3 text-center font-bold text-slate-800" title="${bienesSummary}">
            <span class="bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-slate-200">${bienes.length}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-extrabold ${badge.cls}">${badge.lbl}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <button type="button" data-transf-pdf="${idx}" class="btn-download-transf-pdf px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-white font-extrabold rounded-lg text-[10px] transition-all cursor-pointer border-none shadow-xs">
              📕 PDF
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-download-transf-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-transf-pdf'));
        if (sortedData[idx]) {
          generarTransferenciaPDF_Public(sortedData[idx]);
        }
      });
    });
  }

  function initTransferenciaModule() {
    const btnSubtabForm = document.getElementById('btn-transf-subtab-form');
    const btnSubtabHistory = document.getElementById('btn-transf-subtab-history');
    const formView = document.getElementById('transf-form-view');
    const historyView = document.getElementById('transf-history-view');

    const btnModoSistema = document.getElementById('btn-transf-modo-sistema');
    const btnModoManual = document.getElementById('btn-transf-modo-manual');
    const fechaInput = document.getElementById('transf-fecha');
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }

    const sucOpts = sortSucursales([
      ...(catalogosUsuario.sucursales || []),
      ...assets.map(a => a.sucursal)
    ]);
    ['transf-sucursal-origen', 'transf-sucursal-destino'].forEach(selId => {
      const selEl = document.getElementById(selId);
      if (selEl && selEl.options.length <= 1) {
        sucOpts.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          selEl.appendChild(opt);
        });
      }
    });

    function populateTransfFilters() {
      const sucSel = document.getElementById('filter-transf-sucursal');
      const yearSel = document.getElementById('filter-transf-year');
      if (!sucSel || !yearSel) return;

      const prevSuc = sucSel.value;
      const prevYear = yearSel.value;
      const ubicaciones = sortSucursales([
        ...transferencias.map(t => t.sucursal_origen),
        ...transferencias.map(t => t.sucursal_destino),
        ...(catalogosUsuario.sucursales || []),
        ...assets.map(a => a.sucursal)
      ]);
      sucSel.innerHTML = '<option value="">Todas</option>' +
        ubicaciones.map(u => `<option value="${u}" ${u === prevSuc ? 'selected' : ''}>${u}</option>`).join('');

      const years = [...new Set(
        transferencias.map(t => parseDateParts(t.fecha_transferencia).year).filter(Boolean)
      )].sort((a, b) => b - a);
      const curY = new Date().getFullYear();
      if (!years.includes(curY)) years.unshift(curY);
      yearSel.innerHTML = '<option value="">Todos</option>' +
        years.map(y => `<option value="${y}" ${String(y) === String(prevYear) ? 'selected' : ''}>${y}</option>`).join('');
    }

    if (btnSubtabForm && btnSubtabHistory && formView && historyView) {
      btnSubtabForm.addEventListener('click', () => {
        btnSubtabForm.className = "text-xs font-extrabold pb-0.5 border-b-2 border-brand-500 text-brand-600 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        btnSubtabHistory.className = "text-xs font-bold pb-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        formView.classList.remove('hidden');
        historyView.classList.add('hidden');
        const formCtrl = document.getElementById('transf-form-controls');
        if (formCtrl) formCtrl.style.display = 'flex';
        const histFilt = document.getElementById('transf-history-filters');
        if (histFilt) histFilt.style.display = 'none';
      });
      btnSubtabHistory.addEventListener('click', () => {
        btnSubtabHistory.className = "text-xs font-extrabold pb-0.5 border-b-2 border-brand-500 text-brand-600 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        btnSubtabForm.className = "text-xs font-bold pb-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-transparent border-t-0 border-x-0 whitespace-nowrap";
        historyView.classList.remove('hidden');
        formView.classList.add('hidden');
        const formCtrl = document.getElementById('transf-form-controls');
        if (formCtrl) formCtrl.style.display = 'none';
        const histFilt = document.getElementById('transf-history-filters');
        if (histFilt) histFilt.style.display = 'flex';
        populateTransfFilters();
        applyFilters();
      });
    }

    ['filter-transf-sucursal', 'filter-transf-year', 'filter-transf-month'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', applyFilters);
    });
    document.getElementById('filter-transf-search')?.addEventListener('input', applyFilters);
    document.getElementById('btn-transf-history-clear')?.addEventListener('click', () => {
      ['filter-transf-sucursal', 'filter-transf-year', 'filter-transf-month', 'filter-transf-search'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyFilters();
    });

    const btnExportTransfJson = document.getElementById('btn-transf-export-json');
    if (btnExportTransfJson) {
      btnExportTransfJson.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transferencias, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `transferencias_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        alert(`✅ Se descargó transferencias.json con ${transferencias.length} registro(s).`);
      });
    }

    if (btnModoSistema && btnModoManual) {
      btnModoSistema.addEventListener('click', () => {
        transfModo = 'SISTEMA';
        btnModoSistema.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer bg-brand-500 text-white shadow-xs";
        btnModoManual.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white bg-transparent";
        document.getElementById('transf-search-activo-wrapper')?.classList.remove('hidden');
        document.getElementById('btn-transf-add-manual')?.classList.add('hidden');
        document.getElementById('col-transf-chk')?.classList.remove('hidden');
        transfBienesSeleccionados = [];
        renderTransfBienesFormTable();
      });
      btnModoManual.addEventListener('click', () => {
        transfModo = 'MANUAL';
        btnModoManual.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer bg-brand-500 text-white shadow-xs";
        btnModoSistema.className = "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border-none cursor-pointer text-slate-600 hover:bg-white bg-transparent";
        document.getElementById('transf-search-activo-wrapper')?.classList.add('hidden');
        document.getElementById('btn-transf-add-manual')?.classList.remove('hidden');
        document.getElementById('col-transf-chk')?.classList.add('hidden');
        transfBienesSeleccionados = [{ es_manual: true, seleccionado: true, cod_patrimonial: '', denominacion: '', color: 'NEGRO', marca: 'S/M', modelo: 'S/M', numero_serie: 'S/S', estado_activo: 'BUENO', accesorios: '' }];
        renderTransfBienesFormTable();
      });
    }

    const getAllPersonalSet = () => {
      const allPeople = [
        ...(catalogosUsuario.personal || []),
        ...assets.map(a => a.responsable),
        ...celulares.map(c => c.responsable),
        ...inventario.map(i => i.responsable),
        ...terceros.map(t => t.responsable),
        ...salidas.map(s => s.responsable),
        ...transferencias.map(t => t.resp_origen),
        ...transferencias.map(t => t.resp_destino)
      ];
      return [...new Set(allPeople.map(p => (p || '').trim().toUpperCase()).filter(Boolean))].sort();
    };

    const bindPersonAutocomplete = (inputId, sugId, onSelect) => {
      const inp = document.getElementById(inputId);
      const sug = document.getElementById(sugId);
      if (!inp || !sug) return;
      inp.addEventListener('input', () => {
        const q = inp.value.trim().toUpperCase();
        if (!q) { sug.classList.add('hidden'); return; }
        const words = q.split(/\s+/).filter(Boolean);
        const matches = getAllPersonalSet().filter(p => words.every(w => p.includes(w))).slice(0, 10);
        if (matches.length === 0) { sug.classList.add('hidden'); return; }
        sug.innerHTML = matches.map(m => `
          <div class="p-2.5 hover:bg-brand-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-100 last:border-b-0" data-val="${m}">
            ${m}
          </div>
        `).join('');
        sug.classList.remove('hidden');
        sug.querySelectorAll('div').forEach(el => {
          el.addEventListener('click', () => {
            const name = el.getAttribute('data-val');
            inp.value = name;
            sug.classList.add('hidden');
            onSelect(name);
          });
        });
      });
      document.addEventListener('click', (e) => {
        if (e.target !== inp) sug.classList.add('hidden');
      });
    };

    bindPersonAutocomplete('transf-resp-origen', 'transf-resp-origen-sug', (name) => {
      const words = name.split(/\s+/).filter(Boolean);
      const assigned = assets.filter(a => {
        const r = (a.responsable || '').trim().toUpperCase();
        return r && words.every(w => r.includes(w));
      });
      if (assigned.length > 0) {
        const cargoOrig = document.getElementById('transf-cargo-origen');
        const sucOrig = document.getElementById('transf-sucursal-origen');
        if (cargoOrig && (assigned[0].puesto || assigned[0].unidad)) {
          cargoOrig.value = (assigned[0].puesto || assigned[0].unidad).toUpperCase();
        }
        if (sucOrig && assigned[0].sucursal) sucOrig.value = assigned[0].sucursal.toUpperCase();
        if (transfModo === 'SISTEMA') {
          transfBienesSeleccionados = assigned.map(a => ({
            cod_patrimonial: a.cod_patrimonial || '',
            denominacion: a.denominacion || '',
            color: a.color || 'NEGRO',
            marca: a.marca || 'S/M',
            modelo: a.modelo || 'S/M',
            numero_serie: a.numero_serie || 'S/S',
            estado_activo: a.estado_activo || 'BUENO',
            accesorios: a.caracteristicas_accesorios || '—',
            es_manual: false,
            seleccionado: true
          }));
          renderTransfBienesFormTable();
        }
      }
    });

    bindPersonAutocomplete('transf-resp-destino', 'transf-resp-destino-sug', (name) => {
      const words = name.split(/\s+/).filter(Boolean);
      const match = assets.find(a => {
        const r = (a.responsable || '').trim().toUpperCase();
        return r && words.every(w => r.includes(w));
      });
      if (match) {
        const cargoDest = document.getElementById('transf-cargo-destino');
        const sucDest = document.getElementById('transf-sucursal-destino');
        if (cargoDest && (match.puesto || match.unidad)) cargoDest.value = (match.puesto || match.unidad).toUpperCase();
        if (sucDest && match.sucursal) sucDest.value = match.sucursal.toUpperCase();
      }
    });

    const activoInp = document.getElementById('transf-search-activo');
    const activoSug = document.getElementById('transf-activo-sug');
    if (activoInp && activoSug) {
      activoInp.addEventListener('input', () => {
        const q = activoInp.value.trim().toUpperCase();
        if (!q) { activoSug.classList.add('hidden'); return; }
        const words = q.split(/\s+/).filter(Boolean);
        const matches = assets.filter(a => {
          const blob = `${a.cod_patrimonial || ''} ${a.denominacion || ''} ${a.numero_serie || ''}`.toUpperCase();
          return words.every(w => blob.includes(w));
        }).slice(0, 10);
        if (matches.length === 0) { activoSug.classList.add('hidden'); return; }
        activoSug.innerHTML = matches.map(a => `
          <div class="p-2.5 hover:bg-brand-50 cursor-pointer text-xs border-b border-slate-100 last:border-b-0" data-code="${a.cod_patrimonial}">
            <div class="flex justify-between font-extrabold text-brand-600 font-mono">
              <span>${a.cod_patrimonial}</span>
              <span class="text-[10px] text-slate-500 font-sans">${a.sucursal || ''}</span>
            </div>
            <div class="font-semibold text-slate-800 truncate">${a.denominacion}</div>
            <div class="text-[10px] text-slate-400">Resp: ${a.responsable || 'SIN ASIGNAR'} · Serie: ${a.numero_serie || 'S/S'}</div>
          </div>
        `).join('');
        activoSug.classList.remove('hidden');
        activoSug.querySelectorAll('[data-code]').forEach(el => {
          el.addEventListener('click', () => {
            const code = el.getAttribute('data-code');
            const found = assets.find(a => a.cod_patrimonial === code);
            if (found && !transfBienesSeleccionados.some(b => b.cod_patrimonial === found.cod_patrimonial)) {
              transfBienesSeleccionados.push({
                cod_patrimonial: found.cod_patrimonial || '',
                denominacion: found.denominacion || '',
                color: found.color || 'NEGRO',
                marca: found.marca || 'S/M',
                modelo: found.modelo || 'S/M',
                numero_serie: found.numero_serie || 'S/S',
                estado_activo: found.estado_activo || 'BUENO',
                accesorios: found.caracteristicas_accesorios || '—',
                es_manual: false,
                seleccionado: true
              });
              const rOrig = document.getElementById('transf-resp-origen');
              const cOrig = document.getElementById('transf-cargo-origen');
              const sOrig = document.getElementById('transf-sucursal-origen');
              if (rOrig && !rOrig.value && found.responsable) rOrig.value = found.responsable.toUpperCase();
              if (cOrig && !cOrig.value && (found.puesto || found.unidad)) cOrig.value = (found.puesto || found.unidad).toUpperCase();
              if (sOrig && !sOrig.value && found.sucursal) sOrig.value = found.sucursal.toUpperCase();
              renderTransfBienesFormTable();
            }
            activoInp.value = '';
            activoSug.classList.add('hidden');
          });
        });
      });
      document.addEventListener('click', (e) => {
        if (e.target !== activoInp) activoSug.classList.add('hidden');
      });
    }

    const addManualRowHandler = () => {
      transfBienesSeleccionados.push({
        es_manual: true,
        seleccionado: true,
        cod_patrimonial: '',
        denominacion: '',
        color: 'NEGRO',
        marca: 'S/M',
        modelo: 'S/M',
        numero_serie: 'S/S',
        estado_activo: 'BUENO',
        accesorios: ''
      });
      renderTransfBienesFormTable();
    };
    document.getElementById('btn-transf-add-manual')?.addEventListener('click', addManualRowHandler);
    document.getElementById('btn-transf-add-manual-inline')?.addEventListener('click', addManualRowHandler);

    function updateTransfCodigoBadge() {
      const badge = document.getElementById('transf-codigo-badge');
      if (badge) {
        const { year: parsedY } = parseDateParts(document.getElementById('transf-fecha')?.value);
        badge.textContent = generarProximoNumeroTransferencia(parsedY || new Date().getFullYear());
      }
    }
    updateTransfCodigoBadge();
    document.getElementById('transf-fecha')?.addEventListener('change', updateTransfCodigoBadge);

    const clearTransfForm = () => {
      ['transf-motivo', 'transf-resp-origen', 'transf-cargo-origen', 'transf-resp-destino', 'transf-cargo-destino', 'transf-observaciones'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['transf-sucursal-origen', 'transf-sucursal-destino'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      transfBienesSeleccionados = [];
      renderTransfBienesFormTable();
    };

    document.getElementById('btn-transf-limpiar')?.addEventListener('click', () => {
      if (confirm('¿Desea limpiar todos los campos del formulario de transferencia interna?')) {
        clearTransfForm();
      }
    });

    document.getElementById('btn-transf-generar-pdf')?.addEventListener('click', async () => {
      const fecha = document.getElementById('transf-fecha')?.value;
      const tipoInp = document.querySelector('input[name="transf_tipo_public"]:checked');
      const tipo = tipoInp ? tipoInp.value : 'Reasignación de personal';
      const motivo = document.getElementById('transf-motivo')?.value.trim();
      const respOrig = document.getElementById('transf-resp-origen')?.value.trim().toUpperCase();
      const cargoOrig = document.getElementById('transf-cargo-origen')?.value.trim().toUpperCase();
      const sucOrig = document.getElementById('transf-sucursal-origen')?.value.trim().toUpperCase();
      const respDest = document.getElementById('transf-resp-destino')?.value.trim().toUpperCase();
      const cargoDest = document.getElementById('transf-cargo-destino')?.value.trim().toUpperCase();
      const sucDest = document.getElementById('transf-sucursal-destino')?.value.trim().toUpperCase();
      const observaciones = document.getElementById('transf-observaciones')?.value.trim().toUpperCase();

      if (!fecha || !motivo || !respOrig || !cargoOrig || !sucOrig || !respDest || !cargoDest || !sucDest) {
        alert('Por favor complete todos los datos obligatorios (Fecha, Motivo, datos completos del Cedente y del Receptor).');
        return;
      }

      const bienesAEnviar = transfBienesSeleccionados
        .filter(b => b.seleccionado !== false)
        .map(b => ({
          cod_patrimonial: (b.cod_patrimonial || '').trim().toUpperCase() || null,
          denominacion: (b.denominacion || '').trim().toUpperCase(),
          color: (b.color || 'NEGRO').trim().toUpperCase(),
          marca: (b.marca || 'S/M').trim().toUpperCase(),
          modelo: (b.modelo || 'S/M').trim().toUpperCase(),
          numero_serie: (b.numero_serie || 'S/S').trim().toUpperCase(),
          estado_activo: b.estado_activo || 'BUENO',
          accesorios: (b.accesorios || '—').trim().toUpperCase(),
          es_manual: Boolean(b.es_manual || !b.cod_patrimonial)
        }));

      if (bienesAEnviar.length === 0) {
        alert('Por favor seleccione o agregue al menos un bien patrimonial para transferir.');
        return;
      }
      for (let i = 0; i < bienesAEnviar.length; i++) {
        if (!bienesAEnviar[i].denominacion) {
          alert(`Por favor ingrese la denominación para el bien N° ${i + 1}.`);
          return;
        }
      }

      const verificado = confirm('¿Ha revisado y verificado que todos los datos consignados en el formato de Transferencia Interna son correctos antes de generar e imprimir el PDF?');
      if (!verificado) return;

      const { year: parsedY } = parseDateParts(fecha);
      const nTransfLocal = generarProximoNumeroTransferencia(parsedY || new Date().getFullYear());

      let payload = {
        n_transferencia: nTransfLocal,
        fecha_transferencia: fecha,
        tipo_transferencia: tipo,
        cod_patrimonial: bienesAEnviar[0].cod_patrimonial || 'MANUAL',
        denominacion: bienesAEnviar[0].denominacion,
        resp_origen: respOrig,
        cargo_origen: cargoOrig,
        sucursal_origen: sucOrig,
        resp_destino: respDest,
        cargo_destino: cargoDest,
        sucursal_destino: sucDest,
        motivo: motivo,
        observaciones: observaciones,
        estado_transferencia: 'PENDIENTE',
        origen_registro: 'PUBLIC',
        aplicar_en_activos: false,
        bienes: bienesAEnviar
      };

      const isLocalBackend = window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io');
      if (isLocalBackend) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch('/api/public/transferencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal
          });
          clearTimeout(tid);
          if (res.ok) {
            const serverData = await res.json();
            if (serverData && serverData.n_transferencia) {
              payload = serverData;
            }
          }
        } catch (e) {}
      }

      await generarTransferenciaPDF_Public(payload, true);

      if (!transferencias.some(t => t.n_transferencia === payload.n_transferencia)) {
        transferencias.unshift(payload);
      }
      try {
        const localSaved = JSON.parse(localStorage.getItem('transferencias_custom_history') || '[]');
        if (!localSaved.some(t => t.n_transferencia === payload.n_transferencia)) {
          localSaved.unshift(payload);
          localStorage.setItem('transferencias_custom_history', JSON.stringify(localSaved));
        }
      } catch (e) {}
      applyFilters();

      alert(`Transferencia Interna ${payload.n_transferencia} generada y descargada con éxito.`);
      clearTransfForm();
      updateTransfCodigoBadge();
      if (btnSubtabHistory) btnSubtabHistory.click();
    });
  }

  function getFinanciadoText(v) {
    if (!v) return '';
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
  }

  // ── Renders del Módulo: Activos Fijos ──────────────────────────────────────
  function renderActivosRows(data) {
    const tbody = document.getElementById('assets-tbody');
    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));

      const financiadoText = getFinanciadoText(item);
      const locText = item.localidad ? `(${item.localidad.trim()})` : '';

      row.innerHTML = `
        <td class="px-1.5 py-1 whitespace-nowrap text-center text-[0.72rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </div>
          <div class="text-[0.65rem] text-[#0088cc] font-mono font-bold mt-0.5">
            ${item.cuenta_contable || '—'}
          </div>
          <div class="text-[0.625rem] text-slate-400 font-mono mt-0.5">
            ${item.centro_costo || '—'}
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center text-[0.65rem]">
          <div class="text-slate-700 font-semibold leading-tight">
            Ingreso: <span class="text-slate-500 font-normal">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</span>
          </div>
          <div class="text-slate-700 font-semibold leading-tight mt-0.5">
            Alta: <span class="text-slate-500 font-normal">${formatDate(item.fecha_asignacion || item.fecha_alta)}</span>
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.sucursal || '—'}
          </div>
          ${locText ? `<div class="text-[0.65rem] text-slate-600 font-medium mt-0.5">${locText}</div>` : ''}
          ${financiadoText ? `<div class="text-[0.6rem] text-slate-500 italic font-medium mt-0.5">${financiadoText}</div>` : ''}
        </td>
        <td class="px-1.5 py-1 min-w-[150px]">
          <div class="text-[0.72rem] font-bold text-slate-900 leading-snug uppercase">
            ${item.denominacion}
          </div>
          <div class="text-[0.625rem] text-[#0088cc] font-bold italic uppercase mt-0.5">
            ${item.subcategoria || item.categoria || '—'}
          </div>
          ${(() => {
            const actaVal = item.n_acta || item.n_acta_entrega;
            if (!actaVal) return '';
            const dateStr = item.fecha_alta_factura || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
            let year = new Date().getFullYear();
            if (dateStr && String(dateStr).trim().length >= 4) {
              const parsedY = parseInt(String(dateStr).trim().substring(0, 4), 10);
              if (parsedY && !isNaN(parsedY)) year = parsedY;
            }
            let text = String(actaVal).trim();
            const hasPrefix = /^acta\s*n[°o]?\s*/i.test(text);
            const prefix = hasPrefix ? '' : 'Acta N° ';
            const hasYear = /\b(19|20)\d{2}\b/.test(text);
            const suffix = hasYear ? '' : ` - ${year}`;
            return `<div class="text-[0.625rem] text-amber-600 font-mono font-semibold mt-0.5">${prefix}${text}${suffix}</div>`;
          })()}
        </td>
        <td class="px-1.5 py-1 text-[0.7rem] min-w-[120px] text-slate-600 leading-normal">
          <div class="space-y-0.5">
            <div><span class="font-semibold text-slate-400">Color:</span> <span class="text-slate-700">${item.color || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Marca:</span> <span class="text-slate-800 font-medium">${item.marca || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> <span class="text-slate-800 font-medium">${item.modelo || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Serie:</span> <span class="text-slate-800 font-mono font-medium">${item.numero_serie || 'S/S'}</span></div>
          </div>
        </td>
        <td class="px-1.5 py-1 text-[0.7rem] min-w-[135px] leading-snug">
          ${(() => {
            const isVehiculo = (item.categoria && item.categoria.toLowerCase().includes('vehiculo')) ||
                               (item.subcategoria && item.subcategoria.toLowerCase().includes('vehiculo')) ||
                               (item.cod_categoria && String(item.cod_categoria).startsWith('4')) ||
                               (item.placa && item.placa !== '');
            if (isVehiculo) {
              const catVeh = item.categoria_vehiculo || item.subcategoria || item.categoria || 'VEHÍCULO';
              const anioVeh = item.vehiculo_anio || item.anio_fabricacion || item.anio_modelo || '—';
              return `
                <div class="space-y-0.5 text-slate-600">
                  <div><span class="font-semibold text-slate-400">Placa:</span> <span class="font-extrabold font-mono text-slate-900 bg-amber-100/80 px-1 py-0.5 rounded">${item.placa || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Motor:</span> <span class="text-slate-800 font-mono">${item.nro_motor || item.num_motor || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Chasis:</span> <span class="text-slate-800 font-mono">${item.nro_chasis || item.num_chasis || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Categoría:</span> <span class="text-slate-800">${catVeh}</span></div>
                  <div><span class="font-semibold text-slate-400">Año Modelo:</span> <span class="text-slate-800">${anioVeh}</span></div>
                </div>
              `;
            } else {
              const especStr = (item.especificaciones || item.especificacion || item.caracteristicas_accesorios || item.observaciones || '').trim();
              return `
                <div class="text-slate-600">
                  ${especStr ? `<span class="text-slate-800 font-medium">${especStr}</span>` : `<span class="text-slate-400 font-mono">—</span>`}
                </div>
              `;
            }
          })()}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[0.72rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[0.72rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-1.5 py-1 min-w-[125px]">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.responsable || 'Sin Asignar'}
          </div>
          ${(item.puesto || item.unidad) ? `<div class="text-[0.625rem] text-slate-500 italic font-medium uppercase mt-0.5">${item.puesto || item.unidad}</div>` : ''}
        </td>
        <td class="px-1 py-1 whitespace-nowrap text-center">
          <div class="inline-flex items-center justify-center gap-1">
            <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center justify-center gap-1 px-1.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital del Activo (PDF)">
              <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span class="text-[9px] font-extrabold leading-tight text-center">FICHA<br/>DIGITAL</span>
            </button>
            ${item.pdf_expediente_path ? `
              <a href="${getExpedientePdfUrl(item.pdf_expediente_path)}" target="_blank" rel="noopener noreferrer" download="Expediente_${item.cod_patrimonial}.pdf" class="inline-flex items-center justify-center gap-1 px-1.5 py-1 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-950 border border-amber-300 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Expediente del Activo (PDF)">
                <svg class="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <span class="text-[9px] font-extrabold leading-tight text-center">EXPEDIENTE<br/>PDF</span>
              </a>
            ` : ''}
          </div>
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderActivosMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });
    tbody.appendChild(frag);

    const bindFichaEvents = (container) => {
      if (!container) return;
      container.querySelectorAll('.btn-download-ficha-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const code = e.currentTarget.getAttribute('data-ficha-code');
          const activo = assets.find(a => String(a.cod_patrimonial) === String(code));
          if (activo) {
            generarFichaPDF_Public(activo);
          }
        });
      });
    };

    bindFichaEvents(tbody);
    bindFichaEvents(document.getElementById('assets-mobile-container'));
  }

  function renderActivosMobileCard(item, valLibrosFormateado, valNetoFormateado) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[0.75rem] font-bold text-brand-600 uppercase tracking-wide">Código patrimonial</div>
          <div class="mt-0.5 font-mono text-[0.9375rem] font-extrabold text-slate-900 break-words">
            ${item.cod_patrimonial || '—'}
          </div>
        </div>
        <div class="shrink-0">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.denominacion || 'Activo sin denominación'}
        </h3>
        <p class="mt-1 text-[0.8125rem] font-semibold text-brand-600 uppercase tracking-wide">
          ${item.subcategoria || 'Sin subcategoría'}
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Ingreso</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Documento</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Valor libros</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">S/. ${valLibrosFormateado}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Valor neto</dt>
          <dd class="mt-0.5 font-extrabold text-emerald-600">S/. ${valNetoFormateado}</dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-slate-100 pt-3 text-[0.8125rem] leading-relaxed text-slate-600">
        ${item.placa ? `
          <div><span class="font-semibold text-white bg-[#00B0F0] px-2 py-0.5 rounded-md text-[10px] font-mono mr-1.5 tracking-wider shadow-sm">${item.placa}</span></div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
        ` : `
          <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || 'S/M'} · <span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
        `}
        <div class="mt-1"><span class="font-semibold text-slate-400">Responsable:</span> ${item.responsable || 'Sin asignar'}</div>
      </div>

      <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
        <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300/80 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital del Activo (PDF)">
          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span>FICHA DIGITAL</span>
        </button>
        ${item.pdf_expediente_path ? `
          <a href="${getExpedientePdfUrl(item.pdf_expediente_path)}" target="_blank" rel="noopener noreferrer" download="Expediente_${item.cod_patrimonial}.pdf" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-950 border border-amber-300/80 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Expediente del Activo (PDF)">
            <svg class="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <span>EXPEDIENTE PDF</span>
          </a>
        ` : ''}
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: Obras en Curso ──────────────────────────────────────
  function renderObrasRows(data) {
    const tbody = document.getElementById('obras-tbody');
    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));

      const financiadoText = getFinanciadoText(item);
      const locText = item.localidad ? `(${item.localidad.trim()})` : '';

      row.innerHTML = `
        <td class="px-1.5 py-1 whitespace-nowrap text-center text-[0.72rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </div>
          <div class="text-[0.65rem] text-[#0088cc] font-mono font-bold mt-0.5">
            ${item.cuenta_contable || '—'}
          </div>
          <div class="text-[0.625rem] text-slate-400 font-mono mt-0.5">
            ${item.centro_costo || '—'}
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center text-[0.65rem]">
          <div class="text-slate-700 font-semibold leading-tight">
            Ingreso: <span class="text-slate-500 font-normal">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</span>
          </div>
          <div class="text-slate-700 font-semibold leading-tight mt-0.5">
            Alta: <span class="text-slate-500 font-normal">${formatDate(item.fecha_asignacion || item.fecha_alta)}</span>
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.sucursal || '—'}
          </div>
          ${locText ? `<div class="text-[0.65rem] text-slate-600 font-medium mt-0.5">${locText}</div>` : ''}
          ${financiadoText ? `<div class="text-[0.6rem] text-slate-500 italic font-medium mt-0.5">${financiadoText}</div>` : ''}
        </td>
        <td class="px-1.5 py-1 min-w-[150px]">
          <div class="text-[0.72rem] font-bold text-slate-900 leading-snug uppercase">
            ${item.denominacion}
          </div>
          <div class="text-[0.625rem] text-[#0088cc] font-bold italic uppercase mt-0.5">
            ${item.subcategoria || item.categoria || '—'}
          </div>
          ${(() => {
            const actaVal = item.n_acta || item.n_acta_entrega;
            if (!actaVal) return '';
            const dateStr = item.fecha_alta_factura || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
            let year = new Date().getFullYear();
            if (dateStr && String(dateStr).trim().length >= 4) {
              const parsedY = parseInt(String(dateStr).trim().substring(0, 4), 10);
              if (parsedY && !isNaN(parsedY)) year = parsedY;
            }
            let text = String(actaVal).trim();
            const hasPrefix = /^acta\s*n[°o]?\s*/i.test(text);
            const prefix = hasPrefix ? '' : 'Acta N° ';
            const hasYear = /\b(19|20)\d{2}\b/.test(text);
            const suffix = hasYear ? '' : ` - ${year}`;
            return `<div class="text-[0.625rem] text-amber-600 font-mono font-semibold mt-0.5">${prefix}${text}${suffix}</div>`;
          })()}
        </td>
        <td class="px-1.5 py-1 text-[0.7rem] min-w-[120px] text-slate-600 leading-normal">
          <div class="space-y-0.5">
            <div><span class="font-semibold text-slate-400">Color:</span> <span class="text-slate-700">${item.color || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Marca:</span> <span class="text-slate-800 font-medium">${item.marca || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> <span class="text-slate-800 font-medium">${item.modelo || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Serie:</span> <span class="text-slate-800 font-mono font-medium">${item.numero_serie || 'S/S'}</span></div>
          </div>
        </td>
        <td class="px-1.5 py-1 text-[0.7rem] min-w-[135px] leading-snug">
          ${(() => {
            const isVehiculo = (item.categoria && item.categoria.toLowerCase().includes('vehiculo')) ||
                               (item.subcategoria && item.subcategoria.toLowerCase().includes('vehiculo')) ||
                               (item.cod_categoria && String(item.cod_categoria).startsWith('4')) ||
                               (item.placa && item.placa !== '');
            if (isVehiculo) {
              const catVeh = item.categoria_vehiculo || item.subcategoria || item.categoria || 'VEHÍCULO';
              const anioVeh = item.vehiculo_anio || item.anio_fabricacion || item.anio_modelo || '—';
              return `
                <div class="space-y-0.5 text-slate-600">
                  <div><span class="font-semibold text-slate-400">Placa:</span> <span class="font-extrabold font-mono text-slate-900 bg-amber-100/80 px-1 py-0.5 rounded">${item.placa || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Motor:</span> <span class="text-slate-800 font-mono">${item.nro_motor || item.num_motor || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Chasis:</span> <span class="text-slate-800 font-mono">${item.nro_chasis || item.num_chasis || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Categoría:</span> <span class="text-slate-800">${catVeh}</span></div>
                  <div><span class="font-semibold text-slate-400">Año Modelo:</span> <span class="text-slate-800">${anioVeh}</span></div>
                </div>
              `;
            } else {
              const especStr = (item.especificaciones || item.especificacion || item.caracteristicas_accesorios || item.observaciones || '').trim();
              return `
                <div class="text-slate-600">
                  ${especStr ? `<span class="text-slate-800 font-medium">${especStr}</span>` : `<span class="text-slate-400 font-mono">—</span>`}
                </div>
              `;
            }
          })()}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[0.72rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[0.72rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-1.5 py-1 min-w-[125px]">
          <div class="font-bold text-slate-800 text-[0.72rem]">
            ${item.responsable || 'Sin Asignar'}
          </div>
          ${(item.puesto || item.unidad) ? `<div class="text-[0.625rem] text-slate-500 italic font-medium uppercase mt-0.5">${item.puesto || item.unidad}</div>` : ''}
        </td>
        <td class="px-1 py-1 whitespace-nowrap text-center">
          <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center justify-center gap-1 px-1.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital de Obra (PDF)">
            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span class="text-[9px] font-extrabold leading-tight text-center">FICHA<br/>DIGITAL</span>
          </button>
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderObrasMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });
    tbody.appendChild(frag);

    const bindObrasFichaEvents = (container) => {
      if (!container) return;
      container.querySelectorAll('.btn-download-ficha-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const code = e.currentTarget.getAttribute('data-ficha-code');
          const activo = assets.find(a => String(a.cod_patrimonial) === String(code));
          if (activo) {
            generarFichaPDF_Public(activo);
          }
        });
      });
    };

    bindObrasFichaEvents(tbody);
    bindObrasFichaEvents(document.getElementById('assets-mobile-container'));
  }

  function renderObrasMobileCard(item, valLibrosFormateado, valNetoFormateado) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[0.75rem] font-bold text-brand-600 uppercase tracking-wide">Código patrimonial</div>
          <div class="mt-0.5 font-mono text-[0.9375rem] font-extrabold text-slate-900 break-words">
            ${item.cod_patrimonial || '—'}
          </div>
        </div>
        <div class="shrink-0">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.denominacion || 'Obra sin denominación'}
        </h3>
        <p class="mt-1 text-[0.8125rem] font-semibold text-brand-600 uppercase tracking-wide">
          ${item.subcategoria || 'Sin subcategoría'}
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Ingreso</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Documento</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Valor libros</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">S/. ${valLibrosFormateado}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Valor neto</dt>
          <dd class="mt-0.5 font-extrabold text-emerald-600">S/. ${valNetoFormateado}</dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-slate-100 pt-3 text-[0.8125rem] leading-relaxed text-slate-600">
        ${item.placa ? `
          <div><span class="font-semibold text-white bg-[#00B0F0] px-2 py-0.5 rounded-md text-[10px] font-mono mr-1.5 tracking-wider shadow-sm">${item.placa}</span></div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
        ` : `
          <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || 'S/M'} · <span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
        `}
        <div class="mt-1"><span class="font-semibold text-slate-400">Responsable:</span> ${item.responsable || 'Sin asignar'}</div>
      </div>

      <div class="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
        <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300/80 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital de Obra (PDF)">
          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span>FICHA DIGITAL</span>
        </button>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  function getUbicacionFinanciado(item) {
    if (!item) return '—';
    const sucursal = (item.sucursal || '—').trim();
    const localidad = item.localidad ? item.localidad.trim() : '';

    const codPat = String(item.cod_patrimonial || '').trim();
    const ctaContable = String(item.cuenta_contable || '').trim();
    const docTipo = (item.documento_tipo || '').toUpperCase().trim();
    const fuenteStr = (
      item.fuente || 
      item.fuente_origen || 
      item.documento_concepto || 
      item.concepto || 
      item.observaciones || 
      item.n_doc || 
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
      financiado = (item.fuente || item.fuente_origen || '').trim();
    }

    const lines = [sucursal];
    if (localidad && localidad.toUpperCase() !== sucursal.toUpperCase()) {
      lines.push(localidad);
    }
    if (financiado) {
      lines.push(financiado);
    }

    return lines.join('\n');
  }

  // ── Renders del Módulo: Vehículos ──────────────────────────────────────────
  function renderVehiculosRows(data) {
    const tbody = document.getElementById('vehiculos-tbody');
    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
      const soatBadge = isBaja ? 
        '<span class="px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-lg bg-slate-100 text-slate-400 border border-slate-200">No requiere (Baja)</span>' : 
        getSoatBadgeHTML(item.soat_estado, item.soat_vencimiento, item.soat_dias_vigencia);
      const revTecBadge = isBaja ? 
        '<span class="px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-lg bg-slate-100 text-slate-400 border border-slate-200">No requiere (Baja)</span>' : 
        getRevTecBadgeHTML(item.estado_rev_tec, item.vencimiento_rev_tec, item.dias_vigencia_rev_tec);
      
      row.innerHTML = `
        <!-- Placa -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          <span class="font-mono font-bold text-slate-900 bg-white border border-slate-800 px-1.5 py-0.5 rounded text-[10px] tracking-wider shadow-2xs">
            ${item.placa || 'SIN PLACA'}
          </span>
        </td>
        
        <!-- Código Patrimonial -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center text-[0.72rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        
        <!-- Ubicación Financiado -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${getUbicacionFinanciado(item).split('\n').map((line, idx) => {
            if (idx === 0) return `<div class="font-bold text-slate-900 text-[0.72rem]">${line}</div>`;
            if (idx === 1 && line !== 'Transferencia' && line !== 'Obra en curso' && line !== 'Liq. Obra' && line !== 'Donación') {
              return `<div class="text-[0.65rem] text-slate-500 font-medium mt-0.5">${line}</div>`;
            }
            return `<span class="inline-block text-[0.6rem] font-bold text-slate-600 bg-slate-100 border border-slate-200 uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5">${line}</span>`;
          }).join('')}
        </td>
        
        <!-- Denominación / Características -->
        <td class="px-1.5 py-1 w-[170px]">
          <div class="text-[0.72rem] font-bold text-slate-900 leading-snug uppercase">
            ${(item.denominacion || '').toUpperCase()}
          </div>
          <div class="text-[0.68rem] text-slate-600 mt-0.5 space-y-0.5 font-medium">
            <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || '—'}</div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || '—'}</div>
            <div><span class="font-semibold text-slate-400">Año:</span> ${item.vehiculo_anio || '—'}</div>
            <div class="text-[0.625rem] font-bold text-brand-600 italic mt-0.5">CAT: ${(item.subcategoria || 'VEHÍCULO').toUpperCase()}</div>
          </div>
        </td>
        
        <!-- Especificaciones Técnicas -->
        <td class="px-1.5 py-1 text-[0.7rem] w-[160px] text-slate-600 leading-snug">
          <div><span class="font-medium text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div><span class="font-medium text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
          <div><span class="font-medium text-slate-400">Combustible:</span> ${item.combustible || '—'}</div>
          ${item.carroceria ? `<div><span class="font-medium text-slate-400">Carrocería:</span> ${item.carroceria}</div>` : ''}
          ${item.categoria_vehiculo ? `<div><span class="font-medium text-slate-400">Categoría:</span> ${item.categoria_vehiculo}</div>` : ''}
          ${item.nro_tarjeta_prop ? `<div><span class="font-medium text-slate-400">Tarjeta Prop:</span> ${item.nro_tarjeta_prop}</div>` : ''}
        </td>
        
        <!-- Estado Físico -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        
        <!-- SOAT -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${soatBadge}
        </td>
        
        <!-- Revisión Técnica -->
        <td class="px-1.5 py-1 whitespace-nowrap text-center">
          ${revTecBadge}
        </td>
        
        <!-- Responsable -->
        <td class="px-1.5 py-1 whitespace-nowrap text-[0.72rem] font-bold text-slate-800">
          ${item.responsable || '—'}
        </td>

        <!-- Documento SOAT PDF (Al Final) -->
        <td class="px-1 py-1 whitespace-nowrap text-center">
          ${item.pdf_soat_path ? `
            <a href="${getSoatPdfUrl(item.pdf_soat_path)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1 px-1.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-900 border border-rose-200 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Ver / Descargar PDF del SOAT" download="${item.cod_patrimonial}_soat.pdf">
              <svg class="w-3.5 h-3.5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span class="text-[9px] font-extrabold leading-tight text-center">PDF<br/>SOAT</span>
            </a>
          ` : '<span class="text-xs text-slate-400 font-semibold">—</span>'}
        </td>

        <!-- Documento TIVE PDF -->
        <td class="px-1 py-1 whitespace-nowrap text-center">
          ${item.pdf_tive_path ? `
            <a href="${getTivePdfUrl(item.pdf_tive_path)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1 px-1.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 border border-sky-200 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Ver / Descargar PDF del TIVE" download="${item.cod_patrimonial}_tive.pdf">
              <svg class="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span class="text-[9px] font-extrabold leading-tight text-center">PDF<br/>TIVE</span>
            </a>
          ` : '<span class="text-xs text-slate-400 font-semibold">—</span>'}
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderVehiculosMobileCard(item, soatBadge, revTecBadge);
    });
    tbody.appendChild(frag);
  }

  function renderVehiculosMobileCard(item, soatBadge, revTecBadge) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex items-center gap-2">
          <span class="font-mono font-bold text-slate-900 bg-slate-50 border-2 border-slate-900 px-2 py-0.5 rounded text-[10px] tracking-wider shadow-sm">
            ${item.placa || 'SIN PLACA'}
          </span>
          <span class="text-[11px] font-semibold text-brand-600 uppercase tracking-wide">
            ${item.subcategoria || 'VEHÍCULO'}
          </span>
        </div>
        <div class="shrink-0">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.denominacion || 'Vehículo sin denominación'}
        </h3>
        <p class="text-[11px] text-slate-400 mt-1">
          Código: <span class="font-mono font-bold text-slate-600">${item.cod_patrimonial}</span>
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Marca / Modelo</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.marca || '—'} / ${item.modelo || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Año Fab.</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.vehiculo_anio || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Motor</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono text-xs">${item.nro_motor || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Chasis</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono text-xs">${item.nro_chasis || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Combustible</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.combustible || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Tarjeta Prop.</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.nro_tarjeta_prop || '—'}</dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
        <div>
          <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Seguro SOAT</h4>
          <div class="mt-1 flex flex-col items-start gap-1">
            ${soatBadge}
            ${item.pdf_soat_path ? `
              <a href="${getSoatPdfUrl(item.pdf_soat_path)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg mt-1 shadow-2xs" download="${item.cod_patrimonial}_soat.pdf">
                📄 PDF SOAT
              </a>
            ` : ''}
          </div>
        </div>
        <div>
          <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Rev. Técnica / TIVE</h4>
          <div class="mt-1">${revTecBadge}</div>
          ${item.pdf_tive_path ? `
            <a href="${getTivePdfUrl(item.pdf_tive_path)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg mt-1.5 shadow-2xs" download="${item.cod_patrimonial}_tive.pdf">
              📄 PDF TIVE
            </a>
          ` : ''}
        </div>
      </div>

      <div class="mt-3 border-t border-slate-100 pt-3 text-[0.8125rem]">
        <span class="font-semibold text-slate-400">Responsable:</span> <span class="font-medium text-slate-700">${item.responsable || 'Sin asignar'}</span>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: SOAT y RT ─────────────────────────────────────────
  function renderSoatRows(data) {
    const tbody = document.getElementById('soat-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
      const soatBadge = isBaja ? 
        '<span class="px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-lg bg-slate-100 text-slate-400 border border-slate-200">No requiere (Baja)</span>' : 
        getSoatBadgeHTML(item.soat_estado, item.soat_vencimiento, item.soat_dias_vigencia);
      const revTecBadge = isBaja ? 
        '<span class="px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-lg bg-slate-100 text-slate-400 border border-slate-200">No requiere (Baja)</span>' : 
        getRevTecBadgeHTML(item.estado_rev_tec, item.vencimiento_rev_tec, item.dias_vigencia_rev_tec);
      
      row.innerHTML = `
        <!-- Placa -->
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="font-mono font-bold text-slate-900 bg-white border-2 border-slate-900 px-3 py-1 rounded text-xs tracking-wider shadow-sm">
            ${item.placa || 'SIN PLACA'}
          </span>
        </td>
        
        <!-- Código Patrimonial -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        
        <!-- Tipo / Subcategoria -->
        <td class="px-5 py-4 whitespace-nowrap text-xs font-semibold text-brand-600">
          ${item.subcategoria || 'VEHÍCULO'}
        </td>
        
        <!-- Ubicación -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.localidad || '—'}
          </div>
        </td>
        
        <!-- Denominación -->
        <td class="px-5 py-4 min-w-[200px]">
          <div class="text-[0.875rem] font-bold text-slate-800 leading-snug">
            ${item.denominacion}
          </div>
          <div class="text-[0.75rem] text-slate-400 mt-1">
            Año: ${item.vehiculo_anio || '—'} &bull; Marca: ${item.marca || '—'} &bull; Modelo: ${item.modelo || '—'}
          </div>
        </td>
        
        <!-- Estado Físico -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        
        <!-- SOAT -->
        <td class="px-5 py-4 whitespace-nowrap text-center">
          ${soatBadge}
        </td>
        
        <!-- Revisión Técnica -->
        <td class="px-5 py-4 whitespace-nowrap text-center">
          ${revTecBadge}
        </td>
        
        <!-- Responsable -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
        </td>
      `;
      tbody.appendChild(row);
      renderSoatMobileCard(item, soatBadge, revTecBadge);
    });
  }

  function renderSoatMobileCard(item, soatBadge, revTecBadge) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex items-center gap-2">
          <span class="font-mono font-bold text-slate-900 bg-slate-50 border-2 border-slate-900 px-2 py-0.5 rounded text-[10px] tracking-wider shadow-sm">
            ${item.placa || 'SIN PLACA'}
          </span>
          <span class="text-[11px] font-semibold text-brand-600 uppercase tracking-wide">
            ${item.subcategoria || 'VEHÍCULO'}
          </span>
        </div>
        <div class="shrink-0">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.denominacion || 'Vehículo sin denominación'}
        </h3>
        <p class="text-[11px] text-slate-400 mt-1">
          Código: <span class="font-mono font-bold text-slate-600">${item.cod_patrimonial}</span>
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Marca / Modelo</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.marca || '—'} / ${item.modelo || '—'}</dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
        <div>
          <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Seguro SOAT</h4>
          <div class="mt-1">${soatBadge}</div>
        </div>
        <div>
          <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Rev. Técnica</h4>
          <div class="mt-1">${revTecBadge}</div>
        </div>
      </div>

      <div class="mt-3 border-t border-slate-100 pt-3 text-[0.8125rem]">
        <span class="font-semibold text-slate-400">Responsable:</span> <span class="font-medium text-slate-700">${item.responsable || 'Sin asignar'}</span>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: Celulares ──────────────────────────────────────────
  function renderCelularesRows(data) {
    const tbody = document.getElementById('celulares-tbody');
    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      const valUtilBadge = getCelularVidaUtilBadgeHTML(item.vida_util_estado, item.fecha_renovacion, item.dias_para_renovar);
      const celEstadoBadge = getCelularEstadoBadgeHTML(item.estado);
      
      row.innerHTML = `
        <!-- Código Control -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_control}
        </td>
        
        <!-- Número Línea (después de Cód. Control, en negrita y azul) -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-brand-600">
          ${item.numero_linea || '\u2014'}
        </td>
        
        <!-- Marca / Modelo -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.marca || 'S/M'}
          </div>
          <div class="text-xs text-slate-500 font-medium">
            ${item.modelo || 'S/M'}
          </div>
        </td>
        
        <!-- IMEI / Operador -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="text-[0.8125rem] text-slate-800 font-mono">
            ${item.imei || '\u2014'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide">
            ${item.operador || '\u2014'}
          </div>
        </td>
        
        <!-- Sucursal (solo sucursal, sin localidad) -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '\u2014'}
          </div>
        </td>
        
        <!-- Fecha Ingreso -->
        <td class="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium font-mono">
          ${formatDate(item.fecha_ingreso)}
        </td>
        
        <!-- Fecha Asignación -->
        <td class="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium font-mono">
          ${formatDate(item.fecha_asignacion)}
        </td>
        
        <!-- Asignado a -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.responsable || 'Sin asignar'}
          </div>
          <div class="text-[0.6875rem] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">
            ${item.puesto || '\u2014'}
          </div>
        </td>
        
        <!-- Renovación (Vida Útil) -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${valUtilBadge}
        </td>
        
        <!-- Estado -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${celEstadoBadge}
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderCelularesMobileCard(item, valUtilBadge, celEstadoBadge);
    });
    tbody.appendChild(frag);
  }

  function renderCelularesMobileCard(item, valUtilBadge, celEstadoBadge) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[0.75rem] font-bold text-brand-600 uppercase tracking-wide">Código de control</div>
          <div class="mt-0.5 font-mono text-[0.9375rem] font-extrabold text-slate-900 break-words">
            ${item.cod_control || '—'}
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-1.5">
          ${celEstadoBadge}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.marca || 'S/M'} - ${item.modelo || 'S/M'}
        </h3>
        <p class="text-[11px] text-slate-400 mt-1">
          Línea: <span class="font-mono font-bold text-slate-700">${item.numero_linea || '—'}</span> &bull; Operador: <span class="font-medium text-slate-600">${item.operador || '—'}</span>
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '\u2014'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Fecha Ingreso</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono">${formatDate(item.fecha_ingreso)}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">IMEI</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono text-xs break-all">${item.imei || '\u2014'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">N\u00b0 L\u00ednea</dt>
          <dd class="mt-0.5 font-bold text-brand-600 font-mono">${item.numero_linea || '\u2014'}</dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-slate-100 pt-3">
        <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Vida Útil (3 Años)</h4>
        <div>${valUtilBadge}</div>
      </div>

      <div class="mt-3 border-t border-slate-100 pt-3 text-[0.8125rem]">
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold text-slate-400">Asignado a:</span>
          <span class="font-bold text-slate-700">${item.responsable || 'Sin asignar'}</span>
          <span class="text-xs text-slate-500 font-medium">${item.puesto || '—'}</span>
        </div>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: Inventario General ──────────────────────────────────
  function renderInventarioRows(data) {
    const tbody = document.getElementById('inventario-tbody');
    tbody.innerHTML = '';
    const mobileContainer = document.getElementById('assets-mobile-container');
    if (currentTab === 'inventario') mobileContainer.innerHTML = '';

    // Actualizar Indicadores Superiores (KPIs) respetando exactamente los filtros activos (incluso si dan 0 resultados)
    const allInventario = hasAppliedFilters ? lastInventarioKpiBase : getInventarioUnificado();
    const kpiTotal = allInventario.length;
    const kpiActivos = allInventario.filter(i => i.tipo_origen === 'ACTIVO FIJO' || i.tipo_origen === 'INCORPORACIÓN').length;
    const kpiObras = allInventario.filter(i => i.tipo_origen === 'OBRA EN CURSO').length;
    const kpiConciliacion = allInventario.filter(i => i.tipo_origen === 'CONCILIACIÓN').length;
    const kpiTerceros = allInventario.filter(i => i.tipo_origen === 'BIEN DE TERCEROS').length;
    const kpiSobrantes = allInventario.filter(i => i.tipo_origen === 'SOBRANTE').length;
    const kpiFaltantes = allInventario.filter(i => i.tipo_origen === 'FALTANTE' || i.estado_activo === 'FALTANTE').length;
    const kpiInversion = allInventario.reduce((acc, i) => acc + (Number(i.valor_en_libros) || 0), 0);

    const elTotal = document.getElementById('inventario-kpi-total');
    const elActivos = document.getElementById('inventario-kpi-activos');
    const elObras = document.getElementById('inventario-kpi-obras');
    const elConc = document.getElementById('inventario-kpi-conciliacion');
    const elTerceros = document.getElementById('inventario-kpi-terceros');
    const elSobrantes = document.getElementById('inventario-kpi-sobrantes');
    const elFaltantes = document.getElementById('inventario-kpi-faltantes');
    const elInversion = document.getElementById('inventario-kpi-inversion');

    if (elTotal) elTotal.textContent = kpiTotal;
    if (elActivos) elActivos.textContent = kpiActivos;
    if (elObras) elObras.textContent = kpiObras;
    if (elConc) elConc.textContent = kpiConciliacion;
    if (elTerceros) elTerceros.textContent = kpiTerceros;
    if (elSobrantes) elSobrantes.textContent = kpiSobrantes;
    if (elFaltantes) elFaltantes.textContent = kpiFaltantes;
    if (elInversion) elInversion.textContent = formatMoney(kpiInversion);

    // Resaltar y vincular KPI cards clicables
    document.querySelectorAll('.inv-kpi-card').forEach(card => {
      const fKey = card.getAttribute('data-inv-filter');
      if (fKey === inventarioSubFilter) {
        card.classList.add('ring-2', 'ring-brand-500');
      } else {
        card.classList.remove('ring-2', 'ring-brand-500');
      }
      if (!card.dataset.boundClick) {
        card.dataset.boundClick = '1';
        card.addEventListener('click', () => {
          inventarioSubFilter = fKey || 'ALL';
          applyFilters();
        });
      }
    });

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="py-10 text-center text-slate-400 text-xs font-semibold">No hay bienes en esta vista con los filtros activos.</td></tr>';
      return;
    }

    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-blue-50/75 text-slate-700 transition-colors border-b border-slate-150';

      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));
      const financiadoText = getFinanciadoText(item) || item.fuente || '';
      const locText = item.localidad ? `(${item.localidad.trim()})` : '';

      // Badge de origen
      let origenBadge = '';
      if (item.tipo_origen === 'OBRA EN CURSO') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded">OBRA</span>';
      } else if (item.tipo_origen === 'CONCILIACIÓN') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded">CONCILIACIÓN</span>';
      } else if (item.tipo_origen === 'INCORPORACIÓN') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded">INCORP.</span>';
      } else if (item.tipo_origen === 'BIEN DE TERCEROS') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">TERCERO</span>';
      } else if (item.tipo_origen === 'SOBRANTE') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded">SOBRANTE</span>';
      } else if (item.tipo_origen === 'FALTANTE' || item.estado_activo === 'FALTANTE') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded">FALTANTE</span>';
      } else if (item.tipo_origen === 'BIEN DE CONTROL') {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded">CONTROL</span>';
      } else {
        origenBadge = '<span class="inline-block mt-0.5 px-1 py-0.2 text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded">ACTIVO FIJO</span>';
      }

      const docStr = item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'INCORPORACION' ? `INC-${item.n_doc}` : item.n_doc) : '—';

      row.innerHTML = `
        <td class="px-1.5 py-1 whitespace-nowrap text-center align-middle">
          <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-50 text-[#00509d] border border-blue-200/80">
            ${item.cod_patrimonial || '—'}
          </span>
          <div>${origenBadge}</div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center align-middle">
          <div class="font-extrabold text-slate-800 text-[10px] font-mono">
            ${docStr}
          </div>
          <div class="text-[9.5px] text-[#0077b6] font-mono font-extrabold mt-0.5">
            ${item.cuenta_contable || '—'}
          </div>
          <div class="text-[9px] text-slate-400 font-mono mt-0.5">
            ${item.centro_costo || '—'}
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center align-middle text-[9.5px]">
          <div class="text-slate-700 font-medium leading-tight">
            Ingreso: <span class="text-slate-500 font-normal">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</span>
          </div>
          <div class="text-slate-700 font-medium leading-tight mt-0.5">
            Alta: <span class="text-slate-500 font-normal">${formatDate(item.fecha_asignacion || item.fecha_alta)}</span>
          </div>
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center align-middle">
          <div class="font-bold text-slate-800 text-[10px]">
            ${item.sucursal || '—'}
          </div>
          ${locText ? `<div class="text-[9px] text-slate-500 font-medium mt-0.5">${locText}</div>` : ''}
          ${financiadoText ? `<div class="text-[8.5px] text-slate-400 italic mt-0.5">${financiadoText}</div>` : ''}
        </td>
        <td class="px-2 py-1 min-w-[150px] align-middle">
          <div class="text-[10.5px] font-bold text-slate-900 leading-tight">
            ${item.denominacion || ''}
          </div>
          <div class="text-[9px] text-[#0088cc] font-bold italic uppercase mt-0.5">
            ${item.subcategoria || item.categoria || '—'}
          </div>
          ${(() => {
            const actaVal = item.n_acta || item.n_acta_entrega;
            if (!actaVal) return '';
            return `<div class="text-[9px] text-amber-600 font-mono font-semibold mt-0.5">Acta N° ${actaVal}</div>`;
          })()}
        </td>
        <td class="px-1.5 py-1 text-[9.5px] min-w-[120px] text-slate-600 leading-tight align-middle">
          <div class="space-y-0.5">
            <div><span class="font-semibold text-slate-400">Color:</span> <span class="text-slate-700">${item.color || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Marca:</span> <span class="text-slate-800 font-medium">${item.marca || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> <span class="text-slate-700">${item.modelo || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Serie:</span> <span class="text-slate-700 font-mono">${item.numero_serie || 'S/S'}</span></div>
          </div>
        </td>
        <td class="px-1.5 py-1 text-[9.5px] min-w-[135px] leading-snug align-middle">
          ${(() => {
            if (item.placa && item.placa !== '') {
              return `
                <div class="space-y-0.5 text-slate-600">
                  <div><span class="font-semibold text-slate-400">Placa:</span> <span class="font-extrabold font-mono text-slate-900 bg-amber-100/80 px-1 py-0.2 rounded text-[9.5px]">${item.placa}</span></div>
                  <div><span class="font-semibold text-slate-400">Motor:</span> <span class="text-slate-800 font-mono">${item.nro_motor || item.num_motor || '—'}</span></div>
                  <div><span class="font-semibold text-slate-400">Chasis:</span> <span class="text-slate-800 font-mono">${item.nro_chasis || item.num_chasis || '—'}</span></div>
                </div>
              `;
            } else {
              const especStr = (item.especificaciones || item.especificacion || item.caracteristicas_accesorios || item.observaciones || '').trim();
              return `<div class="text-slate-600">${especStr ? `<span class="text-slate-800 font-medium">${especStr}</span>` : `<span class="text-slate-400 font-mono">—</span>`}</div>`;
            }
          })()}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-center align-middle">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[10px] font-mono text-slate-600 align-middle">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-1.5 py-1 whitespace-nowrap text-right text-[10px] font-mono font-bold text-emerald-700 align-middle">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-1.5 py-1 min-w-[125px] align-middle">
          <div class="font-bold text-slate-800 text-[10px] leading-tight">
            ${item.responsable || 'Sin Asignar'}
          </div>
          ${(item.puesto || item.unidad) ? `<div class="text-[8.5px] text-slate-500 italic uppercase mt-0.5">${item.puesto || item.unidad}</div>` : ''}
        </td>
        <td class="px-1 py-1 whitespace-nowrap text-center align-middle">
          ${item.cod_patrimonial && !item.is_sobrante_origin && !item.is_faltante_origin ? `
            <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center justify-center gap-1 px-1.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital del Activo (PDF)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </button>
          ` : '<span class="text-slate-300 text-xs">—</span>'}
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderInventarioMobileCard(item);
    });
    tbody.appendChild(frag);
  }

  function renderInventarioMobileCard(item) {
    const mobileContainer = document.getElementById('assets-mobile-container');
    if (!mobileContainer) return;
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 mb-2';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <span class="text-[0.6875rem] font-bold text-brand-600 uppercase tracking-wide">Cód. Patrimonial</span>
          <div class="font-mono text-xs font-black text-slate-900 mt-0.5">${item.cod_patrimonial || '—'}</div>
        </div>
        <div class="flex flex-col items-end gap-1">
          ${getEstadoBadgeHTML(item.estado_activo)}
          <span class="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">${item.tipo_origen || 'ACTIVO'}</span>
        </div>
      </div>
      <div class="mt-2 pt-2 border-t border-slate-100">
        <h4 class="text-xs font-black text-slate-800 leading-snug">${item.denominacion || 'Sin denominación'}</h4>
        <div class="text-[10px] text-brand-600 font-semibold mt-0.5">${item.subcategoria || item.categoria || '—'}</div>
      </div>
      <div class="mt-2.5 grid grid-cols-2 gap-2 text-[10px] text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-150">
        <div>
          <span class="font-bold text-slate-400 block text-[9px] uppercase">Sucursal</span>
          <span class="font-semibold text-slate-800">${item.sucursal || '—'}</span>
          ${item.localidad ? `<span class="block text-slate-500 text-[9px]">(${item.localidad})</span>` : ''}
        </div>
        <div>
          <span class="font-bold text-slate-400 block text-[9px] uppercase">Responsable</span>
          <span class="font-semibold text-slate-800">${item.responsable || 'Sin Asignar'}</span>
          ${(item.puesto || item.unidad) ? `<span class="block text-slate-500 text-[9px] truncate">${item.puesto || item.unidad}</span>` : ''}
        </div>
        <div>
          <span class="font-bold text-slate-400 block text-[9px] uppercase">Valor Libros</span>
          <span class="font-mono font-bold text-slate-800">S/. ${formatMoney(item.valor_en_libros)}</span>
        </div>
        <div>
          <span class="font-bold text-slate-400 block text-[9px] uppercase">Valor Neto</span>
          <span class="font-mono font-bold text-emerald-700">S/. ${formatMoney(getNetValue(item))}</span>
        </div>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: Regularización Patrimonial ─────────────────────────
  function renderTercerosRows(data) {
    const tbody = document.getElementById('terceros-tbody');
    tbody.innerHTML = '';

    // Actualizar contadores de sub-pestañas de Regularización respetando exactamente los filtros activos
    const srcReg = hasAppliedFilters
      ? lastRegSubTabBase
      : (regularizacion.length > 0 ? regularizacion : terceros);
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('reg-cnt-all', srcReg.length);
    setTxt('reg-cnt-conc', srcReg.filter(x => String(x.sub_modulo || '').toUpperCase() === 'CONCILIACION').length);
    setTxt('reg-cnt-sob', srcReg.filter(x => String(x.sub_modulo || '').toUpperCase() === 'SOBRANTE').length);
    setTxt('reg-cnt-fal', srcReg.filter(x => String(x.sub_modulo || '').toUpperCase() === 'FALTANTE').length);
    setTxt('reg-cnt-ter', srcReg.filter(x => String(x.sub_modulo || x.tipo || '').toUpperCase() === 'TERCERO').length);
    setTxt('reg-cnt-ctrl', srcReg.filter(x => String(x.sub_modulo || x.tipo || '').toUpperCase() === 'CONTROL').length);

    document.querySelectorAll('.reg-subtab-btn').forEach(btn => {
      const st = btn.getAttribute('data-reg-subtab');
      if (st === regularizacionSubTab) {
        btn.className = 'reg-subtab-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[#00509d] text-white border border-[#00509d] cursor-pointer';
      } else {
        btn.className = 'reg-subtab-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:border-sky-400 cursor-pointer';
      }
      if (!btn.dataset.boundClick) {
        btn.dataset.boundClick = '1';
        btn.addEventListener('click', () => {
          regularizacionSubTab = st || 'ALL';
          applyFilters();
        });
      }
    });

    const subBadgeMap = {
      CONCILIACION: 'bg-sky-50 text-sky-800 border-sky-200',
      SOBRANTE: 'bg-purple-50 text-purple-800 border-purple-200',
      FALTANTE: 'bg-rose-50 text-rose-800 border-rose-200',
      TERCERO: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      CONTROL: 'bg-slate-100 text-slate-800 border-slate-300',
    };

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-slate-400 text-xs font-semibold">No hay registros en esta sub-pestaña con los filtros activos.</td></tr>';
      return;
    }

    const frag = document.createDocumentFragment();
    const isMobileViewport = window.innerWidth < 768;
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-blue-50/60 text-slate-700 transition-colors border-b border-slate-150 text-xs';
      const subMod = String(item.sub_modulo || item.tipo || 'CONCILIACION').toUpperCase();
      const badgeCls = subBadgeMap[subMod] || 'bg-slate-100 text-slate-700 border-slate-200';
      const unidadOrg = item.puesto || item.unidad || '';
      const especHtml = item.placa
        ? `<div><span class="font-mono font-extrabold text-slate-900 bg-amber-100/90 px-1 rounded">Placa: ${item.placa}</span></div>
           <div class="text-[10px] text-slate-500 font-mono">Mot: ${item.nro_motor || '—'} · Chas: ${item.nro_chasis || '—'}</div>`
        : `<div class="text-[10.5px] text-slate-600 line-clamp-2">${item.caracteristicas_accesorios || item.observaciones || '—'}</div>`;

      row.innerHTML = `
        <td class="px-2 py-1.5 text-center whitespace-nowrap">
          <span class="inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10.5px] bg-blue-50 text-[#00509d] border border-blue-200">${item.cod_patrimonial || '—'}</span>
        </td>
        <td class="px-2 py-1.5 text-center whitespace-nowrap">
          <span class="inline-block px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border ${badgeCls}">${subMod}</span>
        </td>
        <td class="px-2 py-1.5 text-center whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[10.5px]">${item.sucursal || '—'}</div>
          ${item.localidad ? `<div class="text-[9px] text-slate-500">(${item.localidad})</div>` : ''}
        </td>
        <td class="px-2 py-1.5 min-w-[180px]">
          <div class="font-bold text-slate-900 text-[11px] leading-tight">${item.denominacion || ''}</div>
          <div class="text-[9px] text-[#0077b6] font-bold italic uppercase mt-0.5">${item.subcategoria || item.categoria || '—'}</div>
        </td>
        <td class="px-2 py-1.5 text-[10px] text-slate-600 leading-tight">
          <div><span class="text-slate-400 font-semibold">Marca:</span> ${item.marca || 'S/M'}</div>
          <div><span class="text-slate-400 font-semibold">Mod:</span> ${item.modelo || '—'}</div>
          <div class="font-mono"><span class="text-slate-400 font-sans font-semibold">Serie:</span> ${item.numero_serie || 'S/S'}${item.color ? ` · ${item.color}` : ''}</div>
        </td>
        <td class="px-2 py-1.5">${especHtml}</td>
        <td class="px-2 py-1.5 text-center whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo || 'REGULAR')}
        </td>
        <td class="px-2 py-1.5 text-right whitespace-nowrap font-mono font-bold text-[10.5px] text-slate-800">
          S/. ${formatMoney(item.valor_en_libros || 0)}
        </td>
        <td class="px-2 py-1.5">
          <div class="font-bold text-slate-800 text-[10.5px] truncate max-w-[175px]">${item.responsable || item.propietario_manual || 'Sin Asignar'}</div>
          ${unidadOrg ? `<div class="text-[9px] text-slate-500 uppercase truncate max-w-[175px]">${unidadOrg}</div>` : ''}
        </td>
      `;
      frag.appendChild(row);
      if (isMobileViewport) renderTercerosMobileCard(item);
    });
    tbody.appendChild(frag);
  }

  function renderTercerosMobileCard(item) {
    const mobileCard = document.createElement('article');
    mobileCard.className = 'bg-white border border-slate-200 rounded-xl shadow-sm p-4';
    mobileCard.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[0.75rem] font-bold text-brand-600 uppercase tracking-wide">Código patrimonial</div>
          <div class="mt-0.5 font-mono text-[0.9375rem] font-extrabold text-slate-900 break-words">
            ${item.cod_patrimonial || '—'}
          </div>
        </div>
        <div class="shrink-0">
          ${getTipoBadgeHTML(item.tipo)}
        </div>
      </div>

      <div class="mt-3">
        <h3 class="text-base font-bold leading-snug text-slate-900">
          ${item.denominacion || 'Sin denominación'}
        </h3>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[0.8125rem]">
        <div>
          <dt class="font-semibold text-slate-400">Sucursal</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div class="col-span-2">
          <dt class="font-semibold text-slate-400">Especificaciones</dt>
          <dd class="mt-0.5 text-slate-700">
            <span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'} &bull; 
            <span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'} &bull; 
            <span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}
            ${item.color ? `&bull; <span class="font-medium text-slate-400">Color:</span> ${item.color}` : ''}
          </dd>
        </div>
        <div class="col-span-2">
          <dt class="font-semibold text-slate-400">Responsable</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.responsable || 'Sin asignar'}</dd>
        </div>
        ${item.caracteristicas_accesorios ? `
        <div class="col-span-2">
          <dt class="font-semibold text-slate-400">Características / Accesorios</dt>
          <dd class="mt-0.5 text-slate-700">${item.caracteristicas_accesorios}</dd>
        </div>` : ''}
        ${item.observaciones ? `
        <div class="col-span-2">
          <dt class="font-semibold text-slate-400">Observaciones</dt>
          <dd class="mt-0.5 text-slate-700">${item.observaciones}</dd>
        </div>` : ''}
        <div>
          <dt class="font-semibold text-slate-400">Fecha Registro</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono">${formatDate(item.created_at)}</dd>
        </div>
      </dl>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  function getTipoBadgeHTML(tipo) {
    const styles = {
      FALTANTE: 'bg-rose-50 text-rose-700 border-rose-200',
      SOBRANTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      TERCERO: 'bg-amber-50 text-amber-700 border-amber-200',
      CONTROL: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    const style = styles[tipo] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border ${style}">${tipo || ''}</span>`;
  }

  // ── Helper Badges & Formateadores ─────────────────────────────────────────
  function getEstadoBadgeHTML(estado) {
    const styles = {
      BUENO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REGULAR: 'bg-blue-50 text-blue-700 border-blue-200',
      MALO: 'bg-amber-50 text-amber-700 border-amber-200',
      'PARA BAJA': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      BAJA: 'bg-rose-50 text-rose-700 border-rose-200',
      FALTANTE: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold',
      SOBRANTE: 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold',
      TERCEROS: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold',
    };
    const style = styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border ${style}">${estado || ''}</span>`;
  }

  function getSoatBadgeHTML(estado, vencimiento, dias) {
    if (!estado || estado === 'NO_REGISTRADO' || estado === 'SIN_SOAT') {
      return '<div class="text-center"><span class="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-bold bg-slate-100 text-slate-500 border border-slate-200">Sin SOAT</span></div>';
    }
    const styles = {
      VIGENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      POR_VENCER: 'bg-amber-50 text-amber-700 border-amber-200',
      VENCIDO: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const style = styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = estado === 'POR_VENCER' ? 'Por Vencer' : estado;
    const diasText = dias !== null ? (dias < 0 ? `(Hace ${Math.abs(dias)} d)` : `(${dias} d restantes)`) : '';
    return `
      <div class="flex flex-col items-center justify-center gap-1 text-center">
        <span class="inline-flex items-center px-2.5 py-1 rounded text-[0.6875rem] font-extrabold border ${style}">
          ${label} ${diasText}
        </span>
        <span class="text-xs text-slate-600 font-semibold font-mono">${vencimiento ? formatDate(vencimiento) : ''}</span>
      </div>
    `;
  }

  function getRevTecBadgeHTML(estado, vencimiento, dias) {
    if (!vencimiento) {
      return '<div class="text-center"><span class="text-xs text-slate-400 italic">No registrado</span></div>';
    }
    const styles = {
      VIGENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      POR_VENCER: 'bg-amber-50 text-amber-700 border-amber-200',
      VENCIDO: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const style = styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = estado === 'POR_VENCER' ? 'Por Vencer' : estado;
    const diasText = dias !== null ? (dias < 0 ? `(Hace ${Math.abs(dias)} d)` : `(${dias} d restantes)`) : '';
    return `
      <div class="flex flex-col items-center justify-center gap-1 text-center">
        <span class="inline-flex items-center px-2.5 py-1 rounded text-[0.6875rem] font-extrabold border ${style}">
          ${label} ${diasText}
        </span>
        <span class="text-xs text-slate-600 font-semibold font-mono">${formatDate(vencimiento)}</span>
      </div>
    `;
  }

  function getSoatPdfUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    let clean = path.replace(/^\.?\/+/, '');
    if (clean.includes('/')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1];
    }
    return `soat_pdfs/${clean}`;
  }

  function getTivePdfUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    let clean = path.replace(/^\.?\/+/, '');
    if (clean.includes('/')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1];
    }
    return `tive_pdfs/${clean}`;
  }

  function getExpedientePdfUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const clean = path.replace(/^\.?\/+/, '');
    if (window.location.protocol.startsWith('http')) {
      let base = window.location.pathname;
      if (!base.endsWith('/')) {
        base = base.substring(0, base.lastIndexOf('/') + 1);
      }
      return `${window.location.origin}${base}${clean}`;
    }
    return `./${clean}`;
  }

  function getCelularVidaUtilBadgeHTML(estado, vencimiento, dias) {
    if (!estado) {
      return '<span class="text-xs text-slate-400">No calculado</span>';
    }
    const styles = {
      VIGENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      POR_RENOVAR: 'bg-amber-50 text-amber-700 border-amber-200',
      VENCIDA: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const style = styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = estado === 'VENCIDA' ? 'Vencido' : (estado === 'POR_RENOVAR' ? 'Por Vencer' : 'Vigente');
    const diasText = dias !== null ? (dias < 0 ? `(Excedido hace ${Math.abs(dias)} d)` : `(${dias} d restantes)`) : '';
    return `
      <div class="flex flex-col gap-1">
        <span class="inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold border ${style}">
          ${label} ${diasText}
        </span>
        <span class="text-[11px] text-slate-500 font-medium font-mono">${vencimiento ? formatDate(vencimiento) : ''}</span>
      </div>
    `;
  }

  function getCelularEstadoBadgeHTML(estado) {
    const style = estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200';
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style}">${estado || 'ACTIVO'}</span>`;
  }

  function formatDate(dateString) {
    if (!dateString) return '—';
    const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function getNetValue(item) {
    return Math.max(
      (Number(item.valor_en_libros) || 0) - (Number(item.depreciacion_acumulada) || 0),
      0
    );
  }

  // Manejo de Estados de UI de carga/error
  function showLoading() {
    statusContainer.classList.remove('hidden');
    statusLoading.classList.remove('hidden');
    statusError.classList.add('hidden');
    document.getElementById('assets-table-container').classList.add('hidden');
    document.getElementById('vehiculos-table-container').classList.add('hidden');
    document.getElementById('celulares-table-container').classList.add('hidden');
    mobileContainer.classList.add('hidden');
  }

  function showError() {
    statusContainer.classList.remove('hidden');
    statusLoading.classList.add('hidden');
    statusError.classList.remove('hidden');
    document.getElementById('assets-table-container').classList.add('hidden');
    document.getElementById('vehiculos-table-container').classList.add('hidden');
    document.getElementById('celulares-table-container').classList.add('hidden');
    mobileContainer.classList.add('hidden');
    resultsCount.textContent = 'Encontrados: 0';
  }

  function hideStatus() {
    statusContainer.classList.add('hidden');
  }

  // Recalcular render en redimensionamiento de pantalla
  window.addEventListener('resize', () => {
    if (currentTab !== 'dashboard' && currentFilteredData.length > 0) {
      renderData(currentFilteredData);
    }
  });

  // ── Funciones de Exportación Adaptativas ───────────────────────────────────
  function exportToExcel() {
    if (currentFilteredData.length === 0) {
      alert("No hay registros filtrados para exportar.");
      return;
    }

    let exportData = [];
    let sheetName = "";
    
    if (currentTab === 'activos') {
      sheetName = "Activos";
      exportData = currentFilteredData.map(item => ({
        "Código Patrimonial": item.cod_patrimonial,
        "Cuenta Contable": item.cuenta_contable || "",
        "Documento": item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : "",
        "Tipo Adquisición": item.documento_tipo,
        "Categoría": item.categoria,
        "Subcategoría": item.subcategoria,
        "Denominación": item.denominacion,
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Sucursal": item.sucursal,
        "Localidad": item.localidad || "",
        "Unidad Orgánica": item.unidad || "",
        "Puesto": item.puesto || item.unidad || "",
        "Responsable": item.responsable || "Sin Asignar",
        "N° Factura": item.numero_factura || "",
        "Fecha Alta": item.fecha_alta_factura || "",
        "Estado": item.estado_activo,
        "Valor en Libros (S/.)": Number(item.valor_en_libros) || 0,
        "Dep. Acumulada (S/.)": Number(item.depreciacion_acumulada) || 0,
        "Valor Neto (S/.)": getNetValue(item),
        "IGV (S/.)": Number(item.igv) || 0,
        "N° Acta Entrega": item.n_acta_entrega || ""
      }));
    } else if (currentTab === 'obras') {
      sheetName = "Obras_En_Curso";
      exportData = currentFilteredData.map(item => ({
        "Código Patrimonial": item.cod_patrimonial,
        "Cuenta Contable": item.cuenta_contable || "",
        "Documento": item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : "",
        "Tipo Adquisición": item.documento_tipo,
        "Categoría": item.categoria,
        "Subcategoría": item.subcategoria,
        "Denominación": item.denominacion,
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Sucursal": item.sucursal,
        "Localidad": item.localidad || "",
        "Unidad Orgánica": item.unidad || "",
        "Puesto": item.puesto || item.unidad || "",
        "Responsable": item.responsable || "Sin Asignar",
        "N° Factura": item.numero_factura || "",
        "Fecha Alta": item.fecha_alta_factura || "",
        "Estado": item.estado_activo,
        "Valor en Libros (S/.)": Number(item.valor_en_libros) || 0,
        "Dep. Acumulada (S/.)": Number(item.depreciacion_acumulada) || 0,
        "Valor Neto (S/.)": getNetValue(item),
        "IGV (S/.)": Number(item.igv) || 0,
        "N° Acta Entrega": item.n_acta_entrega || ""
      }));
    } else if (currentTab === 'vehiculos') {
      sheetName = "Vehículos";
      exportData = currentFilteredData.map(item => ({
        "Placa": item.placa,
        "Código Patrimonial": item.cod_patrimonial,
        "Tipo Vehículo": item.subcategoria || "VEHÍCULO",
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "Año": item.vehiculo_anio || "",
        "Denominación": item.denominacion,
        "Motor": item.nro_motor || "",
        "Chasis": item.nro_chasis || "",
        "Combustible": item.combustible || "",
        "Carrocería": item.carroceria || "",
        "Categoría Vehículo": item.categoria_vehiculo || "",
        "Tarjeta Propiedad": item.nro_tarjeta_prop || "",
        "Estado Físico": item.estado_activo,
        "SOAT Póliza": item.soat_poliza || "",
        "SOAT Aseguradora": item.soat_compania || "",
        "SOAT Vencimiento": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.soat_vencimiento || ""),
        "SOAT Estado": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "NO REQUIERE (BAJA)" : (item.soat_estado || ""),
        "SOAT Días Vigencia": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.soat_dias_vigencia !== undefined ? item.soat_dias_vigencia : ""),
        "Rev. Técnica Vencimiento": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.vencimiento_rev_tec || ""),
        "Rev. Técnica Estado": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "NO REQUIERE (BAJA)" : (item.estado_rev_tec || ""),
        "Rev. Técnica Días Vigencia": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.dias_vigencia_rev_tec !== undefined ? item.dias_vigencia_rev_tec : ""),
        "Sucursal": item.sucursal,
        "Localidad": item.localidad || "",
        "Responsable": item.responsable || "Sin Asignar"
      }));
    } else if (currentTab === 'soat') {
      sheetName = "Monitoreo SOAT y RT";
      exportData = currentFilteredData.map(item => ({
        "Placa": item.placa,
        "Código Patrimonial": item.cod_patrimonial,
        "Tipo Vehículo": item.subcategoria || "VEHÍCULO",
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "Año": item.vehiculo_anio || "",
        "Denominación": item.denominacion,
        "Estado Físico": item.estado_activo,
        "SOAT Póliza": item.soat_poliza || "",
        "SOAT Aseguradora": item.soat_compania || "",
        "SOAT Vencimiento": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.soat_vencimiento || ""),
        "SOAT Estado": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "NO REQUIERE (BAJA)" : (item.soat_estado || ""),
        "SOAT Días Vigencia": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.soat_dias_vigencia !== undefined ? item.soat_dias_vigencia : ""),
        "Rev. Técnica Vencimiento": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.vencimiento_rev_tec || ""),
        "Rev. Técnica Estado": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "NO REQUIERE (BAJA)" : (item.estado_rev_tec || ""),
        "Rev. Técnica Días Vigencia": (item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA') ? "" : (item.dias_vigencia_rev_tec !== undefined ? item.dias_vigencia_rev_tec : ""),
        "Sucursal": item.sucursal,
        "Localidad": item.localidad || "",
        "Responsable": item.responsable || "Sin Asignar"
      }));
    } else if (currentTab === 'celulares') {
      sheetName = "Celulares";
      exportData = currentFilteredData.map(item => ({
        "Código Control": item.cod_control,
        "N° Línea": item.numero_linea || "",
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "IMEI": item.imei || "",
        "Operador": item.operador || "",
        "Sucursal": item.sucursal,
        "Puesto": item.puesto || item.unidad || "",
        "Responsable": item.responsable || "Sin Asignar",
        "Fecha Ingreso": item.fecha_ingreso || "",
        "Fecha Asignación": item.fecha_asignacion || "",
        "Fecha Renovación": item.fecha_renovacion || "",
        "Días para Renovar": item.dias_para_renovar !== undefined ? item.dias_para_renovar : "",
        "Estado Renovación": item.vida_util_estado === 'VENCIDA' ? 'Vencido' : (item.vida_util_estado === 'POR_RENOVAR' ? 'Por Vencer' : (item.vida_util_estado === 'VIGENTE' ? 'Vigente' : '')),
        "Estado Físico": item.estado || "ACTIVO",
        "Observaciones": item.observaciones || ""
      }));
    } else if (currentTab === 'inventario') {
      sheetName = "Inventario_General";
      exportData = currentFilteredData.map(item => ({
        "Código Patrimonial": item.cod_patrimonial,
        "Origen / Situación": item.tipo_origen || "ACTIVO FIJO",
        "Documento": item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'INCORPORACION' ? `INC-${item.n_doc}` : item.n_doc) : "",
        "Cuenta Contable": item.cuenta_contable || "",
        "Centro de Costo": item.centro_costo || "",
        "Fecha Ingreso": item.fecha_alta_factura || item.fecha_registro_contable || item.fecha_ingreso || "",
        "Fecha Alta": item.fecha_asignacion || item.fecha_alta || "",
        "Sucursal": item.sucursal || "",
        "Localidad": item.localidad || "",
        "Financiado / Fuente": getFinanciadoText(item) || item.fuente || "",
        "Categoría": item.categoria || "",
        "Subcategoría": item.subcategoria || "",
        "Denominación": item.denominacion || "",
        "N° Acta": item.n_acta || item.n_acta_entrega || "",
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Especificaciones / Placa": item.placa || item.especificaciones || item.caracteristicas_accesorios || "",
        "Estado": item.estado_activo || "",
        "Valor en Libros / Ref. (S/.)": Number(item.valor_en_libros) || 0,
        "Valor Neto (S/.)": getNetValue(item) || 0,
        "Responsable": item.responsable || "Sin Asignar",
        "Unidad Orgánica": item.puesto || item.unidad || "",
        "Observaciones": item.observaciones || item.observaciones_inventario || ""
      }));
    } else if (currentTab === 'terceros') {
      sheetName = "Regularizacion";
      exportData = currentFilteredData.map(item => ({
        "Sub-Módulo": item.sub_modulo || item.tipo || "",
        "Código Patrimonial": item.cod_patrimonial || "",
        "Sucursal": item.sucursal || "",
        "Localidad": item.localidad || "",
        "Unidad Orgánica": item.puesto || item.unidad || "",
        "Categoría": item.categoria || "",
        "Subcategoría": item.subcategoria || "",
        "Denominación": item.denominacion || "",
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Placa": item.placa || "",
        "Especificaciones": item.caracteristicas_accesorios || "",
        "Estado": item.estado_activo || "",
        "Valor (S/.)": Number(item.valor_en_libros) || 0,
        "Responsable / Propietario": item.responsable || item.propietario_manual || "Sin Asignar",
        "Observaciones": item.observaciones || ""
      }));
    } else if (currentTab === 'contable') {
      sheetName = "Reporte_Contable";
      exportData = currentFilteredData.map(item => ({
        "Código PCGE": item.codigo,
        "Descripción de la Cuenta": item.descripcion,
        "Tipo Elemento": item.tipo,
        "Saldo Total (S/.)": Number(item.monto.toFixed(4))
      }));

      let sumCost = 0;
      let sumDep = 0;
      currentFilteredData.forEach(item => {
        if (item.codigo.startsWith('33') || item.tipo === 'ACTIVO') sumCost += item.monto;
        else if (item.codigo.startsWith('68') || item.tipo === 'DEPRECIACIÓN') sumDep += item.monto;
      });
      const valNeto = sumCost - sumDep;

      exportData.push(
        { "Código PCGE": "", "Descripción de la Cuenta": "TOTAL COSTO HISTÓRICO (CLASE 33)", "Tipo Elemento": "ACTIVO", "Saldo Total (S/.)": Number(sumCost.toFixed(4)) },
        { "Código PCGE": "", "Descripción de la Cuenta": "TOTAL DEPRECIACIÓN ACUMULADA (CLASE 68)", "Tipo Elemento": "DETERIORO", "Saldo Total (S/.)": Number(sumDep.toFixed(4)) },
        { "Código PCGE": "", "Descripción de la Cuenta": "VALOR RESIDUAL NETO CONTABLE", "Tipo Elemento": "NETO", "Saldo Total (S/.)": Number(valNeto.toFixed(4)) }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, `Reporte_${sheetName}_SelvaCentral_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // Helper to load images dynamically for PDF
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
      img.src = url;
    });
  }

  async function exportToPDF() {
    if (currentFilteredData.length === 0) {
      alert("No hay registros filtrados para exportar.");
      return;
    }

    const pdfBtn = document.getElementById('btn-export-pdf');
    let originalText = "";
    if (pdfBtn) {
      originalText = pdfBtn.innerHTML;
      pdfBtn.innerHTML = '⏳ Generando PDF...';
      pdfBtn.disabled = true;
    }

    try {
      // Cargar imágenes en paralelo
      const [logoImg, selloImg] = await Promise.all([
        loadImage('logo_eps2.png').catch(() => null),
        loadImage('Sello Post Firma - CP1.png').catch(() => null)
      ]);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Configurar metadatos del PDF
      doc.setProperties({
        title: `Reporte de ${currentTab.toUpperCase()}`,
        subject: 'Control Patrimonial',
        author: 'EPS Selva Central'
      });

      // Configurar columnas según la pestaña
      let headers = [];
      let data = [];
      let columnStyles = {};

      if (currentTab === 'activos' || currentTab === 'obras') {
        headers = [
          [
            "Cód. Patrimonial",
            "Documento\nCta Contable",
            "Fecha Ingreso",
            "Sucursal\nFinanciado",
            "Denominación del Activo\nCategoría del Activo",
            "Características\nEspecificaciones",
            "Estado",
            "Valor Libros",
            "Valor Neto",
            "Responsable"
          ]
        ];
        data = currentFilteredData.map(item => {
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

          const denomObj = {
            content: `${(item.denominacion || '').toUpperCase()}\n${(item.subcategoria || item.categoria || '—').toUpperCase()}`,
            denom: item.denominacion || '',
            cat: item.subcategoria || item.categoria || '—'
          };

          const respObj = {
            content: `${item.responsable || 'Sin Asignar'}${item.puesto ? `\n${item.puesto}` : ''}`,
            resp: item.responsable || 'Sin Asignar',
            puesto: item.puesto || ''
          };

          return [
            item.cod_patrimonial || '—',
            docObj,
            formatDate(item.fecha_alta_factura || item.fecha_registro_contable),
            ubiObj,
            denomObj,
            especsFormatted,
            item.estado_activo || '—',
            `S/. ${formatMoney(item.valor_en_libros)}`,
            `S/. ${formatMoney(getNetValue(item))}`,
            respObj
          ];
        });
        columnStyles = {
          0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 44 },
          5: { cellWidth: 46 },
          6: { cellWidth: 16, halign: 'center' },
          7: { cellWidth: 24, halign: 'right' },
          8: { cellWidth: 24, halign: 'right' },
          9: { cellWidth: 28 }
        };
      } else if (currentTab === 'vehiculos') {
        headers = [
          [
            "Placa",
            "Cód. Patrimonial",
            "Sucursal\nFinanciado",
            "Denominación",
            "Especificaciones Técnicas",
            "Estado",
            "SOAT",
            "Revisión Técnica",
            "Responsable"
          ]
        ];
        const getUbicacionFinanciado = (item) => {
          const sucursal = (item.sucursal || '—').trim();
          const localidad = item.localidad ? item.localidad.trim() : '';

          const codPat = String(item.cod_patrimonial || '').trim();
          const ctaContable = String(item.cuenta_contable || '').trim();
          const docTipo = (item.documento_tipo || '').toUpperCase().trim();
          const fuenteStr = (
            item.fuente || 
            item.fuente_origen || 
            item.documento_concepto || 
            item.concepto || 
            item.observaciones || 
            item.n_doc || 
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
            financiado = (item.fuente || item.fuente_origen || '').trim();
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

        const sortedVehiculos = [...currentFilteredData].sort((a, b) => 
          (a.denominacion || '').localeCompare(b.denominacion || '', 'es', { sensitivity: 'base' })
        );
        data = sortedVehiculos.map(item => {
          const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
          return [
            item.placa || '—',
            item.cod_patrimonial || '—',
            getUbicacionFinanciado(item),
            `${item.denominacion || ''}${item.vehiculo_anio ? `\nAño: ${item.vehiculo_anio}` : ''}`,
            `Color: ${item.color || '—'}\nMarca: ${item.marca || '—'}\nModelo: ${item.modelo || '—'}\nMotor: ${item.nro_motor || '—'}\nChasis: ${item.nro_chasis || '—'}\nCombustible: ${item.combustible || '—'}`,
            item.estado_activo || '—',
            isBaja ? 'No requiere\n(Baja)' : (item.soat_estado ? `${item.soat_estado}\nVence: ${item.soat_vencimiento ? formatDate(item.soat_vencimiento) : '—'}` : 'No Registrado'),
            isBaja ? 'No requiere\n(Baja)' : (item.vencimiento_rev_tec ? `${item.estado_rev_tec}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado'),
            item.responsable || "Sin Asignar"
          ];
        });
        columnStyles = {
          0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 42 },
          4: { cellWidth: 54 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 24 },
          7: { cellWidth: 24 },
          8: { cellWidth: 27 }
        };
      } else if (currentTab === 'soat') {
        headers = [
          [
            "Placa",
            "Cód. Patrimonial",
            "Sucursal\nFinanciado",
            "Denominación",
            "Especificaciones Técnicas",
            "Estado",
            "SOAT",
            "Revisión Técnica",
            "Responsable"
          ]
        ];

        const getUbicacionFinanciado = (item) => {
          const sucursal = item.sucursal || '—';
          const localidad = item.localidad || '';
          const fuenteStr = String(item.fuente || '').toUpperCase();
          const docTipo = String(item.doc_tipo || item.tipo_documento || '').toUpperCase();
          let financiado = 'Rec. Propios';

          if (fuenteStr.includes('CANON') || fuenteStr.includes('REGALIAS')) {
            financiado = 'Canon / Reg.';
          } else if (fuenteStr.includes('LIQUIDACION') || fuenteStr.includes('OBRA')) {
            financiado = 'Liq. Obra';
          } else if (fuenteStr.includes('DONAC')) {
            financiado = 'Donación';
          } else if (docTipo === 'COMPRA') {
            financiado = '';
          } else if (docTipo === 'INCORPORACION') {
            financiado = (item.fuente || item.fuente_origen || '').trim();
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

        const sortedVehiculos = [...currentFilteredData].sort((a, b) => 
          (a.denominacion || '').localeCompare(b.denominacion || '', 'es', { sensitivity: 'base' })
        );
        data = sortedVehiculos.map(item => {
          const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
          return [
            item.placa || '—',
            item.cod_patrimonial || '—',
            getUbicacionFinanciado(item),
            `${item.denominacion || ''}${item.vehiculo_anio ? `\nAño: ${item.vehiculo_anio}` : ''}`,
            `Color: ${item.color || '—'}\nMarca: ${item.marca || '—'}\nModelo: ${item.modelo || '—'}\nMotor: ${item.nro_motor || item.numero_motor || '—'}\nChasis: ${item.nro_chasis || item.numero_chasis || item.numero_serie || '—'}\nCombustible: ${item.combustible || '—'}`,
            item.estado_activo || 'BUENO',
            isBaja ? 'No requiere\n(Baja)' : (item.soat_vencimiento || item.fecha_vencimiento ? `${item.soat_estado || item.estado_soat || 'VIGENTE'}\nVence: ${formatDate(item.soat_vencimiento || item.fecha_vencimiento)}` : 'No registrado'),
            isBaja ? 'No requiere\n(Baja)' : (item.vencimiento_rev_tec ? `${item.estado_rev_tec || 'VIGENTE'}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado'),
            item.responsable || "Sin Asignar"
          ];
        });
        columnStyles = {
          0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 42 },
          4: { cellWidth: 54 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 24, halign: 'center' },
          7: { cellWidth: 24, halign: 'center' },
          8: { cellWidth: 27 }
        };
      } else if (currentTab === 'celulares') {
        headers = [
          [
            "Cód. Control",
            "Línea / IMEI",
            "Equipo / Marca",
            "Sucursal",
            "Responsable / Puesto",
            "Ingreso",
            "Vigencia Control",
            "Estado"
          ]
        ];
        data = currentFilteredData.map(item => {
          const codControl = item.cod_control || '—';
          const lineaImei = `N°: ${item.numero_linea || '—'}${item.imei ? `\nIMEI: ${item.imei}` : ''}`;
          const equipoMarca = `${item.marca || 'S/M'}${item.modelo ? ` ${item.modelo}` : ''}${item.operador ? ` (${item.operador})` : ''}`;
          const sucursal = `${item.sucursal || '—'}${item.localidad && item.localidad.trim().toUpperCase() !== (item.sucursal || '').trim().toUpperCase() ? ` (${item.localidad.trim()})` : ''}`;
          const respPuesto = `${item.responsable || 'Sin Asignar'}${item.puesto ? `\n${item.puesto}` : ''}`;
          const ingreso = formatDate(item.fecha_ingreso || item.fecha_asignacion);
          let vigenciaControl = '—';
          if (item.dias_para_renovar !== undefined && item.dias_para_renovar !== null) {
            vigenciaControl = `${item.dias_para_renovar}d restantes`;
          } else if (item.fecha_renovacion) {
            vigenciaControl = `Renov: ${formatDate(item.fecha_renovacion)}`;
          }
          const estado = item.estado || 'ACTIVO';

          return [codControl, lineaImei, equipoMarca, sucursal, respPuesto, ingreso, vigenciaControl, estado];
        });

        columnStyles = {
          0: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 32, halign: 'center' },
          2: { cellWidth: 42 },
          3: { cellWidth: 28, halign: 'center' },
          4: { cellWidth: 62 },
          5: { cellWidth: 24, halign: 'center' },
          6: { cellWidth: 32, halign: 'center' },
          7: { cellWidth: 25, halign: 'center' }
        };
      } else if (currentTab === 'inventario') {
        headers = [
          [
            "Cód. Patrimonial",
            "Origen / Doc",
            "Denominación / Subcategoría",
            "Características / Placa",
            "Sucursal",
            "Estado",
            "Valor Libros",
            "Responsable / Unidad Org."
          ]
        ];
        data = currentFilteredData.map(item => {
          const cod = item.cod_patrimonial || '—';
          const doc = item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'INCORPORACION' ? `INC-${item.n_doc}` : item.n_doc) : '—';
          const origenDoc = doc === item.tipo_origen ? `${item.tipo_origen || 'ACTIVO'}` : `${item.tipo_origen || 'ACTIVO'}\n${doc}`;
          const denom = `${item.denominacion || '—'}\n[${item.subcategoria || item.categoria || '—'}]`;
          const especs = `${item.placa ? `Placa: ${item.placa}\n` : ''}Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nCol: ${item.color}` : ''}`;
          const ubi = `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`;
          const estado = item.estado_activo || '—';
          const valLibros = `S/. ${formatMoney(item.valor_en_libros || 0)}`;
          const unidadTxt = item.puesto || item.unidad || '';
          const resp = `${item.responsable || 'Sin Asignar'}${unidadTxt ? `\n(${unidadTxt})` : ''}`;

          return [cod, origenDoc, denom, especs, ubi, estado, valLibros, resp];
        });

        columnStyles = {
          0: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 26, halign: 'center' },
          2: { cellWidth: 50 },
          3: { cellWidth: 48 },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 46 }
        };
      } else if (currentTab === 'terceros') {
        headers = [
          [
            "Código",
            "Sub-Módulo",
            "Sucursal",
            "Denominación / Subcategoría",
            "Características / Placa",
            "Estado",
            "Valor (S/.)",
            "Responsable / Unidad Org."
          ]
        ];
        data = currentFilteredData.map(item => {
          const cod = item.cod_patrimonial || '—';
          const sub = item.sub_modulo || item.tipo || 'CONCILIACION';
          const suc = `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`;
          const denom = `${item.denominacion || '—'}\n[${item.subcategoria || item.categoria || '—'}]`;
          const especs = `${item.placa ? `Placa: ${item.placa}\n` : ''}Marca: ${item.marca || 'S/M'}\nMod: ${item.modelo || '—'}\nSerie: ${item.numero_serie || 'S/S'}`;
          const est = item.estado_activo || '—';
          const val = `S/. ${formatMoney(item.valor_en_libros || 0)}`;
          const unidadTxt = item.puesto || item.unidad || '';
          const resp = `${item.responsable || item.propietario_manual || 'Sin Asignar'}${unidadTxt ? `\n(${unidadTxt})` : ''}`;
          return [cod, sub, suc, denom, especs, est, val, resp];
        });
        columnStyles = {
          0: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 28, halign: 'center' },
          3: { cellWidth: 52 },
          4: { cellWidth: 46 },
          5: { cellWidth: 20, halign: 'center' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 48 }
        };
      } else if (currentTab === 'contable') {
        headers = [
          [
            "Código PCGE",
            "Descripción de la Cuenta Contable",
            "Tipo de Elemento",
            "Saldo Total (S/.)"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.codigo,
          item.descripcion,
          item.tipo,
          `S/. ${formatMoney(item.monto)}`
        ]);
        columnStyles = {
          0: { cellWidth: 40 },
          1: { cellWidth: 120 },
          2: { cellWidth: 60 },
          3: { cellWidth: 50, halign: 'right' }
        };
      }

      let foot = undefined;
      let footStyles = undefined;
      if (currentTab === 'contable') {
        let sumCost = 0;
        let sumDep = 0;
        currentFilteredData.forEach(item => {
          if (item.codigo.startsWith('33') || item.tipo === 'ACTIVO') sumCost += item.monto;
          else if (item.codigo.startsWith('68') || item.tipo === 'DEPRECIACIÓN') sumDep += item.monto;
        });
        const valNeto = sumCost - sumDep;
        foot = [
          [
            { content: 'TOTAL COSTO HISTÓRICO (CLASE 33)', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [29, 78, 216] } },
            { content: 'ACTIVO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [29, 78, 216] } },
            { content: `S/. ${formatMoney(sumCost)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [29, 78, 216] } }
          ],
          [
            { content: 'TOTAL DEPRECIACIÓN ACUMULADA (CLASE 68)', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [255, 241, 242], textColor: [190, 18, 60] } },
            { content: 'DETERIORO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 241, 242], textColor: [190, 18, 60] } },
            { content: `S/. ${formatMoney(sumDep)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [255, 241, 242], textColor: [190, 18, 60] } }
          ],
          [
            { content: 'VALOR RESIDUAL NETO CONTABLE', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87] } },
            { content: 'NETO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87] } },
            { content: `S/. ${formatMoney(valNeto)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87] } }
          ]
        ];
        footStyles = {
          fontSize: 8,
          cellPadding: 3
        };
      }

      // Renderizar la tabla principal
      doc.autoTable({
        head: headers,
        body: data,
        foot: foot,
        footStyles: footStyles,
        startY: 30,
        theme: 'grid',
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
        headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: columnStyles,
        margin: { top: 30, bottom: 42 },
        willDrawCell: function (data) {
          if (data.section === 'body' && (currentTab === 'activos' || currentTab === 'obras') && (data.column.index === 1 || data.column.index === 3 || data.column.index === 4 || data.column.index === 9)) {
            data.cell.customRaw = data.cell.raw;
            data.cell.text = [];
          }
        },
        didDrawCell: function (data) {
          if (data.section === 'body' && (currentTab === 'activos' || currentTab === 'obras') && data.cell.customRaw) {
            const cell = data.cell;
            const raw = cell.customRaw;
            const x = cell.x + cell.padding('left');
            const centerX = cell.x + cell.width / 2;
            const availWidth = cell.width - cell.padding('left') - cell.padding('right');
            const lineStep = 3.2;

            if (data.column.index === 1 && raw && raw.doc !== undefined) { // Documento / Cta Contable
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              const docLines = doc.splitTextToSize(raw.doc, availWidth);

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              const ctaLines = doc.splitTextToSize(raw.cta, availWidth);

              const totalCount = docLines.length + ctaLines.length;
              let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(30, 41, 59);
              docLines.forEach(l => {
                doc.text(l, centerX, y, { align: 'center' });
                y += lineStep;
              });

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              doc.setTextColor(0, 176, 240);
              ctaLines.forEach(l => {
                doc.text(l, centerX, y, { align: 'center' });
                y += lineStep;
              });
            } else if (data.column.index === 3 && raw && raw.sucursal !== undefined) { // Ubicación / Financiado
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);
              const sucLines = doc.splitTextToSize(raw.sucursal.toUpperCase(), availWidth);
              const locLines = raw.localidad ? doc.splitTextToSize(`(${raw.localidad.toUpperCase()})`, availWidth) : [];

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              const finLines = raw.financiado ? doc.splitTextToSize(raw.financiado, availWidth) : [];

              const totalCount = sucLines.length + locLines.length + finLines.length;
              let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);
              doc.setTextColor(30, 41, 59);
              sucLines.forEach(l => {
                doc.text(l, centerX, y, { align: 'center' });
                y += lineStep;
              });

              locLines.forEach(l => {
                doc.text(l, centerX, y, { align: 'center' });
                y += lineStep;
              });

              if (finLines.length > 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(71, 85, 105);
                finLines.forEach(l => {
                  doc.text(l, centerX, y, { align: 'center' });
                  y += lineStep;
                });
              }
            } else if (data.column.index === 4 && raw && raw.denom !== undefined) { // Denominación / Categoría
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              const denomLines = doc.splitTextToSize((raw.denom || '').toUpperCase(), availWidth);

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              const catLines = doc.splitTextToSize((raw.cat || '—').toUpperCase(), availWidth);

              const totalCount = denomLines.length + catLines.length;
              let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(30, 41, 59);
              denomLines.forEach(l => {
                doc.text(l, x, y);
                y += lineStep;
              });

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(0, 176, 240);
              catLines.forEach(l => {
                doc.text(l, x, y);
                y += lineStep;
              });
            } else if (data.column.index === 9 && raw && raw.resp !== undefined) { // Responsable / Puesto
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              const respLines = doc.splitTextToSize((raw.resp || 'Sin Asignar').toUpperCase(), availWidth);

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6);
              const puestoLines = raw.puesto ? doc.splitTextToSize(raw.puesto.toUpperCase(), availWidth) : [];

              const totalCount = respLines.length + puestoLines.length;
              let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7);
              doc.setTextColor(30, 41, 59);
              respLines.forEach(l => {
                doc.text(l, x, y);
                y += lineStep;
              });

              if (puestoLines.length > 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6);
                doc.setTextColor(100, 116, 139);
                puestoLines.forEach(l => {
                  doc.text(l, x, y);
                  y += lineStep;
                });
              }
            }
          }
        }
      });

      // Dibujar Encabezado y Pie de página en cada hoja
      const totalPages = doc.internal.getNumberOfPages();
      const today = new Date().toLocaleDateString('es-PE');
      const selectedSucursal = sucursalSelect.value || "Todas las Sucursales";
      
      let subtitle = "";
      if (currentTab === 'activos') subtitle = "Inventario de Activos Fijos";
      else if (currentTab === 'obras') subtitle = "Inventario de Obras en Curso";
      else if (currentTab === 'vehiculos') subtitle = "Inventario de Vehículos";
      else if (currentTab === 'soat') subtitle = "REPORTE DE SOAT & REVISIÓN TÉCNICA VEHICULAR";
      else if (currentTab === 'celulares') subtitle = "CONTROL DE EQUIPOS MÓVILES - CELULARES";
      else if (currentTab === 'inventario') subtitle = `INVENTARIO GENERAL DE ACTIVOS Y BIENES${inventarioSubFilter && inventarioSubFilter !== 'ALL' ? ` — ${inventarioSubFilter}` : ''}`;
      else if (currentTab === 'terceros') subtitle = `REGULARIZACIÓN PATRIMONIAL${regularizacionSubTab && regularizacionSubTab !== 'ALL' ? ` — ${regularizacionSubTab}` : ''}`;
      else if (currentTab === 'contable') {
        const contableLoc = document.getElementById('contable-localidad-select')?.value;
        subtitle = `Reporte Contable Agrupado${contableLoc && contableLoc !== 'Todos' ? ` - Localidad: ${contableLoc}` : ''}`;
      }

      const signatureLineY = 192;
      const leftSigX = 85;
      const rightSigX = 205;
      const stampX = 179;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // --- ENCABEZADO REPETITIVO ---
        // 1. Logo Mascota Institucional (Superior Izquierda, dimensión simétrica 18x21mm)
        if (logoImg) {
          doc.addImage(logoImg, 'JPEG', 14, 5, 18, 21);
        }

        // 2. Datos de Entidad a la derecha del Logo
        const textX = 35;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, 10);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(0, 176, 240);
        doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, 14.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, 18.5);

        // 3. Título Centrado
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("CONTROL PATRIMONIAL", 148.5, 11, { align: 'center' });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 176, 240);
        doc.text(subtitle.toUpperCase(), 148.5, 16.5, { align: 'center' });

        // 4. Fecha de Reporte y Filtro (Superior Derecha)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Fecha de Reporte: ${today}`, 283, 10, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 176, 240);
        doc.text(`Filtro: ${selectedSucursal}`, 283, 15, { align: 'right' });

        // 5. Línea separadora institucional
        doc.setLineWidth(0.4);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 25, 283, 25);

        // --- PIE DE PÁGINA ---
        // 1. Advertencia en esquina inferior izquierda
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(225, 29, 72); // rose-600
        doc.text("Nota: El documento sin firmas carece de valor.", 14, 202);

        // 2. Firma Izquierda: Firma y Sello (Huella Digital)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text("--------------------------------------------------", leftSigX, signatureLineY, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Firma y Sello (Huella Digital)", leftSigX, signatureLineY + 4, { align: 'center' });

        // 3. Firma Derecha / Sello Post Firma CP1 (Imagen del sello sin duplicar texto encima)
        if (selloImg) {
          doc.addImage(selloImg, 'PNG', rightSigX - 26, 172, 52, 25);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text("--------------------------------------------------", rightSigX, signatureLineY, { align: 'center' });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("ING. JUAN E. BOHORQUEZ AGUILAR", rightSigX, signatureLineY + 4, { align: 'center' });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text("Responsable de Control Patrimonial", rightSigX, signatureLineY + 7.5, { align: 'center' });
        }

        // 4. Número de Página (Página X de Y)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 283, signatureLineY + 4, { align: 'right' });
      }

      // Guardar PDF
      const filename = `Reporte_${currentTab.toUpperCase()}_SelvaCentral_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

    } catch (err) {
      console.error(err);
      alert("Error al generar el PDF: " + err.message);
    } finally {
      if (pdfBtn) {
        pdfBtn.innerHTML = originalText;
        pdfBtn.disabled = false;
      }
    }
  }



  // Vincular eventos a botones
  const excelBtn = document.getElementById('btn-export-excel');
  const pdfBtn = document.getElementById('btn-export-pdf');
  if (excelBtn) excelBtn.addEventListener('click', exportToExcel);
  if (pdfBtn) pdfBtn.addEventListener('click', exportToPDF);

  const btnGenerarActaPdf = document.getElementById('btn-generar-acta-pdf');
  if (btnGenerarActaPdf) btnGenerarActaPdf.addEventListener('click', exportAsignacionPDF);

  const searchActaInput = document.getElementById('search-acta');
  if (searchActaInput) {
    searchActaInput.addEventListener('input', () => {
      const listActas = Object.keys(actasMap).sort((a, b) => b.localeCompare(a));
      renderActasList(listActas, searchActaInput.value.trim().toLowerCase());
    });
  }

  function renderContableRows(filteredAssets) {
    const thead = document.querySelector('#contable-table-container thead');
    if (thead) {
      thead.style.setProperty('background-color', '#00B0F0', 'important');
      thead.classList.remove('bg-[#004C96]');
      thead.classList.add('bg-[#00B0F0]');
      thead.querySelectorAll('tr, th').forEach(el => {
        el.style.setProperty('background-color', '#00B0F0', 'important');
        el.style.setProperty('color', '#ffffff', 'important');
      });
    }

    const digitSelect = document.getElementById('contable-digit-select');
    const typeSelect = document.getElementById('contable-type-select');
    const yearSelect = document.getElementById('contable-year-select');
    const monthSelect = document.getElementById('contable-month-select');
    const tbody = document.getElementById('contable-tbody');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const digitMode = Number(digitSelect ? digitSelect.value : 10);
    const selectedType = typeSelect ? typeSelect.value : 'Todos';
    const yearVal = yearSelect ? yearSelect.value : 'Todos';
    const monthVal = monthSelect ? monthSelect.value : 'Todos';
    
    const generic3Digits = {
      '331': 'TERRENOS',
      '332': 'EDIFICACIONES Y OTRAS CONSTRUCCIONES',
      '333': 'MAQUINARIAS Y EQUIPOS DE EXPLOTACIÓN',
      '334': 'VEHÍCULOS MOTORIZADOS / EQUIPOS DE TRANSPORTE',
      '335': 'MUEBLES Y ENSERES',
      '336': 'EQUIPOS INFORMÁTICOS Y COMUNICACIONES',
      '337': 'HERRAMIENTAS Y UNIDADES REVALUADAS',
      '338': 'UNIDADES POR RECIBIR / EQUIPOS EN TRÁNSITO',
      '339': 'OBRAS EN CURSO (PMO)'
    };
    
    const keyDescriptions = {
      '3311111101': 'URBANOS',
      '3311111102': 'SEMI - URBANOS',
      '3311111103': 'RUSTICOS',
      '3311151101': 'TERRENOS COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3321111101': 'COSTO DE ADQUISICION O CONSTRUC EDIFC.',
      '3321111102': 'COSTO DE FINANCIAMIENTO EDIFICACIONES AD.',
      '3321111103': 'EDIFICACIONES - LÍNEA DE CONDUCCIÓN',
      '3321113101': 'OTASS - RENOV. Y REUB. LÍNEA ADUCCIÓN R1 AL R2',
      '3321121101': 'EDIFICACIONES COSTO ALC - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3321123101': 'EDIFICACIONES COSTO - REDES DE AGUAS RESIDUALES',
      '3322111101': 'ALMACENES',
      '3331111101': 'MAQUINARIAS Y EQUIPO DE BOMBEO AGUA POTABLE',
      '3331111102': 'MEDIDORES',
      '3331111103': 'EQUIPOS DE DOSIFICACIÓN Y DESINFECCIÓN',
      '3341111101': 'COSTO VEHICULOS MOTORIZADOS',
      '3341113101': 'VEHÍCULOS MOTORIZADOS - CAMIONES CISTERNAS',
      '3341151101': 'VEHÍCULOS MOTORIZADOS COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3341152101': 'VEHÍCULOS MOTORIZADOS COSTO COMUNES - RECIBIDO EN DONACIÓN',
      '3351111101': 'MUEBLES Y ENSERES - OFICINA Y ALMACENAMIENTO',
      '3351111102': 'MUEBLES Y ENSERES - ALMACENAMIENTO DE LÍQUIDOS Y COMBUSTIBLE',
      '3351151101': 'MUEBLES COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3361151101': 'EQUIPOS INFORMÁTICOS COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3361181101': 'EQUIPOS INFORMÁTICOS Y CÓMPUTO',
      '3362181101': 'EQUIPOS DE COMUNICACIÓN Y TELECOMUNICACIONES',
      '3369111101': 'EQUIPOS DE CONTROL DE CALIDAD E INSTRUMENTOS',
      '3369151102': 'EQUIPOS DE OFICINA ELECTRÓNICOS Y SEGURIDAD',
      '3369151103': 'EQUIPOS PARA TRABAJO DE CAMPO Y MEDICIÓN',
      '3391010101': 'OBRAS EN CURSO - GENERAL',
      '3392111152': 'OBRAS EN CURSO - PROYECTOS VARIOS'
    };

    function getAccountName(code, fullCode, category) {
      if (keyDescriptions[code]) return keyDescriptions[code];
      if (keyDescriptions[fullCode]) {
        if (code.startsWith('68')) return `DEPRECIACIÓN ACUM. (${keyDescriptions[fullCode]})`;
        return keyDescriptions[fullCode];
      }
      
      if (digitMode === 3) {
        if (code.startsWith('33')) return generic3Digits[code] || `PROPIEDAD, PLANTA Y EQUIPO (${code})`;
        if (code.startsWith('68')) {
          const ref33 = '33' + code.charAt(2);
          return `DEPRECIACIÓN ACUM. (${generic3Digits[ref33] || 'PROPIEDAD, PLANTA Y EQUIPO'})`;
        }
      }
      if (code.startsWith('33')) {
        return category ? category.toUpperCase() : 'GENERAL';
      } else if (code.startsWith('68')) {
        return category ? `DEPRECIACIÓN ACUM. (${category.toUpperCase()})` : 'DEPRECIACIÓN ACUMULADA';
      }
      return `CUENTA CONTABLE (${code})`;
    }

    const ledger = {};
    filteredAssets.forEach(item => {
      const cc = item.cuenta_contable || '';
      if (!cc || cc === '0000000000' || cc.startsWith('0')) {
        // Skip dummy/non-existent accounts
        return;
      }
      if (cc.startsWith('339')) {
        // Skip Obras en curso completely from the Reporte Contable
        return;
      }

      const cost = Number(item.valor_en_libros) || 0;
      let dep = Number(item.depreciacion_acumulada) || 0;

      // Si no existe depreciación almacenada o hay filtro de período, calcularla dinámicamente según fecha de registro contable
      if (dep <= 0 && cost > 0) {
        const ccStr = item.cuenta_contable || '';
        if (!ccStr.startsWith('331') && !ccStr.startsWith('339')) {
          const lifeY = Number(item.vida_util_anios) || 0;
          const sStr = item.fecha_registro_contable || item.fecha_alta_factura || item.fecha_alta;
          if (lifeY > 0 && sStr) {
            const { year: sYear, month: sMonth } = parseDateParts(sStr);
            if (sYear && sMonth) {
              const now = new Date();
              const eYear = yearVal !== 'Todos' ? Number(yearVal) : now.getFullYear();
              const eMonth = monthVal !== 'Todos' ? Number(monthVal) : 12;
              const totalM = lifeY * 12;
              const mRate = cost / totalM;
              const elM = (eYear - sYear) * 12 + (eMonth - sMonth) + 1;
              if (elM > 0) {
                dep = elM >= totalM ? cost : Math.min(cost, mRate * elM);
              }
            }
          }
        }
      }

      let costKey = cc;
      let depKey = cc.startsWith('33') ? '68' + cc.slice(2) : '68' + cc;

      if (digitMode === 3) {
        costKey = cc.slice(0, 3);
        depKey = cc.startsWith('33') ? '68' + cc.charAt(2) : '68' + cc.slice(0, 1);
      }

      if (!ledger[costKey]) {
        ledger[costKey] = {
          codigo: costKey,
          descripcion: getAccountName(costKey, cc, item.categoria),
          tipo: 'ACTIVO',
          monto: 0
        };
      }
      ledger[costKey].monto += cost;

      // Terrenos (331) no se deprecian
      if (!cc.startsWith('331')) {
        if (!ledger[depKey]) {
          const baseName = getAccountName(costKey, cc, item.categoria);
          ledger[depKey] = {
            codigo: depKey,
            descripcion: baseName,
            tipo: 'DEPRECIACIÓN',
            monto: 0
          };
        }
        ledger[depKey].monto += dep;
      }
    });

    const ledgerList = Object.values(ledger).sort((a, b) => a.codigo.localeCompare(b.codigo));
    
    // Totales globales antes de filtrar filas de la tabla
    let sumCost = 0;
    let sumDep = 0;
    ledgerList.forEach(item => {
      if (item.codigo.startsWith('33')) sumCost += item.monto;
      else if (item.codigo.startsWith('68')) sumDep += item.monto;
    });

    const valNeto = sumCost - sumDep;

    // Actualizar KPI Cards en cabecera
    const kpiCostoEl = document.getElementById('contable-kpi-costo');
    const kpiDepEl = document.getElementById('contable-kpi-dep');
    const kpiNetoEl = document.getElementById('contable-kpi-neto');
    if (kpiCostoEl) kpiCostoEl.textContent = formatMoney(sumCost);
    if (kpiDepEl) kpiDepEl.textContent = formatMoney(sumDep);
    if (kpiNetoEl) kpiNetoEl.textContent = formatMoney(valNeto);

    // Conectar buscador en tiempo real de cuentas contables
    const contableSearchInput = document.getElementById('contable-search-input');
    const searchQuery = contableSearchInput ? contableSearchInput.value.toLowerCase().trim() : '';
    if (contableSearchInput && !contableSearchInput.dataset.listenerRegistered) {
      contableSearchInput.addEventListener('input', applyFilters);
      contableSearchInput.dataset.listenerRegistered = 'true';
    }

    // Filtrar por Tipo de Elemento y Búsqueda
    const filteredLedgerList = ledgerList.filter(item => {
      if (selectedType !== 'Todos') {
        if (selectedType === 'ACTIVO' && item.tipo !== 'ACTIVO') return false;
        if (selectedType === 'DEPRECIACION' && item.tipo !== 'DEPRECIACIÓN') return false;
      }
      if (searchQuery) {
        const matchCod = (item.codigo || '').toLowerCase().includes(searchQuery);
        const matchDesc = (item.descripcion || '').toLowerCase().includes(searchQuery);
        if (!matchCod && !matchDesc) return false;
      }
      return true;
    });

    currentFilteredData = filteredLedgerList;
    resultsCount.textContent = `Registros: ${filteredLedgerList.length}`;

    const mobileCardsContainer = document.getElementById('contable-mobile-cards');
    if (mobileCardsContainer) mobileCardsContainer.innerHTML = '';

    const tfoot = document.getElementById('contable-tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="bg-blue-50/80 text-blue-900 border-t-2 border-blue-200">
          <td colspan="2" class="px-5 py-2.5 text-xs font-extrabold uppercase text-right tracking-wider">Total Costo Histórico (Clase 33)</td>
          <td class="px-5 py-2.5 text-center">
            <span class="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full border border-blue-200">ACTIVO</span>
          </td>
          <td class="px-5 py-2.5 text-right font-mono font-black text-xs text-blue-900 tabular-nums">S/. ${formatMoney(sumCost)}</td>
        </tr>
        <tr class="bg-rose-50/80 text-rose-900 border-t border-rose-200">
          <td colspan="2" class="px-5 py-2.5 text-xs font-extrabold uppercase text-right tracking-wider">Total Depreciación Acumulada (Clase 68)</td>
          <td class="px-5 py-2.5 text-center">
            <span class="px-2.5 py-0.5 text-[10px] font-extrabold bg-rose-100 text-rose-800 rounded-full border border-rose-200">DETERIORO</span>
          </td>
          <td class="px-5 py-2.5 text-right font-mono font-black text-xs text-rose-900 tabular-nums">S/. ${formatMoney(sumDep)}</td>
        </tr>
        <tr class="bg-emerald-50 text-emerald-950 border-t-2 border-emerald-300">
          <td colspan="2" class="px-5 py-3 text-xs font-black uppercase text-right tracking-wider">Valor Residual Neto Contable</td>
          <td class="px-5 py-3 text-center">
            <span class="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">NETO</span>
          </td>
          <td class="px-5 py-3 text-right font-mono font-black text-sm text-emerald-800 tabular-nums">S/. ${formatMoney(valNeto)}</td>
        </tr>
      `;
    }

    if (filteredLedgerList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="px-5 py-12 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="text-3xl">📋</span>
              <p class="text-sm font-semibold text-slate-600">No se encontraron cuentas contables registradas</p>
              <p class="text-xs text-slate-400">Intente modificar los filtros o el término de búsqueda.</p>
            </div>
          </td>
        </tr>
      `;
      if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = `
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs font-semibold">
            No se encontraron saldos registrados para los filtros seleccionados.
          </div>
        `;
      }
      return;
    }

    filteredLedgerList.forEach(item => {
      // 1. Fila de tabla para escritorio
      const row = document.createElement('tr');
      row.className = 'hover:bg-sky-50/60 even:bg-slate-50/40 text-slate-800 transition-colors border-b border-slate-150 align-middle';

      row.innerHTML = `
        <td class="px-5 py-2.5 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-mono font-black rounded-lg border shadow-2xs ${
            item.codigo.startsWith('33') ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }">${item.codigo}</span>
        </td>
        <td class="px-5 py-2.5 text-xs font-semibold text-slate-800 leading-snug">${item.descripcion}</td>
        <td class="px-5 py-2.5 whitespace-nowrap text-center">
          <span class="px-2.5 py-0.5 text-[10px] font-extrabold border rounded-full shadow-2xs ${
            item.codigo.startsWith('33') ? 'bg-blue-100/70 text-blue-800 border-blue-200' : 'bg-rose-100/70 text-rose-800 border-rose-200'
          }">
            ${item.tipo}
          </span>
        </td>
        <td class="px-5 py-2.5 whitespace-nowrap text-xs font-mono font-black text-slate-900 text-right tabular-nums">S/. ${formatMoney(item.monto)}</td>
      `;
      tbody.appendChild(row);

      // 2. Tarjeta optimizada para celular
      if (mobileCardsContainer) {
        const card = document.createElement('div');
        card.className = 'bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col gap-2 hover:border-slate-300 transition-all';
        card.innerHTML = `
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="text-[0.6875rem] font-extrabold uppercase text-slate-400">Cuenta:</span>
              <span class="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">${item.codigo}</span>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-bold border rounded-full ${
              item.codigo.startsWith('33') ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }">
              ${item.tipo}
            </span>
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-800 leading-snug block">${item.descripcion}</span>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-dashed border-slate-100 mt-0.5">
            <span class="text-[0.6875rem] font-bold text-slate-500 uppercase">Saldo Registrado:</span>
            <span class="font-mono font-black text-xs text-slate-900">S/. ${formatMoney(item.monto)}</span>
          </div>
        `;
        mobileCardsContainer.appendChild(card);
      }
    });

    const totalRow = document.createElement('tr');
    totalRow.className = 'bg-slate-100/80 font-bold text-slate-900 border-t border-slate-300';
    totalRow.innerHTML = `
      <td class="px-5 py-3" colspan="2">TOTAL COSTO (33) vs DEPRECIACIÓN (68)</td>
      <td class="px-5 py-3 text-xs text-slate-500">Neto: ${formatMoney(sumCost - sumDep)}</td>
      <td class="px-5 py-3 text-right font-mono">${formatMoney(sumCost)} / <span class="text-rose-600">${formatMoney(sumDep)}</span></td>
    `;
    tbody.appendChild(totalRow);
  }

  // Helper para codificar el búfer a base64
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async function loadAgencyFont() {
    try {
      const res = await fetch('./AGENCYR.TTF');
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        agencyFontBase64 = arrayBufferToBase64(buffer);
        console.log("Agency FB font loaded successfully!");
      } else {
        console.warn("Could not find AGENCYR.TTF on web server");
      }
    } catch (e) {
      console.warn("Error loading Agency FB font:", e);
    }
  }

  function getNextActaNumber() {
    let maxNum = 0;
    const currentYear = 2026;
    Object.keys(actasMap).forEach(acta => {
      const match = acta.match(/^(\d+)-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);
        if (year === currentYear && !isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${String(nextNum).padStart(3, '0')}-${currentYear}`;
  }

  function initAsignacionEvents() {
    const btnActivos = document.getElementById('acta-subtab-activos');
    const btnObras = document.getElementById('acta-subtab-obras');

    if (btnActivos && !btnActivos.dataset.listenerRegistered) {
      btnActivos.addEventListener('click', () => {
        currentActaSubtab = 'activos';
        btnActivos.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-[#00B0F0] text-white shadow-xs transition-all cursor-pointer';
        if (btnObras) btnObras.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer';
        selectedActaKey = null;
        renderAsignacionTab();
      });
      btnActivos.dataset.listenerRegistered = 'true';
    }

    if (btnObras && !btnObras.dataset.listenerRegistered) {
      btnObras.addEventListener('click', () => {
        currentActaSubtab = 'obras';
        btnObras.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-[#00B0F0] text-white shadow-xs transition-all cursor-pointer';
        if (btnActivos) btnActivos.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer';
        selectedActaKey = null;
        renderAsignacionTab();
      });
      btnObras.dataset.listenerRegistered = 'true';
    }

    const searchActaInput = document.getElementById('search-acta');
    if (searchActaInput && !searchActaInput.dataset.listenerRegistered) {
      searchActaInput.addEventListener('input', () => {
        if (selectedActaKey !== 'NUEVA_ACTA') {
          selectedActaKey = null;
        }
        renderAsignacionTab();
      });
      searchActaInput.dataset.listenerRegistered = 'true';
    }

    const pdfBtn = document.getElementById('btn-generar-acta-pdf');
    if (pdfBtn && !pdfBtn.dataset.listenerRegistered) {
      pdfBtn.addEventListener('click', () => {
        exportAsignacionPDF();
      });
      pdfBtn.dataset.listenerRegistered = 'true';
    }
  }

  function renderAsignacionTab() {
    initAsignacionEvents();

    const listActas = Object.keys(actasMap).filter(actaKey => {
      const data = actasMap[actaKey];
      if (!data || !data.bienes) return false;
      return data.bienes.some(b => 
        currentActaSubtab === 'activos' 
          ? !String(b.cod_patrimonial).startsWith('339')
          : String(b.cod_patrimonial).startsWith('339')
      );
    }).sort((a, b) => {
      const matchA = a.match(/^(\d+)-(\d+)/);
      const matchB = b.match(/^(\d+)-(\d+)/);
      if (matchA && matchB) {
        const numA = parseInt(matchA[1], 10);
        const yearA = parseInt(matchA[2], 10);
        const numB = parseInt(matchB[1], 10);
        const yearB = parseInt(matchB[2], 10);
        
        if (yearA !== yearB) {
          return yearB - yearA;
        }
        return numB - numA;
      }
      return b.localeCompare(a);
    });

    const searchActaInput = document.getElementById('search-acta');
    const query = searchActaInput ? searchActaInput.value.trim().toLowerCase() : '';
    const filteredActas = listActas.filter(acta => acta.toLowerCase().includes(query));

    if (filteredActas.length > 0) {
      if (!selectedActaKey || !filteredActas.includes(selectedActaKey)) {
        selectedActaKey = filteredActas[0];
      }
      selectActa(selectedActaKey);
    } else {
      selectedActaKey = null;
      selectActa(null);
    }

    renderActasList(filteredActas, query);
  }

  function renderActasList(filteredList, query = '') {
    const container = document.getElementById('actas-list');
    if (!container) return;
    container.innerHTML = '';

    if (filteredList.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-xs text-slate-400 text-center py-4';
      emptyDiv.textContent = 'No se encontraron actas';
      container.appendChild(emptyDiv);
      return;
    }

    filteredList.forEach(acta => {
      const data = actasMap[acta];
      if (!data) return;

      const subtabBienes = (data.bienes || []).filter(b => 
        currentActaSubtab === 'activos' 
          ? !String(b.cod_patrimonial).startsWith('339')
          : String(b.cod_patrimonial).startsWith('339')
      );

      if (subtabBienes.length === 0) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left p-2.5 rounded-lg text-xs font-semibold flex flex-col gap-1 transition-all border border-solid ${
        selectedActaKey === acta 
          ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-sm font-extrabold' 
          : 'bg-white border-slate-100 text-slate-650 hover:bg-slate-50 hover:border-slate-200'
      } cursor-pointer mb-2`;
      
      btn.innerHTML = `
        <div class="font-extrabold text-[0.8125rem] truncate">Acta N° ${acta}</div>
        <div class="flex items-center justify-between gap-2 mt-0.5 text-slate-400">
          <span class="truncate font-medium text-[0.6875rem]">${data.responsable}</span>
          <span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">${subtabBienes.length} bienes</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        selectedActaKey = acta;
        renderActasList(filteredList, query);
        selectActa(acta);
      });

      container.appendChild(btn);
    });
  }

  function compareBienesActa(a, b) {
    // 1. Orden de Compra (mayor a menor / DESC)
    const ocA = String(a.n_doc_compra || a.n_doc || '').trim();
    const ocB = String(b.n_doc_compra || b.n_doc || '').trim();
    const numOcA = Number(ocA);
    const numOcB = Number(ocB);
    let compOc = 0;
    if (!isNaN(numOcA) && !isNaN(numOcB) && ocA !== '' && ocB !== '') {
      compOc = numOcB - numOcA;
    } else {
      compOc = ocB.localeCompare(ocA, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (compOc !== 0) return compOc;

    // 2. Código Patrimonial (mayor a menor / DESC)
    const codA = String(a.cod_patrimonial || '').trim();
    const codB = String(b.cod_patrimonial || '').trim();
    const numCodA = Number(codA);
    const numCodB = Number(codB);
    let compCod = 0;
    if (!isNaN(numCodA) && !isNaN(numCodB) && codA !== '' && codB !== '') {
      compCod = numCodB - numCodA;
    } else {
      compCod = codB.localeCompare(codA, undefined, { numeric: true, sensitivity: 'base' });
    }
    return compCod;
  }

  function selectActa(acta) {
    const inputNro = document.getElementById('acta-nro');
    const inputFecha = document.getElementById('acta-fecha');
    const inputSolicitante = document.getElementById('acta-solicitante');
    const displayNro = document.getElementById('acta-display-nro');
    const displayFecha = document.getElementById('acta-display-fecha');
    const displaySolicitante = document.getElementById('acta-display-solicitante');
    const displayUsuario = document.getElementById('acta-usuario-nombre');
    const displayPuesto = document.getElementById('acta-usuario-puesto');
    const displaySucursal = document.getElementById('acta-usuario-sucursal');
    const displayLocalidad = document.getElementById('acta-usuario-localidad');
    const displayTotalBienes = document.getElementById('acta-total-bienes');
    const tbody = document.getElementById('asignacion-tbody');

    tbody.innerHTML = '';

    const data = actasMap[acta];
    if (!data) {
      if (displayUsuario) displayUsuario.textContent = '—';
      if (displayPuesto) displayPuesto.textContent = '—';
      if (displaySucursal) displaySucursal.textContent = '—';
      if (displayLocalidad) { displayLocalidad.textContent = ''; displayLocalidad.classList.add('hidden'); }
      if (displayTotalBienes) displayTotalBienes.textContent = '0 bienes';
      if (displayNro) displayNro.textContent = '—';
      if (displayFecha) displayFecha.textContent = '—';
      if (displaySolicitante) displaySolicitante.textContent = '—';
      if (inputNro) inputNro.value = '';
      if (inputFecha) inputFecha.value = '';
      if (inputSolicitante) inputSolicitante.value = '';
      tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-slate-400">Seleccione un acta para visualizar</td></tr>';
      return;
    }

    const subtabBienes = (data.bienes || []).filter(b => 
      currentActaSubtab === 'activos' 
        ? !String(b.cod_patrimonial).startsWith('339')
        : String(b.cod_patrimonial).startsWith('339')
    );

    // Ordenar primero por Orden de Compra y luego por Código Patrimonial (ambos de mayor a menor)
    subtabBienes.sort(compareBienesActa);

    // Determinar Localidad
    let foundLocalidad = '';
    for (const b of subtabBienes) {
      if (!foundLocalidad && b.localidad && b.localidad.trim() && b.localidad !== '—') {
        foundLocalidad = b.localidad.trim();
        break;
      }
    }
    if (!foundLocalidad && data.localidad && data.localidad !== '—') foundLocalidad = data.localidad;

    if (displayUsuario) displayUsuario.textContent = data.responsable || '—';
    if (displayPuesto) displayPuesto.textContent = data.puesto || '—';
    if (displaySucursal) displaySucursal.textContent = data.sucursal || '—';
    if (displayLocalidad) {
      if (foundLocalidad && foundLocalidad.toUpperCase() !== (data.sucursal || '').toUpperCase()) {
        displayLocalidad.textContent = foundLocalidad;
        displayLocalidad.classList.remove('hidden');
      } else {
        displayLocalidad.textContent = '';
        displayLocalidad.classList.add('hidden');
      }
    }
    if (displayTotalBienes) {
      displayTotalBienes.textContent = `${subtabBienes.length} ${subtabBienes.length === 1 ? 'bien' : 'bienes'}`;
    }
    if (displayNro) displayNro.textContent = data.n_acta || '—';
    if (inputNro) inputNro.value = data.n_acta || '';

    let formattedDate = '—';
    let rawDate = '';
    subtabBienes.forEach(b => {
      const d = b.fecha_asignacion || b.fecha_alta || b.fecha_alta_factura || b.fecha_registro_contable;
      if (d && (!rawDate || d < rawDate)) {
        rawDate = d;
      }
    });
    if (rawDate) {
      formattedDate = formatDate(rawDate);
      if (inputFecha) inputFecha.value = rawDate.split('T')[0];
    } else {
      if (inputFecha) inputFecha.value = '';
    }
    if (displayFecha) displayFecha.textContent = formattedDate;

    let defaultSolicitante = '';
    const foundReq = subtabBienes.find(b => b.requerido_por && b.requerido_por.trim() && b.requerido_por !== '—');
    if (foundReq) {
      defaultSolicitante = foundReq.requerido_por;
    }
    if (displaySolicitante) displaySolicitante.textContent = defaultSolicitante || '—';
    if (inputSolicitante) inputSolicitante.value = defaultSolicitante;

    renderPreviewBienes(subtabBienes);
  }

  function renderPreviewBienes(bienes) {
    const tbody = document.getElementById('asignacion-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    bienes.forEach(b => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';

      const colorVal = b.color || '—';
      const marcaVal = b.marca || 'S/M';
      const modeloVal = b.modelo || 'S/M';
      const serieVal = b.numero_serie || 'S/S';
      const vidaUtilVal = b.vida_util_anios ? `${b.vida_util_anios} AÑOS` : '—';
      const ocVal = b.n_doc ? `OC-${b.n_doc}` : '—';
      const accVal = b.caracteristicas_accesorios || '—';

      row.innerHTML = `
        <td class="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold text-slate-800">${b.cod_patrimonial}</td>
        <td class="px-4 py-3 text-xs font-bold text-slate-800">${b.denominacion}</td>
        <td class="px-4 py-3 text-xs text-slate-500">${colorVal}</td>
        <td class="px-4 py-3 text-xs text-slate-650 font-medium">${marcaVal}</td>
        <td class="px-4 py-3 text-xs text-slate-650 font-medium">${modeloVal}</td>
        <td class="px-4 py-3 text-xs font-mono text-slate-500">${serieVal}</td>
        <td class="px-4 py-3 text-xs text-slate-500">${vidaUtilVal}</td>
        <td class="px-4 py-3 whitespace-nowrap">${getEstadoBadgeHTML(b.estado_activo)}</td>
        <td class="px-4 py-3 text-xs font-mono text-slate-500">${ocVal}</td>
        <td class="px-4 py-3 text-xs font-mono text-slate-500">${b.cuenta_contable || '—'}</td>
        <td class="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title="${accVal}">${accVal}</td>
      `;
      tbody.appendChild(row);
    });
  }

  async function exportAsignacionPDF() {
    let respName = '';
    let bienes = [];
    let puesto = '—';
    let sucursal = '—';
    let localidad = '—';
    let financiado = '—';

    const inputNro = document.getElementById('acta-nro');
    const actaNroVal = inputNro ? inputNro.value.trim() : '015-2026';

    const inputSolicitante = document.getElementById('acta-solicitante');
    const solicitanteVal = (inputSolicitante && inputSolicitante.value.trim()) ? inputSolicitante.value.trim() : '—';

    if (selectedActaKey === 'NUEVA_ACTA') {
      const selectResp = document.getElementById('nueva-acta-responsable');
      const chosenResp = selectResp ? selectResp.value : '';
      if (!chosenResp || !responsablesSinActaMap[chosenResp]) {
        alert("Por favor seleccione un responsable para la nueva acta.");
        return;
      }
      const respData = responsablesSinActaMap[chosenResp];
      respName = respData.nombre;
      puesto = respData.puesto;
      sucursal = respData.sucursal;
      localidad = respData.localidad;
      financiado = respData.financiado;
      bienes = respData.bienes.filter(b => 
        currentActaSubtab === 'activos' 
          ? !String(b.cod_patrimonial).startsWith('339')
          : String(b.cod_patrimonial).startsWith('339')
      );
    } else {
      const data = actasMap[selectedActaKey];
      if (!data || data.bienes.length === 0) {
        alert("Por favor seleccione un acta válida para exportar.");
        return;
      }

      const subtabBienes = (data.bienes || []).filter(b => 
        currentActaSubtab === 'activos' 
          ? !String(b.cod_patrimonial).startsWith('339')
          : String(b.cod_patrimonial).startsWith('339')
      );

      if (subtabBienes.length === 0) {
        alert("No hay bienes disponibles en el tipo seleccionado.");
        return;
      }

      respName = data.responsable;
      bienes = subtabBienes;
      puesto = data.puesto;
      sucursal = data.sucursal;
      localidad = data.localidad;
      financiado = data.financiado;
    }

    // Ordenar primero por Orden de Compra (DESC) y luego por Código Patrimonial (DESC)
    bienes.sort(compareBienesActa);

    // Extraer localidad y financiado si no están presentes
    for (const b of bienes) {
      if ((!localidad || localidad === '—') && b.localidad && b.localidad.trim()) localidad = b.localidad.trim();
      if ((!financiado || financiado === '—')) {
        const f = getFinanciadoText(b);
        if (f) financiado = f;
      }
    }

    const pdfBtn = document.getElementById('btn-generar-acta-pdf');
    let originalText = "";
    if (pdfBtn) {
      originalText = pdfBtn.innerHTML;
      pdfBtn.innerHTML = '⏳ Generando Acta...';
      pdfBtn.disabled = true;
    }

    try {
      // Cargar imágenes en paralelo
      const [logoImg, selloImg] = await Promise.all([
        loadImage('logo_eps2.png').catch(() => null),
        loadImage('Sello Post Firma - CP1.png').catch(() => null)
      ]);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Cargar tipografía si está disponible
      if (agencyFontBase64) {
        doc.addFileToVFS('AgencyFB.ttf', agencyFontBase64);
        doc.addFont('AgencyFB.ttf', 'Agency FB', 'normal');
      }

      const actaFechaVal = document.getElementById('acta-fecha').value || new Date().toISOString().split('T')[0];
      const dateParts = actaFechaVal.split('-');
      const actaFechaFormateada = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : actaFechaVal;

      doc.setProperties({
        title: `Acta de Asignación - ${respName}`,
        subject: 'Acta de Asignación de Bienes',
        author: 'EPS Selva Central'
      });

      // Headers de la Tabla (Nested layout matching template)
      const headers = [
        [
          { content: 'COD.\nPATRIMONIAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: 'DENOMINACIÓN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: 'CARACTERÍSTICAS DEL BIEN', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'ESTADO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: 'ORDEN\nCOMPRA', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: 'CUENTA\nCONTABLE', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: 'ESPECIFICACIONES /\nACCESORIOS', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } }
        ],
        [
          { content: 'COLOR', styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'MARCA', styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'MODELO', styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'NUMERO DE SERIE', styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'VIDA UTIL', styles: { halign: 'center', fontStyle: 'bold' } }
        ]
      ];

      // Body data
      const data = bienes.map(b => [
        b.cod_patrimonial || '—',
        b.denominacion || '—',
        b.color || 'NEGRO',
        b.marca || 'S/M',
        b.modelo || 'S/M',
        b.numero_serie || 'S/S',
        b.vida_util_anios ? `${b.vida_util_anios} AÑOS` : '—',
        b.estado_activo || '—',
        b.n_doc ? `OC-${b.n_doc}` : '—',
        b.cuenta_contable || '—',
        b.caracteristicas_accesorios || '—'
      ]);

      const columnStyles = {
        0: { cellWidth: 23, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 36, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 22, halign: 'center' },
        9: { cellWidth: 22, halign: 'center' },
        10: { cellWidth: 56, halign: 'left' }
      };

      // Renderizar tabla principal
      doc.autoTable({
        head: headers,
        body: data,
        startY: 77, 
        theme: 'grid',
        styles: { fontSize: 6.8, cellPadding: 1.2, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
        columnStyles: columnStyles,
        margin: { top: 77, bottom: 42 } 
      });

      const totalPages = doc.internal.getNumberOfPages();
      const signatureBlockY = 182;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // --- ENCABEZADO REPETITIVO ---
        // 1. Logo Mascota (18x21mm)
        if (logoImg) {
          doc.addImage(logoImg, 'JPEG', 14, 4, 18, 21);
        }

        // 2. Información de Entidad al lado del Logo
        const textX = 35;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, 9);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(0, 176, 240);
        doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, 13.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, 17.5);

        // 3. Título Centrado (Ubicado en el centro, debajo del logo/datos de la izquierda - Y=25, tamaño 16)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`ACTA Nº ${actaNroVal} – ASIGNACIÓN DE BIENES PATRIMONIALES`, 148.5, 25, { align: 'center' });
        
        // Subtítulo (Centrado, Y=32, tamaño 7)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("AUTORIZADO POR LA GERENCIA DE ADMINISTRACIÓN Y FINANZAS, JEFATURA DE PLANIFICACIÓN Y DESARROLLO EMPRESARIAL, JEFATURA DEL DEPARTAMENTO DE LOGÍSTICA Y CONTROL PATRIMONIAL.", 148.5, 32, { align: 'center' });

        // 4. Datos del Responsable y Solicitante
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("SOLICITANTE:", 14, 39);
        doc.text("USUARIO:", 14, 44);
        doc.text("PUESTO:", 14, 49);
        doc.text("SUCURSAL:", 14, 54);

        doc.setFont("helvetica", "normal");
        doc.text(solicitanteVal.toUpperCase(), 38, 39);
        doc.text(respName.toUpperCase(), 38, 44);
        doc.text(puesto.toUpperCase(), 38, 49);
        const sucursalPrefix = sucursal.toUpperCase().startsWith("UO ") ? sucursal.toUpperCase() : `UO ${sucursal.toUpperCase()}`;
        doc.text(sucursalPrefix, 38, 54);

        // LOCALIDAD al costado de SUCURSAL
        let currentX = 38 + doc.getTextWidth(sucursalPrefix) + 6;
        if (localidad && localidad !== '—' && localidad.toUpperCase() !== sucursal.toUpperCase()) {
          doc.setFont("helvetica", "bold");
          doc.text("LOCALIDAD:", currentX, 54);
          currentX += doc.getTextWidth("LOCALIDAD:") + 2;
          doc.setFont("helvetica", "normal");
          doc.text(localidad.toUpperCase(), currentX, 54);
        }

        // FECHA DE ALTA (Alineada a la derecha)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const dateWidth = doc.getTextWidth(actaFechaFormateada);
        doc.text(actaFechaFormateada, 283, 39, { align: 'right' });
        
        doc.setFont("helvetica", "bold");
        doc.text("FECHA DE ALTA:", 283 - dateWidth - 2, 39, { align: 'right' });

        // TOTAL BIENES (Alineado a la derecha debajo de fecha de alta)
        const totalText = `${bienes.length} ${bienes.length === 1 ? 'BIEN' : 'BIENES'}`;
        const totalTextWidth = doc.getTextWidth(totalText);
        doc.setFont("helvetica", "normal");
        doc.text(totalText, 283, 44, { align: 'right' });
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL REGISTRADOS:", 283 - totalTextWidth - 2, 44, { align: 'right' });

        // 5. Nota legal de responsabilidad (Ubicada arriba, bajo los datos del responsable - Usando helvetica por legibilidad)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text("NOTA", 14, 61);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        const notaText = "EL TRABAJADOR ES RESPONSABLE DIRECTO Y ABSOLUTO DE LA EXISTENCIA, PERMANENCIA, CONSERVACIÓN DEL BIEN EN USO, EVITAR PERDIDA, SUSTRACCIÓN, DETERIODO ETC. EN CASO DE PÉRDIDA, EXTRAVIO O DETERIORO POR EL MAL USO DE LOS BIENES PATRIMONIALES DESCRITOS, ESTOS SERÁN REPUESTOS O REPARADOS POR EL TRABAJADOR RESPONSABLE DE LOS MISMOS. CUALQUIER MOVIMIENTOS DENTRO O FUERA DE LA ENTIDAD DEBERA SER COMUNICADO AL RESPONSABLE DE CONTROL PATRIMONIAL, BAJO RESPONSABILIDAD.";
        
        const splitNota = doc.splitTextToSize(notaText, 269);
        doc.text(splitNota, 14, 64);

        // Resetear a helvetica para el resto de elementos
        doc.setFont("helvetica", "normal");

        // 6. Líneas y bloque de firmas
        const yLine = signatureBlockY + 11;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.25);
        
        doc.line(20, yLine, 80, yLine);     
        doc.line(100, yLine, 160, yLine);   
        doc.line(185, yLine, 220, yLine);   
        doc.line(240, yLine, 275, yLine);   

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        
        // Usuario
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("USUARIO RESPONSABLE", 50, yLine + 4, { align: 'center' });

        // Control Patrimonial
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("CONTROL PATRIMONIAL", 130, yLine + 4, { align: 'center' });

        // GAF
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Vº Bº GAF", 202.5, yLine + 4, { align: 'center' });

        // Logística
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Vº Bº LOGÍSTICA", 257.5, yLine + 4, { align: 'center' });

        // Sello Post Firma CP1 (Ubicado a la altura de Control Patrimonial)
        if (selloImg) {
          doc.addImage(selloImg, 'PNG', 103, yLine - 25, 54, 25);
        }

        // 7. Número de Página (Ubicado en la parte superior derecha en gris oscuro)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${totalPages}`, 283, 9, { align: 'right' });
      }

      // Guardar PDF
      const sanitizeName = respName.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Acta_Asignacion_${sanitizeName}_${actaNroVal.replace(/\//g, "-")}.pdf`;
      doc.save(filename);

    } catch (err) {
      console.error(err);
      alert("Error al generar el PDF de asignación: " + err.message);
    } finally {
      if (pdfBtn) {
        pdfBtn.innerHTML = originalText;
        pdfBtn.disabled = false;
      }
    }
  }

  let selectedFichaActivo = null;

  function renderFichaTab() {
    const searchCodInput = document.getElementById('ficha-search-cod');
    const visualContent = document.getElementById('ficha-visual-content');
    const emptyState = document.getElementById('ficha-empty-state');
    const exportBtn = document.getElementById('btn-generar-ficha-pdf');

    if (!searchCodInput || !visualContent || !emptyState || !exportBtn) return;

    const formatDateStr = (dateVal) => {
      if (!dateVal) return '—';
      const parts = dateVal.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateVal;
    };

    const getHistorialDepreciacion = (act, year) => {
      const cost = Number(act.valor_en_libros) || 0;
      const lifeYears = Number(act.vida_util_anios) || 0;
      const startStr = act.fecha_alta_factura || act.fecha_alta || act.fecha_registro_contable;
      
      const monthlyValues = Array(13).fill("0.00");
      
      if (cost > 0 && lifeYears > 0 && startStr) {
        const startDate = new Date(startStr);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1;
        
        const totalMonthsOfLife = lifeYears * 12;
        const monthlyDepRate = cost / totalMonthsOfLife;
        
        const currentRealDate = new Date();
        const currentRealYear = currentRealDate.getFullYear();
        const currentRealMonth = currentRealDate.getMonth() + 1;
        
        let lastVal = 0;
        for (let m = 1; m <= 12; m++) {
          if (year > currentRealYear || (year === currentRealYear && m > currentRealMonth)) {
            monthlyValues[m - 1] = "—";
            continue;
          }
          
          const elapsedMonths = (year - startYear) * 12 + (m - startMonth);
          if (elapsedMonths < 0) {
            monthlyValues[m - 1] = "0.00";
          } else if (elapsedMonths >= totalMonthsOfLife) {
            const val = cost;
            monthlyValues[m - 1] = val.toFixed(2);
            lastVal = val;
          } else {
            const val = monthlyDepRate * elapsedMonths;
            monthlyValues[m - 1] = val.toFixed(2);
            lastVal = val;
          }
        }
        monthlyValues[12] = lastVal.toFixed(2);
      }
      return monthlyValues;
    };

    const handleFichaSearch = () => {
      const cod = searchCodInput.value.trim();
      if (!cod) {
        visualContent.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = '<span class="text-3xl">📄</span><p class="text-sm font-semibold mt-2">Ingrese un código patrimonial para consultar la ficha.</p>';
        selectedFichaActivo = null;
        return;
      }

      const activo = assets.find(a => String(a.cod_patrimonial) === cod);
      if (!activo) {
        visualContent.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = '<span class="text-3xl">⚠️</span><p class="text-sm font-semibold mt-2 text-rose-500">Código patrimonial no encontrado.</p>';
        selectedFichaActivo = null;
        return;
      }

      selectedFichaActivo = activo;

      document.getElementById('ficha-val-localidad').textContent = activo.localidad || 'LA MERCED';
      document.getElementById('ficha-val-cod-patrimonial').textContent = activo.cod_patrimonial;
      document.getElementById('ficha-val-denominacion').textContent = activo.denominacion || '—';
      
      const now = new Date();
      document.getElementById('ficha-val-fecha').textContent = `Fecha: ${now.toLocaleDateString('es-PE')}`;
      document.getElementById('ficha-val-hora').textContent = `Hora: ${now.toLocaleTimeString('es-PE')}`;

      document.getElementById('ficha-val-fec-ingreso').textContent = formatDateStr(activo.fecha_alta_factura || activo.fecha_registro_contable);
      document.getElementById('ficha-val-fec-alta').textContent = formatDateStr(activo.fecha_alta_factura);
      document.getElementById('ficha-val-fec-entrega').textContent = formatDateStr(activo.fecha_asignacion);
      document.getElementById('ficha-val-estado').textContent = activo.estado_activo || '—';
      document.getElementById('ficha-val-vida-util').textContent = activo.vida_util_anios ? `${activo.vida_util_anios} Años` : '—';
      
      const valLibros = activo.valor_en_libros ? `S/. ${Number(activo.valor_en_libros).toFixed(2)}` : '—';
      document.getElementById('ficha-val-historico').textContent = valLibros;
      document.getElementById('ficha-val-libros').textContent = valLibros;
      document.getElementById('ficha-val-n-doc').textContent = activo.n_doc || '—';
      
      document.getElementById('ficha-val-neto').textContent = activo.valor_neto ? `S/. ${Number(activo.valor_neto).toFixed(2)}` : '—';
      const depAcum = (Number(activo.valor_en_libros || 0) - Number(activo.valor_neto || 0)).toFixed(2);
      document.getElementById('ficha-val-depreciacion').textContent = `S/. ${depAcum}`;

      document.getElementById('ficha-val-marca').textContent = activo.marca || '—';
      document.getElementById('ficha-val-modelo').textContent = activo.modelo || '—';
      document.getElementById('ficha-val-serie').textContent = activo.numero_serie || '—';
      document.getElementById('ficha-val-especificaciones').textContent = activo.caracteristicas_accesorios || '—';
      
      document.getElementById('ficha-val-localizacion').textContent = activo.sucursal || '—';
      document.getElementById('ficha-val-responsable').textContent = activo.responsable || '—';
      document.getElementById('ficha-val-cuenta').textContent = activo.cuenta_contable || '—';
      document.getElementById('ficha-val-c-costo').textContent = activo.centro_costo || '—';
      document.getElementById('ficha-val-mod-adq').textContent = activo.documento_tipo || '—';

      const detParts = [];
      if (activo.n_doc_compra) detParts.push(`O/C: ${activo.n_doc_compra}`);
      if (activo.nota_pedido) detParts.push(`NOTA DE PEDIDO: ${activo.nota_pedido}`);
      if (activo.certificacion_presupuestal) detParts.push(`CERTIFICACIÓN PRESUPUESTAL: ${activo.certificacion_presupuestal}`);
      if (activo.numero_factura) detParts.push(`FACTURA: ${activo.numero_factura}`);
      detParts.push(activo.denominacion);
      document.getElementById('ficha-val-detalle-activo').textContent = detParts.join(" / ");

      // Historial de depreciación acumulada para el año actual
      const monthlyValues = getHistorialDepreciacion(activo, 2026);
      const cells = document.querySelectorAll('#ficha-container table tbody tr td');
      if (cells.length === 13) {
        monthlyValues.forEach((val, idx) => {
          if (val === '—') {
            cells[idx].textContent = '—';
          } else if (val === '0.00') {
            cells[idx].textContent = '0.00';
          } else {
            cells[idx].textContent = `S/. ${val}`;
          }
        });
      }

      const imgContainer = document.getElementById('ficha-images-container');
      const imgWrapper = document.getElementById('ficha-images-wrapper');
      imgContainer.innerHTML = '';
      const imgPaths = [activo.imagen_1_path, activo.imagen_2_path, activo.imagen_3_path, activo.imagen_4_path].filter(Boolean);
      if (imgPaths.length > 0) {
        imgPaths.forEach((path, idx) => {
          const div = document.createElement('div');
          div.className = 'border border-slate-200 rounded-xl overflow-hidden aspect-[4/3] bg-slate-100 flex items-center justify-center';
          const img = document.createElement('img');
          img.src = `.${path}`;
          img.className = 'w-full h-full object-cover';
          img.alt = `Imagen ${idx + 1}`;
          div.appendChild(img);
          imgContainer.appendChild(div);
        });
        imgWrapper.classList.remove('hidden');
      } else {
        imgWrapper.classList.add('hidden');
      }

      emptyState.classList.add('hidden');
      visualContent.classList.remove('hidden');
    };

    if (!searchCodInput.dataset.listenerRegistered) {
      searchCodInput.addEventListener('input', handleFichaSearch);
      searchCodInput.dataset.listenerRegistered = 'true';
    }

    if (!exportBtn.dataset.listenerRegistered) {
      exportBtn.addEventListener('click', async () => {
        if (!selectedFichaActivo) {
          alert("Por favor busque un activo válido primero.");
          return;
        }
        
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '⏳ Exportando Ficha...';
        exportBtn.disabled = true;

        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
          
          const marginX = 14;
          let posY = 15;
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text("EPS SELVA CENTRAL S.A.", marginX, posY);
          posY += 4;
          doc.text(selectedFichaActivo.localidad || "LA MERCED", marginX, posY);
          posY += 4;
          doc.text("Versión: 2026.1.1-Juan Eder Systems", marginX, posY);
          
          const now = new Date();
          const dateStr = now.toLocaleDateString('es-PE');
          const timeStr = now.toLocaleTimeString('es-PE');
          doc.text(`Fecha: ${dateStr}`, 196, 15, { align: 'right' });
          doc.text(`Hora: ${timeStr}`, 196, 19, { align: 'right' });
          
          posY += 10;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("FICHA DE REGISTRO DEL BIEN", 105, posY, { align: 'center' });
          
          posY += 3;
          doc.setDrawColor(200, 200, 200);
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(`${selectedFichaActivo.cod_patrimonial}   ${selectedFichaActivo.denominacion}`, marginX, posY);
          
          posY += 2;
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          
          // Fila 1
          doc.setFont("helvetica", "bold"); doc.text("Fec Ingreso:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(formatDateStr(selectedFichaActivo.fecha_alta_factura || selectedFichaActivo.fecha_registro_contable) || '—', marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Histórico:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(selectedFichaActivo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Tipo ing:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text("CO - Compra", 155 + 20, posY);
          
          // Fila 2
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Fec Alta:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(formatDateStr(selectedFichaActivo.fecha_alta_factura) || '—', marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Libros:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(selectedFichaActivo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Docum:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text("OC - Orden de Compra", 155 + 20, posY);
          
          // Fila 3
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Fec Entrega:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(formatDateStr(selectedFichaActivo.fecha_asignacion) || '—', marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Tasación:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("O/C:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.n_doc || '—', 155 + 20, posY);
          
          // Fila 4
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Estado:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.estado_activo || '—', marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Neto:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(selectedFichaActivo.valor_neto || 0).toFixed(2)}`, 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Seguro:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text("Si", 155 + 20, posY);
          
          // Fila 5
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Proyecto:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text("—", marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Depreciación:", 105, posY);
          const depAcumVal = (Number(selectedFichaActivo.valor_en_libros || 0) - Number(selectedFichaActivo.valor_neto || 0)).toFixed(2);
          doc.setFont("helvetica", "normal"); doc.text(`S/. ${depAcumVal}`, 105 + 22, posY);
          
          // Fila 6
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Principal:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text("Si", marginX + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Revaluado:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Vida util:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text(`${selectedFichaActivo.vida_util_anios} Años`, 155 + 20, posY);
          
          // Fila 7
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Dep Inic:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Factor:", 155, posY);
          doc.setFont("helvetica", "normal"); doc.text("—", 155 + 20, posY);

          // Segmento Independiente: Detalle Físico
          posY += 8;
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "bold");
          doc.text("Detalle Físico del Activo / Especificaciones:", marginX, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Marca:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.marca || '—', marginX + 15, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Modelo:", 70, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.modelo || '—', 70 + 15, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Serie:", 135, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.numero_serie || '—', 135 + 15, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Especificaciones:", marginX, posY);
          const specText = selectedFichaActivo.caracteristicas_accesorios || '—';
          const splitSpecs = doc.splitTextToSize(specText, 150);
          doc.setFont("helvetica", "normal");
          doc.text(splitSpecs, marginX + 30, posY);
          
          posY += (splitSpecs.length * 4);
          
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "bold"); doc.text("Localización:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.sucursal || '—', marginX + 22, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Responsable:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.responsable || '—', marginX + 22, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Cuenta:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.cuenta_contable || '—', marginX + 22, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("C.Costo:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.centro_costo || '—', marginX + 22, posY);
          
          posY += 3;
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "bold"); doc.text("Cod. Regulatorio:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text("—", marginX + 32, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Cla. SUNASS:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text("clasificacion", 105 + 25, posY);
          
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Tipo Serv. SUNASS:", marginX, posY);
          doc.setFont("helvetica", "normal"); doc.text("servicios", marginX + 32, posY);
          
          doc.setFont("helvetica", "bold"); doc.text("Mod. Adquisicion:", 105, posY);
          doc.setFont("helvetica", "normal"); doc.text(selectedFichaActivo.documento_tipo || '—', 105 + 25, posY);
          
          posY += 3;
          doc.line(marginX, posY, 196, posY);
          
          posY += 6;
          doc.setFont("helvetica", "bold");
          doc.text("Historial de Depreciación:", marginX, posY);
          
          const depHeaders = [["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre", "Total"]];
          const depData = [getHistorialDepreciacion(selectedFichaActivo, 2026)];
          
          doc.autoTable({
            startY: posY + 2,
            head: depHeaders,
            body: depData,
            theme: 'plain',
            styles: { fontSize: 7.5, halign: 'center' },
            headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
            margin: { left: marginX, right: marginX }
          });
          
          posY = doc.lastAutoTable.finalY + 6;
          
          doc.line(marginX, posY, 196, posY);
          posY += 5;
          doc.setFont("helvetica", "bold"); doc.text("Detalle Activo:", marginX, posY);
          
          const detParts = [];
          if (selectedFichaActivo.n_doc_compra) detParts.push(`O/C: ${selectedFichaActivo.n_doc_compra}`);
          if (selectedFichaActivo.nota_pedido) detParts.push(`NOTA DE PEDIDO: ${selectedFichaActivo.nota_pedido}`);
          if (selectedFichaActivo.certificacion_presupuestal) detParts.push(`CERTIFICACIÓN PRESUPUESTAL: ${selectedFichaActivo.certificacion_presupuestal}`);
          if (selectedFichaActivo.numero_factura) detParts.push(`FACTURA: ${selectedFichaActivo.numero_factura}`);
          detParts.push(selectedFichaActivo.denominacion);
          
          posY += 4;
          doc.setFont("helvetica", "normal");
          doc.text(detParts.join(" / "), marginX, posY, { maxWidth: 180 });
          
          const imagesToDraw = [];
          if (selectedFichaActivo.imagen_1_path) imagesToDraw.push(selectedFichaActivo.imagen_1_path);
          if (selectedFichaActivo.imagen_2_path) imagesToDraw.push(selectedFichaActivo.imagen_2_path);
          if (selectedFichaActivo.imagen_3_path) imagesToDraw.push(selectedFichaActivo.imagen_3_path);
          if (selectedFichaActivo.imagen_4_path) imagesToDraw.push(selectedFichaActivo.imagen_4_path);
          
          if (imagesToDraw.length > 0) {
            const contentWidth = 182; // 196 - 14
            const numImgs = imagesToDraw.length;
            let cols = 1;
            let imgWidth = 110;
            let imgHeight = 68;
            let gapX = 8;
            let gapY = 6;
            let neededHeight = 75;

            if (numImgs === 1) {
              cols = 1;
              imgWidth = 130;
              imgHeight = 95;
              neededHeight = 115;
            } else if (numImgs === 2) {
              cols = 2;
              gapX = 8;
              imgWidth = (contentWidth - gapX) / 2; // 87mm
              imgHeight = 82;
              neededHeight = 105;
            } else if (numImgs === 3) {
              cols = 2;
              gapX = 8;
              gapY = 6;
              imgWidth = (contentWidth - gapX) / 2; // 87mm
              imgHeight = 82;
              neededHeight = 82 * 2 + gapY + 15;
            } else { // 4 imágenes: cuadrícula 2x2
              cols = 2;
              gapX = 8;
              gapY = 6;
              imgWidth = (contentWidth - gapX) / 2; // 87mm
              imgHeight = 82; // Alargado de 52mm a 82mm para conservar nitidez y legibilidad del texto
              neededHeight = 82 * 2 + gapY + 15;
            }

            if (posY + neededHeight > 284) {
              doc.addPage();
              posY = 18;
            } else {
              posY += 10;
              doc.line(marginX, posY, 196, posY);
              posY += 6;
            }
            doc.setFont("helvetica", "bold");
            doc.text("Imágenes del Activo:", marginX, posY);
            posY += 4;
            
            for (let i = 0; i < imagesToDraw.length; i++) {
              const base64Data = await loadImgAsBase64(imagesToDraw[i]);
              if (base64Data) {
                let posX = marginX;
                let currentY = posY;
                if (numImgs === 1) {
                  posX = marginX + (contentWidth - imgWidth) / 2;
                  currentY = posY;
                } else if (numImgs === 3 && i === 2) {
                  posX = marginX + (contentWidth - imgWidth) / 2;
                  currentY = posY + (imgHeight + gapY);
                } else if (cols === 2) {
                  const col = i % 2;
                  const row = Math.floor(i / 2);
                  posX = marginX + col * (imgWidth + gapX);
                  currentY = posY + row * (imgHeight + gapY);
                }
                doc.addImage(base64Data, 'JPEG', posX, currentY, imgWidth, imgHeight);
              }
            }
          }
          
          doc.save(`Ficha_Activo_${selectedFichaActivo.cod_patrimonial}.pdf`);
        } catch (err) {
          console.error(err);
          alert("Error al exportar ficha: " + err.message);
        } finally {
          exportBtn.innerHTML = originalText;
          exportBtn.disabled = false;
        }
      });
      exportBtn.dataset.listenerRegistered = 'true';
    }
  }
});
