import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage {
  constructor(private modalCtrl: ModalController) {}

  async openSettings() {
    const modal = await this.modalCtrl.create({
      component: SettingsComponent,
      breakpoints: [0, 0.5, 0.85],
      initialBreakpoint: 0.5,
      handle: true,
      handleBehavior: 'cycle',
    });
    await modal.present();
  }
}
