document.addEventListener('DOMContentLoaded', () => {
  let assets = [];
  let currentFilteredAssets = [];
  
  // Elementos del DOM
  const searchInput = document.getElementById('search');
  const sucursalSelect = document.getElementById('filter-sucursal');
  const estadoSelect = document.getElementById('filter-estado');
  const tableContainer = document.getElementById('assets-table-container');
  const mobileContainer = document.getElementById('assets-mobile-container');
  const tbodyContainer = document.getElementById('assets-tbody');
  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');
  
  const statusContainer = document.getElementById('status-container');
  const statusLoading = document.getElementById('status-loading');
  const statusError = document.getElementById('status-error');

  // Inicializar carga
  showLoading();
  loadData();

  async function loadData() {
    try {
      const response = await fetch('./activos.json');
      if (!response.ok) {
        throw new Error('No se pudo encontrar el archivo de sincronización.');
      }
      assets = await response.json();
      hideStatus();
      
      // Inicializar selectores dinámicos y renderizar
      populateSucursales();
      renderAssets(assets);
      
      // Adjuntar event listeners
      searchInput.addEventListener('input', applyFilters);
      sucursalSelect.addEventListener('change', applyFilters);
      estadoSelect.addEventListener('change', applyFilters);
      
    } catch (error) {
      showError();
    }
  }

  // Rellenar dinámicamente las sucursales basadas en los datos exportados
  function populateSucursales() {
    const sucursales = [...new Set(assets.map(a => a.sucursal).filter(Boolean))];
    sucursales.sort().forEach(suc => {
      const option = document.createElement('option');
      option.value = suc;
      option.textContent = suc;
      sucursalSelect.appendChild(option);
    });
  }

  // Filtrado del cliente
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedSucursal = sucursalSelect.value;
    const selectedEstado = estadoSelect.value;

    const filtered = assets.filter(item => {
      // Filtro de Texto
      const textMatch = !query || 
        (item.cod_patrimonial && item.cod_patrimonial.toLowerCase().includes(query)) ||
        (item.denominacion && item.denominacion.toLowerCase().includes(query)) ||
        (item.marca && item.marca.toLowerCase().includes(query)) ||
        (item.modelo && item.modelo.toLowerCase().includes(query)) ||
        (item.responsable && item.responsable.toLowerCase().includes(query)) ||
        (item.subcategoria && item.subcategoria.toLowerCase().includes(query));

      // Filtro de Sucursal
      const sucursalMatch = !selectedSucursal || item.sucursal === selectedSucursal;

      // Filtro de Estado
      const estadoMatch = !selectedEstado || item.estado_activo === selectedEstado;

      return textMatch && sucursalMatch && estadoMatch;
    });

    renderAssets(filtered);
  }

  // Helper para formatear fechas de manera consistente y sin desfase de zona horaria
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

  // Renderizar filas de activos en la tabla
  function renderAssets(data) {
    currentFilteredAssets = data;
    tbodyContainer.innerHTML = '';
    mobileContainer.innerHTML = '';
    resultsCount.textContent = `Encontrados: ${data.length}`;

    if (data.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    data.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 text-slate-700 transition-colors border-b border-slate-150';
      
      const valLibrosFormateado = formatMoney(item.valor_en_libros);

      // Valor Neto = Valor en Libros - Depreciación Acumulada (NIC 16)
      const valNetoFormateado = formatMoney(getNetValue(item));

      row.innerHTML = `
        <!-- Código Patrimonial -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-800">
          ${item.cod_patrimonial}
        </td>
        
        <!-- Documento N Doc -->
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-semibold text-brand-600 bg-brand-50/50 border border-brand-200 rounded-full">
            ${item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—'}
          </span>
        </td>
        
        <!-- Fecha de Ingreso -->
        <td class="px-5 py-4 whitespace-nowrap">
          <span class="px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full">
            ${formatDate(item.fecha_alta_factura || item.fecha_registro_contable)}
          </span>
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
          <div class="text-[0.6875rem] text-brand-500 font-bold mt-1 uppercase">
            ${item.subcategoria || '—'}
          </div>
        </td>
        
        <!-- Especificaciones -->
        <td class="px-5 py-4 text-[0.8125rem] min-w-[180px] text-slate-500 leading-relaxed">
          <div>
            <span class="font-medium text-slate-400">Marca:</span> ${item.marca || 'S/M'} &bull; <span class="font-medium text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}
          </div>
          <div class="mt-0.5">
            <span class="font-medium text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}
          </div>
          ${item.color ? `
            <div class="text-[0.75rem] italic text-slate-400 mt-0.5">
              Color: ${item.color}
            </div>
          ` : ''}
        </td>
        
        <!-- Estado -->
        <td class="px-5 py-4 whitespace-nowrap">
          ${getEstadoBadgeHTML(item.estado_activo)}
        </td>
        
        <!-- Valor Libros -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-medium text-slate-500">
          S/. ${valLibrosFormateado}
        </td>
        
        <!-- Valor Neto -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-bold text-emerald-600">
          S/. ${valNetoFormateado}
        </td>
        
        <!-- Responsable -->
        <td class="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-semibold text-slate-600">
          ${item.responsable || '—'}
        </td>
      `;
      tbodyContainer.appendChild(row);

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
          <div><span class="font-semibold text-slate-400">Marca:</span> ${item.marca || 'S/M'} · <span class="font-semibold text-slate-400">Modelo:</span> ${item.modelo || 'S/M'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Serie:</span> ${item.numero_serie || 'S/S'}</div>
          <div class="mt-1"><span class="font-semibold text-slate-400">Responsable:</span> ${item.responsable || 'Sin asignar'}</div>
        </div>
      `;
      mobileContainer.appendChild(mobileCard);
    });
  }

  // Estilos de badge
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

  // Manejo de Estados de UI
  function showLoading() {
    statusContainer.classList.remove('hidden');
    statusLoading.classList.remove('hidden');
    statusError.classList.add('hidden');
    tableContainer.classList.add('hidden');
    mobileContainer.classList.add('hidden');
  }

  function showError() {
    statusContainer.classList.remove('hidden');
    statusLoading.classList.add('hidden');
    statusError.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    mobileContainer.classList.add('hidden');
    resultsCount.textContent = 'Encontrados: 0';
  }

  function hideStatus() {
    statusContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    mobileContainer.classList.remove('hidden');
  }

  // ── Funciones de Exportación ──────────────────────────────────────────────

  function exportToExcel() {
    if (currentFilteredAssets.length === 0) {
      alert("No hay registros filtrados para exportar.");
      return;
    }

    // Mapear los datos de forma legible en español para el reporte Excel
    const exportData = currentFilteredAssets.map(item => ({
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
      "Valor Neto (S/.)": Math.max((Number(item.valor_en_libros) || 0) - (Number(item.depreciacion_acumulada) || 0), 0),
      "IGV (S/.)": Number(item.igv) || 0,
      "N° Acta Entrega": item.n_acta_entrega || "",
      "Responsable": item.responsable || "Sin Asignar"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activos");
    
    XLSX.writeFile(workbook, `Reporte_Activos_SelvaCentral_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportToPDF() {
    if (currentFilteredAssets.length === 0) {
      alert("No hay registros filtrados para exportar.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 176, 240); // Celeste #00B0F0
    doc.text("EPS SELVA CENTRAL S.A.", 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // Slate gris
    doc.text("Control Patrimonial - Catálogo de Activos Fijos Sincronizados", 14, 21);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-PE')}`, 14, 26);

    const headers = [
      [
        "Cód. Patrimonial",
        "N° Documento",
        "Fecha de Ingreso",
        "Ubicación (Sucursal / Localidad)",
        "Denominación del Activo",
        "Especificaciones",
        "Estado",
        "Valor Libros",
        "Valor Neto",
        "Responsable"
      ]
    ];

    const data = currentFilteredAssets.map(item => {
      const valLibrosFormateado = `S/. ${formatMoney(item.valor_en_libros)}`;
      const valNetoFormateado = `S/. ${formatMoney(getNetValue(item))}`;
      const docFormateado = item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '—';
      const fechaFormateada = formatDate(item.fecha_alta_factura || item.fecha_registro_contable);
      const ubicacionFormateada = `${item.sucursal || '—'}${item.localidad ? `\n(${item.localidad})` : ''}`;
      const denominacionFormateada = `${item.denominacion || ''}${item.subcategoria ? `\n› ${item.subcategoria}` : ''}`;
      const especificacionesFormateada = `Marca: ${item.marca || 'S/M'}\nModelo: ${item.modelo || 'S/M'}\nSerie: ${item.numero_serie || 'S/S'}${item.color ? `\nColor: ${item.color}` : ''}`;
      
      return [
        item.cod_patrimonial || '—',
        docFormateado,
        fechaFormateada,
        ubicacionFormateada,
        denominacionFormateada,
        especificacionesFormateada,
        item.estado_activo || '—',
        valLibrosFormateado,
        valNetoFormateado,
        item.responsable || "Sin Asignar"
      ];
    });

    doc.autoTable({
      head: headers,
      body: data,
      startY: 32,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.5, valign: 'middle' },
      headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 }, // Cód. Patrimonial
        1: { cellWidth: 22 }, // Documento N Doc
        2: { cellWidth: 20 }, // Fecha de Ingreso
        3: { cellWidth: 30 }, // Ubicación
        4: { cellWidth: 42 }, // Denominación
        5: { cellWidth: 43 }, // Especificaciones
        6: { cellWidth: 18 }, // Estado
        7: { cellWidth: 23, halign: 'right' },  // Valor Libros
        8: { cellWidth: 23, halign: 'right' },  // Valor Neto
        9: { cellWidth: 26 }  // Responsable
      }
    });

    doc.save(`Reporte_Activos_SelvaCentral_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Vincular eventos a botones
  document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
  document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);
});
