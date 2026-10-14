import React from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from './specialistMeta';
import { useCerrarConAtras } from '../ModalStack';

export default function PanelModal({
  abierto,
  onClose,
  id,
  titulo,
  subtitulo,
  icono,
  children,
  maxW = 'max-w-3xl',
}) {
  useModalFocus(abierto, onClose, `${id}-cerrar`);
  useCerrarConAtras(abierto, onClose, titulo);
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-end sm:items-center sm:justify-center sm:p-4 justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
    >
      <div className={`w-full ${maxW} max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in`}>
        <header className="px-5 py-3.5 flex items-center gap-3 border-b border-slate-100 shrink-0">
          <span className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center ring-1 ring-sky-500/20 shrink-0">
            {icono}
          </span>
          <div className="flex-1 min-w-0">
            <h2 id={`${id}-titulo`} className="font-display font-bold text-base text-brand-deep">{titulo}</h2>
            {subtitulo && <p className="text-[11px] text-slate-400">{subtitulo}</p>}
          </div>
          <button
            id={`${id}-cerrar`}
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="h-11 w-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+var(--safe-bottom))] sm:pb-4">{children}</div>
      </div>
    </div>
  );
}