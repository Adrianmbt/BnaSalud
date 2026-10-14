import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Stethoscope,
  Activity,
  ClipboardList,
  Calendar,
  Clock,
  User,
  Hash,
  Pill,
  FlaskConical,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import PanelModal from './PanelModal';
import { exportarPdf } from './pdfUtils';
import axiosClient from '../../api/axiosClient';
import { useTheme } from '../ThemeProvider';

const SIGNOS_LABELS = [
  ['presion_arterial', 'P.A.', 'Heart'],
  ['frecuencia_cardiaca', 'F.C.', 'Activity'],
  ['frecuencia_respiratoria', 'F.R.', 'Wind'],
  ['temperatura', 'T°', 'Thermometer'],
  ['saturacion_oxigeno', 'SpO₂', 'Droplets'],
  ['peso_kg', 'Peso', 'Scale'],
  ['talla_cm', 'Talla', 'Ruler'],
];

export default function ConsultaFinalizadaModal({ abierto, onClose, consultaId }) {
  const { theme, centerName } = useTheme();
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [pdfGenerando, setPdfGenerando] = useState(null);

  useEffect(() => {
    if (!abierto || !consultaId) return;
    console.log('[ConsultaFinalizadaModal] Cargando detalle para consultaId:', consultaId);
    setCargando(true);
    setError(null);
    setDetalle(null);
    axiosClient
      .get(`/consultas/detalle/${consultaId}`)
      .then((r) => {
        console.log('[ConsultaFinalizadaModal] Detalle cargado OK:', r.data);
        setDetalle(r.data);
      })
      .catch((e) => {
        console.error('[ConsultaFinalizadaModal] Error cargando detalle:', e?.response?.status, e?.response?.data || e.message);
        setError(e?.response?.data?.detail || 'Error al cargar detalle de consulta.');
      })
      .finally(() => setCargando(false));
  }, [abierto, consultaId]);

  const handleExportar = async (modo) => {
    if (!detalle) return;
    setPdfGenerando(modo);
    try {
      await exportarPdf(detalle, modo, { tema: theme, centroNombre: centerName, servicio: 'Consulta Externa' });
    } catch (e) {
      console.error(e);
      setError('Error al generar PDF.');
    } finally {
      setPdfGenerando(null);
    }
  };

  if (!abierto) return null;

  const d = detalle || {};

  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="consulta-finalizada"
      titulo="Detalle de Consulta Finalizada"
      subtitulo={d.paciente_nombre || 'Cargando...'}
      icono={<FileText className="w-5 h-5" />}
      maxW="max-w-4xl"
    >
      {cargando && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          <span className="ml-3 text-sm text-slate-500 font-medium">Cargando consulta...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 mx-5 mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {!cargando && !error && detalle && (
        <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[calc(92vh-180px)]">
          {/* Ficha del paciente */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
              <span className="text-xs font-bold text-sky-700 tracking-wide uppercase">Datos del Paciente y Atención</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
              <InfoField icon={<User className="w-3.5 h-3.5" />} label="Paciente" value={d.paciente_nombre} />
              <InfoField icon={<Hash className="w-3.5 h-3.5" />} label="Cédula" value={d.paciente_cedula} />
              <InfoField icon={<Calendar className="w-3.5 h-3.5" />} label="Fecha" value={d.fecha ? new Date(d.fecha.replace(' ', 'T')).toLocaleDateString('es-VE') : '—'} />
              <InfoField icon={<Clock className="w-3.5 h-3.5" />} label="Hora" value={d.fecha ? new Date(d.fecha.replace(' ', 'T')).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—'} />
              <InfoField icon={<Stethoscope className="w-3.5 h-3.5" />} label="Médico" value={d.medico_nombre} />
              <InfoField icon={<ClipboardList className="w-3.5 h-3.5" />} label="Comprobante" value={d.comprobante_ref} />
              <InfoField icon={<Activity className="w-3.5 h-3.5" />} label="Especialidad" value={d.especialidad || 'Medicina General'} />
              <InfoField icon={<FileText className="w-3.5 h-3.5" />} label="Consulta ID" value={d.consulta_id?.slice(0, 8)} />
            </div>
          </div>

          {/* Signos vitales */}
          {d.signos_vitales && Object.values(d.signos_vitales).some((v) => v !== null && v !== undefined && v !== '') && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-700 tracking-wide uppercase">Signos Vitales</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2 p-4">
                {SIGNOS_LABELS.map(([key, label]) => {
                  const val = d.signos_vitales[key];
                  if (val === null || val === undefined || val === '') return null;
                  return (
                    <div key={key} className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-center">
                      <div className="text-[10px] font-bold text-sky-600 uppercase">{label}</div>
                      <div className="text-sm font-bold text-slate-800">{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivo + Examen */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
              <span className="text-xs font-bold text-sky-700 tracking-wide uppercase">Motivo de Consulta y Examen Físico</span>
            </div>
            <div className="p-4 space-y-3">
              <DetailBlock label="Motivo de consulta" value={d.motivo_consulta} />
              <DetailBlock label="Examen físico" value={d.examen_fisico} />
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
              <span className="text-xs font-bold text-sky-700 tracking-wide uppercase">Diagnóstico Clínico (CIE-10)</span>
            </div>
            <div className="p-4">
              <div className="flex items-baseline gap-2">
                {d.cie10_codigo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-deep/10 text-brand-deep text-xs font-bold">
                    {d.cie10_codigo}
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-800">{d.cie10_descripcion || '—'}</span>
              </div>
              {d.diagnostico_secundario && (
                <p className="mt-2 text-xs text-slate-500">Secundario: {d.diagnostico_secundario}</p>
              )}
            </div>
          </div>

          {/* Tratamiento aplicado */}
          {((d.insumos_aplicados || []).length > 0 || d.tratamiento) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-700 tracking-wide uppercase flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5" />
                  Tratamiento Aplicado
                </span>
              </div>
              <div className="p-4 space-y-2">
                {d.tratamiento && <p className="text-sm text-slate-700">{d.tratamiento}</p>}
                {(d.insumos_aplicados || []).map((ins, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-medium text-slate-700">{ins.nombre || ins.insumo_nombre}</span>
                    <span className="text-slate-400">×{ins.cantidad || 1}</span>
                    {ins.unidad && <span className="text-xs text-slate-400">{ins.unidad}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recetas */}
          {(d.recetas || []).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-700 tracking-wide uppercase flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5" />
                  Recetas Médicas
                </span>
              </div>
              <div className="p-4 space-y-2">
                {d.recetas.filter((r) => r?.nombre).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand-deep/10 text-brand-deep text-[10px] font-bold shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <span className="font-medium text-slate-700">{r.nombre}</span>
                      {r.posologia && (
                        <span className="ml-2 text-slate-500">— {r.posologia}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Órdenes de exámenes */}
          {((d.laboratorios || []).length > 0 || (d.estudios || []).length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-700 tracking-wide uppercase flex items-center gap-2">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Órdenes de Exámenes
                </span>
              </div>
              <div className="p-4 space-y-2">
                {(d.laboratorios || []).map((e, i) => (
                  <div key={`lab-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">LAB</span>
                    <span className="font-medium text-slate-700">{e.estudio || e.nombre}</span>
                    {e.indicacion && <span className="text-slate-400 text-xs">— {e.indicacion}</span>}
                  </div>
                ))}
                {(d.estudios || []).map((e, i) => (
                  <div key={`est-${i}`} className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      String(e.tipo || '').toUpperCase() === 'IMAGEN' ? 'bg-purple-100 text-purple-700'
                      : String(e.tipo || '').toUpperCase() === 'ANATOMIA_PATOLOGICA' ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {String(e.tipo || '').toUpperCase() === 'IMAGEN' ? 'IMG'
                        : String(e.tipo || '').toUpperCase() === 'ANATOMIA_PATOLOGICA' ? 'ANAT.PAT'
                        : 'FUNC'}
                    </span>
                    <span className="font-medium text-slate-700">{e.estudio || e.nombre}</span>
                    {e.indicacion && <span className="text-slate-400 text-xs">— {e.indicacion}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {d.recomendaciones && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-700 tracking-wide uppercase">Recomendaciones</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-slate-700 whitespace-pre-line">{d.recomendaciones}</p>
              </div>
            </div>
          )}

          {/* 3 Botones de exportación PDF */}
          <div className="flex flex-wrap gap-3 pt-2 pb-4 border-t border-slate-100">
            <PdfButton
              icon={<Printer className="w-4 h-4" />}
              label="Órdenes Exámenes"
              loading={pdfGenerando === 'examenes'}
              disabled={!!pdfGenerando}
              onClick={() => handleExportar('examenes')}
              color="purple"
            />
            <PdfButton
              icon={<Pill className="w-4 h-4" />}
              label="Recetas + Indicaciones"
              loading={pdfGenerando === 'recetas'}
              disabled={!!pdfGenerando}
              onClick={() => handleExportar('recetas')}
              color="emerald"
            />
            <PdfButton
              icon={<FileText className="w-4 h-4" />}
              label="PDF Completo"
              loading={pdfGenerando === 'completo'}
              disabled={!!pdfGenerando}
              onClick={() => handleExportar('completo')}
              color="sky"
            />
          </div>
        </div>
      )}
    </PanelModal>
  );
}

function InfoField({ icon, label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-800 truncate">{value || '—'}</div>
    </div>
  );
}

function DetailBlock({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{value}</p>
    </div>
  );
}

function PdfButton({ icon, label, loading, disabled, onClick, color }) {
  const colors = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    sky: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colors[color]}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
