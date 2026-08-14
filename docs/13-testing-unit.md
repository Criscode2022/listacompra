---
title: Testing · unitarios
---

# Testing · unitarios

Runner: `npm run test:ci` (ChromeHeadless, un solo run). Specs en `*.spec.ts`.

## DataService (`src/app/core/services/data-service/data.service.spec.ts`)

`SqliteService` se sustituye por un spy. Así se afirma el contrato de signals **sin** WASM.

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

También se afirma `delete` por nombre y `clearStorage()` (llama a `sqlite.clearAll()` y deja `products` vacío).

`whenReady()` es obligatorio: el constructor es async (`void this.load()`). Sin await, el test leería `[]`.

## Otras piezas

- Tabs (`tab-list`, `tab-pantry`, `tab-urgent`, `tabs.page`) — creación del componente.
- `HeaderComponent`, `AppComponent`, directiva `stop-propagation`.
- `NotificationService` y tokens de liquid-glass (`src/theme/liquid-glass.tokens.spec.ts`).
