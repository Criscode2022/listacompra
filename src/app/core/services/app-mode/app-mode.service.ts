import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppMode = 'offline' | 'online';

const MODE_KEY = 'app_mode_v1';
const INTENT_KEY = 'online_mode_intent_v1';

@Injectable({ providedIn: 'root' })
export class AppModeService {
  private readonly mode$ = new BehaviorSubject<AppMode>(this.readMode());

  watchMode() {
    return this.mode$.asObservable();
  }

  isOnline(): boolean {
    return this.mode$.value === 'online';
  }

  isOffline(): boolean {
    return !this.isOnline();
  }

  hasOnlineIntent(): boolean {
    return localStorage.getItem(INTENT_KEY) === 'true';
  }

  setOnlineIntent(): void {
    localStorage.setItem(INTENT_KEY, 'true');
  }

  clearOnlineIntent(): void {
    localStorage.removeItem(INTENT_KEY);
  }

  enableOnlineMode(): void {
    localStorage.setItem(MODE_KEY, 'online');
    this.clearOnlineIntent();
    this.mode$.next('online');
  }

  disableOnlineMode(): void {
    localStorage.setItem(MODE_KEY, 'offline');
    this.clearOnlineIntent();
    this.mode$.next('offline');
  }

  private readMode(): AppMode {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === 'online' ? 'online' : 'offline';
  }
}
