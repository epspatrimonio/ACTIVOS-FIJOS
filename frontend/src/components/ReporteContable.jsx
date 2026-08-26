import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, FileText, Calendar, Filter, Layers, Calculator, ShieldCheck, MapPin } from 'lucide-react';
import { fetchCuentasContables, fetchLocalidades } from '../utils/api';
import { generateStandardPDF } from '../utils/pdfExportHelper';

export default function ReporteContable({ assets = [], loading: assetsLoading = false, error: assetsError = null }) {
  const [digitMode, setDigitMode] = useState(10); // 3 | 10
  const [selectedYear, setSelectedYear] = useState('Todos');
  const [selectedMonth, setSelectedMonth] = useState('Todos');
  const [selectedType, setSelectedType] = useState('Todos'); // 'Todos' | 'ACTIVO' | 'DEPRECIACION' | 'OBRAS_EN_CURSO'
  const [selectedLocalidad, setSelectedLocalidad] = useState('Todos');
  const [cuentasMap, setCuentasMap] = useState({});
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [apiLocalidades, setApiLocalidades] = useState([]);

  // Cargar catálogo de cuentas contables y lista de localidades
  useEffect(() => {
    async function loadInitialData() {
      setLoadingCuentas(true);
      try {
        const [dataCuentas, dataLocalidades] = await Promise.all([
          fetchCuentasContables().catch(() => []),
          fetchLocalidades().catch(() => [])
        ]);
        
        const mapping = {};
        dataCuentas.forEach(item => {
          mapping[item.cuenta_contable] = item.descripcion || item.nombre;
        });
        setCuentasMap(mapping);
        setApiLocalidades(dataLocalidades);
      } catch (err) {
        console.error('Error al cargar datos iniciales en ReporteContable:', err);
      } finally {
        setLoadingCuentas(false);
      }
    }
    loadInitialData();
  }, []);

  // Consolidar lista de localidades combinando API y activos recibidos
  const localidadesOptions = useMemo(() => {
    const setLoc = new Set();
    apiLocalidades.forEach(l => {
      if (l.label) setLoc.add(l.label.trim().toUpperCase());
    });
    assets.forEach(a => {
      if (a.localidad && a.localidad.trim()) {
        setLoc.add(a.localidad.trim().toUpperCase());
      }
    });
    return Array.from(setLoc).sort();
  }, [apiLocalidades, assets]);

  // Generar lista de años únicos a partir de las fechas de alta o registro
  const getAvailableYears = () => {
    const years = new Set();
    assets.forEach(item => {
      const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (year && !isNaN(year)) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const years = getAvailableYears();
  const months = [
    { value: 'Todos', label: 'Todos los Meses' },
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  // Helper para obtener nombres de cuenta aproximados/precisos
  const getAccountName = (code, fullCode, category) => {
    if (cuentasMap[code]) return cuentasMap[code];
    if (cuentasMap[fullCode]) return cuentasMap[fullCode];

    // Mapeo genérico por defecto para 3 dígitos
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

    if (digitMode === 3) {
      if (code.startsWith('33')) return generic3Digits[code] || `PROPIEDAD, PLANTA Y EQUIPO (${code})`;
      if (code.startsWith('68')) {
        const ref33 = '33' + code.charAt(2);
        return `VALUACIÓN DE ${generic3Digits[ref33] || 'PROPIEDAD, PLANTA Y EQUIPO'}`;
      }
    }

    // Para 10 dígitos fallback
    if (code.startsWith('33')) {
      return category ? category.toUpperCase() : 'GENERAL';
    } else if (code.startsWith('68')) {
      return 'DEPRECIACIÓN ACUMULADA';
    }
    return 'CUENTA CONTABLE COMPLEMENTARIA';
  };

  // Cálculo dinámico de depreciación por activo
  const getAssetDepreciacion = (item) => {
    const cost = Number(item.valor_en_libros) || 0;
    if (cost <= 0) return 0;

    const cc = item.cuenta_contable || '';
    if (cc.startsWith('331') || cc.startsWith('339')) return 0;

    const lifeYears = Number(item.vida_util_anios) || 0;
    const startStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable;
    const storedDep = Number(item.depreciacion_acumulada) || 0;

    // Si hay un valor estático almacenado > 0 y NO se está evaluando un periodo específico, usarlo
    if (storedDep > 0 && selectedYear === 'Todos' && selectedMonth === 'Todos') {
      return storedDep;
    }

    // Calcular depreciación acumulada dinámica según fecha de alta
    if (lifeYears > 0 && startStr) {
      const startDate = new Date(startStr);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;

      const now = new Date();
      const evalYear = selectedYear !== 'Todos' ? Number(selectedYear) : now.getFullYear();
      const evalMonth = selectedMonth !== 'Todos' ? Number(selectedMonth) : 12;

      const totalLifeMonths = lifeYears * 12;
      const monthlyRate = cost / totalLifeMonths;
      const elapsedMonths = (evalYear - startYear) * 12 + (evalMonth - startMonth) + 1;

      if (elapsedMonths <= 0) return 0;
      if (elapsedMonths >= totalLifeMonths) return cost;
      return Math.min(cost, monthlyRate * elapsedMonths);
    }

    return storedDep;
  };

  // Filtrado y procesamiento de saldos contables
  const processLedger = () => {
    const ledger = {};

    assets.forEach(item => {
      const cc = item.cuenta_contable || '';
      if (!cc || cc === '0000000000' || cc.startsWith('0')) {
        // Skip dummy/non-existent accounts
        return;
      }
      if (cc.startsWith('339')) {
        // Skip Obras en curso completely from the Reporte Contable
        return;
      }

      // 1. Filtrado por localidad
      if (selectedLocalidad !== 'Todos') {
        const itemLoc = (item.localidad || '').trim().toUpperCase();
        if (itemLoc !== selectedLocalidad.trim().toUpperCase()) return;
      }

      // 2. Filtrado por período
      const dateStr = item.fecha_alta_factura || item.fecha_alta || item.fecha_registro_contable;
      if (!dateStr && (selectedYear !== 'Todos' || selectedMonth !== 'Todos')) return;

      if (dateStr) {
        const date = new Date(dateStr);
        const y = date.getFullYear();
        const m = date.getMonth() + 1;

        if (selectedYear !== 'Todos' && y !== Number(selectedYear)) return;
        if (selectedMonth !== 'Todos' && m !== Number(selectedMonth)) return;
      }

      const cost = Number(item.valor_en_libros) || 0;
      const dep = getAssetDepreciacion(item);

      // Definir códigos de costo (33) y depreciación (68) según modo
      let costKey = cc;
      let depKey = cc.startsWith('33') ? '68' + cc.slice(2) : '68' + cc;

      if (digitMode === 3) {
        costKey = cc.slice(0, 3);
        depKey = cc.startsWith('33') ? '68' + cc.charAt(2) : '68' + cc.slice(0, 1);
      }

      // Sumar al activo (33)
      if (!ledger[costKey]) {
        ledger[costKey] = {
          codigo: costKey,
          descripcion: getAccountName(costKey, cc, item.categoria),
          tipo: 'ACTIVO',
          monto: 0
        };
      }
      ledger[costKey].monto += cost;

      // Sumar a la depreciación (68) - Terrenos (331) no se deprecian
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

    // Convertir a lista y ordenar por código contable
    return Object.values(ledger).sort((a, b) => a.codigo.localeCompare(b.codigo));
  };

  const allLedgerData = processLedger();

  // Sumas de resumen globales (sin ser afectadas por el filtro de tabla TIPO DE ELEMENTO)
  const totalCosto = allLedgerData
    .filter(x => x.codigo.startsWith('33'))
    .reduce((sum, item) => sum + item.monto, 0);

  const totalDepreciacion = allLedgerData
    .filter(x => x.codigo.startsWith('68'))
    .reduce((sum, item) => sum + item.monto, 0);

  const valorNeto = totalCosto - totalDepreciacion;

  // Filtrar filas para la tabla según TIPO DE ELEMENTO
  const ledgerData = allLedgerData.filter(item => {
    if (selectedType === 'Todos') return true;
    if (selectedType === 'ACTIVO') return item.tipo === 'ACTIVO';
    if (selectedType === 'DEPRECIACION') return item.tipo === 'DEPRECIACIÓN';
    return true;
  });

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(value);
  };

  // EXPORTAR A EXCEL
  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert('La librería SheetJS no está cargada.');
      return;
    }
    const XLSX = window.XLSX;
    
    // Mapear datos para la hoja
    const sheetData = ledgerData.map(item => ({
      "Código Contable": item.codigo,
      "Descripción de la Cuenta": item.descripcion,
      "Clase / Elemento": item.tipo,
      "Saldo Total (S/.)": Number(item.monto.toFixed(4))
    }));

    // Agregar fila de totales al final
    sheetData.push({});
    sheetData.push({
      "Código Contable": "TOTAL COSTO (33)",
      "Saldo Total (S/.)": Number(totalCosto.toFixed(4))
    });
    sheetData.push({
      "Código Contable": "TOTAL DEPRECIACIÓN (68)",
      "Saldo Total (S/.)": Number(totalDepreciacion.toFixed(4))
    });
    sheetData.push({
      "Código Contable": "VALOR RESIDUAL NETO",
      "Saldo Total (S/.)": Number(valorNeto.toFixed(4))
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Contable");
    
    const locTag = selectedLocalidad !== 'Todos' ? `_Localidad_${selectedLocalidad}` : '';
    // Guardar archivo
    XLSX.writeFile(wb, `Reporte_Contable_${digitMode}D_Periodo_${selectedYear}_${selectedMonth}${locTag}.xlsx`);
  };

  // EXPORTAR A PDF
  const handleExportPDF = async () => {
    const monthName = selectedMonth === 'Todos' ? 'Todos' : months.find(m => m.value === selectedMonth)?.label;
    const headers = [["Código", "Descripción de la Cuenta Contable", "Tipo de Elemento", "Saldo (S/.)"]];
    const data = ledgerData.map(item => [
      item.codigo,
      item.descripcion,
      item.tipo,
      formatMoney(item.monto)
    ]);

    // Agregar fila de resumen final
    data.push(["", "", "", ""]);
    data.push(["33", "TOTAL COSTO HISTÓRICO", "ACTIVOS", formatMoney(totalCosto)]);
    data.push(["68", "TOTAL DEPRECIACIÓN ACUMULADA", "DETERIORO", formatMoney(totalDepreciacion)]);
    data.push(["NETO", "VALOR RESIDUAL NETO CONTABLE", "RESIDUAL", formatMoney(valorNeto)]);

    const columnStyles = {
      0: { cellWidth: 25 },
      1: { cellWidth: 90 },
      2: { cellWidth: 45 },
      3: { cellWidth: 30, halign: 'right' }
    };

    const locSubtitle = selectedLocalidad !== 'Todos' ? ` | LOCALIDAD: ${selectedLocalidad}` : '';

    await generateStandardPDF({
      title: "CONTROL PATRIMONIAL",
      subtitle: `REPORTE CONTABLE AGRUPADO (${digitMode} DÍGITOS) - AÑO: ${selectedYear} | MES: ${monthName}${locSubtitle}`,
      headers: headers,
      data: data,
      columnStyles: columnStyles,
      filename: `Reporte_Contable_${digitMode}D_${selectedYear}.pdf`,
      orientation: "portrait"
    });
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn">
      
      {/* Título de Encabezado */}
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between shrink-0 mb-2">
        <div className="module-heading">
          <p className="module-kicker">Plan Contable General Empresarial (Perú)</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">REPORTE CONTABLE DE ACTIVOS</h2>
          <p className="text-sm text-slate-500">
            Consolidado de Costo de Adquisición (Clase 33) y Depreciación Acumulada (Clase 68) agrupado por dígitos de cuenta.
          </p>
        </div>
      </div>

      {/* Panel de Filtros y Configuración */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-end">
          
          {/* Selector de Dígitos */}
          <div>
            <label className="block text-[0.6875rem] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>Nivel de Cuenta</span>
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-10 items-center">
              <button
                type="button"
                onClick={() => setDigitMode(3)}
                title="3 Dígitos (Mayor)"
                className={`flex-1 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                  digitMode === 3 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                3 Dígitos
              </button>
              <button
                type="button"
                onClick={() => setDigitMode(10)}
                title="10 Dígitos (Sub-cuenta)"
                className={`flex-1 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                  digitMode === 10 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                10 Dígitos
              </button>
            </div>
          </div>

          {/* Selector de Tipo de Elemento */}
          <div>
            <label className="block text-[0.6875rem] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Filter className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>Tipo de Elemento</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full h-10 rounded-xl border border-slate-200 px-3 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer truncate"
            >
              <option value="Todos">Todos los elementos</option>
              <option value="ACTIVO">Activo Fijo</option>
              <option value="DEPRECIACION">Depreciación</option>
            </select>
          </div>

          {/* Selector de Localidad */}
          <div>
            <label className="block text-[0.6875rem] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>Localidad</span>
            </label>
            <select
              value={selectedLocalidad}
              onChange={(e) => setSelectedLocalidad(e.target.value)}
              className="block w-full h-10 rounded-xl border border-slate-200 px-3 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer truncate"
            >
              <option value="Todos">Todas las localidades</option>
              {localidadesOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Selector de Año */}
          <div>
            <label className="block text-[0.6875rem] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>Año de Registro</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="block w-full h-10 rounded-xl border border-slate-200 px-3 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer truncate"
            >
              <option value="Todos">Todos los años</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Selector de Mes */}
          <div>
            <label className="block text-[0.6875rem] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>Mes de Registro</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'Todos' ? 'Todos' : Number(e.target.value))}
              className="block w-full h-10 rounded-xl border border-slate-200 px-3 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer truncate"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Botones de Descarga */}
          <div className="flex gap-2 justify-end h-10">
            <button
              onClick={handleExportExcel}
              className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-[#00b074] hover:bg-[#009b66] text-white font-extrabold px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-[#ff3b5c] hover:bg-[#e02e4d] text-white font-extrabold px-3.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>PDF</span>
            </button>
          </div>

        </div>
      </div>

      {/* KPI Cards del Balance Contable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Costo Histórico (Clase 33)</span>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatMoney(totalCosto)}</p>
          </div>
          <div className="p-3 bg-brand-50 rounded-xl text-[#00509d]">
            <Calculator className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Depreciación Acumulada (Clase 68)</span>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatMoney(totalDepreciacion)}</p>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <Calculator className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Valor Residual Neto Contable</span>
            <p className="text-2xl font-extrabold text-emerald-700 tracking-tight mt-1">{formatMoney(valorNeto)}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabla del Balance de Saldos */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {assetsLoading || loadingCuentas ? (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : null}

        <div className="glass-panel rounded-xl border border-slate-200 overflow-hidden w-full max-w-full h-full flex flex-col">
          <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
            <table className="min-w-[800px] w-full divide-y divide-slate-200 border-collapse">
              <thead className="sticky top-0 bg-[#004C96] text-white z-10 shadow-md">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left text-[0.72rem] font-bold text-white uppercase tracking-wider w-28">Código PCGE</th>
                  <th scope="col" className="px-5 py-3 text-left text-[0.72rem] font-bold text-white uppercase tracking-wider">Descripción de la Cuenta Contable</th>
                  <th scope="col" className="px-5 py-3 text-left text-[0.72rem] font-bold text-white uppercase tracking-wider w-48">Tipo de Elemento</th>
                  <th scope="col" className="px-5 py-3 text-right text-[0.72rem] font-bold text-white uppercase tracking-wider w-40">Saldo Total</th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-slate-100">
                {ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-10 text-center text-slate-400 text-sm">
                      No se encontraron saldos registrados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-xs font-bold text-slate-700 font-mono">
                        {item.codigo}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-800 font-medium">
                        {item.descripcion}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.tipo === 'ACTIVO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.tipo === 'OBRAS EN CURSO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono font-bold text-right text-slate-900">
                        {formatMoney(item.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
