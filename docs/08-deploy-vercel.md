---
title: Deploy Netlify
---

# Deploy en Netlify

## Idea

- Build Angular → `www/`
- Catch-all SPA: `/*` → `/index.html` 200
- Proxy Neon **antes** del catch-all

## Config (`netlify.toml`)

```toml
[build]
  publish = "www"
  command = "npm run build"

[[redirects]]
  from = "/__neon-auth/*"
  to = "https://<host>.neonauth.../neondb/auth/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/__neon-data/*"
  to = "https://<host>.apirest.../neondb/rest/v1/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Live: [lalistadelacompra.netlify.app](https://lalistadelacompra.netlify.app/).

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```

`webDir` de Capacitor apunta a `www/`.
