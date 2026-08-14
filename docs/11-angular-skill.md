---
title: Angular en Lista de la compra
---

# Angular en Lista de la compra

App **Angular 17.3 + Ionic 7 + TypeScript 5.4 + Zone**. Estado con **Signals** (`products`, `basicMode`, filtros de tab). No hay skill Angular versionada en este repo.

## Qué se aplica

| Práctica | Dónde |
|----------|--------|
| Signals + `effect` | `DataService` persistencia automática |
| Computed en tabs | `pendingProducts()`, `categoryCounts()`, `textFilter()` |
| Modal Ionic | `AddProductModalComponent` |
| Guards | `OnlineAuthGuard`, `GuestAuthGuard` |
| Service worker | PWA (`ngsw-config.json`) |
| Tests | Karma + Jasmine (`npm run test:ci`) |

## Techo de esta era

Ionic 7 + Angular 17: Zone obligatorio, sin Signal Forms de v21+. Los formularios del modal son `ngModel`. Subir a Angular 21/22 exigiría alinear Ionic (ver techo v22×Ionic en Task Cloud / Presencia).
