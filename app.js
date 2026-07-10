document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let celulares = [];
  let inventario = [];
  let terceros = [];
  let currentTab = 'activos'; // activos | vehiculos | celulares | inventario | terceros | soat | asignacion
  let currentFilteredData = [];
  let responsablesMap = {};
  let selectedResponsableKey = null;
  
  // Estructuras de datos para la pestaña de Asignación (Acta-céntrica)
  let actasMap = {};
  let selectedActaKey = null;
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
      const [assetsResponse, celularesResponse, inventarioResponse, tercerosResponse] = await Promise.all([
        fetch('./activos.json'),
        fetch('./celulares.json').catch(() => null),
        fetch('./inventario_fisico.json').catch(() => null),
        fetch('./bienes_terceros.json').catch(() => null)
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
        let acta = item.n_acta_entrega ? item.n_acta_entrega.trim() : '';
        if (acta) {
          // Normalizar formato a XXX-YYYY (sin espacios)
          acta = acta.replace(/\s*-\s*/g, '-');
          if (!actasMap[acta]) {
            actasMap[acta] = {
              n_acta: acta,
              responsable: item.responsable || '—',
              puesto: item.puesto || item.unidad || '—',
              sucursal: item.sucursal || '—',
              bienes: []
            };
          }
          actasMap[acta].bienes.push(item);
          
          if (item.responsable) actasMap[acta].responsable = item.responsable;
          if (item.puesto || item.unidad) actasMap[acta].puesto = item.puesto || item.unidad;
          if (item.sucursal) actasMap[acta].sucursal = item.sucursal;
        } else {
          bienesSinActa.push(item);
          const resp = item.responsable ? item.responsable.trim() : '';
          if (resp) {
            if (!responsablesSinActaMap[resp]) {
              responsablesSinActaMap[resp] = {
                nombre: resp,
                puesto: item.puesto || item.unidad || '—',
                sucursal: item.sucursal || '—',
                bienes: []
              };
            }
            responsablesSinActaMap[resp].bienes.push(item);
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
          const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
          if (dateStr) {
            const y = new Date(dateStr).getFullYear();
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

      // Event listeners para controles del reporte contable
      const contableDigitSelect = document.getElementById('contable-digit-select');
      const contableMonthSelect = document.getElementById('contable-month-select');
      if (contableDigitSelect) contableDigitSelect.addEventListener('change', applyFilters);
      if (contableYearSelect) contableYearSelect.addEventListener('change', applyFilters);
      if (contableMonthSelect) contableMonthSelect.addEventListener('change', applyFilters);
      const contableTypeSelect = document.getElementById('contable-type-select');
      if (contableTypeSelect) contableTypeSelect.addEventListener('change', applyFilters);

      applyFilters();
      
      // Adjuntar event listeners
      searchInput.addEventListener('input', applyFilters);
      sucursalSelect.addEventListener('change', applyFilters);
      if (localidadSelect) {
        localidadSelect.addEventListener('change', applyFilters);
      }
      estadoSelect.addEventListener('change', applyFilters);


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
          
          // Pivotear flechas
          if (dropdownSubcategoria.classList.contains('hidden')) {
            iconSubcategoria.style.transform = 'rotate(0deg)';
          } else {
            iconSubcategoria.style.transform = 'rotate(180deg)';
          }
          iconCategoria.style.transform = 'rotate(0deg)';
        });
      }

      // Evitar que el dropdown se cierre al hacer clic adentro
      if (dropdownCategoria) {
        dropdownCategoria.addEventListener('click', (e) => e.stopPropagation());
      }
      if (dropdownSubcategoria) {
        dropdownSubcategoria.addEventListener('click', (e) => e.stopPropagation());
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

          
          // Limpiar filtros de multiselección
          selectedCategories = [];
          selectedSubcategories = [];
          populateCategoryFilters();
          
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

        // Asegurar que al redimensionar a desktop, los filtros sean visibles
        window.addEventListener('resize', () => {
          if (window.innerWidth >= 768) {
            filtersContent.classList.remove('hidden');
            filtersContent.classList.add('flex');
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
  }

  function updateCategoryState() {
    if (!optionsContainerCategoria || !labelSelectCategoria || !chkAllCategoria) return;
    const checkboxes = optionsContainerCategoria.querySelectorAll('.chk-cat-option');
    const checkedCount = selectedCategories.length;
    
    if (checkboxes.length === 0) {
      labelSelectCategoria.textContent = 'Sin Categorías';
      chkAllCategoria.checked = false;
      chkAllCategoria.disabled = true;
      return;
    }
    
    chkAllCategoria.disabled = false;
    if (checkedCount === 0) {
      labelSelectCategoria.textContent = 'Todas las Categorías';
      chkAllCategoria.checked = false;
      chkAllCategoria.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
      labelSelectCategoria.textContent = 'Todas las Categorías';
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
      labelSelectSubcategoria.textContent = 'Sin Subcategorías';
      chkAllSubcategoria.checked = false;
      chkAllSubcategoria.disabled = true;
      return;
    }
    
    chkAllSubcategoria.disabled = false;
    if (checkedCount === 0) {
      labelSelectSubcategoria.textContent = 'Todas las Subcategorías';
      chkAllSubcategoria.checked = false;
      chkAllSubcategoria.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
      labelSelectSubcategoria.textContent = 'Todas las Subcategorías';
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
    if (label) {
      label.textContent = isTipo ? 'Tipo' : 'Estado';
    }
    
    // Limpiar opciones manteniendo la primera por defecto
    sucursalSelect.innerHTML = '<option value="">Todas las Sucursales</option>';
    if (localidadSelect) {
      localidadSelect.innerHTML = '<option value="">Todas las Localidades</option>';
    }
    estadoSelect.innerHTML = `<option value="">Todos los ${isTipo ? 'Tipos' : 'Estados'}</option>`;
    
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
      stateOptions = ['BUENO', 'REGULAR', 'MALO'];
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
    
    // Poblar Sucursales sin formato Sucursal (Localidad)
    // Consolidar de todos los datasets para mantener la lista completa y consistente en todas las pestañas
    const allItems = [...assets, ...celulares, ...inventario, ...terceros];
    const sucursalNames = [...new Set(allItems.map(item => item.sucursal).filter(Boolean))];
    sucursalNames.sort().forEach(suc => {
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
      const localidades = [...new Set(allItems.map(item => item.localidad).filter(Boolean))];
      localidades.sort().forEach(loc => {
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
      option.textContent = est;
      if (est === previousEstado) {
        option.selected = true;
      }
      estadoSelect.appendChild(option);
    });

    // Poblar filtros de categorías
    populateCategoryFilters();
  }

  // Inicialización de pestañas
  function initTabs() {
    const tabActivos = document.getElementById('tab-activos');
    const tabObras = document.getElementById('tab-obras');
    const tabVehiculos = document.getElementById('tab-vehiculos');
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
      [tabActivos, tabObras, tabVehiculos, tabSoat, tabCelulares, tabInventario, tabTerceros, tabAsignacion, tabContable].forEach(btn => {
        if (btn) {
          btn.className = "flex-none sm:flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 whitespace-nowrap";
        }
      });
      
      let activeBtn;
      if (currentTab === 'activos') {
        activeBtn = tabActivos;
        moduleTitle.textContent = 'Catálogo de Activos Fijos';
      } else if (currentTab === 'obras') {
        activeBtn = tabObras;
        moduleTitle.textContent = 'Obras en Curso (PMO)';
      } else if (currentTab === 'vehiculos') {
        activeBtn = tabVehiculos;
        moduleTitle.textContent = 'Control Patrimonial de Vehículos';
      } else if (currentTab === 'soat') {
        activeBtn = tabSoat;
        moduleTitle.textContent = 'Monitoreo de SOAT y Revisión Técnica';
      } else if (currentTab === 'celulares') {
        activeBtn = tabCelulares;
        moduleTitle.textContent = 'Control de Celulares y Líneas';
      } else if (currentTab === 'inventario') {
        activeBtn = tabInventario;
        moduleTitle.textContent = 'Inventario Físico (Faltantes / Sobrantes)';
      } else if (currentTab === 'terceros') {
        activeBtn = tabTerceros;
        moduleTitle.textContent = 'Control de Bienes de Terceros y Control';
      } else if (currentTab === 'asignacion') {
        activeBtn = tabAsignacion;
        moduleTitle.textContent = 'Asignación de Bienes';
      } else if (currentTab === 'contable') {
        activeBtn = tabContable;
        moduleTitle.textContent = 'Reporte Contable Agrupado';
      }
      
      if (activeBtn) {
        activeBtn.className = "flex-none sm:flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-brand-500 text-white shadow-md shadow-brand-500/15 whitespace-nowrap";
      }

      // Mostrar/Ocultar el filtro de Sucursal y Localidad
      const sucursalWrapper = document.getElementById('sucursal-filter-wrapper');
      const localidadWrapper = document.getElementById('localidad-filter-wrapper');
      
      if (currentTab === 'contable' || currentTab === 'asignacion') {
        if (sucursalWrapper) sucursalWrapper.classList.add('hidden');
        if (localidadWrapper) localidadWrapper.classList.add('hidden');
      } else {
        if (sucursalWrapper) sucursalWrapper.classList.remove('hidden');
        if (localidadWrapper) localidadWrapper.classList.remove('hidden');
      }

      // Mostrar/Ocultar el filtro de Categoría y Subcategoría (sólo si aplica)
      const categoriaWrapper = document.getElementById('categoria-filter-wrapper');
      const subcategoriaWrapper = document.getElementById('subcategoria-filter-wrapper');
      const hasCategories = currentTab === 'activos' || currentTab === 'obras' || currentTab === 'vehiculos' || currentTab === 'inventario' || currentTab === 'soat';
      if (hasCategories && currentTab !== 'contable' && currentTab !== 'asignacion') {
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

      if (currentTab === 'contable' || currentTab === 'asignacion') {
        searchWrapper.classList.add('hidden');
        estadoWrapper.classList.add('hidden');
      } else {
        searchWrapper.classList.remove('hidden');
        estadoWrapper.classList.remove('hidden');
      }
      
      if (currentTab === 'asignacion') {
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
    if (tabObras) tabObras.addEventListener('click', () => switchTab('obras'));
    if (tabVehiculos) tabVehiculos.addEventListener('click', () => switchTab('vehiculos'));
    if (tabSoat) tabSoat.addEventListener('click', () => switchTab('soat'));
    if (tabCelulares) tabCelulares.addEventListener('click', () => switchTab('celulares'));
    if (tabInventario) tabInventario.addEventListener('click', () => switchTab('inventario'));
    if (tabTerceros) tabTerceros.addEventListener('click', () => switchTab('terceros'));
    if (tabAsignacion) tabAsignacion.addEventListener('click', () => switchTab('asignacion'));
    if (tabContable) tabContable.addEventListener('click', () => switchTab('contable'));
  }

  // Filtrado del cliente
  function applyFilters() {
    if (currentTab === 'asignacion') {
      renderData([]);
      return;
    }
    const query = searchInput.value.toLowerCase().trim();
    const selectedSucursal = sucursalSelect.value;
    const selectedLocalidad = localidadSelect ? localidadSelect.value : '';
    const selectedEstado = estadoSelect.value;
    
    // Show/hide X button inside search
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (btnClearSearch) {
      if (searchInput.value.trim() !== '') {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }



    // Show/hide Clear Filters button
    const btnClearFilters = document.getElementById('btn-clear-filters');
    if (btnClearFilters) {
      const hasActiveFilters = 
        searchInput.value.trim() !== '' || 
        (selectedSucursal && selectedSucursal !== '') || 
        (selectedLocalidad && selectedLocalidad !== '') || 
        (selectedEstado && selectedEstado !== '') ||

        selectedCategories.length > 0 ||
        selectedSubcategories.length > 0;
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
    } else if (currentTab === 'contable') {
      baseData = assets;
    }

    const filtered = baseData.filter(item => {
      if (currentTab === 'contable') {
        const contableYearSelect = document.getElementById('contable-year-select');
        const contableMonthSelect = document.getElementById('contable-month-select');
        const selectedYear = contableYearSelect ? contableYearSelect.value : 'Todos';
        const selectedMonth = contableMonthSelect ? contableMonthSelect.value : 'Todos';
        const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
        
        if (!dateStr && (selectedYear !== 'Todos' || selectedMonth !== 'Todos')) return false;
        if (dateStr) {
          const date = new Date(dateStr);
          const y = date.getFullYear();
          const m = date.getMonth() + 1;
          if (selectedYear !== 'Todos' && y !== Number(selectedYear)) return false;
          if (selectedMonth !== 'Todos' && m !== Number(selectedMonth)) return false;
        }
        return true;
      }

      // Filtro de Sucursal
      const sucursalMatch = !selectedSucursal || item.sucursal === selectedSucursal;

      // Filtro de Localidad
      const localidadMatch = !selectedLocalidad || item.localidad === selectedLocalidad;

      // Filtro de Estado
      const estadoMatch = !selectedEstado || 
        (currentTab === 'celulares' ? item.estado === selectedEstado : 
         ((currentTab === 'inventario' || currentTab === 'terceros') ? item.tipo === selectedEstado : item.estado_activo === selectedEstado));



      // Filtro de Categoría y Subcategoría (si aplica)
      const hasCategories = currentTab === 'activos' || currentTab === 'obras' || currentTab === 'vehiculos' || currentTab === 'inventario' || currentTab === 'soat';
      const categoriaMatch = !hasCategories || selectedCategories.length === 0 || selectedCategories.includes(item.categoria);
      const subcategoriaMatch = !hasCategories || selectedSubcategories.length === 0 || selectedSubcategories.includes(item.subcategoria);

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

      return sucursalMatch && localidadMatch && estadoMatch && categoriaMatch && subcategoriaMatch && textMatch;
    });

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
      'contable-table-container',
      'asignacion-table-container'
    ];

    if (currentTab === 'asignacion') {
      emptyState.classList.add('hidden');
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'asignacion-table-container') el.classList.remove('hidden');
          else el.classList.add('hidden');
        }
      });
      mobileContainer.classList.add('hidden');
      renderAsignacionTab();
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
      
      const activeTableId = `${currentTab === 'activos' ? 'assets' : currentTab}-table-container`;
      const activeEl = document.getElementById(activeTableId);
      if (activeEl) activeEl.classList.remove('hidden');
      mobileContainer.classList.add('hidden');
    } else {
      allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      mobileContainer.classList.remove('hidden');
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
    } else if (currentTab === 'contable') {
      renderContableRows(data);
    }
  }

  // ── Renders del Módulo: Activos Fijos ──────────────────────────────────────
  function renderActivosRows(data) {
    const tbody = document.getElementById('assets-tbody');
    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      const valLibrosFormateado = formatMoney(item.valor_en_libros);
      const valNetoFormateado = formatMoney(getNetValue(item));

      row.innerHTML = `
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-semibold text-brand-600 bg-brand-50/50 border border-brand-200 rounded-full">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </span>
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full">
            ${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}
          </span>
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.localidad || '—'}
          </div>
        </td>
        <td class="px-5 py-4 min-w-[200px]">
          <div class="text-[0.875rem] font-bold text-slate-800 leading-snug">
            ${item.denominacion}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold mt-1 uppercase">
            ${item.subcategoria || '—'}
          </div>
        </td>
        <td class="px-5 py-4 text-[0.8125rem] min-w-[220px] text-slate-500 leading-relaxed">
          ${item.placa ? `
            <div class="mb-1">
              <span class="font-mono font-bold text-slate-700 bg-slate-950 text-white px-2 py-0.5 rounded text-[10px] tracking-wider shadow-sm mr-1.5">
                ${item.placa}
              </span>
              ${item.categoria_vehiculo ? `<span class="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px] ring-1 ring-amber-200">Cat: ${item.categoria_vehiculo}</span>` : ''}
            </div>
            <div>
              <span class="font-medium text-slate-400">Motor:</span> ${item.nro_motor || 'S/M'}
            </div>
            <div>
              <span class="font-medium text-slate-400">Chasis:</span> ${item.nro_chasis || 'S/C'}
            </div>
            ${item.carroceria ? `<div><span class="font-medium text-slate-400">Carrocería:</span> ${item.carroceria}</div>` : ''}
            ${item.combustible ? `<div><span class="font-medium text-slate-400">Combustible:</span> ${item.combustible}</div>` : ''}
          ` : `
            <div>
              <span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'} &bull; <span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}
            </div>
            <div class="mt-0.5">
              <span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}
            </div>
            ${item.color ? `<div class="text-[0.75rem] italic text-slate-400 mt-0.5">Color: ${item.color}</div>` : ''}
          `}
        </td>
        <td class="px-5 py-4 whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
        </td>
      `;
      tbody.appendChild(row);
      renderActivosMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });
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
          <div><span class="font-semibold text-slate-700 bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono mr-1.5">${item.placa}</span></div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
        ` : `
          <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || 'S/M'} · <span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
        `}
        <div class="mt-1"><span class="font-semibold text-slate-400">Responsable:</span> ${item.responsable || 'Sin asignar'}</div>
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

      row.innerHTML = `
        <td class="px-3.5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-semibold text-brand-600 bg-brand-50/50 border border-brand-200 rounded-full">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </span>
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full">
            ${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}
          </span>
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.sucursal || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide mt-0.5">
            ${item.localidad || '—'}
          </div>
        </td>
        <td class="px-3.5 py-4 min-w-[200px]">
          <div class="text-[0.875rem] font-bold text-slate-800 leading-snug">
            ${item.denominacion}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold mt-1 uppercase">
            ${item.subcategoria || '—'}
          </div>
        </td>
        <td class="px-3.5 py-4 text-[0.8125rem] min-w-[220px] text-slate-500 leading-relaxed">
          ${item.placa ? `
            <div class="mb-1">
              <span class="font-mono font-bold text-slate-700 bg-slate-950 text-white px-2 py-0.5 rounded text-[10px] tracking-wider shadow-sm mr-1.5">
                ${item.placa}
              </span>
              ${item.categoria_vehiculo ? `<span class="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px] ring-1 ring-amber-200">Cat: ${item.categoria_vehiculo}</span>` : ''}
            </div>
            <div>
              <span class="font-medium text-slate-400">Motor:</span> ${item.nro_motor || 'S/M'}
            </div>
            <div>
              <span class="font-medium text-slate-400">Chasis:</span> ${item.nro_chasis || 'S/C'}
            </div>
          ` : `
            <div>
              <span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'} &bull; <span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}
            </div>
            <div class="mt-0.5">
              <span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}
            </div>
          `}
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap text-[0.8125rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap text-[0.8125rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        <td class="px-3.5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
        </td>
      `;
      tbody.appendChild(row);
      renderObrasMobileCard(item, valLibrosFormateado, valNetoFormateado);
    });
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
          <div><span class="font-semibold text-slate-700 bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono mr-1.5">${item.placa}</span></div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
        ` : `
          <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || 'S/M'} · <span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
        `}
        <div class="mt-1"><span class="font-semibold text-slate-400">Responsable:</span> ${item.responsable || 'Sin asignar'}</div>
      </div>
    `;
    mobileContainer.appendChild(mobileCard);
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
        
        <!-- Especificaciones Técnicas -->
        <td class="px-5 py-4 text-[0.8125rem] min-w-[220px] text-slate-500 leading-relaxed">
          <div><span class="font-medium text-slate-400">Motor:</span> ${item.nro_motor || '—'}</div>
          <div><span class="font-medium text-slate-400">Chasis:</span> ${item.nro_chasis || '—'}</div>
          <div><span class="font-medium text-slate-400">Combustible:</span> ${item.combustible || '—'}</div>
          ${item.carroceria ? `<div><span class="font-medium text-slate-400">Carrocería:</span> ${item.carroceria}</div>` : ''}
          ${item.categoria_vehiculo ? `<div><span class="font-medium text-slate-400">Categoría:</span> ${item.categoria_vehiculo}</div>` : ''}
          ${item.nro_tarjeta_prop ? `<div><span class="font-medium text-slate-400">Tarjeta Prop:</span> ${item.nro_tarjeta_prop}</div>` : ''}
        </td>
        
        <!-- Estado Físico -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        
        <!-- SOAT -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${soatBadge}
        </td>
        
        <!-- Revisión Técnica -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${revTecBadge}
        </td>
        
        <!-- Responsable -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
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
        <td class="px-5 py-4 whitespace-nowrap">
          ${soatBadge}
        </td>
        
        <!-- Revisión Técnica -->
        <td class="px-5 py-4 whitespace-nowrap">
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
      return '<span class="text-xs text-slate-400 italic">No registrado</span>';
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
      <div class="flex flex-col gap-1">
        <span class="inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold border ${style}">
          ${label} ${diasText}
        </span>
        <span class="text-[11px] text-slate-500 font-medium font-mono">${vencimiento ? formatDate(vencimiento) : ''}</span>
      </div>
    `;
  }

  function getRevTecBadgeHTML(estado, vencimiento, dias) {
    if (!vencimiento) {
      return '<span class="text-xs text-slate-400 italic">No registrado</span>';
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
      <div class="flex flex-col gap-1">
        <span class="inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold border ${style}">
          ${label} ${diasText}
        </span>
        <span class="text-[11px] text-slate-500 font-medium font-mono">${formatDate(vencimiento)}</span>
      </div>
    `;
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

      if (currentTab === 'activos') {
        headers = [
          [
            "Cód. Patrimonial",
            "Cta. Contable",
            "N° Documento",
            "Fecha Ingreso",
            "Ubicación (Sucursal / Localidad)",
            "Denominación del Activo",
            "Especificaciones",
            "Estado",
            "Valor Libros",
            "Valor Neto",
            "Responsable"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_patrimonial || '—',
          item.cuenta_contable || '—',
          item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—',
          formatDate(item.fecha_alta_factura || item.fecha_registro_contable),
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          item.denominacion || '',
          item.placa ? 
            `Placa: ${item.placa}\nMotor: ${item.nro_motor || 'S/M'}\nChasis: ${item.nro_chasis || 'S/C'}\nSOAT: ${item.soat_estado || '—'}\nRev.Tec: ${item.estado_rev_tec || '—'}` :
            `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.estado_activo || '—',
          `S/. ${formatMoney(item.valor_en_libros)}`,
          `S/. ${formatMoney(getNetValue(item))}`,
          item.responsable || "Sin Asignar"
        ]);
        columnStyles = {
          0: { cellWidth: 20 },
          1: { cellWidth: 18 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 30 },
          5: { cellWidth: 38 },
          6: { cellWidth: 39 },
          7: { cellWidth: 15 },
          8: { cellWidth: 23, halign: 'right' },
          9: { cellWidth: 23, halign: 'right' },
          10: { cellWidth: 25 }
        };
      } else if (currentTab === 'obras') {
        headers = [
          [
            "Cód. Patrimonial",
            "Cta. Contable",
            "N° Documento",
            "Fecha Ingreso",
            "Ubicación (Sucursal / Localidad)",
            "Denominación del Activo",
            "Especificaciones",
            "Estado",
            "Valor Libros",
            "Valor Neto",
            "Responsable"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_patrimonial || '—',
          item.cuenta_contable || '—',
          item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—',
          formatDate(item.fecha_alta_factura || item.fecha_registro_contable),
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          item.denominacion || '',
          item.placa ? 
            `Placa: ${item.placa}\nMotor: ${item.nro_motor || 'S/M'}\nChasis: ${item.nro_chasis || 'S/C'}` :
            `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.estado_activo || '—',
          `S/. ${formatMoney(item.valor_en_libros)}`,
          `S/. ${formatMoney(getNetValue(item))}`,
          item.responsable || "Sin Asignar"
        ]);
        columnStyles = {
          0: { cellWidth: 20 },
          1: { cellWidth: 18 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 30 },
          5: { cellWidth: 38 },
          6: { cellWidth: 39 },
          7: { cellWidth: 15 },
          8: { cellWidth: 23, halign: 'right' },
          9: { cellWidth: 23, halign: 'right' },
          10: { cellWidth: 25 }
        };
      } else if (currentTab === 'vehiculos') {
        headers = [
          [
            "Placa",
            "Cód. Patrimonial",
            "Tipo / Subcat",
            "Ubicación",
            "Denominación",
            "Especificaciones Técnicas",
            "Estado",
            "SOAT",
            "Revisión Técnica",
            "Responsable"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.placa || '—',
          item.cod_patrimonial || '—',
          item.subcategoria || 'VEHÍCULO',
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          `${item.denominacion || ''}\nAño: ${item.vehiculo_anio || '—'}`,
          `Motor: ${item.nro_motor || '—'}\nChasis: ${item.nro_chasis || '—'}\nCombustible: ${item.combustible || '—'}`,
          item.estado_activo || '—',
          item.soat_estado ? `${item.soat_estado}\nPol: ${item.soat_poliza || '—'}\nVence: ${item.soat_vencimiento ? formatDate(item.soat_vencimiento) : '—'}` : 'No Registrado',
          item.vencimiento_rev_tec ? `${item.estado_rev_tec}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado',
          item.responsable || "Sin Asignar"
        ]);
        columnStyles = {
          0: { cellWidth: 20 },
          1: { cellWidth: 22 },
          2: { cellWidth: 22 },
          3: { cellWidth: 25 },
          4: { cellWidth: 40 },
          5: { cellWidth: 43 },
          6: { cellWidth: 15 },
          7: { cellWidth: 35 },
          8: { cellWidth: 28 },
          9: { cellWidth: 25 }
        };
      } else if (currentTab === 'soat') {
        headers = [
          [
            "Placa",
            "Cód. Patrimonial",
            "Tipo / Subcat",
            "Ubicación",
            "Denominación",
            "Estado",
            "SOAT",
            "Revisión Técnica",
            "Responsable"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.placa || '—',
          item.cod_patrimonial || '—',
          item.subcategoria || 'VEHÍCULO',
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          `${item.denominacion || ''}\nAño: ${item.vehiculo_anio || '—'}`,
          item.estado_activo || '—',
          item.soat_estado ? `${item.soat_estado}\nPol: ${item.soat_poliza || '—'}\nVence: ${item.soat_vencimiento ? formatDate(item.soat_vencimiento) : '—'}` : 'No Registrado',
          item.vencimiento_rev_tec ? `${item.estado_rev_tec}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No registrado',
          item.responsable || "Sin Asignar"
        ]);
        columnStyles = {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 28 },
          4: { cellWidth: 45 },
          5: { cellWidth: 15 },
          6: { cellWidth: 43 },
          7: { cellWidth: 43 },
          8: { cellWidth: 28 }
        };
      } else if (currentTab === 'celulares') {
        headers = [
          [
            "Cód. Control",
            "N° Línea",
            "Marca / Modelo",
            "IMEI / Operador",
            "Sucursal",
            "Ingreso",
            "Asignación",
            "Asignado a",
            "Renovación (3 Años)",
            "Estado"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_control || '—',
          item.numero_linea || '—',
          `${item.marca || 'S/M'}\n${item.modelo || 'S/M'}`,
          `${item.imei || '—'}\n${item.operador || '—'}`,
          item.sucursal || '—',
          formatDate(item.fecha_ingreso),
          formatDate(item.fecha_asignacion),
          `${item.responsable || 'Sin asignar'}\n(${item.puesto || '—'})`,
          `${item.vida_util_estado === 'VENCIDA' ? 'Vencido' : (item.vida_util_estado === 'POR_RENOVAR' ? 'Por Vencer' : (item.vida_util_estado === 'VIGENTE' ? 'Vigente' : ''))}\nVence: ${item.fecha_renovacion ? formatDate(item.fecha_renovacion) : '—'}`,
          item.estado || 'ACTIVO'
        ]);
        columnStyles = {
          0: { cellWidth: 22 },
          1: { cellWidth: 20 },
          2: { cellWidth: 26 },
          3: { cellWidth: 32 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 38 },
          8: { cellWidth: 36 },
          9: { cellWidth: 18 }
        };
      } else if (currentTab === 'inventario') {
        headers = [
          [
            "Cód. Patrimonial",
            "Tipo",
            "Categoría / Subcat",
            "Ubicación",
            "Denominación",
            "Especificaciones",
            "Características / Accesorios",
            "Observaciones",
            "Fecha Reg"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_patrimonial || '—',
          item.tipo || '—',
          `${item.categoria || '—'}\n${item.subcategoria || '—'}`,
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          item.denominacion || '',
          `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.caracteristicas_accesorios || '—',
          item.observaciones || '—',
          formatDate(item.created_at)
        ]);
        columnStyles = {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 32 },
          3: { cellWidth: 28 },
          4: { cellWidth: 40 },
          5: { cellWidth: 35 },
          6: { cellWidth: 35 },
          7: { cellWidth: 35 },
          8: { cellWidth: 15 }
        };
      } else if (currentTab === 'terceros') {
        headers = [
          [
            "Cód. Patrimonial",
            "Tipo",
            "Ubicación",
            "Denominación",
            "Especificaciones",
            "Características / Accesorios",
            "Responsable",
            "Observaciones",
            "Fecha Reg"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_patrimonial || '—',
          item.tipo || '—',
          `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`,
          item.denominacion || '',
          `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.caracteristicas_accesorios || '—',
          item.responsable || "Sin Asignar",
          item.observaciones || '—',
          formatDate(item.created_at)
        ]);
        columnStyles = {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 45 },
          4: { cellWidth: 35 },
          5: { cellWidth: 35 },
          6: { cellWidth: 32 },
          7: { cellWidth: 32 },
          8: { cellWidth: 15 }
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
        styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
        headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: columnStyles,
        margin: { top: 30, bottom: 36 } // Asegura espacio superior e inferior en todas las páginas
      });

      // Dibujar Encabezado y Pie de página en cada hoja
      const totalPages = doc.internal.getNumberOfPages();
      const today = new Date().toLocaleDateString('es-PE');
      const selectedSucursal = sucursalSelect.value || "Todas las Sucursales";
      
      let subtitle = "";
      if (currentTab === 'activos') subtitle = "Inventario de Activos Fijos";
      else if (currentTab === 'obras') subtitle = "Inventario de Obras en Curso";
      else if (currentTab === 'vehiculos') subtitle = "Inventario de Vehículos";
      else if (currentTab === 'celulares') subtitle = "Inventario de Celulares";
      else if (currentTab === 'inventario') subtitle = "Inventario Físico (Faltantes / Sobrantes)";
      else if (currentTab === 'terceros') subtitle = "Bienes de Terceros (Terceros / Control)";
      else if (currentTab === 'contable') subtitle = "Reporte Contable Agrupado";

      const signatureBlockY = 198;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // --- ENCABEZADO ---
        // 1. Agregar Imagen de Logo (Superior Izquierda)
        if (logoImg) {
          doc.addImage(logoImg, 'PNG', 14, 8, 48, 14);
        }

        // 2. Fecha (Superior Derecha)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Fecha de Reporte: ${today}`, 283, 12, { align: 'right' });

        // 3. Título Centrado
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 110, 180); // Azul formal
        doc.text("CONTROL PATRIMONIAL", 148.5, 14, { align: 'center' });

        // Subtítulo Centrado
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text(subtitle, 148.5, 20, { align: 'center' });

        // Sucursal / Filtro Centrado
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(`Filtro: ${selectedSucursal}`, 148.5, 25, { align: 'center' });

        // --- PIE DE PÁGINA ---
        // 4. Mensaje de advertencia de firmas en la parte izquierda
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(225, 29, 72); // Color rojo/rosa formal (rose-600)
        doc.text("Nota: El documento sin firmas carece de valor.", 14, signatureBlockY + 4);

        // 5. Firma y Sello Punteados (Posición Centrada-Izquierda)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text("----------------------------------------------------------------", 110, signatureBlockY);
        doc.text("Firma y Sello (Huella Digital)", 122, signatureBlockY + 4);

        // 6. Sello Post Firma CP1 (Parte Inferior Derecha, posición fija - desplazado a X=190)
        if (selloImg) {
          doc.addImage(selloImg, 'PNG', 190, signatureBlockY - 22, 56, 26);
        }

        // 7. Número de Página (Página X de Y)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 283, signatureBlockY + 4, { align: 'right' });
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
    const tbody = document.getElementById('contable-tbody');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const digitMode = Number(digitSelect ? digitSelect.value : 10);
    const selectedType = typeSelect ? typeSelect.value : 'Todos';
    
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
      '3321113101': 'OTASS-RENOV. Y REUB. LINEA ADUC. R1 AL R2',
      '3321121101': 'EDIFICACIONES COSTO ALC - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3322111101': 'ALMACENES',
      '3331111101': 'MAQUINARIAS Y EQUIPO DE BOMBEO AGUA POTABLE',
      '3331111102': 'MEDIDORES',
      '3341111101': 'COSTO VEHICULOS MOTORIZADOS',
      '3341151101': 'VEHÍCULOS MOTORIZADOS COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3341152101': 'VEHÍCULOS MOTORIZADOS COSTO COMUNES - RECIBIDO EN DONACIÓN',
      '3351151101': 'MUEBLES COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3361151101': 'EQUIPOS INFORMÁTICOS COSTO COMUNES - ADQUIRIDO O CONSTRUÍDO CON RECURSOS PROPIOS',
      '3362181101': 'EQUIPO DE COMUNICACIÓN COSTO - ACTIVIDADES NO REGULADAS',
      '3391010101': 'OBRAS EN CURSO - INICIAL / GENERAL'
    };

    function getAccountName(code, fullCode, category) {
      if (keyDescriptions[code]) return keyDescriptions[code];
      if (keyDescriptions[fullCode]) return keyDescriptions[fullCode];
      
      if (digitMode === 3) {
        if (code.startsWith('33')) return generic3Digits[code] || `PROPIEDAD, PLANTA Y EQUIPO (${code})`;
        if (code.startsWith('68')) {
          const ref33 = '33' + code.charAt(2);
          return `VALUACIÓN DE ${generic3Digits[ref33] || 'PROPIEDAD, PLANTA Y EQUIPO'}`;
        }
      }
      if (code.startsWith('33')) {
        return category ? category.toUpperCase() : 'GENERAL';
      } else if (code.startsWith('68')) {
        return 'DEPRECIACIÓN ACUMULADA';
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
      const dep = Number(item.depreciacion_acumulada) || 0;

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

    let sumCost = 0;
    let sumDep = 0;

    filteredLedgerList.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      if (item.codigo.startsWith('33')) sumCost += item.monto;
      else if (item.codigo.startsWith('68')) sumDep += item.monto;

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

  function renderAsignacionTab() {
    const listActas = Object.keys(actasMap).sort((a, b) => b.localeCompare(a));
    const searchActaInput = document.getElementById('search-acta');
    const query = searchActaInput ? searchActaInput.value.trim().toLowerCase() : '';
    renderActasList(listActas, query);
  }

  function renderActasList(list, query = '') {
    const container = document.getElementById('actas-list');
    if (!container) return;
    container.innerHTML = '';

    const nextActaNro = getNextActaNumber();

    // 1. Mostrar la opción [NUEVA ACTA]
    if (!query || '[nueva acta]'.includes(query) || 'nueva'.includes(query) || nextActaNro.includes(query)) {
      const btnNueva = document.createElement('button');
      btnNueva.type = 'button';
      btnNueva.className = `w-full text-left p-2.5 rounded-lg text-xs font-semibold flex flex-col gap-1 transition-all border border-solid ${
        selectedActaKey === 'NUEVA' 
          ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' 
          : 'bg-white border-slate-100 text-slate-650 hover:bg-slate-50 hover:border-slate-200'
      } cursor-pointer mb-2`;
      btnNueva.innerHTML = `
        <div class="font-extrabold text-[0.8125rem] text-amber-600">✨ [NUEVA ACTA]</div>
        <div class="flex items-center justify-between gap-2 mt-0.5 text-slate-400">
          <span class="truncate font-medium text-[0.6875rem]">Crear Acta Siguiente</span>
          <span class="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">${nextActaNro}</span>
        </div>
      `;
      btnNueva.addEventListener('click', () => {
        selectedActaKey = 'NUEVA';
        renderActasList(list, query);
        selectActa('NUEVA');
      });
      container.appendChild(btnNueva);
    }

    // 2. Filtrar actas existentes
    const filtered = list.filter(acta => 
      acta.toLowerCase().includes(query)
    );

    if (filtered.length === 0 && selectedActaKey !== 'NUEVA') {
      container.innerHTML += '<div class="text-xs text-slate-400 text-center py-4">No se encontraron actas</div>';
      return;
    }

    filtered.forEach(acta => {
      const data = actasMap[acta];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left p-2.5 rounded-lg text-xs font-semibold flex flex-col gap-1 transition-all border border-solid ${
        selectedActaKey === acta 
          ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-sm' 
          : 'bg-white border-slate-100 text-slate-650 hover:bg-slate-50 hover:border-slate-200'
      } cursor-pointer`;
      
      btn.innerHTML = `
        <div class="font-extrabold text-[0.8125rem] truncate">Acta N° ${acta}</div>
        <div class="flex items-center justify-between gap-2 mt-0.5 text-slate-400">
          <span class="truncate font-medium text-[0.6875rem]">${data.responsable}</span>
          <span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">${data.bienes.length} bienes</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        selectedActaKey = acta;
        renderActasList(list, query);
        selectActa(acta);
      });

      container.appendChild(btn);
    });

    // Auto-seleccionar primera acta si no hay nada seleccionado
    if (!selectedActaKey) {
      if (filtered.length > 0) {
        selectedActaKey = filtered[0];
        selectActa(filtered[0]);
      } else {
        selectedActaKey = 'NUEVA';
        selectActa('NUEVA');
      }
      renderActasList(list, query);
    }
  }

  function selectActa(acta) {
    const wrapperNueva = document.getElementById('nueva-acta-responsable-wrapper');
    const selectResp = document.getElementById('nueva-acta-responsable');
    const inputNro = document.getElementById('acta-nro');
    const inputFecha = document.getElementById('acta-fecha');
    const inputSolicitante = document.getElementById('acta-solicitante');
    const tbody = document.getElementById('asignacion-tbody');

    tbody.innerHTML = '';
    if (inputSolicitante) inputSolicitante.value = '';

    if (acta === 'NUEVA') {
      if (wrapperNueva) wrapperNueva.classList.remove('hidden');
      
      document.getElementById('acta-usuario-nombre').textContent = '—';
      document.getElementById('acta-usuario-puesto').textContent = '—';
      document.getElementById('acta-usuario-sucursal').textContent = '—';

      const nextNro = getNextActaNumber();
      if (inputNro) {
        inputNro.value = nextNro;
        inputNro.readOnly = false; 
      }
      if (inputFecha) {
        inputFecha.value = new Date().toISOString().split('T')[0];
      }

      if (selectResp) {
        selectResp.innerHTML = '<option value="">-- Seleccione un trabajador --</option>';
        const listResps = Object.values(responsablesSinActaMap).sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        listResps.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.nombre;
          opt.textContent = `${r.nombre} (${r.bienes.length} bienes sin acta)`;
          selectResp.appendChild(opt);
        });

        selectResp.onchange = () => {
          const selectedRespName = selectResp.value;
          if (selectedRespName && responsablesSinActaMap[selectedRespName]) {
            const r = responsablesSinActaMap[selectedRespName];
            document.getElementById('acta-usuario-nombre').textContent = r.nombre;
            document.getElementById('acta-usuario-puesto').textContent = r.puesto;
            document.getElementById('acta-usuario-sucursal').textContent = r.sucursal;
            
            // Auto-populate Solicitante from first asset having requerido_por
            let defaultSolicitante = '';
            const foundReq = r.bienes.find(b => b.requerido_por && b.requerido_por.trim() && b.requerido_por !== '—');
            if (foundReq) {
              defaultSolicitante = foundReq.requerido_por;
            }
            if (inputSolicitante) inputSolicitante.value = defaultSolicitante;

            renderPreviewBienes(r.bienes);
          } else {
            document.getElementById('acta-usuario-nombre').textContent = '—';
            document.getElementById('acta-usuario-puesto').textContent = '—';
            document.getElementById('acta-usuario-sucursal').textContent = '—';
            if (inputSolicitante) inputSolicitante.value = '';
            tbody.innerHTML = '';
          }
        };
      }
    } else {
      if (wrapperNueva) wrapperNueva.classList.add('hidden');
      
      const data = actasMap[acta];
      if (!data) return;

      document.getElementById('acta-usuario-nombre').textContent = data.responsable;
      document.getElementById('acta-usuario-puesto').textContent = data.puesto;
      document.getElementById('acta-usuario-sucursal').textContent = data.sucursal;

      if (inputNro) {
        inputNro.value = data.n_acta;
        inputNro.readOnly = true; 
      }

      if (inputFecha) {
        let firstDate = null;
        data.bienes.forEach(b => {
          const d = b.fecha_asignacion || b.fecha_alta_factura || b.fecha_registro_contable;
          if (d && (!firstDate || d < firstDate)) {
            firstDate = d;
          }
        });
        inputFecha.value = firstDate ? firstDate.split('T')[0] : new Date().toISOString().split('T')[0];
      }

      // Auto-populate Solicitante from first asset having requerido_por
      let defaultSolicitante = '';
      const foundReq = data.bienes.find(b => b.requerido_por && b.requerido_por.trim() && b.requerido_por !== '—');
      if (foundReq) {
        defaultSolicitante = foundReq.requerido_por;
      }
      if (inputSolicitante) inputSolicitante.value = defaultSolicitante;

      renderPreviewBienes(data.bienes);
    }
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

    const inputNro = document.getElementById('acta-nro');
    const actaNroVal = inputNro ? inputNro.value.trim() : '015-2026';

    const inputSolicitante = document.getElementById('acta-solicitante');
    const solicitanteVal = (inputSolicitante && inputSolicitante.value.trim()) ? inputSolicitante.value.trim() : '—';

    if (selectedActaKey === 'NUEVA') {
      const selectResp = document.getElementById('nueva-acta-responsable');
      const selectedRespName = selectResp ? selectResp.value : '';
      if (!selectedRespName) {
        alert("Por favor seleccione un responsable para la nueva acta.");
        return;
      }
      const r = responsablesSinActaMap[selectedRespName];
      if (!r || r.bienes.length === 0) {
        alert("El responsable seleccionado no tiene bienes sin acta.");
        return;
      }
      respName = r.nombre;
      bienes = r.bienes;
      puesto = r.puesto;
      sucursal = r.sucursal;
    } else {
      const data = actasMap[selectedActaKey];
      if (!data || data.bienes.length === 0) {
        alert("El acta seleccionada no tiene bienes.");
        return;
      }
      respName = data.responsable;
      bienes = data.bienes;
      puesto = data.puesto;
      sucursal = data.sucursal;
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
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 16 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 30 },
        6: { cellWidth: 16 },
        7: { cellWidth: 18 },
        8: { cellWidth: 20 },
        9: { cellWidth: 22 },
        10: { cellWidth: 49 }
      };

      // Renderizar tabla principal
      doc.autoTable({
        head: headers,
        body: data,
        startY: 77, 
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: columnStyles,
        margin: { top: 77, bottom: 42 } 
      });

      const totalPages = doc.internal.getNumberOfPages();
      const signatureBlockY = 182;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // --- ENCABEZADO REPETITIVO ---
        // 1. Logo superior izquierdo
        if (logoImg) {
          doc.addImage(logoImg, 'PNG', 14, 6, 22, 11);
        }

        // 2. Información de Entidad
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);
        doc.text('E.P.S. "SELVA CENTRAL" S.A.', 38, 9);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text('CHANCHAMAYO - OXAPAMPA - SATIPO', 38, 11.5);
        doc.text('Pasaje San Pedro N° 253-257 La Merced Chyo.', 38, 14);
        doc.text('RUC: N° 20121876290 Telefono 064-532363', 38, 16.5);

        // 3. Título Centrado (Ubicado en el centro, debajo del logo/datos de la izquierda - Y=25, tamaño 16)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`ACTA Nº ${actaNroVal} – ASIGNACIÓN DE BIENES PATRIMONIALES`, 148.5, 25, { align: 'center' });
        
        // Subtítulo (Centrado, Y=32, tamaño 10)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("AUTORIZADO POR LA GERENCIA DE ADMINISTRACIÓN Y FINANZAS, JEFATURA DE PLANIFICACIÓN Y DESARROLLO EMPRESARIAL, JEFATURA DEL DEPARTAMENTO DE LOGÍSTICA Y CONTROL PATRIMONIAL.", 148.5, 32, { align: 'center' });

        // 4. Datos del Responsable y Solicitante (Y desplazado para espaciado de 7mm con respecto al subtítulo a Y=32)
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

        // FECHA DE ALTA (Alineada a la derecha)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const dateWidth = doc.getTextWidth(actaFechaFormateada);
        doc.text(actaFechaFormateada, 283, 39, { align: 'right' });
        
        doc.setFont("helvetica", "bold");
        doc.text("FECHA DE ALTA:", 283 - dateWidth - 2, 39, { align: 'right' });

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
        doc.text("RECIBÍ CONFORME", 50, yLine + 4, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.text("USUARIO RESPONSABLE", 50, yLine + 8, { align: 'center' });

        // Control Patrimonial (Texto "ING. JUAN EDER... RESPONSABLE..." eliminado porque ya viene en el sello)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text("ENTREGUÉ CONFORME", 130, yLine + 4, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.text("CONTROL PATRIMONIAL", 130, yLine + 8, { align: 'center' });

        // GAF
        doc.text("Vº Bº", 202.5, yLine + 4, { align: 'center' });
        doc.text("GAF", 202.5, yLine + 8, { align: 'center' });

        // Logística
        doc.text("Vº Bº", 257.5, yLine + 4, { align: 'center' });
        doc.text("LOGISTICA", 257.5, yLine + 8, { align: 'center' });

        // Sello Post Firma CP1 (Ubicado casi al ras de ENTREGUÉ CONFORME)
        if (selloImg) {
          doc.addImage(selloImg, 'PNG', 108, yLine - 20, 44, 20);
        }

        // 7. Número de Página
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 283, yLine + 8, { align: 'right' });
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
});
