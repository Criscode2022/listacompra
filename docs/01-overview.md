---
title: Visión general
---

# Visión general · Lista de la compra

**Lista de la compra** (repo `listacompra`) es una Progressive Web App de lista de supermercado: despensa, lista pendiente y urgente. Funciona **offline** con SQLite en el navegador (`sql.js` + IndexedDB) y, si el usuario abre sesión, sincroniza a **Neon Auth + Data API**.

Es **una sola app Angular/Ionic** (no monorepo Nest). En producción Netlify sirve `www/` y hace proxy same-origin de `/__neon-auth/*` y `/__neon-data/*` para que la cookie sea first-party (iOS Safari / PWA).

## Enlaces

- **Web:** [https://lalistadelacompra.netlify.app](https://lalistadelacompra.netlify.app/)
- **GitHub:** [Criscode2022/listacompra](https://github.com/Criscode2022/listacompra)
- **CI:** [GitHub Actions `ci.yml`](https://github.com/Criscode2022/listacompra/actions/workflows/ci.yml)

## Stack

| Capa | Tecnología |
|------|------------|
| Web | Angular 17.3, Ionic 7, Capacitor 5, Tailwind 3, Signals |
| Offline | sql.js (SQLite WASM) persistido en IndexedDB (`listacompra.sqlite`) |
| Nube | Neon Auth + Neon Data API (`@neondatabase/neon-js`) |
| Extra | jsPDF (export de la lista), Material snackbars |
| Deploy | Netlify (`www/` + SPA rewrite + proxy `/__neon-*`) |
