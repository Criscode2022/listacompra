import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { AppModeService } from '../core/services/app-mode/app-mode.service';
import { CloudSyncService } from '../core/services/cloud-sync/cloud-sync.service';
import { DataService } from '../core/services/data-service/data.service';
import { NeonService } from '../core/services/neon/neon.service';

type AuthTab = 'signin' | 'signup';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AuthPage implements OnInit {
  tab: AuthTab = 'signup';
  email = '';
  password = '';
  name = '';
  loading = false;
  hasOfflineData = false;

  constructor(
    private navCtrl: NavController,
    private toast: ToastController,
    private neon: NeonService,
    private appMode: AppModeService,
    private cloudSync: CloudSyncService,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.hasOfflineData = this.dataService.hasLocalData();
    if (this.hasOfflineData) {
      this.tab = 'signup';
    }
  }

  goBack(): void {
    this.appMode.clearOnlineIntent();
    void this.navCtrl.navigateRoot('/');
  }

  setTab(tab: AuthTab): void {
    this.tab = tab;
  }

  async submit(): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    try {
      if (this.tab === 'signup') {
        await this.handleSignUp();
      } else {
        await this.handleSignIn();
      }
    } catch (err) {
      await this.showToast(this.neon.getAuthErrorMessage(err), 'danger');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async handleSignUp(): Promise<void> {
    const displayName =
      this.name.trim() || this.email.split('@')[0] || 'Usuario';
    const result = await this.neon.signUp(
      this.email.trim(),
      this.password,
      displayName,
    );

    if (result.error) {
      await this.showToast(this.neon.getAuthErrorMessage(result.error), 'danger');
      return;
    }

    if (this.hasOfflineData) {
      try {
        const userId = result.data?.user?.id;
        const stats = await this.cloudSync.uploadLocalData(userId);
        await this.showToast(
          `Cuenta creada. ${stats.products} producto${stats.products !== 1 ? 's' : ''} subido${stats.products !== 1 ? 's' : ''} a la nube.`,
          'success',
        );
      } catch (uploadErr) {
        const msg =
          uploadErr instanceof Error
            ? uploadErr.message
            : 'Error al subir los datos';
        await this.showToast(
          `Cuenta creada, pero no se pudieron subir los datos: ${msg}`,
          'warning',
        );
      }
    } else {
      await this.showToast('Cuenta creada correctamente', 'success');
    }

    this.appMode.enableOnlineMode();
    await this.navCtrl.navigateRoot('/');
  }

  private async handleSignIn(): Promise<void> {
    const result = await this.neon.signIn(this.email.trim(), this.password);

    if (result.error) {
      await this.showToast(this.neon.getAuthErrorMessage(result.error), 'danger');
      return;
    }

    try {
      await this.cloudSync.downloadFromCloud();
      await this.showToast('Datos sincronizados desde la nube', 'success');
    } catch (syncErr) {
      const msg =
        syncErr instanceof Error ? syncErr.message : 'Error de sincronización';
      await this.showToast(
        `Sesión iniciada, pero no se pudieron descargar los datos: ${msg}`,
        'warning',
      );
    }

    this.appMode.enableOnlineMode();
    await this.navCtrl.navigateRoot('/');
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 3500,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
