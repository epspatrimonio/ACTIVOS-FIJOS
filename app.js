document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let celulares = [];
  let inventario = [];
  let terceros = [];
  let currentTab = 'activos'; // activos | vehiculos | celulares | inventario | terceros
  let currentFilteredData = [];
  
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
      
      hideStatus();
      
      // Inicializar controladores de pestañas y filtros
      initTabs();
      populateFilters();
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
      dataset = assets;
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
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
      dataset = assets;
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
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
      dataset = assets;
      stateOptions = ['BUENO', 'REGULAR', 'MALO', 'PARA BAJA', 'BAJA'];
    } else if (currentTab === 'vehiculos') {
      dataset = getVehicles();
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
    
    // Poblar Sucursales sin formato Sucursal (Localidad)
    const sucursalNames = [...new Set(dataset.map(item => item.sucursal).filter(Boolean))];
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
      const localidades = [...new Set(dataset.map(item => item.localidad).filter(Boolean))];
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

    // Poblar filtros de categorías multiselección
    populateCategoryFilters();
  }

  // Inicialización de pestañas
  function initTabs() {
    const tabActivos = document.getElementById('tab-activos');
    const tabVehiculos = document.getElementById('tab-vehiculos');
    const tabCelulares = document.getElementById('tab-celulares');
    const tabInventario = document.getElementById('tab-inventario');
    const tabTerceros = document.getElementById('tab-terceros');
    const moduleTitle = document.getElementById('module-title');
    
    function switchTab(newTab) {
      currentTab = newTab;
      
      // Resetear filtros de categoría y subcategoría al cambiar de pestaña
      selectedCategories = [];
      selectedSubcategories = [];
      
      // Resetear clases de pestañas
      [tabActivos, tabVehiculos, tabCelulares, tabInventario, tabTerceros].forEach(btn => {
        if (btn) {
          btn.className = "flex-none sm:flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 whitespace-nowrap";
        }
      });
      
      let activeBtn;
      if (currentTab === 'activos') {
        activeBtn = tabActivos;
        moduleTitle.textContent = 'Catálogo de Activos Fijos';
      } else if (currentTab === 'vehiculos') {
        activeBtn = tabVehiculos;
        moduleTitle.textContent = 'Control Patrimonial de Vehículos';
      } else if (currentTab === 'celulares') {
        activeBtn = tabCelulares;
        moduleTitle.textContent = 'Control de Celulares y Líneas';
      } else if (currentTab === 'inventario') {
        activeBtn = tabInventario;
        moduleTitle.textContent = 'Inventario Físico (Faltantes / Sobrantes)';
      } else if (currentTab === 'terceros') {
        activeBtn = tabTerceros;
        moduleTitle.textContent = 'Control de Bienes de Terceros y Control';
      }
      
      if (activeBtn) {
        activeBtn.className = "flex-none sm:flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 bg-brand-500 text-white shadow-md shadow-brand-500/15 whitespace-nowrap";
      }

      // Mostrar/Ocultar el filtro de Sucursal y Localidad
      const sucursalWrapper = document.getElementById('sucursal-filter-wrapper');
      const localidadWrapper = document.getElementById('localidad-filter-wrapper');
      if (sucursalWrapper) {
        sucursalWrapper.classList.remove('hidden');
      }
      if (localidadWrapper) {
        localidadWrapper.classList.remove('hidden');
      }

      // Mostrar/Ocultar el filtro de Categoría y Subcategoría (sólo si aplica)
      const categoriaWrapper = document.getElementById('categoria-filter-wrapper');
      const subcategoriaWrapper = document.getElementById('subcategoria-filter-wrapper');
      const hasCategories = currentTab === 'activos' || currentTab === 'vehiculos' || currentTab === 'inventario';
      if (hasCategories) {
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

      searchWrapper.classList.remove('hidden');
      estadoWrapper.classList.remove('hidden');
      
      resultsCount.classList.remove('hidden');
      if (excelBtn) excelBtn.classList.remove('hidden');
      if (pdfBtn) pdfBtn.classList.remove('hidden');
    }
    
    if (tabActivos) tabActivos.addEventListener('click', () => switchTab('activos'));
    if (tabVehiculos) tabVehiculos.addEventListener('click', () => switchTab('vehiculos'));
    if (tabCelulares) tabCelulares.addEventListener('click', () => switchTab('celulares'));
    if (tabInventario) tabInventario.addEventListener('click', () => switchTab('inventario'));
    if (tabTerceros) tabTerceros.addEventListener('click', () => switchTab('terceros'));
  }

  // Filtrado del cliente
  function applyFilters() {
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
      baseData = assets;
    } else if (currentTab === 'vehiculos') {
      baseData = getVehicles();
    } else if (currentTab === 'celulares') {
      baseData = celulares;
    } else if (currentTab === 'inventario') {
      baseData = inventario;
    } else if (currentTab === 'terceros') {
      baseData = terceros;
    }

    const filtered = baseData.filter(item => {
      // Filtro de Sucursal
      const sucursalMatch = !selectedSucursal || item.sucursal === selectedSucursal;

      // Filtro de Localidad
      const localidadMatch = !selectedLocalidad || item.localidad === selectedLocalidad;

      // Filtro de Estado
      const estadoMatch = !selectedEstado || 
        (currentTab === 'celulares' ? item.estado === selectedEstado : 
         ((currentTab === 'inventario' || currentTab === 'terceros') ? item.tipo === selectedEstado : item.estado_activo === selectedEstado));

      // Filtro de Categoría y Subcategoría (si aplica)
      const hasCategories = currentTab === 'activos' || currentTab === 'vehiculos' || currentTab === 'inventario';
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
        } else if (currentTab === 'vehiculos') {
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
    document.getElementById('vehiculos-tbody').innerHTML = '';
    document.getElementById('celulares-tbody').innerHTML = '';
    document.getElementById('inventario-tbody').innerHTML = '';
    document.getElementById('terceros-tbody').innerHTML = '';
    mobileContainer.innerHTML = '';

    if (data.length === 0) {
      emptyState.classList.remove('hidden');
      document.getElementById('assets-table-container').classList.add('hidden');
      document.getElementById('vehiculos-table-container').classList.add('hidden');
      document.getElementById('celulares-table-container').classList.add('hidden');
      document.getElementById('inventario-table-container').classList.add('hidden');
      document.getElementById('terceros-table-container').classList.add('hidden');
      mobileContainer.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    // Manejo adaptativo Desktop vs Móvil
    if (window.innerWidth >= 768) {
      document.getElementById('assets-table-container').classList.add('hidden');
      document.getElementById('vehiculos-table-container').classList.add('hidden');
      document.getElementById('celulares-table-container').classList.add('hidden');
      document.getElementById('inventario-table-container').classList.add('hidden');
      document.getElementById('terceros-table-container').classList.add('hidden');
      
      const activeTableId = `${currentTab === 'activos' ? 'assets' : currentTab}-table-container`;
      document.getElementById(activeTableId).classList.remove('hidden');
      mobileContainer.classList.add('hidden');
    } else {
      document.getElementById('assets-table-container').classList.add('hidden');
      document.getElementById('vehiculos-table-container').classList.add('hidden');
      document.getElementById('celulares-table-container').classList.add('hidden');
      document.getElementById('inventario-table-container').classList.add('hidden');
      document.getElementById('terceros-table-container').classList.add('hidden');
      mobileContainer.classList.remove('hidden');
    }

    // Inyectar datos específicos
    if (currentTab === 'activos') {
      renderActivosRows(data);
    } else if (currentTab === 'vehiculos') {
      renderVehiculosRows(data);
    } else if (currentTab === 'celulares') {
      renderCelularesRows(data);
    } else if (currentTab === 'inventario') {
      renderInventarioRows(data);
    } else if (currentTab === 'terceros') {
      renderTercerosRows(data);
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
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
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
          <dd class="mt-0.5 font-semibold text-slate-700">${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}</dd>
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
        "Documento": item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : "",
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
          item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—',
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
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 20 },
          3: { cellWidth: 30 },
          4: { cellWidth: 42 },
          5: { cellWidth: 43 },
          6: { cellWidth: 18 },
          7: { cellWidth: 23, halign: 'right' },
          8: { cellWidth: 23, halign: 'right' },
          9: { cellWidth: 26 }
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
      else if (currentTab === 'vehiculos') subtitle = "Inventario de Vehículos";
      else if (currentTab === 'celulares') subtitle = "Inventario de Celulares";
      else if (currentTab === 'inventario') subtitle = "Inventario Físico (Faltantes / Sobrantes)";
      else if (currentTab === 'terceros') subtitle = "Bienes de Terceros (Terceros / Control)";

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
});
