# Plan: portal público (frontend en Vercel) y simplificación del backend `app/`

> Reescrito el 4 de noviembre de 2026 tras revisar `app/`.
> Alcance: `frontend/` + `app/`. **No** se toca `interno/` (otro sistema, otra BD).

## 1. Resumen ejecutivo

1. El backend `app/` hace demasiado para lo que se necesita hoy: 13 routers, 6.529
   líneas de Python, 600 líneas de schemas y dependencias de RAG, farmacia y WhatsApp.
2. El MVP real es: **gestión de citas**, **registro de pacientes al pedir cita** y
   **usuarios globales** (informática/sistemas y director/admin).
3. Se recorta el backend a 6 routers (`auth`, `citas`, `centros`, `especialidades`,
   `pacientes`, `usuarios`), se elimina el planificador, el frontend embebido y los
   módulos fuera de alcance.
4. Los roles actuales (`superusuario`, `medico`, `jefe_farmacia`, `farmaceutico`,
   `enfermero`, `paciente`) no contemplan informática ni director, y la tabla
   `usuarios` **impide crear cuentas sin vínculo** a `personal` o `historias_clinicas`.
   Hace falta una migración de roles antes de cualquier pantalla de administración.
5. El frontend público se despliega en Vercel como SPA Vite; el backend simplificado
   vive aparte con URL HTTPS y se conecta por *rewrite* (`/api/*`) o por
   `VITE_API_BASE`.

## 2. Alcance funcional del MVP

### 2.1 Se queda

| Módulo | Qué incluye |
| --- | --- |
| Citas | Centros y especialidades, médicos por especialidad, disponibilidad, crear cita (con registro de paciente), consultar por código o cédula, posponer y cancelar |
| Pacientes | Registro implícito al pedir la primera cita, PIN de acceso, perfil propio (lectura/edición acotada), recuperación y cambio de PIN |
| Usuarios globales | Login por usuario y contraseña, alta/edición/desactivación de cuentas, roles `informatica` y `director` |
| Administración mínima | Auditoría básica de accesos y de cambios de usuarios (la tabla `bitacora_acciones` ya existe) |

### 2.2 Se posterga (no se borra el dato, se saca del código activo)

Farmacia, consultas clínicas, emergencias, estudios/OCR, RAG/asistente, cola de
pacientes, RRHH/turnos, notificaciones por correo y recordatorios automáticos,
WhatsApp/Evolution API, recetas y órdenes en el portal del paciente.

Si más adelante vuelven, se reintroducen como routers separados; hoy solo agregan
superficie de ataque y dependencias que encarecen el despliegue.

### 2.3 Decisión de producto pendiente

El portal del paciente (`frontend/src/pages/Paciente.jsx`) hoy muestra historial,
recetas, órdenes, notificaciones y médico tratante. Al recortar el backend esas
secciones deben **ocultarse o vaciarse**; no se pueden dejar llamando a endpoints que
ya no existen. Se propone dejarlas fuera de la navegación en esta fase.

## 3. Hallazgos verificados en `app/`

| # | Hallazgo | Evidencia | Consecuencia |
| --- | --- | --- | --- |
| 1 | 13 routers montados en [main.py](app/main.py) | citas, rrhh, farmacia, centros, especialidades, pacientes, consultas, emergencias, estudios, rag, auth, cola, admin | 8 sobran para el MVP |
| 2 | Tamaño desbalanceado | `citas.py` 916 líneas; `consultas.py` 510; `cola.py` 506; `farmacia.py` 480 | Difícil de mantener y de probar |
| 3 | `schemas/schemas.py` monolítico | 600 líneas para todos los módulos | Al recortar routers quedan decenas de modelos muertos |
| 4 | Acoplamiento oculto | `auth.py` importa `_buscar_paciente` y `_a_historia` desde `pacientes.py`; `citas.py` importa correo y WhatsApp | No se puede borrar un módulo sin tocar otro |
| 5 | Base de datos vía cliente Supabase | [database.py](app/core/database.py) | `DATABASE_URL` de [config.py](app/core/config.py) no se usa y trae una contraseña por defecto en el código |
| 6 | Planificador en el arranque | [scheduler.py](app/core/scheduler.py) + APScheduler cada hora | Exige proceso siempre encendido; estorba en hosting barato/serverless |
| 7 | Backend sirve el frontend | `main.py` monta `frontend/dist` en `/` y `/static`, y `/maquetas` | Al separar en Vercel sobran esos montajes y la ruta relativa a `frontend/maquetas` rompe si no existe |
| 8 | CORS abierto | `allow_origins=["*"]` + `allow_credentials=True` | Inseguro en producción y bloquea el uso de credenciales reales |
| 9 | Roles insuficientes | [0010_usuarios.sql](supabase/migrations/0010_usuarios.sql): `CHECK rol IN ('superusuario','medico','jefe_farmacia','farmaceutico','enfermero','paciente')` | No existen `informatica` ni `director` |
| 10 | Vínculo obligatorio | `CHECK (personal_id IS NOT NULL OR paciente_id IS NOT NULL)` | Un usuario global sin ficha de personal no se puede insertar |
| 11 | Sin CRUD de usuarios | [admin.py](app/api/v1/endpoints/admin.py) solo tiene bitácora, trazabilidad y resumen | Hoy las cuentas se crean por SQL o seed |
| 12 | Registro de paciente implícito | `_upsert_paciente` en [citas.py](app/api/v1/endpoints/citas.py) genera PIN y lo devuelve en la respuesta | Es el único "registro" existente; no hay endpoint dedicado |
| 13 | Dependencias pesadas | [requirements.txt](requirements.txt): langchain, tiktoken, vecs, psycopg2, APScheduler | Instalación lenta y superficie innecesaria |
| 14 | Sin tests del portal público | No hay `tests/` ni `pytest.ini` fuera de `interno/` | La verificación es manual salvo que se agregue una suite mínima |
| 15 | Frontend sin área administrativa | `frontend/src/App.jsx` solo tiene `/` y `/paciente` | Los usuarios globales no tienen dónde gestionarse |

## 4. Modelo de usuarios y roles propuesto

### 4.1 Roles

| Rol | Para quién | Alcance |
| --- | --- | --- |
| `paciente` | Ciudadano que pide cita | Su perfil, sus citas, agendar/posponer/cancelar, su PIN |
| `informatica` | Encargado(s) de informática y sistemas | Cuentas de usuario globales (excepto otras cuentas `director`), catálogos y bitácora técnica |
| `director` | Admin / director del instituto | Todo lo de informática + cuentas `director` + resumen global |

Reglas:

- El paciente **no** usa la tabla `usuarios`: se autentica con cédula + PIN contra
  `historias_clinicas.pin_hash`. Las filas con `rol='paciente'` en `usuarios` son legado
  del seed y quedan inertes (el login de staff ya las rechaza).
- `informatica` no puede crear ni desactivar cuentas `director`; `director` sí puede
  gestionar cualquier cuenta global.
- Nadie puede desactivarse a sí mismo ni quedarse el sistema sin un `director` activo.
- `superusuario` se conserva **solo** como valor legado aceptado por el CHECK durante la
  transición; la aplicación emite únicamente `informatica` y `director`.

### 4.2 Flujo de registro del paciente

Se mantiene el flujo actual, que ya funciona y está probado por el frontend:

1. El paciente elige centro, especialidad, médico, fecha y hora en `CitaModal`.
2. `POST /api/v1/citas` con `paciente` embebido (`CitaConPacienteCreate`).
3. `_upsert_paciente` crea la historia si no existe y genera un PIN único de 4 dígitos.
4. La respuesta incluye `pin_inicial`; el frontend lo muestra en la confirmación.
5. Entrega del PIN: correo (SMTP) o WhatsApp. **En producción no puede depender de
   `PIN_EMITIR_DEMO=true`**, que devuelve códigos en la respuesta.

### 4.3 Usuarios globales: lo que falta

- API `GET/POST/PATCH /api/v1/usuarios` protegida por rol.
- Pantalla `/admin` en el frontend: login global, tabla de cuentas, alta/edición,
  activar/desactivar y cambio de contraseña.
- Migración de roles (sección 7).

## 5. Arquitectura objetivo del backend

```
app/
  main.py                     # solo app, CORS por entorno, routers del MVP, /health
  api/v1/
    deps.py                   # roles: paciente | informatica | director
    errors.py
    endpoints/
      auth.py                 # login global, login paciente, recuperar/reset PIN
      citas.py                # alta/consulta/cambio de estado, médicos, disponibilidad
      centros.py
      especialidades.py
      pacientes.py            # perfil propio + helpers de búsqueda
      usuarios.py             # NUEVO: CRUD de cuentas globales (informatica/director)
      admin.py                # bitácora (recortado)
  core/
    config.py                 # sin secretos por defecto; CORS_ORIGINS; SMTP
    database.py               # cliente Supabase
    security.py               # JWT + bcrypt (sin cambios funcionales)
    mail.py                   # solo PIN y bienvenida
    bitacora.py
  schemas/                    # dividido por dominio, sin modelos de módulos retirados
  db/seed.py                  # semilla coherente con el MVP
```

Se eliminan: `rrhh.py`, `farmacia.py`, `consultas.py`, `emergencias.py`, `estudios.py`,
`rag.py`, `cola.py`, `core/scheduler.py`, `core/notificaciones.py`,
`services/whatsapp.py` y los montajes `StaticFiles`.

## 6. Cambios concretos por archivo

| Archivo | Cambio |
| --- | --- |
| `app/main.py` | Quitar 8 routers, `lifespan`/planificador, montajes de `frontend/dist` y `/maquetas`; CORS desde `settings.CORS_ORIGINS`; `/health` sin depender de una tabla de farmacia |
| `app/core/config.py` | Eliminar `DATABASE_URL` con contraseña por defecto y `GOOGLE_API_KEY`/`EVOLUTION_*`; agregar `CORS_ORIGINS`, `FRONTEND_URL`; validar `JWT_SECRET` en producción |
| `app/api/v1/deps.py` | Sustituir `ROLES_STAFF` por `informatica`/`director`; `exigir_usuario_global`, `exigir_roles` |
| `app/api/v1/endpoints/auth.py` | Permitir roles globales; rechazar `medico`/`farmacia`/etc.; agregar `POST /auth/cambiar-password` |
| `app/api/v1/endpoints/usuarios.py` | Nuevo CRUD con reglas de la sección 4.1 y auditoría |
| `app/api/v1/endpoints/citas.py` | Mantener; quitar envío de WhatsApp (dejar PIN en respuesta + correo) |
| `app/api/v1/endpoints/pacientes.py` | Mantener GET/PATCH de perfil; retirar notificaciones/historial/médico cuando se oculten en el portal |
| `app/schemas/schemas.py` | Dividir en `auth.py`, `citas.py`, `pacientes.py`, `usuarios.py`; borrar modelos huérfanos |
| `app/db/seed.py` | Semilla mínima: centros, especialidades, médicos, un `director` y un `informatica` |
| `requirements.txt` | Quitar langchain, langchain-*, tiktoken, vecs, psycopg2, APScheduler |
| `frontend/src/App.jsx` | Nueva ruta `/admin` |
| `frontend/src/pages/Admin.jsx` | Login global + gestión de usuarios (nuevo) |
| `frontend/src/api.js` | `VITE_API_BASE` opcional, métodos de usuarios, quitar métodos de módulos retirados |
| `frontend/src/pages/Paciente.jsx` | Ocultar recetas, órdenes, notificaciones, historial y médico tratante |

## 7. Migraciones SQL nuevas

`supabase/migrations/0024_roles_globales.sql` (aplicar a mano, como el resto):

1. Ampliar el CHECK de `usuarios.rol` para aceptar `informatica` y `director`
   (y conservar los valores actuales durante la transición).
2. Relajar `usuarios_vinculo_check`: las cuentas `informatica`/`director` no necesitan
   `personal_id` ni `paciente_id`.
3. Agregar `nombre_completo TEXT` y `email TEXT` a `usuarios` (para la pantalla de
   administración).
4. Convertir los `superusuario` existentes en `director` (UPDATE explícito, no
   automático en el arranque).
5. Índice por `rol` y `activo`.

No se borran tablas de módulos retirados: los datos quedan, solo deja de haber código
que los use. Así se puede volver atrás sin restaurar un backup.

## 8. Frontend y despliegue en Vercel

### 8.1 Ajustes de la app

- `App.jsx`: rutas `/`, `/paciente`, `/admin`; las dos últimas con *guard* por rol.
- `Paciente.jsx`: recortar secciones fuera del MVP (decisión 2.3).
- `api.js`: base configurable

  ```js
  const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');
  ```

- `vite.config.js`: proxy de desarrollo con `VITE_PROXY_TARGET` (por defecto
  `http://localhost:8000`).
- `Specialties.jsx`: dejar de hacer `fetch('/api/v1/centros')` suelto y usar `API.getCentros`.
- `package.json`: `"engines": { "node": ">=22.12" }` (verificado: Vite 8.2.1 exige
  `^20.19.0 || >=22.12.0`).

### 8.2 Configuración de Vercel

- Root Directory: `frontend`. Framework Vite. Build `npm run build`. Output `dist`.
- `frontend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://API_DEL_PORTAL/api/:path*" },
    { "source": "/:path*", "destination": "/index.html" }
  ]
}
```

  El rewrite del SPA va al final. Si se usa `VITE_API_BASE`, se elimina la primera regla.
- Variables en Vercel: `VITE_API_BASE` (opcional, Production y Preview). Ningún secreto
  del backend vive aquí: la app no usa claves de Supabase.
- Dominio: apex o subdominio (`citas.…`), con certificado automático.

### 8.3 Backend público

- Host con HTTPS (VPS, Render, Railway, Fly.io). Al quitar el planificador ya no
  necesita proceso permanentemente despierto, pero un free tier dormido da primera
  respuesta lenta.
- Variables: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` (largo y único), `SMTP_*`,
  `CORS_ORIGINS` con el dominio de Vercel, `PIN_EMITIR_DEMO=false`.
- CORS: origen exacto y `allow_credentials=False` (la app usa `Authorization`).
- `GET /api/v1/health` debe responder desde Internet.

## 9. Fases y criterios de aceptación

| Fase | Trabajo | Aceptación |
| --- | --- | --- |
| 0 | Rama de trabajo y respaldo de la BD (Supabase) | `pg_dump`/backup verificado |
| 1 | Recorte de routers, `main.py`, `config.py`, `requirements.txt` | `python -c "import app.main"` OK; OpenAPI solo con rutas del MVP |
| 2 | Migración `0024`, `deps.py`, `auth.py`, `usuarios.py`, seed | Crear `informatica` y `director` por API; `informatica` no puede tocar `director`; login de ambos |
| 3 | Citas: alta con paciente nuevo, PIN, disponibilidad, posponer, cancelar | Flujo completo contra Supabase de pruebas |
| 4 | Frontend: `/admin`, guard de rutas, recorte del portal, `api.js` | `npm run lint` y `npm run build` en verde; `/admin` gestiona cuentas |
| 5 | Vercel: proyecto, rewrite, dominio, variables | `/` y `/paciente` con recarga directa; `/api/v1/health` por el dominio |
| 6 | Endurecimiento: CORS, `JWT_SECRET`, `PIN_EMITIR_DEMO`, bitácora, límites | Revisión de checklist de seguridad |

## 10. Verificación

- Backend: arranque limpio, OpenAPI sin rutas retiradas, y una suite mínima nueva
  (`pytest`) para: login por rol, creación de usuario, reglas de `informatica`,
  `crear_cita` con paciente nuevo y conflicto de horario.
- Datos: probar contra una copia de Supabase, nunca contra producción; recordar que
  `internal` y portal **no comparten base**.
- Frontend: `npm ci`, `npm run lint`, `npm run build`, `/admin` y `/paciente` en local;
  luego *preview* de Vercel y dominio final.
- Seguridad: sin PIN en respuestas con `PIN_EMITIR_DEMO=false`; sin secretos en el
  bundle; 401/403 correctos en cada rol; `director` no se puede autodesactivar.

## 11. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Romper citas al recortar módulos acoplados | `auth.py` y `citas.py` importan helpers de `pacientes.py`: recortar en orden y probar tras cada router |
| Cuentas existentes con roles viejos | La migración conserva los valores antiguos y migra `superusuario` → `director` |
| Pacientes sin PIN entregable | Mantener SMTP activo; si no, mostrar el PIN una sola vez en la confirmación |
| Portal con secciones que llaman endpoints retirados | Ocultarlas en la misma fase que el recorte del backend |
| Backend en free tier dormido | Aceptar la primera respuesta lenta o usar plan con instancia mínima |
| CORS `*` en producción | Restringir antes de publicar el dominio |
| `vercel.json` con URL fija del backend | `VITE_API_BASE` como alternativa y documentar el cambio |

## 12. Decisiones abiertas

1. ¿Dónde vivirá el backend simplificado y con qué URL pública?
2. ¿Se confirma `informatica` + `director` como únicos roles globales, o se conserva
   `superusuario` con otro nombre?
3. ¿El registro del paciente sigue siendo implícito en la primera cita o quieres un
   endpoint/pantalla de registro separada?
4. ¿Historial, recetas, órdenes y notificaciones se ocultan por completo o se dejan como
   "próximamente"?
5. ¿Dominio final: apex municipal o subdominio?

## 13. Modificaciones pendientes (se completan contigo)

- [ ] _(pendiente de tus indicaciones)_
