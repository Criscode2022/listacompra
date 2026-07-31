import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Product } from '../../types/product';
import { DataService } from '../data-service/data.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let productsSignal: ReturnType<typeof signal<Product[]>>;
  let originalNotification: typeof Notification | undefined;
  let requestPermissionSpy: jasmine.Spy;

  const sampleProducts: Product[] = [
    {
      name: 'Leche',
      checked: false,
      quantity: 1,
      urgent: true,
      unit: 'ud',
      category: 'lácteos',
    },
    {
      name: 'Pan',
      checked: false,
      quantity: 1,
      urgent: false,
      unit: 'ud',
      category: 'panadería',
    },
    {
      name: 'Huevos',
      checked: true,
      quantity: 1,
      urgent: false,
      unit: 'ud',
      category: 'otros',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    productsSignal = signal<Product[]>([]);

    originalNotification = (window as unknown as { Notification?: typeof Notification })
      .Notification;

    requestPermissionSpy = jasmine
      .createSpy('requestPermission')
      .and.callFake(async () => {
        const result = 'granted' as NotificationPermission;
        (
          window as unknown as {
            Notification: { permission: NotificationPermission };
          }
        ).Notification.permission = result;
        return result;
      });

    class MockNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = requestPermissionSpy;
      onclick: ((this: Notification, ev: Event) => unknown) | null = null;
      close = jasmine.createSpy('close');
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {}
    }

    (window as unknown as { Notification: unknown }).Notification =
      MockNotification;

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        {
          provide: DataService,
          useValue: { products: productsSignal },
        },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    localStorage.clear();
    if (originalNotification) {
      (window as unknown as { Notification: typeof Notification }).Notification =
        originalNotification;
    } else {
      delete (window as unknown as { Notification?: typeof Notification })
        .Notification;
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reports support when Notification exists', () => {
    expect(service.isSupported()).toBeTrue();
  });

  it('enable requests permission and persists prefs when granted', async () => {
    const ok = await service.enable();
    expect(ok).toBeTrue();
    expect(requestPermissionSpy).toHaveBeenCalled();
    expect(service.preferences().enabled).toBeTrue();
    expect(service.permission()).toBe('granted');
    expect(JSON.parse(localStorage.getItem('notification_prefs_v1')!)).toEqual(
      jasmine.objectContaining({ enabled: true }),
    );
  });

  it('enable fails when permission is denied', async () => {
    requestPermissionSpy.and.callFake(async () => {
      (
        window as unknown as {
          Notification: { permission: NotificationPermission };
        }
      ).Notification.permission = 'denied';
      return 'denied' as NotificationPermission;
    });
    (
      window as unknown as { Notification: { permission: NotificationPermission } }
    ).Notification.permission = 'default';

    const ok = await service.enable();
    expect(ok).toBeFalse();
    expect(service.preferences().enabled).toBeFalse();
  });

  it('disable turns off the master preference', () => {
    service.updatePreferences({ enabled: true });
    service.disable();
    expect(service.preferences().enabled).toBeFalse();
  });

  it('show returns false when not enabled', async () => {
    (
      window as unknown as { Notification: { permission: NotificationPermission } }
    ).Notification.permission = 'granted';
    service.permission.set('granted');
    service.updatePreferences({ enabled: false });

    const ok = await service.show('Test', { body: 'hola' });
    expect(ok).toBeFalse();
  });

  it('show creates a Notification when enabled and granted', async () => {
    (
      window as unknown as { Notification: { permission: NotificationPermission } }
    ).Notification.permission = 'granted';
    service.permission.set('granted');
    service.updatePreferences({ enabled: true });

    // Force the page Notification path (skip SW if present).
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });

    const ok = await service.show('Lista', { body: 'Pendientes' });
    expect(ok).toBeTrue();
  });

  it('maybeSendDailyReminder notifies once per day for urgent and pending', async () => {
    (
      window as unknown as { Notification: { permission: NotificationPermission } }
    ).Notification.permission = 'granted';
    service.permission.set('granted');
    service.updatePreferences({
      enabled: true,
      remindPending: true,
      remindUrgent: true,
    });
    productsSignal.set(sampleProducts);

    const showSpy = spyOn(service, 'show').and.resolveTo(true);

    await service.maybeSendDailyReminder();
    expect(showSpy).toHaveBeenCalledTimes(1);
    const body = showSpy.calls.mostRecent().args[1]?.body as string;
    expect(body).toContain('Urgente');
    expect(body).toContain('pendientes');

    // Second call same day should not notify again.
    await service.maybeSendDailyReminder();
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it('maybeSendDailyReminder skips when nothing to remind', async () => {
    (
      window as unknown as { Notification: { permission: NotificationPermission } }
    ).Notification.permission = 'granted';
    service.permission.set('granted');
    service.updatePreferences({ enabled: true });
    productsSignal.set([
      {
        name: 'Hecho',
        checked: true,
        quantity: 1,
        urgent: false,
        unit: 'ud',
        category: 'otros',
      },
    ]);

    const showSpy = spyOn(service, 'show').and.resolveTo(true);
    await service.maybeSendDailyReminder();
    expect(showSpy).not.toHaveBeenCalled();
  });
});
