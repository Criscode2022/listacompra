import { Component, inject, Input } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';

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
  @Input() buttonVisible = false;

  private alertController = inject(AlertController);
  private dataService = inject(DataService);

  protected async clearStorage() {
    const alert = await this.alertController.create({
      header: 'Confirmar borrado',
      message:
        '¿Seguro que quieres borrar todos los productos? Si solo quieres eliminar un producto puedes deslizarlo hacia la izquierda',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Borrar',
          handler: () => {
            this.dataService.clearStorage();
          },
        },
      ],
    });

    await alert.present();
  }
}
