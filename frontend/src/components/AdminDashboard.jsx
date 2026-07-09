import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, CheckCircle2, 
  AlertCircle, Smartphone, Car, FolderSearch, Coins, ClipboardList, Clock, Calendar
} from 'lucide-react';
import { fetchActivos, fetchCelulares, fetchSoat } from '../utils/api';

export default function AdminDashboard() {
  const [subTab, setSubTab] = useState('ACTIVOS'); // ACTIVOS | DEPRECIACION | OBRAS | CELULARES | VEHICULOS | SOAT | CUENTAS_Y_CATEGORIAS
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [celulares, setCelulares] = useState([]);
  const [soatList, setSoatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros de período
  const [selectedYear, setSelectedYear] = useState('Todos');
  const [selectedMonth, setSelectedMonth] = useState('Todos');

  // Chart refs (5 charts for ACTIVOS tab)
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const chartRef3 = useRef(null);
  const chartRef4 = useRef(null);
  const chartRef5 = useRef(null);

  // Chart instances
  const chartInstance1 = useRef(null);
  const chartInstance2 = useRef(null);
  const chartInstance3 = useRef(null);
  const chartInstance4 = useRef(null);
  const chartInstance5 = useRef(null);

  // Fetch all data once on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [assetsData, celularesData, soatData] = await Promise.all([
          fetchActivos(),
          fetchCelulares(),
          fetchSoat()
        ]);
        setAssets(assetsData);
        setCelulares(celularesData);
        setSoatList(soatData);
      } catch (err) {
        console.error(err);
        setError('Error al obtener datos para el dashboard.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Generar años disponibles
  const getAvailableYears = () => {
    const years = new Set();
    assets.forEach(item => {
      const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear();
        if (y && !isNaN(y)) {
          years.add(y);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const years = getAvailableYears();

  // Filtrar activos por el período seleccionado
  useEffect(() => {
    let result = assets;
    if (selectedYear !== 'Todos') {
      result = result.filter(item => {
        const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
        if (!dateStr) return false;
        return new Date(dateStr).getFullYear() === Number(selectedYear);
      });
    }
    if (selectedMonth !== 'Todos') {
      result = result.filter(item => {
        const dateStr = item.fecha_alta_factura || item.fecha_registro_contable;
        if (!dateStr) return false;
        return (new Date(dateStr).getMonth() + 1) === Number(selectedMonth);
      });
    }
    setFilteredAssets(result);
  }, [assets, selectedYear, selectedMonth]);

  // Filter helper for vehicles (using filtered assets to react to period)
  const getVehicles = () => {
    return filteredAssets.filter(item => 
      (item.placa && item.placa !== '') || 
      (item.cod_categoria && String(item.cod_categoria).startsWith('4'))
    );
  };

  // Format money helper
  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(Number(value) || 0);
  };

  const getNetValue = (item) => {
    return Math.max(
      (Number(item.valor_en_libros) || 0) - (Number(item.depreciacion_acumulada) || 0),
      0
    );
  };

  // Re-render charts whenever subTab, selected periods or data changes
  useEffect(() => {
    if (loading || error || !window.Chart) return;

    // Helper to destroy old charts
    const destroyCharts = () => {
      [chartInstance1, chartInstance2, chartInstance3, chartInstance4, chartInstance5].forEach(ref => {
        if (ref.current) { ref.current.destroy(); ref.current = null; }
      });
    };

    destroyCharts();

    const Chart = window.Chart;

    if (subTab === 'ACTIVOS') {
      // Solo activos fijos (excluir obras en curso: cod 339%)
      const af = filteredAssets.filter(a => !a.cod_patrimonial?.startsWith('339'));

      // 1. Estado Físico (Doughnut)
      const countsEstado = { 'BUENO': 0, 'REGULAR': 0, 'MALO': 0, 'PARA BAJA': 0, 'BAJA': 0 };
      af.forEach(item => {
        const est = (item.estado_activo || '').toUpperCase().trim();
        if (countsEstado[est] !== undefined) countsEstado[est]++;
      });
      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Bueno', 'Regular', 'Malo', 'Para Baja', 'Baja'],
            datasets: [{ data: [countsEstado['BUENO'], countsEstado['REGULAR'], countsEstado['MALO'], countsEstado['PARA BAJA'], countsEstado['BAJA']], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#eab308', '#ef4444'], borderWidth: 2, borderColor: '#ffffff' }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, weight: '600' }, color: '#475569' } } }, cutout: '65%' }
        });
      }

      // 2. Por Sucursal — cantidad (Horizontal Bar)
      const countsSucursal = {};
      af.forEach(item => { const k = item.sucursal || 'Sin sucursal'; countsSucursal[k] = (countsSucursal[k] || 0) + 1; });
      const sortedSucursal = Object.entries(countsSucursal).sort((a, b) => b[1] - a[1]);
      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: sortedSucursal.map(e => e[0]),
            datasets: [{ label: 'N° Bienes', data: sortedSucursal.map(e => e[1]), backgroundColor: '#00B0F0', borderRadius: 6, borderWidth: 0 }]
          },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' }, color: '#475569' } } } }
        });
      }

      // 3. Por Localidad — valor en libros (Horizontal Bar)
      const montoLocalidad = {};
      af.forEach(item => { const k = item.localidad || 'Sin localidad'; montoLocalidad[k] = (montoLocalidad[k] || 0) + (Number(item.valor_en_libros) || 0); });
      const sortedLocalidadMonto = Object.entries(montoLocalidad).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (chartRef3.current) {
        chartInstance3.current = new Chart(chartRef3.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: sortedLocalidadMonto.map(e => e[0]),
            datasets: [{ label: 'S/.', data: sortedLocalidadMonto.map(e => e[1]), backgroundColor: '#6366f1', borderRadius: 6, borderWidth: 0 }]
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'S/. ' + ctx.raw.toLocaleString('es-PE', { minimumFractionDigits: 2 }) } } },
            scales: { x: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', callback: v => 'S/.' + (v/1000).toFixed(0) + 'k' } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' }, color: '#475569' } } }
          }
        });
      }

      // 4. Por Categoría — cantidad (Bar vertical)
      const countsCat = {};
      af.forEach(item => { const k = item.categoria || 'Sin categoría'; countsCat[k] = (countsCat[k] || 0) + 1; });
      const sortedCat = Object.entries(countsCat).sort((a, b) => b[1] - a[1]);
      if (chartRef4.current) {
        chartInstance4.current = new Chart(chartRef4.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: sortedCat.map(e => e[0]),
            datasets: [{ label: 'N° Bienes', data: sortedCat.map(e => e[1]), backgroundColor: '#10b981', borderRadius: 6, borderWidth: 0 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' }, color: '#475569', maxRotation: 30 } }, y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } } } }
        });
      }

      // 5. Por Subcategoría — Top 12 cantidad (Horizontal Bar)
      const countsSub = {};
      af.forEach(item => { const k = item.subcategoria || 'Sin subcategoría'; countsSub[k] = (countsSub[k] || 0) + 1; });
      const sortedSub = Object.entries(countsSub).sort((a, b) => b[1] - a[1]).slice(0, 12);
      if (chartRef5.current) {
        chartInstance5.current = new Chart(chartRef5.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: sortedSub.map(e => e[0]),
            datasets: [{ label: 'N° Bienes', data: sortedSub.map(e => e[1]), backgroundColor: '#f59e0b', borderRadius: 6, borderWidth: 0 }]
          },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' }, color: '#475569' } } } }
        });
      }
    }

    if (subTab === 'DEPRECIACION') {
      // 1. Comparativa Libros vs Neto (Bar)
      let totLibros = 0;
      let totNeto = 0;
      filteredAssets.forEach(item => {
        totLibros += (Number(item.valor_en_libros) || 0);
        totNeto += getNetValue(item);
      });

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Valor en Libros', 'Valor Neto (Actual)'],
            datasets: [{
              label: 'Total General',
              data: [totLibros, totNeto],
              backgroundColor: ['#6366f1', '#10b981'],
              borderRadius: 8,
              borderWidth: 0,
              barThickness: 50
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return 'S/. ' + context.raw.toLocaleString('es-PE', { minimumFractionDigits: 2 });
                  }
                }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 12, weight: '700' }, color: '#475569' } },
              y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } }
            }
          }
        });
      }

      // 2. Depreciación por Categoría de Activo (Doughnut)
      const depPorCat = {};
      filteredAssets.forEach(item => {
        const key = item.categoria || 'Sin categoría';
        depPorCat[key] = (depPorCat[key] || 0) + (Number(item.depreciacion_acumulada) || 0);
      });
      const sortedDep = Object.entries(depPorCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: sortedDep.map(e => e[0]),
            datasets: [{
              data: sortedDep.map(e => e[1]),
              backgroundColor: ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 10, font: { size: 10, weight: '600' }, color: '#475569' }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return 'Dep: S/. ' + context.raw.toLocaleString('es-PE', { minimumFractionDigits: 2 });
                  }
                }
              }
            },
            cutout: '55%'
          }
        });
      }
    }

    if (subTab === 'CELULARES') {
      // 1. Estado de Vida Útil / Renovación (Doughnut)
      const countsRenovacion = { 'VIGENTE': 0, 'POR_RENOVAR': 0, 'VENCIDA': 0 };
      celulares.forEach(c => {
        const st = (c.vida_util_estado || 'VIGENTE').toUpperCase().replace(' ', '_');
        if (countsRenovacion[st] !== undefined) {
          countsRenovacion[st]++;
        }
      });

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Vigente', 'Por Renovar', 'Vencido/Renovar'],
            datasets: [{
              data: [countsRenovacion['VIGENTE'], countsRenovacion['POR_RENOVAR'], countsRenovacion['VENCIDA']],
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, font: { size: 11, weight: '600' }, color: '#475569' }
              }
            },
            cutout: '65%'
          }
        });
      }

      // 2. Líneas por Operador (Bar)
      const countsOperador = {};
      celulares.forEach(c => {
        const op = c.operador || 'Sin Operador';
        countsOperador[op] = (countsOperador[op] || 0) + 1;
      });

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: Object.keys(countsOperador),
            datasets: [{
              label: 'Líneas Activas',
              data: Object.values(countsOperador),
              backgroundColor: '#06b6d4',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' }, color: '#475569' } },
              y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } }
            }
          }
        });
      }
    }

    if (subTab === 'VEHICULOS') {
      const vh = getVehicles();

      // 1. Distribución por Categoría de Vehículo (Doughnut)
      const subcats = {};
      vh.forEach(item => {
        const cat = item.subcategoria || 'Otros';
        subcats[cat] = (subcats[cat] || 0) + 1;
      });

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: Object.keys(subcats),
            datasets: [{
              data: Object.values(subcats),
              backgroundColor: ['#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#3b82f6', '#60a5fa'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 10, font: { size: 10, weight: '600' }, color: '#475569' }
              }
            },
            cutout: '60%'
          }
        });
      }

      // 2. Estado de Conservación Física (Bar)
      const countsEstado = { 'BUENO': 0, 'REGULAR': 0, 'MALO': 0, 'PARA BAJA': 0, 'BAJA': 0 };
      vh.forEach(item => {
        const est = (item.estado_activo || '').toUpperCase().trim();
        if (countsEstado[est] !== undefined) countsEstado[est]++;
      });

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Bueno', 'Regular', 'Malo', 'Para Baja', 'Baja'],
            datasets: [{
              label: 'Cantidad Vehículos',
              data: [
                countsEstado['BUENO'], 
                countsEstado['REGULAR'], 
                countsEstado['MALO'], 
                countsEstado['PARA BAJA'], 
                countsEstado['BAJA']
              ],
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#eab308', '#ef4444'],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' }, color: '#475569' } },
              y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } }
            }
          }
        });
      }
    }

    if (subTab === 'SOAT') {
      const vh = getVehicles().filter(v => v.estado_activo !== 'PARA BAJA' && v.estado_activo !== 'BAJA');

      // 1. Estado de SOAT (Doughnut)
      const soatVigente = vh.filter(v => v.soat_estado === 'VIGENTE').length;
      const soatPorVencer = vh.filter(v => v.soat_estado === 'POR_VENCER').length;
      const soatVencido = vh.filter(v => v.soat_estado === 'VENCIDO').length;
      const soatSincronizar = vh.filter(v => !v.soat_estado).length;

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Vigente', 'Por Vencer', 'Vencido', 'Sin Registrar'],
            datasets: [{
              data: [soatVigente, soatPorVencer, soatVencido, soatSincronizar],
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, font: { size: 11, weight: '600' }, color: '#475569' }
              }
            },
            cutout: '65%'
          }
        });
      }

      // 2. Estado de Revisión Técnica (Doughnut)
      const rtVehicles = vh.filter(v => v.vencimiento_rev_tec);
      const rtVigente = rtVehicles.filter(v => v.estado_rev_tec === 'VIGENTE').length;
      const rtPorVencer = rtVehicles.filter(v => v.estado_rev_tec === 'POR_VENCER').length;
      const rtVencido = rtVehicles.filter(v => v.estado_rev_tec === 'VENCIDO').length;
      const rtNoRequiere = vh.length - rtVehicles.length;

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Vigente', 'Por Vencer', 'Vencido', 'No requiere'],
            datasets: [{
              data: [rtVigente, rtPorVencer, rtVencido, rtNoRequiere],
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#cbd5e1'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, font: { size: 11, weight: '600' }, color: '#475569' }
              }
            },
            cutout: '65%'
          }
        });
      }
    }

    if (subTab === 'CUENTAS_Y_CATEGORIAS') {
      // 1. Costo vs Depreciación por Cuenta Contable 3 Dígitos
      const accountsGroup = {};
      filteredAssets.forEach(item => {
        const key = (item.cuenta_contable || '3391010101').slice(0, 3);
        if (!accountsGroup[key]) accountsGroup[key] = { cost: 0, dep: 0 };
        accountsGroup[key].cost += Number(item.valor_en_libros) || 0;
        accountsGroup[key].dep += Number(item.depreciacion_acumulada) || 0;
      });
      const labelsAcc = Object.keys(accountsGroup).sort();
      const costsAcc = labelsAcc.map(k => accountsGroup[k].cost);
      const depsAcc = labelsAcc.map(k => accountsGroup[k].dep);

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labelsAcc,
            datasets: [
              { label: 'Costo Histórico', data: costsAcc, backgroundColor: '#00B0F0' },
              { label: 'Depreciación Acum.', data: depsAcc, backgroundColor: '#f43f5e' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: '600' } } }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
              y: { grid: { color: '#f1f5f9' } }
            }
          }
        });
      }

      // 2. Costo vs Depreciación por Categoría
      const categoriesGroup = {};
      filteredAssets.forEach(item => {
        const key = item.categoria || 'Sin Categoría';
        if (!categoriesGroup[key]) categoriesGroup[key] = { cost: 0, dep: 0 };
        categoriesGroup[key].cost += Number(item.valor_en_libros) || 0;
        categoriesGroup[key].dep += Number(item.depreciacion_acumulada) || 0;
      });
      const labelsCat = Object.keys(categoriesGroup);
      const costsCat = labelsCat.map(k => categoriesGroup[k].cost);
      const depsCat = labelsCat.map(k => categoriesGroup[k].dep);

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labelsCat,
            datasets: [
              { label: 'Costo Histórico', data: costsCat, backgroundColor: '#10b981' },
              { label: 'Depreciación Acum.', data: depsCat, backgroundColor: '#eab308' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: '600' } } }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' } } },
              y: { grid: { color: '#f1f5f9' } }
            }
          }
        });
      }
    }

    return destroyCharts;
  }, [subTab, loading, error, filteredAssets, celulares, soatList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 mt-3 font-semibold">Cargando indicadores en tiempo real...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center my-10">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold mt-2">Fallo al inicializar Dashboard</h3>
        <p className="text-sm text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  // Separar activos fijos de obras en curso (cod patrimonial 339%)
  const activosFijos = filteredAssets.filter(a => !a.cod_patrimonial?.startsWith('339'));
  const obrasEnCurso = filteredAssets.filter(a => a.cod_patrimonial?.startsWith('339'));

  // Common counters — activos fijos only (excluye obras en curso)
  const totalAssets = activosFijos.length;
  const totalVehicles = getVehicles().length;
  const totalCelulares = celulares.length;
  const totLibros = activosFijos.reduce((sum, item) => sum + (Number(item.valor_en_libros) || 0), 0);
  const totDepreciado = activosFijos.reduce((sum, item) => sum + (Number(item.depreciacion_acumulada) || 0), 0);
  const totNetValue = totLibros - totDepreciado;
  // Obras en curso — sin depreciación por diseño
  const totLibrosObras = obrasEnCurso.reduce((sum, item) => sum + (Number(item.valor_en_libros) || 0), 0);

  // Alerts lists for SOAT / RT
  const alertSoat = getVehicles().filter(v => v.estado_activo !== 'PARA BAJA' && v.estado_activo !== 'BAJA').filter(v => v.soat_estado === 'VENCIDO' || v.soat_estado === 'POR_VENCER');
  const alertRt = getVehicles().filter(v => v.estado_activo !== 'PARA BAJA' && v.estado_activo !== 'BAJA').filter(v => v.vencimiento_rev_tec && (v.estado_rev_tec === 'VENCIDO' || v.estado_rev_tec === 'POR_VENCER'));

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-4">
      
      {/* Título de Encabezado */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between shrink-0 mb-2">
        <div className="module-heading">
          <p className="module-kicker">Resumen analítico</p>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">DASHBOARD DE MONITOREO GENERAL</h2>
          <p className="text-sm text-slate-500">Métricas, gráficos y alertas críticas patrimoniales actualizadas en tiempo real.</p>
        </div>
      </div>

      {/* Selector de Período Global en Dashboard */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm shrink-0 flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-brand-500" />
          <span>Filtrar por Período de Registro:</span>
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-xl border border-slate-200 py-1.5 px-3 bg-slate-50 text-xs font-semibold focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
          >
            <option value="Todos">Todos los Años</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 py-1.5 px-3 bg-slate-50 text-xs font-semibold focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
          >
            <option value="Todos">Todos los Meses</option>
            <option value="1">Enero</option>
            <option value="2">Febrero</option>
            <option value="3">Marzo</option>
            <option value="4">Abril</option>
            <option value="5">Mayo</option>
            <option value="6">Junio</option>
            <option value="7">Julio</option>
            <option value="8">Agosto</option>
            <option value="9">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>
        </div>
      </div>

      {/* Sub-Navegación (Segmentación) */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 gap-1.5 overflow-x-auto border border-slate-200/50 shadow-sm self-start w-full md:w-auto">
        {[
          { key: 'ACTIVOS', label: '💼 Activos Fijos' },
          { key: 'DEPRECIACION', label: '🪙 Depreciación' },
          { key: 'CUENTAS_Y_CATEGORIAS', label: '📊 Cuentas y Categorías' },
          { key: 'OBRAS', label: '🏗️ Obras en Curso' },
          { key: 'CELULARES', label: '📱 Celulares' },
          { key: 'VEHICULOS', label: '🚗 Vehículos' },
          { key: 'SOAT', label: '🛡️ SOAT y Alertas' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
              subTab === tab.key 
                ? 'bg-white text-slate-900 shadow-sm border-slate-200' 
                : 'border-transparent text-slate-500 hover:bg-white/50 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDER SEGMENTO: ACTIVOS FIJOS */}
      {subTab === 'ACTIVOS' && (
        <div className="space-y-5 animate-fadeIn">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Activos Fijos</span>
                <span className="p-1 rounded-lg bg-brand-50 text-brand-600 text-xs">Total</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalAssets}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Bienes depreciables del período</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Inversión en Libros</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Costo</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatMoney(totLibros)}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Valor histórico de adquisición</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Valor Residual Neto</span>
                <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs">Actual</span>
              </div>
              <p className="text-2xl font-extrabold text-indigo-600 tracking-tight">{formatMoney(totNetValue)}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Descontando depreciación acumulada</span>
            </div>
          </div>

          {/* Fila 1: Estado Físico + Por Sucursal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[280px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-500" />
                <span>Estado de Conservación Física</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[200px] w-full"></canvas>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[280px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-brand-500" />
                <span>Bienes por Sucursal (cantidad)</span>
              </h3>
              <div className="flex-1 relative">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>

          {/* Fila 2: Por Localidad (monto) + Por Categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[280px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-indigo-500" />
                <span>Valor en Libros por Localidad (S/.)</span>
              </h3>
              <div className="flex-1 relative">
                <canvas ref={chartRef3} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[280px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <FolderSearch className="w-4 h-4 text-emerald-500" />
                <span>Bienes por Categoría (cantidad)</span>
              </h3>
              <div className="flex-1 relative">
                <canvas ref={chartRef4} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>

          {/* Fila 3: Por Subcategoría (full width) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[320px]">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>Bienes por Subcategoría — Top 12 (cantidad)</span>
            </h3>
            <div className="flex-1 relative">
              <canvas ref={chartRef5} className="max-h-[260px] w-full"></canvas>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: OBRAS EN CURSO */}
      {subTab === 'OBRAS' && (
        <div className="space-y-5 animate-fadeIn">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Obras en Curso</span>
                <span className="p-1 rounded-lg bg-amber-50 text-amber-600 text-xs">PMO</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{obrasEnCurso.length}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Bienes no depreciables (cód. 339)</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Inversión Acumulada</span>
                <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs">Costo</span>
              </div>
              <p className="text-2xl font-extrabold text-indigo-600 tracking-tight">{formatMoney(totLibrosObras)}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Valor en libros sin depreciación</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Nota</span>
                <span className="p-1 rounded-lg bg-slate-100 text-slate-500 text-xs">Info</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
                Las obras en curso no forman parte del Activo Fijo depreciable. Se registran en la cuenta 339 y se activan al finalizar la obra.
              </p>
            </div>
          </div>
          {/* Listado de obras */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-800">🏗️ Listado de Bienes — Obras en Curso</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">Cód. Patrimonial</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">Denominación</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">Sucursal / Localidad</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">Estado</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-500">Valor Libros</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {obrasEnCurso.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-8 text-slate-400 font-semibold">Sin obras en curso en el período seleccionado</td></tr>
                  ) : (
                    obrasEnCurso.map(item => (
                      <tr key={item.cod_patrimonial} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{item.cod_patrimonial}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{item.denominacion}</td>
                        <td className="px-4 py-2.5 text-slate-500">{item.sucursal || '—'} / {item.localidad || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${
                            item.estado_activo === 'BUENO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            item.estado_activo === 'REGULAR' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>{item.estado_activo || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{formatMoney(item.valor_en_libros)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{item.responsable || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: DEPRECIACION */}
      {subTab === 'DEPRECIACION' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Valor de Adquisición</span>
                <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs">Libros</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{formatMoney(totLibros)}</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Depreciación Acumulada</span>
                <span className="p-1 rounded-lg bg-rose-50 text-rose-600 text-xs">Pérdida</span>
              </div>
              <p className="text-2xl font-extrabold text-rose-600 tracking-tight">{formatMoney(totDepreciado)}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">
                Tasa de uso consumida ({totLibros > 0 ? ((totDepreciado/totLibros)*100).toFixed(1) : 0}%)
              </span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Valor Neto Contable</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Vigente</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatMoney(totNetValue)}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span>Comparación de Valor: Costo vs Neto</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <span>Depreciación Acumulada por Categoría de Bienes</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: CUENTAS Y CATEGORIAS */}
      {subTab === 'CUENTAS_Y_CATEGORIAS' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Costo en Libros</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Costo (33)</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatMoney(totLibros)}</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Depreciación Acumulada</span>
                <span className="p-1 rounded-lg bg-rose-50 text-rose-600 text-xs">Dep. (68)</span>
              </div>
              <p className="text-2xl font-extrabold text-rose-600 tracking-tight">{formatMoney(totDepreciado)}</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Valor Neto Contable</span>
                <span className="p-1 rounded-lg bg-brand-50 text-brand-600 text-xs">Neto</span>
              </div>
              <p className="text-2xl font-extrabold text-brand-600 tracking-tight">{formatMoney(totNetValue)}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-brand-500" />
                <span>Comparativa Costo vs Depreciación por Cuenta Contable (3 Dígitos)</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>Comparativa Costo vs Depreciación por Categoría de Activo</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>

          {/* Tablas de Detalle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tabla Cuentas */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[350px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                Resumen por Cuenta Contable (Perú PCGE)
              </h3>
              <div className="flex-1 overflow-auto max-h-[300px]">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Cuenta</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Costo (33)</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Dep. (68)</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Valor Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const accountsGroup = {};
                      filteredAssets.forEach(item => {
                        const key = item.cuenta_contable || '3391010101';
                        if (!accountsGroup[key]) accountsGroup[key] = { cost: 0, dep: 0 };
                        accountsGroup[key].cost += Number(item.valor_en_libros) || 0;
                        accountsGroup[key].dep += Number(item.depreciacion_acumulada) || 0;
                      });
                      const keys = Object.keys(accountsGroup).sort();
                      if (keys.length === 0) {
                        return <tr><td colSpan="4" className="text-center py-4 text-slate-400">Sin datos</td></tr>;
                      }
                      return keys.map(k => (
                        <tr key={k} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-bold text-slate-700">{k}</td>
                          <td className="px-3 py-2 text-right text-slate-600 font-mono">{formatMoney(accountsGroup[k].cost)}</td>
                          <td className="px-3 py-2 text-right text-rose-600 font-mono">{formatMoney(accountsGroup[k].dep)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">{formatMoney(accountsGroup[k].cost - accountsGroup[k].dep)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla Categorías & Subcategorías */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[350px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                Resumen por Categoría y Subcategoría
              </h3>
              <div className="flex-1 overflow-auto max-h-[300px]">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Categoría / Subcategoría</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Costo</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Depreciación</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500">Valor Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const catGroup = {};
                      filteredAssets.forEach(item => {
                        const key = `${item.categoria || 'Sin Categoría'} - ${item.subcategoria || 'Sin Subcategoría'}`;
                        if (!catGroup[key]) catGroup[key] = { cost: 0, dep: 0 };
                        catGroup[key].cost += Number(item.valor_en_libros) || 0;
                        catGroup[key].dep += Number(item.depreciacion_acumulada) || 0;
                      });
                      const keys = Object.keys(catGroup).sort();
                      if (keys.length === 0) {
                        return <tr><td colSpan="4" className="text-center py-4 text-slate-400">Sin datos</td></tr>;
                      }
                      return keys.map(k => (
                        <tr key={k} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[200px]" title={k}>{k}</td>
                          <td className="px-3 py-2 text-right text-slate-600 font-mono">{formatMoney(catGroup[k].cost)}</td>
                          <td className="px-3 py-2 text-right text-rose-600 font-mono">{formatMoney(catGroup[k].dep)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">{formatMoney(catGroup[k].cost - catGroup[k].dep)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: CELULARES */}
      {subTab === 'CELULARES' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Líneas y Equipos</span>
                <span className="p-1 rounded-lg bg-cyan-50 text-cyan-600 text-xs">Total</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalCelulares}</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Vida Útil Excedida</span>
                <span className="p-1 rounded-lg bg-rose-50 text-rose-600 text-xs">Renovación</span>
              </div>
              <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
                {celulares.filter(c => c.vida_util_estado === 'VENCIDA').length}
              </p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Equipos con más de 3 años de servicio</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Estado Operativo</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Vigente</span>
              </div>
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                {celulares.filter(c => c.estado === 'ACTIVO').length}
              </p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Celulares asignados y operativos</span>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-500" />
                <span>Estado de Vida Útil / Renovación</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <span>Distribución de Líneas por Operador</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: VEHICULOS */}
      {subTab === 'VEHICULOS' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Flota de Vehículos</span>
                <span className="p-1 rounded-lg bg-blue-50 text-blue-600 text-xs">Total</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalVehicles}</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Conservación Óptima</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Bueno/Regular</span>
              </div>
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                {getVehicles().filter(v => v.estado_activo === 'BUENO' || v.estado_activo === 'REGULAR').length}
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Porcentaje Operativo</span>
                <span className="p-1 rounded-lg bg-brand-50 text-brand-600 text-xs">Tasa</span>
              </div>
              <p className="text-3xl font-extrabold text-brand-600 tracking-tight">
                {totalVehicles > 0 ? ((getVehicles().filter(v => v.estado_activo !== 'BAJA' && v.estado_activo !== 'PARA BAJA').length / totalVehicles) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-500" />
                <span>Distribución por Subcategoría de Vehículo</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>Conservación Física de Vehículos</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SEGMENTO: SOAT Y ALERTAS */}
      {subTab === 'SOAT' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Alertas SOAT</span>
                <span className="p-1 rounded-lg bg-rose-50 text-rose-600 text-xs">Acción</span>
              </div>
              <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
                {alertSoat.length}
              </p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Pólizas vencidas o por vencer en 30 días</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Alertas Revisión Técnica</span>
                <span className="p-1 rounded-lg bg-amber-50 text-amber-600 text-xs">Acción</span>
              </div>
              <p className="text-3xl font-extrabold text-amber-600 tracking-tight">
                {alertRt.length}
              </p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Revisiones vencidas o por vencer</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Documentación en Regla</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Ok</span>
              </div>
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                {getVehicles().filter(v => v.estado_activo !== 'PARA BAJA' && v.estado_activo !== 'BAJA').filter(v => v.soat_estado === 'VIGENTE' && (!v.vencimiento_rev_tec || v.estado_rev_tec === 'VIGENTE')).length}
              </p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Vehículos con todo al día</span>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Vigencia del Seguro Obligatorio (SOAT)</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Monitoreo de Revisiones Técnicas</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>
          </div>

          {/* Listado Visual de Alertas Críticas (SOAT/RT) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-rose-700 mb-4 flex items-center gap-1.5 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Vehículos que requieren Acción Inmediata (SOAT / Revisión Técnica Vencidos o Por Vencer)</span>
            </h3>
            
            {alertSoat.length === 0 && alertRt.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">¡Excelente!</p>
                <p className="text-xs text-slate-400">Todos los vehículos tienen su documentación SOAT y Revisión Técnica vigentes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Alertas de SOAT */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide mb-2">Alertas de SOAT ({alertSoat.length})</h4>
                  <div className="space-y-2.5">
                    {alertSoat.map(v => (
                      <div key={v.cod_patrimonial} className={`p-3 rounded-xl border flex justify-between items-start text-xs ${
                        v.soat_estado === 'VENCIDO' ? 'bg-rose-50/50 border-rose-200 text-rose-900' : 'bg-amber-50/50 border-amber-200 text-amber-900'
                      }`}>
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-extrabold truncate">{v.denominacion}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Placa: <strong className="font-mono text-slate-800 bg-white border px-1.5 py-0.5 rounded shadow-sm">{v.placa}</strong></p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">Responsable: {v.responsable || 'Sin Asignar'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            v.soat_estado === 'VENCIDO' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {v.soat_estado}
                          </span>
                          <p className="text-[10px] text-slate-500 font-semibold font-mono mt-1">
                            {v.soat_vencimiento ? v.soat_vencimiento.split('T')[0].split('-').reverse().join('/') : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alertas de RT */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide mb-2">Alertas de Revisión Técnica ({alertRt.length})</h4>
                  <div className="space-y-2.5">
                    {alertRt.map(v => (
                      <div key={v.cod_patrimonial} className={`p-3 rounded-xl border flex justify-between items-start text-xs ${
                        v.estado_rev_tec === 'VENCIDO' ? 'bg-rose-50/50 border-rose-200 text-rose-900' : 'bg-amber-50/50 border-amber-200 text-amber-900'
                      }`}>
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-extrabold truncate">{v.denominacion}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Placa: <strong className="font-mono text-slate-800 bg-white border px-1.5 py-0.5 rounded shadow-sm">{v.placa}</strong></p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">Responsable: {v.responsable || 'Sin Asignar'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            v.estado_rev_tec === 'VENCIDO' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {v.estado_rev_tec}
                          </span>
                          <p className="text-[10px] text-slate-500 font-semibold font-mono mt-1">
                            {v.vencimiento_rev_tec ? v.vencimiento_rev_tec.split('T')[0].split('-').reverse().join('/') : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
