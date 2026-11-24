# AGENTS.md

Clinical management platform (BnaSalud / CITAB, Venezuela). React 18 + Vite + Tailwind frontend, FastAPI + SQLAlchemy async backend, PostgreSQL (Supabase). All repo prose, docs, and commit messages are in Spanish.

## Run

- Backend: `cd backend; pip install -r requirements.txt; uvicorn main:app --reload` — must run from `backend/` (imports are `app.*`). Port 8000. A `backend/.env` with a real `DATABASE_URL` is required; defaults in `app/core/config.py` are placeholders.
- Frontend: `cd frontend; npm install; npm run dev` — Vite on port 3000, proxies `/api` to `:8000` (`vite.config.js`). No lint/typecheck/test scripts configured; `npm run build` is the only verification.
- Seeds (idempotent, run from `backend/`, write to the live DB): `python -m app.seed_demo`, `python -m app.seed_citas_demo` (pacientes y citas demo: citas de hoy con cola para probar postergación, citas en las 4 semanas siguientes según la agenda vigente y reporte de cupos por semana), plus `seed_agenda`, `seed_medicamentos`, `seed_examenes_ofrecidos`, `seed_antecedentes_operatorios`. **`seed_ordenes_examenes.sql`** is not a Python module — it's the mixture for the exams catalog/orders schema (`catalogo_examenes`, `ordenes_medicas`, `orden_examenes_items`); apply it with psql (`psql -d <db> -v ON_ERROR_STOP=1 -f app/seed_ordenes_examenes.sql`). If those tables don't exist, `GET /examenes/catalogo` and `/examenes/ordenes` 500.

## Gotchas

- **No Alembic.** Schema comes from setup scripts / SQL dumps, not migrations. DB tables, ENUMs, and data live in the external Postgres instance; changing a model does not change the DB.
- **Timezone.** DB is `America/Caracas`. Use `CURRENT_DATE` for "today" queries, never `datetime.now(utc)` (frontend date rollover was a reported bug).
- **Remisión por turnos.** `GET /api/v1/agenda/jornadas` agrupa la agenda en turnos (Mañana/Tarde) con cupos y `hora_asignada`; la UI del médico de emergencia muestra solo esos turnos y crea la cita en la primera franja libre. `admin_sistemas` edita el horario semanal en la sección **Horarios** (`/admin/medicos*`); solo Medicina General y Emergencias pueden tener turnos de 24 h. Desde el formulario de usuarios (crear y editar) también se crea/actualiza la ficha `personal` del médico: nombre, apellido, cédula y especialidad.
- **Role mapping.** DB roles (`recepcionista`, `medico_emergencia`, `medico`, `jefe_farmacia`, `farmaceutico`, `historias_medicas`, `admin_sistemas`, `director`) are mapped to frontend roles (`recepcion`, `emergency`, `especialista`, `farmacia`, `historias_medicas`, ...) in `MODULOS_INTERNOS` in `backend/app/api/v1/endpoints/auth.py:26`. `App.jsx` routes by the mapped role.
- **Emergency login is guard-gated.** A `medico_emergencia` user can only log in if a `guardias` row exists with `estado='ACTIVA'` covering today (`fecha = CURRENT_DATE` or yesterday, for 24h/night shifts) for their `personal_id` (login returns 403 otherwise). The guard is started by recepción (`POST /api/v1/guardias/iniciar`, wired in `GuardiaPanel.jsx`, which sends the local date, not UTC).
- **Inventory ID collision.** `medicamentos_catalogo` and `insumos_catalogo` share numeric IDs; the unified endpoint returns `tabla_origen` to disambiguate. Stock deduction searches those two tables (`medicamentos_catalogo`, `insumos_catalogo`); the legacy `inventario_medicamentos` table is retired from the deduction path (legacy rows no longer consume stock).
- **WhatsApp** is optional and requires the Evolution API docker stack in `infra/evolution/` (`EVOLUTION_*` settings).

## Historia clínica integral (rol `historias_medicas`)

- Módulo en `/api/v1/historias-medicas` y `frontend/src/components/historias/`.
- Flujo: recepción registra → el médico de emergencia atiende → `historias_medicas` completa la ficha y la atención. `GET /historias-medicas/cola` lista la cola de la clínica del usuario (CITAB = 2) en estados `EN_CONSULTA`/`FINALIZADO` del día.
- La atención crea una fila en `consultas` con `origen='historia_integral'` y, si viene de la cola, enlaza `cola_atencion.consulta_id`. Incluye `tratamiento` (realizado/instaurado), `recetas` JSONB y el `reposo` dentro de las indicaciones: al guardar se emite el folio en `reposos_medicos` y se deja una instantánea en `consultas.reposos`.
- Los reposos se anulan por `historias_medicas`, `admin_sistemas` o `director`; no se borran.

## Verification

- No unit-test suite. Manual E2E via PowerShell scripts at repo root (`test-remision-completo.ps1`, `test-duplicado-en-consulta.ps1`) that hit `http://localhost:8000/api/v1` against the live DB; they create real (random-cedula) patients, so running them pollutes data.
- Test logins (password `test123`): per-center users in `USUARIOS_PRUEBA.md`; `oswaldo/admin123` and `director/director123` in `CREDENCIALES.md`. Do not commit real credentials to `.env` files or commits.