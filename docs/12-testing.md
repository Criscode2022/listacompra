---
title: Testing · visión
---

# Testing · visión

Lista de la compra tiene **unitarios** (Jasmine + Karma) y un job de **GitHub Actions**. No hay Playwright e2e: la persistencia real se cubre en unitarios de `DataService` con `SqliteService` mockeado, y CI también **construye** la PWA.

| Capa | Runner | Qué cubre | Comando |
|------|--------|-----------|---------|
| Unitario | Jasmine + Karma (ChromeHeadless) | DataService, tabs, header, notificaciones, tokens | `npm run test:ci` |
| Lint | ESLint Angular | TS + templates | `npm run lint` |
| Build | Angular CLI | `www/` | `npm run build` |

CI (`.github/workflows/ci.yml`): `npm ci` → lint → `test:ci` → `build`. Node 20. Sin Neon en Actions.

Siguientes documentos: [unitarios](./13-testing-unit.md) · [integración](./14-testing-integration.md) · [e2e](./15-testing-e2e.md) · [CI](./16-testing-ci.md).
