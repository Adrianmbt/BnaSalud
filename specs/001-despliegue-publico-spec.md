# specs/001-despliegue-publico-spec.md

Estado: **activo** · Paso 0 ✅ completado (2026-11-04)

---

## Contexto rápido

| Sistema | Qué es | Stack | Estado |
|---|---|---|---|
| `interno/` | Sistema clínico instalado en CITAB | FastAPI + PostgreSQL local `bnasalud`; React 18 + Vite :3000 | **No tocar** |
| `app/` + `frontend/` | Portal público del paciente | FastAPI + Supabase; React 19 + Vite :5173 | **Este spec** |

**Regla absoluta**: nada de este spec toca `interno/` ni su BD `bnasalud`. Los dos sistemas son independientes.

---

## Paso 0: Migración a Supabase ✅ COMPLETADO

La base de datos Supabase `unvtznfvbdqzsmtlvqkf` ya tiene las 25 migraciones aplicadas:
`restore_schema.sql` → `0001` a `0023` → `seed.sql`.

Tablas relevantes para el portal: `historias_clinicas`, `usuarios`, `personal`, `clinicas`,
`citas`, `especialidades`, `consultas`, `recetas`, `notificaciones`, `cola_pacientes`.

---

## Paso 1: Login unificado en el portal público

### 1.1 Qué usuarios deben poder ingresar desde `frontend/`

El portal público tendrá **una sola pantalla de login** que enruta a interfaces distintas
según el rol devuelto por el backend:

| Tipo de usuario | Credenciales | Rol en BD (`usuarios.rol`) | Interface destino |
|---|---|---|---|
| Paciente | Cédula + PIN | — (tabla `historias_clinicas`) | `Paciente.jsx` (existente en `frontend/`) |
| Director | Usuario + contraseña | `director` | `ExecutiveAdminDashboard.jsx` (mover de `interno/frontend`) |
| Admin de sistemas | Usuario + contraseña | `admin_sistemas` | `SystemAdminInterface.jsx` (mover de `interno/frontend`) |

> **Nota**: el login de paciente sigue usando cédula+PIN (endpoint `/api/v1/auth/paciente`).
> Los usuarios staff (director, admin_sistemas) usan usuario+contraseña (endpoint `/api/v1/auth/login`).
> Ambos flujos ya existen en `app/api/v1/endpoints/auth.py`.

### 1.2 Página de login unificada — nueva: `frontend/src/pages/Login.jsx`

Lógica de enrutamiento post-login:

```
POST /api/v1/auth/login  → { token, usuario: { rol } }
  rol === 'director'       → <ExecutiveAdminDashboard />
  rol === 'admin_sistemas' → <SystemAdminInterface />
  (otros roles staff)      → pantalla "Acceso no autorizado en portal público"

POST /api/v1/auth/paciente → { token, paciente }
  éxito                    → <Paciente />  (ya existente)
```

La pantalla de login tendrá **dos pestañas**:
- **Paciente**: campos cédula + PIN (flujo existente)
- **Personal autorizado**: campos usuario + contraseña (nuevos)

---

## Paso 2: Migrar interfaces de `interno/frontend` al portal público

### Interfaces a portar (copiar y adaptar, **no eliminar del interno**)

| Archivo origen (`interno/frontend/src/`) | Destino (`frontend/src/`) | Adaptaciones requeridas |
|---|---|---|
| `pages/ExecutiveAdminDashboard.jsx` | `pages/ExecutiveAdminDashboard.jsx` | Cambiar imports de `axiosClient` interno → `API` del portal; eliminar dependencias de Capacitor |
| `pages/SystemAdminInterface.jsx` | `pages/SystemAdminInterface.jsx` | Ídem; los ROLES disponibles son los de `usuarios.rol` en Supabase |
| `components/dashboard/DirectorSidebar.jsx` | `components/dashboard/DirectorSidebar.jsx` | Ajustar rutas de API |
| `components/dashboard/MedicalKpiTab.jsx` | `components/dashboard/MedicalKpiTab.jsx` | Ajustar rutas de API |
| `components/dashboard/PatientKpiTab.jsx` | `components/dashboard/PatientKpiTab.jsx` | Ajustar rutas de API |
| `components/dashboard/InventoryKpiTab.jsx` | `components/dashboard/InventoryKpiTab.jsx` | Ajustar rutas de API |

> [!IMPORTANT]
> Las interfaces internas usan `axiosClient` de `interno/frontend/src/api/axiosClient.js`
> que apunta a `localhost:8000` (backend interno). Las versiones portadas deben
> usar el cliente API del portal (`frontend/src/api.js` o equivalente) que apunta
> a la variable de entorno `VITE_API_URL`.

> [!WARNING]
> `interno/frontend` usa **React 18 + Tailwind 3**. `frontend/` usa **React 19 + Tailwind 4**.
> No copies estilos directamente; valida que las clases Tailwind sean compatibles o ajústalas.
> No copies `package.json`, `vite.config.js` ni `tailwind.config.js` entre los dos proyectos.

---

## Paso 3: Nuevos endpoints en `app/`

Los endpoints que ya existen en `app/api/v1/endpoints/auth.py` cubren pacientes y staff.
Se necesitan los siguientes endpoints adicionales para las interfaces portadas:

### 3.1 Endpoints de estadísticas para el Director (`ExecutiveAdminDashboard`)

```
GET  /api/v1/stats/kpi-medico        → atenciones/día, consultas por especialidad
GET  /api/v1/stats/kpi-pacientes     → total registrados, nuevos esta semana
GET  /api/v1/stats/kpi-inventario    → stock crítico, medicamentos por vencer
GET  /api/v1/stats/actividad-clinica → actividad reciente por clínica
```

Todos protegidos por JWT con `rol IN ('director')`.

### 3.2 Endpoints de soporte para Admin Sistemas (`/institucional`)

```
GET    /api/v1/usuarios                    → cuentas institucionales (crear / editar)
GET    /api/v1/soporte/estado              → salud de la web y latido de instalaciones
GET    /api/v1/soporte/logs                → bitácora web + acciones y logs internos
GET    /api/v1/soporte/nomina              → nómina sincronizada del sistema interno
GET    /api/v1/soporte/usuarios-internos   → directorio interno (sin contraseñas)
```

Los de `/soporte` exigen `rol = admin_sistemas`; las cuentas institucionales las
gestiona cada rol sobre las de su mismo rol. Los datos internos llegan por
`scripts/sincronizar_interno.py` a las tablas `interno_*` (migración 0026).

### 3.3 Archivo de implementación

Los endpoints viven en `app/api/v1/endpoints/soporte.py` y `usuarios.py`, con el
cliente Supabase singleton de `app/core/database.py`. No hay ruta `/admin`: el
panel se monta dentro de `/institucional` según el rol de la sesión.

---

## Paso 4: Routing en `frontend/`

Modificar `frontend/src/App.jsx` para manejar sesiones de staff además de pacientes:

```jsx
// Rutas públicas:
/           → <Home />
/paciente   → <Paciente />   (login propio con cédula+PIN)

// Rutas protegidas (requieren JWT de staff):
/portal     → Router de roles:
              director       → <ExecutiveAdminDashboard />
              admin_sistemas → <SystemAdminInterface />
```

El estado de sesión del staff se guarda en `localStorage` bajo la clave `bna_token_staff`
(separado del token del paciente `bna_token_paciente`).

---

## Paso 5: Variables de entorno

### Backend (`app/`) — Railway

```env
SUPABASE_URL=https://unvtznfvbdqzsmtlvqkf.supabase.co
SUPABASE_KEY=<service_role_key>          # no la anon_key
JWT_SECRET=<secreto-produccion>
JWT_ALGORITHM=HS256
JWT_EXPIRACION_MINUTOS=480
```

### Frontend (`frontend/`) — Vercel

```env
VITE_API_URL=https://<tu-app>.railway.app   # URL pública del backend en Railway
VITE_SUPABASE_URL=https://unvtznfvbdqzsmtlvqkf.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

---

## Paso 6: Despliegue

### Backend → Railway

1. Conectar repositorio en [railway.app](https://railway.app)
2. Root directory: `.` (raíz del repo), Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Configurar variables de entorno del Paso 5
4. Verificar: `GET /api/v1/health` responde `{"status":"ok"}`

### Frontend → Vercel

1. Conectar repositorio en [vercel.com](https://vercel.com)
2. Framework: Vite · Root directory: `frontend/` · Build command: `npm run build` · Output: `dist/`
3. Configurar variables de entorno del Paso 5
4. Verificar: la URL pública carga la página de inicio

---

## Casos límite

- Railway (plan gratuito) apaga el servicio tras inactividad → cold start de ~30 s. Documentar en la UI con un spinner de "Conectando con el servidor…".
- Vercel (plan gratuito) tiene límite de 100 GB de transferencia/mes; suficiente para este volumen.
- El portal público llama **siempre** al backend FastAPI (Railway); nunca llama a Supabase directamente desde el frontend para operaciones de escritura.
- Si `VITE_API_URL` no está definida en desarrollo, el `vite.config.js` proxea `/api` → `localhost:8001` (el 8000 lo ocupa el backend interno).
- La `service_role_key` bypasea RLS: **no** exponerla en el frontend ni en variables `VITE_*`.
- Los roles `recepcion`, `medico`, `farmacia`, `especialista` **no** tienen acceso al portal público; solo `director` y `admin_sistemas` del lado staff.

---

## Orden de ejecución recomendado

```
[✅] Paso 0 — Migraciones Supabase aplicadas
[ ]  Paso 3 — Crear endpoints admin y stats en app/
[ ]  Paso 1 — Crear Login.jsx unificado en frontend/
[ ]  Paso 2 — Portar ExecutiveAdminDashboard y SystemAdminInterface
[ ]  Paso 4 — Actualizar routing en App.jsx
[ ]  Paso 5 — Configurar variables en Railway + Vercel
[ ]  Paso 6 — Desplegar y verificar URLs públicas
```

---

## Reglas

- **No modificar `interno/`** bajo ninguna circunstancia para necesidades del portal público.
- Todas las credenciales sensibles en variables de entorno de los servicios de despliegue, nunca en el repo.
- Los scripts de respaldo son manuales y no forman parte del flujo de despliegue.
- Prosa, documentación y mensajes de commit en español.
- La `service_role_key` va solo en el backend (Railway); el frontend solo usa la `anon_key`.
