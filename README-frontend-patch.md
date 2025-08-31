# Frontend Patch (React/Vercel)

Este patch **no toca tu UI**. Solo agrega/centraliza la capa de datos para que nada se borre al refrescar.

## Archivos incluidos
- `src/api.js` → cliente Axios apuntando a tu API (con `withCredentials` para cookie httpOnly).
- `src/services/auth.js` → login/logout/me.
- `src/services/leads.js` → CRUD de leads.

## Cómo integrar
1) En Vercel, definí la env `REACT_APP_API_URL` con la URL pública de tu API (ej: `https://api.tu-dominio.com/api`). Redeploy.
2) Copiá estos archivos dentro de tu repo del frontend, respetando rutas:
   - `src/api.js`
   - `src/services/auth.js`
   - `src/services/leads.js`
3) En tus componentes, reemplazá llamadas locales por los servicios. Ejemplo:
   ```js
   import { listLeads, createLead } from './services/leads';
   useEffect(() => { listLeads().then(setLeads); }, []);
   ```
4) Si usás cookie httpOnly (recomendado), no guardes token. Si preferís Bearer, descomentá el interceptor en `api.js` y guardá `ALLUMA_TOKEN` al loguear.
5) CORS en el backend debe incluir tu dominio de Vercel (variable `CORS_ORIGIN`).

Listo: toda la memoria queda en MySQL a través del backend.
