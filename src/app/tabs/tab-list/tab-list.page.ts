import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { hasProductsByCondition } from 'src/app/shared/utils/filterProducts';
import { HeaderComponent } from '../../layout/header/header/header.component';

@Component({
  selector: 'app-tab-list',
  templateUrl: 'tab-list.page.html',
  styleUrls: ['tab-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HeaderComponent],
})
export class TabList {
  protected dataService = inject(DataService);

  protected products = this.dataService.products;

  protected hasProductsByCondition = hasProductsByCondition;
}
