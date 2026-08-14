---
title: Testing · e2e
---

# Testing · e2e

Este repo **no** incluye Playwright. El flujo de compra (alta → checkbox → PDF) se valida a mano en [lalistadelacompra.netlify.app](https://lalistadelacompra.netlify.app/) y con los unitarios de `DataService`.

## Por qué no está en CI

- La persistencia crítica (load / toggle / delete / clear) ya está en Karma.
- Un e2e de sql.js + modal Ionic + PDF añade flakiness (WASM, overlays) sin un contrato HTTP que afirmar.
- Presencia y Task Cloud sí tienen Playwright porque su UI (asistencia / tareas) es el producto que se enseña en el portfolio con un catálogo de casos.

## Si se añade más adelante

Un primer spec razonable sería:

1. Abrir `/despensa`.
2. FAB → modal → nombre `Leche` → Añadir.
3. Ir a `/lista` y afirmar `.product-name` = Leche.
4. Checkbox → el ítem desaparece de pendientes.

Hasta entonces, CI verde = lint + unit + build.
