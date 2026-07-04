import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TechnicianService } from '../../../../core/services/technician.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { Technician } from '../../../../core/models/technician.model';
import { WorkOrder, WorkOrderStatus } from '../../../../core/models/work-order.model';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { StatusLabelPipe } from '../../../../shared/pipes/status-label.pipe';
import { SmartDateInputComponent } from '../../../../shared/components/smart-date-input/smart-date-input.component';
import { TechLevelLabelPipe } from '../../../../shared/pipes/tech-level-label.pipe';

@Component({
  selector: 'app-technician-schedule',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent, StatusLabelPipe, SmartDateInputComponent, TechLevelLabelPipe],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/teknisyenler" class="back-link">← Teknisyenlere Dön</a>
          <h2>Teknisyen Programı ve Takvimi</h2>
        </div>
      </div>

      <div class="tech-profile-card" *ngIf="technician">
        <div class="avatar-area">
          <span class="avatar-placeholder">{{ technician.fullName.charAt(0) }}</span>
        </div>
        <div class="profile-info">
          <h3>{{ technician.fullName }}</h3>
          <p>{{ technician.level | techLevelLabel }} | Bölge: {{ technician.region }}</p>
        </div>
      </div>

      <div class="schedule-container" *ngIf="technician">
        <div class="schedule-header">
          <h3>Atanmış İş Emirleri (Zaman Sıralı)</h3>

          <div class="filters">
            <select [value]="statusFilter()" (change)="setStatus($any($event.target).value)" class="filter-select">
              <option value="">Tüm Durumlar</option>
              <option value="OPENED">Açıldı</option>
              <option value="PLANNED">Planlandı</option>
              <option value="ON_THE_WAY">Yolda</option>
              <option value="ON_SITE">Sahada</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="PARTIALLY_COMPLETED">Kısmi Tamamlandı</option>
              <option value="FAILED">Başarısız</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>

            <app-smart-date-input
              [value]="dateFromFilter()"
              (valueChange)="setDateFrom($event || '')"
              title="Başlangıç tarihi"
            ></app-smart-date-input>
            <app-smart-date-input
              [value]="dateToFilter()"
              (valueChange)="setDateTo($event || '')"
              title="Bitiş tarihi"
            ></app-smart-date-input>

          </div>
        </div>

        <div class="timeline" *ngIf="paginated().length > 0; else emptyState">
          <div class="timeline-item" *ngFor="let order of paginated(); trackBy: trackById">
            <div class="timeline-time">
              <span class="date">{{ order.plannedStart | date:'dd.MM.yyyy' }}</span>
              <span class="hours">{{ order.plannedStart | date:'HH:mm' }} - {{ order.plannedEnd | date:'HH:mm' }}</span>
            </div>

            <div class="timeline-badge" [class.badge-completed]="order.status === 'COMPLETED'" [class.badge-failed]="order.status === 'FAILED'">
              ●
            </div>

            <div class="timeline-content">
              <div class="order-header">
                <span class="order-code">{{ order.code }}</span>
                <app-status-badge [status]="order.status"></app-status-badge>
              </div>
              <p class="order-notes" *ngIf="order.notes">{{ order.notes }}</p>
              <div class="order-meta">
                <span>Tahmini Maliyet: {{ order.estimatedCost | currency:'TRY':'symbol-narrow' }}</span>
                <span *ngIf="order.actualCost > 0">Gerçekleşen: {{ order.actualCost | currency:'TRY':'symbol-narrow' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pagination-bar" *ngIf="filtered().length > 0">
          <span class="pagination-info">
            Toplam <strong>{{ filtered().length }}</strong> kayıttan
            {{ filtered().length === 0 ? 0 : (startIndex() + 1) }}–{{ endIndex() }} arası gösteriliyor
          </span>
          <div class="pagination-buttons">
            <button [disabled]="page() === 1" (click)="setPage(page() - 1)">Önceki</button>
            <span class="page-number">Sayfa {{ page() }} / {{ totalPages() || 1 }}</span>
            <button [disabled]="page() >= totalPages()" (click)="setPage(page() + 1)">Sonraki</button>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="empty-schedule">
            <div class="icon"></div>
            <p>Bu kriterlere uyan iş emri bulunmuyor.</p>
          </div>
        </ng-template>
      </div>

      <div class="error-alert" *ngIf="errorMessage">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styleUrls: ['./technician-schedule.component.scss']
})
export class TechnicianSchedulePage implements OnInit {
  private techService = inject(TechnicianService);
  private storage = inject(StorageService);
  private route = inject(ActivatedRoute);

  technician: Technician | null = null;
  assignedOrders = signal<WorkOrder[]>([]);
  errorMessage: string | null = null;

  statusFilter = signal<string>('');
  dateFromFilter = signal<string>('');
  dateToFilter = signal<string>('');
  page = signal(1);
  pageSize = signal(5); // sabit 5, kullanıcı değiştiremez

  filtered = computed(() => {
    const status = this.statusFilter();
    const from = this.dateFromFilter() ? new Date(this.dateFromFilter() + 'T00:00:00').getTime() : null;
    const to = this.dateToFilter() ? new Date(this.dateToFilter() + 'T23:59:59').getTime() : null;
    return this.assignedOrders().filter(wo => {
      if (status && wo.status !== status) return false;
      if (!wo.plannedStart && (from || to)) return false;
      if (wo.plannedStart) {
        const t = new Date(wo.plannedStart).getTime();
        if (from !== null && t < from) return false;
        if (to !== null && t > to) return false;
      }
      return true;
    });
  });

  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));
  startIndex = computed(() => (this.page() - 1) * this.pageSize());
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.filtered().length));
  paginated = computed(() => this.filtered().slice(this.startIndex(), this.endIndex()));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      try {
        const found = this.techService.getTechnicianById(id);
        if (found) {
          this.technician = found;
          this.loadSchedule(found.id);
        } else {
          this.errorMessage = 'Teknisyen bulunamadı.';
        }
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
      }
    }
  }

  loadSchedule(techId: string): void {
    const allOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const sorted = allOrders
      .filter(wo => wo.technicianId === techId)
      .sort((a, b) => {
        if (!a.plannedStart) return 1;
        if (!b.plannedStart) return -1;
        return new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime();
      });
    this.assignedOrders.set(sorted);
  }

  setStatus(v: string): void { this.statusFilter.set(v); this.page.set(1); }
  setDateFrom(v: string): void { this.dateFromFilter.set(v); this.page.set(1); }
  setDateTo(v: string): void { this.dateToFilter.set(v); this.page.set(1); }
  setPageSize(s: number): void { this.pageSize.set(s); this.page.set(1); }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  trackById = (_: number, item: WorkOrder) => item.id;
}
