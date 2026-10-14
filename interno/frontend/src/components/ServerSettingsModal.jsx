import React, { useEffect, useRef, useState } from 'react';
import { X, Server, Save, PlugZap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getServidor, setServidor, probarServidor } from '../config/api';
import { useCerrarConAtras } from './ModalStack';

export default function ServerSettingsModal({ theme, onClose }) {
  const [url, setUrl] = useState('');
  const [estado, setEstado] = useState(null);
  const [probando, setProbando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getServidor().then(setUrl);
    inputRef.current?.focus();
  }, []);

  // Escape y el boton atras de Android los maneja ModalStack.
  useCerrarConAtras(true, onClose, 'Configurar servidor');

  const probar = async () => {
    setProbando(true);
    setEstado(null);
    setGuardado(false);
    const resultado = await probarServidor(url);
    setEstado(resultado);
    setProbando(false);
  };

  const guardar = async () => {
    await setServidor(url);
    setGuardado(true);
    setEstado(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurar servidor"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl p-5 animate-fade-up"
        style={{ border: `1px solid ${theme.colors.border}` }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 shrink-0" style={{ color: theme.colors.primary }} />
            <h3 className="font-bold text-base" style={{ color: theme.colors.text }}>
              Servidor de datos
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg -mr-2 -mt-2"
            style={{ color: theme.colors.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed mb-3" style={{ color: theme.colors.textMuted }}>
          Dirección del servidor donde vive la información de esta clínica. Puedes
          escribirla con o sin <code>/api/v1</code>.
        </p>

        <label htmlFor="server-url" className="block text-[13px] font-semibold mb-1" style={{ color: theme.colors.text }}>
          Dirección del servidor
        </label>
        <input
          ref={inputRef}
          id="server-url"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://citab.bnasalud.ve"
          className="cp-input !py-2.5 text-[16px]"
          style={{ borderColor: theme.colors.border }}
        />

        {estado && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]"
            style={{
              backgroundColor: estado.ok ? '#F0FDF4' : '#FEF2F2',
              color: estado.ok ? '#15803D' : '#B91C1C',
            }}
          >
            {estado.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{estado.detalle}</span>
          </div>
        )}

        {guardado && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
            style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Servidor guardado.</span>
          </div>
        )}

        <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={probar}
            disabled={probando || !url.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: theme.colors.primary, border: `1px solid ${theme.colors.border}` }}
          >
            {probando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            Probar conexión
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={!url.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
