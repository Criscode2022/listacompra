---
title: Testing · visión
---

# Testing · visión

Lista de la compra tiene **47 tests en dos suites**: 36 unitarios de la app Angular (Jasmine + Karma) y 11 del servidor MCP (`node:test`). Ninguno necesita Neon: la app sustituye SQLite por un spy y el MCP trabaja con un almacén en memoria. No hay Playwright.

| Capa                                       | Runner                           | Tests | Qué cubre                                                                 | Comando             |
| ------------------------------------------ | -------------------------------- | ----- | ------------------------------------------------------------------------- | ------------------- |
| [Unitarios](./13-testing-unit.md)          | Jasmine + Karma (ChromeHeadless) | 36 en 11 specs | `DataService`, pestañas, cabecera, notificaciones, breakpoints, tokens de diseño | `npm run test:ci`   |
| [Integración](./14-testing-integration.md) | `node:test` con TypeScript nativo | 11 en 1 fichero | El servidor MCP de punta a punta: OAuth con PKCE, CORS, tokens y herramientas | `npm run test:mcp` |
| [E2E](./15-testing-e2e.md)                 | —                                | —     | No hay; el flujo de compra se revisa a mano                               | —                   |
| Lint                                       | ESLint con angular-eslint        | —     | TypeScript y plantillas                                                   | `npm run lint`      |
| Build                                      | Angular CLI                      | —     | Que la PWA compila a `www/`                                               | `npm run build`     |

Comprobado el 20 de octubre de 2026: las dos suites pasan en local.

[CI](./16-testing-ci.md) (`.github/workflows/ci.yml`) ejecuta `npm ci` → lint → `test:ci` → build con Node 20. Los tests del MCP no están en el workflow.

Siguientes documentos: [unitarios](./13-testing-unit.md) · [integración](./14-testing-integration.md) · [e2e](./15-testing-e2e.md) · [CI](./16-testing-ci.md).
