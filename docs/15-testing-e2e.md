---
title: Testing · e2e
---

# Testing · e2e

Este repo **no** incluye Playwright. Los recorridos de la app los cubren 9 flujos de [Maestro](https://maestro.dev) en `.maestro/`, que usan la lista en Chromium como una persona, en local.

| Flujo | Comprueba |
|-------|-----------|
| `smoke.yaml` | La app abre en Lista y cada pestaña muestra su estado vacío |
| `add-product-form.yaml` | El diálogo no guarda un nombre vacío, corta a 30 caracteres, cancela sin guardar, guarda con Enter y rechaza un duplicado sin mirar mayúsculas |
| `restock-cycle.yaml` | El ciclo de un producto: entra en la Despensa, pasa a la Lista, se compra y vuelve a la Lista con la cantidad a 1 |
| `edit-quantity.yaml` | La cantidad se edita desde su etiqueta; 0 se rechaza |
| `urgent.yaml` | Los urgentes viven solo en Urgente, no admiten duplicados y desaparecen al marcarlos |
| `search-and-filter.yaml` | Chips de categoría y buscador, solos y juntos, en la Despensa y en la Lista |
| `basic-mode.yaml` | El modo básico oculta categorías y filtros, y sobrevive a una recarga |
| `delete-products.yaml` | Un clic en ✕ no borra; "Eliminar todos los productos" pide confirmación y vacía todas las pestañas |
| `persistence.yaml` | Una recarga conserva productos, cantidades, comprados y urgentes (SQLite en IndexedDB) |

```bash
npm start                # en :4200
maestro test .maestro/   # los 9 flujos
```

Borrar un solo producto pide doble clic en su ✕, y el driver web de Maestro manda un doble toque como dos clics sueltos, que nunca disparan `dblclick`: ese camino no está cubierto.

Los agentes tienen además el servidor MCP de Maestro (`maestro` en `.mcp.json`), que arranca `scripts/maestro-mcp.mjs`: inspecciona la pantalla, corre un flujo y ayuda a escribir los nuevos. El script busca Java y el CLI, porque Maestro no arranca sin `JAVA_HOME`.

## Por qué no está en CI

- La persistencia crítica (load / toggle / delete / clear) ya está en Karma.
- Los flujos necesitan el servidor de desarrollo y Chromium, y tardan unos 8 minutos; Maestro web sigue en beta.

Comprobado el 18 de noviembre de 2026: los 9 flujos pasan en local. CI verde = lint + unit + build.
