---
title: Estructura del proyecto
---

# Estructura (app única)

Lista de la compra **no** es un monorepo Turborepo: un solo paquete Angular/Ionic.

| Path | Rol |
|------|-----|
| `src/app/tabs/tab-pantry` | Tab Despensa |
| `src/app/tabs/tab-list` | Tab Lista + PDF |
| `src/app/tabs/tab-urgent` | Tab Urgente |
| `src/app/layout/add-product-modal` | Alta de producto |
| `src/app/layout/header` | Cabecera compartida |
| `src/app/settings` | Ajustes |
| `src/app/auth` | Sign-in / sign-up |
| `src/app/core/services/data-service` | Signals + persistencia |
| `src/app/core/services/sqlite` | sql.js + IndexedDB |
| `src/app/core/services/neon` | Cliente Auth/Data |
| `src/app/core/services/cloud-sync` | Push/pull |
| `src/assets/sql-wasm.*` | Runtime SQLite WASM |
| `docs/SQLITE.md` | Cómo se guarda el `.sqlite` |
| `netlify.toml` | Build + proxy Neon + SPA |
