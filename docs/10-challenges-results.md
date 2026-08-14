---
title: Retos y resultados
---

# Retos y aprendizajes

## No guardar vacío al arrancar

`DataService` tiene `ready = false` hasta el primer `load()`. Sin eso, el `effect` de signals persistiría `[]` y borraría la despensa en cada refresh.

## Cookie de sesión en PWA iOS

Mismo problema que Presencia: ITP. Solución: rewrite `/__neon-*` same-origin.

## Convergencia local ↔ nube

Tras login, la nube **sustituye** lo local. Tras registro, se sube lo que ya había. Evita merges de dos despensas distintas.

## WASM de SQLite en el bundle

`sql-wasm.js` + `sql-wasm.wasm` viven en `src/assets/` para que el Service Worker y Netlify los sirvan como estáticos. Sin eso, sql.js no arranca offline.

## Resultado

PWA usable en el pasillo sin red, PDF para quien aún imprime la lista, y cuenta opcional si hay dos dispositivos en casa.
