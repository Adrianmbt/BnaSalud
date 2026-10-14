import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { reducer } from './modalStackPila';

// No hay router en la app (App.jsx encadena currentRole con useState), así que
// el gesto atrás de Android salía de la app desde cualquier modal o subsección.
// En vez de migrar 6 interfaces a un router, se apila lo que está abierto y el
// botón atrás cierra lo de arriba.

const ModalStackContext = createContext(null);

let secuencia = 0;

export function ModalStackProvider({ children }) {
  const [pila, dispatch] = useState([]);
  const pilaRef = useRef(pila);
  pilaRef.current = pila;

  const apilar = useCallback((entrada) => {
    const id = ++secuencia;
    dispatch({ tipo: 'apilar', entrada: { ...entrada, id } });
    return () => dispatch({ tipo: 'desapilar', id });
  }, []);

  const desapilar = useCallback(() => {
    const cima = pilaRef.current[pilaRef.current.length - 1];
    if (cima?.onClose) cima.onClose();
  }, []);

  useEffect(() => {
    let quitar;
    let cancelado = false;
    let App = null;

    (async () => {
      const cap = await import('@capacitor/app');
      if (cancelado) return;
      App = cap.App;
      quitar = await App.addListener('backButton', () => {
        const abierta = pilaRef.current;
        // Con un listener registrado el plugin ya consume el gesto y ademas
        // ignora el valor de retorno (AppPlugin.handleOnBackPressed), asi que
        // con la pila vacia hay que minimisear a mano: si no, el medico queda
        // atrapado en la app sin poder salir con atras.
        if (abierta.length === 0) {
          App.minimizeApp();
          return;
        }
        const cima = abierta[abierta.length - 1];
        if (cima.onClose) cima.onClose();
      });
    })();

    return () => {
      cancelado = true;
      quitar?.then((h) => h.remove());
    };
  }, []);

  // En web el equivalente es Escape, y de paso queda igual en ambos.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || pilaRef.current.length === 0) return;
      const cima = pilaRef.current[pilaRef.current.length - 1];
      if (cima.onClose) cima.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const valor = useMemo(() => ({ pila, apilar, desapilar }), [pila, apilar, desapilar]);
  return <ModalStackContext.Provider value={valor}>{children}</ModalStackContext.Provider>;
}

export function useModalStack() {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error('useModalStack necesita ModalStackProvider');
  return ctx;
}

/**
 * Registra un modal en la pila mientras esté abierto, para que el botón atrás
 * de Android (y Escape) lo cierren.
 *
 *   useCerrarConAtras(ordenAbierta, cerrarOrden, 'Orden de estudios');
 */
export function useCerrarConAtras(abierto, onClose, etiqueta = '') {
  const { apilar } = useModalStack();
  const guardado = useRef(onClose);
  guardado.current = onClose;

  useEffect(() => {
    if (!abierto) return undefined;
    return apilar({ etiqueta, onClose: () => guardado.current?.() });
  }, [abierto, apilar, etiqueta]);
}
