import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

const NOTICIAS = [
  {
    id: 1,
    tipo: 'Jornada',
    titulo: 'Jornada de Atención Integral',
    detalle: 'Barrio El Roble, Parroquia El Carmen',
    fecha: 'Sáb 30 Ago 2026 · 8:00 AM',
    icono: 'directions_bus',
    color: '#0d9488',
    imagen: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
  },
  {
    id: 2,
    tipo: 'Logro',
    titulo: '12,000+ Pacientes Atendidos',
    detalle: 'Agosto 2026 — meta superada en un 15%',
    fecha: 'Actualizado al 26 Ago 2026',
    icono: 'emoji_events',
    color: '#059669',
    imagen: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  },
  {
    id: 3,
    tipo: 'Evento',
    titulo: 'Vacunación Escolar 2026',
    detalle: 'Clínica del Niño · Turno vespertino',
    fecha: 'Lun 1 Sep 2026 · 2:00 PM',
    icono: 'vaccines',
    color: '#1d52d8',
    imagen: 'https://images.unsplash.com/photo-1578357078586-491adf1aa5ba?w=800&q=80',
  },
];

function animarContador(el) {
  const target = parseInt(el.dataset.target, 10) || 0;
  const sufijo = el.dataset.suffix || '';
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducir) {
    el.textContent = `${target.toLocaleString()}${sufijo}`;
    return;
  }
  let current = 0;
  const incremento = Math.max(1, Math.round(target / 40));
  const timer = setInterval(() => {
    current += incremento;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = `${current.toLocaleString()}${sufijo}`;
  }, 30);
}

export default function Metrics() {
  const sectionRef = useRef(null);
  const [noticiaActiva, setNoticiaActiva] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.querySelectorAll('.counter-value').forEach(animarContador);
        observer.disconnect();
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNoticiaActiva((p) => (p + 1) % NOTICIAS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const n = NOTICIAS[noticiaActiva];

  return (
    <section id="impacto" ref={sectionRef} className="py-12 md:py-16 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-5">
        <div className="mb-6" data-aos="fade-up">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">Impacto en Tiempo Real</h2>
          <p className="text-sm text-on-surface-variant mt-1">Transparencia y eficiencia en nuestra gestión diaria.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-aos="fade-up" data-aos-delay="100">

          {/* Lado izquierdo: Métricas apiladas */}
          <div className="flex flex-col gap-4">

            {/* Consultas Totales */}
            <div className="bg-white border border-outline-variant/20 p-5 rounded-2xl shadow-lg flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Icon name="clinical_notes" filled className="text-base text-secondary" />
                  </div>
                  <p className="text-[11px] font-medium text-on-surface-variant">Consultas Realizadas</p>
                </div>
                <p className="text-[10px] font-semibold text-tertiary bg-tertiary-fixed/15 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Icon name="trending_up" filled className="text-[10px]" /> +12%
                </p>
              </div>
              <p className="text-4xl font-extrabold text-primary tabular-nums">
                <span className="counter-value" data-target="2450" data-suffix="+" aria-hidden="true">0+</span>
                <span className="sr-only">2,450+</span>
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '72%' }}></div>
                </div>
                <span className="text-[10px] font-bold text-secondary tabular-nums">72%</span>
              </div>
            </div>

            {/* Pacientes Totales Atendidos */}
            <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-5 rounded-2xl shadow-xl flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Icon name="groups" filled className="text-base text-white" />
                  </div>
                  <p className="text-[11px] font-medium opacity-70">Pacientes Totales Atendidos</p>
                </div>
                <p className="text-[10px] font-semibold bg-white/15 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Icon name="trending_up" filled className="text-[10px]" /> Red completa
                </p>
              </div>
              <p className="text-4xl font-extrabold tabular-nums">
                <span className="counter-value" data-target="12847" aria-hidden="true">0</span>
                <span className="sr-only">12,847</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {['/identidad visual/CliNiño.jpeg', '/identidad visual/Citab.jpeg', '/identidad visual/CliMujer.jpeg', '/identidad visual/Oncologico.jpeg', '/identidad visual/ClinicaMunicipalJosePerezFernandez.jpeg'].map((src, i) => (
                    <img key={i} src={src} alt="" className="w-5 h-5 rounded-full border border-white/30 object-cover" />
                  ))}
                </div>
                <span className="text-[10px] opacity-60">6 centros de la red</span>
              </div>
            </div>

          </div>

          {/* Lado derecho: Carrusel grande 16:9 */}
          <div className="bg-white border border-outline-variant/20 rounded-2xl shadow-xl overflow-hidden relative flex flex-col">

            {/* Imagen - ocupa la mayor parte */}
            <div className="relative flex-1 min-h-[240px] overflow-hidden">
              {NOTICIAS.map((noticia, i) => (
                <div
                  key={noticia.id}
                  className="absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    opacity: i === noticiaActiva ? 1 : 0,
                    transform: `scale(${i === noticiaActiva ? 1 : 1.1})`,
                    zIndex: i === noticiaActiva ? 1 : 0,
                  }}
                >
                  <img
                    src={noticia.imagen}
                    alt={noticia.titulo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {/* Overlay gradiente */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

              {/* Badge tipo */}
              <div className="absolute top-4 left-4 z-20">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
                  style={{ background: n.color }}
                >
                  {n.tipo}
                </span>
              </div>

              {/* Contenido sobre la imagen */}
              <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${n.color}cc` }}
                  >
                    <Icon name={n.icono} filled className="text-base text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">{n.titulo}</h3>
                    <p className="text-xs text-white/70 mt-0.5">{n.detalle}</p>
                    <p className="text-[10px] text-white/50 mt-1">{n.fecha}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div className="px-5 py-3 flex items-center gap-2 bg-white">
              {NOTICIAS.map((noticia, i) => (
                <button
                  key={i}
                  onClick={() => setNoticiaActiva(i)}
                  className="group p-0.5"
                  aria-label={`Noticia ${i + 1}: ${noticia.titulo}`}
                >
                  <span
                    className="block rounded-full transition-all duration-300"
                    style={{
                      width: i === noticiaActiva ? 20 : 6,
                      height: 6,
                      background: i === noticiaActiva ? noticia.color : '#c3c7cd',
                    }}
                  />
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-[10px] font-semibold text-on-surface-variant tabular-nums">
                {noticiaActiva + 1}/{NOTICIAS.length}
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
