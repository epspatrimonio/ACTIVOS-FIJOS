import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, FileJson, ArrowRight } from 'lucide-react';
import { sincronizarPublico, getDashboardUrl } from '../utils/api';

export default function SyncPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await sincronizarPublico();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Error desconocido al sincronizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-brand-50 border border-brand-100 text-brand-600 rounded-xl shadow-sm">
          <FileJson className="w-8 h-8" />
        </div>
        <div>
          <p className="module-kicker">Publicación externa</p>
          <h2 className="text-xl font-extrabold text-slate-900">Sincronización de Dashboard Público</h2>
          <p className="text-sm text-slate-500">
            Exporta el listado consolidado desde la vista <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">af.vw_registro_activos_detalle</code> a un archivo JSON.
          </p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/80 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Funcionamiento de la sincronización</h3>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
          <li>Consulta la base de datos local y consolida todos los datos del activo fijos.</li>
          <li>Escribe un archivo estructurado y simplificado <code className="bg-slate-100 px-1 py-0.5 rounded">activos.json</code>.</li>
          <li>La ruta física de destino es: <code className="bg-slate-100 px-1 py-0.5 rounded">/public_dashboard/activos.json</code>.</li>
          <li>El Dashboard Público consume el JSON de manera estática sin interactuar con la base de datos directamente.</li>
          <li>Enlace público oficial: <a href="https://epspatrimonio.github.io/ACTIVOS-FIJOS/" target="_blank" rel="noreferrer" className="text-brand-600 font-bold hover:underline">https://epspatrimonio.github.io/ACTIVOS-FIJOS/</a></li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
        <button
          onClick={handleSync}
          disabled={loading}
          className={`flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-brand-500/20 ${
            loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-600 to-[#00B0F0] hover:from-brand-700 hover:to-[#00A0E0] text-white active:scale-[0.98] shadow-md shadow-brand-600/10'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Exportando datos...' : 'Sincronizar y Exportar Ahora'}</span>
        </button>
      </div>

      {result && (
        <div className="mt-6 flex items-start space-x-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{result.message}</p>
            <div className="mt-2 text-xs text-emerald-700/90 space-y-1">
              <p>📍 <strong>Ruta física:</strong> {result.export_path}</p>
              <p>📊 <strong>Registros exportados:</strong> {result.total_records}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={getDashboardUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-900 hover:underline bg-emerald-100/60 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <span>Abrir Dashboard Público Local</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://epspatrimonio.github.io/ACTIVOS-FIJOS/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-bold text-brand-700 hover:underline bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200"
              >
                <span>Abrir GitHub Pages (ACTIVOS-FIJOS)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
            {result.git_sync && (
              <div className={`mt-4 p-3 rounded-xl border text-[0.75rem] leading-relaxed ${
                result.git_sync.status === 'success'
                  ? 'bg-emerald-100/30 border-emerald-200 text-emerald-800'
                  : result.git_sync.status === 'skipped'
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <span>☁️</span>
                  <span>Sincronización con GitHub:</span>
                </p>
                <p>{result.git_sync.message}</p>
                {result.git_sync.detail && (
                  <pre className="mt-2 bg-[#051934] text-brand-100 p-3 rounded-xl border border-brand-900/50 font-mono text-[10px] overflow-x-auto max-h-32 shadow-inner">
                    {result.git_sync.detail}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start space-x-3 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Error al sincronizar</p>
            <p className="mt-1 text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
