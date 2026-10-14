# Interfaz móvil Android accesible — BnaSalud CITAB

> Especificación de diseño. El plan por fases vive en `docs/superpowers/plans/2026-10-04-interfaz-movil-android-plan.md`.
> Antecedente: `docs/superpowers/plans/2026-09-28-capacitor-android-plan.md` (empaquetado base con Capacitor).

**Objetivo:** una app Android para los roles `especialista`, `emergencia`, `recepcion` y `director`, que se parezca a la interfaz web actual pero esté diseñada para que un médico sin tiempo pueda usarla con una sola mano, en segundos, sin perder ningún detalle clínico.

## Contexto

Capacitor 8 y el proyecto Gradle ya existen en `frontend/android/` (local, **fuera de git**). `appId ve.bnasalud.citab`, minSdk 24, target 36. Se-Empaquetó una vez pero **nunca funcionó contra el backend**.

Topología objetivo: un servidor por centro de salud, frontend servido por Cloudflare, datos en el centro con sincronización a Supabase **en el futuro**. Por eso **la URL del API es un valor de runtime por dispositivo**, no un valor horneado en el build.

## Decisiones

| Decisión | Motivo |
|---|---|
| **Un solo código, cero flag `isMobile` para layout** | Hoy no existe ninguna detección de dispositivo (0 ocurrencias de `matchMedia`/`innerWidth`) y Tailwind ya resuelve nav/layout por breakpoints. Un flag de bifurcación duplicaría 259 botones y un archivo de 3297 líneas. |
| **Un solo booleano `esNativo()`** | Solo para lo que CSS no puede hacer: botón atrás, háptica, cámara, dictado, almacenamiento durable, status bar, insets de teclado. |
| **Correcciones de accesibilidad aplicadas una vez** | Benefician también la versión web. No hay dos Interfaces que mantener. |
| **Director entra en v1 como prioritario** | La rendición de cuentas de la institución depende de él: necesita **leer y exportar**, no editar. |
| **Pila de modales para el botón atrás, no un router** | No hay router (`App.jsx` es un `useState` con `currentRole === '...'`). Un router completo es un refactor de 4 roles sin beneficio clínico. |
| **Servidor local por centro diferido** | Es pedido explícito del usuario para más adelante. v1 solo deja el gancho (URL runtime) para no bloquearlo. |
| **Sin directorio público de centros todavía** | YAGNI. El hook de almacenamiento lo hace aditivo después si los centros multiplican. |

## Arquitectura

### Origen de la URL del API — `src/config/api.js`

Un único lugar de verdad,resolution en orden:

1. URL persistida en el dispositivo (pantalla "Servidor")
2. `import.meta.env.VITE_API_URL` (build-time)
3. `'/api/v1'` (web, relativitydo via proxy de Vite)

Hoy esto está duplicado y **roto**: `axiosClient.js:4` y `Login.jsx:9` resuelven cada uno su propia cosa y el segundo ignora la env var. En el WebView `/api/v1` resuelve a `https://localhost/api/v1` → 404. Se arregla la **causa raíz**: una función, dos llamadores.

### Sesión — `src/sesion.js`

Hoy las 8 claves `citab_*` están **triplicadas** en `App.jsx:23`, `App.jsx:54` y `axiosClient.js:18`. Se unifican en un módulo: `@capacitor/preferences` en nativo, `localStorage` en web.

`localStorage` de WebView puede ser borrado por el OS bajo presión de almacenamiento y desaparece al limpiar datos de la app. Para una sesión que habilita un turno de urgencias es inaceptable.

### Cleartext HTTP

`targetSdk 36` bloquea HTTP plano. Los servidores de centro serán HTTP en LAN y `adb reverse` también lo necesita.

**No** se usa `android:usesCleartextTraffic="true"` global — abriría el APK a MITM desde cualquier red. Se usa `networkSecurityConfig="@xml/network_security_config"` con cleartext permitido **solo** en `10/8`, `172.16/12`, `192.168/16`, `localhost`.

Verificado: `server.cleartext` de Capacitor **solo** afecta la generación de manifiesto de plugins Cordova (`node_modules/@capacitor/cli/dist/cordova.js:756`), no el manifiesto de la app, que es manual y `cap sync` no sobrescribe.

### Export de PDF

Hay **4 llamadas a `doc.save()`** que en un WebView no tienen destino de descarga y fallan silenciosamente: `InventoryKpiTab.jsx:134`, `AtendidosHoy.jsx:202`, `pdfUtils.js:498`, `EmergencyDoctorInterface.jsx:1294`.

Para el director esto **es** el entregable de la rendición de cuentas. Se resuelve con un helper único: `Capacitor.Blob` → `Filesystem.writeFile` → `Share.shareFiles`, con fallback a `doc.save()` en web. Un archivo arregla los cuatro sitios y de paso a los médicos.

## Fases

| Fase | Objetivo | Bloquea a |
|---|---|---|
| 0 | Que el APK alcance el backend y no pierda sesión | todo |
| 1 | Fundaciones de accesibilidad | 3 |
| 2 | Botón atrás de Android | usabilidad |
| 3 | Extraer consulta de emergencia → flujo simplificado | — |
| 4 | Director móvil: KPI + export real | rendición de cuentas |
| 5 | Recepción móvil: flujo de cola | — |
| 6 | Base de medición para evaluar accesibilidad después | — |

### Fase 1 — Fundaciones de accesibilidad

Base medida, no supuesta: **259 `<button>`**, **114 con `py-1`/`py-1.5`** (~30px, muy bajo los 44dp), **0 manejo de safe-area**, 20 diálogos ya con `role`/`aria-modal` correctos.

1. Piso táctil `min-h-11 min-w-11` en todo control interactivo. Precedente en repo: `MedicalOrderSelector.jsx` usa `min-h-[44px] min-w-[44px]`.
2. `viewport-fit=cover` + `env(safe-area-inset-*)` en topbar, barra de acción inferior y footer.
3. Insets de teclado (`@capacitor/keyboard`): con el teclado abierto el campo enfocado debe quedar visible.
4. 16px mínimo en inputs, para que el ajuste de fuente de Android no dispare zoom del WebView.
5. Barra de acción persistente en zona pulgar (el FAB + drawer de `EmergencyDoctorInterface.jsx:2390-2429` ya es la idea correcta).
6. Arreglar la conflacción de `sidebarCollapsed`: un solo flag maneja colapso de escritorio **y** drawer móvil, y tocar un ítem de nav no cierra el drawer (`ReceptionSidebar.jsx:28-35`, `DirectorSidebar.jsx:79`, `FarmaciaSidebar.jsx:28`).
7. Auditar los 20 `role="dialog"`: foco atrapado, `aria-label`, cierre con ESC. Hoy solo el drawer de emergencia tiene `useModalFocus` (`EmergencyDoctorInterface.jsx:359-410`).

### Fase 2 — Botón atrás

Pila de modales en un contexto: `backButton` saca de la pila; pila vacía → salir app. Sin router, sin migración de URLs.

### Fase 3 — Flujo médico simplificado

**3a. Extracción previa** de `EmergencyDoctorInterface.jsx` (3297 líneas, ~90 `useState`). Extracción pura — el estado **se queda en el padre**:

| Unidad | Región actual |
|---|---|
| `CabeceraPaciente` | `:2014-2083` |
| `SignosVitales` | `:2084-2136` (ya plegable) |
| `NotaClinica` | `:2137-2299` |
| `ResultadosExamenes` | `:2300-2378` |
| `AccionesClinicas` | `:2379-2429` |

**3b. Simplificación:** una columna con revelado progresivo (motivo → signos → diagnóstico → tratamiento → orden → cerrar), un "Guardar y siguiente" en zona pulgar en vez de ~8 paneles a la vez. Campos reordenados por frecuencia clínica real, los raros detrás de "avanzado". Dictado por voz (Web Speech API, cero dependencias) y recientes/favoritos para medicamentos y exámenes.

### Fase 4 — Director móvil

Necesita leer y exportar. La selección de centro ya son 7 sedes (`ExecutiveAdminDashboard.jsx:12-18`) y la rejilla KPI ya colapsa a 2 columnas en teléfono (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`) — funciona tal cual.

`recharts` a 375px es ilegible (ejes y labels). Propuesta: KPI siempre visible + **gráfico a pantalla completa al tocarlo**. Si la legibilidad falla en dispositivo, la tabla manda y el gráfico se queda en web.

### Fase 6 — Base de medición

Para que la evaluación de accesibilidad posterior tenga sobre qué evaluar: checklist manual versionado con los criterios WCAG 2.2 aplicables, baseline numérico de tamaños de target / contraste / densidad por pantalla, y pruebas en dispositivo real con TalkBack a 200% de fuente, una mano, pantalla de 5".

## Verificación

**No hay suite de tests en el repo** (`AGENTS.md:8`) — `npm run build` es el único gate automático. Por eso:

- `npm run build` en cada fase.
- **Checklist manual en teléfono físico** por fase. El emulador no sirve (el plan del 2026-09-28 lo descartó por recursos).
- Self-checks con `node --test` y `assert`, sin dependencias nuevas, para la lógica que sí es testeable: resolución de `apiBase()`, round-trip de `sesion.js`, pop de la pila de modales.

Los scripts `test-remision-completo.ps1` / `test-duplicado-en-consulta.ps1` crean pacientes reales con cédula aleatoria: no usarlos para validar mobile, contaminan la BD.

## Riesgos asumidos

- `color-mix()` en `tailwind.config.js` requiere WebView 111+. Los WebView de Android se autoactualizan por Play Store → riesgo bajo.
- Google Fonts por red en cada arranque frío → flash de fallback. Se acepta en v1.
- `android:allowBackup="true"` en una app clínica — revisar antes de release.
- `frontend/android/` está **fuera de git** hoy; se mete como parte de la Fase 0.
- `assets/public` guarda un build stale; solo se refresca si alguien recuerda `cap sync` → por eso los scripts.

## Fuera de alcance

- Servidor local por centro, sincronización a Supabase, resolución de conflictos, cola offline (Fase futura explícita).
- Release firmado, Google Play, OTA updates.
- App nativa (React Native/Kotlin): reimplementar 4 interfaces clínicas y el stack jsPDF/recharts sería doble mantenimiento permanente para un sistema cuya web ya funciona.
- Plugins nativos más allá de `preferences`, `app`, `keyboard`, `status-bar`, `filesystem`, `share`. Cámara y háptica solo cuando una fase los necesite.
