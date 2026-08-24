import { useCallback, useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import { DEMO } from '../clinical/demo';

/**
 * Normaliza cadenas de texto para comparaciones insensibles a mayúsculas,
 * tildes y caracteres especiales.
 */
function normalizarTexto(texto = '') {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Hook personalizado para consultar y validar el inventario farmacéutico en tiempo real.
 * Centraliza la lógica de búsqueda de existencias y resolución de compra externa.
 */
export function usePharmacyStock() {
  const [inventario, setInventario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarInventario = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      let data;
      try {
        data = await API.getInventario();
      } catch {
        data = await DEMO.getInventario();
      }
      setInventario(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error al consultar inventario de farmacia');
      setInventario([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarInventario();
  }, [cargarInventario]);

  /**
   * Verifica la disponibilidad de un fármaco por su nombre o principio activo.
   * @param {string} nombreMedicamento
   * @returns {{
   *   estado: 'ok' | 'bajo' | 'sin_stock' | 'externo' | 'vacio',
   *   stockActual: number | null,
   *   stockMinimo: number | null,
   *   esDisponible: boolean,
   *   esCompraExterna: boolean,
   *   medicamento: object | null,
   *   mensaje: string,
   *   claseEstilo: string
   * }}
   */
  const verificarDisponibilidad = useCallback(
    (nombreMedicamento = '') => {
      const objetivo = normalizarTexto(nombreMedicamento);
      if (!objetivo || objetivo.length < 2) {
        return {
          estado: 'vacio',
          stockActual: null,
          stockMinimo: null,
          esDisponible: false,
          esCompraExterna: false,
          medicamento: null,
          mensaje: '',
          claseEstilo: 'text-slate-400 bg-slate-50 border-slate-200',
        };
      }

      // 1. Coincidencia exacta o parcial contra el inventario
      const med =
        inventario.find((m) => normalizarTexto(m.nombre) === objetivo) ||
        inventario.find(
          (m) =>
            normalizarTexto(m.nombre).includes(objetivo) ||
            objetivo.includes(normalizarTexto(m.nombre))
        );

      // Si no existe en el catálogo interno de la farmacia
      if (!med) {
        return {
          estado: 'externo',
          stockActual: 0,
          stockMinimo: null,
          esDisponible: false,
          esCompraExterna: true,
          medicamento: null,
          mensaje: 'No registrado en catálogo · Requiere Compra Externa',
          claseEstilo: 'text-rose-700 bg-rose-50 border-rose-200',
        };
      }

      const stock = Number(med.stock_actual ?? 0);
      const minimo = Number(med.stock_minimo ?? 20);

      // Si existe pero no hay unidades
      if (stock <= 0) {
        return {
          estado: 'sin_stock',
          stockActual: 0,
          stockMinimo: minimo,
          esDisponible: false,
          esCompraExterna: true,
          medicamento: med,
          mensaje: 'Agotado en clínica · Requiere Compra Externa',
          claseEstilo: 'text-rose-700 bg-rose-50 border-rose-300',
        };
      }

      // Si el stock está en o por debajo del umbral mínimo
      if (stock <= minimo) {
        return {
          estado: 'bajo',
          stockActual: stock,
          stockMinimo: minimo,
          esDisponible: true,
          esCompraExterna: false,
          medicamento: med,
          mensaje: `Disponible en clínica (Stock bajo: ${stock} unid.)`,
          claseEstilo: 'text-amber-800 bg-amber-50 border-amber-300',
        };
      }

      // Stock óptimo disponible
      return {
        estado: 'ok',
        stockActual: stock,
        stockMinimo: minimo,
        esDisponible: true,
        esCompraExterna: false,
        medicamento: med,
        mensaje: `Disponible en Farmacia Central (${stock} unid.)`,
        claseEstilo: 'text-emerald-800 bg-emerald-50 border-emerald-300',
      };
    },
    [inventario]
  );

  /**
   * Genera métricas resumidas para un listado de prescripciones.
   */
  const resumirPrescripciones = useCallback(
    (recetas = []) => {
      const validas = recetas.filter((r) => r && String(r.nombre || '').trim().length > 0);
      let disponibles = 0;
      let bajoMinimo = 0;
      let compraExterna = 0;

      validas.forEach((r) => {
        const info = verificarDisponibilidad(r.nombre || r.nombre_medicamento);
        if (info.esDisponible) {
          disponibles += 1;
          if (info.estado === 'bajo') bajoMinimo += 1;
        } else {
          compraExterna += 1;
        }
      });

      return {
        total: validas.length,
        disponibles,
        bajoMinimo,
        compraExterna,
      };
    },
    [verificarDisponibilidad]
  );

  return {
    inventario,
    cargando,
    error,
    recargarInventario: cargarInventario,
    verificarDisponibilidad,
    resumirPrescripciones,
  };
}

export default usePharmacyStock;
