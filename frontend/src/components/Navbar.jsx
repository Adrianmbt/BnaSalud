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
    <nav className="fixed top-0 left-0 right-0 z-50 glass h-14" aria-label="Navegación principal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex justify-between items-center gap-3">
        <div className="flex items-center min-w-0">
          <div className="h-10 w-auto shrink-0 flex items-center">
            <img src="/identidad visual/InstitutoSalud.jpeg" alt="Logo Instituto de Salud" className="h-full w-auto object-contain" loading="lazy" />
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

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex bg-error/10 text-error px-3 py-1.5 rounded-lg items-center gap-1.5 animate-pulse-slow">
            <Icon name="emergency" filled className="text-base" />
            <span className="text-[11px] font-bold whitespace-nowrap">24/7 Emergencias</span>
          </div>
          <Link
            to="/paciente"
            className="hidden sm:flex w-8 h-8 items-center justify-center hover:bg-secondary/10 rounded-full transition-all text-on-surface"
            aria-label="Portal del paciente"
            title="Portal del paciente"
          >
            <Icon name="account_circle" className="text-xl" />
          </Link>
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary/10 transition-all text-primary"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <Icon name={menuAbierto ? 'close' : 'menu'} className="text-xl" />
          </button>
        </div>
      </div>

      {menuAbierto && (
        <>
          <div
            className="lg:hidden fixed inset-0 top-14 z-40 bg-black/25"
            onClick={() => setMenuAbierto(false)}
            aria-hidden="true"
          />
          <div id="menu-movil" className="lg:hidden absolute top-full left-0 right-0 glass border-t border-outline-variant/20 shadow-2xl z-50">
            <div className="max-w-7xl mx-auto px-5 py-4 space-y-1">
              {ENLACES.map((e) => (
                <a
                  key={e.href}
                  href={e.href}
                  onClick={() => setMenuAbierto(false)}
                  className="block py-2.5 text-sm font-semibold text-primary hover:text-secondary rounded-xl hover:bg-secondary/5 px-3"
                >
                  {e.etiqueta}
                </a>
              ))}
              <div className="h-px bg-outline-variant/30 my-2"></div>
              <Link
                to="/paciente"
                onClick={() => setMenuAbierto(false)}
                className="flex items-center gap-3 py-2.5 px-3 text-sm font-semibold text-primary hover:text-secondary rounded-xl hover:bg-secondary/5"
              >
                <Icon name="account_circle" className="text-xl" /> Portal del paciente
              </Link>
              <div className="flex items-center gap-2 bg-error/10 text-error px-4 py-3 rounded-xl mt-2">
                <Icon name="emergency" filled className="text-lg" />
                <span className="text-xs font-bold">24/7 Emergencias</span>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
