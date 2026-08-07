import { useEffect, useRef } from 'react';
import Icon from './Icon';

export default function Metrics() {
  const barsRef = useRef(null);

  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.querySelectorAll('.stat-bar').forEach((bar, i) => {
          const height = [15, 25, 40, 35, 55, 70][i % 6];
          setTimeout(() => {
            bar.style.height = height + '%';
          }, 200 + i * 80);
        });
        observer.disconnect();
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="impacto" className="py-16 md:py-24 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10" data-aos="fade-up">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">Impacto en Tiempo Real</h2>
          <p className="text-base text-on-surface-variant mt-2">Transparencia y eficiencia en nuestra gestión diaria.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 bg-primary text-white p-8 rounded-3xl flex flex-col justify-between shadow-2xl h-[260px]" data-aos="fade-up" data-aos-delay="100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium opacity-70">Emergencias Atendidas (Hoy)</p>
                <p className="text-5xl font-extrabold mt-2 tabular-nums counter-value" data-target="142">0</p>
              </div>
              <Icon name="medical_information" filled className="text-3xl text-secondary-container" />
            </div>
            <div ref={barsRef} className="flex items-end gap-1.5 h-16">
              <div className="w-full bg-secondary-container/20 h-4 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
              <div className="w-full bg-secondary-container/30 h-8 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
              <div className="w-full bg-secondary-container/40 h-12 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
              <div className="w-full bg-secondary-container/60 h-6 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
              <div className="w-full bg-secondary-container/80 h-14 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
              <div className="w-full bg-secondary-container h-16 rounded-t-sm stat-bar" style={{ height: 0 }}></div>
            </div>
          </div>

          <div className="bg-white border border-outline-variant/20 p-8 rounded-3xl shadow-xl flex flex-col justify-between" data-aos="fade-up" data-aos-delay="200">
            <p className="text-sm font-medium text-on-surface-variant">Satisfacción</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary counter-value" data-target="98">0</span>
              <span className="text-lg font-medium text-on-surface-variant">%</span>
              <Icon name="trending_up" className="text-tertiary-fixed-dim" />
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name="star" filled className="text-secondary" />
              ))}
            </div>
          </div>

          <div className="bg-secondary/5 p-8 rounded-3xl shadow-lg border border-secondary/20 flex flex-col justify-between" data-aos="fade-up" data-aos-delay="300">
            <p className="text-sm font-semibold text-secondary">Tiempo de Espera</p>
            <p className="text-4xl font-bold text-primary">12 <span className="text-2xl font-medium">min</span></p>
            <div className="bg-white/60 px-4 py-1.5 rounded-full text-xs font-semibold w-fit text-secondary">Promedio Triaje</div>
          </div>

          <div className="md:col-span-2 bg-white border border-outline-variant/20 p-8 rounded-3xl shadow-xl flex items-center gap-8" data-aos="fade-up" data-aos-delay="400">
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface-variant mb-2">Consultas Realizadas</p>
              <p className="text-4xl font-bold text-primary counter-value" data-target="2450">0+</p>
              <p className="text-xs font-semibold text-tertiary mt-2 bg-tertiary-fixed/20 px-4 py-1.5 rounded-full w-fit flex items-center gap-1">
                <Icon name="trending_up" filled className="text-sm" /> +12% este mes
              </p>
            </div>
            <div className="w-32 h-32 rounded-full border-[6px] border-secondary/20 border-t-secondary flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">Capacity</span>
            </div>
          </div>

          <div className="md:col-span-2 bg-surface-container-high border border-outline-variant/20 p-8 rounded-3xl shadow-xl flex justify-between items-center group cursor-pointer hover:bg-secondary/5 transition-all duration-300" data-aos="fade-up" data-aos-delay="500">
            <div>
              <h3 className="text-2xl font-bold text-primary mb-1">Únete a la Red Médica</h3>
              <p className="text-base text-on-surface-variant">Portal exclusivo para especialistas.</p>
            </div>
            <div className="bg-primary text-white p-4 rounded-full group-hover:translate-x-2 transition-transform duration-300">
              <Icon name="arrow_forward" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
