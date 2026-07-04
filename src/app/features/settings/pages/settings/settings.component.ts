import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeedService } from '../../../../core/storage/seed.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h2>Sistem Ayarları</h2>
        <p class="subtitle">Sistem genel parametreleri, SLA yapılandırmaları ve veri bakım işlemleri buradan yönetilir.</p>
      </div>

      <div class="card">
        <h3>Veritabanı Bakım ve Sıfırlama</h3>
        <p class="desc">Sistemdeki tüm kayıtları (Şubeler, Teknisyenler, Parçalar, Servis Talepleri, İş Emirleri, Araçlar, Bildirimler ve Loglar) temizleyip varsayılan demo verilerini yeniden yüklemek için aşağıdaki butonu kullanabilirsiniz.</p>
        
        <div class="action-box">
          <button (click)="onResetDemoData()" class="btn-danger" [disabled]="loading">
            {{ loading ? 'Sıfırlanıyor...' : 'Tüm Demo Verisini Sıfırla' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private seedService = inject(SeedService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  loading = false;

  async onResetDemoData(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Tüm Demo Veriyi Sıfırla',
      'Sistemdeki tüm şube, teknisyen, envanter, araç, iş emri ve log verilerini tamamen silerek varsayılan demo verilerini yüklemek istediğinize emin misiniz? Bu işlem geri alınamaz!'
    );

    if (approved) {
      this.loading = true;
      try {
        this.seedService.resetAll();
        this.toastService.showSuccess('Tüm demo verileri başarıyla sıfırlandı ve yeniden yüklendi.');
      } catch (err: any) {
        this.toastService.showError('Sıfırlama sırasında bir hata oluştu: ' + err.message);
      } finally {
        this.loading = false;
      }
    }
  }
}
