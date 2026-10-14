import React, { useEffect, useMemo, useState } from 'react';
import { Pill, Plus, Trash2, Loader2, AlertCircle, PackageCheck, PackageX, CheckCircle2, Clock, Syringe } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import StockCatalogModal from './StockCatalogModal';
import RecetaCatalogModal from './RecetaCatalogModal';

const posologiaBase = (med) => {
  if (!med) return '';
  const pres = (med.presentacion || '').toLowerCase().trim();
  if (/(ampolla|inyect|vial)/.test(pres)) return '1 ampolla';
  if (/(inhalador|aerosol|spray|inhalacion|puff)/.test(pres)) return '2 inhalaciones';
  if (/(gota|gotas)/.test(pres)) return '20 gotas';
  if (/(suspension|jarabe|solucion oral)/.test(pres)) return '1 medida';
  if (/(sobre)/.test(pres)) return '1 sobre';
  if (/(crema|unguento|ungüento|pomada)/.test(pres)) return 'aplicar en la zona';
  if (/(supositorio|óvulo|ovulo)/.test(pres)) return '1 unidad';
  if (/(comprimido)/.test(pres)) return '1 comprimido';
  if (/(tableta|píldora|grajea)/.test(pres)) return '1 tableta';
  if (/(cápsula|capsula|perla)/.test(pres)) return '1 cápsula';
  return '1 unidad';
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function tokeniza(nombre) {
  return norm(nombre)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export default function MedicationPanel({ recetas = [], onRecetas, variant = 'receta' }) {
  const [catalogo, setCatalogo] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');
  const [abierta, setAbierta] = useState(null);

  const esAplicado = variant === 'aplicado';

  // External medication form state (only for aplicados)
  const [extNombre, setExtNombre] = useState('');
  const [extDosis, setExtDosis] = useState('');
  const [extHora, setExtHora] = useState('');
  const [mostrarExterno, setMostrarExterno] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [c, i] = await Promise.all([
          axiosClient.get('/medicamentos'),
          axiosClient.get('/farmacia/inventario'),
        ]);
        if (!activo) return;
        setCatalogo(Array.isArray(c.data?.items) ? c.data.items : []);
        setInventario(Array.isArray(i.data) ? i.data : []);
      } catch (e) {
        if (activo) setErr('No se pudo cargar el catalogo de medicamentos o el inventario.');
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const stockPorNombre = useMemo(() => {
    const m = new Map();
    for (const item of inventario) {
      const clave = norm(item.nombre);
      if (!m.has(clave)) m.set(clave, item.stock_actual || 0);
    }
    return m;
  }, [inventario]);

  const stockDe = (med) => {
    const nombre = norm(med.nombre);
    if (stockPorNombre.has(nombre)) return stockPorNombre.get(nombre);
    const tokens = tokeniza(med.nombre);
    for (const [clave, stock] of stockPorNombre) {
      const tokensInv = tokeniza(clave);
      const inter = tokens.filter((t) => tokensInv.includes(t));
      if (inter.length > 0 && inter.length / Math.min(tokens.length, tokensInv.length) >= 0.6) return stock;
    }
    return null;
  };

  const buscarInvItem = (med) => {
    const nombre = norm(med.nombre);
    const exacto = inventario.find((i) => norm(i.nombre) === nombre);
    if (exacto) return exacto;
    const tokens = tokeniza(med.nombre);
    return inventario.find((i) => {
      const tokensInv = tokeniza(i.nombre);
      const inter = tokens.filter((t) => tokensInv.includes(t));
      return inter.length > 0 && inter.length / Math.min(tokens.length, tokensInv.length) >= 0.6;
    }) || null;
  };

  const setReceta = (idx, patch) => {
    onRecetas((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const quitarReceta = (idx) => onRecetas((prev) => prev.filter((_, i) => i !== idx));

  const agregarVacía = () => onRecetas((prev) => [...prev, { nombre: '', posologia: '' }]);

  const seleccionar = (med) => {
    if (esAplicado) {
      const stock = stockDe(med);
      if (stock === null || stock <= 0) return;
    }
    const invItem = buscarInvItem(med);
    setReceta(abierta, {
      nombre: med.nombre,
      posologia: med.posologia_sugerida || posologiaBase(med),
      insumo_id: invItem?.id || null,
      tabla_origen: invItem?.tabla_origen || null,
    });
    setAbierta(null);
  };

  const seleccionarReceta = (med) => {
    setReceta(abierta, {
      nombre: med.nombre,
      posologia: med.posologia_sugerida || posologiaBase(med),
      insumo_id: null,
    });
    setAbierta(null);
  };

  const agregarExterno = () => {
    if (!extNombre.trim()) return;
    onRecetas((prev) => [
      ...prev,
      {
        nombre: extNombre.trim(),
        posologia: extDosis.trim(),
        tipo: 'medicamento_externo',
        dosis: extDosis.trim(),
        hora_aplicacion: extHora || null,
        insumo_id: null,
      },
    ]);
    setExtNombre('');
    setExtDosis('');
    setExtHora('');
    setMostrarExterno(false);
  };

  const disponibles = useMemo(() => catalogo.filter((m) => (stockDe(m) ?? 0) > 0).length, [catalogo, stockDe]);
  const sinStock = useMemo(() => catalogo.length - disponibles, [catalogo, disponibles]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Pill className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="font-bold text-[11px] text-slate-600 uppercase tracking-wide">
          {esAplicado ? 'Medicamentos aplicados' : 'Medicamentos recetados'}
        </h3>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {!err && esAplicado && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <PackageCheck className="w-3 h-3" /> {disponibles} con stock
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">
            <PackageX className="w-3 h-3" /> {sinStock} sin stock
          </span>
        </div>
      )}

      {/* Lista de medicamentos */}
      <div className="space-y-2">
        {recetas.map((r, idx) => {
          const esExterno = r.tipo === 'medicamento_externo';
          const stock = r.nombre ? stockPorNombre.has(norm(r.nombre)) ? stockPorNombre.get(norm(r.nombre)) : stockDe({ nombre: r.nombre }) : null;
          const faltaStock = esAplicado && !esExterno && r.nombre && (stock === null || stock <= 0);
          return (
            <div key={idx} className={`rounded-lg border bg-white p-2 relative ${esExterno ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setAbierta(idx)}
                  className="flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-lg bg-slate-50 ring-1 ring-slate-200 hover:ring-brand-primary/50 transition-all hover:bg-white"
                >
                  {r.nombre ? (
                    <>
                      <span className="block text-xs font-semibold text-slate-700 truncate">{r.nombre}</span>
                      {esExterno && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.dosis && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">{r.dosis}</span>}
                          {r.hora_aplicacion && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              <Clock className="w-2.5 h-2.5" /> {r.hora_aplicacion}
                            </span>
                          )}
                        </div>
                      )}
                      {!esExterno && stock !== null && stock > 0 && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          <PackageCheck className="w-2.5 h-2.5" /> {stock}
                        </span>
                      )}
                      {faltaStock && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          <PackageX className="w-2.5 h-2.5" /> Sin stock
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Seleccionar...</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => quitarReceta(idx)}
                  className="p-1.5 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {!esExterno && (
                <div className="mt-1.5">
                  <input
                    value={r.posologia}
                    onChange={(e) => setReceta(idx, { posologia: e.target.value })}
                    placeholder={esAplicado ? "Posologia / dosis" : "Posologia: ej 1 tableta c/8h x 5 dias"}
                    className="cp-input !py-1 !text-[11px]"
                    disabled={!r.nombre}
                  />
                </div>
              )}

              {faltaStock && (
                <p className="mt-1 text-[10px] text-red-600 font-semibold">
                  No disponible en el centro. Retiralo o busca otro.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {recetas.length === 0 && (
        <p className="text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 text-center">
          {esAplicado
            ? 'Medicamentos e insumos que aplicaras al paciente.'
            : 'Medicamentos que recetaras al paciente.'}
        </p>
      )}

      {/* Botones de accion */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={agregarVacía}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-brand-primary/40 text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 font-bold text-[11px] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
        {esAplicado && (
          <button
            type="button"
            onClick={() => setMostrarExterno(!mostrarExterno)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-amber-400/60 text-amber-600 hover:border-amber-400 hover:bg-amber-50 font-bold text-[11px] transition-colors"
          >
            <Syringe className="w-3.5 h-3.5" /> Externo
          </button>
        )}
      </div>

      {/* Formulario medicamento externo */}
      {mostrarExterno && esAplicado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
              <Syringe className="w-3 h-3" /> Medicamento externo (comprado por el paciente)
            </span>
            <button onClick={() => setMostrarExterno(false)} className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-slate-600">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <input
            value={extNombre}
            onChange={(e) => setExtNombre(e.target.value)}
            placeholder="Nombre del medicamento *"
            className="cp-input !py-1.5 !text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={extDosis}
              onChange={(e) => setExtDosis(e.target.value)}
              placeholder="Dosis (ej: 500mg)"
              className="cp-input !py-1.5 !text-xs"
            />
            <input
              type="time"
              value={extHora}
              onChange={(e) => setExtHora(e.target.value)}
              className="cp-input !py-1.5 !text-xs"
            />
          </div>
          <button
            onClick={agregarExterno}
            disabled={!extNombre.trim()}
            className="w-full py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            Registrar aplicacion
          </button>
        </div>
      )}

      {recetas.some((r) => r.nombre) && (
        <p className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 font-semibold">
          <CheckCircle2 className="w-3 h-3" /> {recetas.filter((r) => r.nombre).length} medicamento(s) registrado(s)
        </p>
      )}

      {/* Modal catalogo segun variante */}
      {esAplicado ? (
        <StockCatalogModal
          abierto={abierta !== null}
          onClose={() => setAbierta(null)}
          onSeleccionar={seleccionar}
          catalogo={catalogo}
          inventario={inventario}
          cargando={cargando}
          err={err}
          stockDe={stockDe}
        />
      ) : (
        <RecetaCatalogModal
          abierto={abierta !== null}
          onClose={() => setAbierta(null)}
          onSeleccionar={seleccionarReceta}
          catalogo={catalogo}
          cargando={cargando}
          err={err}
        />
      )}
    </div>
  );
}
