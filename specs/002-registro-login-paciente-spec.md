# specs/002-registro-login-paciente-spec.md

Estado: **implementado** (2026-11-04)

## Contexto real de la base de datos

La migración a Supabase copió el esquema operativo (el mismo que usa `interno/`), no el
esquema nuevo de `pacientes`/`historias_medicas`. Las tablas que existen hoy en el
proyecto `unvtznfvbdqzsmtlvqkf` son:

`clinicas`, `especialidades`, `usuarios`, `personal`, `personal_turnos`, `turnos`,
`historias_clinicas`, `citas`, `consultas`, `medico_pacientes`, `notificaciones`,
`cola_pacientes`, `recetas`, `recuperacion_pacientes`.

Por eso el portal **usa `historias_clinicas` como ficha del paciente** y el PIN vive en
`historias_clinicas.pin_hash`. No existe tabla `pacientes`.

> El script `supabase_schema_public.sql` no se aplicó: el editor SQL de Supabase ejecuta
> el script completo en una transacción y el error de la política RLS revertía todo.
> Se retiró junto con `supabase_migrate_columns.sql`.

## RF1: Login del paciente (cédula + PIN)

**Endpoint**: `POST /api/v1/auth/paciente`
**Backend**: `app/api/v1/endpoints/auth.py`
**BD**: `historias_clinicas` (`cedula`, `pin_hash`)

1. El frontend envía `{cedula, pin}`.
2. El backend busca por cédula (solo dígitos) y valida `pin_hash` con bcrypt.
3. Emite JWT con `{tipo: "paciente", rol: "paciente", paciente_id, cedula}`.
4. Responde `{token, paciente}` con la ficha de `HistoriaClinicaResponse`.

## RF2: Auto-registro del paciente

**Endpoint**: `POST /api/v1/pacientes/registrar`
**Backend**: `app/api/v1/endpoints/pacientes.py`
**BD**: `historias_clinicas` + `usuarios`

1. Recibe `{tipo_cedula, cedula, nombre_completo, fecha_nacimiento, telefono, email,
   tipo_sangre, alergias, antecedentes_medicos, pin?, consentimiento_datos}`.
2. Rechaza con 409 si la cédula ya existe.
3. Genera un PIN de 4 dígitos si el paciente no eligió uno y valida que sea único.
4. Crea la fila en `historias_clinicas` con `numero_historia = HIS-<tipo><cedula>` y
   `pin_hash`.
5. Crea (best-effort) la cuenta `usuarios` con `rol='paciente'` y `paciente_id`. El login
   real no depende de esa fila: si falla, el registro continúa.
6. Devuelve `{token, paciente}` y el paciente queda autenticado.

El PIN viaja en la respuesta del registro (el paciente lo eligió o se le muestra una
vez). En producción conviene enviarlo además por correo/WhatsApp.

## RF3: Solicitud de cita desde el portal

**Endpoint**: `POST /api/v1/citas` (existente)
**Backend**: `app/api/v1/endpoints/citas.py`

El portal ya usa este endpoint con el paciente embebido (`CitaConPacienteCreate`) o con
`paciente_id` (`CitaCreate`). El backend:

1. Valida centro, especialidad, fecha y disponibilidad del horario.
2. Registra al paciente si es nuevo (`_upsert_paciente`) y genera su PIN.
3. Guarda la cita con `estado='pendiente'`, `origen='cita_web'` y
   `codigo_confirmacion`.
4. Envía por WhatsApp la bienvenida con el PIN cuando el paciente es nuevo.

La cita en `estado='pendiente'` **es la solicitud**: recepción la confirma asignando
médico, fecha y hora.

## RF4: Citas del paciente autenticado

**Endpoint**: `GET /api/v1/citas/mis-citas`
**Backend**: `app/api/v1/endpoints/citas.py`
**Auth**: token de paciente (`exigir_paciente`)

Devuelve las citas del paciente usando la cédula del token, sin pedirla en la URL.

También se mantiene `GET /api/v1/citas?cedula=...` (paciente o staff).

## RF5: Recepción asigna la solicitud

**Endpoint**: `PATCH /api/v1/citas/{cita_id}/asignar`
**Backend**: `app/api/v1/endpoints/citas.py`
**Auth**: staff (`exigir_staff`)

1. Recibe `{medico_id, fecha_cita, hora_inicio, notas?}`.
2. Valida que el médico exista, esté activo y pertenezca al centro de la cita.
3. Verifica que el horario no esté ocupado por otra cita del mismo centro.
4. Actualiza `medico_id`, `fecha_cita`, `hora_inicio`, `estado='confirmada'` y
   `observaciones_medico` (si hay notas).
5. Envía al paciente un WhatsApp de confirmación con médico, fecha, hora y código
   (`enviar_notificacion_asignacion`).

## RF6: Bandeja de solicitudes para recepción

**Endpoint**: `GET /api/v1/citas/solicitudes?centro_id=`
**Backend**: `app/api/v1/endpoints/citas.py`
**Auth**: staff (`exigir_staff`)

Lista las citas en `estado='pendiente'` (máximo 100, más recientes primero) con el
nombre del paciente y del médico, para que recepción elija cuál asignar.

## RF7: Perfil y datos de salud del paciente

**Endpoints** (existentes): `GET /api/v1/pacientes/{cedula}` y
`PATCH /api/v1/pacientes/{cedula}`
**Backend**: `app/api/v1/endpoints/pacientes.py`
**Auth**: el propio paciente o staff (`exigir_paciente_o_staff`)

Devuelve y actualiza tipo de sangre, alergias, antecedentes y datos de contacto.

## Variables de entorno nuevas

- `CORS_ORIGINS`: orígenes permitidos separados por coma. En producción, el dominio de
  Vercel. Por defecto `*` (solo desarrollo).
- `VITE_API_URL` (frontend): URL pública del backend en Railway. Si falta, `api.js`
  usa rutas relativas `/api/v1` (proxy de Vite en desarrollo).

## Pendientes de seguridad (no bloquean el MVP)

- Las tablas de Supabase están sin RLS y el backend usa la `anon_key`. Antes de
  publicar con datos reales: usar `service_role` en el backend y activar RLS en las
  tablas, o mantener el acceso solo a través del backend con red restringida.
- `PIN_EMITIR_DEMO` debe quedar en `false` en producción.
- `JWT_SECRET` debe ser un secreto largo y distinto al de desarrollo.
