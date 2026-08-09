import Icon from './Icon';

export default function CtaBanner({ onAgendar }) {
  return (
    <section className="relative overflow-hidden bg-primary py-16 md:py-20" aria-label="Solicitar cita">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-secondary rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-tertiary-fixed-dim rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-center md:text-left max-w-2xl">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary-container mb-4 border border-secondary/30">
            Atención gratuita y digna
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            Agenda tu cita en el centro de salud de tu preferencia
          </h2>
          <p className="text-secondary-container/90 mt-3 text-base leading-relaxed">
            Elige una de nuestras sedes y reserva en línea en menos de 2 minutos, sin filas.
          </p>
        </div>
        <button
          onClick={onAgendar}
          className="btn-primary text-white px-8 py-4 rounded-2xl font-semibold text-sm shadow-2xl active:scale-95 flex items-center gap-2 shrink-0"
        >
          <Icon name="calendar_month" filled />
          Solicitar Cita
        </button>
      </div>
    </section>
  );
}
