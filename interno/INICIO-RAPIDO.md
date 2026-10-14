# Arranque del proyecto

Se levanta **el backend (siempre)** y, según el caso, **el frontend**. Para
probar en el móvil hay además un paso de enlace por depuración inalámbrica.

Todos los comandos de abajo están probados en esta máquina.

---

## Cuántas terminales: una o dos, nunca tres

| Modo | Terminal 1 | Terminal 2 |
|---|---|---|
| **Navegador web** | `backend/` → `uvicorn main:app --reload` | `frontend/` → `npm run dev` |
| **Móvil, assets horneados** | `backend/` → `uvicorn main:app --reload` | *ninguna*: son comandos sueltos (§3.5), no un servidor |
| **Móvil, recarga en caliente** | `backend/` → `uvicorn main:app --reload` | `frontend/` → `npm run dev` |

**Nunca hacen falta tres.** El enlace por Wi-Fi (§3.1–3.4) son comandos
sueltos de PowerShell, se ejecutan una vez cada uno y no ocupan terminal.

La sesión real en la que se armó esto: **1 terminal** (backend) + los
comandos de enlace por Wi-Fi.

---

## 1. Backend — terminal 1 (obligatorio)

```powershell
cd backend
uvicorn main:app --reload
```

Queda en `http://127.0.0.1:8000`. Comprobar:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/openapi.json | Select-Object info
```

> Debe arrancar **desde `backend/`**: los imports son `app.*`, así que desde
> otro directorio no encuentra los módulos.

> `--host 0.0.0.0` **no hace falta** para las pruebas inalámbricas. Con
> `adb reverse` (§3.4) el tráfico entra por el `127.0.0.1` del PC. Solo hace
> falta para la variante `VITE_API_URL` por IP del PC, que sí requiere el
> firewall abierto (ver `PRUEBAS-INALAMBRICAS.md`).

---

## 2. Frontend web — terminal 2 (opcional)

```powershell
cd frontend
npm install      # solo la primera vez
npm run dev
```

Abre `http://localhost:3000`.

El servidor de Vite hace proxy de `/api` hacia el backend, pero **el proxy no
se usa**: `frontend/.env` define `VITE_API_URL=http://localhost:8000`, así que
la app va directo al 8000.

---

## 3. Enlazar el móvil por Wi-Fi

Método por **código de emparejamiento**, que es el que funcionó. **Nunca
necesita cable.** Requiere Android 11+ (el dispositivo de prueba es 14).

### 3.0 Preparar variables (hazlo una vez por sesión)

```powershell
$adb='C:\Users\adria\android-sdk\platform-tools\adb.exe'

# el identificador del móvil, lo descubro yo de la lista de adb:
$tel = (& $adb devices | Select-String 'adb-.*\sdevice' | ForEach-Object { ($_ -split '\s+')[0] })
$tel
```

`$tel` no lleva IP: es el identificador que devuelve adb (en la sesión real,
`adb-12693704B5012583-hLTGDJ._adb-tls-connect._tcp`). **Funciona en cualquier
red** — en el centro de salud, en tu casa o en una red de visita, sin tocar
este archivo. Todos los comandos de abajo usan `-s $tel`.

> Si `$tel` sale vacío es que el móvil todavía no está enlazado: sigue al
> §3.1–3.3 y vuelve a correr esta línea.

### 3.1 En el teléfono (esto es lo único que requiere tocar la pantalla)

1. Si no están activas las opciones de desarrollador:
   `Ajustes → Acerca del teléfono → Número de compilación` → pulsar **7 veces**.
2. `Ajustes → Opciones de desarrollador → Depuración inalámbrica` → **activar**.
3. Entrar en **Emparejar dispositivo con código**.

Te muestra una dirección `IP:puerto` y un **código de 6 dígitos**:

```
IP address & port:   10.1.1.211:42731        <- cambia en cada red
                     151384
```

> Los dos valores **cambian** según la red y el momento. No están escritos en
> este archivo a propósito: cópialos tal cual de la pantalla cada vez.
> El código **caduca a los 5 minutos**: ten el diálogo abierto cuando los
> pases.

### 3.2 En el PC: emparejar

Sustituye por lo que marque la pantalla:

```powershell
& $adb pair IP_DEL_TELEFONO:PUERTO CODIGO_DE_6_DIGITOS
# -> Successfully paired to 10.1.1.211:42731 [guid=adb-...]
```

Ejemplo de cómo se ve una vez:

```
& $adb pair 10.1.1.211:42731 151384
-> Successfully paired to 10.1.1.211:42731 [guid=adb-...]
```

> El `pair` **no** conecta el dispositivo: solo authorizes las claves RSA.
> Falta el paso 3.3.

### 3.3 Conectar (el puerto de conexión lo descubre solo)

No hay que leer un segundo puerto de la pantalla: el teléfono se anuncia por
mDNS.

```powershell
& $adb mdns services
#   -> adb-12693704B5012583-hLTGDJ._adb-tls-connect._tcp   10.1.1.211:39791
#                                                          ^^^^^^ también cambia
& $adb connect 10.1.1.211:39791
& $adb devices -l      # debe listar el dispositivo como "device"
```

> Ese segundo puerto de la pantalla de *Depuración inalámbrica* ya no hace
> falta leerlo: se copia de la salida de `mdns services`.

Si el dispositivo aparece duplicado (había un `adb tcpip 5555` viejo de otra
sesión), hay que soltar uno de los dos, si no adb responde
`more than one device/emulator`:

```powershell
& $adb disconnect IP_DEL_TELEFONO:5555   # el viejo tcpip; además muere al reiniciar
```

### 3.4 Exponer el backend al teléfono

```powershell
& $adb -s $tel reverse tcp:8000 tcp:8000
& $adb -s $tel reverse --list
#   -> host-26 tcp:8000 tcp:8000
```

Con esto el `localhost:8000` del teléfono apunta al PC. Es lo que permite que
la app, que lleva `VITE_API_URL=http://localhost:8000` compilado dentro,
llegue al backend.

> El reverse **se cae al reiniciar el teléfono**. Si la app dice "sin
> conexión", reejecutarlo y verificar con `reverse --list`.

### 3.5 Construir, instalar y abrir

La app móvil **no** usa el servidor de Vite: lleva los assets horneados en el
APK, así que cada cambio de código obliga a reconstruir.

```powershell
cd frontend
npm run cap:sync                                          # = build + cap sync android
cd android
.\gradlew.bat assembleDebug
& $adb -s $tel install -r app\build\outputs\apk\debug\app-debug.apk
& $adb -s $tel shell am start -n ve.bnasalud.citab/.MainActivity
```

> No hace falta tocar `JAVA_HOME`: `compileSdk 36` corre bien con el JDK 17
> que ya está en el sistema.

### 3.6 Verificar que llegó al backend

Si te funciona, la terminal del backend muestra peticiones del móvil:

```
INFO:  127.0.0.1:50364 - "GET /api/v1/cola?rol=medico_emergencia HTTP/1.1" 200 OK
INFO:  127.0.0.1:50364 - "GET /api/v1/historias-clinicas/8204047 HTTP/1.1" 200 OK
```

Aparecen como `127.0.0.1` aunque el móvil esté en la red, porque `adb reverse`
tuneliza por la conexión adb ya establecida. **Ese es el signo de que va
inalámbrico**: no hay ni un solo cable implicado.

---

## 4. Recarga en caliente (opcional, acelera mucho iterar)

Si tocas un archivo y quieres verlo en el móvil sin reconstruir, apunta la
app al servidor de Vite. La IP del PC hay que leerla en cada red:

```powershell
(Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -eq 'Wi-Fi' }).IPAddress
# -> 10.1.1.237
```

Y escribirla en `frontend/capacitor.config.json`:

```json
"server": { "url": "http://10.1.1.237:3000", "cleartext": true }
```

Con eso levantas `npm run dev` (§2) y la app se actualiza sola en el móvil.

> **Quitar ese bloque antes de generar el APK que vaya al centro de salud.**
> `cleartext` es solo para desarrollo y la app instalada apuntaría a un
> servidor dev que no existirá. La IP queda escrita aquí sí o sí, así que
> esta variante hay que editarla al cambiar de red (a diferencia del resto
> del archivo, que se adapta solo).

---

## 5. Otros comandos

```powershell
cd frontend
npm test              # node --test (8 pruebas)
npm run build         # solo el build web
npm run cap:open      # abre el proyecto en Android Studio
npm run doctor        # npx react-doctor (auditoría)
```

```powershell
# parar el backend: Ctrl+C en su terminal

# reiniciar la app sin reinstalar (libera el WebView antes de medir por CDP)
& $adb -s $tel shell am force-stop ve.bnasalud.citab
& $adb -s $tel shell am start -n ve.bnasalud.citab/.MainActivity
```

---

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `ModuleNotFoundError: app` | el backend arrancó fuera de `backend/` |
| `adb pair` → `protocol fault` | código caducado o diálogo cerrado; reabrir y usar uno nuevo |
| `adb pair` → `unauthorized` | se Tecleó mal el código de 6 dígitos |
| `pair` funciona pero `devices` vacío | faltó el `adb connect` del §3.3 |
| `adb mdns services` vacío | *Depuración inalámbrica* está apagada en el teléfono, o hay VPN |
| La app dice "sin conexión" | falta `adb reverse tcp:8000 tcp:8000` (§3.4), o se cayó al reiniciar |
| `more than one device/emulator` | sobró un enlace viejo; `adb disconnect <ip>` (§3.3) |
| `adb connect` da error 10061 / 10060 | se conectó a la IP del PC, no a la del teléfono |

Si la depuración anónima se rompe del todo, vuelve a §3.1. El enlace por
código sobrevive reinicios, a diferencia de `adb tcpip 5555`.