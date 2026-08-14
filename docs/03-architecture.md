---
title: Arquitectura
---

# Arquitectura

## Diagrama lógico

```
Browser / PWA Ionic (Angular 17)
    │  offline: sql.js → IndexedDB
    │  online + sesión: Neon JS client
    ▼
Same-origin  /__neon-auth/*  y  /__neon-data/*
    │  (Netlify reverse proxy)
    ▼
Neon Auth  +  Neon Data API  ──►  Postgres (proyecto icy-silence-71895789)
```

## Capas

1. **Cliente** — Tabs Ionic: Despensa, Lista, Urgente. Settings (FAB) y Auth fuera de la tab bar. Servicios: `DataService`, `SqliteService`, `NeonService`, `CloudSyncService`, `AppModeService`.
2. **Offline** — SQLite en memoria (`sql.js`); tras cada write se exporta el fichero a IndexedDB (`listacompra.sqlite`). Ver `docs/SQLITE.md`.
3. **Nube** — `@neondatabase/neon-js`: Auth email/password y Data API de productos + settings. No hay Nest propio.
4. **Deploy** — Netlify sirve `www/` y reescribe `/__neon-*` al host Neon.

## Flujo de estado

1. `SqliteService.open()` restaura el DB file.
2. `DataService` carga `products` y `basicMode` en signals.
3. Un `effect` persiste cada cambio y dispara `syncCallback` si hay sesión.
4. Las tabs leen `dataService.products()` y filtran (pendiente / urgente / categoría).
