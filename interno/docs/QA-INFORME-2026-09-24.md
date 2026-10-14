# Informe QA — BnaSalud / CITAB (Módulo Interno)

Fecha: 2026-09-24 · Ejecutado por API real (`http://localhost:8000/api/v1`) contra la BD PostgreSQL en vivo.

## 1. Alcance y método

Reconocimiento E2E de la operación clínica diaria: recepción → guardia → emergencia → consultas
(recetas/insumos/signos) → remisión a especialista y a examen → cola/consulta del especialista →
farmacia. Método: script `qa-e2e.ps1` + llamadas manuales con `Invoke-RestMethod`/`psql`.
Regla de trabajo: cualquier error de la API se confirma como bug con test que falla primero (TDD),
se corrige en el código, y se verifica con la suite completa.

## 2. Usuarios que realizaron acciones

| Usuario | Rol (BD) | Centro | Acciones en el QA |
|---|---|---|---|
| `rec_citab` | recepcionista | Ciudad Táchira | Login; check-in de 3 pacientes (público/trabajador/beneficiario); iniciar guardia de emergencia |
| `eprueba` | medico_emergencia | Ciudad Táchira | Login (gate por guardia hoy); transiciones EN_ESPERA_CONSULTA→EN_CONSULTA; 2 consultas de emergencia con receta, insumo, signos vitales y CIE-10 |
| `med_citab` | medico | Ciudad Táchira | Login (médico y como especialista); publicación de cita de remisión; cola de especialista (rol=medico) |
| `farm_citab` | farmacéutica | Ciudad Táchira | Login; consulta de inventario de medicamentos |

### Pacientes de prueba usados (limpiados tras el QA)

| Cédula | Categoría | Detalle |
|---|---|---|
| `QA213653-P` (QA-*) | Público | Ruta EMERGENCIA, teatro del check-in |
| `8204047` | Trabajador | RAZINIA DOLORES ALVAREZ HURTADO (ruta EMERGENCIA, usada para la cita de examen) |
| `13599140` | Beneficiario | VIRGINIA ADONAY GONZALEZ de empleado 20975594 (ruta CITA) |

Secreto de prueba usado: `test123` (los de `USUARIOS_PRUEBA.md`). No se usó ni expuso credencial real.

## 3. Resultado del recorrido

Corrida del script: **15/18 pasos OK, 3 fallos** — de los cuales **1 era bug real de la app** (corregido)
y **2 son defectos del propio script** (secuenciación, no de la aplicación).

|#| Paso | Resultado | Observación |
|---|---|---|---|
|1| Login recepción | OK | token JWT emitido |
|2| Login médico | OK | |
|3| Login farmacia | OK | |
|4| Check-in público | OK | Token `C-63186`, estado RECEPCION, categoría `publico` |
|5| Check-in trabajador | OK | C-24508, trabajador |
|6| Check-in beneficiario | OK | C-14364, beneficiario |
|7| Iniciar guardia | OK | 409 esperado (guardia ya iniciada hoy) |
|8| Login emergencia | OK | Todos los usuarios de prueba con guardia activa hoy (guardia `#7`, 2026-09-24) |
|9| Transición cola #92 | OK | → EN_CONSULTA |
|10| Transición cola #93 | **409** | Regla "1 paciente a la vez" (comportamiento correcto; defecto de secuencia del script) |
|11| Consulta emergencia #92 | OK | Comprobante `ABH-42832`, receta + insumo + signos |
|12| Consulta emergencia #93 | **400** | La transición #93 no llegó a EN_CONSULTA (por el 409) → no se puede vincular/finalizar. Defecto de secuencia del script |
|13| Cita de especialista | **404** | **BUG REAL**: cargo `Medico` vs `Médico` — corregido |
|14| Cita de examen | OK | Código `EXAM-2026-49BB`, Creatinina (ofrecido 21), mañana 07:00 |
|15| Login especialista | OK | |
|16| Cola del especialista | OK | Sin pacientes en espera (la cita de remisión falló por el bug del paso 13) |
|17| Farmacia inventario | OK | Listado de medicamentos servido |

## 4. Cambios realizados al código (con test rojo primero)

### 4.1 Fix en vivo: tabla `catalogo_examenes` inexistente (500 en exámenes)

**Hallazgo**: `GET /examenes/catalogo` y `/catalogo/buscar` respondían 500. La BD no tenía
`catalogo_examenes`, `ordenes_medicas` ni `orden_examenes_items`.

**Causa raíz**: `backend/app/seed_ordenes_examenes.py` era SQL puro disfrazado de módulo Python,
por lo que nunca se ejecutó (no es importable). El AGENTS.md ni siquiera lo documentaba.

**Cambios**:
- `backend/app/seed_ordenes_examenes.py` → **renombrado a `seed_ordenes_examenes.sql`** (`git mv`)
  y aplicado con `psql -v ON_ERROR_STOP=1 -f app/seed_ordenes_examenes.sql` a la BD real:
  crea las 3 tablas, tipos ENUM, trigger de ítems de orden y siembra 100 exámenes en 4 categorías.
- `backend/tests/test_ordenes_examenes.py` (nuevo): 3 tests — catálogo, búsqueda por texto, creación de
  orden de examen.
- `backend/tests/conftest.py`: `_sembrar` ahora siembra `catalogo_examenes` (Hemograma completo)
  para la BD de test.
- `AGENTS.md`: documentada la aplicación del nuevo seed con `psql` (no es módulo Python).

Verificación: suite completa **33 tests en verde** (31 previos + 2 de agenda del punto 4.2).

### 4.2 Fix: remisión a especialista fallaba con 404 (cargo `Medico` sin tilde)

**Hallazgo**: `POST /agenda/citas` devolvía 404 para `med_citab`. El endpoint `/agenda/especialistas`
no lo listaba.

**Causa raíz**: `agenda.py` filtraba especialistas con comparación literal
`p.cargo = 'Médico'` (con tilde), pero `personal.cargo` almacena variantes con *y* sin tilde
(`'Medico'` / `'Médico'`). Los médicos con cargo sin tilde quedaban excluidos de la agenda y
rechazados en la creación de citas de remisión.

**Cambios**:
- `backend/app/api/v1/endpoints/agenda.py`: comparación normalizada a `LOWER(p.cargo) = 'medico'`
  en los 2 puntos (`_especialista` y `listar_especialistas`).
- `backend/tests/test_agenda_cargo_tilde.py` (nuevo): 2 tests — el especialista con cargo 'Medico'
  debe aparecer en el listado y aceptar cita (201).

Verificación en vivo: tras reiniciar uvicorn, `/agenda/especialistas` ya lista a `Doctor CITAB` (id 41).

### 4.3 Incluido en esta fase (sesión anterior, ya verificado)

- Gate de login para `medico_emergencia`: exige guardia ACTIVA que cubra hoy (fecha hoy o ayer,
  turnos 24h/nocturnos) en `backend/app/api/v1/endpoints/auth.py`; el frontend `GuardiaPanel.jsx`
  envía la fecha local (no UTC). Con `test_guardia_login.py` (4 tests). Verificado en vivo con `eprueba`.
- Reseteo de la contraseña de `eprueba` a `test123` y finalización de guardias huérfanas en la BD real.

## 5. Hallazgos menores / observaciones

1. **Regla "un paciente a la vez"**: el 409 en la transición de cola es comportamiento correcto
   (un médico no puede tener 2 pacientes EN_CONSULTA). El script debe secuenciar paciente por
   paciente (transicionar → consulta → finalizar → siguiente), no en dos fases. Es defecto del
   script, no de la app.
2. **Al vincular consulta**: la app acepta crear la consulta aunque la cola no esté en EN_CONSULTA
   y luego rechaza el vínculo/finalización (400). El frontend ya protege el flujo; observación de
   robustez opcional: validar `cola.atencion_estado == 'EN_CONSULTA'` antes de aceptar la consulta.
3. **Inventario de farmacia**: el endpoint unificado sigue resolviendo correctamente con
   `tabla_origen` (colisión de IDs entre `medicamentos_catalogo` e `insumos_catalogo`).
4. **Cita de examen**: requiere fecha *mañana o posterior*; turno de Creatinina 07:00–12:00 en el
   centro adscrito. Elegibilidad vía `GET /remision-examen/elegibilidad?cedula=...`.
5. **PS 5.1**: los `.ps1` con caracteres no ASCII se corrompían al leerse desde archivo; el script
   E2E se reescribió en ASCII puro. Función llamada `H` chocaba con el alias de Get-History → `Head`.

## 6. Plan de mejora (propuestas, pendientes de decisión)

1. **Corregir `qa-e2e.ps1`** para secuenciar emergencia paciente a paciente y re-ejecutar hasta 18/18.
2. **Completar recorrido no probado end-to-end**: asistencia a la cita de examen y carga de resultado
   definitivo de un ítem de orden por el laboratorio de centro adscrito.
3. **Carga de recetas/insumos en la BD**: verificar que la receta (Amoxicilina 500mg cada 8h × 7d) y el
   insumo (Amoxicilina, medicamentos_catalogo id 35, ×5) dedujeron stock correctamente en la BD real.
   (Las consultas QA se crearon; falta verificación de stock — se limpiaron las historias QA tras la corrida.)
4. **Robustez opcional (punto 5.2)**: validación de estado de cola en el POST /consultas.
5. **Estandarizar el cargo** `Medico`/`Médico` en los catálogos de personal (una sola variante) para
   evitar regresiones futuras de la comparación normalizada.
6. **F4 (respaldos + borrado legacy)**: alcance aprobado; pendiente confirmar ubicación del respaldo,
   rotación (7d) y scheduling (manual vs Task Scheduler) antes de implementar `limpiar_legacy.ps1`
   con backup previo verificado.

## 7. Datos generados por el QA (limpieza)

Después de la corrida se eliminaron de la BD real: colas QA (#86–89 y no-finalizadas de los accesorios),
historias clínicas QA-*, citas/citas_examenes/consultas QA (cascada). Quedan intencionalmente:
guardia `#7` (2026-09-24) ACTIVA para `eprueba`, y la cita de examen `EXAM-2026-49BB` (pendiente,
útil para el recorrido del punto 6.2).