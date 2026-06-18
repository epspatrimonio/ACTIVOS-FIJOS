document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let celulares = [];
  let inventario = [];
  let terceros = [];
  let currentTab = 'activos'; // activos | vehiculos | celulares | inventario | terceros
  let currentFilteredData = [];
  
  // Elementos del DOM
  const searchInput = document.getElementById('search');
  const sucursalSelect = document.getElementById('filter-sucursal');
  const estadoSelect = document.getElementById('filter-estado');
  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');
  const mobileContainer = document.getElementById('assets-mobile-container');
  
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
      estadoSelect.addEventListener('change', applyFilters);

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
          } else {
            filtersContent.classList.add('hidden');
            filtersContent.classList.remove('flex');
            btnToggleFilters.innerHTML = '🔍 Mostrar Filtros';
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

  // Rellenar dinámicamente las sucursales y estados basados en el módulo seleccionado
  function populateFilters() {
    const previousSucursal = sucursalSelect.value;
    const previousEstado = estadoSelect.value;
    
    // Cambiar la etiqueta del filtro de Estado/Tipo dinámicamente
    const label = document.getElementById('filter-estado-label');
    const isTipo = currentTab === 'inventario' || currentTab === 'terceros';
    if (label) {
      label.textContent = isTipo ? 'Tipo' : 'Estado';
    }
    
    // Limpiar opciones manteniendo la primera por defecto
    sucursalSelect.innerHTML = '<option value="">Todas las Sucursales</option>';
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
    
    // Poblar Sucursales (solo si no es inventario ni terceros)
    if (!isTipo) {
      const sucursales = [...new Set(dataset.map(item => item.sucursal).filter(Boolean))];
      sucursales.sort().forEach(suc => {
        const option = document.createElement('option');
        option.value = suc;
        option.textContent = suc;
        if (suc === previousSucursal) {
          option.selected = true;
        }
        sucursalSelect.appendChild(option);
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

      // Mostrar/Ocultar el filtro de Sucursal
      const sucursalWrapper = document.getElementById('sucursal-filter-wrapper');
      if (sucursalWrapper) {
        if (currentTab === 'inventario' || currentTab === 'terceros') {
          sucursalWrapper.classList.add('hidden');
        } else {
          sucursalWrapper.classList.remove('hidden');
        }
      }

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
    const selectedEstado = estadoSelect.value;
    
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

      // Filtro de Estado
      const estadoMatch = !selectedEstado || 
        (currentTab === 'celulares' ? item.estado === selectedEstado : 
         ((currentTab === 'inventario' || currentTab === 'terceros') ? item.tipo === selectedEstado : item.estado_activo === selectedEstado));

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

      return sucursalMatch && estadoMatch && textMatch;
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
            ${item.imei || '—'}
          </div>
          <div class="text-[0.6875rem] text-brand-500 font-bold uppercase tracking-wide">
            ${item.operador || '—'}
          </div>
        </td>
        
        <!-- Número Línea -->
        <td class="px-5 py-4 whitespace-nowrap font-bold text-[0.8125rem] text-slate-800 font-mono">
          ${item.numero_linea || '—'}
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
        
        <!-- Fecha Ingreso -->
        <td class="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium font-mono">
          ${formatDate(item.fecha_ingreso)}
        </td>
        
        <!-- Asignado a -->
        <td class="px-5 py-4 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-[0.8125rem]">
            ${item.responsable || 'Sin asignar'}
          </div>
          <div class="text-[0.6875rem] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">
            ${item.puesto || '—'}
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
          <dd class="mt-0.5 font-semibold text-slate-700">${item.sucursal || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Localidad</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.localidad || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">IMEI</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono text-xs break-all">${item.imei || '—'}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-400">Fecha Ingreso</dt>
          <dd class="mt-0.5 font-semibold text-slate-700 font-mono">${formatDate(item.fecha_ingreso)}</dd>
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

      <dl class="mt-4 grid grid-cols-1 gap-y-3 text-[0.8125rem]">
        <div>
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

      <dl class="mt-4 grid grid-cols-1 gap-y-3 text-[0.8125rem]">
        <div>
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
        <div>
          <dt class="font-semibold text-slate-400">Responsable</dt>
          <dd class="mt-0.5 font-semibold text-slate-700">${item.responsable || 'Sin asignar'}</dd>
        </div>
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
      return '<span class="text-xs text-slate-400 italic">No requiere / Opcional</span>';
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
    const label = estado === 'VENCIDA' ? 'Vencida' : (estado === 'POR_RENOVAR' ? 'Por Renovar' : 'Vigente');
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
        "Marca": item.marca || "S/M",
        "Modelo": item.modelo || "S/M",
        "IMEI": item.imei || "",
        "N° Línea": item.numero_linea || "",
        "Operador": item.operador || "",
        "Sucursal": item.sucursal,
        "Localidad": item.localidad || "",
        "Puesto": item.puesto || "",
        "Responsable": item.responsable || "Sin Asignar",
        "Fecha Ingreso": item.fecha_ingreso || "",
        "Fecha Asignación": item.fecha_asignacion || "",
        "Fecha Renovación": item.fecha_renovacion || "",
        "Días para Renovar": item.dias_para_renovar !== undefined ? item.dias_para_renovar : "",
        "Estado Renovación": item.vida_util_estado || "",
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

      // 1. Agregar Imagen de Logo (Superior Izquierda)
      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 14, 8, 48, 14);
      }

      // 2. Fecha (Superior Derecha)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const today = new Date().toLocaleDateString('es-PE');
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
      let subtitle = "";
      if (currentTab === 'activos') subtitle = "Inventario de Activos Fijos";
      else if (currentTab === 'vehiculos') subtitle = "Inventario de Vehículos";
      else if (currentTab === 'celulares') subtitle = "Inventario de Celulares";
      else if (currentTab === 'inventario') subtitle = "Inventario Físico (Faltantes / Sobrantes)";
      else if (currentTab === 'terceros') subtitle = "Bienes de Terceros (Terceros / Control)";
      doc.text(subtitle, 148.5, 20, { align: 'center' });

      // Sucursal / Filtro Centrado
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      const selectedSucursal = currentTab === 'inventario' || currentTab === 'terceros' ? "N/A" : (sucursalSelect.value || "Todas las Sucursales");
      doc.text(`Filtro: ${selectedSucursal}`, 148.5, 25, { align: 'center' });

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
          item.vencimiento_rev_tec ? `${item.estado_rev_tec}\nVence: ${formatDate(item.vencimiento_rev_tec)}` : 'No Requiere',
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
            "Marca / Modelo",
            "IMEI / Operador",
            "N° Línea",
            "Ubicación",
            "Ingreso",
            "Asignado a",
            "Renovación (3 Años)",
            "Estado"
          ]
        ];
        data = currentFilteredData.map(item => [
          item.cod_control || '—',
          `${item.marca || 'S/M'}\n${item.modelo || 'S/M'}`,
          `${item.imei || '—'}\n${item.operador || '—'}`,
          item.numero_linea || '—',
          item.sucursal || '—',
          formatDate(item.fecha_ingreso),
          `${item.responsable || 'Sin asignar'}\n(${item.puesto || '—'})`,
          `${item.vida_util_estado}\nVence: ${item.fecha_renovacion ? formatDate(item.fecha_renovacion) : '—'}`,
          item.estado || 'ACTIVO'
        ]);
        columnStyles = {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 22 },
          6: { cellWidth: 43 },
          7: { cellWidth: 40 },
          8: { cellWidth: 20 }
        };
      } else if (currentTab === 'inventario') {
        headers = [
          [
            "Cód. Patrimonial",
            "Tipo",
            "Categoría / Subcat",
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
          item.denominacion || '',
          `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.caracteristicas_accesorios || '—',
          item.observaciones || '—',
          formatDate(item.created_at)
        ]);
        columnStyles = {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 35 },
          3: { cellWidth: 50 },
          4: { cellWidth: 40 },
          5: { cellWidth: 40 },
          6: { cellWidth: 40 },
          7: { cellWidth: 20 }
        };
      } else if (currentTab === 'terceros') {
        headers = [
          [
            "Cód. Patrimonial",
            "Tipo",
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
          item.denominacion || '',
          `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`,
          item.caracteristicas_accesorios || '—',
          item.responsable || "Sin Asignar",
          item.observaciones || '—',
          formatDate(item.created_at)
        ]);
        columnStyles = {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 55 },
          3: { cellWidth: 40 },
          4: { cellWidth: 40 },
          5: { cellWidth: 35 },
          6: { cellWidth: 35 },
          7: { cellWidth: 20 }
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
        margin: { bottom: 33 } // Asegura más espacio útil en cada página (el contenido puede llegar hasta Y=177)
      });

      // Posición fija Y del pie de página de firmas en la última hoja (ajustado lo más abajo posible)
      const signatureBlockY = 198;
      const safeTableMaxY = 158; // Deja al menos 18mm arriba del sello (que empieza en Y = 176)

      // Si la tabla termina más abajo de la zona segura de firmas, agregamos página
      if (doc.previousAutoTable.finalY > safeTableMaxY) {
        doc.addPage();
      }

      // 4. Firma y Sello Punteados (Parte Inferior Izquierda, posición fija)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text("----------------------------------------------------------------", 20, signatureBlockY);
      doc.text("Firma y Sello (Huella Digital)", 32, signatureBlockY + 4);

      // 5. Sello Post Firma CP1 (Parte Inferior Derecha, posición fija - desplazado a X=190 para no colisionar con nro de página)
      if (selloImg) {
        doc.addImage(selloImg, 'PNG', 190, signatureBlockY - 22, 56, 26);
      }

      // 6. Agregar Números de Página en el pie de página (Página X de Y)
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 283, 203, { align: 'right' });
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
