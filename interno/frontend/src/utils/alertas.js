import Swal from 'sweetalert2';

/**
 * Diálogos de la plataforma (SweetAlert2).
 *
 * Se usan para confirmar acciones antes de ejecutarlas y para avisar el
 * resultado de un proceso. Los colores se toman de las variables del tema
 * para que los diálogos sigan la identidad visual del centro.
 */

const PRIMARIO = '#1A4B7C';
const PELIGRO = '#D90429';

function color(variable, respaldo) {
  if (typeof window === 'undefined' || !document?.documentElement) return respaldo;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return valor || respaldo;
}

function base({ peligro = false } = {}) {
  return {
    confirmButtonColor: peligro ? color('--color-danger', PELIGRO) : color('--color-primary', PRIMARIO),
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    focusCancel: peligro,
    padding: '1.25rem',
  };
}

/**
 * Pregunta antes de ejecutar una acción.
 * Devuelve `true` solo si la persona confirmó.
 */
export async function confirmar({
  titulo,
  texto = '',
  confirmar: textoConfirmar = 'Sí, continuar',
  cancelar: textoCancelar = 'Cancelar',
  peligro = false,
} = {}) {
  const { isConfirmed } = await Swal.fire({
    ...base({ peligro }),
    icon: peligro ? 'warning' : 'question',
    title: titulo,
    text: texto || undefined,
    showCancelButton: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: textoCancelar,
  });
  return isConfirmed;
}

/** Aviso de proceso completado, con botón para cerrar. */
export async function exito(titulo, texto = '') {
  return Swal.fire({
    ...base(),
    icon: 'success',
    title: titulo,
    text: texto || undefined,
    confirmButtonText: 'Entendido',
  });
}

/** Confirmación breve en la esquina, sin interrumpir el trabajo. */
export function exitoRapido(titulo) {
  return Swal.fire({
    ...base(),
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: titulo,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}

/** Proceso que falló, con el detalle devuelto por el servidor. */
export async function errorAlerta(titulo, texto = '') {
  return Swal.fire({
    ...base({ peligro: true }),
    icon: 'error',
    title: titulo,
    text: texto || undefined,
    confirmButtonText: 'Cerrar',
  });
}

/** Información o advertencia que no requiere decisión. */
export async function aviso(titulo, texto = '') {
  return Swal.fire({
    ...base(),
    icon: 'info',
    title: titulo,
    text: texto || undefined,
    confirmButtonText: 'Entendido',
  });
}

/** Bloquea la pantalla mientras corre una operación que no se puede cerrar. */
export function cargando(titulo = 'Procesando…') {
  Swal.fire({
    ...base(),
    title: titulo,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
}

export function cerrarAlerta() {
  Swal.close();
}

export { Swal };
