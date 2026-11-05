# BnaSalud

Sistema de Salud Municipal del Municipio Simón Bolívar - Barcelona, Anzoátegui (Venezuela).

Este repositorio contiene el **portal público del paciente**:

- **Backend:** FastAPI + Supabase (`app/`)
- **Frontend:** React 19 + Vite + Tailwind CSS v4 (`frontend/`)
- **App móvil:** Expo / React Native (`mobile/`) — opcional

> Los módulos internos de personal (recepción, guardia, consulta, farmacia, dashboard) viven en el proyecto aparte `interno/`, que no forma parte de este repositorio.

---

## ¿Qué necesito instalar antes?

| Herramienta | Versión mínima | Notas |
| --- | --- | --- |
| **Python** | 3.12+ | Backend FastAPI. Validado con 3.14 |
| **Node.js** | 20.19+ | Vite 8 y Tailwind v4 lo exigen |
| **npm** | 9+ | Se instala junto con Node.js |
| **Git** | 2.40+ | Para clonar y versionar |
| **Docker** | — | **Opcional.** Solo para la Evolution API (WhatsApp) |
| **Cuenta Supabase** | — | Obligatoria: es la base de datos del sistema |

Descargas: [Python](https://www.python.org/downloads/) · [Node.js](https://nodejs.org/) · [Git](https://git-scm.com/) · [Docker](https://www.docker.com/).

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/Adrianmbt/BnaSalud.git
cd BnaSalud
```

## 2. Instalar dependencias

### Opción rápida (script incluido)

Desde la raíz del proyecto:

```bash
npm run setup
```

El script `scripts/setup.js` crea el `.env`, el entorno virtual `venv/`, instala `requirements.txt` y las dependencias de `frontend/` y `mobile/`. También puedes ejecutar solo una parte:

```bash
npm run setup:env        # crea .env desde .env.example
npm run setup:backend    # venv + pip install -r requirements.txt
npm run setup:frontend   # npm install en frontend/
npm run setup:mobile     # npm install en mobile/
npm run setup:whatsapp   # clona e instala la Evolution API (sin Docker)
```

### Opción manual

**Backend** (desde la raíz del proyecto):

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
```

**App móvil (opcional):**

```bash
cd mobile
npm install
```

## 3. Configurar variables de entorno

Copia la plantilla y complétala con tus credenciales:

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

El `.env` va **en la raíz del proyecto** (el backend resuelve `BASE_DIR/.env`). Mínimo imprescindible:

```env
SUPABASE_URL="https://TU-PROYECTO.supabase.co"
SUPABASE_KEY="TU-ANON-KEY"
```

Otras variables opcionales (`GOOGLE_API_KEY`, SMTP, JWT, Evolution API…) están documentadas dentro de `.env.example`.

> **Nota:** `.env` y `Cred_hash.txt` no se suben al repositorio (contienen secretos). Pídelos al equipo o créalos desde el panel de Supabase.

## 4. Base de datos (Supabase)

El esquema **no** se aplica automáticamente: no hay migraciones Alembic ni ORM. Los archivos viven en `supabase/migrations/` y se ejecutan **a mano, en orden numérico**, desde el **SQL Editor** del panel de Supabase:

```
0001_schema.sql  →  0002_..._sql  →  ...  →  0024_roles_globales.sql  →  0025_citas_fecha_opcional.sql
```

Una migración que falte aparece como un error 500 en el endpoint que toca esa tabla. Editar un archivo Python nunca cambia la base de datos.

Después de aplicar las migraciones, carga los datos de demo/prueba (idempotente, escribe en la base de datos real):

```bash
venv\Scripts\python.exe -m app.db.seed
```

Credenciales de la semilla:

- Personal: usuario `abello`, contraseña `BnaSalud2026!`
- Pacientes: cédula `18234567` y la contraseña que definas en el portal (los pacientes creados por la semilla usan `Paciente2026!`)

## 5. Correr en desarrollo

**Terminal 1 — Backend** (raíz del proyecto; el directorio de trabajo importa):

```bash
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

**Terminal 2 — Frontend** (carpeta `frontend`):

```bash
cd frontend
npm run dev
```

Abre **http://localhost:5173**. El frontend redirige `/api/*` y `/static/*` al backend automáticamente (proxy en `frontend/vite.config.js`).

- Documentación de la API: http://localhost:8001/docs
- Health check: http://localhost:8001/api/v1/health
- El puerto 8000 lo ocupa el backend interno (`interno/backend`); el portal usa 8001.

**App móvil (opcional):**

```bash
npm --prefix mobile start
```

**WhatsApp / Evolution API (opcional):**

```bash
docker compose up -d
```

Disponible en http://localhost:8080. Requiere `EVOLUTION_API_KEY` y `SUPABASE_DB_URI` definidos en el `.env`.

## 6. Build de producción

El backend sirve el frontend compilado en la raíz:

```bash
cd frontend
npm run build
```

Luego solo necesitas el backend corriendo; la app estará en **http://localhost:8000**. (Si `frontend/dist/` no existe, `/` devuelve 404.)

---

## 7. Despliegue del backend (Render)

El portal se despliega en dos piezas: el frontend en **Vercel** (estático) y este backend en
**Render** (contenedor Docker, en un repositorio aparte). Vercel está pensado para funciones sin
estado y este backend necesita un proceso vivo (APScheduler para los recordatorios, cliente de
Supabase persistente); el mismo `Dockerfile` sirve en Railway o Fly.io sin cambios.

### 7.1 Repositorio aparte del backend

El backend se despliega desde su propio repositorio. Hay que copiar la **raíz** de este proyecto,
no solo `app/`, porque el `Dockerfile` copia `app/` y `requirements.txt` y los imports son
`from app...`:

```
bnasalud-api/          ← repositorio nuevo (esto es la raíz del build)
├── app/               ← copia completa de app/ de este proyecto
├── requirements.txt
├── Dockerfile
├── .dockerignore
└── render.yaml
```

Desde la raíz de este proyecto (Git Bash):

```bash
mkdir bnasalud-api && cd bnasalud-api
cp -r ../app ../requirements.txt ../Dockerfile ../.dockerignore ../render.yaml .
rm -rf app/__pycache__
git init && git add . && git commit -m "Backend del portal público"
git remote add origin https://github.com/<usuario>/bnasalud-api.git
git push -u origin main
```

No copies `frontend/`, `mobile/`, `interno/`, `supabase/`, `venv/` ni `.env`: la imagen solo
necesita `app/` y `requirements.txt`, y los secretos van en el panel de Render.

### 7.2 Crear el servicio en Render

1. En Render: *New → Blueprint*, elige el repositorio nuevo y *Apply*. El `render.yaml` ya define
   el runtime Docker, el contexto, el health check y las variables.
2. Si prefieres crearlo a mano (*New → Web Service → Runtime: Docker*): Dockerfile
   `./Dockerfile`, contexto `.`, health check `Path` = `/api/v1/health`.
3. Render inyecta `$PORT`; el `CMD` de la imagen ya lo respeta, no hay que tocar nada.
4. Antes del primer despliegue aplica las migraciones de `supabase/migrations/` en orden numérico
   (0001…0025) desde el SQL Editor de Supabase: sin la 0024 no existen los roles `admin_sistemas`
   ni `director`, y **sin la 0025 no se puede solicitar una cita sin elegir fecha** (el portal ahora
   solo pide centro + especialidad; `fecha_cita` y `hora_inicio` quedan en `NULL` hasta que
   recepción las asigne).
5. En *Environment* define:

| Variable | Valor |
| --- | --- |
| `ENVIRONMENT` | `production` (el Dockerfile ya lo fija) |
| `SUPABASE_URL` | `https://<proyecto>.supabase.co` |
| `SUPABASE_KEY` | service_role key |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | `https://<tu-portal>.vercel.app` |
| `CORS_ORIGIN_REGEX` | `^https://[a-z0-9-]+\.vercel\.app$` (previews) |
| `TZ` | `America/Caracas` (ya definido en `render.yaml`) |
| `RECUPERACION_EXPIRACION_MINUTOS` | `15` |
| `ENABLE_SCHEDULER` | `false` en el plan free (Render suspende la instancia); `true` con instancia siempre encendida |

6. Copia la URL pública (`https://<servicio>.onrender.com`) y comprueba
   `https://<servicio>.onrender.com/api/v1/health`: debe responder `"base_de_datos": "ok"`.

El plan free de Render suspende el servicio tras unos minutos sin tráfico: la primera petición
tarda en despertar y los recordatorios programados no corren con fiabilidad. Para un piloto real,
usa una instancia siempre encendida y déjalo en `ENABLE_SCHEDULER=true`.

Si falta una variable obligatoria el contenedor no arranca y muestra en el log exactamente cuál
falta: es intencional, evita servir el portal con un JWT falsificable o sin base de datos.

### 7.3 Conectar el frontend

En Vercel → *Project → Settings → Environment Variables* define **solo**:

```
VITE_API_URL=https://<servicio>.onrender.com
```

Y vuelve a desplegar (las variables `VITE_*` se incrustan en el build). Las variables de Supabase
que hayas puesto en Vercel no las usa el frontend: el navegador nunca habla con Supabase. Bórralas
de Vercel y déjalas únicamente en Render; si alguna vez llevan el prefijo `VITE_`, quedarían
visibles en el JavaScript público.

## 8. Flujo de citas: centro + especialidad (sin fecha en el portal)

El paciente del portal público **no elige fecha ni horario**: solo selecciona el centro de salud
y la especialidad (y opcionalmente un motivo). La solicitud se crea en estado `pendiente` con
`fecha_cita = NULL` y `hora_inicio = NULL`, y la recepción del sistema interno le asigna el
médico, la fecha y la hora según el `centro_id`.

- `POST /citas/solicitar` — crea la solicitud (centro + especialidad, sin fecha).
- `PATCH /citas/{id}/asignar` — recepción confirma asignando médico, fecha y hora.
- Las solicitudes `pendiente` no bloquean cupos de horario (no ocupan slot mientras esperan asignación).

Este cambio requiere la migración `supabase/migrations/0025_citas_fecha_opcional.sql`
(`fecha_cita` y `hora_inicio` pasan a admitir `NULL`).

---

## Estructura del proyecto

```
BnaSalud/
├── app/                      # Backend FastAPI
│   ├── api/v1/endpoints/     # Endpoints: citas, centros, especialidades, pacientes, consultas, farmacia...
│   ├── core/                 # Configuración, cliente Supabase, seguridad JWT
│   ├── db/                   # Semilla de datos (seed)
│   └── schemas/              # Modelos Pydantic
├── frontend/                 # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── components/       # Navbar, Hero, Centros, CitaModal, etc.
│   │   ├── pages/            # Home y portal del paciente
│   │   ├── api.js            # Cliente HTTP de la API
│   │   └── index.css         # Tema Tailwind
│   ├── public/               # Imágenes e identidad visual
│   └── maquetas/             # Bocetos HTML originales (referencia)
├── mobile/                   # App móvil Expo / React Native
├── supabase/
│   ├── migrations/           # Esquema SQL (aplicar en orden en el SQL Editor)
│   ├── restore_schema.sql    # Restauración de emergencia del esquema
│   └── seed.sql
├── scripts/                  # setup.js (instalación) y restore_db.py
├── Dockerfile                # Imagen del backend (Render / Railway)
├── render.yaml               # Blueprint del servicio en Render
├── docker-compose.yml        # Evolution API (WhatsApp)
├── .env.example              # Plantilla de variables de entorno
└── requirements.txt
```

## Rutas del portal

| Ruta | Descripción |
| --- | --- |
| `/` | Home público + reserva de citas en línea |
| `/paciente` | Portal del paciente (login con cédula + contraseña): citas, historial, recetas y resultados |

## Comandos útiles

| Comando | Descripción |
| --- | --- |
| `venv\Scripts\python.exe -m uvicorn app.main:app --reload` | Iniciar backend |
| `venv\Scripts\python.exe -m app.db.seed` | Sembrar datos de demo |
| `npm run setup` (raíz) | Instalar todo (env + backend + frontend + mobile) |
| `npm run dev` (en `frontend/`) | Iniciar frontend en desarrollo |
| `npm run build` (en `frontend/`) | Compilar frontend para producción |
| `npm run lint` (en `frontend/`) | Revisar estilo del código (oxlint) |
| `npm --prefix mobile start` | Iniciar la app móvil (Expo) |
| `docker compose up -d` | Levantar Evolution API (WhatsApp) |

## Notas del piloto

- La reserva de citas en línea solo está habilitada para **CITAB** (`centro_id=2`) durante la fase piloto.
- El backend resuelve las rutas de archivos estáticos de forma **relativa**: arranca siempre `uvicorn` desde la **raíz del repositorio**, no desde `app/`.
- Valores por defecto pensados solo para desarrollo: `JWT_SECRET`. Cámbialo antes de un despliegue real. El código de restablecimiento de contraseña solo se devuelve en la respuesta con `ENVIRONMENT=development` y sin SMTP; en producción va únicamente por correo.
