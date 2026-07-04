import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ServiceRequestService } from '../../../../core/services/service-request.service';
import { SlaService } from '../../../../core/services/sla.service';
import { BranchService } from '../../../../core/services/branch.service';
import { ServiceRequest } from '../../../../core/models/service-request.model';
import { Branch } from '../../../../core/models/branch.model';
import { StatusLabelPipe } from '../../../../shared/pipes/status-label.pipe';
import { PriorityLabelPipe } from '../../../../shared/pipes/priority-label.pipe';

const SKILL_LABELS: Record<string, string> = {
  WHITE_GOODS: 'Beyaz Eşya',
  HVAC: 'Klima / Soğutma',
  ELECTRIC: 'Elektrik Tesisatı',
  ELECTRONICS_MOTHERBOARD: 'Elektronik / Anakart',
  PLUMBING: 'Sıhhi Tesisat',
  BOILER_HEATING: 'Kombi / Isıtma'
};

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLabelPipe, PriorityLabelPipe],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/servis-talepleri" class="back-link">← Taleplere Dön</a>
          <h2>Talep Detayı ve Analizi</h2>
        </div>
      </div>

      <div class="card-content" *ngIf="request">
        <div class="request-header">
          <span class="code-badge">{{ request.code }}</span>
          <h3>{{ request.title }}</h3>
          <span class="status-pill" [class]="request.status.toLowerCase()">{{ request.status | statusLabel:'request' }}</span>
        </div>

        <!-- SLA Warning Card -->
        <div class="sla-card" [ngClass]="getSlaStatusClass()">
          
          <div class="sla-details">
            <strong>SLA Çözüm Hedefi:</strong>
            <span>{{ request.slaDeadline | date:'dd.MM.yyyy HH:mm' }}</span>
            <span class="sla-alert-text" *ngIf="slaService.isSlaOverdue(request.slaDeadline)">
              (SLA Süresi Aşılmıştır!)
            </span>
            <span class="sla-alert-text" *ngIf="!slaService.isSlaOverdue(request.slaDeadline) && slaService.isSlaApproaching(request.slaDeadline)">
              (SLA Süresinin Dolmasına 2 Saatten Az Kalmıştır!)
            </span>
          </div>
        </div>

        <div class="details-grid">
          <div class="detail-section">
            <h4>Müşteri Bilgileri</h4>
            <div class="detail-item"><strong>Adı Soyadı:</strong> {{ request.customerName }}</div>
            <div class="detail-item"><strong>Telefon:</strong> {{ request.customerPhone }}</div>
            <div class="detail-item"><strong>Adres:</strong> {{ request.customerAddress || '—' }}</div>
            <div class="detail-item"><strong>Bölge:</strong> {{ request.customerRegion || '—' }}</div>
            <div class="detail-item"><strong>Bağlı Şube:</strong> {{ getBranchName(request.branchId) }}</div>
          </div>

          <div class="detail-section">
            <h4>Teknik Detaylar</h4>
            <div class="detail-item"><strong>Cihaz / Marka:</strong> {{ request.deviceBrandModel }}</div>
            <div class="detail-item"><strong>Hizmet Kategorisi:</strong> {{ request.serviceCategory }}</div>
            <div class="detail-item"><strong>Gerekli Yetkinlik:</strong> {{ skillLabel(request.requiredSkill) }}</div>
            <div class="detail-item"><strong>Öncelik:</strong> {{ request.priority | priorityLabel }}</div>
          </div>
        </div>

        <div class="description-section">
          <h4>Arıza / Talep Açıklaması</h4>
          <p class="description-text">{{ request.description }}</p>
        </div>

        <div class="warranty-section">
          <div class="w-item">
            <strong>Garanti Durumu:</strong>
            <span class="bool-badge" [class.true]="request.hasWarranty">
              {{ request.hasWarranty ? 'Garanti Kapsamında' : 'Garanti Dışı' }}
            </span>
          </div>
          <div class="w-item">
            <strong>Müşteri Ön Onayı:</strong>
            <span class="bool-badge" [class.true]="request.hasCustomerApproval">
              {{ request.hasCustomerApproval ? 'Onaylandı' : 'Onay Bekliyor' }}
            </span>
          </div>
        </div>

        <div class="meta-section">
          <span>Oluşturulma Tarihi: {{ request.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
        </div>
      </div>

      <div class="error-alert" *ngIf="errorMessage">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styleUrls: ['./request-detail.component.scss']
})
export class RequestDetailPage implements OnInit {
  private requestService = inject(ServiceRequestService);
  private branchService = inject(BranchService);
  slaService = inject(SlaService);
  private route = inject(ActivatedRoute);

  request: ServiceRequest | null = null;
  branches: Branch[] = [];
  errorMessage: string | null = null;

  ngOnInit(): void {
    try {
      this.branches = this.branchService.getBranches();
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const found = this.requestService.getServiceRequestById(id);
        if (found) {
          this.request = found;
        } else {
          this.errorMessage = 'Talep bulunamadı.';
        }
      }
    } catch (err: any) {
      this.errorMessage = 'Yüklenirken bir hata oluştu: ' + err.message;
    }
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }

  skillLabel(skill: string): string {
    return SKILL_LABELS[skill] || skill;
  }

  getSlaStatusClass(): string {
    if (!this.request) return '';
    if (this.slaService.isSlaOverdue(this.request.slaDeadline)) {
      return 'sla-overdue';
    }
    if (this.slaService.isSlaApproaching(this.request.slaDeadline)) {
      return 'sla-approaching';
    }
    return '';
  }
}
