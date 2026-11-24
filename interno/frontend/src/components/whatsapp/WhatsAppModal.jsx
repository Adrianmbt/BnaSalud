import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Smartphone,
  ShieldCheck,
  Wifi,
  WifiOff,
  KeyRound,
  QrCode,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { obtenerEstadoWhatsapp, obtenerQrWhatsapp } from '../../api/whatsapp';

export default function WhatsAppModal({ isOpen, onClose }) {
  const [metodo, setMetodo] = useState('codigo'); // 'codigo' o 'qr'
  const [estado, setEstado] = useState(null); // { conectado: bool, estado: string }
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const consultarEstado = useCallback(async () => {
    try {
      const data = await obtenerEstadoWhatsapp();
      setEstado(data);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Error conectando con el servicio';
      setError(msg);
      return null;
    }
  }, []);

  const solicitarQr = useCallback(async (reiniciar = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await obtenerQrWhatsapp({ reiniciar });
      if (data?.error === 'already_connected') {
        await consultarEstado();
      } else if (data?.qr) {
        setQrCode(data.qr);
        if (data.pairing_code) setPairingCode(data.pairing_code);
      } else if (data?.error) {
        setError(data.error);
      } else {
        setError('No se pudo generar el código QR.');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Error al obtener código QR.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [consultarEstado]);

  const solicitarPairingCode = async (e) => {
    if (e) e.preventDefault();
    const telLimpio = telefono.replace(/\D/g, '');
    if (!telLimpio || telLimpio.length < 10) {
      setError('Por favor ingresa un número de teléfono válido (ej: 04121234567 o 584121234567).');
      return;
    }

    setLoading(true);
    setError('');
    setPairingCode('');
    try {
      const data = await obtenerQrWhatsapp({ telefono: telLimpio });
      if (data?.error === 'already_connected') {
        await consultarEstado();
      } else if (data?.pairing_code) {
        setPairingCode(data.pairing_code);
      } else if (data?.error) {
        setError(data.error);
      } else {
        setError('Evolution API no devolvió el código. Intenta nuevamente.');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Error solicitando código de emparejamiento.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    let activo = true;
    (async () => {
      setLoading(true);
      setError('');
      const statusData = await consultarEstado();
      if (activo && !statusData?.conectado) {
        // Por defecto intentar cargar estado
      }
      if (activo) setLoading(false);
    })();

    return () => {
      activo = false;
    };
  }, [isOpen, consultarEstado]);

  // Sondeo cada 4s para detectar cuando el usuario se conecte
  useEffect(() => {
    if (!isOpen || estado?.conectado) return;

    const interval = setInterval(async () => {
      const data = await consultarEstado();
      if (data?.conectado) {
        setQrCode(null);
        setPairingCode('');
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, estado?.conectado, consultarEstado]);

  const copiarCodigo = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/\D/g, ''));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-800">
                Vincular WhatsApp (Evolution API)
              </h3>
              <p className="text-[11px] text-slate-500">
                {estado?.conectado ? 'Teléfono conectado y listo' : 'Conecta el WhatsApp de la clínica'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido principal */}
        <div className="p-6 space-y-4">
          {/* Indicador de estado */}
          <div
            className={`flex items-center justify-between p-3 rounded-xl border ${
              estado?.conectado
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                : 'bg-amber-50/70 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {estado?.conectado ? (
                <Wifi className="w-4 h-4 text-emerald-600 animate-pulse" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-600" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {estado?.conectado ? 'Conectado a WhatsApp' : 'Desconectado / Esperando vinculación'}
              </span>
            </div>
            <button
              type="button"
              onClick={consultarEstado}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white px-2 py-1 rounded-md shadow-xs border border-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              Verificar
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Detalle de conexión:</p>
                <p className="mt-0.5 text-rose-600 font-mono text-[11px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Estado: Ya conectado */}
          {estado?.conectado ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h4 className="font-display font-bold text-slate-800 text-lg">
                ¡Teléfono vinculado correctamente!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Evolution API está sincronizada con tu cuenta de WhatsApp. Ya puedes enviar notificaciones automáticas y reprogramaciones a los pacientes.
              </p>
            </div>
          ) : (
            /* Opciones de Vinculación: Código (Pairing) o QR */
            <div className="space-y-4">
              {/* Pestañas de selección */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setMetodo('codigo');
                    setError('');
                  }}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    metodo === 'codigo'
                      ? 'bg-white text-brand-primary shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" /> Vincular con Código (Sin cámara)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetodo('qr');
                    setError('');
                    if (!qrCode) solicitarQr(false);
                  }}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    metodo === 'qr'
                      ? 'bg-white text-brand-primary shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> Escanear QR
                </button>
              </div>

              {/* MÉTODO 1: CÓDIGO NUMÉRICO DE WHATSAPP (PAIRING CODE) */}
              {metodo === 'codigo' && (
                <div className="space-y-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                  <form onSubmit={solicitarPairingCode} className="space-y-3">
                    <div>
                      <label
                        htmlFor="telefono-whatsapp"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
                      >
                        Número de teléfono de WhatsApp
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="telefono-whatsapp"
                          type="text"
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value)}
                          placeholder="Ej: 04121234567 o 584141234567"
                          className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                        />
                        <button
                          type="submit"
                          disabled={loading || !telefono.trim()}
                          className="px-4 py-2 bg-brand-primary hover:bg-brand-deep text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Generar Código
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Ingresa el número del teléfono donde tienes instalado el WhatsApp que enviará los mensajes.
                      </p>
                    </div>
                  </form>

                  {/* Código generado */}
                  {pairingCode ? (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
                      <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest">
                        Tu Código de Vinculación:
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-emerald-700 bg-white px-4 py-2 rounded-xl border border-emerald-300 shadow-xs">
                          {pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={copiarCodigo}
                          title="Copiar código"
                          className="p-2.5 rounded-xl bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors"
                        >
                          {copiado ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        {copiado ? '¡Copiado en el portapapeles!' : 'Válido por 60 segundos'}
                      </p>
                    </div>
                  ) : null}

                  {/* Instrucciones de Pairing Code */}
                  <div className="rounded-xl bg-white p-3.5 border border-slate-200 text-xs text-slate-600 space-y-2">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-600" /> Pasos en tu teléfono:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 pl-1 leading-relaxed">
                      <li>Abre WhatsApp en tu teléfono.</li>
                      <li>
                        Toca <strong>Menú (⋮)</strong> en Android o <strong>Configuración (⚙)</strong> en iPhone.
                      </li>
                      <li>
                        Toca <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.
                      </li>
                      <li>
                        En la pantalla de la cámara, toca abajo la opción:{' '}
                        <strong className="text-brand-primary underline">Vincular con el número de teléfono</strong>.
                      </li>
                      <li>Ingresa el código de 8 dígitos que aparece arriba.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* MÉTODO 2: ESCANEO POR CÓDIGO QR */}
              {metodo === 'qr' && (
                <div className="space-y-3">
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-200/80 min-h-[260px]">
                    {loading ? (
                      <div className="text-center space-y-2 py-8">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">
                          Conectando con Evolution API y generando QR...
                        </p>
                      </div>
                    ) : qrCode ? (
                      <div className="space-y-2 text-center">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 inline-block">
                          <img
                            src={qrCode}
                            alt="Código QR de WhatsApp"
                            className="w-52 h-52 object-contain rounded-lg"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Apunta tu cámara de WhatsApp a este código.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-3 py-6">
                        <Smartphone className="w-10 h-10 text-slate-400 mx-auto" />
                        <p className="text-xs text-slate-600">
                          Si el código QR no aparece, puedes usar la pestaña de <strong>Código</strong> o reiniciar la instancia.
                        </p>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => solicitarQr(false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-deep transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Reintentar QR
                          </button>
                          <button
                            type="button"
                            onClick={() => solicitarQr(true)}
                            title="Borra la sesión previa en Docker y genera una nueva limpia"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Instancia
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
