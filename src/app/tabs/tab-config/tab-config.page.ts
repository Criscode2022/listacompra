import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HeaderComponent } from 'src/app/layout/header/header.component';
import {
  SettingsService,
  CATEGORIES,
} from 'src/app/core/services/settings-service/settings.service';

@Component({
  selector: 'app-tab-config',
  templateUrl: 'tab-config.page.html',
  styleUrls: ['tab-config.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HeaderComponent],
})
export class TabConfig {
  protected settingsService = inject(SettingsService);
  protected categories = CATEGORIES;

  protected onModeToggle(event: any) {
    const isAdvanced = event.detail.checked;
    this.settingsService.mode.set(isAdvanced ? 'advanced' : 'basic');
  }
}
