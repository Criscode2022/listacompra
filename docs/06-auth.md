---
title: Autenticación email + Neon
---

# Modelo de autenticación

## Flujo

1. En Ajustes, el usuario activa modo online → `/auth`.
2. Crea cuenta (nombre, email, contraseña) o inicia sesión.
3. Neon Auth (`client.auth.signUp.email` / `signIn.email`).
4. Verificación de email **antes** de poder entrar.
5. `getSession()` calienta la caché. `OnlineAuthGuard` deja pasar si el modo es offline.
6. Logout: `signOut()`. El SQLite local se conserva.

## Guards

- `OnlineAuthGuard` — si `isOnline()` y no hay sesión → `/auth`.
- `GuestAuthGuard` — si ya hay sesión, saca al usuario de `/auth`.

## Seguridad

- Contraseña y tokens los gestiona Neon Auth.
- Proxy same-origin para no perder la sesión por ITP.
- Cloud sync **opt-in**.
