import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';
import {
  getGuardiasActivas,
  iniciarGuardia,
  cambiarGuardia,
  finalizarGuardia,
} from '../api/guardia';
import axiosClient from '../api/axiosClient';

const TURNO_OPCIONES = [
  { id: 1, nombre: 'Guardia 24h' },
  { id: 2, nombre: 'Manana' },
  { id: 3, nombre: 'Tarde' },
  { id: 8, nombre: 'Tarde Extendida' },
];

function fechaLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GuardiaPanel({ clinicaId, onGuardiasActualizadas }) {
  const [guardias, setGuardias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalIniciar, setModalIniciar] = useState(false);
  const [medicos, setMedicos] = useState([]);
  const [formIniciar, setFormIniciar] = useState({
    medico_id: '',
    turno_id: '1',
    observaciones: '',
  });

  const [modalCambiar, setModalCambiar] = useState(false);
  const [guardiaCambiar, setGuardiaCambiar] = useState(null);
  const [formCambiar, setFormCambiar] = useState({
    medico_entrante_id: '',
    turno_id: '1',
    observaciones: '',
  });

  const cargarGuardias = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getGuardiasActivas(clinicaId);
      setGuardias(data);
      if (onGuardiasActualizadas) onGuardiasActualizadas(data);
    } catch {
      setError('No se pudieron cargar las guardias.');
    } finally {
      setLoading(false);
    }
  }, [clinicaId, onGuardiasActualizadas]);

  useEffect(() => {
    cargarGuardias();
  }, [cargarGuardias]);

  useEffect(() => {
    const t = setInterval(cargarGuardias, 30000);
    return () => clearInterval(t);
  }, [cargarGuardias]);

  const cargarMedicos = async () => {
    try {
      const { data } = await axiosClient.get('/personal', { params: { rol: 'medico_emergencia' } });
      setMedicos(data);
    } catch {
      setMedicos([]);
    }
  };

  const handleIniciar = async () => {
    if (!formIniciar.medico_id) {
      setError('Selecciona un medico.');
      return;
    }
    try {
      setError('');
      await iniciarGuardia({
        medico_id: Number(formIniciar.medico_id),
        clinica_id: clinicaId || null,
        turno_id: Number(formIniciar.turno_id),
        fecha: fechaLocal(),
        observaciones: formIniciar.observaciones || null,
      });
      setSuccess('Guardia iniciada exitosamente.');
      setModalIniciar(false);
      setFormIniciar({ medico_id: '', turno_id: '1', observaciones: '' });
      await cargarGuardias();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al iniciar guardia.');
    }
  };

  const handleCambiar = async () => {
    if (!formCambiar.medico_entrante_id || !guardiaCambiar) {
      setError('Selecciona el medico entrante.');
      return;
    }
    try {
      setError('');
      await cambiarGuardia({
        guardia_saliente_id: guardiaCambiar.id,
        medico_entrante_id: Number(formCambiar.medico_entrante_id),
        turno_id: Number(formCambiar.turno_id),
        observaciones: formCambiar.observaciones || null,
      });
      setSuccess('Guardia cambiada exitosamente.');
      setModalCambiar(false);
      setGuardiaCambiar(null);
      setFormCambiar({ medico_entrante_id: '', turno_id: '1', observaciones: '' });
      await cargarGuardias();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al cambiar guardia.');
    }
  };

  const handleFinalizar = async (guardiaId) => {
    try {
      setError('');
      await finalizarGuardia(guardiaId);
      setSuccess('Guardia finalizada.');
      await cargarGuardias();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al finalizar guardia.');
    }
  };

  const abrirModalIniciar = async () => {
    await cargarMedicos();
    setModalIniciar(true);
  };

  const abrirModalCambiar = (guardia) => {
    setGuardiaCambiar(guardia);
    setFormCambiar({ medico_entrante_id: '', turno_id: String(guardia.turno_id), observaciones: '' });
    setModalCambiar(true);
  };

  const medicosDisponibles = medicos.filter(
    (m) => !guardias.some((g) => g.medico_id === m.id && g.estado === 'ACTIVA')
  );

  const spinClass = loading ? 'animate-spin' : '';

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0" />
          <h3 className="font-display font-bold text-sm text-brand-deep truncate">Guardia de Emergencia</h3>
          {guardias.length > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
              {guardias.length} activa{guardias.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cargarGuardias}
            className="h-11 w-11 sm:h-auto sm:w-auto sm:p-1.5 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
            title="Actualizar"
            aria-label="Actualizar guardias"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={abrirModalIniciar}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-lg bg-brand-primary active:bg-brand-deep hover:bg-brand-deep text-white text-[11px] font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Iniciar guardia
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className={`px-3 sm:px-4 py-2 text-[12px] flex items-center gap-2 ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span className="flex-1 min-w-0">{error || success}</span>
          <button onClick={() => { setError(''); setSuccess(''); }} aria-label="Cerrar aviso" className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 active:bg-black/5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-3 sm:p-4">
        {guardias.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay medicos de guardia activos.</p>
            <p className="text-[11px] mt-1">Inicia una guardia para asignar un medico de emergencia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {guardias.map((g) => (
              <div
                key={g.id}
                className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 hover:ring-brand-primary/30 transition-all"
              >
                {/* Fila superior: medico + hora. En movil baja la hora para no desbordar. */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{g.medico_nombre}</p>
                    <p className="text-[11px] text-slate-500 truncate">{g.especialidad} - {g.turno_nombre || 'Turno #' + g.turno_id}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0">
                    <Clock className="w-3 h-3" />
                    {g.hora_inicio ? new Date(g.hora_inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '---'}
                  </div>
                </div>
                {/* Acciones a lo ancho en movil: 44px de alto, sin scroll horizontal. */}
                <div className="mt-2.5 flex items-center gap-2 sm:mt-0 sm:justify-end">
                  <div className="sm:hidden flex items-center gap-1.5 text-[11px] text-slate-400 mr-auto">
                    <Clock className="w-3 h-3" />
                    {g.hora_inicio ? new Date(g.hora_inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '---'}
                  </div>
                  <button
                    onClick={() => abrirModalCambiar(g)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 px-3 sm:p-1.5 rounded-lg bg-amber-100 sm:bg-transparent hover:bg-amber-100 active:bg-amber-200 text-amber-700 sm:text-amber-600 text-[11px] font-semibold transition-colors"
                    title="Cambiar guardia"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Cambiar</span>
                  </button>
                  <button
                    onClick={() => handleFinalizar(g.id)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 px-3 sm:p-1.5 rounded-lg bg-red-100 sm:bg-transparent hover:bg-red-100 active:bg-red-200 text-red-700 sm:text-red-500 text-[11px] font-semibold transition-colors"
                    title="Finalizar guardia"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Finalizar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalIniciar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalIniciar(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4 keyboard-safe" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-brand-deep">Iniciar Guardia</h3>
              <button onClick={() => setModalIniciar(false)} aria-label="Cerrar" className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Medico</label>
                <select
                  value={formIniciar.medico_id}
                  onChange={(e) => setFormIniciar({ ...formIniciar, medico_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-base focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  <option value="">Seleccionar medico...</option>
                  {medicosDisponibles.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre} {m.apellido} - {m.especialidad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Turno</label>
                <select
                  value={formIniciar.turno_id}
                  onChange={(e) => setFormIniciar({ ...formIniciar, turno_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-base focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  {TURNO_OPCIONES.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                <input
                  type="text"
                  value={formIniciar.observaciones}
                  onChange={(e) => setFormIniciar({ ...formIniciar, observaciones: e.target.value })}
                  placeholder="Opcional..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-base focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
            </div>
            <button
              onClick={handleIniciar}
              disabled={!formIniciar.medico_id}
              className="w-full py-2.5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white text-sm font-bold transition-all disabled:opacity-50"
            >
              Iniciar guardia
            </button>
          </div>
        </div>
      )}

      {modalCambiar && guardiaCambiar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalCambiar(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4 keyboard-safe" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-brand-deep">Cambiar Guardia</h3>
              <button onClick={() => setModalCambiar(false)} aria-label="Cerrar" className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 text-sm">
              <p className="text-slate-500">Saliente:</p>
              <p className="font-semibold">{guardiaCambiar.medico_nombre}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Medico entrante</label>
                <select
                  value={formCambiar.medico_entrante_id}
                  onChange={(e) => setFormCambiar({ ...formCambiar, medico_entrante_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-base focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  <option value="">Seleccionar medico...</option>
                  {medicosDisponibles.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre} {m.apellido} - {m.especialidad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                <input
                  type="text"
                  value={formCambiar.observaciones}
                  onChange={(e) => setFormCambiar({ ...formCambiar, observaciones: e.target.value })}
                  placeholder="Motivo del cambio..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-base focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
            </div>
            <button
              onClick={handleCambiar}
              disabled={!formCambiar.medico_entrante_id}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all disabled:opacity-50"
            >
              Cambiar guardia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
