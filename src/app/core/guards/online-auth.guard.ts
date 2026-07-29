import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AppModeService } from '../services/app-mode/app-mode.service';
import { NeonService } from '../services/neon/neon.service';

@Injectable({ providedIn: 'root' })
export class OnlineAuthGuard implements CanActivate {
  constructor(
    private appMode: AppModeService,
    private neon: NeonService,
    private router: Router,
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (!this.appMode.isOnline()) return true;

    const session = await this.neon.getSession();
    if (session) return true;

    return this.router.createUrlTree(['/auth']);
  }
}
