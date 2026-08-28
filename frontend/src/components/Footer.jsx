import Icon from './Icon';

const ENLACES = [
  { href: '#inicio', etiqueta: 'Inicio' },
  { href: '#impacto', etiqueta: 'Impacto' },
  { href: '#como-funciona', etiqueta: 'Cómo Funciona' },
  { href: '#servicios', etiqueta: 'Servicios' },
  { href: '#sedes', etiqueta: 'Red de Centros' },
  { href: '#testimonios', etiqueta: 'Testimonios' },
];

function WhatsApp({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function Instagram({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.999 3.999 0 110-7.999 3.999 3.999 0 010 7.999zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer role="contentinfo">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#061525] via-[#0a2740] to-[#0e3a5e] text-white">
        <div className="absolute -top-28 -right-20 w-96 h-96 bg-secondary/25 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-80 h-80 bg-tertiary-fixed-dim/15 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-14 md:py-16">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="h-14 rounded-2xl overflow-hidden bg-white shadow-lg ring-1 ring-white/10 flex items-center justify-center px-2 shrink-0 mb-4">
              <img src="/identidad visual/InstitutoSalud.jpeg" alt="Logo Instituto de Salud" className="h-full w-auto object-contain" loading="lazy" />
            </div>
            <h3 className="text-lg md:text-xl font-bold leading-snug max-w-2xl text-white">
              Un solo sistema de salud para todo el municipio Simón Bolívar
            </h3>
          </div>

          <div className="h-px bg-white/10 mb-10" />

          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            <div className="text-center md:text-left">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-5 text-secondary-container">Enlaces</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ENLACES.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-secondary-container transition-colors">
                      <span className="w-1 h-1 bg-secondary-container/60 rounded-full inline-block" />
                      {l.etiqueta}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center md:text-right">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-5 text-secondary-container">Contacto</h4>
              <ul className="space-y-3">
                <li className="flex items-center justify-center md:justify-end">
                  <a
                    href="https://wa.me/584129451597"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-[#43ffbb] transition-colors bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5"
                  >
                    <WhatsApp className="h-4 w-4 text-[#43ffbb]" /> +58 412 945 1597
                  </a>
                </li>
                <li className="flex items-center justify-center md:justify-end">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-[#50d9fe] transition-colors bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5"
                  >
                    <Instagram className="h-4 w-4 text-[#50d9fe]" /> Instagram
                  </a>
                </li>
                <li className="flex items-center justify-center md:justify-end gap-2 text-sm text-white/70">
                  <Icon name="location_on" className="text-sm text-secondary-container" /> Barcelona, Estado Anzoátegui
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-5 text-center">
            <p className="text-xs text-white/50">&copy; 2026 Instituto de Salud del Municipio Simón Bolívar - Alcaldía de Barcelona. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}