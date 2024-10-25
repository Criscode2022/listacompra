import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [IonicModule],
})
export class HeaderComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() color = 'primary';
}
