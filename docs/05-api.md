---
title: Superficie API Neon
---

# Superficie API (Neon Auth + Data)

No hay Nest propio. El cliente habla con Neon a través de `@neondatabase/neon-js`.

## En producción (same-origin)

| Prefijo | Destino (Netlify rewrite 200) |
|---------|-------------------------------|
| `/__neon-auth/*` | Neon Auth (`*.neonauth.*.aws.neon.tech/neondb/auth`) |
| `/__neon-data/*` | Neon Data API REST v1 (`*.apirest.*.aws.neon.tech/neondb/rest/v1`) |

`environment.prod.ts` usa `neonAuthUrl: '/__neon-auth'` y `neonDataApiUrl: '/__neon-data'`. Proyecto Neon: `icy-silence-71895789`.

## En desarrollo

`environment.ts` apunta a las URLs absolutas de Neon (sin proxy).

## Operaciones de producto

`CloudSyncService` sube y baja:

- Filas de `products` (nombre, checked, quantity, urgent, unit, category) por `user_id`
- Settings (`basic_mode`)

Tras registro se sube lo local. Tras login, la nube **reemplaza** lo del dispositivo.
