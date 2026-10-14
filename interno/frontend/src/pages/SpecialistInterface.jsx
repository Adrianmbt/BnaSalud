import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Stethoscope,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CalendarClock,
  Users,
  ListChecks,
  Activity,
  ArrowLeft,
  User,
  Clock3,
  Droplets,
  ClipboardList,
  History,
  Siren,
  FlaskConical,
  CalendarDays,
  Pill,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import QueueTable from '../components/specialist/QueueTable';
import { useTheme } from '../components/ThemeProvider';
import SpecialtyBadge from '../components/SpecialtyBadge';
import { emergenciaConTratamiento } from '../components/specialist/HistoryPanel';
import { examenesVacios } from '../components/specialist/ExamOrderPanel';
import ConsultaFormSection from '../components/specialist/ConsultaFormSection';
import ClinicalFormCard from '../components/specialist/ClinicalFormCard';
import SignosVitalesSection, { SIGNOS_VACIOS } from '../components/specialist/SignosVitalesSection';
import FollowUpModal from '../components/specialist/FollowUpModal';
import ConsultasPreviasModal from '../components/specialist/ConsultasPreviasModal';
import VerHistorial from '../components/specialist/VerHistorial';
import ExamenesPreviosModal from '../components/specialist/ExamenesPreviosModal';
import MedicalOrderSelector, { examenesASeleccionados, seleccionadosAExamenes } from '../components/specialist/MedicalOrderSelector';
import PanelModal from '../components/specialist/PanelModal';
import PostponeModal from '../components/specialist/PostponeModal';
import ConsultaFinalizadaModal from '../components/specialist/ConsultaFinalizadaModal';
import { n2num, esRegistroEmergencia } from '../components/specialist/specialistMeta';

const FORM_VACIOS = {
  motivo: '',
  examenFisico: '',
  diagnostico: '',
  tratamiento: '',
  indicaciones: '',
};

const atiende = (items = []) => items || [];

function parseLista(valor) {
  if (Array.isArray(valor)) return valor.map((s) => String(s).trim()).filter(Boolean);
  return String(valor || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SpecialistInterface({
  userName = 'Especialista',
  especialidad = '',
  personalId = null,
  clinicaId = null,
  clinicaNombre = '',
  onLogout,
}) {
  const { centerLogo } = useTheme();
  const [cola, setCola] = useState({ espera: [], consulta: [], finalizado: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [seleccionado, setSeleccionado] = useState(null);
  const [enAtencion, setEnAtencion] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [emergencia, setEmergencia] = useState(null);
  const [cumplimiento, setCumplimiento] = useState(null);

  const [historia, setHistoria] = useState(null);
  const [consultasPrevias, setConsultasPrevias] = useState([]);
  const [previasCargando, setPreviasCargando] = useState(false);

  const [signos, setSignos] = useState(SIGNOS_VACIOS);
  const [form, setForm] = useState(FORM_VACIOS);
  const [recetas, setRecetas] = useState([{ nombre: '', posologia: '' }]);
  const [examenes, setExamenes] = useState(examenesVacios());

  const [postponeAbierto, setPostponeAbierto] = useState(false);
  const [examenesAbierto, setExamenesAbierto] = useState(false);
  const [aplicados, setAplicados] = useState([{ nombre: '', posologia: '' }]);
  const [followUpAbierto, setFollowUpAbierto] = useState(false);
  const [previasAbierto, setPreviasAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [examenesPreviosAbierto, setExamenesPreviosAbierto] = useState(false);
  const [revisionExamenes, setRevisionExamenes] = useState([]);
  const [examSeleccionados, setExamSeleccionados] = useState(new Map());
  const [consultaFinalizadaId, setConsultaFinalizadaId] = useState(null);
  const [proximaConsulta, setProximaConsulta] = useState('');
  const [contadorHoy, setContadorHoy] = useState(null);
  const [mostrandoFecha, setMostrandoFecha] = useState(false);
  const [seccion, setSeccion] = useState('signos');

  const cargadoRef = useRef(false);
  const formRef = useRef(null);

  const fetchCola = useCallback(async () => {
    try {
      const params = { especialidad, rol: 'medico' };
      if (personalId) params.medico_id = personalId;
      if (clinicaId) params.clinica_id = clinicaId;
      const { data } = await axiosClient.get('/cola', { params });
      const finalizadoItems = atiende(data.finalizado);
      finalizadoItems.forEach(p => {
        console.log(`[fetchCola] finalizado: id=${p.id} nombre="${p.paciente_nombre}" consulta_id=${p.consulta_id} cita_id=${p.cita_id}`);
      });
      setCola({
        espera: atiende(data.espera),
        consulta: atiende(data.consulta),
        finalizado: finalizadoItems,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar la cola de la especialidad.');
    } finally {
      cargadoRef.current = true;
      setLoading(false);
    }
  }, [especialidad, personalId, clinicaId]);

  const fetchContadorHoy = useCallback(async () => {
    if (!personalId) return;
    try {
      const { data } = await axiosClient.get(`/consultas/contador-hoy/${personalId}`);
      setContadorHoy(data.total || 0);
    } catch {
      setContadorHoy(null);
    }
  }, [personalId]);

  useEffect(() => {
    fetchCola();
  }, [fetchCola]);

  useEffect(() => {
    const sondeo = setInterval(() => {
      fetchCola();
    }, 10000);
    return () => clearInterval(sondeo);
  }, [fetchCola]);

  useEffect(() => {
    if (!enAtencion || !seleccionado) return undefined;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enAtencion, seleccionado]);

  const resetForm = (paciente) => {
    setSignos(SIGNOS_VACIOS);
    setForm({
      ...FORM_VACIOS,
      motivo: paciente?.motivo_consulta || '',
    });
    setRecetas([{ nombre: '', posologia: '' }]);
    setExamenes(examenesVacios());
    setCumplimiento(null);
    setEmergencia(null);
    setSegundos(0);
  };

  const abrirAtencion = async (paciente) => {
    setSeleccionado(paciente);
    setError('');
    setAviso('');
    resetForm(paciente);
    setHistoria(null);
    setConsultasPrevias([]);
    setEnAtencion(true);

    if (paciente?.paciente_cedula) {
      try {
        const { data } = await axiosClient.get(`/historias-clinicas/${paciente.paciente_cedula}`);
        setHistoria(data);
      } catch {
        setHistoria(null);
      }
    }

    if (paciente?.paciente_id) {
      setPreviasCargando(true);
      try {
        const { data } = await axiosClient.get(`/consultas/${paciente.paciente_id}`);
        setConsultasPrevias(Array.isArray(data) ? data : []);
      } catch {
        setConsultasPrevias([]);
      } finally {
        setPreviasCargando(false);
      }
    }

    if (paciente?.atencion_estado === 'EN_ESPERA_CONSULTA') {
      try {
        await axiosClient.patch(`/cola/${paciente.id}/transicion`, {
          nuevo_estado: 'EN_CONSULTA',
          cambiado_por: personalId,
        });
        setSeleccionado((s) => (s ? { ...s, atencion_estado: 'EN_CONSULTA' } : s));
        await fetchCola();
      } catch (err) {
        setError(err?.response?.data?.detail || 'No se pudo iniciar la consulta.');
      }
    }
  };

  useEffect(() => {
    setEmergencia(emergenciaConTratamiento(consultasPrevias));
  }, [consultasPrevias]);

  const referenciaEmergencia = useMemo(() => {
    const list = (Array.isArray(consultasPrevias) ? consultasPrevias : [])
      .filter((c) => esRegistroEmergencia(c.especialidad))
      .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
    return list[list.length - 1] || null;
  }, [consultasPrevias]);

  const examenesPrevios = useMemo(() => {
    if (!referenciaEmergencia) return [];
    const labs = Array.isArray(referenciaEmergencia.laboratorios) ? referenciaEmergencia.laboratorios : [];
    const ests = Array.isArray(referenciaEmergencia.estudios) ? referenciaEmergencia.estudios : [];
    return [...labs, ...ests].filter((e) => e.estudio || e.nombre);
  }, [referenciaEmergencia]);

  useEffect(() => {
    if (examenesPrevios.length > 0 && revisionExamenes.length === 0) {
      setRevisionExamenes(examenesPrevios.map(() => ({ revisado: null, observacion: '' })));
    }
  }, [examenesPrevios]);

  const reSolicitarExamenes = (consulta) => {
    const mapear = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .filter((i) => i.estudio || i.nombre)
        .map((i) => ({ estudio: i.estudio || i.nombre, indicacion: i.indicacion || '', resultado: '' }));
    const labs = mapear(consulta.laboratorios);
    const imgs = mapear((consulta.estudios || []).filter((e) => e.tipo === 'IMAGEN'));
    const funcs = mapear((consulta.estudios || []).filter((e) => e.tipo === 'FUNCIONAL'));
    const nuevosExamenes = {
      laboratorio: { activo: labs.length > 0, items: labs },
      imagen: { activo: imgs.length > 0, items: imgs },
      funcional: { activo: funcs.length > 0, items: funcs },
    };
    setExamenes(nuevosExamenes);
    setExamSeleccionados(examenesASeleccionados(nuevosExamenes));
    setPreviasAbierto(false);
    setExamenesAbierto(true);
    setAviso('Se cargaron los exámenes de la cita anterior para re-solicitar.');
  };

  const finalizarConsulta = async (fechaProxima) => {
    if (!seleccionado) return;
    if (!form.diagnostico.trim()) {
      setError('El diagnóstico es obligatorio para cerrar la consulta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const insumos = [];
      if (emergencia && cumplimiento && (cumplimiento.cumple || (cumplimiento.nota || '').trim())) {
        insumos.push({
          tipo: 'cumplimiento_tratamiento',
          origen_consulta_id: emergencia.consulta_id || null,
          tratamiento: emergencia.tratamiento,
          cumplio: cumplimiento.cumple || null,
          nota: (cumplimiento.nota || '').trim(),
        });
      }
      if (examenesPrevios.length > 0 && revisionExamenes.length > 0) {
        const revisiones = examenesPrevios.map((ex, idx) => ({
          estudio: ex.estudio || ex.nombre,
          revisado: revisionExamenes[idx]?.revisado ?? null,
        }));
        const obsGeneral = (revisionExamenes[revisionExamenes.length - 1]?.observacion || '').trim();
        insumos.push({
          tipo: 'revision_examenes_previos',
          origen_consulta_id: referenciaEmergencia?.consulta_id || null,
          revisiones,
          ...(obsGeneral ? { observacion: obsGeneral } : {}),
        });
      }
      aplicados
        .filter((a) => a.nombre.trim())
        .forEach((a) => {
          insumos.push({
            tipo: 'medicamento',
            nombre: a.nombre.trim(),
            posologia: a.posologia.trim(),
            ...(a.insumo_id ? { insumo_id: a.insumo_id } : {}),
            ...(a.tabla_origen ? { tabla_origen: a.tabla_origen } : {}),
          });
        });

      const payload = {
        paciente_id: seleccionado.paciente_id,
        cola_id: seleccionado.id,
        cita_id: seleccionado.cita_id || null,
        medico_id: personalId || null,
        medico_nombre: userName,
        especialidad,
        motivo_consulta: form.motivo.trim() || seleccionado.motivo_consulta || null,
        enfermedad_actual: form.motivo.trim() || seleccionado.motivo_consulta || null,
        examen_fisico: form.examenFisico.trim() || null,
        signos_vitales: {
          presion_arterial: signos.presion_arterial.trim() || null,
          frecuencia_cardiaca: n2num(signos.frecuencia_cardiaca),
          frecuencia_respiratoria: n2num(signos.frecuencia_respiratoria),
          temperatura: n2num(signos.temperatura),
          saturacion_oxigeno: n2num(signos.saturacion_oxigeno),
          peso_kg: n2num(signos.peso_kg),
          talla_cm: n2num(signos.talla_cm),
        },
        diagnostico_principal: form.diagnostico.trim() || null,
        cie10_descripcion: form.diagnostico.trim() || null,
        tratamiento: form.tratamiento.trim() || null,
        indicaciones_medicas: form.indicaciones.trim() || null,
        recomendaciones: form.indicaciones.trim() || null,
        recetas: recetas
          .filter((r) => r.nombre.trim())
          .map((r) => ({ nombre: r.nombre.trim(), posologia: r.posologia.trim() })),
        laboratorios: examenes.laboratorio.activo
          ? examenes.laboratorio.items
              .filter((i) => i.estudio.trim())
              .map((i) => ({
                tipo: 'LABORATORIO',
                estudio: i.estudio.trim(),
                indicacion: i.indicacion.trim(),
                ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
              }))
          : [],
        estudios: [
          ...(examenes.imagen.activo
            ? examenes.imagen.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'IMAGEN',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
          ...(examenes.funcional.activo
            ? examenes.funcional.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'FUNCIONAL',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
          ...(examenes.anatomia_patologica?.activo
            ? examenes.anatomia_patologica.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'ANATOMIA_PATOLOGICA',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
        ],
        insumos,
      };

      const consultaResp = await axiosClient.post('/consultas', payload);
      const consultaIdCreada = consultaResp.data?.id;
      console.log('[finalizarConsulta] consultaIdCreada:', consultaIdCreada, 'cola_id:', seleccionado.id);

      if (consultaIdCreada && seleccionado.id) {
        try {
          const patchResp = await axiosClient.put(`/cola/${seleccionado.id}/consulta`, {
            consulta_id: consultaIdCreada,
          });
          console.log('[finalizarConsulta] PUT vincular consulta OK:', patchResp.data);
        } catch (patchErr) {
          console.error('[finalizarConsulta] PUT vincular consulta FAILED:', patchErr?.response?.status, patchErr?.response?.data || patchErr.message);
        }
      }

      const estadoActual = seleccionado.atencion_estado;
      if (estadoActual === 'EN_ESPERA_CONSULTA') {
        await axiosClient.patch(`/cola/${seleccionado.id}/transicion`, {
          nuevo_estado: 'EN_CONSULTA',
          cambiado_por: personalId,
        });
      }
      await axiosClient.patch(`/cola/${seleccionado.id}/transicion`, {
        nuevo_estado: 'FINALIZADO',
        cambiado_por: personalId,
      });

      setAviso('Consulta finalizada y registrada en el expediente.');
      setEnAtencion(false);
      setSeleccionado(null);
      setMostrandoFecha(false);
      setProximaConsulta('');
      resetForm();
      await fetchCola();
    } catch (err) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'No se pudo guardar la consulta. Verifica los datos.');
    } finally {
      setBusy(false);
    }
  };

  const cerrarAtencion = () => {
    if (busy) return;
    setEnAtencion(false);
    setSeleccionado(null);
    resetForm();
  };

  const finalizarDesdeCola = async (paciente) => {
    if (!paciente) return;
    setBusy(true);
    setError('');
    try {
      await axiosClient.patch(`/cola/${paciente.id}/transicion`, {
        nuevo_estado: 'FINALIZADO',
        cambiado_por: personalId,
      });
      setAviso(`${paciente.paciente_nombre || 'El paciente'} fue finalizado directamente desde la cola.`);
      await fetchCola();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo finalizar la consulta desde la cola.');
    } finally {
      setBusy(false);
    }
  };

  const setFormCampo = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSigno = (k, v) => setSignos((s) => ({ ...s, [k]: v }));

  const enEspera = cola.espera.length;
  const enConsulta = cola.consulta.length;
  const totalRestantes = enEspera + enConsulta;
  const alergias = parseLista(historia?.alergias);
  const antecedentes = parseLista(historia?.antecedentes_medicos);

  return (
    <div className="min-h-screen bg-brand-surface font-sans">
      <a href="#sp-main" className="skip-link">Saltar al contenido principal</a>

      {/* ===== HEADER con identidad ===== */}
      <header aria-label="Consulta de Especialista · Salud Barcelona" className="safe-top sticky top-0 z-40 brand-orbit text-white shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-8 py-2">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg overflow-hidden ring-2 ring-white/25 shadow bg-white flex items-center justify-center shrink-0">
              {centerLogo ? (
                <img src={centerLogo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              ) : (
                <Stethoscope className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              )}
            </div>
            <h1 className="font-display font-extrabold text-[13px] sm:text-[15px] uppercase leading-[1.08] tracking-[0.14em] whitespace-nowrap">
              <span className="block">Salud</span>
              <span className="block font-semibold text-white/75">Barcelona</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 min-w-0 shrink">
            <SpecialtyBadge specialty={especialidad} size="sm" light ocultarTexto />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-semibold">
              <Users className="w-3.5 h-3.5 text-sky-200" />
              {totalRestantes} en cola
            </span>
            {!enAtencion && (
              <button
                type="button"
                onClick={() => setPostponeAbierto(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-all shadow-sm"
                title="Postponer todas las citas restantes"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Postponer citas</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchCola}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Refrescar cola"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-white/15">
              <div className="h-7 w-7 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center font-display font-semibold text-[11px] uppercase">
                {(userName || 'E').trim().charAt(0)}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold">{userName}</div>
                <div className="text-[9px] text-white/70">Especialista</div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="ml-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 ring-1 ring-white/15 transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden lg:inline">Salir</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="sp-main" className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-4 pb-24 flex flex-col gap-3">
        {/* Alertas */}
        {(error || aviso) && (
          <div
            className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ring-1 animate-fade-up shrink-0 ${
              error
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
            role={error ? 'alert' : 'status'}
          >
            {error ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            )}
            <span className="flex-1">{error || aviso}</span>
            <button onClick={() => (error ? setError('') : setAviso(''))} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
        )}

        {enAtencion && seleccionado ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            {/* ============ COLUMNA PRINCIPAL ============ */}
            <div className="flex flex-col gap-3 min-w-0" ref={formRef}>
              {/* ---------- Cabecera del paciente (compacta) ---------- */}
              <section
                aria-label="Paciente en atención"
                className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden shrink-0"
              >
                <div className="px-4 py-2.5 flex items-center gap-3 border-l-4 border-brand-primary">
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-lg bg-sky-100 ring-2 ring-sky-300 flex items-center justify-center">
                      <User className="w-4 h-4 text-sky-600" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-success ring-[2px] ring-white" />
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap">
                    <h2 className="font-display font-bold text-sm text-brand-deep truncate">
                      {seleccionado.paciente_nombre} {seleccionado.apellido || ''}
                    </h2>
                    <span className="text-[9px] font-mono text-slate-400">C.I. {seleccionado.paciente_cedula}</span>
                    {historia?.numero_historia && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">N.° {historia.numero_historia}</span>
                    )}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-[9px] font-bold text-emerald-700 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                      EN CONSULTA
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-display font-bold text-sm text-brand-deep tabular-nums">
                        {`${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-brand-danger" />
                      <span className="font-display font-bold text-sm text-brand-deep uppercase">{historia?.tipo_sangre || '—'}</span>
                    </div>
                    {alergias.length > 0 && (
                      <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-rose-600 truncate" title={alergias.join(', ')}>{alergias.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ---------- Tabs de sección ---------- */}
              <div
                className="flex gap-1 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/60 shrink-0"
                role="tablist"
                aria-label="Secciones de la consulta"
              >
                {[
                  { id: 'signos', etiqueta: 'Signos vitales', icono: Activity },
                  { id: 'clinica', etiqueta: 'Ficha clínica', icono: Stethoscope },
                  { id: 'tratamiento', etiqueta: 'Tratamiento', icono: Pill },
                ].map((t) => {
                  const Icono = t.icono;
                  const activa = seccion === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={activa}
                      onClick={() => setSeccion(t.id)}
                      className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-full text-[8px] sm:text-xs font-bold transition-all min-w-0 sm:flex-row sm:gap-2 sm:px-3.5 ${activa ? 'shadow-sm' : 'text-slate-500 hover:text-brand-deep'}`}
                      style={activa ? { background: '#1A4B7C', color: '#fff' } : undefined}
                    >
                      <Icono className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="uppercase sm:normal-case leading-tight inline-block">{t.etiqueta}</span>
                    </button>
                  );
                })}
              </div>

              {seccion === 'signos' && (
                <SignosVitalesSection
                  signos={signos}
                  setSigno={setSigno}
                  referencia={referenciaEmergencia?.signos_vitales || null}
                  referenciaFecha={referenciaEmergencia?.fecha || null}
                />
              )}
              {seccion === 'clinica' && <ClinicalFormCard form={form} setForm={setFormCampo} />}
              {seccion === 'tratamiento' && (
                <ConsultaFormSection
                  form={form}
                  setForm={setFormCampo}
                  recetas={recetas}
                  onRecetas={setRecetas}
                  aplicados={aplicados}
                  onAplicados={setAplicados}
                />
              )}
            </div>

            {/* ============ COLUMNA LATERAL — acciones ============ */}
            <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
              <div className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 space-y-3" style={{ animationDelay: '90ms' }}>
                <h3 className="font-display font-bold text-sm text-brand-deep">Expediente y seguimiento</h3>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviasAbierto(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-brand-deep/30 text-brand-deep hover:bg-brand-deep/5 font-bold text-xs transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    Consultas previas
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistorialAbierto(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-brand-primary/40 text-brand-primary hover:bg-brand-primary/5 font-bold text-xs transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    Historial completo
                  </button>
                  <div className="pt-1.5 mt-1.5 border-t border-slate-100 space-y-1.5">
                    {emergencia && (
                      <button
                        type="button"
                        onClick={() => setFollowUpAbierto(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-red-300 text-red-700 hover:bg-red-50 font-bold text-xs transition-all relative"
                      >
                        <Siren className="w-3.5 h-3.5" />
                        <span className="flex-1 text-left">Seguimiento</span>
                        {cumplimiento?.cumple ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" title="Pendiente" />
                        )}
                      </button>
                    )}
                    {examenesPrevios.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExamenesPreviosAbierto(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-violet-300 text-violet-700 hover:bg-violet-50 font-bold text-xs transition-all relative"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span className="flex-1 text-left">Exámenes anteriores</span>
                        {revisionExamenes.some((r) => r.revisado !== null) ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">OK</span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" title="Pendiente" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 space-y-3" style={{ animationDelay: '120ms' }}>
                <h3 className="font-display font-bold text-sm text-brand-deep">Registros</h3>
                <button
                  type="button"
                  onClick={() => { setExamSeleccionados(examenesASeleccionados(examenes)); setExamenesAbierto(true); }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-sky-500/40 text-sky-600 hover:bg-sky-500/5 font-bold text-xs transition-all"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  Órdenes de exámenes
                </button>
              </div>

              <div className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 space-y-3" style={{ animationDelay: '150ms' }}>
                <h3 className="font-display font-bold text-sm text-brand-deep">Cierre de la consulta</h3>
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 space-y-3">
                  {!mostrandoFecha ? (
                    <button
                      type="button"
                      onClick={() => { setMostrandoFecha(true); fetchContadorHoy(); }}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-brand-deep/25 text-brand-deep hover:bg-brand-deep/5 font-bold text-xs transition-all"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      Fijar próxima consulta
                    </button>
                  ) : (
                    <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                      <div>
                        <label htmlFor="sp-proxima" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                          Próxima consulta
                        </label>
                        <input
                          id="sp-proxima"
                          type="date"
                          className="cp-input !text-xs"
                          value={proximaConsulta}
                          min={new Date().toLocaleDateString('en-CA')}
                          onChange={(e) => setProximaConsulta(e.target.value)}
                        />
                      </div>
                      {contadorHoy !== null && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {contadorHoy} consultas hoy
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={confirmarProximaConsulta}
                        disabled={!proximaConsulta || busy}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-brand-deep text-white hover:bg-brand-primary disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition-all"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirmar próxima consulta
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMostrandoFecha(false); setProximaConsulta(''); }}
                        className="w-full inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  <p className="text-[8px] text-slate-400 text-center">La fecha quedará registrada y visible en la cola del paciente.</p>

                  <button
                    type="button"
                    onClick={finalizarConsulta}
                    disabled={busy || !form.diagnostico?.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-success text-white hover:bg-brand-success/90 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs shadow-sm transition-all"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Finalizar y guardar
                  </button>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Resumen: 3 pills compactos. Sin iconos: el color y la etiqueta ya dicen
                qué es cada cifra, y el icono robaba 28px de alto a cada uno.
                Etiquetas cortas y sin tracking: a 360px cada columna sale de
                ~104px y "ATENDIDOS HOY" con tracking no cabia -> wrap dentro de
                la pill y la tercera se veia aplastada. */}
            <div className="grid grid-cols-3 gap-1.5 animate-fade-up">
              <div className="rounded-full bg-white ring-1 ring-slate-200 px-2 py-1.5 flex flex-col items-center text-center shadow-sm">
                <p className="text-lg sm:text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{enEspera}</p>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase mt-0.5 leading-tight">En espera</p>
              </div>
              <div className="rounded-full bg-white ring-1 ring-slate-200 px-2 py-1.5 flex flex-col items-center text-center shadow-sm">
                <p className="text-lg sm:text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{enConsulta}</p>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase mt-0.5 leading-tight">En consulta</p>
              </div>
              <div className="rounded-full bg-white ring-1 ring-slate-200 px-2 py-1.5 flex flex-col items-center text-center shadow-sm">
                <p className="text-lg sm:text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{cola.finalizado.length}</p>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase mt-0.5 leading-tight">Atendidos</p>
              </div>
            </div>

            {/* DataTable de cola */}
            <QueueTable grupos={cola} cargando={loading && !cargadoRef.current} onAtender={abrirAtencion} onFinalizar={finalizarDesdeCola} onVerDetalle={(p) => setConsultaFinalizadaId(p.consulta_id)} />
          </div>
        )}
      </main>

      {/* ============ BARRA INFERIOR FIJA (en atención) ============ */}
      {enAtencion && seleccionado && (
        <footer className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-5 py-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-semibold truncate">
              {seleccionado.paciente_nombre} · <span className="text-emerald-600">En consulta</span>
            </span>
            <button
              type="button"
              onClick={cerrarAtencion}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a la cola
            </button>
          </div>
        </footer>
      )}

      {/* Postpone */}
      <PostponeModal
        abierto={postponeAbierto}
        onClose={() => setPostponeAbierto(false)}
        medicoId={personalId}
        enEspera={enEspera}
        enConsulta={enConsulta}
        onPostpuesto={(data) => {
          setAviso(`Se reprogramaron ${data.movidas} cita(s). La cola se ha actualizado.`);
          fetchCola();
        }}
      />

      {/* Órdenes de exámenes */}
      <PanelModal
        abierto={examenesAbierto}
        onClose={() => {
          setExamenes(seleccionadosAExamenes(examSeleccionados));
          setExamenesAbierto(false);
        }}
        id="sp-examenes-modal"
        titulo="Órdenes de exámenes"
        subtitulo="Selecciona laboratorio, imagen, funcionales o anatomía patológica"
        icono={<ListChecks className="w-5 h-5" />}
        maxW="max-w-3xl"
      >
        <MedicalOrderSelector
          seleccionados={examSeleccionados}
          onSeleccionados={setExamSeleccionados}
        />
      </PanelModal>

      {/* Seguimiento tratamiento de emergencia */}
      <FollowUpModal
        abierto={followUpAbierto}
        onClose={() => setFollowUpAbierto(false)}
        consulta={emergencia}
        cumplimiento={cumplimiento}
        onCumplimiento={setCumplimiento}
        onGuardar={() => setFollowUpAbierto(false)}
      />

      {/* Consultas previas */}
      <ConsultasPreviasModal
        abierto={previasAbierto}
        onClose={() => setPreviasAbierto(false)}
        consultasPrevias={consultasPrevias}
        previasCargando={previasCargando}
        onReSolicitar={reSolicitarExamenes}
      />

      {/* Exámenes anteriores del paciente */}
      <ExamenesPreviosModal
        abierto={examenesPreviosAbierto}
        onClose={() => setExamenesPreviosAbierto(false)}
        examenesPrevios={examenesPrevios}
        revisionExamenes={revisionExamenes}
        onRevisionExamenes={setRevisionExamenes}
        onGuardar={() => setExamenesPreviosAbierto(false)}
      />

      {/* Historial multi-centro */}
      <PanelModal
        abierto={historialAbierto}
        onClose={() => setHistorialAbierto(false)}
        id="sp-historial-modal"
        titulo="Historial del paciente"
        subtitulo="Consultas registradas en todos los centros de la red"
        icono={<History className="w-5 h-5" />}
        maxW="max-w-3xl"
      >
        <VerHistorial pacienteId={seleccionado?.paciente_id || null} />
      </PanelModal>

      {/* Detalle de consulta finalizada */}
      <ConsultaFinalizadaModal
        abierto={!!consultaFinalizadaId}
        onClose={() => setConsultaFinalizadaId(null)}
        consultaId={consultaFinalizadaId}
      />
    </div>
  );
}