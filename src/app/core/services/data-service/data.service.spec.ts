import { TestBed } from '@angular/core/testing';
import { SqliteService } from '../sqlite/sqlite.service';
import { DataService } from './data.service';

describe('DataService', () => {
  let sqlite: jasmine.SpyObj<SqliteService>;

  beforeEach(() => {
    sqlite = jasmine.createSpyObj<SqliteService>('SqliteService', [
      'open',
      'getProducts',
      'setProducts',
      'getBasicMode',
      'setBasicMode',
      'clearAll',
    ]);
    sqlite.open.and.resolveTo(undefined);
    sqlite.getProducts.and.returnValue([]);
    sqlite.getBasicMode.and.returnValue(false);
    sqlite.setProducts.and.resolveTo(undefined);
    sqlite.setBasicMode.and.resolveTo(undefined);
    sqlite.clearAll.and.resolveTo(undefined);

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

  it('loads products from SQLite on start', async () => {
    sqlite.getProducts.and.returnValue([
      {
        name: 'Leche',
        checked: false,
        quantity: 2,
        urgent: false,
        unit: 'ud',
        category: 'lácteos',
      },
    ]);

    const service = TestBed.inject(DataService);
    await service.whenReady();

    expect(service.products()[0].name).toBe('Leche');
  });

  it('toggles checked status and resets quantity when checked', async () => {
    const service = TestBed.inject(DataService);
    await service.whenReady();

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
    await service.whenReady();

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

  it('clears all data', async () => {
    const service = TestBed.inject(DataService);
    await service.whenReady();

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

    expect(sqlite.clearAll).toHaveBeenCalled();
    expect(service.products()).toEqual([]);
  });
});
