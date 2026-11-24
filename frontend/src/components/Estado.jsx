import Icon from './Icon';

/* ════════════════════════════════════════════════════════════════
   ESTADOS DE INTERFAZ (regla 6)
   Vacío / error / éxito. Cada uno explica qué pasó y qué hacer,
   nunca solo muestra un hueco o un spinner genérico.
   ════════════════════════════════════════════════════════════════ */

export function EstadoVacio({ icono = 'information', titulo, accion, accionLabel, clase = '', children, ...rest }) {
  return (
    <div className={`empty-state ${clase}`} role="status" aria-label={titulo} {...rest}>
      <Icon name={icono} className="text-4xl opacity-40" />
      <h3>{titulo}</h3>
      {children}
      {accion && accionLabel && (
        <button
          type="button"
          onClick={accion}
          className="mt-5 btn-primary"
          aria-label={accionLabel}
        >
          {accionLabel}
        </button>
      )}
    </div>
  );
}

export function EstadoError({ titulo, mensaje, accion, accionLabel, clase = '', children, ...rest }) {
  return (
    <div className={`error-state ${clase}`} role="alert" aria-label={titulo} {...rest}>
      <Icon name="error" className="text-4xl" />
      <h3>{titulo}</h3>
      {mensaje && <p>{mensaje}</p>}
      {children}
      {accion && accionLabel && (
        <button
          type="button"
          onClick={accion}
          className="mt-5 btn-primary"
          aria-label={accionLabel}
        >
          {accionLabel}
        </button>
      )}
    </div>
  );
}

export function EstadoExito({ icono = 'check_circle', titulo, mensaje, accion, accionLabel, clase = '', children, ...rest }) {
  return (
    <div className={`success-state ${clase}`} role="status" aria-label={titulo} {...rest}>
      <Icon name={icono} className="text-4xl" />
      <h3>{titulo}</h3>
      {mensaje && <p>{mensaje}</p>}
      {children}
      {accion && accionLabel && (
        <button
          type="button"
          onClick={accion}
          className="mt-5 btn-primary"
          aria-label={accionLabel}
        >
          {accionLabel}
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ESQUELETO DE PÁGINA (regla 1)
   Shell de carga que duplica la forma del contenido real:
   avatar, líneas de texto y un bloque central. Sin spinners.
   ════════════════════════════════════════════════════════════════ */

export function EsqueletoPagina({ avatar = true, lineas = 3 }) {
  return (
    <div className="skeleton-page" aria-label="Cargando contenido" aria-busy="true">
      {avatar && (
        <div className="flex justify-center mb-1">
          <div className="avatar" />
        </div>
      )}
      <div className="line lg" />
      <div className="line md" />
      {[...Array(lineas)].map((_, i) => (
        <div key={i} className="line sm" />
      ))}
      <div className="block mt-2" />
    </div>
  );
}

export function EsqueletoTarjeta({ clase = '' }) {
  return (
    <div className={`rounded-2xl border border-outline-variant/30 bg-white p-4 ${clase}`} aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg skeleton" />
          <div className="space-y-2">
            <div className="h-3 w-32 skeleton rounded" />
            <div className="h-2 w-20 skeleton rounded" />
          </div>
        </div>
        <div className="h-3 w-16 skeleton rounded" />
      </div>
    </div>
  );
}

export function EsqueletoLista({ n = 3, clase = '' }) {
  return (
    <div className={`space-y-3 ${clase}`} aria-hidden="true">
      {[...Array(n)].map((_, i) => (
        <EsqueletoTarjeta key={i} />
      ))}
    </div>
  );
}

export function EsqueletoTabla({ filas = 5, clase = '' }) {
  return (
    <div className={`overflow-x-auto ${clase}`} aria-hidden="true">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-surface-container-low">
          <tr>
            {[...Array(8)].map((_, i) => (
              <th key={i} className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold skeleton" style={{ width: '12%' }} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {[...Array(filas)].map((_, i) => (
            <tr key={i} className="bg-white">
              {[...Array(8)].map((_, j) => (
                <td key={j} className="px-4 py-2.5">
                  <div className={`skeleton h-4 ${j === 0 ? 'w-40' : j === 7 ? 'w-20' : 'w-32'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
