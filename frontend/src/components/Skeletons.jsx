import Icon from './Icon';

// Esqueletos de carga para toda la aplicación
export function EsqueletoCajita({ width = '100%', height = '20px', borderRadius = '4px' }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, minWidth: '100px' }}
      aria-hidden="true"
    />
  );
}

export function EsqueletoRectangular({ width = '100%', height = '100px', borderRadius = '8px' }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, minWidth: '150px' }}
      aria-hidden="true"
    />
  );
}

export function EsqueletoCircular({ size = '40px' }) {
  return (
    <div
      className="skeleton"
      style={{ width: size, height: size, borderRadius: '50%' }}
      aria-hidden="true"
    />
  );
}

// Esqueleto para tarjetas de KPI (usado en panel institucional)
export function EsqueletoKpi() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-white px-3 py-2.5 shadow-sm">
      <div className="skeleton h-10 w-10 shrink-0 rounded-xl" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="skeleton h-5 w-12" aria-hidden="true" />
          <div className="skeleton h-3 w-16" aria-hidden="true" />
        </div>
        <div className="skeleton h-2.5 w-4/5" aria-hidden="true" />
      </div>
    </div>
  );
}

// Esqueleto para panel de estadísticas
export function EsqueletoPanelBarras() {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <EsqueletoCajita width="150px" height="18px" />
        <EsqueletoCajita width="120px" height="14px" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <EsqueletoCajita width="60%" height="16px" />
            <EsqueletoCajita width="50px" height="16px" />
            <EsqueletoRectangular width="100%" height="12px" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Esqueleto para tabla de centros
export function EsqueletoTablaCentros() {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-4 py-3">
        <div className="space-y-2">
          <EsqueletoCajita width="200px" height="18px" />
          <EsqueletoCajita width="150px" height="14px" />
        </div>
        <EsqueletoCajita width="100px" height="16px" />
      </div>
      <div className="divide-y divide-outline-variant/40">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-8 items-center gap-2 px-4 py-3">
            <div className="col-span-2 space-y-2">
              <EsqueletoCajita width="80%" height="14px" />
              <EsqueletoCajita width="50%" height="12px" />
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
              <EsqueletoCajita key={j} width="70%" height="14px" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Esqueleto para tarjeta de especialidad
export function EsqueletoEspecialidad() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest/70 p-2.5 opacity-60">
      <EsqueletoCircular size="28px" />
      <EsqueletoCajita width="80%" height="14px" />
    </div>
  );
}

// Esqueleto para sección de especialidades
export function EsqueletoEspecialidades() {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <EsqueletoCajita key={i} width="100px" height="48px" borderRadius="24px" />
        ))}
      </div>
      <EsqueletoRectangular width="100%" height="200px" borderRadius="24px" />
    </div>
  );
}

// Esqueleto para sección de métricas
export function EsqueletoMetricas() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-outline-variant/20 p-5 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <EsqueletoCircular size="36px" />
            <EsqueletoCajita width="120px" height="14px" />
          </div>
          <EsqueletoCajita width="60px" height="24px" borderRadius="12px" />
        </div>
        <EsqueletoCajita width="60%" height="48px" />
        <div className="mt-3 flex items-center gap-3">
          <EsqueletoRectangular width="100%" height="8px" borderRadius="4px" />
          <EsqueletoCajita width="40px" height="14px" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-5 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <EsqueletoCircular size="36px" />
            <EsqueletoCajita width="140px" height="14px" />
          </div>
          <EsqueletoCajita width="80px" height="24px" borderRadius="12px" />
        </div>
        <EsqueletoCajita width="70%" height="48px" />
      </div>
    </div>
  );
}

// Esqueleto para carga de contenido general
export function EsqueletoContenido() {
  return (
    <div className="py-20 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 animate-spin mb-4">
        <Icon name="progress_activity" className="text-2xl text-secondary" />
      </div>
      <p className="text-sm text-on-surface-variant">Cargando contenido...</p>
    </div>
  );
}
