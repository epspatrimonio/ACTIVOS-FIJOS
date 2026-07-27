/**
 * Modal.jsx — Componente modal universal con React Portal.
 * Renderiza en document.body para evitar clipping por overflow:hidden de padres.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, isOpen, onClose, title, children, maxWidth = '680px' }) {
  const isVisible = open ?? isOpen ?? false;

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isVisible]);

  if (!isVisible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2vh 1rem',
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          marginTop: 'auto',
          marginBottom: 'auto',
          background: '#fff',
          borderRadius: '1.25rem',
          boxShadow: '0 0 0 1px rgba(100,116,139,.12), 0 8px 32px -4px rgba(15,23,42,.22), 0 32px 64px -16px rgba(15,23,42,.14)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          overflow: 'hidden',
          animation: 'modalIn .22s cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
