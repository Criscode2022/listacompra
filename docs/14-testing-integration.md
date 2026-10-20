---
title: Testing · integración
---

# Testing · integración

La app no tiene API propia: habla con Neon Auth y la Data API. El código de servidor del repo es el **servidor MCP** (`netlify/mcp/`, ver [MCP para agentes](./17-mcp.md)), y sus 11 tests lo ejercitan de punta a punta.

```bash
npm run test:mcp   # node --experimental-strip-types --test netlify/mcp/mcp.test.mts
```

## Cómo están montados

Los tests llaman a `handleHttp()`, el mismo manejador que sirve la función de Netlify, con objetos `Request` de verdad. La base de datos se sustituye por `MemoryStore`, que implementa la misma interfaz que el almacén de Neon, y las contraseñas se comprueban contra un hash generado con `@better-auth/utils`, el mismo formato que usa Neon Auth. No hay red ni secretos.

## Qué cubren

| Test                                                         | Qué fija                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| PKCE, redirects, resources, and HTML escaping                | Verificación PKCE, redirecciones permitidas, el recurso `/mcp` y el escapado de la página de consentimiento |
| missing DATABASE_URL returns 500 without a secret            | Sin base de datos responde 500 sin filtrar la cadena de conexión                            |
| unauthenticated and wrong-length bearer requests…            | Un 401 anuncia los metadatos del recurso en `WWW-Authenticate`                              |
| MCP methods and CORS preflight                               | Métodos permitidos y la respuesta a `OPTIONS`                                               |
| MCP_ALLOWED_ORIGIN replaces the wildcard                     | El origen configurado sustituye a `*`                                                       |
| initialize and task tools honor shopping-list rules          | Las herramientas de tareas respetan las reglas de la lista                                  |
| a normal user cannot list other accounts                     | Solo el operador ve otras cuentas                                                           |
| Neon session tokens and unknown passwords                    | Tokens de sesión de Neon y contraseñas que no existen                                       |
| OAuth authorization code, PKCE, refresh reuse, and tool calls | El flujo OAuth completo, incluido reutilizar un refresh token, y llamadas a herramientas    |
| a bad PKCE verifier burns the authorization code             | Un verificador incorrecto invalida el código                                                |
| registration rejects a non-local http redirect               | El registro de clientes rechaza redirecciones `http` que no son locales                     |

## Lo que no tiene integración

La sincronización de la app con Neon (`CloudSyncService`, `NeonService`) no tiene tests: un test real exigiría secretos y un correo verificado. La persistencia local se fija en los unitarios con el spy de `SqliteService`; la sincronización se revisa a mano en la PWA.

## En CI

El workflow ejecuta lint, unitarios y build, pero no `test:mcp`. Hasta que se añada, estos 11 tests solo corren en local.
