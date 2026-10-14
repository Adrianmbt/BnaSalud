// Reducer puro de la pila de modales, en .js plano porque node --test no
// importa .jsx. Vive aparte de ModalStack.jsx para poder testearlo sin React.

export function reducer(estado, accion) {
  switch (accion.tipo) {
    case 'apilar':
      return [...estado, accion.entrada];
    case 'desapilar': {
      const i = estado.findIndex((e) => e.id === accion.id);
      if (i === -1) return estado;
      return estado.filter((_, idx) => idx !== i);
    }
    case 'vaciar':
      return [];
    default:
      return estado;
  }
}