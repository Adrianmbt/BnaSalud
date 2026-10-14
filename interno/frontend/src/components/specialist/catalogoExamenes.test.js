import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_EXAMENES, CATEGORIAS_ORDEN } from './catalogoExamenes.js';

const nombreDe = (e) => (typeof e === 'string' ? e : e.nombre);

function ubicar(nombre) {
  for (const [categoria, grupos] of Object.entries(CATALOGO_EXAMENES)) {
    for (const g of grupos) {
      if (g.estudios.some((e) => nombreDe(e) === nombre)) return { categoria, grupo: g.grupo };
    }
  }
  return { categoria: null, grupo: '' };
}

const TODOS = Object.values(CATALOGO_EXAMENES).flat().flatMap((g) => g.estudios.map(nombreDe));

// El backend resuelve examen_id por nombre exacto contra catalogo_examenes
// (backend/app/api/v1/endpoints/examenes.py). Un nombre mal escrito guarda la
// orden con examen_id NULL, así que la UI nunca debe inventar ni recortar.
test('todo estudio del selector es único', () => {
  const dupes = TODOS.filter((n, i) => TODOS.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `estudios duplicados: ${[...new Set(dupes)].join(', ')}`);
});

test('todo estudio tiene grupo y categoría localizables', () => {
  const huerfanos = TODOS.filter((n) => !ubicar(n).categoria);
  assert.deepEqual(huerfanos, [], `sin categoría: ${huerfanos.join(', ')}`);
});

test('ubicar devuelve la categoría real, no la pestaña activa', () => {
  // Estos viven en imagen: al buscarlos desde la pestaña de laboratorio deben
  // seguir registrándose como imagen, o la orden se guarda mal categorizada.
  const imagen = (CATALOGO_EXAMENES.imagen || []).flatMap((g) => g.estudios.map(nombreDe));
  for (const nombre of imagen.slice(0, 5)) {
    assert.equal(ubicar(nombre).categoria, 'imagen', `"${nombre}" no se ubica en imagen`);
  }
});

test('las 4 categorías del selector tienen estudios', () => {
  for (const cat of CATEGORIAS_ORDEN) {
    const n = (CATALOGO_EXAMENES[cat.id] || []).reduce((a, g) => a + g.estudios.length, 0);
    assert.ok(n > 0, `${cat.id} no tiene estudios`);
  }
});