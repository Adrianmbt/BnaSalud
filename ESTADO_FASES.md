# Estado de las fases — portal público

Documento de trabajo. Cubre **solo el portal público** (`app/` + `frontend/`).
El sistema clínico interno (`interno/`) es otro sistema, con otra base de datos
y otro despliegue; ver `interno/AGENTS.md`.

Fecha: 15 de noviembre de 2026.

---

## 1. Fases

| Fase | Trabajo | Estado |
| --- | --- | --- |
| 1 | Recorte del portal: routers muertos, `admin.py`, `api.js`, `POST /citas` solo staff | Hecho |
| 2 | Cuentas institucionales y panel de soporte | Hecho en código; falta aplicar `0026` y ejecutar el agente |
| 3 | Citas: cupo único por centro y 409 | Hecho en código; falta aplicar `0027` |
| 4 | Frontend: rutas, guard por rol, `/admin` eliminado | Hecho |
| 5 | Despliegue (Railway + Vercel + dominio) | Configuración lista; faltan cuentas y dominio |
| 6 | Endurecimiento (JWT, CORS, límites, bitácora) | Hecho |
| — | Prueba de carga con k6 | Pendiente (k6 no está instalado) |

### Fase 1 — Recorte

- Se borraron los routers que el portal no usa: `cola`, `consultas`,
  `emergencias`, `estudios`, `farmacia`, `rrhh`, `whatsapp` y `admin`.
- `admin.py` exponía recetas, consultas y pacientes a cualquier token
  `superusuario` desde la web pública; no lo usaba ninguna interfaz.
- `POST /citas` exige token de staff: el paciente ya no puede fijar fecha y hora.
- El portal del paciente conserva solo sus datos y sus citas: sin farmacia,
  insumos, personal, consultas ni estudios.

### Fase 2 — Cuentas y soporte

- `app/api/v1/endpoints/usuarios.py`: alta, listado y baja lógica de cuentas
  institucionales, solo para `admin_sistemas`. Nadie se desactiva a sí mismo ni
  puede dejar un rol sin cuentas activas (409). Todo cambio va a la bitácora.
- `app/api/v1/endpoints/soporte.py`: `/estado`, `/logs`, `/nomina`,
  `/usuarios-internos`. Solo `admin_sistemas`.
- `supabase/migrations/0026_soporte_panel.sql`: cuatro tablas `interno_*`
  (`personal`, `usuarios`, `bitacora`, `logs`) y `estado_instalaciones` (espejo
  de solo lectura del sistema interno).
- `scripts/sincronizar_interno.py`: agente que corre en CITAB y sube nómina,
  cuentas (sin `password_hash`), bitácora, logs y latido. Nunca escribe en el
  Postgres interno ni envía datos clínicos.
- Panel montado dentro de `/institucional`: `director` ve KPIs de la red;
  `admin_sistemas` ve Estado, Bitácora, Personal y Cuentas. No existe `/admin`.

### Fase 3 — Citas

- `supabase/migrations/0027_citas_cupo_unico.sql`: índice único parcial sobre
  `(centro_id, fecha_cita, hora_inicio)`; las canceladas y las solicitudes sin
  fecha no ocupan cupo. Es la garantía real contra dos peticiones simultáneas.
- La violación del índice se traduce en **409**, no en 500, en alta, asignación
  y postergación.
- `_generar_slots` ahora cuenta las citas `pendiente` con fecha y hora: antes
  una cita pospuesta dejaba su cupo visible como libre.
- El cupo es **por centro**, no por médico: es el criterio que ya usaban las
  cuatro funciones de citas. Cambiarlo exige tocar el índice y esas funciones.

### Fase 4 — Frontend

- Rutas: `/`, `/paciente`, `/institucional`. Cualquier otra muestra «Página no
  encontrada».
- `frontend/src/pages/Soporte.jsx` exporta `PanelSoporte`, que recibe la sesión
  de `Institucional.jsx`; no tiene login propio.
- `npm run lint` y `npm run build` en verde.

### Fase 5 — Despliegue

- Listos: `Dockerfile`, `railway.json`, `render.yaml`, `frontend/vercel.json`,
  `.env.example`, `frontend/.env.example`.
- `ENVIRONMENT=production` (lo fija el Dockerfile) hace que el backend **no
  arranque** si falta `SUPABASE_URL`/`SUPABASE_KEY`, si `JWT_SECRET` es el de
  ejemplo o mide menos de 32 caracteres, o si `CORS_ORIGINS` sigue en `*`.
- `JWT_EXPIRACION_MINUTOS` quedó en 25 minutos y está acotado en el código
  (`Field(25, ge=5, le=60)`): un `.env` con 480 ya no arranca, y 60 es el techo.

### Fase 6 — Endurecimiento

- JWT de 25 minutos (tope de 60 en el código), rate limit de 5 intentos por IP y
  minuto en auth, recuperación de contraseña genérica (no enumera cédulas),
  bitácora en las acciones sensibles, `--forwarded-allow-ips=*` para que el rate
  limit vea la IP real detrás del proxy de Railway.

---

## 2. Pendientes antes de desplegar

En este orden.

### 2.1 Base de datos (Supabase → SQL Editor)

- [ ] `0024_roles_globales.sql`: ya está aplicada a medias. Reejecutarla es
      seguro (no toca contraseñas) y crea la cuenta `oswaldo` y las fichas de
      personal 998/999.
- [ ] `0026_soporte_panel.sql`: crea las tablas `interno_*` y
      `estado_instalaciones`.
- [ ] `0027_citas_cupo_unico.sql`: cupo único. Antes de aplicarla, comprobar que
      no haya dobles reservas con la consulta que va en la cabecera del archivo
      (hoy hay 0).
- [ ] `0025_citas_fecha_opcional.sql` ya está aplicada (verificado: hay
      solicitudes sin fecha).

### 2.2 Agente en CITAB

- [ ] `pip install psycopg2-binary supabase python-dotenv` en el servidor
      interno.
- [ ] Definir `DATABASE_URL` del Postgres interno (no está en
      `interno/backend/.env`; el interno usa el valor por defecto de
      `interno/backend/app/core/config.py`).
- [ ] `python scripts/sincronizar_interno.py --dry-run` y luego sin `--dry-run`.
- [ ] Programarlo cada 5 minutos en el Programador de tareas de Windows.
- [ ] Cada instalación adicional: su propio `INSTALACION_ID`, `CLINICA_ID` y
      `INSTALACION_NOMBRE`.

### 2.3 Cuentas y accesos

Estado comparado el 15/11 entre Supabase (portal) y el Postgres interno:

| Cuenta | Portal (Supabase) | Postgres interno | Entra a `/institucional` |
| --- | --- | --- | --- |
| `abello` | superusuario | superusuario | **No** (403) |
| `adrianbello` | admin_sistemas | admin_sistemas | Sí (panel de soporte) |
| `oswaldo` | **no existe** | admin_sistemas | — hasta aplicar `0024` |
| `director` | director | director | Sí (KPIs de la red) |

- `/institucional` solo admite `ROLES_GLOBALES = ("admin_sistemas",
  "director")` (`app/api/v1/deps.py`). `superusuario` se conserva para el
  sistema interno, pero no tiene panel en el portal: con la contraseña correcta
  devuelve 403, no un error de credenciales.
- Las contraseñas no son las mismas en los dos sistemas: el hash de `abello` sí
  coincide; el de `adrianbello` y el de `director` **no**. La clave que funciona
  en el sistema interno no sirve en el portal.
- [ ] Decidir la cuenta del responsable de sistemas en el panel. `adrianbello`
      ya entra. Si prefiere `abello`, cambiar su rol a `admin_sistemas` desde la
      pestaña Cuentas y volver a entrar.
- [ ] Aplicar `0024` para que exista `oswaldo` en Supabase (o crearlo desde la
      pestaña Cuentas).
- [x] Clave de `director` restablecida el 16/11 por la API (queda en bitácora).
      Es temporal: cambiarla desde la pestaña Cuentas al entrar.

### 2.4 Backend en Railway

- [ ] Servicio nuevo desde el repo, builder Dockerfile.
- [ ] Variables: `SUPABASE_URL`, `SUPABASE_KEY` (service_role, solo en el
      backend), `JWT_SECRET` de 32+ caracteres y `CORS_ORIGINS` con el dominio
      de Vercel (sin `/` final).
- [ ] `ENABLE_SCHEDULER`: `true` en Railway (el proceso no duerme).
- [ ] Comprobar que `GET /api/v1/health` responde desde internet.

> El backend que está en línea hoy es `https://appbna.onrender.com`: responde
> `production` y la base `ok`, pero devuelve 404 en `/api/v1/soporte/estado`, así
> que corre una versión anterior al panel de soporte. No salió de este repo por
> git (el código de `/panel/resumen` no existe en ningún commit): es un despliegue
> manual. Al publicar, confirmar que el servicio nuevo sí apunta al repositorio.

### 2.5 Frontend en Vercel

- [ ] Proyecto con *Root Directory* `frontend`, framework Vite.
- [ ] Variable `VITE_API_URL` = URL pública de Railway, sin `/` final.
- [ ] Volver a Railway y poner esa URL en `CORS_ORIGINS`; sin ella el
      contenedor no arranca.
- [ ] Opcional: dominio propio y
      `CORS_ORIGIN_REGEX=^https://[a-z0-9-]+\.vercel\.app$` para los previews.

> `saludbarcelona.vercel.app` también está desfasado: su bundle incluye
> `/auth/institucional` y el panel del director, pero no el panel de soporte, y
> `/institucional` sigue mostrando «Panel en rediseño» para los roles que no son
> `director`. Esa pantalla ya no existe en el código: es un despliegue manual
> anterior. Mientras no se publique, el login definitivo solo se ve en local.

### 2.6 Humo en producción

- [ ] `/`, `/paciente` y `/institucional` con recarga directa (F5).
- [ ] Login de `director` (KPIs) y de `admin_sistemas` (soporte).
- [ ] Panel Estado: web en línea y latido de CITAB de menos de 15 minutos.
- [ ] Solicitud de cita desde el portal y asignación desde recepción.
- [ ] Un alta de cuenta y su baja lógica, con el registro en la bitácora.

### 2.7 k6 (última fase)

- [ ] Instalar k6 y ejecutar `k6/loadtest.js` contra el backend desplegado:
      `k6 run -e BASE=https://<backend> k6/loadtest.js`. Solo pega a endpoints
      públicos (`/health`, `/centros`, `/especialidades`); umbrales: p95 < 2 s y
      90 % de comprobaciones correctas.

---

## 3. Verificación en local

```powershell
# Backend (desde la raíz)
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001

# Frontend
cd frontend; npm run dev            # http://localhost:5173

# Pruebas y compilación
venv\Scripts\python.exe -m unittest discover -s tests
cd frontend; npm run lint; npm run build
```

El portal escucha en `:8001` y el interno en `:8000`; el proxy de Vite apunta a
`:8001`. Si lo cambias a `:8000`, el portal hablará con el backend interno (otra
base y otro esquema).

Si el backend no responde, revisa el `.env`: con `JWT_EXPIRACION_MINUTOS` mayor
que 60, o con `ENVIRONMENT=production` y variables incompletas, el proceso muere
al importar `app/core/config.py`. Con `--reload`, uvicorn deja el puerto tomado y
no se recupera solo: hay que reiniciarlo. En Windows dos `uvicorn` pueden quedar
escuchando a la vez en el mismo puerto; para saber quién lo tiene:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen |
  ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" } |
  Select-Object ProcessId, CommandLine
```

---

## 4. Riesgos conocidos

- Las tablas `interno_*` no tienen RLS, igual que el resto del esquema. El panel
  las lee solo desde el backend; si algún día se expone `SUPABASE_KEY` al
  navegador, la nómina sería legible con ella.
- Los datos del sistema interno llegan con retraso (lo que tarde el agente en
  ejecutarse), no en vivo.
- El cupo de citas es por centro: un solo turno cada 30 minutos por centro, sin
  importar cuántos médicos atiendan a esa hora.
- Un plan de hosting que duerme el servicio corta los recordatorios por correo.

---

## 5. Archivos del portal tocados (sin commitear)

Nada de esto está commiteado todavía. `interno/` tiene sus propios cambios y no
forma parte de este trabajo.

**Backend (`app/`)**

- Nuevos: `api/v1/endpoints/usuarios.py`, `soporte.py`, `panel.py`.
- Borrados: `api/v1/endpoints/admin.py`, `cola.py`, `consultas.py`,
  `emergencias.py`, `estudios.py`, `farmacia.py`, `rrhh.py`,
  `services/whatsapp.py`.
- Modificados: `main.py`, `core/config.py`, `core/security.py`,
  `core/bitacora.py`, `core/mail.py`, `core/notificaciones.py`,
  `api/v1/deps.py`, `api/v1/endpoints/auth.py`, `citas.py`, `centros.py`,
  `schemas/schemas.py`, `db/seed.py`.

**Frontend (`frontend/`)**

- Nuevos: `src/pages/Institucional.jsx`, `src/pages/Soporte.jsx`,
  `src/components/Acceso.jsx`, `Estado.jsx`, `Skeletons.jsx`,
  `HeroCarrusel.jsx`, `.env.example`, `vercel.json`.
- Borrados: `src/components/Centros.jsx`, `CitaModal.jsx`.
- Modificados: `App.jsx`, `api.js`, `vite.config.js`, `index.css`,
  `package.json`, y los componentes y páginas del portal público.

**Base de datos, despliegue y pruebas**

- Migraciones nuevas: `0024_roles_globales.sql`, `0026_soporte_panel.sql`,
  `0027_citas_cupo_unico.sql`.
- Despliegue: `Dockerfile`, `.dockerignore`, `railway.json`, `render.yaml`,
  `.env.example`, `requirements.txt`.
- Agente y pruebas: `scripts/sincronizar_interno.py`, `scripts/pruebas_local.py`,
  `k6/loadtest.js`, `tests/test_usuarios_globales.py`, `test_cupos_citas.py`,
  `test_rate_limit_auth.py`.
- Documentación: `ESTADO_FASES.md`, `AGENTS.md`.

Sugerencia de commits, cuando lo apruebes: uno para backend, otro para frontend y
otro para migraciones y documentación.

---

## 6. Pruebas en local

`scripts/pruebas_local.py` hace un humo completo contra un backend en marcha sin
pedir contraseñas: emite los tokens con `crear_token` y llama a la API real.

```powershell
venv\Scripts\python.exe scripts\pruebas_local.py                      # local :8001
venv\Scripts\python.exe scripts\pruebas_local.py https://<backend>    # desplegado
```

Cubre 24 comprobaciones:

- Público: `/health`, `/centros`, `/especialidades` y `/panel/resumen` sin token.
- Panel: entra `director` y `admin_sistemas`; no entran `medico` ni `paciente`.
- Soporte: solo `admin_sistemas`; `director` recibe 403.
- Cuentas: solo `admin_sistemas`.
- Paciente: `mis-citas` devuelve solo las suyas y no puede leer otra cédula.
- Citas: alta, cupo repetido (409), postergación, cancelación y re-reserva del
  cupo liberado. Borra las citas de prueba al terminar.

Resultado del 16/11 en local: **24 de 24**. Dos hallazgos corregidos:

- `GET /usuarios` dejaba listar las cuentas institucionales al `director`; ahora
  es solo `admin_sistemas`, igual que el alta y la baja.
- En móvil el login de `/institucional` aparecía debajo del bloque de marca. El
  formulario va primero (`order-1`) y el bloque de presentación debajo.

Lo que todavía no se puede probar: el panel con datos reales del interno (faltan
`0026` y el agente en CITAB), la doble reserva simultánea (falta `0027`) y los
inicios de sesión reales (el script no conoce las contraseñas).
