/**
 * Modal.jsx — Componente modal universal con React Portal.
 * Renderiza en document.body para evitar clipping por overflow:hidden de padres.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {string} [props.maxWidth] — e.g. '640px'
 */
export default function Modal({ open, onClose, children, maxWidth = '680px' }) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2vh 1rem',
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
          animation: 'modalIn .22s cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
