import Icon from '../components/Icon';

const TONOS = {
  fx: { color: 'var(--color-fx)', fondo: 'var(--color-fx-soft)' },
  doc: { color: 'var(--color-doc)', fondo: 'var(--color-doc-soft)' },
  amber: { color: 'var(--color-amber)', fondo: 'var(--color-amber-soft)' },
  blood: { color: 'var(--color-blood)', fondo: 'var(--color-blood-soft)' },
  mint: { color: 'var(--color-mint)', fondo: 'var(--color-mint-soft)' },
  ink: { color: 'var(--color-ink-soft)', fondo: 'var(--color-paper-2)' },
};

/* Sello de goma con rotación leve */
export function Stamp({ tone = 'ink', children, soft = false, slam = false, className = '' }) {
  const c = TONOS[tone] || TONOS.ink;
  return (
    <span
      className={`stamp ${soft ? 'stamp-soft' : ''} ${slam ? 'stamp-slam' : ''} ${className}`}
      style={{ color: c.color, background: c.fondo }}
    >
      {children}
    </span>
  );
}

/* Tarjeta de registro con esquinas de clip */
export function LedgerCard({ children, className = '', as: Tag = 'div', tick = true }) {
  const base = 'bg-card border border-ink-line rounded-lg shadow-[0_1px_2px_rgba(20,35,47,0.05)]';
  const corners = tick ? 'corner-tick' : '';
  return <Tag className={`${base} ${corners} ${className}`}>{children}</Tag>;
}

/* Encabezado de sección tipo registro: índice mono + serif + regla */
export function SectionLabel({ index, children, tone = 'ink', className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="row-no">{index}</span>
      <h3 className="font-display text-lg md:text-xl font-semibold text-ink">{children}</h3>
      <span
        className="flex-1 h-px"
        style={{ background: `linear-gradient(90deg, var(--color-ink-line), transparent)` }}
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: TONOS[tone].color }}>
        {tone === 'fx' ? 'Farmacia' : tone === 'doc' ? 'Clínica' : ''}
      </span>
    </div>
  );
}

/* Campo de formulario con etiqueta mono */
export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-faint mt-1.5 italic">{hint}</span>}
    </label>
  );
}

/* Texto de código en mono */
export function Code({ children, className = '' }) {
  return <span className={`font-mono text-[11px] tracking-wide ${className}`}>{children}</span>;
}

/* Número grande en serif para estadísticas */
export function StatNum({ children, tone = 'ink', className = '' }) {
  const c = TONOS[tone] || TONOS.ink;
  return (
    <span className={`font-display italic font-semibold leading-none ${className}`} style={{ color: c.color }}>
      {children}
    </span>
  );
}

/* Botón primario de acción del registro */
export function ToneButton({
  tone = 'fx',
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
}) {
  const c = TONOS[tone] || TONOS.fx;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-paper shadow-md transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      style={{
        background: `linear-gradient(135deg, ${c.color}, ${c.color}dd)`,
        boxShadow: `0 8px 20px -8px ${c.color}66`,
      }}
    >
      {loading && <Icon name="sync" className="animate-spin text-base" />}
      {children}
    </button>
  );
}

/* Etiqueta de estado con punto */
export function EstadoPunto({ tone = 'mint', children }) {
  const c = TONOS[tone] || TONOS.mint;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: c.color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
      {children}
    </span>
  );
}
