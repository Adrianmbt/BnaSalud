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
0001_schema.sql  →  0002_..._sql  →  ...  →  0023_consulta_insumos_y_cita_cola.sql
```

Una migración que falte aparece como un error 500 en el endpoint que toca esa tabla. Editar un archivo Python nunca cambia la base de datos.

Después de aplicar las migraciones, carga los datos de demo/prueba (idempotente, escribe en la base de datos real):

```bash
venv\Scripts\python.exe -m app.db.seed
```

Credenciales de la semilla:

- Personal: usuario `abello`, contraseña `BnaSalud2026!`
- Pacientes: cédula `18234567`, PIN `1234`

## 5. Correr en desarrollo

**Terminal 1 — Backend** (raíz del proyecto; el directorio de trabajo importa):

```bash
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend** (carpeta `frontend`):

```bash
cd frontend
npm run dev
```

Abre **http://localhost:5173**. El frontend redirige `/api/*` y `/static/*` al backend automáticamente (proxy en `frontend/vite.config.js`).

- Documentación de la API: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

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
├── docker-compose.yml        # Evolution API (WhatsApp)
├── .env.example              # Plantilla de variables de entorno
└── requirements.txt
```

## Rutas del portal

| Ruta | Descripción |
| --- | --- |
| `/` | Home público + reserva de citas en línea |
| `/paciente` | Portal del paciente (login con cédula + PIN): citas, historial, recetas y resultados |

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
- Valores por defecto pensados solo para desarrollo: `JWT_SECRET` y `PIN_EMITIR_DEMO=true` (devuelve el código de recuperación de PIN en la respuesta cuando no hay SMTP). Cámbialos antes de un despliegue real.
