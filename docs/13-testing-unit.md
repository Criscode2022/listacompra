---
title: Testing · unitarios
---

# Testing · unitarios

Runner: `npm run test:ci` (Karma con ChromeHeadless, una sola pasada). **36 tests en 11 specs**, en unos 0,1 segundos de ejecución.

| Spec                                    | Tests | Qué fija                                                                                       |
| --------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `notification.service.spec.ts`          | 9     | Permisos, preferencias y el recordatorio diario                                                |
| `tabs.page.spec.ts`                     | 7     | Barra de pestañas, barra lateral de escritorio y el panel de ajustes (hoja en móvil, diálogo en escritorio) |
| `data.service.spec.ts`                  | 5     | Cargar, marcar, borrar y vaciar productos                                                      |
| `header.component.spec.ts`              | 5     | Clases del cristal, tinte de urgente, acción principal y botón de vaciar                       |
| `liquid-glass.tokens.spec.ts`           | 3     | Que las variables CSS del diseño existen tras cargar el tema                                   |
| `breakpoints.spec.ts`                   | 2     | El corte de escritorio en 1200 px                                                              |
| `app.component`, `stop-propagation`, `tab-list`, `tab-pantry`, `tab-urgent` | 1 cada uno | Que se crean |

## DataService

`SqliteService` se sustituye por un spy. Así se fija el contrato de los signals **sin** cargar el WASM de sql.js.

```ts
it('loads products from SQLite on start', async () => {
  sqlite.getProducts.and.returnValue([
    { name: 'Leche', checked: false, quantity: 2, urgent: false, unit: 'ud', category: 'lácteos' },
  ]);
  const service = TestBed.inject(DataService);
  await service.whenReady();
  expect(service.products()[0].name).toBe('Leche');
});

it('toggles checked status and resets quantity when checked', async () => {
  await service.toggleStatus('Pan');
  expect(service.products()[0].checked).toBeTrue();
  expect(service.products()[0].quantity).toBe(1);
});
```

También se fija el borrado por nombre y `clearStorage()`, que llama a `sqlite.clearAll()` y deja `products` vacío.

`whenReady()` es obligatorio: el constructor carga de forma asíncrona (`void this.load()`) y sin esperar el test leería `[]`.

## Notificaciones

`NotificationService` se prueba con un `Notification` falso en `window` cuyo `requestPermission` es un spy. Los casos cubren que activar pide permiso y guarda la preferencia solo si se concede, que desactivar apaga la preferencia general, que `show()` devuelve `false` si las notificaciones no están activadas, y que el recordatorio diario avisa una vez al día cuando hay productos urgentes o pendientes, y no avisa cuando no hay nada.

## Pestañas y cabecera

Los specs de `TabsPage` y `HeaderComponent` comprueban lo que se pinta: la barra con efecto cristal, la barra lateral con los tres destinos en escritorio, que en la pestaña de urgentes el carril de compra se oculta a partir de 1200 px, y que el panel de ajustes se abre como hoja en móvil y como diálogo centrado en escritorio.
