import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const ENLACES = [
  { href: '#servicios', etiqueta: 'Servicios' },
  { href: '#sedes', etiqueta: 'Red de Centros' },
  { href: '#impacto', etiqueta: 'Impacto Social' },
];

export default function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass h-20" aria-label="Navegación principal">
      <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-12 rounded-xl overflow-hidden bg-white shadow-lg ring-1 ring-outline-variant/30 flex items-center justify-center px-1.5 shrink-0">
            <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" loading="lazy" />
          </div>
          <div className="min-w-0">
            <span className="text-xl font-bold text-primary leading-none block truncate">Salud Barcelona</span>
            <span className="text-xs font-semibold text-secondary uppercase tracking-[0.15em] block truncate">Instituto de Salud Municipal · Simón Bolívar</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-8">
          {ENLACES.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className={
                e.href === '#servicios'
                  ? 'text-sm font-semibold text-secondary border-b-2 border-secondary pb-1'
                  : 'text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors'
              }
            >
              {e.etiqueta}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex bg-error/10 text-error px-4 py-2 rounded-lg items-center gap-2 animate-pulse-slow">
            <Icon name="emergency" filled className="text-lg" />
            <span className="text-xs font-bold whitespace-nowrap">24/7 Emergencias</span>
          </div>
          <button
            className="hidden sm:flex w-10 h-10 items-center justify-center hover:bg-secondary/10 rounded-full transition-all text-on-surface"
            aria-label="Cuenta"
          >
            <Icon name="account_circle" />
          </button>
          <button
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl hover:bg-secondary/10 transition-all text-primary"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <Icon name={menuAbierto ? 'close' : 'menu'} className="text-2xl" />
          </button>
        </div>
      </div>

      {menuAbierto && (
        <div id="menu-movil" className="lg:hidden absolute top-full left-0 right-0 glass border-t border-outline-variant/20 shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-5 space-y-1">
            {ENLACES.map((e) => (
              <a
                key={e.href}
                href={e.href}
                onClick={() => setMenuAbierto(false)}
                className="block py-3 text-base font-semibold text-primary hover:text-secondary rounded-xl hover:bg-secondary/5 px-3"
              >
                {e.etiqueta}
              </a>
            ))}
            <div className="h-px bg-outline-variant/30 my-2"></div>
            <div className="flex items-center gap-2 bg-error/10 text-error px-4 py-3 rounded-xl mt-2">
              <Icon name="emergency" filled className="text-lg" />
              <span className="text-xs font-bold">24/7 Emergencias</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
