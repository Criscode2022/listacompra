import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AppModeService } from './core/services/app-mode/app-mode.service';
import { CloudSyncService } from './core/services/cloud-sync/cloud-sync.service';
import { DataService } from './core/services/data-service/data.service';
import { NotificationService } from './core/services/notifications/notification.service';
import { NeonService } from './core/services/neon/neon.service';

@Component({
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
})
export class AppComponent implements OnInit {
  constructor(
    private appMode: AppModeService,
    private neon: NeonService,
    private navCtrl: NavController,
    private _cloudSync: CloudSyncService,
    private dataService: DataService,
    private notifications: NotificationService,
  ) {}

  async ngOnInit(): Promise<void> {
    void this.scheduleDailyReminder();

    if (!this.appMode.isOnline()) return;

    const session = await this.neon.getSession();
    if (!session) {
      await this.navCtrl.navigateRoot('/auth');
    }
  }

  /**
   * Wait until local storage has loaded products, then maybe fire
   * the once-per-day shopping reminder.
   */
  private async scheduleDailyReminder(): Promise<void> {
    try {
      await this.dataService.whenReady();
      await this.notifications.maybeSendDailyReminder();
    } catch {
      // Non-critical; skip reminder if storage is slow or unavailable.
    }
  }
}
