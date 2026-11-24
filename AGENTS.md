# AGENTS.md

Este repositorio contiene **dos sistemas independientes** que comparten el puerto 8000. Antes de editar, identifica a cuál pertenece la tarea; no mezcles modelos, componentes ni bases de datos.

## Los dos sistemas

| Ruta | Qué es | Stack | Entrypoints |
| --- | --- | --- | --- |
| `interno/` | Sistema clínico instalado en CITAB | FastAPI + SQLAlchemy asyncpg + PostgreSQL `bnasalud`; React 18 + Vite :3000; Capacitor Android | `interno/backend/main.py`, `interno/frontend/src/App.jsx` |
| `app/` + `frontend/` + `mobile/` | Portal público del paciente | FastAPI + cliente Supabase; React 19 + Vite :5173; Expo | `app/main.py`, `frontend/src/App.jsx` |

- `interno/AGENTS.md` tiene el detalle profundo del sistema clínico: **léelo antes de tocar `interno/`**.
- `README.md` e `INSTRUCCIONES.md` describen el portal público y están parcialmente obsoletos. El README dice que `interno/` no forma parte del repo; es falso: está versionado.
- Las dos interfaces usan versiones distintas de React/Tailwind (18/3 vs 19/4). No copies componentes ni patrones de una a otra.

## Arrancar

Sistema interno (el de uso habitual):

```powershell
cd interno\backend
uvicorn main:app --reload          # debe ejecutarse desde backend/ (imports app.*)
```

```powershell
cd interno\frontend
npm run dev                        # http://localhost:3000
```

- Lanzador: `arrancar-todo.bat` → `interno\arrancar-servidores.bat`. Exige `interno\backend\.env` y `interno\frontend\node_modules`; no abre otra ventana si el puerto ya está escuchando.
- Android interno: `cd interno\frontend; npm run cap:run` (build + sync + install + launch). El APK lleva los assets compilados: cada cambio de código obliga a reconstruir.

Portal público:

```powershell
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001   # desde la raíz
cd frontend
npm run dev                                                            # http://localhost:5173
```

- `venv/` se crea con `npm run setup:backend` (o `npm run setup`); el interno no usa ese venv.
- El interno escucha en :8000 y el portal en :8001, así que pueden correr a la vez. El proxy de `frontend/vite.config.js` apunta a :8001; si lo cambias a :8000, el portal hablaría con el backend interno (otra BD y otro esquema) y verás 404.
- App Expo (público): `npm --prefix mobile start`.

## Variables de entorno

- `interno/backend/.env` es obligatorio, está gitignored y **no tiene plantilla versionada**. Mínimo: `DATABASE_URL=postgresql+asyncpg://usuario:clave@localhost:5432/bnasalud`. Sin él, el lanzador aborta.
- **No copies el `.env.example` de la raíz a `interno/backend/.env`**: está pensado para Supabase y no incluye `DATABASE_URL` (la clave que el interno necesita).
- El backend público lee `.env` en la raíz y necesita `SUPABASE_URL` + `SUPABASE_KEY`. El `DATABASE_URL` de `app/core/config.py` no lo usa `app/core/database.py` (cliente Supabase), así que Postgres local **no** alimenta al portal público.
- No commitear `.env`, `CREDENCIALES.md` ni volcados/exportaciones (ya están en `.gitignore`).

## Base de datos y esquema

- **No hay Alembic.** Editar un modelo no cambia la BD.
- Portal público: `supabase/migrations/0001..0027` se aplican a mano, en orden numérico, desde el SQL Editor de Supabase.
- Interno: `interno/backend/migrations/*.sql`, a mano o con `cd interno/backend; python migrations/aplicar_sql.py migrations/015_medicos_reales.sql`. Semillas: `python -m app.seed_*` (ver `interno/AGENTS.md`); `seed_ordenes_examenes.sql` se aplica con `psql`, no es un módulo.
- No cruces los dos juegos de migraciones: son bases distintas.
- **Puente interno → web:** `scripts/sincronizar_interno.py` se ejecuta en el servidor interno y sube a Supabase la nómina, las cuentas (sin contraseñas), la bitácora y un latido; el panel de soporte dentro de `/institucional` los lee de las tablas `interno_*` (migración `0026`). Nunca envía datos clínicos ni escribe en el Postgres interno.
- Zona horaria del interno: `America/Caracas`. Usa `CURRENT_DATE` para "hoy", nunca `datetime.now(utc)`.

## Verificación

- Backend interno: `cd interno/backend; pip install -r requirements.txt; python -m pytest`. Usa el mismo intérprete que el backend (el lanzador prefiere `backend\.venv\Scripts\python.exe` si existe; si no, `python`). Un solo test: `python -m pytest tests/test_seguridad.py::test_login_ok`.
- La suite **recrea `bnasalud_test`** clonando el esquema de `bnasalud` con `pg_dump`/`psql` (autodetecta `C:\Program Files\PostgreSQL\<ver>\bin`; se puede forzar con `PG_BIN`). Requiere `interno/backend/.env`; solo destruye la BD de test.
- Frontend interno: `cd interno/frontend; npm test` (node --test) y `npm run build`. No hay script de lint.
- Frontend público: `cd frontend; npm run lint` (oxlint) y `npm run build`. No hay tests.
- `npm run setup` de la raíz instala solo el portal público (`venv/`, `frontend/`, `mobile/`, Evolution API). **No instala nada de `interno/`**.

## Trampas concretas

- `interno\arrancar-servidores.bat` busca la web pública en `..\BnaSalud\frontend`, ruta inexistente en este checkout: el bloque de :5173 no hace nada. La API :8000 y la web interna :3000 sí arrancan.
- Reglas clínicas fáciles de romper: el login de emergencia está condicionado a una guardia activa; los roles de BD se mapean a roles de frontend en `interno/backend/app/api/v1/endpoints/auth.py`; `medicamentos_catalogo` e `insumos_catalogo` comparten IDs. Antes de tocarlas, lee `interno/AGENTS.md`.
- Prosa, documentación y mensajes de commit en español.
