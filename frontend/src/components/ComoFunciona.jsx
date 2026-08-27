import Icon from './Icon';

const PASOS = [
  {
    numero: '01',
    icono: 'person_add',
    titulo: 'Regístrate al solicitar tu cita',
    descripcion:
      'Pide tu cita en línea en el centro que prefieras: con tu cédula y tus datos básicos quedas registrado en la red.',
  },
  {
    numero: '02',
    icono: 'folder_shared',
    titulo: 'Nace tu historia clínica',
    descripcion:
      'El sistema abre tu expediente digital con número de historia. Alergias, antecedentes y contacto quedan bajo el cuidado del centro.',
  },
  {
    numero: '03',
    icono: 'stethoscope',
    titulo: 'Tu médico tratante te acompaña',
    descripcion:
      'Cada consulta queda vinculada al médico que te atiende: él registra tu diagnóstico CIE-10, recetas y tratamientos en tu expediente.',
  },
];

const PASO_04 = {
  numero: '04',
  icono: 'timeline',
  titulo: 'Evolución visible para ti y tu médico',
  descripcion:
    'Consulta tu historial general y tu tratamiento vigente desde tu portal; tu médico ve exactamente lo mismo desde su módulo.',
};

function ExpedienteCard() {
  return (
    <div className="relative bg-card border-2 border-ink-line-strong rounded-3xl shadow-2xl p-5 md:p-6 corner-tick">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-dashed border-ink-line-strong relative">
        <div className="flex items-center gap-2.5">
          <img
            src="/identidad visual/InstitutoSalud.jpeg"
            alt="Logo Instituto de Salud"
            className="w-9 h-9 rounded-lg object-contain bg-white border border-ink-line p-0.5"
            loading="lazy"
          />
          <div>
            <p className="text-sm font-black text-ink leading-tight">BNA Salud</p>
            <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-faint">
              Expediente clínico digital
            </p>
          </div>
        </div>
        <span className="stamp stamp-slam text-fx" style={{ animationDelay: '0.6s' }}>
          <Icon name="verified" className="text-[10px]" />
          Activo
        </span>
      </div>

      <div className="py-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-faint mb-0.5">
          Número de historia
        </p>
        <p className="font-mono text-lg md:text-xl font-bold text-doc tracking-wider">
          HIS-V0912345678
        </p>
        <div className="my-3 border-t border-dashed border-ink-line-strong relative">
          <span className="absolute -left-2 -top-2 w-3.5 h-3.5 rounded-full bg-paper" aria-hidden="true" />
          <span className="absolute -right-2 -top-2 w-3.5 h-3.5 rounded-full bg-paper" aria-hidden="true" />
        </div>
        <dl className="space-y-2 text-xs">
          {[
            ['Paciente', 'María González Pérez'],
            ['Médico tratante', 'Dra. Laura Fernández'],
            ['Especialidad', 'Medicina General'],
            ['Última consulta', '14 may 2026'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3">
              <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-ink-faint pt-0.5">
                {k}
              </dt>
              <dd className="font-semibold text-ink text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl bg-doc-soft/60 border border-doc/20 p-3 flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-doc text-white flex items-center justify-center shrink-0">
          <Icon name="medication" filled className="text-sm" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-doc font-bold">
            Tratamiento vigente
          </p>
          <p className="text-xs font-semibold text-ink mt-0.5 leading-snug">
            Losartán 50mg cada 12 horas
          </p>
          <p className="font-mono text-[9px] text-ink-faint mt-0.5">
            Registrado por tu médico · visible para ambos
          </p>
        </div>
      </div>

      <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-faint text-center flex items-center justify-center gap-1.5">
        <Icon name="sync_alt" className="text-[10px]" />
        La misma historia, en el consultorio y en tu casa
      </p>
    </div>
  );
}

export default function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="relative py-14 md:py-20 overflow-hidden bg-paper paper-noise"
      aria-label="Cómo funciona la plataforma"
    >
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, var(--color-ink) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, var(--color-ink) 0 1px, transparent 1px 40px)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-5 relative">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Columna izquierda: Título + Pasos 01-03 */}
          <div className="lg:col-span-5">
            <div data-aos="fade-up" data-aos-duration="700">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-doc font-bold mb-3 flex items-center gap-3">
                <span className="ledger-rule w-8" aria-hidden="true" />
                El camino de tu salud
              </p>
              <h2 className="font-display text-2xl md:text-4xl font-black text-ink leading-[1.1] tracking-tight max-w-xl">
                Regístrate una vez y tu historia clínica nace al instante
              </h2>
              <p className="text-sm text-ink-soft leading-relaxed max-w-lg mt-3">
                Al pedir tu cita te conviertes en paciente de la red municipal. Tu expediente se
                crea automáticamente y queda disponible para ti y para cada médico que te atienda.
              </p>
            </div>

            <ol className="mt-8 space-y-0">
              {PASOS.map((p, i) => (
                <li
                  key={p.numero}
                  data-aos="fade-up"
                  data-aos-delay={i * 100}
                  className="group relative pb-7 last:pb-0 pl-14 md:pl-[68px]"
                >
                  {i < PASOS.length - 1 && (
                    <span
                      className="absolute left-6 md:left-[28px] top-12 bottom-0 w-0 border-l-2 border-dashed border-ink-line-strong"
                      aria-hidden="true"
                    />
                  )}
                  <span className="absolute left-0 top-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-card border-2 border-ink-line-strong flex flex-col items-center justify-center shadow-sm group-hover:border-doc group-hover:shadow-lg transition-all">
                    <span className="font-mono text-[8px] font-bold text-ink-faint leading-none">
                      {p.numero}
                    </span>
                    <Icon
                      name={p.icono}
                      filled
                      className="text-base text-doc mt-0.5 group-hover:scale-110 transition-transform"
                    />
                  </span>
                  <div className="pt-0.5">
                    <h3 className="text-sm md:text-base font-extrabold text-ink leading-snug">
                      {p.titulo}
                    </h3>
                    <p className="text-xs text-ink-soft leading-relaxed mt-1 max-w-sm">
                      {p.descripcion}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Columna derecha: Expediente clínico + Paso 04 */}
          <div className="lg:col-span-7" data-aos="fade-left" data-aos-delay="200">
            <div className="relative lg:sticky lg:top-20 ml-[3px] mt-10">
              <div className="absolute -inset-3 bg-doc/10 rotate-1 rounded-3xl border border-dashed border-doc/30" aria-hidden="true" />
              <ExpedienteCard />

              {/* Paso 04 debajo de la imagen */}
              <div
                data-aos="fade-up"
                data-aos-delay="350"
                className="group relative pl-14 md:pl-[68px] mt-6"
              >
                <span className="absolute left-0 top-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-card border-2 border-ink-line-strong flex flex-col items-center justify-center shadow-sm group-hover:border-doc group-hover:shadow-lg transition-all">
                  <span className="font-mono text-[8px] font-bold text-ink-faint leading-none">
                    {PASO_04.numero}
                  </span>
                  <Icon
                    name={PASO_04.icono}
                    filled
                    className="text-base text-doc mt-0.5 group-hover:scale-110 transition-transform"
                  />
                </span>
                <div className="pt-0.5">
                  <h3 className="text-sm md:text-base font-extrabold text-ink leading-snug">
                    {PASO_04.titulo}
                  </h3>
                  <p className="text-xs text-ink-soft leading-relaxed mt-1 max-w-md">
                    {PASO_04.descripcion}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
