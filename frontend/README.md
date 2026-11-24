# SaludBarcelona

Frontend público del Instituto de Salud Municipal de Barcelona. Permite consultar la red de
centros y sus especialidades, registrarse, iniciar sesión y gestionar citas médicas.

Es un proyecto **independiente**: solo contiene el frontend. La API vive en otro despliegue y
se configura con `VITE_API_URL`.

## Stack

- React 19 + React Router 7 (rutas `/` y `/paciente`)
- Vite 8 + Tailwind CSS 4 + Material UI 9
- Oxlint

## Requisitos

- Node.js **22.12 o superior** (lo exige Vite 8; está declarado en `engines`).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
```

El backend del portal debe estar corriendo en **http://localhost:8001**. En desarrollo Vite
proxea `/api` y `/static` hacia ese puerto, así que no hace falta CORS ni definir variables:

```bash
# desde el repositorio del backend
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

El puerto 8000 está ocupado por el sistema clínico interno, por eso el portal usa 8001.
Si tu backend escucha en otro puerto, crea un `.env.local`:

```
VITE_API_PROXY_TARGET=http://localhost:8010
```

## Variables de entorno

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `VITE_API_URL` | Producción (Vercel) | URL del backend público. Sin ella, las llamadas dan 404 en el dominio de Vercel. |
| `VITE_API_PROXY_TARGET` | Solo desarrollo | Cambia el destino del proxy (por defecto `http://localhost:8001`). |

No se usan claves de Supabase en el frontend: la sesión del paciente viaja como `Bearer` en
`localStorage` y todas las consultas pasan por el backend.

## Scripts

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción en dist/
npm run preview   # sirve el build localmente
npm run lint      # oxlint
```

## Despliegue en Vercel

1. Importa este repositorio en Vercel (framework **Vite**, sin Root Directory).
2. Añade la variable de entorno `VITE_API_URL` con la URL pública del backend.
3. Despliega. `vercel.json` ya define el build (`npm run build`), la salida (`dist`) y el
   *rewrite* SPA para que `/paciente` no dé 404 al recargar.
4. En el backend, agrega el dominio de Vercel a `CORS_ORIGINS`.

`dist/` y `node_modules/` están en `.gitignore`: Vercel los genera en cada despliegue.

## Problemas frecuentes

- **`404` en `/api/v1/...` al abrir la web desplegada** → falta `VITE_API_URL`, o el backend no
  está público. Vercel solo sirve archivos estáticos.
- **`http proxy error ... ECONNREFUSED` en la consola de Vite** → el backend del portal no está
  corriendo en `localhost:8001`. Arráncalo y recarga.
- **`/paciente` da 404 al recargar** → falta el *rewrite* de `vercel.json`.
- **Error de CORS en el navegador** → el dominio del frontend no está en `CORS_ORIGINS` del
  backend.
