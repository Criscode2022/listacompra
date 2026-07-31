import { Injectable, inject, signal } from '@angular/core';
import { DataService } from '../data-service/data.service';

export type NotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface NotificationPreferences {
  /** User wants browser notifications for this app. */
  enabled: boolean;
  /** Daily reminder when there are unchecked shopping items. */
  remindPending: boolean;
  /** Daily reminder when there are urgent products. */
  remindUrgent: boolean;
}

const PREFS_KEY = 'notification_prefs_v1';
const LAST_REMINDER_KEY = 'notification_last_reminder_v1';
const DEFAULT_ICON = 'assets/icons/icon-192-192.png';
const APP_TITLE = 'Lista de la compra';

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  remindPending: true,
  remindUrgent: true,
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly dataService = inject(DataService);

  /** Current browser permission (or unsupported). */
  readonly permission = signal<NotificationPermissionState>(
    this.readPermission(),
  );

  /** Persisted user preferences. */
  readonly preferences = signal<NotificationPreferences>(this.loadPreferences());

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): NotificationPermissionState {
    return this.readPermission();
  }

  /**
   * Request browser notification permission (must run from a user gesture).
   * Returns the resulting permission state.
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) {
      this.permission.set('unsupported');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      const state = this.normalizePermission(result);
      this.permission.set(state);
      return state;
    } catch {
      this.permission.set('denied');
      return 'denied';
    }
  }

  /**
   * Enable notifications: request permission if needed and persist prefs.
   * Returns true when notifications are effectively enabled.
   */
  async enable(partial?: Partial<NotificationPreferences>): Promise<boolean> {
    if (!this.isSupported()) {
      this.permission.set('unsupported');
      return false;
    }

    let perm = this.readPermission();
    if (perm === 'default') {
      perm = await this.requestPermission();
    }

    if (perm !== 'granted') {
      this.updatePreferences({ enabled: false, ...partial });
      return false;
    }

    this.updatePreferences({
      enabled: true,
      remindPending: partial?.remindPending ?? this.preferences().remindPending,
      remindUrgent: partial?.remindUrgent ?? this.preferences().remindUrgent,
    });
    return true;
  }

  disable(): void {
    this.updatePreferences({ enabled: false });
  }

  updatePreferences(partial: Partial<NotificationPreferences>): void {
    const next: NotificationPreferences = {
      ...this.preferences(),
      ...partial,
    };
    this.preferences.set(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Storage may be unavailable in private mode; prefs still work in-session.
    }
  }

  /**
   * Show a browser notification. Prefers the active service worker so the
   * OS can display it even when the tab is in the background.
   */
  async show(
    title: string,
    options: {
      body?: string;
      tag?: string;
      icon?: string;
      data?: Record<string, unknown>;
      requireInteraction?: boolean;
    } = {},
  ): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.readPermission() !== 'granted') return false;
    if (!this.preferences().enabled) return false;

    const payload: NotificationOptions = {
      body: options.body,
      tag: options.tag,
      icon: options.icon ?? DEFAULT_ICON,
      badge: DEFAULT_ICON,
      data: options.data,
      requireInteraction: options.requireInteraction ?? false,
      silent: false,
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, payload);
        return true;
      }
    } catch {
      // Fall through to the page Notification constructor.
    }

    try {
      const notification = new Notification(title, payload);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    } catch {
      return false;
    }
  }

  /** Sends a sample notification so the user can verify setup. */
  async sendTestNotification(): Promise<boolean> {
    if (this.readPermission() !== 'granted') return false;

    // Temporarily allow show() even if the master toggle is off (e.g. first enable).
    const wasEnabled = this.preferences().enabled;
    if (!wasEnabled) {
      this.updatePreferences({ enabled: true });
    }

    return this.show(APP_TITLE, {
      body: 'Las notificaciones están activas. Te avisaremos de tu lista y de lo urgente.',
      tag: 'test-notification',
    });
  }

  /**
   * Once per calendar day, notify about pending list / urgent products
   * according to user preferences. Safe to call on every app start.
   */
  async maybeSendDailyReminder(): Promise<void> {
    if (!this.preferences().enabled) return;
    if (this.readPermission() !== 'granted') return;
    if (this.alreadyRemindedToday()) return;

    const prefs = this.preferences();
    const products = this.dataService.products();
    const pending = products.filter((p) => !p.checked);
    const urgent = products.filter((p) => p.urgent && !p.checked);

    const messages: string[] = [];

    if (prefs.remindUrgent && urgent.length > 0) {
      const names = urgent
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ');
      const extra = urgent.length > 3 ? ` y ${urgent.length - 3} más` : '';
      messages.push(
        urgent.length === 1
          ? `Urgente: ${names}`
          : `${urgent.length} urgentes: ${names}${extra}`,
      );
    }

    if (prefs.remindPending && pending.length > 0) {
      messages.push(
        pending.length === 1
          ? 'Tienes 1 producto pendiente en la lista'
          : `Tienes ${pending.length} productos pendientes en la lista`,
      );
    }

    if (messages.length === 0) return;

    const sent = await this.show(APP_TITLE, {
      body: messages.join(' · '),
      tag: 'daily-shopping-reminder',
      data: { type: 'daily-reminder' },
    });

    if (sent) {
      this.markRemindedToday();
    }
  }

  private alreadyRemindedToday(): boolean {
    try {
      return localStorage.getItem(LAST_REMINDER_KEY) === this.todayKey();
    } catch {
      return false;
    }
  }

  private markRemindedToday(): void {
    try {
      localStorage.setItem(LAST_REMINDER_KEY, this.todayKey());
    } catch {
      // ignore
    }
  }

  private todayKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private loadPreferences(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      return {
        enabled: Boolean(parsed.enabled),
        remindPending:
          parsed.remindPending === undefined
            ? DEFAULT_PREFS.remindPending
            : Boolean(parsed.remindPending),
        remindUrgent:
          parsed.remindUrgent === undefined
            ? DEFAULT_PREFS.remindUrgent
            : Boolean(parsed.remindUrgent),
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private readPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'unsupported';
    return this.normalizePermission(Notification.permission);
  }

  private normalizePermission(
    value: NotificationPermission | string,
  ): NotificationPermissionState {
    if (value === 'granted' || value === 'denied' || value === 'default') {
      return value;
    }
    return 'default';
  }
}
