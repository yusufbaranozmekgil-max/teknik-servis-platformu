import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { RouterLink, Router } from '@angular/router';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';
import { PriorityLabelPipe } from '../../../../shared/pipes/priority-label.pipe';
import { TechLevelLabelPipe } from '../../../../shared/pipes/tech-level-label.pipe';
import { PermissionVisibilityDirective } from '../../../../shared/directives/permission-visibility.directive';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PermissionService } from '../../../../core/services/permission.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RoleLabelPipe, PriorityLabelPipe, TechLevelLabelPipe, PermissionVisibilityDirective, StatusBadgeComponent],
  template: `
    <div class="dashboard-container">
      <!-- Welcome Header -->
      <header class="dashboard-header animate-fade-in">
        <div class="header-info">
          <h1>Saha Operasyonları Paneli</h1>
          <p class="subtitle">Hoş geldiniz, <strong>{{ currentUser()?.fullName || 'Kullanıcı' }}</strong> (Rol: <span class="role-badge">{{ currentUser()?.role | roleLabel }}</span>)</p>
        </div>
        <button (click)="refreshData()" class="btn-refresh">
          Verileri Yenile
        </button>
      </header>

      <!-- Multi-perspective Tab Control (Admin & Reporting users only) -->
      <div class="tab-controls animate-slide-in" *ngIf="showTabs">
        <button [class.active]="activeTab === 'reporting'" (click)="activeTab = 'reporting'">Raporlama Genel Bakış</button>
        <button [class.active]="activeTab === 'branch'" (click)="activeTab = 'branch'">Şube Sorumlusu Görünümü</button>
        <button [class.active]="activeTab === 'dispatcher'" (click)="activeTab = 'dispatcher'">Planlama / Dispeçer Görünümü</button>
        <button [class.active]="activeTab === 'operation'" (click)="activeTab = 'operation'">Operasyon Müdürü Görünümü</button>
      </div>

      <!-- Branch Selection Override for Admins -->
      <div class="branch-override-panel animate-slide-in" *ngIf="showTabs && activeTab !== 'operation' && activeTab !== 'reporting'">
        <label for="branchSelect"><strong>Denetlenecek Şube Seçin:</strong></label>
        <select id="branchSelect" class="form-control branch-select" (change)="onBranchOverrideChange($any($event.target).value)">
          <option value="">-- Şube Seçilmedi (Lütfen Listeden Seçiniz) --</option>
          <option *ngFor="let b of branches()" [value]="b.id" [selected]="b.id === activeBranchId()">
            {{ b.name }} ({{ b.city }})
          </option>
        </select>
      </div>

      <!-- Dashboard Body -->
      <div class="dashboard-body">

        <!-- ==================== 0. REPORTING USER VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'reporting'">
          <div class="view-title-bar">
            <h3>Raporlama Genel Bakış (Organizasyon Geneli)</h3>
          </div>

          <div class="metrics-grid">
            <!-- Toplam İş Emri (raporlama rolü iş emri sayfasına giremez; rapora yönlendir) -->
            <div class="metric-card gradient-blue clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Toplam İş Emri</span>
                <span class="card-value">{{ reportingMetrics().totalWorkOrders }}</span>
                <span class="card-sub">Tüm zamanlar →</span>
              </div>
            </div>

            <!-- Tamamlanma Oranı -->
            <div class="metric-card gradient-green clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Tamamlanma Oranı</span>
                <span class="card-value">{{ reportingMetrics().completionRate }}%</span>
                <span class="card-sub">{{ reportingMetrics().completedWorkOrders }} / {{ reportingMetrics().totalWorkOrders }} iş tamamlandı →</span>
              </div>
            </div>

            <!-- Açık Talepler -->
            <div class="metric-card gradient-orange clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Açık Servis Talepleri</span>
                <span class="card-value">{{ reportingMetrics().openRequests }}</span>
                <span class="card-sub">{{ reportingMetrics().totalRequests }} talep arasından →</span>
              </div>
            </div>

            <!-- SLA Aşımı -->
            <div class="metric-card" [class.gradient-red]="reportingMetrics().slaBreached > 0" [class.gradient-green]="reportingMetrics().slaBreached === 0" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">SLA Aşımı (Geciken)</span>
                <span class="card-value">{{ reportingMetrics().slaBreached }}</span>
                <span class="card-sub">{{ reportingMetrics().slaApproaching }} talep SLA'ya yaklaşıyor →</span>
              </div>
            </div>

            <!-- Kritik Stok -->
            <div class="metric-card" [class.gradient-red]="reportingMetrics().criticalPartsCount > 0" [class.gradient-green]="reportingMetrics().criticalPartsCount === 0" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Kritik Stoktaki Parçalar</span>
                <span class="card-value">{{ reportingMetrics().criticalPartsCount }}</span>
                <span class="card-sub">Eşik altı parça sayısı →</span>
              </div>
            </div>

            <!-- Ortalama Performans -->
            <div class="metric-card gradient-purple clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Genel Performans Ortalaması</span>
                <span class="card-value">{{ reportingMetrics().avgPerformance }}%</span>
                <span class="card-sub">Aktif teknisyenler bazında →</span>
              </div>
            </div>

            <!-- Aktif Kaynaklar -->
            <div class="metric-card gradient-blue clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label font-bold text-white">Aktif Kaynaklar</span>
                <div class="mini-grid">
                  <div><span>Şube:</span> <strong>{{ reportingMetrics().activeBranches }}</strong></div>
                  <div><span>Teknisyen:</span> <strong>{{ reportingMetrics().activeTechnicians }}</strong></div>
                  <div><span>Araç:</span> <strong>{{ reportingMetrics().activeVehicles }}</strong></div>
                </div>
              </div>
            </div>

            <!-- İş Emri Durum Kırılımı -->
            <div class="metric-card gradient-purple">
              <div class="card-content">
                <span class="card-label font-bold text-white">İş Emri Durum Kırılımı</span>
                <div class="mini-grid">
                  <div><span>Devam Eden:</span> <strong>{{ reportingMetrics().inProgressWorkOrders }}</strong></div>
                  <div><span>Kısmi:</span> <strong>{{ reportingMetrics().partiallyCompletedWorkOrders }}</strong></div>
                  <div><span>İptal:</span> <strong>{{ reportingMetrics().cancelledWorkOrders }}</strong></div>
                  <div><span>Başarısız:</span> <strong>{{ reportingMetrics().failedWorkOrders }}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Branches & Quick Links -->
          <div class="details-section">
            <div class="detail-block">
              <h4 class="dashboard-section-title">En Çok İş Tamamlayan Şubeler (Top 5)</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Şube Adı</th>
                      <th>Tamamlanan İş</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of reportingMetrics().topBranches; let i = index">
                      <td><strong>{{ i + 1 }}</strong></td>
                      <td>{{ row.branchName }}</td>
                      <td class="font-bold">{{ row.completedCount }}</td>
                    </tr>
                    <tr *ngIf="reportingMetrics().topBranches.length === 0">
                      <td colspan="3" class="empty-list">Henüz tamamlanmış iş emri bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="detail-block">
              <h4 class="dashboard-section-title">Hızlı Rapor Erişimi</h4>
              <div class="quick-report-links">
                <a class="quick-report-link" routerLink="/raporlar">Tüm Raporlar (8 farklı görsel)</a>
                <a class="quick-report-link" *appPermissionVisibility="'AUDIT_LOG_VIEW'" routerLink="/denetim-kayitlari">Denetim Kayıtları (Tüm değişiklik geçmişi)</a>
                <a class="quick-report-link" routerLink="/bildirimler">Bildirim Merkezi</a>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== 1. BRANCH MANAGER VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'branch'">
          <div class="view-title-bar">
            <h3>Şube Sorumlusu Paneli (Şube: {{ branchName() || 'Belirsiz' }})</h3>
          </div>
          
          <div class="metrics-grid" *ngIf="bmMetrics(); else noBranchData">
            <!-- Occupancy Card -->
            <div class="metric-card gradient-blue animate-card">
              <div class="card-content">
                <span class="card-label">Günlük Doluluk Oranı</span>
                <span class="card-value" [class.text-danger]="(bmMetrics()?.occupancyRate || 0) >= 100">
                  {{ bmMetrics()?.occupancyRate }}% 
                  <span class="capacity-warning" *ngIf="(bmMetrics()?.occupancyRate || 0) >= 100"> - Kapasite Aşıldı</span>
                </span>
                <div class="occupancy-details">
                  <span>Aktif İş: <strong>{{ bmMetrics()?.activeCount || 0 }}</strong></span>
                  <span>Kapasite: <strong>{{ bmMetrics()?.capacity || 0 }}</strong></span>
                </div>
                <div class="progress-bar">
                  <div class="progress" 
                       [style.width.%]="Math.min(100, bmMetrics()?.occupancyRate || 0)"
                       [ngClass]="getOccupancyClass(bmMetrics()?.occupancyRate || 0)"></div>
                </div>
              </div>
            </div>

            <!-- Critical Parts Card -->
            <div class="metric-card clickable-card" [routerLink]="['/stok']" [queryParams]="{ branchId: activeBranchId() }" [class.gradient-red]="(bmMetrics()?.criticalPartsCount || 0) > 0" [class.gradient-green]="(bmMetrics()?.criticalPartsCount || 0) === 0">
              <div class="card-content">
                <span class="card-label">Kritik Stok Parçaları</span>
                <span class="card-value">{{ bmMetrics()?.criticalPartsCount }}</span>
                <span class="card-sub">{{ (bmMetrics()?.criticalPartsCount || 0) > 0 ? 'Hemen Sipariş Verin!' : 'Stok Seviyeleri Güvenli' }} →</span>
              </div>
            </div>

            <!-- Today's Open Orders -->
            <div class="metric-card gradient-orange clickable-card" [routerLink]="['/is-emirleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Bugünkü Açık İş Emirleri</span>
                <span class="card-value">{{ bmMetrics()?.todayOpenWorkOrdersCount }}</span>
                <span class="card-sub">Devam eden & Planlanan →</span>
              </div>
            </div>

            <!-- Today's Completed Orders -->
            <div class="metric-card gradient-green clickable-card" [routerLink]="['/is-emirleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Bugün Tamamlananlar</span>
                <span class="card-value">{{ bmMetrics()?.todayCompletedWorkOrdersCount }}</span>
                <span class="card-sub">İş emirleri başarıyla kapatıldı →</span>
              </div>
            </div>

            <!-- Ready for Planning Requests -->
            <div class="metric-card gradient-purple clickable-card" [routerLink]="['/servis-talepleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Planlamaya Hazır Talepler</span>
                <span class="card-value">{{ bmMetrics()?.readyRequestsCount }}</span>
                <span class="card-sub">Henüz atanmamış yeni talepler →</span>
              </div>
            </div>

            <!-- SLA Approaching -->
            <div class="metric-card" [class.gradient-red]="(bmMetrics()?.slaApproachingCount || 0) > 0" [class.gradient-blue]="(bmMetrics()?.slaApproachingCount || 0) === 0">
              <div class="card-content">
                <span class="card-label">SLA Yaklaşan Talepler</span>
                <span class="card-value">{{ bmMetrics()?.slaApproachingCount }}</span>
                <span class="card-sub">Son 24 saat kalan işler</span>
              </div>
            </div>
          </div>

          <!-- BM Lists Section -->
          <div class="details-section" *ngIf="bmMetrics()">
            <div class="detail-block">
              <h4 class="dashboard-section-title">Kritik Parça Listesi</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Parça Adı</th>
                      <th>Stok</th>
                      <th>Min Stok</th>
                      <th>Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let part of criticalPartsPaged()">
                      <td><code>{{ part.code }}</code></td>
                      <td>{{ part.name }}</td>
                      <td class="text-danger font-bold">{{ part.stockQuantity }}</td>
                      <td>{{ part.minStockThreshold }}</td>
                      <td>
                        <button class="btn-action-remind" (click)="sendPartReminder(part)" title="Depo Sorumlusuna Hatırlat">
                           Hatırlat
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="criticalPartsTotal() === 0">
                      <td colspan="4" class="empty-list">Kritik stokta parça bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="criticalPartsTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ criticalPartsTotal() }}</strong> kayıttan {{ critStart() }}–{{ critEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="critPage() === 1" (click)="setCritPage(critPage() - 1)">‹</button>
                  <span class="page-num">{{ critPage() }} / {{ criticalPartsTotalPages() }}</span>
                  <button [disabled]="critPage() >= criticalPartsTotalPages()" (click)="setCritPage(critPage() + 1)">›</button>
                </div>
              </div>
            </div>

            <div class="detail-block">
              <h4 class="dashboard-section-title">SLA Yaklaşan Talepler</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Talep Kodu</th>
                      <th>Başlık</th>
                      <th>Öncelik</th>
                      <th>SLA Kalan Süre</th>
                      <th>Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let req of slaApproachingPaged()">
                      <td><code>{{ req.code }}</code></td>
                      <td>{{ req.title }}</td>
                      <td><span class="badge" [class.badge-critical]="req.priority === 'CRITICAL'" [class.badge-urgent]="req.priority === 'URGENT'">{{ req.priority | priorityLabel }}</span></td>
                      <td class="text-warning font-bold">{{ getRemainingSlaHours(req.slaDeadline) }} saat kaldı</td>
                      <td>
                        <button class="btn-action-warn" (click)="sendSlaReminder(req)" title="Planlama Ekibini Uyar">
                           Uyar
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="slaApproachingTotal() === 0">
                      <td colspan="4" class="empty-list">SLA süresi yaklaşan kritik talep bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="slaApproachingTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ slaApproachingTotal() }}</strong> kayıttan {{ slaStart() }}–{{ slaEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="slaPage() === 1" (click)="setSlaPage(slaPage() - 1)">‹</button>
                  <span class="page-num">{{ slaPage() }} / {{ slaApproachingTotalPages() }}</span>
                  <button [disabled]="slaPage() >= slaApproachingTotalPages()" (click)="setSlaPage(slaPage() + 1)">›</button>
                </div>
              </div>
            </div>

            <!-- Dynamic Technician Statuses Section -->
            <div class="detail-block full-width-block" style="grid-column: span 2;">
              <h4 class="dashboard-section-title">Şube Personelleri & Teknisyen Durumları</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Kıdem Seviyesi</th>
                      <th>Uzmanlık Alanları</th>
                      <th>Operasyonel Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let tech of branchTechnicians()">
                      <td><strong>{{ tech.fullName }}</strong></td>
                      <td>{{ tech.level | techLevelLabel }}</td>
                      <td>
                        <span class="badge badge-skill" *ngFor="let s of tech.skills">{{ s }}</span>
                      </td>
                      <td>
                        <span class="tech-status-badge" [ngClass]="tech.statusClass">
                          {{ tech.statusText }}
                        </span>
                      </td>
                    </tr>
                    <tr *ngIf="branchTechnicians().length === 0">
                      <td colspan="4" class="empty-list">Bu şubeye kayıtlı personel bulunmamaktadır.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== 2. DISPATCHER VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'dispatcher'">
          <div class="view-title-bar">
            <h3>Planlama / Dispeçer Paneli</h3>
          </div>

          <div class="metrics-grid">
            <!-- Open Requests -->
            <div class="metric-card gradient-blue clickable-card" [routerLink]="['/servis-talepleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Açık Talepler</span>
                <span class="card-value">{{ dispMetrics().openRequestsCount }}</span>
                <span class="card-sub">Çözüm bekleyen toplam talep →</span>
              </div>
            </div>

            <!-- Critical/SLA Approaching -->
            <div class="metric-card" [class.gradient-red]="(dispMetrics().criticalOrSlaApproachingCount || 0) > 0" [class.gradient-green]="(dispMetrics().criticalOrSlaApproachingCount || 0) === 0">
              <div class="card-content">
                <span class="card-label">Kritik / SLA Yaklaşan</span>
                <span class="card-value">{{ dispMetrics().criticalOrSlaApproachingCount }}</span>
                <span class="card-sub">Acil aksiyon planı gerekenler</span>
              </div>
            </div>

            <!-- Unassigned Orders -->
            <div class="metric-card gradient-orange clickable-card" [routerLink]="['/is-emirleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Atanmamış İşler</span>
                <span class="card-value">{{ dispMetrics().unassignedWorkOrdersCount }}</span>
                <span class="card-sub">Teknisyen bekleyen iş emirleri →</span>
              </div>
            </div>

            <!-- Delayed/Overdue Orders -->
            <div class="metric-card gradient-red clickable-card" [routerLink]="['/is-emirleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Gecikmiş İşler</span>
                <span class="card-value">{{ dispMetrics().delayedWorkOrdersCount }}</span>
                <span class="card-sub">Süresi dolmuş ama açık işler →</span>
              </div>
            </div>

            <!-- Available Technicians -->
            <div class="metric-card gradient-green clickable-card" [routerLink]="['/teknisyenler']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Müsait Teknisyen Sayısı</span>
                <span class="card-value">{{ dispMetrics().availableTechniciansCount }}</span>
                <span class="card-sub">Göreve hazır saha çalışanı →</span>
              </div>
            </div>

            <!-- Today's Planned -->
            <div class="metric-card gradient-purple clickable-card" [routerLink]="['/planlama']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Bugünkü Planlı İşler</span>
                <span class="card-value">{{ dispMetrics().todayPlannedWorkOrdersCount }}</span>
                <span class="card-sub">Bugün başlayacak iş emirleri →</span>
              </div>
            </div>
          </div>

          <!-- Dispatcher details -->
          <div class="details-section">
            <div class="detail-block">
              <h4 class="dashboard-section-title">Müsait Saha Teknisyenleri</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Uzmanlık Alanları</th>
                      <th>Seviye</th>
                      <th>Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let tech of availableTechniciansPaged()">
                      <td>{{ tech.fullName }}</td>
                      <td>
                        <span class="badge badge-skill" *ngFor="let s of tech.skills">{{ s }}</span>
                      </td>
                      <td>{{ tech.level | techLevelLabel }}</td>
                      <td><span class="score-indicator" [style.background-color]="getScoreColor(tech.performanceScore)">{{ tech.performanceScore }}</span></td>
                    </tr>
                    <tr *ngIf="availableTechniciansTotal() === 0">
                      <td colspan="4" class="empty-list">Müsait teknisyen bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="availableTechniciansTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ availableTechniciansTotal() }}</strong> kayıt — {{ techsStart() }}–{{ techsEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="techsPage() === 1" (click)="setTechsPage(1)" title="İlk">«</button>
                  <button [disabled]="techsPage() === 1" (click)="setTechsPage(techsPage() - 1)" title="Önceki">‹</button>
                  <span class="page-num">{{ techsPage() }} / {{ availableTechniciansTotalPages() }}</span>
                  <button [disabled]="techsPage() >= availableTechniciansTotalPages()" (click)="setTechsPage(techsPage() + 1)" title="Sonraki">›</button>
                  <button [disabled]="techsPage() >= availableTechniciansTotalPages()" (click)="setTechsPage(availableTechniciansTotalPages())" title="Son">»</button>
                </div>
              </div>
            </div>

            <div class="detail-block">
              <h4 class="dashboard-section-title">Atama Bekleyen İş Emirleri</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>İş Emri Kodu</th>
                      <th>Tahmini Maliyet</th>
                      <th>Oluşturulma Tarihi</th>
                      <th>Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let wo of unassignedPaged()">
                      <td><code>{{ wo.code }}</code></td>
                      <td>{{ wo.estimatedCost | currency:'TRY':'symbol-narrow':'1.2-2' }}</td>
                      <td>{{ wo.createdAt | date:'dd.MM.yyyy HH:mm' }}</td>
                      <td>
                        <a *ngIf="permissionService.hasPermission('WORK_ORDER_PLAN')" [routerLink]="['/planlama']" class="btn-action">Planla</a>
                      </td>
                    </tr>
                    <tr *ngIf="unassignedTotal() === 0">
                      <td colspan="4" class="empty-list">Atama bekleyen iş emri bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="unassignedTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ unassignedTotal() }}</strong> kayıt — {{ unassignedStart() }}–{{ unassignedEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="unassignedPage() === 1" (click)="setUnassignedPage(1)" title="İlk">«</button>
                  <button [disabled]="unassignedPage() === 1" (click)="setUnassignedPage(unassignedPage() - 1)" title="Önceki">‹</button>
                  <span class="page-num">{{ unassignedPage() }} / {{ unassignedTotalPages() }}</span>
                  <button [disabled]="unassignedPage() >= unassignedTotalPages()" (click)="setUnassignedPage(unassignedPage() + 1)" title="Sonraki">›</button>
                  <button [disabled]="unassignedPage() >= unassignedTotalPages()" (click)="setUnassignedPage(unassignedTotalPages())" title="Son">»</button>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== 3. OPERATION MANAGER VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'operation'">
          <div class="view-title-bar">
            <h3>Operasyon Müdürü Paneli (Tüm Organizasyon)</h3>
          </div>

          <div class="metrics-grid">
            <!-- Total Load distributed per branch -->
            <div class="metric-card gradient-blue clickable-card" routerLink="/subeler">
              <div class="card-content">
                <span class="card-label">Şubeler Arası Dağılım</span>
                <span class="card-value">{{ opMetrics().loadDistribution.length }} Şube</span>
                <span class="card-sub">Aktif yük takibi devrede →</span>
              </div>
            </div>

            <!-- Vehicles Count Summary -->
            <div class="metric-card gradient-purple clickable-card" routerLink="/araclar">
              <div class="card-content">
                <span class="card-label font-bold text-white">Araç Durum Özeti</span>
                <div class="mini-grid">
                  <div><span>Müsait:</span> <strong>{{ opMetrics().vehiclesStatus.available }}</strong></div>
                  <div><span>Görevde:</span> <strong>{{ opMetrics().vehiclesStatus.active }}</strong></div>
                  <div><span>Bakımda:</span> <strong>{{ opMetrics().vehiclesStatus.maintenance }}</strong></div>
                  <div><span>Pasif:</span> <strong>{{ opMetrics().vehiclesStatus.outOfService }}</strong></div>
                </div>
              </div>
            </div>

            <!-- Approaching Maintenance Vehicles -->
            <div class="metric-card clickable-card" routerLink="/araclar" [class.gradient-red]="(opMetrics().approachingMaintVehiclesCount || 0) > 0" [class.gradient-green]="(opMetrics().approachingMaintVehiclesCount || 0) === 0">
              <div class="card-content">
                <span class="card-label">Bakımı Yaklaşan Araçlar</span>
                <span class="card-value">{{ opMetrics().approachingMaintVehiclesCount }}</span>
                <span class="card-sub">>150 Gündür Bakım Yapılmamış →</span>
              </div>
            </div>

            <!-- Low Fuel Vehicles -->
            <div class="metric-card clickable-card" routerLink="/araclar" [class.gradient-orange]="(opMetrics().lowFuelVehiclesCount || 0) > 0" [class.gradient-green]="(opMetrics().lowFuelVehiclesCount || 0) === 0">
              <div class="card-content">
                <span class="card-label">Düşük Yakıtlı Araçlar</span>
                <span class="card-value">{{ opMetrics().lowFuelVehiclesCount }}</span>
                <span class="card-sub">%30 altı yakıt seviyesi →</span>
              </div>
            </div>

            <!-- Delayed Work Orders -->
            <div class="metric-card gradient-red clickable-card" [routerLink]="['/is-emirleri']" [queryParams]="{ branchId: activeBranchId() }">
              <div class="card-content">
                <span class="card-label">Geciken Toplam İşler</span>
                <span class="card-value">{{ opMetrics().delayedWorkOrdersCount }}</span>
                <span class="card-sub">Genel operasyonda sarkan iş emirleri →</span>
              </div>
            </div>

            <!-- Branch Performance Header -->
            <div class="metric-card gradient-green clickable-card" routerLink="/raporlar">
              <div class="card-content">
                <span class="card-label">Genel Performans</span>
                <span class="card-value">{{ getOverallAveragePerformance() }}%</span>
                <span class="card-sub">Şube ekiplerinin başarı ortalaması →</span>
              </div>
            </div>
          </div>

          <!-- OM Details -->
          <div class="details-section">
            <div class="detail-block">
              <h4 class="dashboard-section-title">Şube Yük Dağılımı</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Şube Adı</th>
                      <th>Aktif İş / Kapasite</th>
                      <th>Doluluk Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of loadDistributionPaged()">
                      <td>{{ item.branchName }}</td>
                      <td class="font-bold">{{ item.count }} / {{ item.capacity }}</td>
                      <td>
                        <div class="occupancy-cell">
                          <div class="mini-progress-bar">
                            <div class="mini-progress"
                                 [style.width.%]="item.occupancyBarWidth"
                                 [ngClass]="getOccupancyClass(item.occupancyPercent)"></div>
                          </div>
                          <span class="occupancy-text" [class.text-danger]="item.occupancyPercent >= 100">
                            %{{ item.occupancyPercent }}
                            <span class="mini-warning" *ngIf="item.occupancyPercent >= 100" title="Kapasite Aşıldı"></span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="loadDistributionTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ loadDistributionTotal() }}</strong> kayıttan {{ loadStart() }}–{{ loadEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="loadPage() === 1" (click)="setLoadPage(loadPage() - 1)">‹</button>
                  <span class="page-num">{{ loadPage() }} / {{ loadDistributionTotalPages() }}</span>
                  <button [disabled]="loadPage() >= loadDistributionTotalPages()" (click)="setLoadPage(loadPage() + 1)">›</button>
                </div>
              </div>
            </div>

            <div class="detail-block">
              <h4 class="dashboard-section-title">Şube Performans Karşılaştırması</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Şube Adı</th>
                      <th>Teknisyen Performans Ort.</th>
                      <th>Derecelendirme</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of branchPerformancePaged()">
                      <td>{{ p.branchName }}</td>
                      <td class="font-bold">{{ p.avgPerformance }} / 100</td>
                      <td>
                        <span class="badge" 
                          [class.badge-green]="p.avgPerformance >= 85" 
                          [class.badge-blue]="p.avgPerformance >= 70 && p.avgPerformance < 85"
                          [class.badge-orange]="p.avgPerformance < 70"
                        >
                          {{ p.avgPerformance >= 85 ? 'MÜKEMMEL' : (p.avgPerformance >= 70 ? 'STANDART' : 'İNCELENMELİ') }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mini-pagination" *ngIf="branchPerformanceTotal() > 0">
                <span class="page-info">
                  Toplam <strong>{{ branchPerformanceTotal() }}</strong> kayıttan {{ perfStart() }}–{{ perfEnd() }} arası
                </span>
                <div class="page-controls">
                  <button [disabled]="perfPage() === 1" (click)="setPerfPage(perfPage() - 1)">‹</button>
                  <span class="page-num">{{ perfPage() }} / {{ branchPerformanceTotalPages() }}</span>
                  <button [disabled]="perfPage() >= branchPerformanceTotalPages()" (click)="setPerfPage(perfPage() + 1)">›</button>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== 5. WAREHOUSE MANAGER VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'warehouse'">
          <div class="view-title-bar">
            <h3>Depo / Yedek Parça Sorumlusu Paneli</h3>
          </div>

          <div class="metrics-grid">
            <div class="metric-card gradient-blue clickable-card" routerLink="/stok">
              <div class="card-content">
                <span class="card-label">Parça Çeşidi</span>
                <span class="card-value">{{ warehouseMetrics().partVariety }}</span>
                <span class="card-sub">Aktif yedek parça kalemi →</span>
              </div>
            </div>

            <div class="metric-card clickable-card" routerLink="/stok/kritik" [class.gradient-red]="warehouseMetrics().criticalPartsCount > 0" [class.gradient-green]="warehouseMetrics().criticalPartsCount === 0">
              <div class="card-content">
                <span class="card-label">Kritik Stok</span>
                <span class="card-value">{{ warehouseMetrics().criticalPartsCount }}</span>
                <span class="card-sub">{{ warehouseMetrics().criticalPartsCount > 0 ? 'Acil ikmal gerekli!' : 'Stok seviyeleri güvenli' }} →</span>
              </div>
            </div>

            <div class="metric-card clickable-card" routerLink="/stok" [class.gradient-red]="warehouseMetrics().outOfStockCount > 0" [class.gradient-orange]="warehouseMetrics().outOfStockCount === 0">
              <div class="card-content">
                <span class="card-label">Tükenen Parça</span>
                <span class="card-value">{{ warehouseMetrics().outOfStockCount }}</span>
                <span class="card-sub">Stoğu sıfır olan kalemler →</span>
              </div>
            </div>

            <div class="metric-card gradient-purple clickable-card" routerLink="/stok/hareket">
              <div class="card-content">
                <span class="card-label font-bold text-white">Stok Özeti</span>
                <div class="mini-grid">
                  <div><span>Toplam:</span> <strong>{{ warehouseMetrics().totalStockUnits }}</strong></div>
                  <div><span>Rezerve:</span> <strong>{{ warehouseMetrics().totalReserved }}</strong></div>
                  <div><span>Kullanılabilir:</span> <strong>{{ warehouseMetrics().availableUnits }}</strong></div>
                </div>
              </div>
            </div>

            <div class="metric-card gradient-green">
              <div class="card-content">
                <span class="card-label">Toplam Stok Değeri</span>
                <span class="card-value">{{ warehouseMetrics().totalValue | currency:'TRY':'symbol-narrow':'1.0-0' }}</span>
                <span class="card-sub">Envanterin tahmini parasal değeri</span>
              </div>
            </div>
          </div>

          <div class="details-section">
            <div class="detail-block full-width-block" style="grid-column: span 2;">
              <h4 class="dashboard-section-title">Kritik Seviyedeki Parçalar</h4>
              <div class="list-wrapper">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Parça Adı</th>
                      <th>Mevcut Stok</th>
                      <th>Min. Eşik</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of warehouseMetrics().criticalParts.slice(0, 8)">
                      <td><code>{{ p.code }}</code></td>
                      <td>{{ p.name }}</td>
                      <td class="text-danger font-bold">{{ p.stockQuantity }}</td>
                      <td>{{ p.minStockThreshold }}</td>
                      <td>
                        <span class="badge" [class.badge-critical]="p.stockQuantity === 0" [class.badge-urgent]="p.stockQuantity > 0">
                          {{ p.stockQuantity === 0 ? 'Tükendi' : 'Kritik' }}
                        </span>
                      </td>
                    </tr>
                    <tr *ngIf="warehouseMetrics().criticalParts.length === 0">
                      <td colspan="5" class="empty-list">Kritik seviyede parça bulunmuyor.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== 6. TECHNICIAN VIEW ==================== -->
        <ng-container *ngIf="activeTab === 'technician'">
          <div class="view-title-bar">
            <h3>Teknisyen Paneli — {{ technicianMetrics().technicianName }}</h3>
          </div>

          <div class="no-branch-fallback" *ngIf="!technicianMetrics().hasTechnician">
            <p>Kullanıcı hesabınıza bağlı bir teknisyen kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.</p>
          </div>

          <ng-container *ngIf="technicianMetrics().hasTechnician">
            <div class="metrics-grid">
              <div class="metric-card gradient-blue clickable-card" routerLink="/is-emirleri">
                <div class="card-content">
                  <span class="card-label">Aktif İşlerim</span>
                  <span class="card-value">{{ technicianMetrics().activeCount }}</span>
                  <span class="card-sub">Devam eden atamalarım →</span>
                </div>
              </div>

              <div class="metric-card gradient-orange clickable-card" routerLink="/is-emirleri">
                <div class="card-content">
                  <span class="card-label">Bugünkü İşlerim</span>
                  <span class="card-value">{{ technicianMetrics().todayCount }}</span>
                  <span class="card-sub">Bugün planlı ziyaretler →</span>
                </div>
              </div>

              <div class="metric-card gradient-green">
                <div class="card-content">
                  <span class="card-label">Tamamladığım İş</span>
                  <span class="card-value">{{ technicianMetrics().lifetimeCompleted }}</span>
                  <span class="card-sub">Toplam kariyer boyunca</span>
                </div>
              </div>

              <div class="metric-card gradient-purple">
                <div class="card-content">
                  <span class="card-label">Performans Puanım</span>
                  <span class="card-value">{{ technicianMetrics().performanceScore }} / 100</span>
                  <span class="card-sub">Kıdem: {{ technicianMetrics().level | techLevelLabel }}</span>
                </div>
              </div>
            </div>

            <div class="details-section">
              <div class="detail-block full-width-block" style="grid-column: span 2;">
                <h4 class="dashboard-section-title">Aktif İş Emirlerim</h4>
                <div class="list-wrapper">
                  <table class="list-table">
                    <thead>
                      <tr>
                        <th>İş Emri</th>
                        <th>Başlık</th>
                        <th>Öncelik</th>
                        <th>Planlanan Başlangıç</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let j of technicianMetrics().activeJobs">
                        <td><code>{{ j.code }}</code></td>
                        <td>{{ j.title }}</td>
                        <td><span class="badge" [class.badge-critical]="j.priority === 'CRITICAL'" [class.badge-urgent]="j.priority === 'URGENT'">{{ j.priority | priorityLabel }}</span></td>
                        <td>{{ j.plannedStart ? (j.plannedStart | date:'dd.MM.yyyy HH:mm') : '—' }}</td>
                        <td><app-status-badge [status]="j.status"></app-status-badge></td>
                      </tr>
                      <tr *ngIf="technicianMetrics().activeJobs.length === 0">
                        <td colspan="5" class="empty-list">Şu an aktif iş emriniz bulunmuyor.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ng-container>
        </ng-container>

      </div>
    </div>

    <!-- Fallback if branch manager doesn't have a branchId -->
    <ng-template #noBranchData>
      <div class="no-branch-fallback">
        <p *ngIf="showTabs">Lütfen yukarıdaki menüden denetlemek istediğiniz şubeyi seçiniz.</p>
        <p *ngIf="!showTabs">Kullanıcı hesabınıza atanmış bir şube bulunamadı. Şube Sorumlusu panelini görmek için profilinize bir şube atanmalıdır.</p>
      </div>
    </ng-template>
  `,
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private authStateService = inject(AuthStateService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);
  permissionService = inject(PermissionService);

  currentUser = this.authStateService.currentUser;

  sendPartReminder(part: any): void {
    const branchNameVal = this.branchName() || 'Şube';
    this.notificationService.createForRole(
      'WAREHOUSE_MANAGER',
      'LOW_STOCK',
      `Kritik Stok Hatırlatması: ${part.name}`,
      `${branchNameVal} şubesinde ${part.name} stoğu kritik seviyededir (${part.stockQuantity} adet kaldı). Lütfen ikmal sağlayınız.`,
      'WARNING',
      { type: 'SPARE_PART', id: part.id, link: '/stok' }
    );
    this.toastService.showSuccess(`Depo Yöneticisine ${part.name} için hatırlatma bildirimi başarıyla gönderildi.`);
  }

  sendSlaReminder(req: any): void {
    const branchNameVal = this.branchName() || 'Şube';
    const hours = this.getRemainingSlaHours(req.slaDeadline);
    this.notificationService.createForRole(
      'DISPATCHER',
      'SLA_APPROACHING',
      `SLA Aşım Riski: ${req.code}`,
      `${branchNameVal} şubesindeki ${req.code} nolu servis talebinin SLA süresinin dolmasına sadece ${hours} saat kalmıştır. Lütfen acil planlama yapınız.`,
      'ERROR',
      { type: 'SERVICE_REQUEST', id: req.id, link: '/planlama' }
    );
    this.toastService.showSuccess(`Planlama Ekibine (Dispeçer) ${req.code} için SLA aşım uyarısı başarıyla gönderildi.`);
  }
  
  // Tab perspective for admins/reporters
  activeTab: 'reporting' | 'branch' | 'dispatcher' | 'operation' | 'warehouse' | 'technician' = 'branch';
  showTabs = false;
  Math = Math;

  // Signals wrappers
  branches = this.dashboardService.branchesSignal;
  activeBranchId = this.dashboardService.activeBranchId;
  bmMetrics = this.dashboardService.branchManagerMetrics;
  dispMetrics = this.dashboardService.dispatcherMetrics;
  opMetrics = this.dashboardService.operationManagerMetrics;
  reportingMetrics = this.dashboardService.reportingUserMetrics;
  warehouseMetrics = this.dashboardService.warehouseManagerMetrics;
  technicianMetrics = this.dashboardService.technicianMetrics;

  branchName = computed(() => {
    const id = this.activeBranchId();
    if (!id) return '';
    const b = this.branches().find(item => item.id === id);
    return b ? b.name : '';
  });

  branchTechnicians = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    
    const techs = this.dashboardService.techniciansSignal();
    const workOrders = this.dashboardService.workOrdersSignal();
    
    return techs.filter(t => t.branchId === branchId).map(t => {
      // Find if they have an active work order today
      const ACTIVE_LOAD_STATUSES = new Set(['PLANNED', 'ON_THE_WAY', 'ON_SITE']);
      const activeWo = workOrders.find(w => w.technicianId === t.id && ACTIVE_LOAD_STATUSES.has(w.status));
      
      let statusText = 'Müsait';
      let statusClass = 'status-available';
      
      if (!t.isActive) {
        statusText = 'Pasif';
        statusClass = 'status-inactive';
      } else if (t.isOnLeave) {
        statusText = 'İzinli';
        statusClass = 'status-on-leave';
      } else if (activeWo) {
        statusText = `Sahada / Görevde (${activeWo.code})`;
        statusClass = 'status-busy';
      }
      
      return {
        ...t,
        statusText,
        statusClass,
        activeWo
      };
    });
  });

  onBranchOverrideChange(branchId: string): void {
    this.dashboardService.selectedBranchIdOverride.set(branchId || null);
    // Reset pages to page 1 on filter change
    this.critPage.set(1);
    this.slaPage.set(1);
  }

  // Dispatcher listeleri için sayfalama
  techsPage = signal(1);
  techsPageSize = signal(5);
  unassignedPage = signal(1);
  unassignedPageSize = signal(5);
  pageSizeOptions = [5, 10, 25];

  // BM Critical Parts pagination
  critPage = signal(1);
  critPageSize = signal(5);
  criticalPartsTotal = computed(() => this.bmMetrics()?.criticalParts?.length || 0);
  criticalPartsTotalPages = computed(() => Math.max(1, Math.ceil(this.criticalPartsTotal() / this.critPageSize())));
  criticalPartsPaged = computed(() => {
    const list = this.bmMetrics()?.criticalParts || [];
    const start = (this.critPage() - 1) * this.critPageSize();
    return list.slice(start, start + this.critPageSize());
  });
  critStart = computed(() => this.criticalPartsTotal() === 0 ? 0 : (this.critPage() - 1) * this.critPageSize() + 1);
  critEnd = computed(() => Math.min(this.critPage() * this.critPageSize(), this.criticalPartsTotal()));

  setCritPage(p: number): void {
    if (p < 1 || p > this.criticalPartsTotalPages()) return;
    this.critPage.set(p);
  }
  setCritPageSize(s: number): void { this.critPageSize.set(s); this.critPage.set(1); }

  // BM SLA Approaching pagination
  slaPage = signal(1);
  slaPageSize = signal(5);
  slaApproachingTotal = computed(() => this.bmMetrics()?.slaApproaching?.length || 0);
  slaApproachingTotalPages = computed(() => Math.max(1, Math.ceil(this.slaApproachingTotal() / this.slaPageSize())));
  slaApproachingPaged = computed(() => {
    const list = this.bmMetrics()?.slaApproaching || [];
    const start = (this.slaPage() - 1) * this.slaPageSize();
    return list.slice(start, start + this.slaPageSize());
  });
  slaStart = computed(() => this.slaApproachingTotal() === 0 ? 0 : (this.slaPage() - 1) * this.slaPageSize() + 1);
  slaEnd = computed(() => Math.min(this.slaPage() * this.slaPageSize(), this.slaApproachingTotal()));

  setSlaPage(p: number): void {
    if (p < 1 || p > this.slaApproachingTotalPages()) return;
    this.slaPage.set(p);
  }
  setSlaPageSize(s: number): void { this.slaPageSize.set(s); this.slaPage.set(1); }

  // OM Load Distribution pagination
  loadPage = signal(1);
  loadPageSize = signal(5);
  loadDistributionTotal = computed(() => this.opMetrics()?.loadDistribution?.length || 0);
  loadDistributionTotalPages = computed(() => Math.max(1, Math.ceil(this.loadDistributionTotal() / this.loadPageSize())));
  loadDistributionPaged = computed(() => {
    const list = this.opMetrics()?.loadDistribution || [];
    const start = (this.loadPage() - 1) * this.loadPageSize();
    return list.slice(start, start + this.loadPageSize());
  });
  loadStart = computed(() => this.loadDistributionTotal() === 0 ? 0 : (this.loadPage() - 1) * this.loadPageSize() + 1);
  loadEnd = computed(() => Math.min(this.loadPage() * this.loadPageSize(), this.loadDistributionTotal()));

  setLoadPage(p: number): void {
    if (p < 1 || p > this.loadDistributionTotalPages()) return;
    this.loadPage.set(p);
  }
  setLoadPageSize(s: number): void { this.loadPageSize.set(s); this.loadPage.set(1); }

  // OM Branch Performance pagination
  perfPage = signal(1);
  perfPageSize = signal(5);
  branchPerformanceTotal = computed(() => this.opMetrics()?.branchPerformance?.length || 0);
  branchPerformanceTotalPages = computed(() => Math.max(1, Math.ceil(this.branchPerformanceTotal() / this.perfPageSize())));
  branchPerformancePaged = computed(() => {
    const list = this.opMetrics()?.branchPerformance || [];
    const start = (this.perfPage() - 1) * this.perfPageSize();
    return list.slice(start, start + this.perfPageSize());
  });
  perfStart = computed(() => this.branchPerformanceTotal() === 0 ? 0 : (this.perfPage() - 1) * this.perfPageSize() + 1);
  perfEnd = computed(() => Math.min(this.perfPage() * this.perfPageSize(), this.branchPerformanceTotal()));

  setPerfPage(p: number): void {
    if (p < 1 || p > this.branchPerformanceTotalPages()) return;
    this.perfPage.set(p);
  }
  setPerfPageSize(s: number): void { this.perfPageSize.set(s); this.perfPage.set(1); }

  availableTechniciansTotal = computed(() => this.dispMetrics().availableTechnicians?.length || 0);
  availableTechniciansTotalPages = computed(() => Math.max(1, Math.ceil(this.availableTechniciansTotal() / this.techsPageSize())));
  availableTechniciansPaged = computed(() => {
    const list = this.dispMetrics().availableTechnicians || [];
    const start = (this.techsPage() - 1) * this.techsPageSize();
    return list.slice(start, start + this.techsPageSize());
  });
  techsStart = computed(() => this.availableTechniciansTotal() === 0 ? 0 : (this.techsPage() - 1) * this.techsPageSize() + 1);
  techsEnd = computed(() => Math.min(this.techsPage() * this.techsPageSize(), this.availableTechniciansTotal()));

  unassignedTotal = computed(() => this.dispMetrics().unassignedWorkOrders?.length || 0);
  unassignedTotalPages = computed(() => Math.max(1, Math.ceil(this.unassignedTotal() / this.unassignedPageSize())));
  unassignedPaged = computed(() => {
    const list = this.dispMetrics().unassignedWorkOrders || [];
    const start = (this.unassignedPage() - 1) * this.unassignedPageSize();
    return list.slice(start, start + this.unassignedPageSize());
  });
  unassignedStart = computed(() => this.unassignedTotal() === 0 ? 0 : (this.unassignedPage() - 1) * this.unassignedPageSize() + 1);
  unassignedEnd = computed(() => Math.min(this.unassignedPage() * this.unassignedPageSize(), this.unassignedTotal()));

  setTechsPage(p: number): void {
    if (p < 1 || p > this.availableTechniciansTotalPages()) return;
    this.techsPage.set(p);
  }
  setTechsPageSize(s: number): void { this.techsPageSize.set(s); this.techsPage.set(1); }
  setUnassignedPage(p: number): void {
    if (p < 1 || p > this.unassignedTotalPages()) return;
    this.unassignedPage.set(p);
  }
  setUnassignedPageSize(s: number): void { this.unassignedPageSize.set(s); this.unassignedPage.set(1); }

  ngOnInit(): void {
    this.dashboardService.refresh();
    this.evaluatePerspective();
  }

  refreshData(): void {
    this.dashboardService.refresh();
    this.evaluatePerspective();
  }

  private evaluatePerspective(): void {
    const role = this.currentUser()?.role;
    if (role === 'REPORTING_USER') {
      this.showTabs = true;
      this.activeTab = 'reporting'; // raporlama yetkilisi için özel sekme
    } else if (role === 'SYSTEM_ADMIN') {
      this.showTabs = true;
      this.activeTab = 'branch'; // admin tüm sekmeleri görür, varsayılan şube
    } else if (role === 'BRANCH_MANAGER') {
      this.showTabs = false;
      this.activeTab = 'branch';
    } else if (role === 'DISPATCHER') {
      this.showTabs = false;
      this.activeTab = 'dispatcher';
    } else if (role === 'OPERATION_MANAGER') {
      this.showTabs = false;
      this.activeTab = 'operation';
    } else if (role === 'WAREHOUSE_MANAGER') {
      this.showTabs = false;
      this.activeTab = 'warehouse';
    } else if (role === 'TECHNICIAN') {
      this.showTabs = false;
      this.activeTab = 'technician';
    } else {
      this.showTabs = false;
      this.activeTab = 'branch'; // güvenli varsayılan
    }

  }

  getRemainingSlaHours(deadlineStr: string): number {
    if (!deadlineStr) return 0;
    const diff = new Date(deadlineStr).getTime() - Date.now();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60)));
  }

  getScoreColor(score: number): string {
    if (score >= 85) return '#10b981'; // green
    if (score >= 70) return '#3b82f6'; // blue
    if (score >= 50) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }

  getOverallAveragePerformance(): number {
    const perf = this.opMetrics().branchPerformance;
    if (perf.length === 0) return 0;
    const total = perf.reduce((sum, item) => sum + item.avgPerformance, 0);
    return Math.round(total / perf.length);
  }

  getOccupancyClass(percent: number): string {
    if (percent < 50) return 'progress-normal';
    if (percent < 80) return 'progress-medium';
    if (percent < 100) return 'progress-high';
    return 'progress-critical';
  }
}
