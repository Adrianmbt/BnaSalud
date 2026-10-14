import assert from 'node:assert/strict';
import { reducer } from './modalStackPila.js';

// Self-check del reducer de la pila de modales: el boton atras cierra la cima,
// y desapilar una entrada ya cerrada no debe tumbar el resto.
const a = { id: 1, etiqueta: 'Insumos' };
const b = { id: 2, etiqueta: 'Historial' };

assert.deepEqual(reducer([], { tipo: 'apilar', entrada: a }), [a]);
assert.deepEqual(reducer([a], { tipo: 'apilar', entrada: b }), [a, b]);

// Desapilar por id quita la correcta sin reordenar las demas.
assert.deepEqual(reducer([a, b], { tipo: 'desapilar', id: 1 }), [b]);

// Id desconocido (ya se cerro por su propio boton) no cambia el estado.
assert.deepEqual(reducer([a, b], { tipo: 'desapilar', id: 99 }), [a, b]);
assert.deepEqual(reducer([a, b], { tipo: 'vaciar' }), []);

// Orden de apilado es el orden de cierre: LIFO.
let pila = [];
for (const e of [a, b]) pila = reducer(pila, { tipo: 'apilar', entrada: e });
assert.equal(pila[pila.length - 1].etiqueta, 'Historial');

console.log('modal-stack: 7 asserts OK');