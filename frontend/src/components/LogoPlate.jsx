import { useState } from 'react';

const TAMANOS = {
  sm: 'h-16 w-20',
  md: 'h-20 w-24',
  lg: 'h-32 md:h-44 w-36 md:w-48',
};

export default function LogoPlate({ src, alt, theme, size = 'md' }) {
  const [fallo, setFallo] = useState(false);
  const contenedor = TAMANOS[size];

  return (
    <div className="relative">
      <div
        className="absolute inset-0 m-auto w-40 h-40 md:w-52 md:h-52 rounded-full blur-2xl opacity-50 transition-all duration-300 group-hover:opacity-80 group-hover:blur-3xl pointer-events-none"
        style={{ backgroundColor: theme.shadow }}
      />
      <div className="relative rounded-3xl bg-white/90 backdrop-blur-md p-3 md:p-4 ring-1 ring-white/70 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.45),0_8px_16px_-6px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:scale-[1.03]">
        {fallo || !src ? (
          <div className={`${contenedor} flex items-center justify-center`}>
            <span
              className="w-14 h-14 md:w-16 md:h-16 rounded-full text-white flex items-center justify-center text-2xl md:text-3xl font-extrabold"
              style={{ background: theme.gradient }}
            >
              {(alt || 'C').charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <div className={`${contenedor} flex items-center justify-center`}>
            <img
              src={src}
              alt={`Logo ${alt}`}
              loading="lazy"
              onError={() => setFallo(true)}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
