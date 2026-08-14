---
title: Producto y features
---

# Producto y features

## Problema

Las listas del súper viven en notas, WhatsApp o papel. Se pierden las cantidades, no hay urgentes separados, y al llegar a la tienda no hay un PDF imprimible agrupado por pasillo. Las apps de recetas o de supermercado piden cuenta desde el primer tap.

## Solución

PWA instalable con tres tabs: **Despensa** (inventario), **Lista** (pendientes + PDF) y **Urgente**. Offline-first en SQLite. Sync opt-in con Neon Auth (email verificado) y Data API.

## Características

### Despensa
Inventario completo. FAB abre el modal de alta (nombre, cantidad, unidad, categoría). Checkbox marca comprado.

### Lista
Solo productos pendientes. Chips de categoría con contador, búsqueda, checkbox y **exportar PDF** (jsPDF, agrupado por categoría, con fecha).

### Urgente
Misma mecánica, filtrada a `urgent: true`. FAB rojo para crear ya marcado como urgente.

### Categorías y unidades
Once categorías (frutas, verduras, carnes, pescados, lácteos, panadería, bebidas, limpieza, higiene, congelados, otros) y unidades `ud | kg | g | l | ml | oz | lb`.

### Ajustes
Modo básico (oculta categoría), modo online/offline, cuenta Neon, vaciar almacenamiento.

### Offline-first
Sin red se puede crear, tachar y exportar. La nube es continuidad entre dispositivos.

### Android
Capacitor 5 (`npx cap sync android`) sobre el mismo `www/`.
