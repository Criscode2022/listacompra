import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { Product } from '../../types/product';
import { DataService } from './data.service';

describe('DataService', () => {
  let storage: {
    get: jasmine.Spy;
    set: jasmine.Spy;
    clear: jasmine.Spy;
  };
  let storageFactory: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    storage = {
      get: jasmine.createSpy('get').and.resolveTo(null),
      set: jasmine.createSpy('set').and.resolveTo(undefined),
      clear: jasmine.createSpy('clear').and.resolveTo(undefined),
    };

    storageFactory = jasmine.createSpyObj<Storage>('Storage', ['create']);
    storageFactory.create.and.resolveTo(storage as unknown as Storage);

    TestBed.configureTestingModule({
      providers: [DataService, { provide: Storage, useValue: storageFactory }],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(DataService);
    expect(service).toBeTruthy();
  });

  it('loads products from storage and migrates legacy fields', async () => {
    const legacyProducts = [
      {
        name: 'Leche',
        checked: false,
        quantity: 2,
        urgent: false,
      },
    ];
    storage.get.and.resolveTo(legacyProducts);

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

    expect(service.products()).toEqual([
      {
        name: 'Leche',
        checked: false,
        quantity: 2,
        urgent: false,
        unit: 'l',
        category: 'lácteos',
      },
    ]);
  });

  it('clears persisted data and resets products', async () => {
    const service = TestBed.inject(DataService);
    await service.initStorage();

    const seeded: Product[] = [
      {
        name: 'Huevos',
        checked: false,
        quantity: 12,
        urgent: false,
        unit: 'ud',
        category: 'otros',
      },
    ];
    service.products.set(seeded);

    await service.clearStorage();

    expect(storage.clear).toHaveBeenCalled();
    expect(service.products()).toEqual([]);
  });

  it('stores products using ionic storage', async () => {
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

    service.storeData(products);

    expect(storage.set).toHaveBeenCalledWith('products', products);
  });
});
