# Flujo: «Certificar horarios» (RRHH) y asignación de citas en recepción

Documento de referencia del comportamiento **actual** del sistema (noviembre 2026).
Cubre dos recorridos que se encadenan:

1. Recursos Humanos certifica el horario semanal de los especialistas.
2. Recepción asigna (o preasigna) las citas de los pacientes con esos cupos.

---

## 0. Antes de certificar: quién carga el horario

- `admin_sistemas` (y `recursos_humanos`) edita el horario semanal en **Panel de Administración → Horarios**.
- Se guarda con `PUT /api/v1/admin/medicos/{medico_id}/horario`, que **reemplaza** las filas de `agenda_medicos` del médico (tabla plantilla semanal: `medico_id`, `dia_semana` 0=lunes … 6=domingo, `turno_id`, `activo`).
- Turnos disponibles: **Mañana** y **Tarde**; solo **Medicina General** y **Emergencias** pueden tener turnos de 24 h (validado en el backend).
- El catálogo de turnos (`turnos`) define `hora_inicio` / `hora_fin`; `agenda.py` expande cada turno en *slots* de 30 minutos (`SLOT_MINUTOS = 30`), y cada turno admite como máximo **10 citas** (`MAX_CUPOS_TURNO` / `LIMITE_CITAS_POR_TURNO`).
- Ojo: el guardado del horario **también** dispara el reparto de citas preasignadas (`citas_preasignadas_asignadas` en la respuesta del `PUT`). La certificación es la vía explícita para hacerlo por semana y para todos los especialistas a la vez.

---

## 1. El botón «Certificar horarios» (frontend)

Archivo: `frontend/src/pages/SystemAdminInterface.jsx`, componente `HorariosSection`.

- Ubicación: **barra superior de la sección Horarios**, encima de la datatable, junto al buscador y al selector **«Semana del»** (input de fecha; por defecto el lunes de la semana en curso).
- Visible para `recursos_humanos` y `admin_sistemas` (`puedeCertificar`). Para otros roles la sección ni siquiera aparece en el menú.
- Acciones al pulsar:
  1. Normaliza la fecha elegida al **lunes** de esa semana (`lunesDeLaSemana`).
  2. Pide confirmación: *«¿Certificar los horarios de la semana del AAAA-MM-DD? Se validan los días cargados de cada especialista y se asignan las citas en cola de esa semana: 10 cupos por día de atención, priorizando trabajadores y beneficiarios de la nómina.»*
  3. Llama `POST /api/v1/admin/medicos/horario/certificar?semana_desde=<lunes>` con spinner en el botón.
  4. Muestra un aviso verde con el resumen: días certificados, especialistas, citas asignadas y cuántos pacientes siguen en cola sin cupo. Recarga la lista de médicos.
- Texto de ayuda bajo la barra: explica la regla de cupos (10 por día de atención, prioridad de nómina y horas escalonadas cada 30 minutos).

Acciones secundarias (misma sección):

- Icono de escudo en cada fila → certifica **solo** a ese médico (`POST /admin/medicos/{id}/horario/certificar`).
- Dentro del modal de edición del horario, botón **«Certificar horario»** → mismo endpoint individual.

---

## 2. Qué ocurre en el backend al certificar

Archivo: `backend/app/api/v1/endpoints/admin_sistema.py`.
Endpoint: `POST /medicos/horario/certificar` (`certificar_horarios_de_la_semana`).

1. **Columnas de certificación**: `_asegurar_columnas_certificacion` ejecuta
   `ALTER TABLE agenda_medicos ADD COLUMN IF NOT EXISTS certificado BOOLEAN DEFAULT FALSE, certificado_en TIMESTAMPTZ, certificado_por TEXT`
   (el proyecto no usa Alembic, así que se asegura en caliente).
2. **Semana**: `_inicio_de_semana(semana_desde, hoy)` toma `CURRENT_DATE` de la base (zona `America/Caracas`) y normaliza al lunes; la semana va de **lunes a viernes**.
3. **Médicos incluidos**: todos los `personal` con al menos un día activo de lunes a viernes en `agenda_medicos` y que sean especialistas (`cargo` medico/médico con `especialidad`, o usuario con rol `medico_emergencia`).
4. **Certificación de días** (`_certificar_dias_de_medico`): marca `certificado = TRUE`, `certificado_en = NOW()`, `certificado_por = sub del usuario` en las filas activas de lunes a viernes y registra la semana en **`agenda_certificaciones_semana`** (`medico_id` + lunes de la semana). Esa fila es la que abre **esa semana concreta** en recepción. Devuelve cuántos **días distintos** quedaron certificados.
5. **Reparto de la cola** (`_asignar_citas_preasignadas_de_medico(db, medico_id, lunes)`): ver punto 3 (prioridad de nómina, cupo por día y horas escalonadas).
6. **Pendientes sin cupo**: cuenta las citas que siguen en estado `preasignada` en esa semana (no pudieron entrar en el cupo).
7. **Auditoría**: `_auditar(...)` guarda «horarios de médicos certificados» con semana, cantidad de médicos, días certificados, citas asignadas, citas sin cupo y usuario.
8. **Commit y respuesta**:

```json
{
  "message": "Horarios certificados.",
  "semana_desde": "2026-11-16",
  "semana_hasta": "2026-11-20",
  "total_medicos": 6,
  "total_dias_certificados": 14,
  "total_citas_asignadas": 9,
  "total_citas_sin_cupo": 2,
  "medicos": [
    {
      "medico_id": 12,
      "medico_nombre": "Ana Perez",
      "dias_certificados": 2,
      "citas_asignadas": 4,
      "citas_sin_cupo": 0
    }
  ]
}
```

---

## 3. Regla de cupos y algoritmo de reparto

Función: `_asignar_citas_preasignadas_de_medico` (misma usada por el `PUT` del horario y por el endpoint individual).

- **Días de atención**: los días lunes-viernes activos en `agenda_medicos` del médico.
- **Cupo semanal**: `10 × (días de atención)`, sin tope de 20:
  - atiende **1 día** → **10 cupos**,
  - atiende **2 días** → **20 cupos**,
  - atiende **3 días** → **30 cupos** (y así sucesivamente).
- **Cupo por día**: **10 citas por día de atención sumando todos sus turnos** (si el médico tiene Mañana y Tarde el mismo día, no se pasan de 10 en total).
- **Cupo por turno**: nunca se pasa de **10 citas** en un mismo turno.
- La regla vive en `backend/app/services/reparto_citas.py` (`elegir_hueco`), sin acceso a base de datos, para poder probarla con datos sintéticos.
- **Prioridad de nómina**: primero los **trabajadores** (`empleados.activo`), luego los **beneficiarios** (`beneficiarios.activo`) y al final el **público general**; dentro de cada grupo se respeta el orden de solicitud (`created_at`). La clasificación cruza la cédula del paciente (`historias_clinicas.cedula`) con la nómina ignorando `V-`, puntos y espacios, y usa `app/services/afiliacion.py`.
- **Cupo ya usado**: se descuentan las citas `confirmada` / `pendiente` que el médico ya tenga en esa semana (`cupo_semana − usadas`). Si el saldo es 0, la cita **se queda preasignada**.
- **Reparto**: se recorre la semana día por día (lunes primero, solo días cargados), **omitiendo días anteriores a `CURRENT_DATE`**; en cada día se recorren sus turnos por hora de inicio y se elige el primero con menos de 10 citas.
- **Horas escalonadas**: cada cita se coloca en el **primer bloque libre de 30 minutos** del turno (`SLOT_MINUTOS = 30`): 08:00, 08:30, 09:00…, salvo que esa hora ya esté ocupada por otra cita vigente del médico ese día.
- **Al asignar** una cita se actualiza:
  - `fecha_cita` = día elegido,
  - `hora_inicio` = primer slot libre de 30 minutos del turno,
  - `estado` = `'confirmada'`,
  - `motivo` = el existente o `'Asignada automáticamente al certificar horario'`.

**Ejemplo** — el Dr. Pérez atiende martes y jueves, tiene 15 pacientes preasignados y 0 citas ya confirmadas:
- cupo semanal = `10 × 2` = **20** → entran los 15; sobran 5 cupos.

**Ejemplo** — la Dra. Gómez atiende lunes, miércoles y viernes (30 cupos), tiene 33 preasignadas y 5 citas confirmadas:
- saldo = 30 − 5 = **25** → entran 25; **8 quedan en `preasignada`** y se reportan en `citas_sin_cupo`.

**Ejemplo de prioridad** — hay 10 cupos y 12 pacientes en cola: 4 trabajadores, 3 beneficiarios y 5 de público general (los del público general solicitaron antes). Entran los 4 trabajadores, los 3 beneficiarios y 3 del público general; los 2 restantes siguen `preasignada`.

> Nota: el reparto solo actúa sobre semanas con fila en `agenda_certificaciones_semana`; las demás citas preasignadas quedan intactas. El cupo, además, se calcula contra las citas reales de la semana elegida.

---

## 4. Qué cambia para recepción después de certificar

- **La semana queda abierta solo si está certificada**: `/agenda/cupos-semanal` y `/agenda/semanas-resumen` consultan `agenda_certificaciones_semana` para el lunes pedido. Si no hay fila, devuelven `certificada = false`, ningún día con turnos y `cupos_libres = 0`, así que el modal muestra **«Horario pendiente de verificación por RRHH»** y solo permite preasignar.
- En el desplegable de semanas la semana sin certificar aparece con punto ámbar y la insignia **«Pendiente RRHH»** (antes decía «Agotado»).
- Certificar una semana **no** abre las demás: cada semana necesita su propia certificación.
- Las citas que la certificación repartió aparecen como `confirmada` en las fechas asignadas y **consumen cupo** en el calendario semanal.
- El reparto automático (`_asignar_citas_preasignadas_de_medico`) ignora cualquier semana sin certificar; esas citas permanecen en `preasignada`.

---

## 5. Flujo de trabajo en recepción al asignar citas

UI: bandeja de solicitudes (`frontend/src/components/reception/SolicitudesCitas.jsx`) → botón *Asignar* → modal `AsignarCitaModal.jsx`.

### Datos que carga el modal

1. `GET /api/v1/reprogramaciones/ficha/{cita_id}` (o datos del paciente en memoria) → paciente, especialidad y motivo de la solicitud.
2. `GET /api/v1/agenda/especialistas` → lista de médicos; se filtra por la especialidad de la cita (si no hay coincidencias, muestra todas).
3. `GET /api/v1/agenda/semanas-resumen?medico_id=…&cantidad=6` → etiqueta de cada semana, cupos libres totales y `tiene_cupos` para el selector de semana.
4. `GET /api/v1/agenda/cupos-semanal?medico_id=…&semana_desde=…` → por cada día laborable: `turnos[]` con `turno_id`, nombre, rango horario, `cupos_libres` y `hora_asignada` (primer slot libre). Se descuentan ausencias (`ausencias` del médico) y citas no canceladas.

### Camino A — la semana tiene horario cargado

1. Recepción elige **día** (solo se habilitan días con `cupos_libres > 0`).
2. Elige **turno** (Mañana/Tarde; si solo hay uno se autoselecciona) y ve los cupos restantes.
3. Confirma → `POST /api/v1/agenda/citas` con:
   `{ cita_id, paciente_id, medico_id, fecha, hora_inicio: turno.hora_asignada || turno.hora_inicio, turno_id, nivel: 'verde', especialidad, motivo, origen, preasignada: false }`.
4. El backend crea/actualiza la cita en estado **`confirmada`**.
5. El modal muestra la pantalla de confirmación (fecha larga, turno, código de cita).

### Camino B — la semana no tiene horario cargado (modo preasignación)

1. El modal muestra *«Horario pendiente de verificación por RRHH»*; **no se elige turno**: el día, el turno y la hora saldrán del horario cargado del especialista.
2. Recepción confirma → `POST /api/v1/agenda/citas` con `preasignada: true`, `fecha` = **lunes** de la semana elegida (referencia de semana para el reparto). El backend guarda una hora provisoria (08:00) que la certificación reemplaza por el bloque real.
3. La cita queda en estado **`preasignada`**: reserva el lugar en la semana pero **sin día definitivo**. Aparece así en la bandeja: etiqueta *«Preasignada (RRHH)»*, filtro *Preasignadas (Esperando RRHH)*.
4. Cuando RRHH pulsa **«Certificar horarios»** para esa semana, esas citas entran en el reparto descrito en el punto 3 y pasan a `confirmada` con día y hora real.

### Validaciones del backend al crear la cita (`POST /agenda/citas`)

- `nivel` debe ser `azul | verde | amarillo`.
- `fecha` con formato `YYYY-MM-DD`.
- Debe venir `hora_inicio` **o** `turno_id`; si viene `turno_id`, el turno debe estar activo para ese médico ese día de la semana.
- Si el especialista está **ausente** ese día → `409`.
- Bloqueo transaccional `pg_advisory_xact_lock` por médico+fecha+hora para evitar doble reserva entre portal web y recepción.
- Si la hora ya está ocupada (y no es la misma cita) → `409 «Esa hora (HH:MM) ya está ocupada»`.
- Al crear con `cita_id` se **actualiza** la solicitud existente en lugar de duplicarla, y se conserva centro/paciente.
- Se notifica al portal web (Supabase) y se prepara el mensaje de WhatsApp con código de cita.

---

## 6. Estados de la cita en este flujo

| Estado | Significado | Quién lo produce |
| --- | --- | --- |
| `pendiente` | Solicitud sin atender | Portal web / recepción |
| `preasignada` | Cupo reservado en la semana, sin día exacto (esperando certificación de RRHH) | Recepción (camino B) |
| `confirmada` | Día y hora definidos (manual o por certificación) | Recepción (camino A) / certificación automática |
| `completada` | Atención realizada | Médico / historias médicas |
| `cancelada` | Anulada; libera cupo | Recepción / admin |

---

## 7. Trazabilidad

- Cada certificación deja registro en el log de auditoría (`_auditar`) → visible en **Panel → Logs del Sistema**: usuario, semana, médicos, días, citas asignadas y citas sin cupo.
- Cada fila de `agenda_medicos` certificada guarda `certificado`, `certificado_en` y `certificado_por`.

---

## 8. Archivos y endpoints involucrados

| Pieza | Ruta |
| --- | --- |
| Sección Horarios + botón «Certificar horarios» | `frontend/src/pages/SystemAdminInterface.jsx` (`HorariosSection`) |
| Modal de asignación de citas | `frontend/src/components/reception/AsignarCitaModal.jsx` |
| Bandeja de solicitudes | `frontend/src/components/reception/SolicitudesCitas.jsx` |
| Certificación (bulk e individual) y edición de horario | `backend/app/api/v1/endpoints/admin_sistema.py` |
| Cupos, turnos, semanas y creación de citas | `backend/app/api/v1/endpoints/agenda.py` |
| Certificaciones por semana (helpers) | `backend/app/services/certificaciones_horario.py` |
| Migración de `agenda_certificaciones_semana` | `backend/migrations/021_agenda_certificaciones_semana.sql` |
| Cliente HTTP | `frontend/src/api/axiosClient.js` (base `/api/v1`) |

Endpoints usados:

- `GET /api/v1/admin/medicos` — médicos con `dias_con_horario`.
- `GET /api/v1/admin/medicos/{id}/horario` — días y turnos cargados.
- `PUT /api/v1/admin/medicos/{id}/horario` — guarda la plantilla semanal (y reparte preasignadas).
- `POST /api/v1/admin/medicos/horario/certificar?semana_desde=YYYY-MM-DD` — certifica la semana de todos los especialistas.
- `POST /api/v1/admin/medicos/{id}/horario/certificar?semana_desde=YYYY-MM-DD` — certifica un médico.
- `GET /api/v1/agenda/especialistas`, `/agenda/semanas-resumen`, `/agenda/cupos-semanal`, `/agenda/jornadas`, `/agenda/disponibilidad/calendario`.
- `POST /api/v1/agenda/citas` — confirmar o preasignar.

---

## 9. Límites conocidos

- La tabla `agenda_certificaciones_semana` decide qué semanas están abiertas; la columna `agenda_medicos.certificado` sigue marcándose, pero es solo informativa sobre la plantilla.
- Las citas del portal o emergencia que lleguen con día exacto a una semana sin certificar no se bloquean en `POST /agenda/citas` (el candado es de visibilidad en recepción, no de API).
- El reparto escalonado arranca en la hora de apertura del turno y avanza de 30 en 30 minutos; si el día llega a 10 citas se pasa al siguiente día de atención de la semana (el tope diario incluye los dos turnos del mismo día).
- La preasignación no envía turno ni hora: el reparto usa la agenda del especialista, así que el modal tampoco depende de los ids del catálogo `turnos`.
- Si no alcanza el cupo, las citas restantes permanecen `preasignada` y el aviso de la UI informa cuántas quedaron sin cupo; se pueden repartir en otra semana o subir el horario del médico.
