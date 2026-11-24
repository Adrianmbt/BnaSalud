import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ClipboardList,
  FileHeart,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { obtenerPaciente } from '../../api/historiasMedicas';
import { useTheme } from '../ThemeProvider';
import { exportarHistoriaPdf } from './reporteIntegralPdf';
import FichaIntegralForm from './FichaIntegralForm';
import AtencionIntegralForm from './AtencionIntegralForm';
import RepososPanel from './RepososPanel';

const TABS = [
  { id: 'ficha', label: 'Ficha integral', icon: FileHeart },
  { id: 'atencion', label: 'Nueva atención', icon: Activity },
  { id: 'historial', label: 'Historial', icon: ClipboardList },
  { id: 'reposos', label: 'Reposos', icon: FileText },
];

const fechaHora = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function Dato({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xs text-slate-700 break-words">{value || '—'}</p>
    </div>
  );
}

function HistorialAtenciones({ atenciones }) {
  if (!atenciones?.length) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Este paciente aún no tiene atenciones de historia integral.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {atenciones.map((a) => {
        const signos = a.signos_vitales || {};
        return (
          <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                  {a.comprobante_ref || 'Atención'}
                </span>
                <span className="text-[11px] text-slate-400">{fechaHora(a.created_at)}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {a.medico_nombre || 'Sin médico'}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Dato label="Motivo" value={a.motivo_consulta} />
              <Dato label="Examen físico" value={a.examen_fisico} />
              <Dato
                label="Diagnóstico"
                value={[a.cie10_codigo, a.cie10_descripcion].filter(Boolean).join(' · ')}
              />
              <Dato label="Diagnóstico secundario" value={a.diagnostico_secundario} />
              <Dato label="Tratamiento" value={a.tratamiento} className="sm:col-span-2" />
              {a.recetas?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Recetas médicas
                  </p>
                  <ul className="mt-1 space-y-1">
                    {a.recetas.map((r, i) => (
                      <li key={i} className="text-xs text-slate-700">
                        <span className="font-semibold">{r.nombre}</span>
                        {r.posologia ? ` · ${r.posologia}` : ''}
                        {r.cantidad ? ` · ${r.cantidad} unidad(es)` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Dato label="Recomendaciones" value={a.recomendaciones} className="sm:col-span-2" />
              <Dato label="Próxima consulta" value={a.proxima_consulta} />
            </div>

            {a.reposo && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Reposo emitido · {a.reposo.folio}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {a.reposo.dias} día(s) · {a.reposo.fecha_inicio} al {a.reposo.fecha_fin}
                </p>
                {a.reposo.descripcion && (
                  <p className="text-[11px] text-amber-700 mt-0.5">{a.reposo.descripcion}</p>
                )}
              </div>
            )}

            {Object.keys(signos).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  ['presion_arterial', 'P.A.'],
                  ['frecuencia_cardiaca', 'F.C.'],
                  ['frecuencia_respiratoria', 'F.R.'],
                  ['temperatura', 'T°'],
                  ['saturacion_oxigeno', 'SpO₂'],
                  ['peso_kg', 'Peso'],
                  ['talla_cm', 'Talla'],
                ]
                  .filter(([key]) => signos[key] !== undefined && signos[key] !== null)
                  .map(([key, label]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                    >
                      {label}: {signos[key]}
                    </span>
                  ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function PacienteDetallePanel({
  historiaId,
  personalId = null,
  colaId = null,
  medicoSugeridoId = null,
  onVolver,
}) {
  const { theme } = useTheme();
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ficha');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDetalle(await obtenerPaciente(historiaId));
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar la ficha del paciente.');
      setDetalle(null);
    } finally {
      setCargando(false);
    }
  }, [historiaId]);

  useEffect(() => {
    setTab('ficha');
    cargar();
  }, [cargar]);

  const imprimir = async () => {
    if (!detalle) return;
    setGenerandoPdf(true);
    try {
      await exportarHistoriaPdf({
        paciente: detalle.paciente,
        ficha: detalle.ficha,
        reposos: detalle.reposos,
        tema: theme,
      });
    } finally {
      setGenerandoPdf(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando paciente…
      </div>
    );
  }

  if (error || !detalle) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          {error || 'Paciente no encontrado.'}
        </div>
        <button
          type="button"
          onClick={onVolver}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Volver a la búsqueda
        </button>
      </div>
    );
  }

  const { paciente, ficha, atenciones, reposos } = detalle;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onVolver}
              className="text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-brand-primary mb-1"
            >
              ← Volver a la búsqueda
            </button>
            <h2 className="font-display font-bold text-lg text-slate-800 truncate">
              {paciente.nombre_completo}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-xs font-bold text-brand-deep">
                {paciente.tipo_cedula || 'V'}-{paciente.cedula}
              </span>
              {paciente.tiene_ficha ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  Ficha v{ficha?.version || 1}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                  Sin ficha integral
                </span>
              )}
              {paciente.es_trabajador && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                  Trabajador
                </span>
              )}
              {paciente.es_beneficiario && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                  Beneficiario
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3 mt-3">
              <Dato label="Teléfono" value={paciente.telefono} />
              <Dato label="N° carpeta" value={paciente.numero_carpeta} />
              <Dato label="N° historia" value={paciente.numero_historia} />
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={cargar}
              className="p-2 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10"
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={imprimir}
              disabled={generandoPdf}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              {generandoPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Secciones del paciente">
        {TABS.map((t) => {
          const Icon = t.icon;
          const activo = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${
                activo
                  ? 'bg-brand-primary/10 text-brand-deep ring-1 ring-brand-primary/20'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'historial' && atenciones?.length > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full bg-slate-200/70 text-[9px] text-slate-600">
                  {atenciones.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {tab === 'ficha' && (
          <FichaIntegralForm
            paciente={paciente}
            ficha={ficha}
            onSaved={() => cargar()}
          />
        )}
        {tab === 'atencion' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <AtencionIntegralForm
              paciente={paciente}
              personalId={personalId}
              colaId={colaId}
              medicoSugeridoId={medicoSugeridoId}
              onCreada={() => cargar()}
            />
          </div>
        )}
        {tab === 'historial' && <HistorialAtenciones atenciones={atenciones} />}
        {tab === 'reposos' && (
          <RepososPanel
            historiaId={paciente.id}
            paciente={paciente}
            personalId={personalId}
            onChanged={() => cargar()}
          />
        )}
      </div>
    </div>
  );
}
