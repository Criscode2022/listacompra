import { Component, inject, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  @Input() deleteButtonInvisible = true;

  private alertController = inject(AlertController);
  protected dataService = inject(DataService);
  private snackbar = inject(MatSnackBar);

  protected async clearStorage() {
    if (!this.dataService.products().length) {
      return;
    }

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

            this.snackbar.open(`Productos eliminados correctamente`, 'Cerrar', {
              duration: 3000,
            });
          },
        },
      ],
    });

    await alert.present();
  }
}
