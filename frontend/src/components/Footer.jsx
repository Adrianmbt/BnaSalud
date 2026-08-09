import Icon from './Icon';

const ENLACES = [
  { href: '#servicios', etiqueta: 'Servicios' },
  { href: '#sedes', etiqueta: 'Red de Centros' },
  { href: '#impacto', etiqueta: 'Impacto Social' },
];

export default function Footer() {
  return (
    <footer className="bg-[#0a1e2e] border-t border-secondary/30" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 rounded-xl overflow-hidden bg-white shadow-lg ring-1 ring-white/10 flex items-center justify-center px-1.5">
                <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" loading="lazy" />
              </div>
              <span className="text-lg font-bold text-white">Salud Barcelona · Instituto de Salud Municipal</span>
            </div>
            <p className="text-sm text-secondary-container/80 leading-relaxed">Red de centros de salud públicos y aliados del Municipio Simón Bolívar. Salud gratuita, digna y oportuna para toda la comunidad barcelonesa.</p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Enlaces</h4>
            <ul className="space-y-3">
              {ENLACES.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-secondary-container/70 hover:text-white transition-colors">
                    {l.etiqueta}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li>
                <a href="tel:+582810000000" className="flex items-center gap-2 text-sm text-secondary-container/80 hover:text-white transition-colors">
                  <Icon name="call" className="text-sm text-secondary" /> +58 281 000 0000
                </a>
              </li>
              <li>
                <a href="mailto:salud@barcelona.gob.ve" className="flex items-center gap-2 text-sm text-secondary-container/80 hover:text-white transition-colors">
                  <Icon name="mail" className="text-sm text-secondary" /> salud@barcelona.gob.ve
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-secondary-container/80">
                <Icon name="location_on" className="text-sm text-secondary" /> Barcelona, Estado Anzoátegui
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-secondary/20 text-center">
          <p className="text-xs text-secondary-container/60">&copy; 2026 Instituto de Salud del Municipio Simón Bolívar - Alcaldía de Barcelona. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
