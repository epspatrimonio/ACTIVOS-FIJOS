import React, { useState, useEffect, useMemo } from 'react';
import { Package, Trash2, Edit3, Download, FileText } from 'lucide-react';
import { deleteActivo } from '../utils/api';
import ExcelHeaderFilter from './ExcelHeaderFilter';

export default function ActivosTable({ activos, loading, error, onEdit, onDeleteSuccess, activeTab }) {
  const colSpanCount = activeTab === 'OBRAS' ? 14 : activeTab === 'INVENTARIO' ? 14 : 15;
  const tableMinWidth = activeTab === 'OBRAS' ? 'min-w-[1700px]' : 'min-w-[1850px]';
  const [colFilters, setColFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Reset filters only when data is reloaded (length changes)
  const activosCount = activos.length;
  useEffect(() => {
    setColFilters({});
    setSortConfig({ key: null, direction: null });
  }, [activosCount]);



  const generateFichaPDF = async (activo) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
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
    doc.text("Versión: 2026.1.1-Sinergia Digital-AMD", marginX, posY);
    
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
    doc.text(`${activo.cod_patrimonial}   ${activo.denominacion}`, marginX, posY);
    
    posY += 2;
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    
    const formatDateStr = (dateVal) => {
      if (!dateVal) return '—';
      const parts = dateVal.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateVal;
    };
    
    doc.setFont("helvetica", "bold"); doc.text("Fec Ingreso:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_registro_contable) || '—', marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Histórico:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Tipo ing:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("CO - Compra", 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Fec Alta:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_alta_factura) || '—', marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Libros:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_en_libros || 0).toFixed(2)}`, 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Docum:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("OC - Orden de Compra", 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Fec Entrega:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(formatDateStr(activo.fecha_asignacion) || '—', marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Tasación:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Nº Docum:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.n_doc || '—', 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Estado:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.estado_activo || '—', marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Residual:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text(`S/. ${Number(activo.valor_neto || 0).toFixed(2)}`, 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Seguro:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("Si", 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Proyecto:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text("—", marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Reposición:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Serie:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.numero_serie || '—', 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Principal:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text("Si", marginX + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Revaluado:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Vida util:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text(`${activo.vida_util_anios} Años`, 155 + 20, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Dep Inic:", 105, posY);
    doc.setFont("helvetica", "normal"); doc.text("0.00", 105 + 22, posY);
    
    doc.setFont("helvetica", "bold"); doc.text("Factor:", 155, posY);
    doc.setFont("helvetica", "normal"); doc.text("—", 155 + 20, posY);

    posY += 3;
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "bold"); doc.text("Localización:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.sucursal || '—', marginX + 22, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Responsable:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.responsable || '—', marginX + 22, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Cuenta:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.cuenta_contable || '—', marginX + 22, posY);
    
    posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("C.Costo:", marginX, posY);
    doc.setFont("helvetica", "normal"); doc.text(activo.centro_costo || '—', marginX + 22, posY);
    
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
    doc.setFont("helvetica", "normal"); doc.text(activo.documento_tipo || '—', 105 + 25, posY);
    
    posY += 3;
    doc.line(marginX, posY, 196, posY);
    
    posY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Historial de Depreciación:", marginX, posY);
    
    const depHeaders = [["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre", "Total"]];
    const depData = [["0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"]];
    
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
    if (activo.n_doc_compra) detParts.push(`O/C: ${activo.n_doc_compra}`);
    if (activo.nota_pedido) detParts.push(`NOTA DE PEDIDO: ${activo.nota_pedido}`);
    if (activo.certificacion_presupuestal) detParts.push(`CERTIFICACIÓN PRESUPUESTAL: ${activo.certificacion_presupuestal}`);
    if (activo.numero_factura) detParts.push(`FACTURA: ${activo.numero_factura}`);
    detParts.push(activo.denominacion);
    
    posY += 4;
    doc.setFont("helvetica", "normal");
    doc.text(detParts.join(" / "), marginX, posY, { maxWidth: 180 });
    
    const imagesToDraw = [];
    if (activo.imagen_1_path) imagesToDraw.push(activo.imagen_1_path);
    if (activo.imagen_2_path) imagesToDraw.push(activo.imagen_2_path);
    if (activo.imagen_3_path) imagesToDraw.push(activo.imagen_3_path);
    
    if (imagesToDraw.length > 0) {
      posY += 10;
      doc.line(marginX, posY, 196, posY);
      posY += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Imágenes del Activo:", marginX, posY);
      posY += 4;
      
      const loadImgAsBase64 = (url) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = url;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
          };
          img.onerror = () => resolve(null);
        });
      };
      
      const imgWidth = 55;
      const imgHeight = 40;
      const spacing = 6;
      
      for (let i = 0; i < imagesToDraw.length; i++) {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
        const uploadsBase = apiBase.replace('/api', '');
        const fullUrl = `${uploadsBase}${imagesToDraw[i]}`;
        const base64Data = await loadImgAsBase64(fullUrl);
        if (base64Data) {
          doc.addImage(base64Data, 'JPEG', marginX + i * (imgWidth + spacing), posY, imgWidth, imgHeight);
        }
      }
    }
    
    doc.save(`Ficha_Activo_${activo.cod_patrimonial}.pdf`);
  };

  const handleFilterChange = (columnKey, values) => {
    setColFilters(prev => ({
      ...prev,
      [columnKey]: values
    }));
  };

  const handleSortChange = (columnKey, direction) => {
    setSortConfig({ key: columnKey, direction });
  };

  const getColValue = (item, key) => {
    switch (key) {
      case 'cod_patrimonial': return item.cod_patrimonial || '';
      case 'n_doc': return item.n_doc ? (item.documento_tipo === 'COMPRA' ? `OC-${item.n_doc}` : item.documento_tipo === 'OBRA' ? `OC-${item.n_doc}` : `INC-${item.n_doc}`) : '';
      case 'fecha_ingreso': return item.fecha_alta_factura || '';
      case 'ubicacion': return `${item.sucursal || ''} / ${item.localidad || ''}`;
      case 'cuenta_contable': return item.cuenta_contable || '';
      case 'centro_costo': return item.centro_costo || '';
      case 'denominacion': return item.denominacion || '';
      case 'marca': return item.marca || '';
      case 'placa': return item.placa || '';
      case 'estado': return item.estado_activo || '';
      case 'valor_en_libros': return item.valor_en_libros || 0;
      case 'valor_neto': return (Number(item.valor_en_libros) || 0) - (Number(item.depreciacion_acumulada) || 0);
      case 'responsable': return item.responsable || '';
      case 'puesto': return item.puesto || '';
      case 'unidad': return item.unidad || '';
      default: return '';
    }
  };

  const filteredAndSortedActivos = useMemo(() => {
    let result = [...activos];

    // Apply column filters
    Object.keys(colFilters).forEach(key => {
      const selected = colFilters[key];
      if (selected && selected.length > 0) {
        result = result.filter(item => {
          const val = String(getColValue(item, key)).trim();
          return selected.includes(val);
        });
      }
    });

    // Apply sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = getColValue(a, sortConfig.key);
        const valB = getColValue(b, sortConfig.key);

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA);
        const strB = String(valB);
        const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [activos, colFilters, sortConfig]);

  const handleDelete = async (cod_patrimonial) => {
    if (window.confirm(`¿Está seguro de que desea eliminar el activo ${cod_patrimonial}?`)) {
      try {
        await deleteActivo(cod_patrimonial);
        if (onDeleteSuccess) onDeleteSuccess();
      } catch (err) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  const getEstadoBadge = (estado) => {
    const styles = {
      BUENO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REGULAR: 'bg-blue-50 text-blue-700 border-blue-200',
      MALO: 'bg-amber-50 text-amber-700 border-amber-200',
      'PARA BAJA': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      BAJA: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border ${styles[estado] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {estado}
      </span>
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(Number(value) || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Format as DD/MM/YYYY
      const day = String(date.getDate() + 1).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  if (error) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-rose-500 border-rose-200">
        <p className="font-semibold">Error al cargar la tabla</p>
        <p className="text-sm text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-slate-200 overflow-hidden w-full max-w-full h-full flex flex-col">
      {/* Contenedor de scroll con altura máxima para hacer efectiva la cabecera sticky */}
      <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
        <table className={`${tableMinWidth} w-full divide-y divide-slate-200 border-collapse`}>
          <thead className="sticky top-0 bg-slate-100 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            <tr>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Cód. Patrimonial"
                  columnKey="cod_patrimonial"
                  data={activos}
                  selectedValues={colFilters.cod_patrimonial}
                  onFilterChange={(vals) => handleFilterChange('cod_patrimonial', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'cod_patrimonial')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Documento N Doc"
                  columnKey="n_doc"
                  data={activos}
                  selectedValues={colFilters.n_doc}
                  onFilterChange={(vals) => handleFilterChange('n_doc', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'n_doc')}
                />
              </th>
              {activeTab === 'INVENTARIO' && (
                <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                  <ExcelHeaderFilter
                    title="Cuenta / C. Costo"
                    columnKey="cuenta_contable"
                    data={activos}
                    selectedValues={colFilters.cuenta_contable}
                    onFilterChange={(vals) => handleFilterChange('cuenta_contable', vals)}
                    currentSort={sortConfig}
                    onSortChange={handleSortChange}
                    getValue={(item) => getColValue(item, 'cuenta_contable')}
                  />
                </th>
              )}

              {activeTab === 'OBRAS' && (
                <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                  <ExcelHeaderFilter
                    title="Cuenta Contable"
                    columnKey="cuenta_contable"
                    data={activos}
                    selectedValues={colFilters.cuenta_contable}
                    onFilterChange={(vals) => handleFilterChange('cuenta_contable', vals)}
                    currentSort={sortConfig}
                    onSortChange={handleSortChange}
                    getValue={(item) => getColValue(item, 'cuenta_contable')}
                  />
                </th>
              )}

              {activeTab !== 'INVENTARIO' && activeTab !== 'OBRAS' && (
                <>
                  <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                    <ExcelHeaderFilter
                      title="Cuenta Contable"
                      columnKey="cuenta_contable"
                      data={activos}
                      selectedValues={colFilters.cuenta_contable}
                      onFilterChange={(vals) => handleFilterChange('cuenta_contable', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'cuenta_contable')}
                    />
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                    <ExcelHeaderFilter
                      title="Centro de Costo"
                      columnKey="centro_costo"
                      data={activos}
                      selectedValues={colFilters.centro_costo}
                      onFilterChange={(vals) => handleFilterChange('centro_costo', vals)}
                      currentSort={sortConfig}
                      onSortChange={handleSortChange}
                      getValue={(item) => getColValue(item, 'centro_costo')}
                    />
                  </th>
                </>
              )}
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Fecha de Ingreso"
                  columnKey="fecha_ingreso"
                  data={activos}
                  selectedValues={colFilters.fecha_ingreso}
                  onFilterChange={(vals) => handleFilterChange('fecha_ingreso', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => formatDate(getColValue(item, 'fecha_ingreso'))}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Ubicación (Sucursal / Localidad)"
                  columnKey="ubicacion"
                  data={activos}
                  selectedValues={colFilters.ubicacion}
                  onFilterChange={(vals) => handleFilterChange('ubicacion', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'ubicacion')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Denominación del Activo"
                  columnKey="denominacion"
                  data={activos}
                  selectedValues={colFilters.denominacion}
                  onFilterChange={(vals) => handleFilterChange('denominacion', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'denominacion')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Características"
                  columnKey="marca"
                  data={activos}
                  selectedValues={colFilters.marca}
                  onFilterChange={(vals) => handleFilterChange('marca', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'marca')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Especificaciones"
                  columnKey="placa"
                  data={activos}
                  selectedValues={colFilters.placa}
                  onFilterChange={(vals) => handleFilterChange('placa', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'placa')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Estado"
                  columnKey="estado"
                  data={activos}
                  selectedValues={colFilters.estado}
                  onFilterChange={(vals) => handleFilterChange('estado', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'estado')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Valor Libros"
                  columnKey="valor_en_libros"
                  data={activos}
                  selectedValues={colFilters.valor_en_libros}
                  onFilterChange={(vals) => handleFilterChange('valor_en_libros', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => String(getColValue(item, 'valor_en_libros'))}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Valor Neto"
                  columnKey="valor_neto"
                  data={activos}
                  selectedValues={colFilters.valor_neto}
                  onFilterChange={(vals) => handleFilterChange('valor_neto', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => String(getColValue(item, 'valor_neto'))}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">
                <ExcelHeaderFilter
                  title="Responsable"
                  columnKey="responsable"
                  data={activos}
                  selectedValues={colFilters.responsable}
                  onFilterChange={(vals) => handleFilterChange('responsable', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'responsable')}
                />
                <ExcelHeaderFilter
                  title="Puesto"
                  columnKey="puesto"
                  data={activos}
                  selectedValues={colFilters.puesto}
                  onFilterChange={(vals) => handleFilterChange('puesto', vals)}
                  currentSort={sortConfig}
                  onSortChange={handleSortChange}
                  getValue={(item) => getColValue(item, 'puesto')}
                />
              </th>
              <th scope="col" className="px-5 py-3 text-center text-[0.6875rem] font-extrabold text-slate-600 uppercase tracking-wide">Gestión</th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded-full w-24"></div></td>
                  
                  {activeTab === 'INVENTARIO' && (
                    <td className="px-5 py-4">
                      <div className="h-4 bg-slate-200 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-slate-150 rounded w-12"></div>
                    </td>
                  )}

                  {activeTab === 'OBRAS' && (
                    <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  )}

                  {activeTab !== 'INVENTARIO' && activeTab !== 'OBRAS' && (
                    <>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    </>
                  )}

                  <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
                  <td className="px-5 py-4">
                    <div className="h-4 bg-slate-200 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-slate-150 rounded w-24"></div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 bg-slate-200 rounded w-48 mb-1"></div>
                    <div className="h-3 bg-slate-150 rounded w-32"></div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-3 bg-slate-200 rounded w-28 mb-1"></div>
                    <div className="h-3 bg-slate-150 rounded w-20"></div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-3 bg-slate-200 rounded w-36 mb-1"></div>
                    <div className="h-3 bg-slate-150 rounded w-24"></div>
                  </td>
                  <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  <td className="px-5 py-4"><div className="h-6 bg-slate-200 rounded-full w-16"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded w-12 mx-auto"></div></td>
                </tr>
              ))
            ) : filteredAndSortedActivos.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="px-5 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Package className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-sm font-semibold">No se encontraron activos fijos</p>
                    <p className="text-xs text-slate-400 mt-1">Registra uno nuevo o cambia los filtros de búsqueda.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedActivos.map((activo) => (
                <tr key={activo.cod_patrimonial} className="table-row-hover text-slate-700">
                  {/* Código Patrimonial */}
                  <td className="px-5 py-4 whitespace-nowrap text-[0.875rem] font-mono font-bold text-slate-900">
                    {activo.cod_patrimonial}
                  </td>
                  
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs font-semibold text-brand-600 bg-brand-50/50 border border-brand-200 rounded-full">
                      {activo.n_doc ? (activo.documento_tipo === 'COMPRA' ? `OC-${activo.n_doc}` : activo.documento_tipo === 'OBRA' ? `OC-${activo.n_doc}` : `INC-${activo.n_doc}`) : '—'}
                    </span>
                  </td>

                  {/* Cuenta Contable / Centro Costo */}
                  {activeTab === 'INVENTARIO' && (
                    <td className="px-5 py-4 whitespace-nowrap text-xs font-mono text-slate-700">
                      <div className="font-semibold text-slate-800">{activo.cuenta_contable || '—'}</div>
                      <div className="text-slate-400 mt-0.5">{activo.centro_costo || '—'}</div>
                    </td>
                  )}

                  {activeTab === 'OBRAS' && (
                    <td className="px-5 py-4 whitespace-nowrap text-xs font-mono font-semibold text-slate-700">
                      {activo.cuenta_contable || '—'}
                    </td>
                  )}

                  {activeTab !== 'INVENTARIO' && activeTab !== 'OBRAS' && (
                    <>
                      <td className="px-5 py-4 whitespace-nowrap text-xs font-mono font-semibold text-slate-700">
                        {activo.cuenta_contable || '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs font-mono font-semibold text-slate-700">
                        {activo.centro_costo || '—'}
                      </td>
                    </>
                  )}
                  
                  {/* Fecha de Ingreso */}
                  <td className="px-5 py-4 whitespace-nowrap text-xs">
                    <p className="text-slate-700 font-semibold leading-none">
                      Alta: <span className="text-slate-500 font-normal">{formatDate(activo.fecha_alta_factura)}</span>
                    </p>
                    <p className="text-slate-700 font-semibold leading-none mt-1">
                      Asig: <span className="text-slate-500 font-normal">{formatDate(activo.fecha_asignacion)}</span>
                    </p>
                  </td>
                  
                  {/* Ubicación */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="font-bold text-slate-800 text-[0.8125rem]">
                      {activo.sucursal || '—'}
                    </div>
                    <div className="text-[0.6875rem] text-brand-600 font-bold uppercase tracking-wide mt-0.5">
                      {activo.localidad || '—'}
                    </div>
                  </td>
                  
                  {/* Denominación */}
                  <td className="px-5 py-4 min-w-[200px]">
                    <div className="text-[0.875rem] font-bold text-slate-900 leading-snug">
                      {activo.denominacion}
                    </div>
                    <div className="text-[0.6875rem] text-brand-600 font-bold mt-1 uppercase">
                      {activo.subcategoria || '—'}
                    </div>
                  </td>
                  
                  {/* Características */}
                  <td className="px-5 py-4 text-[0.8125rem] min-w-[180px] text-slate-600 leading-normal">
                    <div className="space-y-0.5">
                      <div><span className="font-semibold text-slate-400">Marca:</span> <span className="text-slate-850 font-medium">{activo.marca || 'S/M'}</span></div>
                      <div><span className="font-semibold text-slate-400">Modelo:</span> <span className="text-slate-850 font-medium">{activo.modelo || 'S/M'}</span></div>
                      <div><span className="font-semibold text-slate-400">Serie:</span> <span className="text-slate-850 font-mono font-medium">{activo.numero_serie || 'S/S'}</span></div>
                      {activo.color && <div><span className="font-semibold text-slate-400">Color:</span> <span className="text-slate-700">{activo.color}</span></div>}
                    </div>
                  </td>
                  
                  {/* Especificaciones */}
                  <td className="px-5 py-4 text-[0.8125rem] min-w-[200px] text-slate-500 leading-normal">
                    {(() => {
                      const isVehicle = (activo.categoria && activo.categoria.toLowerCase().startsWith('vehiculo')) ||
                                        (activo.cod_categoria && String(activo.cod_categoria).startsWith('4'));
                      if (isVehicle) {
                        return (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1.5 flex-wrap leading-none mb-1">
                              <span className="font-semibold text-slate-400">Placa:</span>
                              {activo.placa ? (
                                <span className="font-mono font-bold text-slate-700 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] tracking-wider whitespace-nowrap">
                                  {activo.placa}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs italic whitespace-nowrap">S/P</span>
                              )}
                            </p>
                            {activo.nro_motor && (
                              <div><span className="font-semibold text-slate-400 font-mono">Motor:</span> <span className="text-slate-700 font-mono">{activo.nro_motor}</span></div>
                            )}
                            {(activo.nro_chasis || activo.numero_serie) && (
                              <div><span className="font-semibold text-slate-400 font-mono">Chasis:</span> <span className="text-slate-700 font-mono">{activo.nro_chasis || activo.numero_serie}</span></div>
                            )}
                            {activo.combustible && (
                              <div className="mt-1"><span className="font-semibold text-slate-400">Combustible:</span> <span className="text-slate-650 bg-slate-100 px-1 py-0.5 rounded text-[10px] font-bold">{activo.combustible}</span></div>
                            )}
                          </div>
                        );
                      } else {
                        return activo.caracteristicas_accesorios ? (
                          <div className="text-xs text-slate-600 max-w-[200px] truncate" title={activo.caracteristicas_accesorios}>
                            {activo.caracteristicas_accesorios}
                          </div>
                        ) : <span className="text-slate-400 italic">—</span>;
                      }
                    })()}
                  </td>
                  
                  {/* Estado */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {getEstadoBadge(activo.estado_activo)}
                  </td>
                  
                  {/* Valor Libros */}
                  <td className="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-medium text-slate-500">
                    S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(Number(activo.valor_en_libros) || 0)}
                  </td>
                  
                  {/* Valor Neto */}
                  <td className="px-5 py-4 whitespace-nowrap text-[0.8125rem] font-bold text-emerald-600">
                    S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(Number(activo.valor_neto) || 0)}
                  </td>

                  {/* Responsable */}
                  <td className="px-5 py-4 min-w-[200px]">
                    <div className="text-[0.8125rem] font-bold text-slate-800 leading-snug">
                      {activo.responsable || '—'}
                    </div>
                    {activo.puesto && (
                      <div className="text-[0.6875rem] text-brand-600 font-bold mt-0.5 uppercase tracking-wide">
                        {activo.puesto}
                      </div>
                    )}
                    {activo.unidad && activo.unidad !== activo.puesto && (
                      <div className="text-[0.6875rem] text-slate-400 font-semibold mt-0.5 truncate max-w-[190px]" title={activo.unidad}>
                        {activo.unidad}
                      </div>
                    )}
                  </td>
                  
                  {/* Gestión */}
                  <td className="px-5 py-4 whitespace-nowrap text-center text-xs">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => generateFichaPDF(activo)}
                        title="Descargar Ficha del Activo"
                        className="h-8 w-8 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center justify-center shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {activo.pdf_expediente_path && (
                        <a
                          href={(() => {
                            const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
                            const uploadsBase = apiBase.replace('/api', '');
                            return `${uploadsBase}${activo.pdf_expediente_path}`;
                          })()}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver Expediente de Adquisición"
                          className="h-8 w-8 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 text-amber-600 hover:text-amber-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center justify-center shadow-sm"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => onEdit(activo)}
                        title="Editar Activo"
                        className="h-8 w-8 bg-brand-50 hover:bg-brand-100 border border-brand-200/50 text-brand-600 hover:text-brand-700 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center justify-center shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(activo.cod_patrimonial)}
                        title="Eliminar Activo"
                        className="h-8 w-8 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 text-rose-500 hover:text-rose-600 rounded-lg transition-all duration-200 active:scale-95 inline-flex items-center justify-center shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
