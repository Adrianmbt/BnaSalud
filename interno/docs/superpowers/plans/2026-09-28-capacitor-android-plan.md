# App nativa Android con Capacitor (BnaSalud CITAB)

> **Para agentic workers:** Usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar tarea por tarea. Pasos con checkbox (`- [ ]`).

**Goal:** Empaquetar la SPA React de la plataforma clínica como app Android nativa usando Capacitor, y validarla en un teléfono físico por USB.

**Arquitectura:** Capacitor envuelve el `dist/` de Vite en un WebView Android. La API se consume igual que en web (axiosClient con `VITE_API_URL`); no hay plugins nativos.

**Tech Stack:** React 18 + Vite (existente), Capacitor 7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`), FastAPI backend existente en `:8000`.

## Decisiones

- **Teléfono físico por USB + `adb reverse`** (no emulador): la máquina es un i3-11th / 8 GB RAM, el emulador AVD queda fuera.
- **Túneles USB en vez de Wi-Fi/LAN**: `adb reverse tcp:3000 tcp:3000` y `tcp:8000` hacen que `localhost:<puerto>` del teléfono apunte al PC. Evita firewall y problemas de red del cliente.
- **Dev con livereload**: el WebView carga del Vite dev server (`server.url = http://localhost:3000`), así `/api` pasa por el proxy de Vite → backend sin cambios de CORS en la fase de desarrollo.
- **Smoke test empaquetado**: `VITE_API_URL=http://localhost:8000/api/v1` + `adb reverse tcp:8000 tcp:8000`; único ajuste de backend: agregar `http://localhost` a `CORS_ORIGINS`.
- **Fuera de alcance**: release firmado, HTTPS, plugins `@capacitor-community`, emulador. La app no requiere ninguna capacidad nativa.

## Tareas

- [ ] `npm i @capacitor/core @capacitor/android` y `npm i -D @capacitor/cli` (en `frontend/`)
- [ ] `npx cap init "CITAB BnaSalud" ve.bnasalud.citab --web-dir dist`
- [ ] `npm run build` y `npx cap add android` (genera `android/`)
- [ ] Configurar `capacitor.config`:
  - `webDir: 'dist'`
  - Dev: `server.url: 'http://localhost:3000'` (solo fase de livereload; quitarse en APK empaquetado)
- [ ] `adb reverse tcp:3000 tcp:3000` + `npx cap run android` → livereload desde Vite dev server
- [ ] Test de humo: login `rec_omaruja`/`test123` desde la app, validar JWT/localStorage en WebView y cola solo del centro omaruja
- [ ] Smoke empaquetado: `adb reverse tcp:8000 tcp:8000`; agregar `http://localhost` a `CORS_ORIGINS` (`backend/app/core/config.py`); `VITE_API_URL=http://localhost:8000/api/v1` → `npm run build && npx cap sync && npx cap run android`
- [ ] Verificación: `npm run build` limpio, `adb devices` lista el teléfono, login + consulta de cola OK desde el APK

## Verificación

- `npm run build` pasa (solo warnings de chunk-size preexistentes).
- `adb devices` muestra el dispositivo.
- Login + consulta de cola funcionan desde el WebView/APK.

## Gotchas

- Cleartext HTTP: el build **debug** de Capacitor permite HTTP; el release requeriría `server.cleartext` o HTTPS (fuera de alcance). Marcar con `ponytail:` si se aborda.
- `jsPDF`/`html2canvas` (comprobantes) ya se empaquetan como chunks y corren en el WebView sin cambios.
- `window.location.href = '/'` del interceptor 401 funciona en el WebView (sirve contenido local bajo `http://localhost`).
- «No Alembic» (AGENTS.md): no se tocan tablas; este plan no altera el esquema.