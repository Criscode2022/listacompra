import { TestBed } from '@angular/core/testing';
import { Product } from '../../types/product';
import { SqliteService } from '../sqlite/sqlite.service';
import { DataService } from './data.service';

describe('DataService', () => {
  let sqlite: {
    initialize: jasmine.Spy;
    query: jasmine.Spy;
    run: jasmine.Spy;
    execute: jasmine.Spy;
    executeSet: jasmine.Spy;
    save: jasmine.Spy;
  };

  beforeEach(() => {
    sqlite = {
      initialize: jasmine.createSpy('initialize').and.resolveTo(undefined),
      query: jasmine.createSpy('query').and.resolveTo([]),
      run: jasmine.createSpy('run').and.resolveTo(undefined),
      execute: jasmine.createSpy('execute').and.resolveTo(undefined),
      executeSet: jasmine.createSpy('executeSet').and.resolveTo(undefined),
      save: jasmine.createSpy('save').and.resolveTo(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        DataService,
        { provide: SqliteService, useValue: sqlite },
      ],
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(DataService)).toBeTruthy();
  });

  it('loads products from SQLite with defaults for missing fields', async () => {
    sqlite.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM products')) {
        return [
          {
            name: 'Leche',
            checked: 0,
            quantity: 2,
            urgent: 0,
            unit: '',
            category: '',
          },
        ];
      }
      return [];
    });

    const service = TestBed.inject(DataService);
    await service.initStorage();

    expect(service.products()).toEqual([
      {
        name: 'Leche',
        checked: false,
        quantity: 2,
        urgent: false,
        unit: 'ud',
        category: 'otros',
      },
    ]);
  });

  it('toggles checked status and resets quantity when checked', async () => {
    const service = TestBed.inject(DataService);
    await service.initStorage();

    service.products.set([
      {
        name: 'Pan',
        checked: false,
        quantity: 4,
        urgent: false,
        unit: 'ud',
        category: 'panadería',
      },
    ]);

    await service.toggleStatus('Pan');

    expect(service.products()[0]).toEqual({
      name: 'Pan',
      checked: true,
      quantity: 1,
      urgent: false,
      unit: 'ud',
      category: 'panadería',
    });
  });

  it('deletes a product by name', async () => {
    const service = TestBed.inject(DataService);
    await service.initStorage();

    service.products.set([
      {
        name: 'Pan',
        checked: false,
        quantity: 1,
        urgent: false,
        unit: 'ud',
        category: 'panadería',
      },
      {
        name: 'Leche',
        checked: false,
        quantity: 2,
        urgent: false,
        unit: 'l',
        category: 'lácteos',
      },
    ]);

    await service.delete('Pan');

    expect(service.products().map((p) => p.name)).toEqual(['Leche']);
  });

  it('clears products and settings', async () => {
    const service = TestBed.inject(DataService);
    await service.initStorage();

    service.products.set([
      {
        name: 'Huevos',
        checked: false,
        quantity: 12,
        urgent: false,
        unit: 'ud',
        category: 'otros',
      },
    ]);

    await service.clearStorage();

    expect(sqlite.execute).toHaveBeenCalledWith('DELETE FROM products');
    expect(sqlite.execute).toHaveBeenCalledWith('DELETE FROM app_settings');
    expect(service.products()).toEqual([]);
  });

  it('stores products with executeSet', async () => {
    const service = TestBed.inject(DataService);
    await service.initStorage();

    const products: Product[] = [
      {
        name: 'Agua',
        checked: false,
        quantity: 6,
        urgent: false,
        unit: 'l',
        category: 'bebidas',
      },
    ];

    await service.storeData(products);

    expect(sqlite.executeSet).toHaveBeenCalled();
    const setArg = sqlite.executeSet.calls.mostRecent().args[0] as Array<{
      statement: string;
      values: unknown[];
    }>;
    expect(setArg[0].statement).toContain('DELETE FROM products');
    expect(setArg[1].values).toEqual(['Agua', 0, 6, 0, 'l', 'bebidas']);
    expect(sqlite.save).toHaveBeenCalled();
  });
});
