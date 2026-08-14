---
title: Decisiones de producto y tech
---

# Decisiones

## SQLite en el navegador, no JSON suelto

`sql.js` da tablas y queries reales (`ORDER BY name COLLATE NOCASE`) y un único fichero exportable. Ionic Storage se usó al principio; el servicio actual persiste el `.sqlite` en IndexedDB.

## Neon Auth/Data en lugar de Nest propio

El contrato (email, sesión, filas por usuario) cabe en Neon. Un segundo servicio no aportaba ownership custom como el PIN de Task Cloud.

## Proxy Netlify same-origin

Sin proxy, la cookie de Auth es third-party y iOS/PWA la tiran.

## Tres tabs, no una lista infinita

Despensa / Lista / Urgente es el modelo mental del súper: lo que hay, lo que falta, lo que no puede esperar. El PDF sale de la Lista (pendientes), no de la despensa.

## Signals + `effect` para persistir

Cada mutación actualiza `products`; el effect escribe SQLite y agenda sync. Evita `save()` manual en cada tap.
