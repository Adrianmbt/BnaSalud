export default function Icon({ name, filled = false, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined${filled ? ' fill' : ''} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
