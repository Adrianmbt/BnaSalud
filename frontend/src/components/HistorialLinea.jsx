import { useState } from 'react';
import Icon from './Icon';

function formatoFecha(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso || '';
  }
}

const ICONO_ESTUDIO = {
  laboratorio: 'bloodtype',
  imagen: 'radiology',
  funcional: 'monitor_heart',
};

/**
 * Línea de tiempo del historial clínico.
 * Muestra las consultas de un paciente ordenadas de la más reciente a la más antigua,
 * con su diagnóstico CIE-10, tratamiento y estudios. Se usa tanto en el portal del
 * paciente como en el módulo del médico para mantener la misma "lectura" del expediente.
 */
export default function HistorialLinea({ consultas = [], marcarActual = false, vacio }) {
  const [desplegado, setDesplegado] = useState(null);

  if (!Array.isArray(consultas) || consultas.length === 0) {
    return (
      <div className="py-12 text-center text-on-surface-variant space-y-2">
        <Icon name="history" className="text-5xl opacity-40" />
        <p className="text-sm font-medium">{vacio || 'Aún no hay consultas registradas.'}</p>
      </div>
    );
  }

  return (
    <ol className="relative">
      <span
        className="absolute left-[19px] md:left-[23px] top-3 bottom-3 w-px"
        style={{ background: 'var(--color-outline-variant)' }}
        aria-hidden="true"
      />
      {consultas.map((c, i) => {
        const esActual = marcarActual && i === 0;
        const abierto = desplegado === c.consulta_id;
        const tratamientos = [c.tratamiento].filter(Boolean);
        const recetas = Array.isArray(c.recetas) ? c.recetas.filter((r) => r && r.nombre) : [];
        const estudios = Array.isArray(c.estudios) ? c.estudios : [];

        return (
          <li key={c.consulta_id || i} className="relative pl-12 md:pl-16 pb-6 last:pb-0 group">
            <span
              className={`absolute left-0 top-1 w-[38px] md:w-[46px] h-[38px] md:h-[46px] rounded-full flex items-center justify-center border-2 transition-all ${
                esActual
                  ? 'text-on-secondary shadow-md'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant group-hover:border-secondary'
              }`}
              style={esActual ? { background: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' } : undefined}
            >
              {esActual ? (
                <Icon name="schedule" filled className="text-lg" />
              ) : (
                <span className="font-mono text-[11px] font-bold">
                  {(consultas.length - i).toString().padStart(2, '0')}
                </span>
              )}
            </span>

            <div
              className={`rounded-2xl border transition-all ${
                esActual
                  ? 'bg-surface-container-low border-secondary/50 shadow-sm'
                  : 'bg-surface-container-low border-outline-variant'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap p-4 pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      {formatoFecha(c.fecha)}
                    </span>
                    {esActual && (
                      <span
                        className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-md text-on-secondary"
                        style={{ background: 'var(--color-secondary)' }}
                      >
                        Vigente
                      </span>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-secondary font-semibold">
                      {c.especialidad}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-on-surface-variant">
                    <Icon name="stethoscope" className="text-sm" />
                    {c.medico_nombre || 'Médico no registrado'}
                    {c.comprobante_ref && (
                      <span className="font-mono text-[10px] text-on-surface-variant/70 ml-1">
                        · Ref. {c.comprobante_ref}
                      </span>
                    )}
                  </div>
                </div>

                {c.cie10_codigo && (
                  <span className="shrink-0 font-mono text-[11px] font-bold text-secondary px-2.5 py-1 rounded-lg bg-secondary/10">
                    {c.cie10_codigo}
                  </span>
                )}
              </div>

              {c.cie10_descripcion && (
                <p className="px-4 pt-2 text-sm font-semibold text-primary">{c.cie10_descripcion}</p>
              )}
              {c.motivo_consulta && (
                <p className="px-4 pt-1 text-sm text-on-surface-variant italic">“{c.motivo_consulta}”</p>
              )}

              <div className="px-4 pt-3 space-y-2.5">
                {tratamientos.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-fx-soft text-fx flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="medication" filled className="text-sm" />
                    </span>
                    <p className="text-sm text-primary leading-snug">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-fx font-bold block mb-0.5">
                        Tratamiento
                      </span>
                      {c.tratamiento}
                    </p>
                  </div>
                )}

                {recetas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-9">
                    {recetas.map((r, ri) => (
                      <span
                        key={ri}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-primary"
                      >
                        <Icon name="prescriptions" className="text-sm text-fx" />
                        {r.nombre}
                      </span>
                    ))}
                  </div>
                )}

                {estudios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-9">
                    {estudios.map((e, ei) => (
                      <span
                        key={ei}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-outline-variant bg-surface text-[11px] font-semibold text-primary"
                      >
                        <Icon
                          name={ICONO_ESTUDIO[e.tipo] || 'science'}
                          className="text-sm text-doc"
                        />
                        {e.nombre}
                        {Array.isArray(e.parametros) && e.parametros.length > 0 && (
                          <span className="font-mono text-[9px] text-on-surface-variant">
                            · {e.parametros.length} valor(es)
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {c.recomendaciones && (
                  <p className="flex items-start gap-2 pl-9 text-xs text-on-surface-variant">
                    <Icon name="tips_and_updates" className="text-sm text-amber shrink-0 mt-0.5" />
                    <span className="leading-snug">{c.recomendaciones}</span>
                  </p>
                )}
              </div>

              {(c.examen_fisico || recetas.length > 0 || estudios.length > 0) && (
                <button
                  onClick={() => setDesplegado(abierto ? null : c.consulta_id)}
                  className="mt-2 mx-4 mb-3 inline-flex items-center gap-1 text-[11px] font-bold text-secondary hover:text-secondary-light transition-colors"
                  aria-expanded={abierto}
                >
                  <Icon name={abierto ? 'expand_less' : 'expand_more'} className="text-sm" />
                  {abierto ? 'Ver menos detalle' : 'Ver detalle completo'}
                </button>
              )}

              {abierto && (
                <div className="px-4 pb-4 border-t border-outline-variant/50 pt-3 space-y-2.5 tab-fade">
                  {c.examen_fisico && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-surface-variant mb-1">
                        Examen físico
                      </p>
                      <p className="text-sm text-primary leading-snug">{c.examen_fisico}</p>
                    </div>
                  )}
                  {recetas.length > 0 && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">
                        Recetas emitidas
                      </p>
                      <div className="space-y-1.5">
                        {recetas.map((r, ri) => (
                          <div key={ri} className="text-sm text-primary">
                            <span className="font-semibold">{r.nombre}</span>
                            {r.posologia && <span className="text-on-surface-variant"> — {r.posologia}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {estudios.length > 0 && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">
                        Estudios solicitados
                      </p>
                      <div className="space-y-2">
                        {estudios.map((e, ei) => (
                          <div key={ei} className="text-sm">
                            <p className="font-semibold text-primary">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-secondary mr-1.5">
                                {e.tipo}
                              </span>
                              {e.nombre}
                            </p>
                            {Array.isArray(e.parametros) && e.parametros.length > 0 && (
                              <p className="font-mono text-[11px] text-on-surface-variant pl-1">
                                {e.parametros.map((p) => `${p.parametro}: ${p.valor}${p.unidad ? ` ${p.unidad}` : ''}`).join(' · ')}
                              </p>
                            )}
                            {e.descripcion && <p className="text-xs text-on-surface-variant mt-0.5">{e.descripcion}</p>}
                            {e.conclusion && (
                              <p className="text-xs font-semibold text-fx mt-0.5">Conclusión: {e.conclusion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}