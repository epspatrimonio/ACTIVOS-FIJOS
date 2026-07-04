import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, CheckCircle2, 
  AlertCircle, Smartphone, Car, FolderSearch, Coins, ClipboardList, Clock 
} from 'lucide-react';
import { fetchActivos, fetchCelulares, fetchSoat } from '../utils/api';

export default function AdminDashboard() {
  const [subTab, setSubTab] = useState('ACTIVOS'); // ACTIVOS | DEPRECIACION | CELULARES | VEHICULOS | SOAT
  const [assets, setAssets] = useState([]);
  const [celulares, setCelulares] = useState([]);
  const [soatList, setSoatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chart refs
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const chartRef3 = useRef(null);

  // Chart instances
  const chartInstance1 = useRef(null);
  const chartInstance2 = useRef(null);
  const chartInstance3 = useRef(null);

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

  // Filter helper for vehicles
  const getVehicles = () => {
    return assets.filter(item => 
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

  // Re-render charts whenever subTab or data changes
  useEffect(() => {
    if (loading || error || !window.Chart) return;

    // Helper to destroy old charts
    const destroyCharts = () => {
      if (chartInstance1.current) {
        chartInstance1.current.destroy();
        chartInstance1.current = null;
      }
      if (chartInstance2.current) {
        chartInstance2.current.destroy();
        chartInstance2.current = null;
      }
      if (chartInstance3.current) {
        chartInstance3.current.destroy();
        chartInstance3.current = null;
      }
    };

    destroyCharts();

    const Chart = window.Chart;

    if (subTab === 'ACTIVOS') {
      // 1. Estado Físico (Doughnut)
      const countsEstado = { 'BUENO': 0, 'REGULAR': 0, 'MALO': 0, 'PARA BAJA': 0, 'BAJA': 0 };
      assets.forEach(item => {
        const est = (item.estado_activo || '').toUpperCase().trim();
        if (countsEstado[est] !== undefined) countsEstado[est]++;
      });

      if (chartRef1.current) {
        chartInstance1.current = new Chart(chartRef1.current.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Bueno', 'Regular', 'Malo', 'Para Baja', 'Baja'],
            datasets: [{
              data: [
                countsEstado['BUENO'], 
                countsEstado['REGULAR'], 
                countsEstado['MALO'], 
                countsEstado['PARA BAJA'], 
                countsEstado['BAJA']
              ],
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#eab308', '#ef4444'],
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

      // 2. Activos por Sucursal (Horizontal Bar)
      const countsLocation = {};
      assets.forEach(item => {
        const key = item.sucursal || 'Sin sucursal';
        countsLocation[key] = (countsLocation[key] || 0) + 1;
      });
      const sortedLocations = Object.entries(countsLocation).sort((a, b) => b[1] - a[1]).slice(0, 7);

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current.getContext('2d'), {
          type: 'bar',
          data: {
            labels: sortedLocations.map(e => e[0]),
            datasets: [{
              label: 'Bienes Registrados',
              data: sortedLocations.map(e => e[1]),
              backgroundColor: '#00B0F0',
              borderRadius: 6,
              borderWidth: 0
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, color: '#94a3b8' } },
              y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' }, color: '#475569' } }
            }
          }
        });
      }
    }

    if (subTab === 'DEPRECIACION') {
      // 1. Comparativa Libros vs Neto (Bar)
      let totLibros = 0;
      let totNeto = 0;
      assets.forEach(item => {
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
      assets.forEach(item => {
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

    return destroyCharts;
  }, [subTab, loading, error, assets, celulares, soatList]);

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

  // Common counters
  const totalAssets = assets.length;
  const totalVehicles = getVehicles().length;
  const totalCelulares = celulares.length;
  const totLibros = assets.reduce((sum, item) => sum + (Number(item.valor_en_libros) || 0), 0);
  const totDepreciado = assets.reduce((sum, item) => sum + (Number(item.depreciacion_acumulada) || 0), 0);
  const totNetValue = totLibros - totDepreciado;

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

      {/* Sub-Navegación (Segmentación) */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 gap-1.5 overflow-x-auto border border-slate-200/50 shadow-sm self-start w-full md:w-auto">
        {[
          { key: 'ACTIVOS', label: '💼 Activos Fijos', color: 'text-brand-700 bg-brand-50 border-brand-200' },
          { key: 'DEPRECIACION', label: '🪙 Depreciación', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
          { key: 'CELULARES', label: '📱 Celulares', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
          { key: 'VEHICULOS', label: '🚗 Vehículos', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { key: 'SOAT', label: '🛡️ SOAT y Alertas', color: 'text-rose-700 bg-rose-50 border-rose-200' }
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
        <div className="space-y-6 animate-fadeIn">
          {/* Fila de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Bienes Muebles</span>
                <span className="p-1 rounded-lg bg-brand-50 text-brand-600 text-xs">Total</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalAssets}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Registrados en la base de datos</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-extrabold text-slate-400 uppercase tracking-wider">Inversión en Libros</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">Costo</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatMoney(totLibros)}</p>
              <span className="text-[11px] text-slate-400 font-semibold block mt-1">Suma total del valor histórico de adquisición</span>
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

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-500" />
                <span>Estado de Conservación Física</span>
              </h3>
              <div className="flex-1 relative flex items-center justify-center">
                <canvas ref={chartRef1} className="max-h-[220px] w-full"></canvas>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-brand-500" />
                <span>Distribución cuantitativa por Sucursal (Top 7)</span>
              </h3>
              <div className="flex-1 relative">
                <canvas ref={chartRef2} className="max-h-[220px] w-full"></canvas>
              </div>
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
              <h3 class="text-sm font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
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
