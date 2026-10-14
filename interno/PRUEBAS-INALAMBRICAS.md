# Pruebas inalámbricas (sin cable USB)

Objetivo: probar el APK en el teléfono sin dejar el PC conectado por USB.
Hoy el backend escucha solo en `127.0.0.1:8000`, así que sin este plan el
teléfono no alcanza la API aunque ambos estén en la misma red.

---

## 1. Preparar el backend (imprescindible)

`uvicorn` por defecto escucha solo en loopback. Hay que exponerlo en la red local.

```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> `--host 0.0.0.0` expone la API a toda la red local. Solo para desarrollo.
> En el centro de salud hay que dejar `--host 127.0.0.1` detrás de un proxy.

Comprobar desde el propio PC que quedó abierto:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

Si hayFirewall de Windows pidiendo permiso, hay que permitir Python en redes
privadas, o el teléfono no va a poder conectarse.

---

## 2. Averiguar la IP del PC

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|VMware|VirtualBox|Tailscale" } |
  ForEach-Object { "$($_.InterfaceAlias) -> $($_.IPAddress)" }
```

Anotar la IP de la interfaz **Wi-Fi**. Ejemplo: `192.168.100.200`.

> La IP **cambia en cada red**: casa, trabajo y centro de salud dan tres
> distintas. Por eso los comandos de abajo no llevan ninguna IP escrita —
> se descubren en el momento.

El teléfono y el PC deben estar en la misma red, sin aislamiento de clientes
("AP isolation" activo en routers de invitados/visitantes lo rompe).

---

## 3. Conectar el teléfono por Wi-Fi

El camino **B** es el probado y el recomendado: sobrevive reinicios y nunca
necesita cable. El **A** queda solo como plan B para dispositivos viejos.

### Camino A — `adb tcpip 5555` (un solo uso, se muere al reiniciar)

Se activa **mientras el teléfono sigue por cable** y a partir de ahí ya se
puede desenchufar.

```powershell
$adb='C:\Users\adria\android-sdk\platform-tools\adb.exe'

# 1. con el teléfono CONECTADO por USB:
& $adb tcpip 5555
#    -> "restarting in TCP mode port: 5555"

# 2. ya se puede desenchufar. La IP del teléfono se lee aquí, cada red es distinta:
($adb devices | Select-String 'adb-.*\sdevice' | ForEach-Object { ($_ -split '\s+')[0] })
```

* La dirección es la **del teléfono**, no la del PC. Conectar a la IP del PC
  da error 10061 "destino denegó".
* `tcpip 5555` **no sobrevive a un reinicio** del teléfono. Ese es su
  defecto y la razón de preferir el camino B.
* El puerto 5555 es fijo, pero la IP tampoco: cambia de red.

### Camino B — Emparejamiento por código (Android 11+, recomendado)

Nunca requiere cable. Sobrevive reinicios.

1. En el teléfono: **Ajustes → Acerca del teléfono** → pulsar 7 veces
   **Número de compilación** para activar las opciones de desarrollador.
2. **Opciones de desarrollador → Depuración inalámbrica** → activar.
3. Entrar a **Depuración inalámbrica → Emparejar dispositivo con código**.
   Aparecen una `IP:puerto` y un **código de 6 dígitos**.

> Los dos valores **cambian** según la red y el momento, por eso no están
> escritos aquí. Cópialos de la pantalla. El código caduca a los 5 minutos.

4. Mientras la pantalla del código sigue abierta, en PowerShell:

```powershell
& $adb pair IP_DEL_TELEFONO:PUERTO CODIGO_DE_6_DIGITOS
# -> Successfully paired to 10.1.1.211:42731 [guid=adb-...]
```

> El `pair` **no conecta** el dispositivo, solo autoriza las claves RSA.
> Falta el paso 5. Confundirlo con "no funcionó" es el error típico.

5. Conectar. **No hay que leer un segundo puerto de la pantalla**: el
   teléfono se anuncia por mDNS y `adb` lo encuentra solo.

```powershell
& $adb mdns services
#   -> adb-12693704B5012583-hLTGDJ._adb-tls-connect._tcp   10.1.1.211:39791

& $adb connect 10.1.1.211:39791
& $adb devices -l      # debe listar el teléfono como "device"
```

Si sale `more than one device/emulator`, es que quedó un enlace `:5555` del
camino A. Se suelta con la IP que muestre `adb devices` en ese momento:

```powershell
& $adb disconnect IP_DEL_TELEFONO:5555
```

### Variable de sesión

Nada más adelante necesita la IP. Se resuelve una vez:

```powershell
$tel = (& $adb devices | Select-String 'adb-.*\sdevice' | ForEach-Object { ($_ -split '\s+')[0] })
```

### Verificar que quedó bien

```powershell
& $adb -s $tel shell echo OK_TCP   # debe imprimir OK_TCP
```

---

## 4. Exponer la API al teléfono

Dos opciones. **Recomendada: `adb reverse`**, porque no hay que tocar la URL
de la app ni recompilar.

```powershell
& $adb -s $tel reverse tcp:8000 tcp:8000
& $adb -s $tel reverse --list
# -> host-26 tcp:8000 tcp:8000
```

Con esto el `localhost:8000` del teléfono apunta al PC, aunque el backend
siga en `127.0.0.1`. Es exactamente lo que ya se hace por cable.

> El `-s $tel` **no se puede quitar**: mientras haya más de una conexión al
> mismo teléfono (por ejemplo cable y Wi-Fi a la vez) adb responde
> `more than one device/emulator`.

> No hace falta abrir el puerto 8000 en el firewall. `adb reverse` tuneliza
> por la conexión adb ya establecida, así que el perfil de red **Público**
> del PC (que es el que tiene ahora mismo) no bloquea nada. El firewall
> solo importa en la alternativa de abajo.

*Alternativa* si `adb reverse` molesta (se cae al reconectar): compilar con la
IP del PC en `VITE_API_URL`, en `frontend/.env`. Esta IP hay que releerla en
cada red (§2) y **requiere reconstruir el APK**, porque queda horneada:

```
VITE_API_URL=http://IP_DEL_PC:8000
```

> Este camino **sí** necesita el firewall abierto y el perfil de red en
> **Privada**, porque ahora la conexión entra directamente al PC por el 8000:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
New-NetFirewallRule -DisplayName "CITAB dev 8000" -Direction Inbound -LocalPort 8000 `
  -Protocol TCP -Profile Private -Action Allow
```

Luego `npm run build` → `npx cap sync android` → `gradlew assembleDebug`.
Downside: la IP cambia cuando el PC se reconecta a otra red.

---

## 5. Instalar y probar

```powershell
cd frontend\android
.\gradlew.bat assembleDebug
& $adb install -r app\build\outputs\apk\debug\app-debug.apk
& $adb shell am start -n ve.bnasalud.citab/.MainActivity
```

---

## 6. Atajos que ya se usan en las pruebas

```powershell
# reiniciar la app (libera el WebView antes de medir por CDP)
& $adb shell am force-stop ve.bnasalud.citab
& $adb shell am start -n ve.bnasalud.citab/.MainActivity

# captura de pantalla
& $adb shell screencap -p /sdcard/s.png
& $adb pull /sdcard/s.png $env:TEMP\s.png

# reabrir reverse si se cae
& $adb reverse --list
```

---

## Problemas frecuentes

**`adb pair` da `failed to connect`** — el código expira a los 5 minutos.
Repetir desde el paso 3. No usar el puerto de emparejar para `connect`.

**El teléfono conecta pero la app dice "sin conexión"** — casi siempre es que
falta `adb reverse tcp:8000 tcp:8000`, o el backend quedó en `--host 127.0.0.1`.
Revisar con `& $adb reverse --list`.

**Funciona en casa y no en el centro** — el router del centro tiene
aislamiento de clientes. No hay arreglo por software; hay que cablear o
levantar un hotspot propio.

**Se desconecta solo** — el teléfono roba el Wi-Fi por ahorro de energía.
En *Opciones de desarrollador → Red*: activar **Mantener la actividad WLAN
durante la carga** es lo que realmente lo sostiene.

**Cae el reverse al apagar la pantalla** — es normal. Reejecutar
`adb reverse tcp:8000 tcp:8000` al volver.