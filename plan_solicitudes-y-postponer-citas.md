# Plan: solicitudes de citas y postponer citas

Estado: implementado y verificado.

## Objetivo

Dar a recepción dos herramientas dentro del sistema interno:

1. **Solicitudes de citas**: consultar citas pendientes, confirmadas, completadas o canceladas, con búsqueda por paciente, cédula o teléfono, filtros por origen, estado y rango de fechas.
2. **Postponer citas**: registrar la ausencia de un médico, detectar las citas afectadas, proponer huecos reales de agenda y mover la cita **solo después** de que recepción confirme que el paciente aceptó.

## Decisiones de diseño

- No hay sobrecupo: los médicos no lo aceptan.
- No se mueven citas en silencio. Generar el plan solo crea propuestas; la cita original cambia al confirmar.
- Si no hay cupo, la propuesta queda en `sin_cupo`; nunca se inventa capacidad.
- La confirmación es manual desde recepción. La fase 1 no depende de Evolution API ni de envío automático de WhatsApp.
- Los enlaces `wa.me` abren WhatsApp con un mensaje redactado, pero recepción decide cuándo enviarlo.
- La ausencia se puede registrar para hoy o fechas futuras; bloquea la agenda y la creación de citas en ese rango.
- Las solicitudes se listan sin filtrar por clínica por defecto, porque las citas históricas usan `centro_id` 1-6 y los usuarios nuevos clínicas 13-18.
- Zona horaria del sistema: `America/Caracas`. Se usa `CURRENT_DATE` y `CURRENT_TIME`, no `datetime.now(utc)`.

## Base de datos

Migración manual: `interno/backend/migrations/017_ausencias_reprogramaciones.sql`.

Crea:

- `ausencias_medicos`: médico, rango de fechas, motivo, estado (`activa`, `resuelta`, `cancelada`), auditoría.
- `reprogramaciones_citas`: cita, ausencia, fecha/hora anterior, fecha/hora propuesta, estado (`propuesta`, `confirmada`, `rechazada`, `sin_cupo`, `cancelada`), contacto (`pendiente`, `contactado`, `no_contesta`, `confirmado`, `rechazado`), notas y auditoría.

No hay Alembic. La migración se aplica a mano con `psql` o:

```powershell
cd interno/backend
python migrations/aplicar_sql.py migrations/017_ausencias_reprogramaciones.sql
```

## Backend

### Schemas

`interno/backend/app/schemas/reprogramacion.py`:

- `CitaSolicitudItem`, `CitasSolicitudResponse`.
- `AusenciaCrearRequest`, `AusenciaItem`, `AusenciasResponse`.
- `AfectadaItem`, `AfectadasResponse`.
- `PlanRequest`, `PlanResumen`, `PlanResponse`.
- `PropuestaItem`, `PropuestasResponse`.
- `ConfirmarPropuestaResponse`.
- `RechazarPropuestaRequest`, `ReproponerRequest`, `ContactoRequest`.

### Servicio

`interno/backend/app/services/reprogramacion.py`:

- `listar_citas`: paginación y filtros por estado, origen, médico, centro, fechas y texto.
- `listar_afectadas`: citas `pendiente` o `confirmada` dentro de la ausencia.
- `generar_plan`: recorre la agenda real del médico, excluye ausencias y citas ocupadas, y genera una propuesta por cita afectada.
- Estrategias: `primer_hueco`, `mismo_dia_semana`, `fecha_objetivo`.
- `insertar_propuestas`: convierte fechas/horas a tipos nativos antes de insertar (asyncpg no acepta strings en columnas `time`).
- `confirmar_propuesta`: revalida que el hueco siga libre, mueve la cita y marca la propuesta como confirmada.
- `rechazar_propuesta`, `reprogramar_propuesta`, `actualizar_contacto`.
- `resolver_ausencia`: marca la ausencia como resuelta solo cuando ya no quedan propuestas pendientes **ni citas pendientes/confirmadas dentro del rango**. Un rechazo no resuelve la ausencia por sí solo.

### Endpoints

Prefijo `/api/v1/reprogramaciones`, todos con JWT:

- `GET /citas`
- `POST /ausencias`
- `GET /ausencias`
- `PATCH /ausencias/{id}/cancelar`
- `GET /ausencias/{id}/afectadas`
- `POST /ausencias/{id}/plan`
- `GET /propuestas`
- `POST /propuestas/{id}/confirmar`
- `POST /propuestas/{id}/rechazar`
- `POST /propuestas/{id}/reproponer`
- `PATCH /propuestas/{id}/contacto`

Además, `interno/backend/app/api/v1/endpoints/agenda.py` ahora:

- Marca días de ausencia como no disponibles.
- Bloquea la creación de citas en fechas de ausencia.
- Bloquea `reprogramar-todas` si la fecha cae en una ausencia.

### Pruebas

`interno/backend/tests/test_reprogramaciones.py` cubre:

- La ausencia bloquea disponibilidad y creación de citas.
- El plan genera propuestas, la confirmación mueve la cita y resuelve la ausencia.
- Confirmar detecta un hueco ocupado y permite re-proponer.
- Rechazar una propuesta no resuelve la ausencia si todavía quedan citas afectadas; se puede generar un nuevo plan.

`interno/backend/tests/conftest.py` incluye `ausencias_medicos` en el `TRUNCATE`.

Resultado de la suite completa: **39 passed**.

## Frontend

### Cliente API

`interno/frontend/src/api/reprogramaciones.js` expone todas las llamadas del flujo.

### Solicitudes de citas

`interno/frontend/src/components/reception/SolicitudesCitas.jsx`:

- Filtros por texto, estado, origen y rango de fechas.
- Paginación.
- Tarjetas resumen.
- Tabla en escritorio y tarjetas en móvil.
- Enlace `wa.me` cuando hay teléfono.

### Postponer citas

`interno/frontend/src/components/reception/ReprogramacionCitas.jsx`:

- Formulario para registrar ausencia (médico, desde, hasta, motivo).
- Lista de ausencias con citas afectadas y propuestas pendientes.
- Generación del plan con estrategia, fecha de búsqueda y opción de reemplazar propuestas.
- Resumen del plan: total, con cupo, sin cupo y sin teléfono.
- Tarjeta por propuesta con:
  - Fecha/hora anterior y propuesta.
  - Datos del paciente y médico.
  - WhatsApp, llamado, no contesta.
  - Confirmar, rechazar y cambiar fecha.
  - Selector de huecos reales consultando `/agenda/turnos`.
- La cita solo se mueve al pulsar **Confirmar**.

### Navegación

- `ReceptionSidebar.jsx`: nuevas entradas **Solicitudes de Citas** y **Postponer Citas**.
- `ReceptionInterface.jsx`: nuevas secciones y renderizado de los componentes.

## Verificación

```powershell
cd interno/backend
python -m pytest

cd ../frontend
npm run build
npm test
```

Resultados:

- Backend: 39 passed.
- Frontend build: correcto.
- Frontend tests: 12 passed.

## Prompt de delegación

Usa este prompt para delegar una revisión o continuación del cambio. El agente debe verificar primero si ya existe para no duplicar código.

```text
Trabaja en el sistema interno de BnaSalud, en la raíz del repo.

Tarea: revisar y, solo si falta, completar la fase 1 de "Solicitudes de citas" y "Postponer citas" para recepción.

Antes de editar nada:
1. Lee AGENTS.md e interno/AGENTS.md.
2. Verifica si ya existen estos archivos y qué contienen:
   - interno/backend/migrations/017_ausencias_reprogramaciones.sql
   - interno/backend/app/schemas/reprogramacion.py
   - interno/backend/app/services/reprogramacion.py
   - interno/backend/app/api/v1/endpoints/reprogramaciones.py
   - interno/backend/tests/test_reprogramaciones.py
   - interno/frontend/src/api/reprogramaciones.js
   - interno/frontend/src/components/reception/SolicitudesCitas.jsx
   - interno/frontend/src/components/reception/ReprogramacionCitas.jsx
3. Comprueba si el router ya registra `/reprogramaciones`, si agenda bloquea ausencias y si ReceptionSidebar/ReceptionInterface ya tienen las secciones "solicitudes" y "postponer".
4. Si el cambio ya está implementado, no lo dupliques: audita, ejecuta las verificaciones y reporta diferencias concretas.
5. Si falta una parte, impleméntala siguiendo los patrones existentes.

Reglas obligatorias:
- No hay sobrecupo: nunca asignes dos citas al mismo médico, fecha y hora.
- No muevas citas al generar propuestas. La cita original solo cambia al confirmar una propuesta.
- Si no hay cupo, usa estado `sin_cupo`; no inventes horarios.
- La confirmación es manual desde recepción.
- Usa `CURRENT_DATE`/`CURRENT_TIME`; no uses `datetime.now(utc)`.
- No hay Alembic: cualquier cambio de esquema va como SQL manual en interno/backend/migrations/.
- No mezcles el sistema interno con el portal público de la raíz.
- Prosa, documentación y mensajes en español.
- No agregues comentarios innecesarios al código.

Verificación obligatoria al terminar:
- `cd interno/backend; python -m pytest`
- `cd interno/frontend; npm run build`
- `cd interno/frontend; npm test`

Reporta: archivos tocados, endpoints afectados, resultados exactos de las tres verificaciones y cualquier decisión pendiente.
```
