# Salud Barcelona (BNASALUD) · Módulo Móvil (React Native)

Aplicación móvil complementaria para los roles de **Doctor (Consulta / Triaje)** y **Farmacia (Despacho / Existencias)** del sistema de salud municipal *Salud Barcelona*.

---

## 📱 Tecnologías y Requisitos

- **Expo SDK 54** (Compatible con Expo Go en dispositivos físicos y emuladores).
- **React Native 0.76+** (New Architecture).
- **NativeWind v4** (Tailwind CSS en React Native).
- **@shopify/flash-list** (Listas virtualizadas de alto rendimiento a 60/120 fps).
- **Expo Haptics** (Respuesta táctil médica en confirmaciones y triaje).
- **100% en Español** (Etiquetas, chips de estado, alertas, modales y botones).

---

## 🚀 Inicio Rápido

1. **Instalar dependencias:**
   ```bash
   cd mobile
   npm install
   ```

2. **Iniciar el servidor de desarrollo Expo:**
   ```bash
   npx expo start
   ```

3. **Abrir en dispositivo:**
   - **Dispositivo físico:** Escanear el código QR con la app **Expo Go** (Android/iOS).
   - **Emulador Android:** Presionar `a` en la terminal.
   - **Simulador iOS:** Presionar `i` en la terminal.

---

## 🔌 Configuración de la API

En `src/api/client.ts`, configure la variable `API_BASE_URL` según su entorno:
- **Dispositivo físico (Expo Go en la misma red Wi-Fi):** `http://<IP_DE_TU_PC>:8000/api/v1`
- **Emulador Android:** `http://10.0.2.2:8000/api/v1`
- **Simulador iOS:** `http://localhost:8000/api/v1`

---

## 🩺 Funcionalidades Clave

### 1. Cola Médica (`DoctorQueueScreen.tsx`)
- Monitoreo en tiempo real de pacientes en espera ordenados por check-in.
- Indicador de capacidad del turno ($10 - 15$ pacientes).
- Botón **"+ Urgencia"** para insertar pacientes no programados directamente a la cola de atención.
- Llamado y cierre de consultas con actualización de estado.

### 2. Despacho de Farmacia (`PharmacyDispenseScreen.tsx`)
- Alimentación en vivo de recetas emitidas desde las consultas médicas.
- Verificación visual de stock por medicamento.
- Selección táctil y confirmación de despacho con descuento de existencias (`POST /api/v1/farmacia/despachar`).
