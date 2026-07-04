import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { WorkOrderService } from '../../../../core/services/work-order.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { PermissionService } from '../../../../core/services/permission.service';
import { WorkOrder, WorkOrderStatus, UsedPart } from '../../../../core/models/work-order.model';
import { InventoryService } from '../../../../core/services/inventory.service';
import { SparePart } from '../../../../core/models/spare-part.model';
import { ReservationService } from '../../../../core/services/reservation.service';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FAILURE_REASON_OPTIONS, FailureReasonCode, FAILURE_REASON_LABELS } from '../../../../core/constants/labels.const';

@Component({
  selector: 'app-work-order-list',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h2>İş Emirleri Yönetimi</h2>
        <p class="subtitle">Sistemdeki tüm iş emirlerini izleyin ve durum geçişlerini state-machine kurallarına uygun olarak yönetin.</p>
      </div>

      <!-- Hata/Başarı Mesajları -->
      <div class="alert alert-danger" *ngIf="errorMessage">
        <strong>Hata:</strong> {{ errorMessage }}
      </div>
      <div class="alert alert-success" *ngIf="successMessage">
        <strong>Başarılı:</strong> {{ successMessage }}
      </div>

      <!-- Filtreler ve Tablo -->
      <div class="card">
        <div class="table-actions">
          <div class="filter-group">
            <label>Durum Filtresi</label>
            <select [value]="statusFilter" (change)="statusFilter = $any($event.target).value; applyFilters()" class="form-control">
              <option value="">Tümü</option>
              <option value="OPENED">Açıldı</option>
              <option value="PLANNED">Planlandı</option>
              <option value="ON_THE_WAY">Yolda</option>
              <option value="ON_SITE">Sahada</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="PARTIALLY_COMPLETED">Kısmi Tamamlandı</option>
              <option value="FAILED">Başarısız</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Şube Filtresi</label>
            <select [value]="branchFilter" (change)="branchFilter = $any($event.target).value; applyFilters()" class="form-control">
              <option value="">Tümü</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Global Arama</label>
            <input type="text" [value]="searchQuery" (input)="searchQuery = $any($event.target).value; applyFilters()"
                   placeholder="Kod, şube, teknisyen, araç..." maxlength="40" class="form-control" />
          </div>

          <div class="filter-group">
            <label>Başlangıç (İlk Tarih)</label>
            <input type="date" [value]="dateFrom" (change)="dateFrom = $any($event.target).value; applyFilters()" class="form-control" />
          </div>

          <div class="filter-group">
            <label>Başlangıç (Son Tarih)</label>
            <input type="date" [value]="dateTo" (change)="dateTo = $any($event.target).value; applyFilters()" class="form-control" />
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" (click)="sort('code')">Kod <span class="sort-icon" *ngIf="sortKey==='code'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th class="sortable" (click)="sort('branch')">Şube <span class="sort-icon" *ngIf="sortKey==='branch'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th class="sortable" (click)="sort('technician')">Teknisyen <span class="sort-icon" *ngIf="sortKey==='technician'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th class="sortable" (click)="sort('vehicle')">Araç <span class="sort-icon" *ngIf="sortKey==='vehicle'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th class="sortable" (click)="sort('plannedStart')">Zaman Dilimi <span class="sort-icon" *ngIf="sortKey==='plannedStart'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th class="sortable" (click)="sort('status')">Durum <span class="sort-icon" *ngIf="sortKey==='status'">{{ sortDirection==='asc'?'▲':'▼' }}</span></th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let wo of paginatedWorkOrders; trackBy: trackByWo">
                <td class="font-bold">{{ wo.code }}</td>
                <td>{{ getBranchName(wo.branchId) }}</td>
                <td>{{ getTechnicianName(wo.technicianId) }}</td>
                <td>{{ getVehiclePlate(wo.vehicleId) }}</td>
                <td>
                  <div *ngIf="wo.plannedStart">
                    {{ wo.plannedStart | date:'dd.MM HH:mm' }} - {{ wo.plannedEnd | date:'HH:mm' }}
                  </div>
                  <div *ngIf="!wo.plannedStart" class="text-muted">Planlanmadı</div>
                </td>
                <td>
                  <app-status-badge [status]="wo.status"></app-status-badge>
                </td>
                <td>
                  <div class="action-buttons">
                    <!-- OPENED actions -->
                    <ng-container *ngIf="wo.status === 'OPENED'">
                      <!-- Kural 2: 50.000 TL üzeri işler önce şube sorumlusu onayı ister -->
                      <button *ngIf="needsApproval(wo) && canApprove()"
                              (click)="onApprove(wo)"
                              class="btn btn-success btn-sm">Onayla</button>
                      <span *ngIf="needsApproval(wo) && !canApprove()" class="badge badge-warning-soft">Onay Bekliyor</span>
                      <span *ngIf="wo.estimatedCost > 50000 && wo.managerApproved" class="badge badge-success-soft">Onaylandı</span>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_PLAN')" routerLink="/planlama" class="btn btn-primary btn-sm">Planla</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_CANCEL')" (click)="openCancelModal(wo)" class="btn btn-danger btn-sm">İptal Et</button>
                    </ng-container>

                    <!-- PLANNED actions -->
                    <ng-container *ngIf="wo.status === 'PLANNED'">
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_UPDATE_STATUS')" (click)="onRouteStart(wo.id)" class="btn btn-info btn-sm">Yola Çık</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_CANCEL')" (click)="openCancelModal(wo)" class="btn btn-danger btn-sm">İptal Et</button>
                    </ng-container>

                    <!-- ON_THE_WAY actions -->
                    <ng-container *ngIf="wo.status === 'ON_THE_WAY'">
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_UPDATE_STATUS')" (click)="onSiteArrive(wo.id)" class="btn btn-success btn-sm">Sahaya Ulaştı</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_UPDATE_STATUS')" (click)="openFailModal(wo)" class="btn btn-warning btn-sm">Başarısız Yap</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_CANCEL')" (click)="openCancelModal(wo)" class="btn btn-danger btn-sm">İptal Et</button>
                    </ng-container>

                    <!-- ON_SITE actions -->
                    <ng-container *ngIf="wo.status === 'ON_SITE'">
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_COMPLETE')" (click)="openCompleteModal(wo, 'COMPLETED')" class="btn btn-success btn-sm">Tamamla</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_COMPLETE')" (click)="openCompleteModal(wo, 'PARTIALLY_COMPLETED')" class="btn btn-warning btn-sm">Kısmi Tamamla</button>
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_UPDATE_STATUS')" (click)="openFailModal(wo)" class="btn btn-danger btn-sm">Başarısız Yap</button>
                    </ng-container>

                    <ng-container *ngIf="isFinalStatus(wo.status) && canReopen(wo)">
                      <button *ngIf="permissionService.hasPermission('WORK_ORDER_UPDATE_STATUS')" (click)="openReopenModal(wo)" class="btn btn-warning btn-sm" title="Yanlışlık varsa son 24 saat içinde geri alabilirsiniz"> Geri Al</button>
                    </ng-container>
                    <span *ngIf="isFinalStatus(wo.status) && !canReopen(wo)" class="text-muted final-state-label" [class.failed]="wo.status === 'FAILED'" [class.cancelled]="wo.status === 'CANCELLED'">
                      {{ finalStateLabel(wo.status) }}
                    </span>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredWorkOrders.length === 0">
                <td colspan="7" class="text-center text-muted">İş emri bulunamadı.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar" *ngIf="filteredWorkOrders.length > 0">
          <span class="pagination-info">
            Toplam <strong>{{ filteredWorkOrders.length }}</strong> kayıttan
            {{ startIndex + 1 }}–{{ endIndex }} arası gösteriliyor
          </span>
          <div class="pagination-controls">
            <label class="page-size">
              Sayfa boyutu:
              <select (change)="changePageSize(+$any($event.target).value)">
                <option *ngFor="let s of pageSizeOptions" [value]="s" [selected]="s === pageSize">{{ s }}</option>
              </select>
            </label>
            <button [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)">Önceki</button>
            <span class="page-num">{{ currentPage }} / {{ totalPages || 1 }}</span>
            <button [disabled]="currentPage >= totalPages" (click)="setPage(currentPage + 1)">Sonraki</button>
          </div>
        </div>
        <div style="display:none">
        </div>
      </div>

      <!-- MODALLAR -->
      
      <!-- İptal Modalı -->
      <div class="modal-backdrop" *ngIf="activeModal === 'cancel'">
        <div class="modal-box">
          <h3>İş Emrini İptal Et</h3>
          <p><strong>{{ selectedWo?.code }}</strong> nolu iş emrini iptal etmek istediğinize emin misiniz?</p>
          <div class="form-group">
            <div class="label-wrapper">
              <label>İptal Nedeni</label>
              <span class="char-counter">{{ cancelReason.length }} / 200</span>
            </div>
            <input type="text" [value]="cancelReason" (input)="cancelReason = $any($event.target).value" maxLength="200" placeholder="İptal edilme sebebi giriniz" class="form-control" />
          </div>
          <div class="modal-actions">
            <button (click)="closeModal()" class="btn btn-secondary">Vazgeç</button>
            <button [disabled]="!cancelReason || !cancelReason.trim()" (click)="submitCancel()" class="btn btn-danger">İptal Et</button>
          </div>
        </div>
      </div>

      <!-- Başarısız Modalı -->
      <div class="modal-backdrop" *ngIf="activeModal === 'fail'">
        <div class="modal-box">
          <h3>İş Emrini Başarısız İşaretle</h3>
          <p><strong>{{ selectedWo?.code }}</strong> nolu iş emrini başarısız olarak kapatıyorsunuz.</p>
          <div class="form-group">
            <label>Başarısızlık Nedeni</label>
            <select [value]="failReasonCode" (change)="failReasonCode = $any($event.target).value" class="form-control">
              <option value="">-- Neden seçiniz --</option>
              <option *ngFor="let opt of FAILURE_REASON_OPTIONS" [value]="opt.code">{{ opt.label }}</option>
            </select>
          </div>
          <div class="form-group" *ngIf="failReasonCode === 'OTHER'">
            <div class="label-wrapper">
              <label>Açıklama</label>
              <span class="char-counter">{{ failReason.length }} / 200</span>
            </div>
            <input type="text" [value]="failReason" (input)="failReason = $any($event.target).value" maxLength="200" placeholder="Başarısızlık sebebini açıklayın" class="form-control" />
          </div>
          <div class="modal-actions">
            <button (click)="closeModal()" class="btn btn-secondary">Vazgeç</button>
            <button [disabled]="!isFailReasonValid()" (click)="submitFail()" class="btn btn-danger">Kaydet</button>
          </div>
        </div>
      </div>

      <!-- Geri Al Modalı -->
      <div class="modal-backdrop" *ngIf="activeModal === 'reopen'">
        <div class="modal-box">
          <h3>İş Emrini Geri Al</h3>
          <div class="reopen-warning">
            <p><strong>Dikkat:</strong> Bu iş emrini geri almak istediğinize emin misiniz?</p>
            <ul>
              <li *ngIf="selectedWo?.status === 'CANCELLED'">
                <strong>{{ selectedWo?.code }}</strong> nolu iş emri tekrar <strong>Açıldı</strong> durumuna alınacak ve yeniden planlanması gerekecek.
              </li>
              <li *ngIf="selectedWo?.status !== 'CANCELLED'">
                <strong>{{ selectedWo?.code }}</strong> nolu iş emri tekrar <strong>Planlandı</strong> durumuna alınacak.
              </li>
              <li *ngIf="selectedWo?.status === 'COMPLETED' || selectedWo?.status === 'PARTIALLY_COMPLETED'">
                Kullanılan parçalar <strong>stoğa iade</strong> edilecek.
              </li>
              <li *ngIf="selectedWo?.status === 'CANCELLED'">
                İptal sırasında stoktan zaten serbest bırakılmış parçalar etkilenmeyecek (rezervasyon yeniden yapmalısınız).
              </li>
              <li>Bu işlem audit log'a yazılacak ve şube sorumlusu bilgilendirilecek.</li>
              <li><strong>Sadece son 24 saat içinde</strong> kapatılmış iş emirleri için geçerlidir.</li>
            </ul>
          </div>
          <div class="form-group">
            <div class="label-wrapper">
              <label>Geri Alma Nedeni</label>
              <span class="char-counter">{{ reopenReason.length }} / 200</span>
            </div>
            <input type="text" [value]="reopenReason" (input)="reopenReason = $any($event.target).value" maxLength="200" placeholder="Örn: Yanlış müşteriye atanmış" class="form-control" />
          </div>
          <div class="modal-actions">
            <button (click)="closeModal()" class="btn btn-secondary">Vazgeç</button>
            <button [disabled]="!reopenReason || !reopenReason.trim()" (click)="submitReopen()" class="btn btn-warning">Evet, Geri Al</button>
          </div>
        </div>
      </div>

      <!-- Kapatma/Tamamlama Modalı (Yedek Parça Seçimiyle) -->
      <div class="modal-backdrop" *ngIf="activeModal === 'complete' || activeModal === 'partially_complete'">
        <div class="modal-box complete-modal">
          <h3>{{ activeModal === 'complete' ? 'İş Emrini Tamamla' : 'Kısmi Tamamlama' }}</h3>
          <p><strong>{{ selectedWo?.code }}</strong> için kullanılan yedek parçaları belirtin.</p>
          
          <div class="parts-allocation-section">
            <h5>Rezerve Edilen Parçalar</h5>
            <div *ngFor="let item of selectedWoReservedParts" class="part-allocation-row">
              <div class="part-info">
                <strong>{{ getPartName(item.partId) }}</strong><br/>
                <span class="sub-label">Rezerve Edilen: {{ item.quantity }}</span>
              </div>
              <div class="part-input">
                <label>Kullanılan Miktar</label>
                <input type="number" [value]="usedPartsQuantities[item.partId]" (input)="usedPartsQuantities[item.partId] = $any($event.target).valueAsNumber || 0" min="0" [max]="item.quantity" class="form-control qty-input" />
              </div>
            </div>
            <p class="text-muted" *ngIf="selectedWoReservedParts.length === 0">Bu iş emri için parça rezerve edilmemiş.</p>
          </div>

          <!-- Kısmi Tamamlama için Takip Notu -->
          <div class="form-group" *ngIf="activeModal === 'partially_complete'">
            <div class="label-wrapper">
              <label>Takip/Follow-up Talebi Notu</label>
              <span class="char-counter">{{ followUpNote.length }} / 300</span>
            </div>
            <textarea [value]="followUpNote" (input)="followUpNote = $any($event.target).value" maxLength="300" placeholder="Kısmi tamamlanma gerekçesini ve sonraki adım detaylarını yazın..." class="form-control"></textarea>
          </div>

          <div class="modal-actions">
            <button (click)="closeModal()" class="btn btn-secondary">Vazgeç</button>
            <button [disabled]="activeModal === 'partially_complete' && (!followUpNote || !followUpNote.trim())" (click)="submitComplete()" class="btn btn-success">Kaydet ve Kapat</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styleUrls: ['./work-order-list.component.scss']
})
export class WorkOrderListComponent implements OnInit {
  private woService = inject(WorkOrderService);
  private inventoryService = inject(InventoryService);
  private reservationService = inject(ReservationService);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);
  private storage = inject(StorageService);

  getBranchName(id: string): string {
    const list = this.storage.getCollection<any>(STORAGE_KEYS.BRANCHES);
    const matched = list.find(b => b.id === id);
    return matched ? matched.name : id;
  }

  getTechnicianName(id: string | null): string {
    if (!id) return 'Atanmadı';
    const list = this.storage.getCollection<any>(STORAGE_KEYS.TECHNICIANS);
    const matched = list.find(t => t.id === id);
    return matched ? matched.fullName : id;
  }

  getVehiclePlate(id: string | null): string {
    if (!id) return 'Atanmadı';
    const list = this.storage.getCollection<any>(STORAGE_KEYS.VEHICLES);
    const matched = list.find(v => v.id === id);
    return matched ? matched.plateNumber : id;
  }

  // States
  workOrders: WorkOrder[] = [];
  filteredWorkOrders: WorkOrder[] = [];
  branches: any[] = [];
  statusFilter = '';
  branchFilter = '';
  searchQuery = '';
  dateFrom = '';
  dateTo = '';
  sortKey = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  private route = inject(ActivatedRoute);

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  get totalPages(): number { return Math.ceil(this.filteredWorkOrders.length / this.pageSize); }
  get startIndex(): number { return (this.currentPage - 1) * this.pageSize; }
  get endIndex(): number { return Math.min(this.startIndex + this.pageSize, this.filteredWorkOrders.length); }
  get paginatedWorkOrders(): WorkOrder[] { return this.filteredWorkOrders.slice(this.startIndex, this.endIndex); }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }
  changePageSize(s: number): void {
    if (this.pageSizeOptions.includes(s)) {
      this.pageSize = s;
      this.currentPage = 1;
    }
  }

  // Modal states
  activeModal: 'cancel' | 'fail' | 'complete' | 'partially_complete' | 'reopen' | null = null;
  reopenReason = '';
  selectedWo: WorkOrder | null = null;
  
  // Form values
  cancelReason = '';
  failReason = '';
  failReasonCode: FailureReasonCode | '' = '';
  readonly FAILURE_REASON_OPTIONS = FAILURE_REASON_OPTIONS;
  followUpNote = '';
  selectedWoReservedParts: any[] = [];
  usedPartsQuantities: Record<string, number> = {};

  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    this.branches = this.storage.getCollection<any>(STORAGE_KEYS.BRANCHES);
    this.route.queryParams.subscribe(params => {
      if (params['branchId']) {
        this.branchFilter = params['branchId'];
      }
      this.loadWorkOrders();
    });
  }

  loadWorkOrders(): void {
    try {
      this.workOrders = this.woService.getWorkOrders();
      this.applyFilters();
    } catch (err: any) {
      this.errorMessage = err.message || 'İş emirleri yüklenemedi.';
    }
  }

  applyFilters(): void {
    let filtered = [...this.workOrders];
    if (this.statusFilter) {
      filtered = filtered.filter(w => w.status === this.statusFilter);
    }
    if (this.branchFilter) {
      filtered = filtered.filter(w => w.branchId === this.branchFilter);
    }

    // Global arama: kod, şube, teknisyen, araç
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(w =>
        (w.code || '').toLowerCase().includes(q) ||
        this.getBranchName(w.branchId).toLowerCase().includes(q) ||
        this.getTechnicianName(w.technicianId).toLowerCase().includes(q) ||
        this.getVehiclePlate(w.vehicleId).toLowerCase().includes(q)
      );
    }

    // Tarih aralığı filtresi (planlanan başlangıç)
    if (this.dateFrom) {
      const from = new Date(this.dateFrom + 'T00:00:00').getTime();
      filtered = filtered.filter(w => w.plannedStart && new Date(w.plannedStart).getTime() >= from);
    }
    if (this.dateTo) {
      const to = new Date(this.dateTo + 'T23:59:59').getTime();
      filtered = filtered.filter(w => w.plannedStart && new Date(w.plannedStart).getTime() <= to);
    }

    // Sıralama
    if (this.sortKey) {
      const dir = this.sortDirection === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const va = this.sortValue(a, this.sortKey);
        const vb = this.sortValue(b, this.sortKey);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }

    this.filteredWorkOrders = filtered;
    this.currentPage = 1; // filtre değişince başa dön
  }

  sort(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  private sortValue(w: WorkOrder, key: string): string | number {
    switch (key) {
      case 'code': return (w.code || '').toLowerCase();
      case 'branch': return this.getBranchName(w.branchId).toLowerCase();
      case 'technician': return this.getTechnicianName(w.technicianId).toLowerCase();
      case 'vehicle': return this.getVehiclePlate(w.vehicleId).toLowerCase();
      case 'plannedStart': return w.plannedStart ? new Date(w.plannedStart).getTime() : 0;
      case 'status': return w.status || '';
      default: return '';
    }
  }

  trackByWo(index: number, item: WorkOrder): string {
    return item.id;
  }

  isFinalStatus(status: WorkOrderStatus): boolean {
    return status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
  }

  /** Final state için kullanıcıya gösterilecek doğal Türkçe metin. */
  finalStateLabel(status: WorkOrderStatus): string {
    switch (status) {
      case 'COMPLETED':           return 'Tamamlandı';
      case 'PARTIALLY_COMPLETED': return 'Kısmi Tamamlandı';
      case 'FAILED':              return 'Başarısız';
      case 'CANCELLED':           return 'İptal Edildi';
      default:                    return '';
    }
  }

  /** Final state'teki iş emirleri (Tamamlandı / Kısmi / Başarısız / İptal) geri alınabilir.
   *  - WORK_ORDER_CANCEL yetkisi şart.
   *  - actualEnd varsa son 24 saat içinde olmalı.
   *  - actualEnd yoksa (eski kayıtlar) yine izin verilir — kullanıcı yanlışlık düzeltsin.
   */
  canReopen(wo: WorkOrder): boolean {
    if (!this.permissionService.hasPermission('WORK_ORDER_CANCEL')) return false;
    if (!['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'].includes(wo.status)) return false;
    if (!wo.actualEnd) return true; // eski kayıt: izin ver
    const hours = (Date.now() - new Date(wo.actualEnd).getTime()) / (1000 * 60 * 60);
    return hours <= 24;
  }

  openReopenModal(wo: WorkOrder): void {
    this.selectedWo = wo;
    this.reopenReason = '';
    this.activeModal = 'reopen';
  }

  async submitReopen(): Promise<void> {
    if (!this.selectedWo || !this.reopenReason.trim()) return;
    const approved = await this.confirmService.confirm(
      'İş Emrini Geri Al',
      `${this.selectedWo.code} nolu iş emrini gerçekten geri almak istiyor musunuz? Kullanılan parçalar stoğa iade edilecek ve iş emri tekrar Planlandı durumuna geçecek.`
    );
    if (!approved) return;
    const woId = this.selectedWo.id;
    const reason = this.reopenReason.trim();
    this.closeModal();
    try {
      this.woService.reopenWorkOrder(woId, reason);
      this.toastService.showSuccess('İş emri başarıyla geri alındı.');
      this.loadWorkOrders();
    } catch (err: any) {
      this.toastService.showError(err.message || 'Geri alma işlemi başarısız oldu.');
    }
  }

  transition(id: string, status: WorkOrderStatus, payload?: any): void {
    this.errorMessage = null;
    this.successMessage = null;
    try {
      this.woService.transitionWorkOrder(id, status, payload);
      const msg = `İş emri durumu güncellendi: ${status}`;
      this.successMessage = msg;
      this.toastService.showSuccess(msg);
      this.loadWorkOrders();
    } catch (err: any) {
      const errMsg = err.message || 'Durum geçişi sırasında hata oluştu.';
      this.errorMessage = errMsg;
      this.toastService.showError(errMsg);
    }
  }

  // Confirm and route start
  async onRouteStart(id: string): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Yola Çıkış Onayı',
      'Bu iş emrini "Yolda" durumuna almak istediğinize emin misiniz? Teknisyene ve şube sorumlusuna bildirim gönderilecektir.'
    );
    if (approved) {
      this.transition(id, 'ON_THE_WAY');
    }
  }

  // Confirm and site arrival
  async onSiteArrive(id: string): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Sahaya Ulaşım Onayı',
      'Bu iş emrini "Sahada" durumuna almak istediğinize emin misiniz? Şube sorumlusuna bildirim gönderilecektir.'
    );
    if (approved) {
      this.transition(id, 'ON_SITE');
    }
  }

  // Cancel Modal Handlers
  // ============ Kural 2: Yüksek maliyet onayı ============
  needsApproval(wo: WorkOrder): boolean {
    return wo.estimatedCost > 50000 && !wo.managerApproved;
  }

  canApprove(): boolean {
    return this.permissionService.hasAnyRole(['BRANCH_MANAGER', 'OPERATION_MANAGER', 'SYSTEM_ADMIN']);
  }

  async onApprove(wo: WorkOrder): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Yüksek Maliyetli İş Emri Onayı',
      `${wo.code} nolu iş emrinin tahmini maliyeti ${wo.estimatedCost.toLocaleString('tr-TR')} TL. Planlamaya açılması için onay veriyor musunuz?`
    );
    if (!approved) return;
    try {
      this.woService.approveWorkOrder(wo.id);
      this.toastService.showSuccess(`${wo.code} onaylandı. Dispeçere planlama bildirimi gönderildi.`);
      this.loadWorkOrders();
    } catch (err: any) {
      this.toastService.showError(err.message || 'Onay işlemi başarısız.');
    }
  }

  openCancelModal(wo: WorkOrder): void {
    this.selectedWo = wo;
    this.cancelReason = '';
    this.activeModal = 'cancel';
  }

  async submitCancel(): Promise<void> {
    if (!this.selectedWo || !this.cancelReason.trim()) return;
    const approved = await this.confirmService.confirm(
      'İş Emri İptali',
      `${this.selectedWo.code} nolu iş emrini iptal etmek istediğinize emin misiniz? Tüm parça rezervasyonları serbest bırakılacak, teknisyen ve araç takvim aralığı boşa çıkacaktır.`
    );
    if (!approved) return;
    const woId = this.selectedWo.id;
    this.closeModal();
    this.transition(woId, 'CANCELLED', { reason: this.cancelReason.trim() });
  }

  // Fail Modal Handlers
  openFailModal(wo: WorkOrder): void {
    this.selectedWo = wo;
    this.failReasonCode = '';
    this.failReason = '';
    this.activeModal = 'fail';
  }

  isFailReasonValid(): boolean {
    if (!this.failReasonCode) return false;
    if (this.failReasonCode === 'OTHER') {
      return this.failReason.trim().length > 0;
    }
    return true;
  }

  async submitFail(): Promise<void> {
    if (!this.selectedWo || !this.isFailReasonValid()) return;
    const code = this.failReasonCode as FailureReasonCode;
    const label = FAILURE_REASON_LABELS[code];
    const detail = this.failReason.trim();
    const finalReason = (code === 'OTHER' && detail)
      ? detail
      : (detail ? `${label} — ${detail}` : label);

    const approved = await this.confirmService.confirm(
      'İş Emri Başarısız İşaretleme',
      `${this.selectedWo.code} nolu iş emrini başarısız olarak işaretlemek istediğinize emin misiniz? Neden: "${finalReason}". Tüm rezervasyonlar serbest bırakılacaktır.`
    );
    if (!approved) return;
    const woId = this.selectedWo.id;
    this.closeModal();
    this.transition(woId, 'FAILED', { failureReason: finalReason });
  }

  // Complete / Partially Complete Handlers
  openCompleteModal(wo: WorkOrder, targetStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED'): void {
    this.selectedWo = wo;
    this.followUpNote = '';
    this.selectedWoReservedParts = [];
    this.usedPartsQuantities = {};
    
    // Load reservations for this work order to prepopulate parts
    try {
      const reservations = this.storageGetReservations(wo.id);
      this.selectedWoReservedParts = reservations;
      for (const res of reservations) {
        // Pre-fill used quantity to the reserved quantity as default
        this.usedPartsQuantities[res.partId] = res.quantity;
      }
    } catch (err) {
      console.error(err);
    }

    this.activeModal = targetStatus === 'COMPLETED' ? 'complete' : 'partially_complete';
  }

  async submitComplete(): Promise<void> {
    if (!this.selectedWo) return;
    
    const targetStatus = this.activeModal === 'complete' ? 'COMPLETED' : 'PARTIALLY_COMPLETED';
    const statusText = targetStatus === 'COMPLETED' ? 'tamamlandı' : 'kısmi tamamlandı';

    if (targetStatus === 'PARTIALLY_COMPLETED' && !this.followUpNote.trim()) {
      this.errorMessage = 'Takip notu girmek zorunludur.';
      this.toastService.showError(this.errorMessage);
      return;
    }
    
    const statusLabel = targetStatus === 'COMPLETED' ? 'Tamamlandı' : 'Kısmi Tamamlandı';
    const approved = await this.confirmService.confirm(
      `İş Emrini Kapat — ${statusLabel}`,
      `${this.selectedWo.code} nolu iş emrini ${statusText} olarak kapatmak istediğinize emin misiniz? Kullanılan parçalar stoktan düşülecek, kullanılmayan rezervasyonlar serbest bırakılacaktır.`
    );
    if (!approved) return;

    const usedPartsList: UsedPart[] = [];
    for (const partId of Object.keys(this.usedPartsQuantities)) {
      const qty = this.usedPartsQuantities[partId];
      if (qty < 0) {
        this.errorMessage = 'Kullanılan parça miktarı negatif olamaz.';
        this.toastService.showError(this.errorMessage);
        return;
      }
      const reserved = this.selectedWoReservedParts.find(p => p.partId === partId);
      const reservedQty = reserved ? reserved.quantity : 0;
      if (qty > reservedQty) {
        this.errorMessage = `Kullanılan parça miktarı rezerve edilen miktarı (${reservedQty}) aşamaz.`;
        this.toastService.showError(this.errorMessage);
        return;
      }
      if (qty > 0) {
        usedPartsList.push({
          partId,
          quantity: qty
        });
      }
    }

    const woId = this.selectedWo.id;
    const note = this.followUpNote.trim();
    
    this.closeModal();

    this.transition(woId, targetStatus, {
      usedParts: usedPartsList,
      followUpNote: note
    });
  }

  closeModal(): void {
    this.activeModal = null;
    this.selectedWo = null;
    this.cancelReason = '';
    this.failReason = '';
    this.failReasonCode = '';
    this.followUpNote = '';
  }

  // Helper method to retrieve matching reservations without calling permissionService in UI
  private storageGetReservations(workOrderId: string): any[] {
    const allRes = this.reservationService.getReservationsByWorkOrder(workOrderId);
    return allRes.filter((r: any) => r.status === 'ACTIVE');
  }

  getPartName(partId: string): string {
    const part = this.inventoryService.getSparePartById(partId);
    return part ? part.name : 'Yedek Parça';
  }
}
