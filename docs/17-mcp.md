---
title: MCP para agentes
---

# MCP para agentes

El servidor MCP deja que un agente gestione la lista de la compra de la persona que ha iniciado sesión. Un **ítem** es un producto de `public.products` (Despensa, Lista o Urgente).

Endpoint de producción: `https://listacompra-mcp.cristiancode.dev/mcp`.

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

Scopes: `tasks:read`, `tasks:write`, `users:read`, `users:write`. Un usuario normal no recibe `users:write`. Una clave no puede tener scopes que ni el llamador ni el rol del usuario destino puedan tener. Los identificadores de scope no cambian: las claves y las concesiones OAuth ya emitidas siguen valiendo. En la página de consentimiento se leen como la lista de la compra, no como tareas.

## Herramientas

El agente ve la lista, no la administración de cuentas. La app añade, edita, marca y borra productos, y filtra por Despensa, Lista y Urgente. `get_current_user` dice de quién es el token. No hay herramientas para crear cuentas, cambiar contraseñas, bloquear usuarios ni emitir claves: eso no está en la app.

Lectura: `get_current_user`, `list_items`, `get_item`.

Escritura: `create_item`, `update_item`, `set_item_checked`.

Destructiva (el agente debe confirmar el nombre con la persona): `delete_item`.

`view` de los ítems sigue las pestañas de la app: `lista` (sin marcar y no urgente), `despensa` (no urgente), `urgente`, `all`. El nombre es la identidad del producto. Cantidad de 1 a 999. Unidades `ud`, `kg`, `g`, `l`, `ml`, `oz`, `lb`.

## Variables

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres de Neon. Solo en el servidor. El rol owner no fuerza RLS, así que el código filtra siempre por `user_id`. |
| `MCP_BEARER_TOKEN` | Secreto compartido del operador. |
| `MCP_PUBLIC_URL` | Origen público, por ejemplo `https://listacompra-mcp.cristiancode.dev`. |
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
