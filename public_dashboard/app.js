document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let celulares = [];
  let inventario = [];
  let terceros = [];
  let salidas = [];
  let currentTab = 'activos'; // activos | vehiculos | celulares | inventario | terceros | soat | asignacion | salidas
  let currentFilteredData = [];
  let responsablesMap = {};
  let selectedResponsableKey = null;

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
      const ts = Date.now();
      const fetchOpts = { cache: 'no-store' };
      const [assetsResponse, celularesResponse, inventarioResponse, tercerosResponse, salidasResponse] = await Promise.all([
        fetch(`./activos.json?t=${ts}`, fetchOpts),
        fetch(`./celulares.json?t=${ts}`, fetchOpts).catch(() => null),
        fetch(`./inventario_fisico.json?t=${ts}`, fetchOpts).catch(() => null),
        fetch(`./bienes_terceros.json?t=${ts}`, fetchOpts).catch(() => null),
        fetch(`./salidas.json?t=${ts}`, fetchOpts).catch(() => null)
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

      // Ordenar estrictamente las salidas de mayor a menor (más reciente a más antigua)
      salidas = sortSalidasDesc(salidas);

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

      // Poblar años en reporte contable
      const contableYearSelect = document.getElementById('contable-year-select');
      if (contableYearSelect) {
        contableYearSelect.innerHTML = '<option value="Todos">Todos</option>';
        const yearsSet = new Set();
        assets.forEach(item => {
          const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
          if (dateStr) {
            const parts = String(dateStr).split('-');
            const y = parts[0] ? Number(parts[0]) : new Date(dateStr).getFullYear();
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

      // Poblar años en filtro global
      const globalYearSelect = document.getElementById('filter-global-year');
      if (globalYearSelect) {
        globalYearSelect.innerHTML = '<option value="">Todos</option>';
        const yearsSet = new Set();
        assets.forEach(item => {
          const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
          if (dateStr) {
            const y = new Date(dateStr).getFullYear();
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
      applyFilters();
      
      // Adjuntar event listeners
      searchInput.addEventListener('input', applyFilters);
      sucursalSelect.addEventListener('change', applyFilters);
      if (localidadSelect) {
        localidadSelect.addEventListener('change', applyFilters);
      }
      estadoSelect.addEventListener('change', applyFilters);
      const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
      if (filterSoatEstadoSelect) {
        filterSoatEstadoSelect.addEventListener('change', applyFilters);
      }


      // Event listeners para los dropdowns de categorías y subcategorías
      if (btnSelectCategoria && dropdownCategoria) {
        btnSelectCategoria.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownCategoria.classList.toggle('hidden');
          dropdownSubcategoria.classList.add('hidden'); // Cerrar el otro
          
          // Pivotear flechas
          if (dropdownCategoria.classList.contains('hidden')) {
            iconCategoria.style.transform = 'rotate(0deg)';
          } else {
            iconCategoria.style.transform = 'rotate(180deg)';
          }
          iconSubcategoria.style.transform = 'rotate(0deg)';
        });
      }

      if (btnSelectSubcategoria && dropdownSubcategoria) {
        btnSelectSubcategoria.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownSubcategoria.classList.toggle('hidden');
          dropdownCategoria.classList.add('hidden'); // Cerrar el otro
          if (dropdownMonth) dropdownMonth.classList.add('hidden');
          
          // Pivotear flechas
          if (dropdownSubcategoria.classList.contains('hidden')) {
            iconSubcategoria.style.transform = 'rotate(0deg)';
          } else {
            iconSubcategoria.style.transform = 'rotate(180deg)';
          }
          iconCategoria.style.transform = 'rotate(0deg)';
          if (iconMonth) iconMonth.style.transform = 'rotate(0deg)';
        });
      }

      if (btnSelectMonth && dropdownMonth) {
        btnSelectMonth.addEventListener('click', (e) => {
          e.stopPropagation();
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
        btnClearFilters.addEventListener('click', () => {
          searchInput.value = '';
          if (sucursalSelect) sucursalSelect.value = '';
          if (localidadSelect) localidadSelect.value = '';
          if (estadoSelect) estadoSelect.value = '';
          const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
          if (filterSoatEstadoSelect) filterSoatEstadoSelect.value = '';
          if (globalYearSelect) globalYearSelect.value = '';
          if (globalMonthSelect) globalMonthSelect.value = '';
          if (globalValorSelect) globalValorSelect.value = '';

          
          // Limpiar filtros de multiselección
          selectedCategories = [];
          selectedSubcategories = [];
          selectedMonths = [];
          populateCategoryFilters();
          populateMonthFilters();
          
          applyFilters();
        });
      }

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

  // Filtrar vehículos del listado consolidado de activos
  function getVehicles() {
    return assets.filter(item => 
      (item.placa && item.placa !== '') || 
      (item.cod_categoria && String(item.cod_categoria).startsWith('4'))
    );
  }

  // Rellenar dinámicamente las categorías basadas en el módulo seleccionado
  function populateCategoryFilters() {
    if (!optionsContainerCategoria) return;
    optionsContainerCategoria.innerHTML = '';
    
    let dataset = [];
    if (currentTab === 'activos') {
      dataset = assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'obras') {
      dataset = assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
    } else if (currentTab === 'soat') {
      dataset = getVehicles().filter(item => item.estado_activo !== 'PARA BAJA' && item.estado_activo !== 'BAJA');
    } else if (currentTab === 'inventario') {
      dataset = inventario;
    } else {
      updateCategoryState();
      populateSubcategoryFilters();
      return;
    }
    
    const uniqueCategories = [...new Set(dataset.map(item => item.categoria).filter(Boolean))].sort();
    
    uniqueCategories.forEach(cat => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700';
      
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = cat;
      chk.className = 'chk-cat-option rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer';
      
      if (selectedCategories.includes(cat)) {
        chk.checked = true;
      }
      
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
      
      label.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = cat;
      label.appendChild(span);
      
      optionsContainerCategoria.appendChild(label);
    });
    
    updateCategoryState();
    populateSubcategoryFilters();
    populateMonthFilters();
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
    
    let dataset = [];
    if (currentTab === 'activos') {
      dataset = assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'obras') {
      dataset = assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
    } else if (currentTab === 'soat') {
      dataset = getVehicles().filter(item => item.estado_activo !== 'PARA BAJA' && item.estado_activo !== 'BAJA');
    } else if (currentTab === 'inventario') {
      dataset = inventario;
    } else {
      updateSubcategoryState();
      return;
    }
    
    // Filtrar dataset por categorías seleccionadas si las hay
    let filteredDataset = dataset;
    if (selectedCategories.length > 0) {
      filteredDataset = dataset.filter(item => selectedCategories.includes(item.categoria));
    }
    
    const uniqueSubcategories = [...new Set(filteredDataset.map(item => item.subcategoria).filter(Boolean))].sort();
    
    // Limpiar subcategorías que ya no son válidas
    selectedSubcategories = selectedSubcategories.filter(sub => uniqueSubcategories.includes(sub));
    
    uniqueSubcategories.forEach(sub => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700';
      
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = sub;
      chk.className = 'chk-subcat-option rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer';
      
      if (selectedSubcategories.includes(sub)) {
        chk.checked = true;
      }
      
      chk.addEventListener('change', () => {
        if (chk.checked) {
          if (!selectedSubcategories.includes(sub)) selectedSubcategories.push(sub);
        } else {
          selectedSubcategories = selectedSubcategories.filter(s => s !== sub);
        }
        updateSubcategoryState();
        applyFilters();
      });
      
      label.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = sub;
      label.appendChild(span);
      
      optionsContainerSubcategoria.appendChild(label);
    });
    
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

  // Rellenar dinámicamente las sucursales y estados basados en el módulo seleccionado
  function populateFilters() {
    const previousSucursal = sucursalSelect.value;
    const previousLocalidad = localidadSelect ? localidadSelect.value : '';
    const previousEstado = estadoSelect.value;
    
    // Cambiar la etiqueta del filtro de Estado/Tipo dinámicamente
    const label = document.getElementById('filter-estado-label');
    const isTipo = currentTab === 'inventario' || currentTab === 'terceros';
    const isVehiculo = currentTab === 'vehiculos' || currentTab === 'soat';
    if (label) {
      label.textContent = isTipo ? 'Tipo' : (isVehiculo ? 'ESTADO VEH.' : 'Estado');
    }
    
    // Limpiar opciones manteniendo la primera por defecto
    sucursalSelect.innerHTML = '<option value="">Todas</option>';
    if (localidadSelect) {
      localidadSelect.innerHTML = '<option value="">Todas</option>';
    }
    estadoSelect.innerHTML = '<option value="">Todos</option>';
    
    let dataset = [];
    let stateOptions = [];
    
    if (currentTab === 'activos') {
      dataset = assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    } else if (currentTab === 'obras') {
      dataset = assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    } else if (currentTab === 'soat') {
      dataset = getVehicles().filter(item => item.estado_activo !== 'PARA BAJA' && item.estado_activo !== 'BAJA');
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    } else if (currentTab === 'celulares') {
      dataset = celulares;
      // Obtener estados únicos de los celulares reales registrados
      stateOptions = [...new Set(celulares.map(c => c.estado).filter(Boolean))];
      if (stateOptions.length === 0) {
        stateOptions = ['ACTIVO', 'INACTIVO'];
      }
    } else if (currentTab === 'inventario') {
      dataset = inventario;
      stateOptions = ['FALTANTE', 'SOBRANTE'];
    } else if (currentTab === 'terceros') {
      dataset = terceros;
      stateOptions = ['TERCERO', 'CONTROL'];
    }
    
    // Poblar Sucursales con SEDE CENTRAL primero
    // Consolidar de todos los datasets para mantener la lista completa y consistente en todas las pestañas
    const allItems = [...assets, ...celulares, ...inventario, ...terceros];
    const sucursalNames = sortSucursales(allItems.map(item => item.sucursal));
    sucursalNames.forEach(suc => {
      const option = document.createElement('option');
      option.value = suc;
      option.textContent = suc;
      if (suc === previousSucursal) {
        option.selected = true;
      }
      sucursalSelect.appendChild(option);
    });

    // Poblar Localidades
    if (localidadSelect) {
      const EXCLUDED_LOCALIDADES = new Set(['SEDE CENTRAL', 'SELVA CENTRAL', 'EPS SELVA CENTRAL', 'RETIRADAS', 'SIN ASIGNAR', 'TODAS', '']);
      const LOCALIDAD_ORDER = ['LA MERCED', 'SAN RAMON', 'SAN RAMÓN', 'PICHANAKI', 'OXAPAMPA', 'VILLA RICA', 'SATIPO'];
      const localidades = [...new Set(allItems.map(item => (item.localidad || '').trim().toUpperCase()))].filter(loc => loc && !EXCLUDED_LOCALIDADES.has(loc));
      localidades.sort((a, b) => {
        const ia = LOCALIDAD_ORDER.findIndex(o => o === a);
        const ib = LOCALIDAD_ORDER.findIndex(o => o === b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      }).forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        if (loc === previousLocalidad) {
          option.selected = true;
        }
        localidadSelect.appendChild(option);
      });
    }
    
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
      
      // Resetear filtros de categoría y subcategoría al cambiar de pestaña
      selectedCategories = [];
      selectedSubcategories = [];
      
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
        moduleTitle.textContent = 'SALIDA DE BIENES (REGISTRO Y CONSULTAS)';
      } else if (currentTab === 'soat') {
        activeBtn = tabSoat;
        moduleTitle.textContent = 'MONITOREO DE SOAT Y REVISIÓN TÉCNICA VEHICULAR';
      } else if (currentTab === 'celulares') {
        activeBtn = tabCelulares;
        moduleTitle.textContent = 'EQUIPOS CELULARES';
      } else if (currentTab === 'inventario') {
        activeBtn = tabInventario;
        moduleTitle.textContent = 'ACTIVOS FIJOS - FALTANTES / SOBRANTES';
      } else if (currentTab === 'terceros') {
        activeBtn = tabTerceros;
        moduleTitle.textContent = 'BIENES DE TERCEROS';
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
      const hasCategories = currentTab === 'activos' || currentTab === 'obras' || currentTab === 'inventario';
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
    if (currentTab === 'asignacion' || currentTab === 'ficha') {
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
      if (searchInput.value.trim() !== '') {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }

    const filterSoatEstadoSelect = document.getElementById('filter-soat-estado');
    const selectedSoatEstado = filterSoatEstadoSelect ? filterSoatEstadoSelect.value : '';

    // Show/hide Clear Filters button
    const btnClearFilters = document.getElementById('btn-clear-filters');
    if (btnClearFilters) {
      const hasActiveFilters = 
        searchInput.value.trim() !== '' || 
        (selectedSucursal && selectedSucursal !== '') || 
        (selectedLocalidad && selectedLocalidad !== '') || 
        (selectedEstado && selectedEstado !== '') ||
        (selectedSoatEstado && selectedSoatEstado !== '') ||
        selectedCategories.length > 0 ||
        selectedSubcategories.length > 0 ||
        selectedMonths.length > 0 ||
        selectedGlobalYear || selectedGlobalMonth || selectedGlobalValor;
      if (hasActiveFilters) {
        btnClearFilters.classList.remove('hidden');
      } else {
        btnClearFilters.classList.add('hidden');
      }
    }
    
    let baseData = [];
    if (currentTab === 'activos') {
      baseData = assets.filter(item => !String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'obras') {
      baseData = assets.filter(item => String(item.cod_patrimonial).startsWith('339'));
    } else if (currentTab === 'vehiculos') {
      baseData = getVehicles();
    } else if (currentTab === 'soat') {
      baseData = getVehicles().filter(item => item.estado_activo !== 'PARA BAJA' && item.estado_activo !== 'BAJA');
    } else if (currentTab === 'celulares') {
      baseData = celulares;
    } else if (currentTab === 'inventario') {
      baseData = inventario;
    } else if (currentTab === 'terceros') {
      baseData = terceros;
    } else if (currentTab === 'salida-tabla' || currentTab === 'salidas') {
      baseData = salidas;
    } else if (currentTab === 'contable') {
      baseData = assets;
    }

    const filtered = baseData.filter(item => {
      if (currentTab === 'salida-tabla' || currentTab === 'salidas') {
        const querySalida = (document.getElementById('filter-salida-search')?.value || '').toLowerCase().trim();
        const queryGlobal = (searchInput ? searchInput.value.toLowerCase().trim() : '');
        const query = querySalida || queryGlobal;

        const searchMatch = !query || 
          (item.n_orden || '').toLowerCase().includes(query) ||
          (item.responsable || '').toLowerCase().includes(query) ||
          (item.cargo || '').toLowerCase().includes(query) ||
          (item.ubicacion || '').toLowerCase().includes(query) ||
          (item.motivo || '').toLowerCase().includes(query) ||
          (item.tipo_salida || '').toLowerCase().includes(query) ||
          (item.estado_devolucion || '').toLowerCase().includes(query) ||
          (item.bienes || []).some(b => 
            (b.cod_patrimonial || '').toLowerCase().includes(query) ||
            (b.denominacion || '').toLowerCase().includes(query) ||
            (b.marca || '').toLowerCase().includes(query) ||
            (b.modelo || '').toLowerCase().includes(query) ||
            (b.numero_serie || '').toLowerCase().includes(query)
          );
          
        let sucursalMatch = true;
        const selectedSalidaSucursal = document.getElementById('filter-salida-sucursal')?.value;
        if (selectedSalidaSucursal && selectedSalidaSucursal !== 'Todas' && selectedSalidaSucursal !== '') {
          const itemSuc = (item.ubicacion || '').trim().toUpperCase();
          sucursalMatch = (itemSuc === selectedSalidaSucursal.trim().toUpperCase());
        }

        let yearMatch = true;
        const selectedSalidaYear = document.getElementById('filter-salida-year')?.value || document.getElementById('filter-global-year')?.value;
        if (selectedSalidaYear && selectedSalidaYear !== 'Todos' && selectedSalidaYear !== '' && item.fecha_orden) {
          const parts = String(item.fecha_orden).split('-');
          const y = parts[0] ? Number(parts[0]) : new Date(item.fecha_orden).getFullYear();
          yearMatch = (y === Number(selectedSalidaYear));
        }

        let monthMatch = true;
        const selectedSalidaMonth = document.getElementById('filter-salida-month')?.value || document.getElementById('filter-global-month')?.value;
        if (selectedSalidaMonth && selectedSalidaMonth !== 'Todos' && selectedSalidaMonth !== '' && item.fecha_orden) {
          const parts = String(item.fecha_orden).split('-');
          const m = parts[1] ? Number(parts[1]) : (new Date(item.fecha_orden).getMonth() + 1);
          monthMatch = (m === Number(selectedSalidaMonth));
        }

        return searchMatch && sucursalMatch && yearMatch && monthMatch;
      }

      if (currentTab === 'contable') {
        const contableYearSelect = document.getElementById('contable-year-select');
        const contableMonthSelect = document.getElementById('contable-month-select');
        const contableLocalidadSelect = document.getElementById('contable-localidad-select');
        const selectedYear = contableYearSelect ? contableYearSelect.value : 'Todos';
        const selectedMonth = contableMonthSelect ? contableMonthSelect.value : 'Todos';
        const selectedLocalidad = contableLocalidadSelect ? contableLocalidadSelect.value : 'Todos';

        if (selectedLocalidad && selectedLocalidad !== 'Todos') {
          const itemLoc = (item.localidad || '').trim().toUpperCase();
          if (itemLoc !== selectedLocalidad.trim().toUpperCase()) return false;
        }

        const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
        
        if (!dateStr && (selectedYear !== 'Todos' || selectedMonth !== 'Todos')) return false;
        if (dateStr) {
          const parts = String(dateStr).split('-');
          const y = parts[0] ? Number(parts[0]) : new Date(dateStr).getFullYear();
          const m = parts[1] ? Number(parts[1]) : (new Date(dateStr).getMonth() + 1);
          if (selectedYear !== 'Todos' && y !== Number(selectedYear)) return false;
          if (selectedMonth !== 'Todos' && m !== Number(selectedMonth)) return false;
        }
        return true;
      }

      // Filtro de Sucursal
      const sucursalMatch = !selectedSucursal || item.sucursal === selectedSucursal;

      // Filtro de Localidad
      const localidadMatch = !selectedLocalidad || item.localidad === selectedLocalidad;

      // Filtro de Estado del Activo
      const estadoMatch = !selectedEstado || 
        (currentTab === 'celulares' ? item.estado === selectedEstado : 
         ((currentTab === 'inventario' || currentTab === 'terceros') ? item.tipo === selectedEstado : item.estado_activo === selectedEstado));

      // Filtro de Estado del SOAT (para VEHICULOS y SOAT & RT)
      const isBaja = item.estado_activo === 'PARA BAJA' || item.estado_activo === 'BAJA';
      const soatEstadoMatch = !selectedSoatEstado || (
        (item.soat_estado === selectedSoatEstado || item.estado_soat === selectedSoatEstado) &&
        (selectedSoatEstado !== 'VENCIDO' || !isBaja)
      );

      // Filtro de Categoría y Subcategoría (si aplica)
      const hasCategories = currentTab === 'activos' || currentTab === 'obras' || currentTab === 'inventario';
      const categoriaMatch = !hasCategories || selectedCategories.length === 0 || selectedCategories.includes(item.categoria);
      const subcategoriaMatch = !hasCategories || selectedSubcategories.length === 0 || selectedSubcategories.includes(item.subcategoria);

      // Filtro de Año de Registro Global
      let yearMatch = true;
      if (selectedGlobalYear) {
        const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
        if (!dateStr) {
          yearMatch = false;
        } else {
          const y = new Date(dateStr).getFullYear();
          yearMatch = (y === Number(selectedGlobalYear));
        }
      }

      // Filtro de Mes de Registro Global (Multiselección)
      let monthMatch = true;
      if (selectedMonths.length > 0) {
        const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
        if (!dateStr) {
          monthMatch = false;
        } else {
          const m = String(new Date(dateStr).getMonth() + 1);
          monthMatch = selectedMonths.includes(m);
        }
      } else if (selectedGlobalMonth) {
        const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable || item.fecha_ingreso || item.fecha_asignacion;
        if (!dateStr) {
          monthMatch = false;
        } else {
          const m = new Date(dateStr).getMonth() + 1;
          monthMatch = (m === Number(selectedGlobalMonth));
        }
      }

      // Filtro Rango de Valor Libros / Neto Global
      let valorMatch = true;
      if (selectedGlobalValor) {
        const valorLibros = Number(item.valor_en_libros) || 0;
        const depAcum = Number(item.depreciacion_acumulada) || 0;
        const valorNeto = Math.max(0, valorLibros - depAcum);

        if (selectedGlobalValor === 'MAJOR_0') {
          valorMatch = valorLibros > 0;
        } else if (selectedGlobalValor === '1_1000') {
          valorMatch = valorLibros > 0 && valorLibros <= 1000;
        } else if (selectedGlobalValor === '1000_10000') {
          valorMatch = valorLibros > 1000 && valorLibros <= 10000;
        } else if (selectedGlobalValor === '10000_PLUS') {
          valorMatch = valorLibros > 10000;
        } else if (selectedGlobalValor === 'DEPRECIADO') {
          valorMatch = valorLibros > 0 && valorNeto <= 1;
        }
      }

      // Filtro de Búsqueda de Texto
      let textMatch = true;
      if (query) {
        if (currentTab === 'celulares') {
          textMatch = 
            (item.cod_control && item.cod_control.toLowerCase().includes(query)) ||
            (item.marca && item.marca.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (item.imei && item.imei.toLowerCase().includes(query)) ||
            (item.numero_linea && item.numero_linea.toLowerCase().includes(query)) ||
            (item.responsable && item.responsable.toLowerCase().includes(query));
        } else if (currentTab === 'vehiculos' || currentTab === 'soat') {
          textMatch = 
            (item.cod_patrimonial && item.cod_patrimonial.toLowerCase().includes(query)) ||
            (item.placa && item.placa.toLowerCase().includes(query)) ||
            (item.denominacion && item.denominacion.toLowerCase().includes(query)) ||
            (item.marca && item.marca.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (item.nro_motor && item.nro_motor.toLowerCase().includes(query)) ||
            (item.nro_chasis && item.nro_chasis.toLowerCase().includes(query)) ||
            (item.responsable && item.responsable.toLowerCase().includes(query));
        } else if (currentTab === 'inventario') {
          textMatch = 
            (item.cod_patrimonial && item.cod_patrimonial.toLowerCase().includes(query)) ||
            (item.denominacion && item.denominacion.toLowerCase().includes(query)) ||
            (item.marca && item.marca.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (item.numero_serie && item.numero_serie.toLowerCase().includes(query)) ||
            (item.categoria && item.categoria.toLowerCase().includes(query)) ||
            (item.subcategoria && item.subcategoria.toLowerCase().includes(query));
        } else if (currentTab === 'terceros') {
          textMatch = 
            (item.cod_patrimonial && item.cod_patrimonial.toLowerCase().includes(query)) ||
            (item.denominacion && item.denominacion.toLowerCase().includes(query)) ||
            (item.marca && item.marca.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (item.numero_serie && item.numero_serie.toLowerCase().includes(query)) ||
            (item.responsable && item.responsable.toLowerCase().includes(query));
        } else {
          // Activos
          textMatch = 
            (item.cod_patrimonial && item.cod_patrimonial.toLowerCase().includes(query)) ||
            (item.denominacion && item.denominacion.toLowerCase().includes(query)) ||
            (item.marca && item.marca.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (item.responsable && item.responsable.toLowerCase().includes(query)) ||
            (item.subcategoria && item.subcategoria.toLowerCase().includes(query));
        }
      }

      return sucursalMatch && localidadMatch && estadoMatch && soatEstadoMatch && categoriaMatch && subcategoriaMatch && textMatch && yearMatch && monthMatch && valorMatch;
    });

    if (currentTab === 'vehiculos' || currentTab === 'soat') {
      filtered.sort((a, b) => {
        const sucA = (a.sucursal || '').trim();
        const sucB = (b.sucursal || '').trim();
        const compSuc = sucA.localeCompare(sucB, 'es', { sensitivity: 'base' });
        if (compSuc !== 0) return compSuc;

        const denA = (a.denominacion || '').trim();
        const denB = (b.denominacion || '').trim();
        return denA.localeCompare(denB, 'es', { sensitivity: 'base' });
      });
    }

    // Ordenar jerárquicamente activos y obras: 1° Fecha de Ingreso DESC > 2° O/C DESC > 3° Código Patrimonial DESC
    if (currentTab === 'activos' || currentTab === 'obras') {
      filtered.sort((a, b) => {
        // 1. Fecha de Ingreso (más reciente primero)
        const dA = a.fecha_alta || a.fecha_alta_factura || a.fecha_registro_contable || a.fecha_asignacion || '0000-00-00';
        const dB = b.fecha_alta || b.fecha_alta_factura || b.fecha_registro_contable || b.fecha_asignacion || '0000-00-00';
        const compDate = String(dB).localeCompare(String(dA));
        if (compDate !== 0) return compDate;

        // 2. Orden de Compra (mayor a menor)
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

        // 3. Código Patrimonial (mayor a menor)
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
      });
    }

    renderData(filtered);
  }

  // Renderizado dinámico de datos y contenedores
  function renderData(data) {
    currentFilteredData = data;
    resultsCount.textContent = `Encontrados: ${data.length}`;

    // Limpiar todas las tablas y contenedor de tarjetas móviles
    document.getElementById('assets-tbody').innerHTML = '';
    document.getElementById('obras-tbody').innerHTML = '';
    document.getElementById('vehiculos-tbody').innerHTML = '';
    if (document.getElementById('soat-tbody')) document.getElementById('soat-tbody').innerHTML = '';
    document.getElementById('celulares-tbody').innerHTML = '';
    document.getElementById('inventario-tbody').innerHTML = '';
    document.getElementById('terceros-tbody').innerHTML = '';
    if (document.getElementById('salidas-tbody')) document.getElementById('salidas-tbody').innerHTML = '';
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
      renderSalidasRows(data);
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

    if (data.length === 0) {
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

    // Inyectar datos específicos
    if (currentTab === 'activos') {
      renderActivosRows(data);
    } else if (currentTab === 'obras') {
      renderObrasRows(data);
    } else if (currentTab === 'vehiculos') {
      renderVehiculosRows(data);
    } else if (currentTab === 'soat') {
      renderSoatRows(data);
    } else if (currentTab === 'celulares') {
      renderCelularesRows(data);
    } else if (currentTab === 'inventario') {
      renderInventarioRows(data);
    } else if (currentTab === 'terceros') {
      renderTercerosRows(data);
    } else if (currentTab === 'salida-tabla') {
      renderSalidasRows(data);
    } else if (currentTab === 'salidas') {
      renderSalidasRows(data);
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
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
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
    if (ubicacionSelect && assets.length > 0 && ubicacionSelect.options.length <= 1) {
      const sucursalesSet = new Set();
      const EXCLUDED = new Set(['SELVA CENTRAL', 'EPS SELVA CENTRAL', 'SELVA CENTRAL S.A.', 'RETIRADAS', 'SIN ASIGNAR']);
      assets.forEach(a => {
        if (a.sucursal) sucursalesSet.add(a.sucursal.trim().toUpperCase());
      });
      Array.from(sucursalesSet).filter(s => s && !EXCLUDED.has(s)).sort().forEach(s => {
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
          ...assets.map(a => a.responsable),
          ...celulares.map(c => c.responsable),
          ...inventario.map(i => i.responsable),
          ...terceros.map(t => t.responsable),
          ...salidas.map(s => s.responsable)
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
      const year = fechaVal ? new Date(fechaVal).getFullYear() : new Date().getFullYear();
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
        alert('Por favor complete todos los datos obligatorios del formulario (Fecha, Motivo, Responsable, Cargo y Ubicación).');
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

      // Generar N° Orden correlativo oficial (ej: 035-2026)
      const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
      const n_orden = generarProximoNumeroOrden(year);

        const payload = {
          n_orden: n_orden,
          fecha_orden: fecha,
          tipo_salida: tipo,
          motivo: motivo,
          responsable: responsable,
          cargo: cargo,
          ubicacion: ubicacion,
          resp_tecnico: respTecnico,
          observaciones: observaciones,
          bienes: bienesAEnviar
        };

        // Generar y descargar PDF client-side con confirmación previa
        const pdfOk = await generarOrdenSalidaPDF_Public(payload);
        if (pdfOk === false) return;

        // Registrar en memoria y localStorage para persistencia en la consulta estática de forma inmediata
        const addAndSaveSalida = (newSalida) => {
          if (!salidas.some(s => s.n_orden === newSalida.n_orden)) {
            salidas.unshift(newSalida);
          }
          try {
            const localSaved = JSON.parse(localStorage.getItem('salidas_custom_history') || '[]');
            if (!localSaved.some(s => s.n_orden === newSalida.n_orden)) {
              localSaved.unshift(newSalida);
              localStorage.setItem('salidas_custom_history', JSON.stringify(localSaved));
            }
          } catch (e) {}
          applyFilters();
        };

        // Guardar inmediatamente
        addAndSaveSalida(payload);

        // Si existe backend conectado, registrar en DB en segundo plano
        try {
          fetch('/api/activos/salidas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(res => {
            if (res.ok) {
              return res.json().then(serverData => {
                if (serverData && serverData.n_orden) {
                  const idx = salidas.findIndex(s => s.n_orden === payload.n_orden || s.n_orden === serverData.n_orden);
                  if (idx !== -1) salidas[idx] = serverData;
                  else addAndSaveSalida(serverData);
                  applyFilters();
                }
              });
            }
          }).catch(() => {});
        } catch (e) {}

        alert(`Orden de Salida ${n_orden} generada y descargada con éxito.`);

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
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));

      const financiadoText = getFinanciadoText(item);
      const locText = item.localidad ? `(${item.localidad.trim()})` : '';

      row.innerHTML = `
        <td class="px-2 py-2.5 whitespace-nowrap text-center text-[0.75rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </div>
          <div class="text-[0.6875rem] text-[#0088cc] font-mono font-bold mt-0.5">
            ${item.cuenta_contable || '—'}
          </div>
          <div class="text-[0.6875rem] text-slate-400 font-mono mt-0.5">
            ${item.centro_costo || '—'}
          </div>
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center text-[0.6875rem]">
          <div class="text-slate-700 font-semibold leading-tight">
            Ingreso: <span class="text-slate-500 font-normal">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</span>
          </div>
          <div class="text-slate-700 font-semibold leading-tight mt-0.5">
            Alta: <span class="text-slate-500 font-normal">${formatDate(item.fecha_asignacion || item.fecha_alta)}</span>
          </div>
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.sucursal || '—'}
          </div>
          ${locText ? `<div class="text-[0.6875rem] text-slate-600 font-medium mt-0.5">${locText}</div>` : ''}
          ${financiadoText ? `<div class="text-[0.625rem] text-slate-500 italic font-medium mt-0.5">${financiadoText}</div>` : ''}
        </td>
        <td class="px-2 py-2.5 min-w-[200px]">
          <div class="text-[0.75rem] font-bold text-slate-900 leading-snug uppercase">
            ${item.denominacion}
          </div>
          <div class="text-[0.65rem] text-[#0088cc] font-bold italic uppercase mt-0.5">
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
            return `<div class="text-[0.65rem] text-amber-600 font-mono font-semibold mt-0.5">${prefix}${text}${suffix}</div>`;
          })()}
        </td>
        <td class="px-2 py-2.5 text-[0.72rem] min-w-[150px] text-slate-600 leading-normal">
          <div class="space-y-0.5">
            <div><span class="font-semibold text-slate-400">Color:</span> <span class="text-slate-700">${item.color || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Marca:</span> <span class="text-slate-800 font-medium">${item.marca || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> <span class="text-slate-800 font-medium">${item.modelo || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Serie:</span> <span class="text-slate-800 font-mono font-medium">${item.numero_serie || 'S/S'}</span></div>
          </div>
        </td>
        <td class="px-2 py-2.5 text-[0.72rem] min-w-[180px] leading-snug">
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
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-right text-[0.75rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-right text-[0.75rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-2 py-2.5 min-w-[160px]">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.responsable || 'Sin Asignar'}
          </div>
          ${item.puesto ? `<div class="text-[0.65rem] text-slate-500 italic font-medium uppercase mt-0.5">${item.puesto}</div>` : ''}
        </td>
        <td class="px-1 py-2 whitespace-nowrap text-center">
          <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center justify-center gap-1 px-1.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital del Activo (PDF)">
            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span class="text-[9px] font-extrabold leading-tight text-center">FICHA<br/>DIGITAL</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
      renderActivosMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });

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

      <div class="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
        <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300/80 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital del Activo (PDF)">
          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span>FICHA DIGITAL</span>
        </button>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
  }

  // ── Renders del Módulo: Obras en Curso ──────────────────────────────────────
  function renderObrasRows(data) {
    const tbody = document.getElementById('obras-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));

      const financiadoText = getFinanciadoText(item);
      const locText = item.localidad ? `(${item.localidad.trim()})` : '';

      row.innerHTML = `
        <td class="px-2 py-2.5 whitespace-nowrap text-center text-[0.75rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </div>
          <div class="text-[0.6875rem] text-[#0088cc] font-mono font-bold mt-0.5">
            ${item.cuenta_contable || '—'}
          </div>
          <div class="text-[0.6875rem] text-slate-400 font-mono mt-0.5">
            ${item.centro_costo || '—'}
          </div>
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center text-[0.6875rem]">
          <div class="text-slate-700 font-semibold leading-tight">
            Ingreso: <span class="text-slate-500 font-normal">${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}</span>
          </div>
          <div class="text-slate-700 font-semibold leading-tight mt-0.5">
            Alta: <span class="text-slate-500 font-normal">${formatDate(item.fecha_asignacion || item.fecha_alta)}</span>
          </div>
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.sucursal || '—'}
          </div>
          ${locText ? `<div class="text-[0.6875rem] text-slate-600 font-medium mt-0.5">${locText}</div>` : ''}
          ${financiadoText ? `<div class="text-[0.625rem] text-slate-500 italic font-medium mt-0.5">${financiadoText}</div>` : ''}
        </td>
        <td class="px-2 py-2.5 min-w-[200px]">
          <div class="text-[0.75rem] font-bold text-slate-900 leading-snug uppercase">
            ${item.denominacion}
          </div>
          <div class="text-[0.65rem] text-[#0088cc] font-bold italic uppercase mt-0.5">
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
            return `<div class="text-[0.65rem] text-amber-600 font-mono font-semibold mt-0.5">${prefix}${text}${suffix}</div>`;
          })()}
        </td>
        <td class="px-2 py-2.5 text-[0.72rem] min-w-[150px] text-slate-600 leading-normal">
          <div class="space-y-0.5">
            <div><span class="font-semibold text-slate-400">Color:</span> <span class="text-slate-700">${item.color || '—'}</span></div>
            <div><span class="font-semibold text-slate-400">Marca:</span> <span class="text-slate-800 font-medium">${item.marca || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> <span class="text-slate-800 font-medium">${item.modelo || 'S/M'}</span></div>
            <div><span class="font-semibold text-slate-400">Serie:</span> <span class="text-slate-800 font-mono font-medium">${item.numero_serie || 'S/S'}</span></div>
          </div>
        </td>
        <td class="px-2 py-2.5 text-[0.72rem] min-w-[180px] leading-snug">
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
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-right text-[0.75rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-2 py-2.5 whitespace-nowrap text-right text-[0.75rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-2 py-2.5 min-w-[160px]">
          <div class="font-bold text-slate-800 text-[0.75rem]">
            ${item.responsable || 'Sin Asignar'}
          </div>
          ${item.puesto ? `<div class="text-[0.65rem] text-slate-500 italic font-medium uppercase mt-0.5">${item.puesto}</div>` : ''}
        </td>
        <td class="px-1 py-2 whitespace-nowrap text-center">
          <button type="button" data-ficha-code="${item.cod_patrimonial}" class="btn-download-ficha-pdf inline-flex items-center justify-center gap-1 px-1.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Descargar Ficha Digital de Obra (PDF)">
            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span class="text-[9px] font-extrabold leading-tight text-center">FICHA<br/>DIGITAL</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
      renderObrasMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });

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
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          <span class="font-mono font-bold text-slate-900 bg-white border border-slate-800 px-2 py-0.5 rounded text-[11px] tracking-wider shadow-2xs">
            ${item.placa || 'SIN PLACA'}
          </span>
        </td>
        
        <!-- Código Patrimonial -->
        <td class="px-2 py-2.5 whitespace-nowrap text-center text-[0.75rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        
        <!-- Ubicación Financiado -->
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${getUbicacionFinanciado(item).split('\n').map((line, idx) => {
            if (idx === 0) return `<div class="font-bold text-slate-900 text-[0.75rem]">${line}</div>`;
            if (idx === 1 && line !== 'Transferencia' && line !== 'Obra en curso' && line !== 'Liq. Obra' && line !== 'Donación') {
              return `<div class="text-[0.6875rem] text-slate-500 font-medium mt-0.5">${line}</div>`;
            }
            return `<span class="inline-block text-[0.625rem] font-bold text-slate-600 bg-slate-100 border border-slate-200 uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5">${line}</span>`;
          }).join('')}
        </td>
        
        <!-- Denominación / Características -->
        <td class="px-2 py-2.5 w-[210px]">
          <div class="text-[0.75rem] font-bold text-slate-900 leading-snug uppercase">
            ${(item.denominacion || '').toUpperCase()}
          </div>
          <div class="text-[0.7rem] text-slate-600 mt-1 space-y-0.5 font-medium">
            <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || '—'}</div>
            <div><span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || '—'}</div>
            <div><span class="font-semibold text-slate-400">Año:</span> ${item.vehiculo_anio || '—'}</div>
            <div class="text-[0.65rem] font-bold text-brand-600 italic mt-0.5">CAT: ${(item.subcategoria || 'VEHÍCULO').toUpperCase()}</div>
          </div>
        </td>
        
        <!-- Especificaciones Técnicas -->
        <td class="px-2 py-2.5 text-[0.72rem] w-[200px] text-slate-600 leading-snug">
          <div><span class="font-medium text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div><span class="font-medium text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
          <div><span class="font-medium text-slate-400">Combustible:</span> ${item.combustible || '—'}</div>
          ${item.carroceria ? `<div><span class="font-medium text-slate-400">Carrocería:</span> ${item.carroceria}</div>` : ''}
          ${item.categoria_vehiculo ? `<div><span class="font-medium text-slate-400">Categoría:</span> ${item.categoria_vehiculo}</div>` : ''}
          ${item.nro_tarjeta_prop ? `<div><span class="font-medium text-slate-400">Tarjeta Prop:</span> ${item.nro_tarjeta_prop}</div>` : ''}
        </td>
        
        <!-- Estado Físico -->
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        
        <!-- SOAT -->
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${soatBadge}
        </td>
        
        <!-- Revisión Técnica -->
        <td class="px-2 py-2.5 whitespace-nowrap text-center">
          ${revTecBadge}
        </td>
        
        <!-- Responsable -->
        <td class="px-2 py-2.5 whitespace-nowrap text-[0.75rem] font-bold text-slate-800">
          ${item.responsable || '—'}
        </td>

        <!-- Documento SOAT PDF (Al Final) -->
        <td class="px-1 py-2 whitespace-nowrap text-center">
          ${item.pdf_soat_path ? `
            <a href="${getSoatPdfUrl(item.pdf_soat_path)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1 px-1.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-900 border border-rose-200 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer" title="Ver / Descargar PDF del SOAT" download="${item.cod_patrimonial}_soat.pdf">
              <svg class="w-3.5 h-3.5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span class="text-[9px] font-extrabold leading-tight text-center">PDF<br/>SOAT</span>
            </a>
          ` : '<span class="text-xs text-slate-400 font-semibold">—</span>'}
        </td>
      `;
      tbody.appendChild(row);
      renderVehiculosMobileCard(item, soatBadge, revTecBadge);
    });
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

  // ── Renders del Módulo: SOAT y RT ─────────────────────────────────────────
  function renderSoatRows(data) {
    const tbody = document.getElementById('soat-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      const soatBadge = getSoatBadgeHTML(item.soat_estado, item.soat_vencimiento, item.soat_dias_vigencia);
      const revTecBadge = getRevTecBadgeHTML(item.estado_rev_tec, item.vencimiento_rev_tec, item.dias_vigencia_rev_tec);
      
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
      tbody.appendChild(row);
      renderCelularesMobileCard(item, valUtilBadge, celEstadoBadge);
    });
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

  // ── Renders del Módulo: Inventario Físico ──────────────────────────────────
  function renderInventarioRows(data) {
    const tbody = document.getElementById('inventario-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      row.innerHTML = `
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial || '—'}
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          ${getTipoBadgeHTML(item.tipo)}
        </td>
        <td class="px-5 py-4 min-w-[180px]">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.categoria || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.subcategoria || '—'}
          </div>
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.localidad || '—'}
          </div>
        </td>
        <td class="px-5 py-4 min-w-[200px] text-[0.875rem] font-bold text-slate-800 leading-snug">
          ${item.denominacion || ''}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          <div><span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'}</div>
          <div><span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div><span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
          ${item.color ? `<div><span class="font-medium text-slate-400">Color:</span> ${item.color}</div>` : ''}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          ${item.caracteristicas_accesorios || '—'}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          ${item.observaciones || '—'}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium font-mono">
          ${formatDate(item.created_at)}
        </td>
      `;
      tbody.appendChild(row);
      renderInventarioMobileCard(item);
    });
  }

  function renderInventarioMobileCard(item) {
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
        <p class="mt-1 text-[0.8125rem] font-semibold text-brand-600 uppercase tracking-wide">
          ${item.categoria || 'Sin categoría'} / ${item.subcategoria || 'Sin subcategoría'}
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
        <div class="col-span-2">
          <dt class="font-semibold text-slate-400">Especificaciones</dt>
          <dd class="mt-0.5 text-slate-700">
            <span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'} &bull; 
            <span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'} &bull; 
            <span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}
            ${item.color ? `&bull; <span class="font-medium text-slate-400">Color:</span> ${item.color}` : ''}
          </dd>
        </div>
        ${item.caracteristicas_accesorios ? `
        <div>
          <dt class="font-semibold text-slate-400">Características / Accesorios</dt>
          <dd class="mt-0.5 text-slate-700">${item.caracteristicas_accesorios}</dd>
        </div>` : ''}
        ${item.observaciones ? `
        <div>
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

  // ── Renders del Módulo: Bienes de Terceros ──────────────────────────────────
  function renderTercerosRows(data) {
    const tbody = document.getElementById('terceros-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      row.innerHTML = `
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial || '—'}
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          ${getTipoBadgeHTML(item.tipo)}
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.localidad || '—'}
          </div>
        </td>
        <td class="px-5 py-4 min-w-[200px] text-[0.875rem] font-bold text-slate-800 leading-snug">
          ${item.denominacion || ''}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          <div><span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'}</div>
          <div><span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div><span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
          ${item.color ? `<div><span class="font-medium text-slate-400">Color:</span> ${item.color}</div>` : ''}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          ${item.caracteristicas_accesorios || '—'}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-relaxed">
          ${item.observaciones || '—'}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium font-mono">
          ${formatDate(item.created_at)}
        </td>
      `;
      tbody.appendChild(row);
      renderTercerosMobileCard(item);
    });
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
    };
    const style = styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border ${style}">${estado || ''}</span>`;
  }

  function getSoatBadgeHTML(estado, vencimiento, dias) {
    if (!estado) {
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
      minimumFractionDigits: 2
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
        "Puesto": item.puesto || "",
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
        "Puesto": item.puesto || "",
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
        "SOAT Vencimiento": item.soat_vencimiento || "",
        "SOAT Estado": item.soat_estado || "",
        "SOAT Días Vigencia": item.soat_dias_vigencia !== undefined ? item.soat_dias_vigencia : "",
        "Rev. Técnica Vencimiento": item.vencimiento_rev_tec || "",
        "Rev. Técnica Estado": item.estado_rev_tec || "",
        "Rev. Técnica Días Vigencia": item.dias_vigencia_rev_tec !== undefined ? item.dias_vigencia_rev_tec : "",
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
        "SOAT Vencimiento": item.soat_vencimiento || "",
        "SOAT Estado": item.soat_estado || "",
        "SOAT Días Vigencia": item.soat_dias_vigencia !== undefined ? item.soat_dias_vigencia : "",
        "Rev. Técnica Vencimiento": item.vencimiento_rev_tec || "",
        "Rev. Técnica Estado": item.estado_rev_tec || "",
        "Rev. Técnica Días Vigencia": item.dias_vigencia_rev_tec !== undefined ? item.dias_vigencia_rev_tec : "",
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
        "Puesto": item.puesto || "",
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
      sheetName = "Inventario_Fisico";
      exportData = currentFilteredData.map(item => ({
        "Código Patrimonial": item.cod_patrimonial,
        "Tipo": item.tipo,
        "Categoría": item.categoria || "",
        "Subcategoría": item.subcategoria || "",
        "Sucursal": item.sucursal || "",
        "Localidad": item.localidad || "",
        "Denominación": item.denominacion,
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Características / Accesorios": item.caracteristicas_accesorios || "",
        "Observaciones": item.observaciones || "",
        "Fecha Registro": item.created_at || ""
      }));
    } else if (currentTab === 'terceros') {
      sheetName = "Bienes_Terceros";
      exportData = currentFilteredData.map(item => ({
        "Código Patrimonial": item.cod_patrimonial,
        "Tipo": item.tipo,
        "Sucursal": item.sucursal || "",
        "Localidad": item.localidad || "",
        "Denominación": item.denominacion,
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "N° Serie": item.numero_serie || "S/S",
        "Color": item.color || "",
        "Características / Accesorios": item.caracteristicas_accesorios || "",
        "Responsable": item.responsable || "Sin Asignar",
        "Observaciones": item.observaciones || "",
        "Fecha Registro": item.created_at || ""
      }));
    } else if (currentTab === 'contable') {
      sheetName = "Reporte_Contable";
      exportData = currentFilteredData.map(item => ({
        "Código PCGE": item.codigo,
        "Descripción de la Cuenta": item.descripcion,
        "Tipo Elemento": item.tipo,
        "Saldo Total (S/.)": Number(item.monto.toFixed(4))
      }));
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
            "Ubicación\nFinanciado",
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
            "Ubicación\nFinanciado",
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
        data = sortedVehiculos.map(item => [
          item.placa || '—',
          item.cod_patrimonial || '—',
          getUbicacionFinanciado(item),
          `${item.denominacion || ''}${item.vehiculo_anio ? `\nAño: ${item.vehiculo_anio}` : ''}`,
          `Color: ${item.color || '—'}\nMarca: ${item.marca || '—'}\nModelo: ${item.modelo || '—'}\nMotor: ${item.nro_motor || '—'}\nChasis: ${item.nro_chasis || '—'}\nCombustible: ${item.combustible || '—'}`,
          item.estado_activo || '—',
          item.soat_estado ? `${item.soat_estado}\nVence: ${item.soat_vencimiento ? formatDate(item.soat_vencimiento) : '—'}` : 'No Registrado',
          item.vencimiento_rev_tec ? `${item.estado_rev_tec}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado',
          item.responsable || "Sin Asignar"
        ]);
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
            "Ubicación\nFinanciado",
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
        data = sortedVehiculos.map(item => [
          item.placa || '—',
          item.cod_patrimonial || '—',
          getUbicacionFinanciado(item),
          `${item.denominacion || ''}${item.vehiculo_anio ? `\nAño: ${item.vehiculo_anio}` : ''}`,
          `Color: ${item.color || '—'}\nMarca: ${item.marca || '—'}\nModelo: ${item.modelo || '—'}\nMotor: ${item.nro_motor || item.numero_motor || '—'}\nChasis: ${item.nro_chasis || item.numero_chasis || item.numero_serie || '—'}\nCombustible: ${item.combustible || '—'}`,
          item.estado_activo || 'BUENO',
          item.soat_vencimiento || item.fecha_vencimiento ? `${item.soat_estado || item.estado_soat || 'VIGENTE'}\nVence: ${formatDate(item.soat_vencimiento || item.fecha_vencimiento)}` : 'No registrado',
          item.vencimiento_rev_tec ? `${item.estado_rev_tec || 'VIGENTE'}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado',
          item.responsable || "Sin Asignar"
        ]);
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
            "Código",
            "Tipo",
            "Denominación",
            "Marca/Modelo/Serie/Color",
            "Ubicación",
            "Responsable / Custodio",
            "Observaciones",
            "Fecha Reg."
          ]
        ];
        data = currentFilteredData.map(item => {
          const cod = item.cod_patrimonial || '—';
          const tipo = item.tipo || '—';
          const denom = item.denominacion || '—';
          const especs = `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`;
          const ubi = `${item.sucursal || '—'}${item.localidad ? ` (${item.localidad})` : ''}`;
          const resp = `${item.responsable || 'Sin Asignar'}${item.puesto ? `\n${item.puesto}` : ''}`;
          const obs = item.observaciones || item.caracteristicas_accesorios || '—';
          const fReg = formatDate(item.created_at || item.fecha_ingreso);

          return [cod, tipo, denom, especs, ubi, resp, obs, fReg];
        });

        columnStyles = {
          0: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 45 },
          3: { cellWidth: 48 },
          4: { cellWidth: 32, halign: 'center' },
          5: { cellWidth: 44 },
          6: { cellWidth: 31 },
          7: { cellWidth: 21, halign: 'center' }
        };
      } else if (currentTab === 'terceros') {
        headers = [
          [
            "Código",
            "Tipo",
            "Denominación",
            "Marca/Modelo/Serie/Color",
            "Ubicación",
            "Propietario del Bien",
            "F. Ingreso",
            "F. Salida"
          ]
        ];
        data = currentFilteredData.map(item => {
          const cod = item.cod_patrimonial || '—';
          const tipo = item.tipo || 'TERCERO';
          const denom = item.denominacion || '—';
          const especs = `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`;
          const ubi = `${item.sucursal || '—'}${item.localidad ? ` (${item.localidad})` : ''}`;
          const propietario = `${item.responsable || item.propietario_manual || 'Sin Asignar'}${item.puesto ? `\n${item.puesto}` : ''}`;
          const fIngreso = formatDate(item.fecha_ingreso || item.created_at);
          const fSalida = item.fecha_salida ? formatDate(item.fecha_salida) : 'Pendiente';

          return [cod, tipo, denom, especs, ubi, propietario, fIngreso, fSalida];
        });

        columnStyles = {
          0: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 45 },
          3: { cellWidth: 50 },
          4: { cellWidth: 35, halign: 'center' },
          5: { cellWidth: 46 },
          6: { cellWidth: 24, halign: 'center' },
          7: { cellWidth: 21, halign: 'center' }
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

      // Renderizar la tabla principal
      doc.autoTable({
        head: headers,
        body: data,
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
      else if (currentTab === 'inventario') subtitle = "INVENTARIO FÍSICO - FALTANTES Y SOBRANTES";
      else if (currentTab === 'terceros') subtitle = "BIENES DE TERCEROS Y CONTROL INTERNO";
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

      // Si no existe depreciación almacenada o hay filtro de período, calcularla dinámicamente según fecha de alta
      if (dep <= 0 && cost > 0) {
        const ccStr = item.cuenta_contable || '';
        if (!ccStr.startsWith('331') && !ccStr.startsWith('339')) {
          const lifeY = Number(item.vida_util_anios) || 0;
          const sStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable;
          if (lifeY > 0 && sStr) {
            const sDate = new Date(sStr);
            const sYear = sDate.getFullYear();
            const sMonth = sDate.getMonth() + 1;
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

    // Filtrar por Tipo de Elemento
    const filteredLedgerList = ledgerList.filter(item => {
      if (selectedType === 'Todos') return true;
      if (selectedType === 'ACTIVO') return item.tipo === 'ACTIVO';
      if (selectedType === 'DEPRECIACION') return item.tipo === 'DEPRECIACIÓN';
      return true;
    });

    currentFilteredData = filteredLedgerList;
    resultsCount.textContent = `Registros: ${filteredLedgerList.length}`;

    if (filteredLedgerList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-6 text-center text-slate-400">No hay saldos en este período</td></tr>`;
      return;
    }

    filteredLedgerList.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';

      row.innerHTML = `
        <td class="px-5 py-3 whitespace-nowrap text-xs font-mono font-bold text-slate-800">${item.codigo}</td>
        <td class="px-5 py-3 text-xs font-medium text-slate-700">${item.descripcion}</td>
        <td class="px-5 py-3 whitespace-nowrap">
          <span class="px-2 py-0.5 text-[10px] font-bold border rounded-full ${
            item.codigo.startsWith('33') ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }">
            ${item.tipo}
          </span>
        </td>
        <td class="px-5 py-3 whitespace-nowrap text-xs font-mono font-bold text-slate-900 text-right">${formatMoney(item.monto)}</td>
      `;
      tbody.appendChild(row);
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
      const imgPaths = [activo.imagen_1_path, activo.imagen_2_path, activo.imagen_3_path].filter(Boolean);
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
          
          if (imagesToDraw.length > 0) {
            posY += 10;
            doc.line(marginX, posY, 196, posY);
            posY += 6;
            doc.setFont("helvetica", "bold");
            doc.text("Imágenes del Activo:", marginX, posY);
            posY += 4;
            
            const imgWidth = 55;
            const imgHeight = 40;
            const spacing = 6;
            
            for (let i = 0; i < imagesToDraw.length; i++) {
              const fullUrl = `.${imagesToDraw[i]}`;
              const imgElement = await loadImage(fullUrl).catch(() => null);
              if (imgElement) {
                doc.addImage(imgElement, 'JPEG', marginX + i * (imgWidth + spacing), posY, imgWidth, imgHeight);
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
