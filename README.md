# BnaSalud

Sistema de Salud Municipal del Municipio Simón Bolívar - Barcelona, Anzoátegui (Venezuela).

- **Backend:** FastAPI + Supabase
- **Frontend:** React 19 + Vite + Tailwind CSS v4

## Requisitos

- **Python 3.10+**
- **Node.js 18+** (recomendado 20+)
- **Git**

## 1. Clonar el repositorio

```bash
git clone https://github.com/Adrianmbt/BnaSalud.git
cd BnaSalud
```

## 2. Configurar el Backend

### Crear entorno virtual e instalar dependencias

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

```bash
pip install -r requirements.txt
```

### Configurar variables de entorno

Copia el archivo de ejemplo y complétalo con tus credenciales:

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Edita `.env`:

```env
SUPABASE_URL="https://TU-PROYECTO.supabase.co"
SUPABASE_KEY="TU-ANON-KEY"
GOOGLE_API_KEY=""
```

> **Nota:** `.env` y `Cred_hash.txt` no se suben al repositorio (contienen secretos). Pídelos al equipo o créalos desde el panel de Supabase.

### Base de datos (Supabase)

Los centros de salud se leen de la tabla `clinicas`. Crea la tabla y carga los datos con:

```sql
CREATE TABLE clinicas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  parroquia TEXT,
  direccion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO clinicas (nombre, codigo, parroquia, direccion, activo)
VALUES
  ('Clínica del Niño', 'CLN-NINO', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  ('Clínica de los Trabajadores (CITAB)', 'CLN-CITAB', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  ('Clínica de la Mujer', 'CLN-MUJER', 'San Cristóbal', 'Barcelona, Anzoátegui', TRUE),
  ('Centro Oncológico Municipal', 'CLN-ONCO', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  ('Jornadas de Salud Móviles', 'CLN-JORNADAS', 'General', 'Atención Itinerante - Municipio Simón Bolívar', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    parroquia = EXCLUDED.parroquia,
    direccion = EXCLUDED.direccion;
```

> El backend mapea cada `codigo` con su identidad visual (logo, colores, horarios y servicios) definidos en `app/api/v1/endpoints/centros.py`.

## 3. Configurar el Frontend

```bash
cd frontend
npm install
```

## 4. Correr en desarrollo

Necesitas **dos terminales**:

**Terminal 1 - Backend** (raíz del proyecto):

```bash
venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend** (carpeta `frontend`):

```bash
npm run dev
```

Luego abre **http://localhost:5173**. El frontend redirige las llamadas `/api/*` al backend automáticamente (proxy configurado en `frontend/vite.config.js`).

- Documentación de la API: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

## 5. Build de producción

El backend sirve el frontend compilado en la raíz:

```bash
cd frontend
npm run build
```

Luego solo necesitas el backend corriendo; la app estará en **http://localhost:8000**.

## Estructura del proyecto

```
BnaSalud/
├── app/                    # Backend FastAPI
│   ├── api/v1/endpoints/   # Endpoints: citas, centros, especialidades, rrhh, farmacia
│   ├── core/               # Configuración, cliente Supabase
│   └── schemas/            # Modelos Pydantic
├── frontend/               # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── components/     # Navbar, Hero, Centros, CitaModal, Chatbot, etc.
│   │   ├── pages/          # Home y páginas por rol
│   │   ├── api.js          # Cliente HTTP de la API
│   │   └── index.css       # Tema Tailwind
│   ├── public/             # Imágenes e identidad visual
│   └── maquetas/           # Bocetos HTML originales (referencia)
├── .env.example            # Plantilla de variables de entorno
└── requirements.txt
```

## Comandos útiles

| Comando | Descripción |
|---|---|
| `venv\Scripts\python -m uvicorn app.main:app --reload` | Iniciar backend |
| `npm run dev` (en `frontend/`) | Iniciar frontend en desarrollo |
| `npm run build` (en `frontend/`) | Compilar frontend para producción |
| `npm run lint` (en `frontend/`) | Revisar estilo del código |
| `venv\Scripts\pip install -r requirements.txt` | Instalar dependencias backend |

## Notas del piloto

- La reserva de citas en línea solo está habilitada para **CITAB** (`centro_id=2`) durante la fase piloto.
- Los endpoints de citas, RRHH y farmacia devuelven datos de ejemplo; la persistencia real está en desarrollo.
