import Icon from './Icon';

const BENEFICIOS = ['Citas en línea', 'Historial clínico', 'Recordatorios'];

export default function Acceso({ onAcceder }) {
  return (
    <section
      id="acceso"
      className="relative overflow-hidden bg-surface py-12 md:py-16"
      aria-labelledby="acceso-titulo"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-health/20 shadow-lg shadow-secondary/10 card-hover-effect"
          data-aos="fade-up"
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{ background: 'linear-gradient(115deg, #063c56 0%, #00677d 46%, #0d9f7a 100%)' }}
          />
          <div
            className="absolute inset-0 opacity-25"
            aria-hidden="true"
            style={{
              backgroundImage:
                'radial-gradient(circle at 14% 18%, rgba(255,255,255,0.55) 0, transparent 44%), radial-gradient(circle at 86% 82%, rgba(62,207,168,0.8) 0, transparent 52%)',
            }}
          />

          <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                <Icon name="verified_user" className="text-[11px]" />
                Acceso seguro
              </span>
              <h2
                id="acceso-titulo"
                className="mt-3 text-xl font-extrabold leading-tight text-white md:text-2xl"
              >
                Una sola cuenta para toda tu salud
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/80 md:text-sm">
                Pide tu cita en cualquiera de los centros de la red, consulta tu historial y
                sigue tus estudios desde el mismo lugar. Entra con tu cédula o crea tu cuenta
                en menos de un minuto.
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {BENEFICIOS.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/85"
                  >
                    <Icon name="check_circle" filled className="text-xs text-health-light" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-stretch gap-2 md:items-end">
              <button
                type="button"
                onClick={onAcceder}
                className="group inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-extrabold text-secondary-dark shadow-lg transition-all duration-200 ease-out btn-hover-effect"
              >
                Iniciar sesión o registrarme
                <Icon
                  name="arrow_forward"
                  className="text-base transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </button>
              <p className="text-center text-[10px] font-medium text-white/70 md:text-right">
                Solo necesitas tu cédula de identidad
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
