import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch } from '../../../../core/models/branch.model';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-branch-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/subeler" class="back-link">← Şubelere Dön</a>
          <h2>Şube Detayları</h2>
        </div>
        <div class="actions" *ngIf="branch">
          <a [routerLink]="['/subeler/duzenle', branch.id]" class="edit-btn">Şubeyi Düzenle</a>
        </div>
      </div>

      <div class="card-content" *ngIf="branch">
        <div class="detail-header">
          <app-status-badge [status]="branch.isActive ? 'AKTIF' : 'PASIF'"></app-status-badge>
          <h3>{{ branch.name }}</h3>
          <span class="branch-code">{{ branch.code }}</span>
        </div>

        <div class="details-grid">
          <div class="detail-section">
            <h4>Konum ve Adres</h4>
            <div class="detail-item"><strong>Şehir:</strong> {{ branch.city }}</div>
            <div class="detail-item"><strong>İlçe:</strong> {{ branch.district }}</div>
            <div class="detail-item"><strong>Koordinatlar:</strong> {{ branch.latitude }} (N) / {{ branch.longitude }} (E)</div>
          </div>

          <div class="detail-section">
            <h4>Sorumlu Kişi</h4>
            <div class="detail-item"><strong>Şube Sorumlusu:</strong> {{ branch.contactPerson }}</div>
            <div class="detail-item"><strong>Kapasite:</strong> Günlük {{ branch.dailyCapacity }} Teknisyen Görevi</div>
            <div class="detail-item"><strong>Mesai Saatleri:</strong> {{ branch.workingHoursStart }} - {{ branch.workingHoursEnd }}</div>
          </div>
        </div>

        <div class="areas-section">
          <h4>Hizmet Verilen Bölgeler</h4>
          <div class="chips-container">
            <span class="area-chip" *ngFor="let area of branch.serviceAreas">
              {{ area }}
            </span>
            <span class="no-chips" *ngIf="!branch.serviceAreas || branch.serviceAreas.length === 0">
              Tanımlanmış bölge bulunmuyor.
            </span>
          </div>
        </div>

        <div class="meta-section">
          <span>Kayıt Tarihi: {{ branch.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
        </div>
      </div>

      <div class="error-alert" *ngIf="errorMessage">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styleUrls: ['./branch-detail.component.scss']
})
export class BranchDetailPage implements OnInit {
  private branchService = inject(BranchService);
  private route = inject(ActivatedRoute);

  branch: Branch | null = null;
  errorMessage: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      try {
        const found = this.branchService.getBranchById(id);
        if (found) {
          this.branch = found;
        } else {
          this.errorMessage = 'Şube bulunamadı.';
        }
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
      }
    }
  }
}
