import { useState } from 'react';

const TAMANOS = {
  sm: 'h-14 w-16 p-2',
  md: 'h-20 w-24 p-3',
  lg: 'h-32 md:h-40 w-36 md:w-44 p-3 md:p-4',
};

export default function LogoPlate({ src, alt, theme, size = 'md' }) {
  const [fallo, setFallo] = useState(false);
  const clases = TAMANOS[size] || TAMANOS.md;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-white ring-1 shadow-sm transition-transform duration-300 group-hover:scale-[1.03] ${clases}`}
      style={{ '--tw-ring-color': `${theme.accent}26`, boxShadow: `0 4px 14px -6px ${theme.shadow}` }}
    >
      {fallo || !src ? (
        <span
          className="flex h-full w-full items-center justify-center rounded-lg text-xl font-extrabold text-white"
          style={{ background: theme.gradient }}
          aria-hidden="true"
        >
          {(alt || 'C').charAt(0).toUpperCase()}
        </span>
      ) : (
        <img
          src={src}
          alt={`Logo ${alt}`}
          loading="lazy"
          onError={() => setFallo(true)}
          className="max-h-full max-w-full object-contain"
        />
      )}
    </div>
  );
}
