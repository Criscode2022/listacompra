---
title: MCP para agentes
---

# MCP para agentes

El servidor MCP deja que un agente gestione las mismas cuentas y la misma lista que la app. Una **tarea** es un producto de `public.products` (Despensa, Lista o Urgente). Un **usuario** es una cuenta de Neon Auth.

Endpoint de producción: `https://lalistadelacompra.netlify.app/mcp`.

## Autenticación

El cliente envía `Authorization: Bearer`. El token no va en la query. El orden de resolución es:

| Método | Token | Quién es |
|---|---|---|
| Secreto compartido | `MCP_BEARER_TOKEN` | Operador. Admin, sin `user_id`. Las herramientas de lista piden `user_id`. |
| Clave de API | prefijo `lc_` | El usuario dueño de la clave. Los scopes son los de la clave. |
| Access token OAuth | prefijo `ola_` | El usuario que inició sesión en `/authorize`. |
| Sesión de Neon Auth | token opaco de `neon_auth.session` (en claro o SHA-256), o el JWT de Neon Auth (`eyJ…`) firmado con `NEON_AUTH_JWKS_URL` | Ese usuario, con los scopes de su rol. El JWT caduca a los pocos minutos. |
| stdio local | sin token | El operador de la máquina. |

OAuth 2.1 usa código de autorización y PKCE S256. Hay registro dinámico de clientes, metadatos de recurso protegido y de servidor de autorización, rotación de refresh tokens y revocación. Un refresh token reutilizado revoca la familia. No hay grant `client_credentials`.

Rutas públicas, además de `POST /mcp`:

- `/.well-known/oauth-protected-resource` y `.../mcp`
- `/.well-known/oauth-authorization-server` y `.../mcp`
- `POST /register`
- `GET` y `POST /authorize`
- `POST /token`
- `POST /revoke`

Un 401 de `/mcp` incluye `WWW-Authenticate` con `resource_metadata`. La página de consentimiento está en español. La contraseña se comprueba contra el hash de Neon Auth, con el mismo scrypt que usa la app.

Scopes: `tasks:read`, `tasks:write`, `users:read`, `users:write`. Un usuario normal no recibe `users:write`. Una clave no puede tener scopes que ni el llamador ni el rol del usuario destino puedan tener.

## Herramientas

Lectura: `get_current_user`, `list_users`, `get_user`, `list_tasks`, `get_task`, `list_api_keys`.

Escritura: `create_user`, `update_user`, `set_user_password`, `create_task`, `update_task`, `set_task_checked`, `create_api_key`.

Destructivas (el agente debe confirmarlas con la persona): `ban_user`, `unban_user`, `delete_user`, `delete_task`, `revoke_api_key`.

`view` de las tareas sigue las pestañas de la app: `lista` (sin marcar y no urgente), `despensa` (no urgente), `urgente`, `all`. El nombre es la identidad del producto. Cantidad de 1 a 999. Unidades `ud`, `kg`, `g`, `l`, `ml`, `oz`, `lb`.

## Variables

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres de Neon. Solo en el servidor. El rol owner no fuerza RLS, así que el código filtra siempre por `user_id`. |
| `MCP_BEARER_TOKEN` | Secreto compartido del operador. |
| `MCP_PUBLIC_URL` | Origen público, por ejemplo `https://lalistadelacompra.netlify.app`. |
| `MCP_ALLOWED_ORIGIN` | Origen CORS del inspector. Si no está, la respuesta usa `*`. |
| `MCP_PORT` | Puerto local. Por defecto `8787`. |

## Local

```bash
npm run mcp
npm run mcp:stdio
npm run test:mcp
```

`npm run mcp` escucha en `http://127.0.0.1:8787/mcp`. stdio escribe el protocolo por stdout y los registros por stderr.

En Netlify la función está en `netlify/functions/mcp.mts`. El límite es 120 peticiones por minuto, por IP y dominio. El esquema `mcp` (clientes OAuth, códigos, tokens y claves) se crea al arrancar y ya está aplicado en Neon. Es aditivo: no toca `products` ni `neon_auth`.
