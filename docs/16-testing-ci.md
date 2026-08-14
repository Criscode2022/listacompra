---
title: Testing · GitHub Actions
---

# Testing · GitHub Actions

Workflow: `.github/workflows/ci.yml`. Push y PR a `main`. Un solo job, `cancel-in-progress`.

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm
- name: Install dependencies
  run: npm ci
- name: Run lint
  run: npm run lint
- name: Run tests (headless)
  run: npm run test:ci
- name: Build application
  run: npm run build
```

`test:ci` es `ng test --watch=false --browsers=ChromeHeadless`. Ubuntu Latest trae Chrome.

## Por qué no hay errores de entorno

| Riesgo | Mitigación |
|--------|------------|
| Neon no está en Actions | Unitarios mockean `SqliteService`; no se llama a Auth |
| sql.js WASM | Los tests no abren SQLite real |
| Lockfile | `npm ci` |
| Build rota el PWA | El job incluye `npm run build` |

Badge en el README: `CI` → ese workflow.
