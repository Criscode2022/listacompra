---
title: Testing · integración
---

# Testing · integración

No hay un runner aparte tipo Nest + Supertest: no existe API propia. La “integración” que sí se ejecuta en CI es **lint + unit + build**.

## Qué cubre el build en CI

`npm run build` compila Angular 17 a `www/`. Si un import de `sql.js`, el service worker o `environment.prod.ts` se rompe, el job falla **antes** de desplegar Netlify.

## Por qué no hay TestingModule HTTP

`CloudSyncService` y `NeonService` hablan con Neon Auth/Data. Un test HTTP real exigiría secretos y correo verificado. El contrato de persistencia se afirma en unitarios con `SqliteService` spy; el de sync se revisa a mano en la PWA live.

## Equivalente local

```bash
npm run lint
npm run test:ci
npm run build
```

Esa es la misma cadena que `.github/workflows/ci.yml`.
