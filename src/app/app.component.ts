import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AppModeService } from './core/services/app-mode/app-mode.service';
import { CloudSyncService } from './core/services/cloud-sync/cloud-sync.service';
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
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.appMode.isOnline()) return;

    const session = await this.neon.getSession();
    if (!session) {
      await this.navCtrl.navigateRoot('/auth');
    }
  }
}
