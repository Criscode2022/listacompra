---
title: Modelo de datos
---

# Modelo de datos

## Offline (SQLite / sql.js)

Tablas en el fichero `listacompra.sqlite` (IndexedDB):

| Tabla | Contenido |
|-------|-----------|
| `products` | `name`, `checked`, `quantity`, `urgent`, `unit`, `category` |
| `app_settings` | clave/valor (`basicMode`) |

## Tipo (`src/app/core/types/product.ts`)

```ts
interface Product {
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  unit: MeasureUnit;       // ud | kg | g | l | ml | oz | lb
  category: ProductCategory;
}
```

`ProductCategory`: frutas, verduras, carnes, pescados, lácteos, panadería, bebidas, limpieza, higiene, congelados, otros.

La clave de producto en UI es el **nombre** (`toggleStatus(productName)`, `delete(productName)`).

## Nube

Mismas columnas + `user_id`. Settings: `basic_mode`.
