import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { Branch } from '../../../../core/models/branch.model';
import { WorkOrder } from '../../../../core/models/work-order.model';
import { SparePart } from '../../../../core/models/spare-part.model';
import { ServiceRequest } from '../../../../core/models/service-request.model';
import { Technician } from '../../../../core/models/technician.model';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { SmartDateInputComponent } from '../../../../shared/components/smart-date-input/smart-date-input.component';
import {
  WORK_ORDER_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  TECHNICIAN_LEVEL_LABELS,
  PRIORITY_LABELS
} from '../../../../core/constants/labels.const';

declare var Chart: any;

interface ReportOption {
  id: ReportId;
  name: string;
  shortName: string;
  chartType: 'bar' | 'pie' | 'line' | 'doughnut';
  description: string;
  group: 'operations' | 'inventory' | 'people' | 'fleet' | 'sla';
}

type ReportId =
  | 'branch-load'
  | 'part-stock'
  | 'completion-rate'
  | 'sla-delay'
  | 'technician-perf'
  | 'vehicle-usage'
  | 'category-dist'
  | 'critical-stock';

interface HeroKpi {
  label: string;
  value: string | number;
  hint: string;
  trend: 'up' | 'down' | 'flat' | 'good' | 'bad';
}

type ReportRow = any;

const PART_CATEGORY_LABELS: Record<string, string> = {
  COMPRESSOR: 'Kompresör',
  BOARD_ELECTRONIC: 'Kart / Elektronik',
  MOTOR: 'Motor',
  SENSOR: 'Sensör',
  SEAL_GASKET: 'Conta / Sızdırmazlık',
  FILTER: 'Filtre',
  CABLE_CONNECTION: 'Kablo / Bağlantı',
  CONSUMABLES: 'Sarf Malzeme'
};

const SKILL_LABELS: Record<string, string> = {
  WHITE_GOODS: 'Beyaz Eşya',
  HVAC: 'Klima / Soğutma',
  ELECTRIC: 'Elektrik Tesisatı',
  ELECTRONICS_MOTHERBOARD: 'Elektronik / Anakart',
  PLUMBING: 'Sıhhi Tesisat',
  BOILER_HEATING: 'Kombi / Isıtma'
};

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [CommonModule, SmartDateInputComponent],
  template: `
    <div class="reports-container">
      <!-- Üst başlık + global KPI şeridi -->
      <header class="reports-header">
        <div class="header-text">
          <h1>Analitik ve Raporlar</h1>
          <p class="subtitle">Saha operasyonlarının şube, teknisyen, araç, stok ve SLA bazlı performans analizi.</p>
        </div>
        <div class="header-actions">
          <button class="btn-ghost" (click)="resetFilters()" title="Tüm filtreleri sıfırla">
            Filtreleri Temizle
          </button>
          <button class="btn-export-primary" (click)="exportData('csv')" [disabled]="!tableData.length">
            CSV İndir
          </button>
          <button class="btn-export-secondary" (click)="exportData('json')" [disabled]="!tableData.length">
            JSON İndir
          </button>
          <button class="btn-export-secondary" (click)="printPage()" title="Yazdır / PDF olarak kaydet">
            Yazdır
          </button>
        </div>
      </header>

      <!-- Hero KPI şeridi — her zaman görünür organizasyon geneli özet -->
      <section class="hero-strip">
        <div *ngFor="let kpi of heroKpis" class="hero-card" [attr.data-trend]="kpi.trend">
          <div class="hero-label">{{ kpi.label }}</div>
          <div class="hero-value">{{ kpi.value }}</div>
          <div class="hero-hint">{{ kpi.hint }}</div>
        </div>
      </section>

      <!-- Rapor sekmeleri -->
      <nav class="report-tabs" aria-label="Rapor seçimi">
        <button
          *ngFor="let rep of reportOptions"
          type="button"
          class="report-tab"
          [class.active]="selectedReportId === rep.id"
          (click)="changeReport(rep.id)"
          [title]="rep.description"
        >
          <span class="tab-name">{{ rep.shortName }}</span>
        </button>
      </nav>

      <!-- Filtre paneli -->
      <section class="filter-panel" *ngIf="currentReport">
        <div class="filter-row">
          <div class="filter-group">
            <label>Şube</label>
            <select [value]="filterBranchId" (change)="filterBranchId = $any($event.target).value; applyFilters()" class="select-input">
              <option value="">Tüm Şubeler</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }} — {{ b.city }}</option>
            </select>
          </div>

          <div class="filter-group filter-group--date">
            <label>Tarih Aralığı</label>
            <div class="date-inputs">
              <div class="date-with-label">
                <span class="date-mini-label">Başlangıç</span>
                <app-smart-date-input [value]="filterStartDate" (valueChange)="filterStartDate = $event || ''; applyFilters()"></app-smart-date-input>
              </div>
              <div class="date-with-label">
                <span class="date-mini-label">Bitiş</span>
                <app-smart-date-input [value]="filterEndDate" (valueChange)="filterEndDate = $event || ''; applyFilters()"></app-smart-date-input>
              </div>
            </div>
          </div>

          <div class="filter-group" *ngIf="statusFilterOptions.length > 0">
            <label>Durum</label>
            <select [value]="filterStatus" (change)="filterStatus = $any($event.target).value; applyFilters()" class="select-input">
              <option value="">Tümü</option>
              <option *ngFor="let opt of statusFilterOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <div class="filter-group preset-group">
            <label>Hızlı Tarih</label>
            <div class="preset-buttons">
              <button class="preset-btn" type="button" (click)="setDatePreset('today')">Bugün</button>
              <button class="preset-btn" type="button" (click)="setDatePreset('7')">Son 7 gün</button>
              <button class="preset-btn" type="button" (click)="setDatePreset('30')">Son 30 gün</button>
              <button class="preset-btn" type="button" (click)="setDatePreset('all')">Tümü</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Rapor başlığı + tanım -->
      <div class="report-info-card" *ngIf="currentReport">
        <div class="info-body">
          <h3>{{ currentReport.name }}</h3>
          <p>{{ currentReport.description }}</p>
        </div>
        <div class="info-meta">
          <span class="meta-chip">{{ tableData.length }} kayıt</span>
          <span class="meta-chip" *ngIf="filterBranchId">Şube filtresi etkin</span>
          <span class="meta-chip" *ngIf="filterStartDate || filterEndDate">Tarih filtresi etkin</span>
          <span class="meta-chip" *ngIf="filterStatus">Durum: {{ statusFilterLabel(filterStatus) }}</span>
        </div>
      </div>

      <!-- Rapora özel KPI strip -->
      <div class="kpi-strip" *ngIf="summaryKpis.length > 0">
        <div *ngFor="let k of summaryKpis" class="kpi-card" [class]="'kpi-' + (k.color || 'gray')">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }}</div>
        </div>
      </div>

      <!-- Grafik + Tablo grid -->
      <div class="analytics-area">
        <div class="chart-card">
          <h3>Grafik Görünümü</h3>
          <div class="chart-wrapper">
            <canvas #chartCanvas></canvas>
            <div *ngIf="tableData.length === 0" class="chart-empty">
              Filtrelere uygun veri bulunamadı.
            </div>
          </div>
        </div>

        <div class="table-card">
          <h3>Detaylı Veri Tablosu</h3>
          <div class="table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th *ngFor="let col of tableColumns">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of pagedRows">
                  <td *ngFor="let col of tableKeys">
                    <ng-container [ngSwitch]="col">
                      <span *ngSwitchCase="'ratio'" class="font-bold">{{ row[col] }}%</span>
                      <span *ngSwitchCase="'avgPerformance'">
                        <span class="badge" [class.badge-green]="row[col] >= 85" [class.badge-blue]="row[col] >= 70 && row[col] < 85" [class.badge-orange]="row[col] < 70">{{ row[col] }} / 100</span>
                      </span>
                      <span *ngSwitchCase="'fuelLevel'" class="badge" [class.badge-orange]="row[col] < 30" [class.badge-green]="row[col] >= 30">%{{ row[col] }}</span>
                      <span *ngSwitchCase="'statusLabel'" class="badge" [class.badge-green]="row.statusKey === 'COMPLETED' || row.statusKey === 'CLOSED' || row.statusKey === 'AVAILABLE' || row.statusKey === 'ACTIVE'" [class.badge-orange]="row.statusKey === 'PARTIALLY_COMPLETED' || row.statusKey === 'IN_PROGRESS' || row.statusKey === 'MAINTENANCE'" [class.badge-red]="row.statusKey === 'FAILED' || row.statusKey === 'CANCELLED' || row.statusKey === 'OUT_OF_SERVICE'">{{ row[col] }}</span>
                      <span *ngSwitchCase="'difference'" class="badge badge-red">−{{ row[col] }}</span>
                      <span *ngSwitchDefault>{{ row[col] }}</span>
                    </ng-container>
                  </td>
                </tr>
                <tr *ngIf="tableData.length === 0">
                  <td [attr.colspan]="tableColumns.length" class="empty-row">Filtrelere uygun veri bulunamadı.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tablo sayfalama -->
          <div class="table-pagination" *ngIf="tableData.length > pageSize">
            <span class="page-info">
              Toplam <strong>{{ tableData.length }}</strong> kayıt — {{ pageStart + 1 }}-{{ pageEnd }} arası
            </span>
            <div class="page-controls">
              <button [disabled]="currentPage === 1" (click)="setPage(1)">«</button>
              <button [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)">‹</button>
              <span class="page-num">{{ currentPage }} / {{ totalPages }}</span>
              <button [disabled]="currentPage >= totalPages" (click)="setPage(currentPage + 1)">›</button>
              <button [disabled]="currentPage >= totalPages" (click)="setPage(totalPages)">»</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./reports-dashboard.component.scss']
})
export class ReportsDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private storage = inject(StorageService);

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  branches: Branch[] = [];
  workOrders: WorkOrder[] = [];
  spareParts: SparePart[] = [];
  requests: ServiceRequest[] = [];
  technicians: Technician[] = [];
  vehicles: Vehicle[] = [];

  reportOptions: ReportOption[] = [
    { id: 'branch-load', name: 'Şube Bazlı İş Emri Dağılımı', shortName: 'Şube Yükü',
      chartType: 'bar', group: 'operations',
      description: 'Her şubenin toplam iş emri sayısını, açık/tamamlanan kırılımını ve günlük doluluk oranını karşılaştırır.' },
    { id: 'completion-rate', name: 'İş Tamamlama Başarı Oranı', shortName: 'Tamamlama Oranı',
      chartType: 'pie', group: 'operations',
      description: 'Tüm iş emirlerinin durum bazlı dağılımı; başarı, kısmi başarı, başarısız ve iptal oranları.' },
    { id: 'sla-delay', name: 'SLA Gecikme Raporu', shortName: 'SLA Gecikmesi',
      chartType: 'doughnut', group: 'sla',
      description: 'SLA süresini aşan ve zamanında kapatılan taleplerin şube bazlı karşılaştırması.' },
    { id: 'technician-perf', name: 'Teknisyen Performans Raporu', shortName: 'Teknisyen Performansı',
      chartType: 'bar', group: 'people',
      description: 'Her teknisyenin performans puanı, tamamlanan iş sayısı ve seviyesi.' },
    { id: 'vehicle-usage', name: 'Araç Kullanım Raporu', shortName: 'Araç Kullanımı',
      chartType: 'doughnut', group: 'fleet',
      description: 'Filo durumunun (müsait, görevde, bakımda, pasif) ve şube bazlı dağılımı.' },
    { id: 'category-dist', name: 'Servis Talep Kategori Dağılımı', shortName: 'Kategori Dağılımı',
      chartType: 'pie', group: 'operations',
      description: 'Gelen taleplerin yetkinlik / kategori bazlı dağılımı; hangi alanda daha çok talep var.' },
    { id: 'part-stock', name: 'Parça Stok Raporu', shortName: 'Stok Durumu',
      chartType: 'bar', group: 'inventory',
      description: 'Yedek parçaların şube bazlı stok adedi, rezerve miktarı ve kategorisi.' },
    { id: 'critical-stock', name: 'Kritik Stok Raporu', shortName: 'Kritik Stok',
      chartType: 'bar', group: 'inventory',
      description: 'Minimum eşik altına düşen yedek parçalar; acil ikmal gerekenleri listeler.' }
  ];

  currentReport: ReportOption | undefined;
  summaryKpis: { label: string; value: string | number; color?: string }[] = [];
  heroKpis: HeroKpi[] = [];

  selectedReportId: ReportId = 'branch-load';

  filterBranchId = '';
  filterStartDate = '';
  filterEndDate = '';
  filterStatus = '';

  statusFilterOptions: { value: string; label: string }[] = [];

  tableColumns: string[] = [];
  tableKeys: string[] = [];
  tableData: ReportRow[] = [];

  // Pagination
  pageSize = 10;
  currentPage = 1;

  private chartInstance: any = null;

  ngOnInit(): void {
    this.loadCollections();
    this.computeHeroKpis();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.changeReport(this.selectedReportId), 100);
  }

  ngOnDestroy(): void {
    if (this.chartInstance) this.chartInstance.destroy();
  }

  loadCollections(): void {
    this.branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
    this.workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    this.spareParts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
    this.requests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
    this.technicians = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
    this.vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
  }

  changeReport(id: ReportId): void {
    this.selectedReportId = id;
    this.filterStatus = '';
    this.currentPage = 1;
    this.updateStatusFilterOptions();
    this.applyFilters();
  }

  updateStatusFilterOptions(): void {
    if (this.selectedReportId === 'branch-load' || this.selectedReportId === 'completion-rate') {
      this.statusFilterOptions = Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));
    } else if (this.selectedReportId === 'sla-delay' || this.selectedReportId === 'category-dist') {
      this.statusFilterOptions = Object.entries(SERVICE_REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label }));
    } else if (this.selectedReportId === 'vehicle-usage') {
      this.statusFilterOptions = Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
    } else if (this.selectedReportId === 'technician-perf') {
      this.statusFilterOptions = [
        { value: 'ACTIVE_TECHS', label: 'Sadece Aktif' },
        { value: 'PASSIVE_TECHS', label: 'Sadece Pasif' }
      ];
    } else if (this.selectedReportId === 'part-stock') {
      this.statusFilterOptions = [
        { value: 'ACTIVE_PARTS', label: 'Sadece Aktif Parçalar' },
        { value: 'PASSIVE_PARTS', label: 'Sadece Pasif Parçalar' }
      ];
    } else {
      this.statusFilterOptions = [];
    }
  }

  statusFilterLabel(value: string): string {
    const opt = this.statusFilterOptions.find(o => o.value === value);
    return opt ? opt.label : value;
  }

  setDatePreset(preset: 'today' | '7' | '30' | 'all'): void {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    if (preset === 'today') {
      this.filterStartDate = fmt(today);
      this.filterEndDate = fmt(today);
    } else if (preset === '7') {
      const start = new Date(today.getTime() - 6 * 86400000);
      this.filterStartDate = fmt(start);
      this.filterEndDate = fmt(today);
    } else if (preset === '30') {
      const start = new Date(today.getTime() - 29 * 86400000);
      this.filterStartDate = fmt(start);
      this.filterEndDate = fmt(today);
    } else {
      this.filterStartDate = '';
      this.filterEndDate = '';
    }
    this.applyFilters();
  }

  resetFilters(): void {
    this.filterBranchId = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterStatus = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    switch (this.selectedReportId) {
      case 'branch-load': this.generateBranchLoadReport(); break;
      case 'part-stock': this.generatePartStockReport(); break;
      case 'completion-rate': this.generateCompletionRateReport(); break;
      case 'sla-delay': this.generateSlaDelayReport(); break;
      case 'technician-perf': this.generateTechnicianPerfReport(); break;
      case 'vehicle-usage': this.generateVehicleUsageReport(); break;
      case 'category-dist': this.generateCategoryDistReport(); break;
      case 'critical-stock': this.generateCriticalStockReport(); break;
    }
    this.refreshDerived();
    this.renderChart();
  }

  private refreshDerived(): void {
    this.currentReport = this.reportOptions.find(r => r.id === this.selectedReportId);
    this.summaryKpis = this.computeSummaryKpis();
    // Sayfalama: filtre/data değişince ilk sayfaya dön
    if ((this.currentPage - 1) * this.pageSize >= this.tableData.length) {
      this.currentPage = 1;
    }
  }

  private filterByDate(dateStr: string | null): boolean {
    if (!dateStr) return true;
    const time = new Date(dateStr).getTime();
    if (this.filterStartDate) {
      const start = new Date(this.filterStartDate + 'T00:00:00').getTime();
      if (time < start) return false;
    }
    if (this.filterEndDate) {
      const end = new Date(this.filterEndDate + 'T23:59:59').getTime();
      if (time > end) return false;
    }
    return true;
  }

  // ====================================================================
  // HERO KPI'lar — sayfa açılınca her zaman görünür
  // ====================================================================
  private computeHeroKpis(): void {
    const totalWO = this.workOrders.length;
    const completedWO = this.workOrders.filter(w => w.status === 'COMPLETED').length;
    const completionRate = totalWO > 0 ? Math.round((completedWO / totalWO) * 100) : 0;

    const openRequests = this.requests.filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED').length;
    const slaBreached = this.requests.filter(r => {
      if (r.status === 'CLOSED' || r.status === 'CANCELLED' || !r.slaDeadline) return false;
      return new Date(r.slaDeadline).getTime() < Date.now();
    }).length;

    const criticalParts = this.spareParts.filter(p => p.isActive && p.stockQuantity <= p.minStockThreshold).length;

    const activeTechs = this.technicians.filter(t => t.isActive);
    const avgPerf = activeTechs.length > 0
      ? Math.round(activeTechs.reduce((s, t) => s + (t.performanceScore || 0), 0) / activeTechs.length)
      : 0;

    this.heroKpis = [
      {
        label: 'Toplam İş Emri',
        value: totalWO,
        hint: `${completedWO} tamamlandı`,
        trend: 'flat'
      },
      {
        label: 'Tamamlanma Oranı',
        value: `%${completionRate}`,
        hint: completionRate >= 70 ? 'Hedef üzerinde' : 'Hedef altında',
        trend: completionRate >= 70 ? 'good' : 'bad'
      },
      {
        label: 'Açık Talepler',
        value: openRequests,
        hint: slaBreached > 0 ? `${slaBreached} SLA aşımı` : 'SLA aşımı yok',
        trend: slaBreached > 0 ? 'bad' : 'good'
      },
      {
        label: 'Kritik Stok',
        value: criticalParts,
        hint: criticalParts > 0 ? 'Acil ikmal gerekli' : 'Stok güvenli',
        trend: criticalParts > 0 ? 'bad' : 'good'
      },
      {
        label: 'Aktif Teknisyen',
        value: activeTechs.length,
        hint: `Ortalama performans %${avgPerf}`,
        trend: avgPerf >= 75 ? 'good' : 'flat'
      },
      {
        label: 'Aktif Şube',
        value: this.branches.filter(b => b.isActive).length,
        hint: `${this.vehicles.filter(v => v.isActive).length} aktif araç`,
        trend: 'flat'
      }
    ];
  }

  // ====================================================================
  // Rapor özel KPI'ları
  // ====================================================================
  private computeSummaryKpis(): { label: string; value: string | number; color?: string }[] {
    const rows = this.tableData;
    if (rows.length === 0) return [];
    const id = this.selectedReportId;

    if (id === 'branch-load') {
      const totalOrders = rows.reduce((s, r) => s + (Number(r.totalCount) || 0), 0);
      const avgOcc = rows.reduce((s, r) => s + (Number(r.ratio) || 0), 0) / rows.length;
      return [
        { label: 'Toplam İş Emri', value: totalOrders, color: 'blue' },
        { label: 'Listelenen Şube', value: rows.length, color: 'gray' },
        { label: 'Ortalama Bugünkü Doluluk', value: `%${Math.round(avgOcc)}`, color: avgOcc >= 80 ? 'red' : 'green' }
      ];
    }
    if (id === 'part-stock') {
      const totalStock = rows.reduce((s, r) => s + (Number(r.stockQuantity) || 0), 0);
      const totalReserved = rows.reduce((s, r) => s + (Number(r.reservedQuantity) || 0), 0);
      return [
        { label: 'Parça Çeşidi', value: rows.length, color: 'gray' },
        { label: 'Toplam Stok', value: totalStock, color: 'blue' },
        { label: 'Toplam Rezerve', value: totalReserved, color: 'orange' }
      ];
    }
    if (id === 'completion-rate') {
      const total = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
      const completed = rows.find(r => r.statusKey === 'COMPLETED')?.count || 0;
      const pct = total > 0 ? Math.round((Number(completed) / total) * 100) : 0;
      return [
        { label: 'Toplam İş Emri', value: total, color: 'gray' },
        { label: 'Tamamlanan', value: completed, color: 'green' },
        { label: 'Başarı Oranı', value: `%${pct}`, color: pct >= 70 ? 'green' : 'orange' }
      ];
    }
    if (id === 'sla-delay') {
      const totalReq = rows.reduce((s, r) => s + (Number(r.totalCount) || 0), 0);
      const totalDelayed = rows.reduce((s, r) => s + (Number(r.delayedCount) || 0), 0);
      const pct = totalReq > 0 ? Math.round((totalDelayed / totalReq) * 100) : 0;
      return [
        { label: 'Toplam Talep', value: totalReq, color: 'gray' },
        { label: 'SLA Aşımı', value: totalDelayed, color: totalDelayed > 0 ? 'red' : 'green' },
        { label: 'Genel Gecikme Oranı', value: `%${pct}`, color: pct > 20 ? 'red' : 'green' }
      ];
    }
    if (id === 'technician-perf') {
      const avg = Math.round(rows.reduce((s, r) => s + (Number(r.avgPerformance) || 0), 0) / rows.length);
      const top = rows.reduce((max, r) => Math.max(max, Number(r.avgPerformance) || 0), 0);
      return [
        { label: 'Listelenen Teknisyen', value: rows.length, color: 'gray' },
        { label: 'Ortalama Performans', value: `${avg} / 100`, color: avg >= 75 ? 'green' : 'orange' },
        { label: 'En Yüksek Puan', value: `${top} / 100`, color: 'blue' }
      ];
    }
    if (id === 'vehicle-usage') {
      const total = rows.length;
      const available = rows.filter(r => r.statusKey === 'AVAILABLE').length;
      const maintenance = rows.filter(r => r.statusKey === 'MAINTENANCE').length;
      return [
        { label: 'Toplam Araç', value: total, color: 'gray' },
        { label: 'Müsait', value: available, color: 'green' },
        { label: 'Bakımda', value: maintenance, color: 'orange' }
      ];
    }
    if (id === 'category-dist') {
      const total = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
      const topCat = rows.reduce((max, r) => Number(r.count) > Number(max.count || 0) ? r : max, rows[0]);
      return [
        { label: 'Kategori Sayısı', value: rows.length, color: 'gray' },
        { label: 'Toplam Talep', value: total, color: 'blue' },
        { label: 'En Yoğun Kategori', value: topCat?.categoryName || '—', color: 'orange' }
      ];
    }
    if (id === 'critical-stock') {
      const totalGap = rows.reduce((s, r) => s + (Number(r.difference) || 0), 0);
      return [
        { label: 'Kritik Parça Sayısı', value: rows.length, color: 'red' },
        { label: 'Toplam Eksik (Eşik − Stok)', value: totalGap, color: 'red' }
      ];
    }
    return [];
  }

  // ====================================================================
  // RAPOR JENERATORLERİ — hepsi Türkçe label haritalanmış
  // ====================================================================

  generateBranchLoadReport(): void {
    this.tableColumns = ['Şube Adı', 'Toplam İş Emri', 'Açık İş Emri', 'Tamamlanan', 'Bugünkü Doluluk'];
    this.tableKeys = ['branchName', 'totalCount', 'openCount', 'completedCount', 'ratio'];

    let filteredOrders = this.workOrders.filter(w => this.filterByDate(w.createdAt));
    if (this.filterStatus) filteredOrders = filteredOrders.filter(w => w.status === this.filterStatus);

    const ACTIVE_LOAD = new Set(['PLANNED', 'ON_THE_WAY', 'ON_SITE']);
    const isToday = (d: string | null) => {
      if (!d) return false;
      const dt = new Date(d);
      const today = new Date();
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    };

    this.tableData = this.branches.map(b => {
      const branchOrders = filteredOrders.filter(w => w.branchId === b.id);
      const totalCount = branchOrders.length;
      const openCount = branchOrders.filter(w => ['OPENED', 'PLANNED', 'ON_THE_WAY', 'ON_SITE', 'IN_PROGRESS'].includes(w.status)).length;
      const completedCount = branchOrders.filter(w => w.status === 'COMPLETED').length;
      // Bugünkü doluluk — gerçek operasyonel kapasite kullanımı
      const todayActive = this.workOrders.filter(w => w.branchId === b.id && w.plannedStart && isToday(w.plannedStart) && ACTIVE_LOAD.has(w.status)).length;
      const ratio = b.dailyCapacity > 0 ? Math.min(100, Math.round((todayActive / b.dailyCapacity) * 100)) : 0;

      return { branchName: b.name, totalCount, openCount, completedCount, ratio };
    });

    if (this.filterBranchId) {
      const target = this.branches.find(b => b.id === this.filterBranchId);
      if (target) this.tableData = this.tableData.filter(row => row.branchName === target.name);
    }
  }

  generatePartStockReport(): void {
    this.tableColumns = ['Parça Kodu', 'Parça Adı', 'Kategori', 'Şube', 'Stok', 'Rezerve', 'Min Eşik'];
    this.tableKeys = ['code', 'name', 'categoryLabel', 'branchName', 'stockQuantity', 'reservedQuantity', 'minStockThreshold'];

    let filtered = this.spareParts;
    if (this.filterBranchId) filtered = filtered.filter(p => p.branchId === this.filterBranchId);
    if (this.filterStatus === 'ACTIVE_PARTS') filtered = filtered.filter(p => p.isActive);
    else if (this.filterStatus === 'PASSIVE_PARTS') filtered = filtered.filter(p => !p.isActive);

    this.tableData = filtered.map(p => ({
      code: p.code,
      name: p.name,
      categoryLabel: PART_CATEGORY_LABELS[p.category] || p.category,
      branchName: this.branchName(p.branchId),
      stockQuantity: p.stockQuantity,
      reservedQuantity: p.reservedQuantity,
      minStockThreshold: p.minStockThreshold
    }));
  }

  generateCompletionRateReport(): void {
    this.tableColumns = ['İş Emri Durumu', 'Adet', 'Yüzde'];
    this.tableKeys = ['statusLabel', 'count', 'ratio'];

    let filtered = this.workOrders.filter(w => this.filterByDate(w.createdAt));
    if (this.filterBranchId) filtered = filtered.filter(w => w.branchId === this.filterBranchId);
    if (this.filterStatus) filtered = filtered.filter(w => w.status === this.filterStatus);

    const total = filtered.length;
    const statuses = Array.from(new Set(filtered.map(w => w.status)));

    this.tableData = statuses.map(st => {
      const count = filtered.filter(w => w.status === st).length;
      const ratio = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        statusKey: st,
        statusLabel: WORK_ORDER_STATUS_LABELS[st as keyof typeof WORK_ORDER_STATUS_LABELS] || st,
        count,
        ratio
      };
    }).sort((a, b) => b.count - a.count);
  }

  generateSlaDelayReport(): void {
    this.tableColumns = ['Şube', 'Toplam Talep', 'Zamanında', 'SLA Aşımı', 'Gecikme Oranı'];
    this.tableKeys = ['branchName', 'totalCount', 'onTimeCount', 'delayedCount', 'ratio'];

    let filtered = this.requests.filter(r => this.filterByDate(r.createdAt));
    if (this.filterStatus) filtered = filtered.filter(r => r.status === this.filterStatus);

    const isDelayed = (r: ServiceRequest) => {
      if (!r.slaDeadline) return false;
      const deadline = new Date(r.slaDeadline).getTime();
      const isOverdue = deadline < Date.now();
      return r.status !== 'CLOSED' && r.status !== 'CANCELLED' && isOverdue;
    };

    this.tableData = this.branches.map(b => {
      const branchReqs = filtered.filter(r => r.branchId === b.id);
      const totalCount = branchReqs.length;
      const delayedCount = branchReqs.filter(isDelayed).length;
      const onTimeCount = totalCount - delayedCount;
      const ratio = totalCount > 0 ? Math.round((delayedCount / totalCount) * 100) : 0;
      return { branchName: b.name, totalCount, onTimeCount, delayedCount, ratio };
    });

    if (this.filterBranchId) {
      const target = this.branches.find(b => b.id === this.filterBranchId);
      if (target) this.tableData = this.tableData.filter(row => row.branchName === target.name);
    }
  }

  generateTechnicianPerfReport(): void {
    this.tableColumns = ['Teknisyen', 'Şube', 'Seviye', 'Tamamlanan İş', 'Performans'];
    this.tableKeys = ['fullName', 'branchName', 'levelLabel', 'completedJobsCount', 'avgPerformance'];

    let filtered = this.technicians;
    if (this.filterBranchId) filtered = filtered.filter(t => t.branchId === this.filterBranchId);
    if (this.filterStatus === 'ACTIVE_TECHS') filtered = filtered.filter(t => t.isActive);
    else if (this.filterStatus === 'PASSIVE_TECHS') filtered = filtered.filter(t => !t.isActive);

    this.tableData = filtered.map(t => ({
      fullName: t.fullName,
      branchName: this.branchName(t.branchId),
      levelLabel: TECHNICIAN_LEVEL_LABELS[t.level] || t.level,
      completedJobsCount: t.completedJobsCount || 0,
      avgPerformance: t.performanceScore || 0
    })).sort((a, b) => b.avgPerformance - a.avgPerformance);
  }

  generateVehicleUsageReport(): void {
    this.tableColumns = ['Plaka', 'Şube', 'Marka / Model', 'Durum', 'Yakıt'];
    this.tableKeys = ['plateNumber', 'branchName', 'brandModel', 'statusLabel', 'fuelLevel'];

    let filtered = this.vehicles;
    if (this.filterBranchId) filtered = filtered.filter(v => v.branchId === this.filterBranchId);
    if (this.filterStatus) filtered = filtered.filter(v => v.status === this.filterStatus);

    this.tableData = filtered.map(v => ({
      plateNumber: v.plateNumber,
      branchName: this.branchName(v.branchId),
      brandModel: `${v.brand} ${v.model}`,
      statusKey: v.status,
      statusLabel: VEHICLE_STATUS_LABELS[v.status] || v.status,
      fuelLevel: v.fuelLevel
    }));
  }

  generateCategoryDistReport(): void {
    this.tableColumns = ['Kategori / Yetkinlik', 'Talep Sayısı', 'Yüzde'];
    this.tableKeys = ['categoryName', 'count', 'ratio'];

    let filtered = this.requests.filter(r => this.filterByDate(r.createdAt));
    if (this.filterBranchId) filtered = filtered.filter(r => r.branchId === this.filterBranchId);
    if (this.filterStatus) filtered = filtered.filter(r => r.status === this.filterStatus);

    const total = filtered.length;
    const skillMap: Record<string, number> = {};
    filtered.forEach(r => {
      const key = r.requiredSkill || 'OTHER';
      skillMap[key] = (skillMap[key] || 0) + 1;
    });

    this.tableData = Object.keys(skillMap).map(skill => {
      const count = skillMap[skill];
      const ratio = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        categoryName: SKILL_LABELS[skill] || skill,
        count,
        ratio
      };
    }).sort((a, b) => b.count - a.count);
  }

  generateCriticalStockReport(): void {
    this.tableColumns = ['Parça Kodu', 'Parça Adı', 'Kategori', 'Şube', 'Stok', 'Eşik', 'Eksik'];
    this.tableKeys = ['code', 'name', 'categoryLabel', 'branchName', 'stockQuantity', 'minStockThreshold', 'difference'];

    let filtered = this.spareParts.filter(p => p.stockQuantity <= p.minStockThreshold && p.isActive);
    if (this.filterBranchId) filtered = filtered.filter(p => p.branchId === this.filterBranchId);

    this.tableData = filtered.map(p => ({
      code: p.code,
      name: p.name,
      categoryLabel: PART_CATEGORY_LABELS[p.category] || p.category,
      branchName: this.branchName(p.branchId),
      stockQuantity: p.stockQuantity,
      minStockThreshold: p.minStockThreshold,
      difference: p.minStockThreshold - p.stockQuantity
    })).sort((a, b) => b.difference - a.difference);
  }

  private branchName(id: string): string {
    return this.branches.find(b => b.id === id)?.name || 'Belirsiz';
  }

  // ====================================================================
  // PAGINATION
  // ====================================================================
  get pageStart(): number { return (this.currentPage - 1) * this.pageSize; }
  get pageEnd(): number { return Math.min(this.pageStart + this.pageSize, this.tableData.length); }
  get totalPages(): number { return Math.max(1, Math.ceil(this.tableData.length / this.pageSize)); }
  get pagedRows(): ReportRow[] { return this.tableData.slice(this.pageStart, this.pageEnd); }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  // ====================================================================
  // CHART RENDERING
  // ====================================================================
  renderChart(): void {
    if (this.chartInstance) this.chartInstance.destroy();
    if (!this.chartCanvas) return;

    const opt = this.reportOptions.find(o => o.id === this.selectedReportId);
    if (!opt) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const palette = [
      'rgba(59, 130, 246, 0.85)', 'rgba(16, 185, 129, 0.85)', 'rgba(249, 115, 22, 0.85)',
      'rgba(239, 68, 68, 0.85)', 'rgba(139, 92, 246, 0.85)', 'rgba(236, 72, 153, 0.85)',
      'rgba(100, 116, 139, 0.85)', 'rgba(234, 179, 8, 0.85)', 'rgba(20, 184, 166, 0.85)',
      'rgba(168, 85, 247, 0.85)'
    ];
    const border = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#eab308', '#14b8a6', '#a855f7'];

    let labels: string[] = [];
    let dataValues: number[] = [];
    let datasetLabel = 'Değer';

    if (this.selectedReportId === 'branch-load') {
      labels = this.tableData.map(r => r.branchName);
      dataValues = this.tableData.map(r => r.totalCount);
      datasetLabel = 'Toplam İş Emri';
    } else if (this.selectedReportId === 'part-stock') {
      const top = [...this.tableData].sort((a, b) => b.stockQuantity - a.stockQuantity).slice(0, 10);
      labels = top.map(r => r.name);
      dataValues = top.map(r => r.stockQuantity);
      datasetLabel = 'Stok Adedi';
    } else if (this.selectedReportId === 'completion-rate') {
      labels = this.tableData.map(r => r.statusLabel);
      dataValues = this.tableData.map(r => r.count);
      datasetLabel = 'İş Emri Sayısı';
    } else if (this.selectedReportId === 'sla-delay') {
      labels = this.tableData.map(r => r.branchName);
      dataValues = this.tableData.map(r => r.delayedCount);
      datasetLabel = 'SLA Aşımı';
    } else if (this.selectedReportId === 'technician-perf') {
      const top = [...this.tableData].slice(0, 10);
      labels = top.map(r => r.fullName);
      dataValues = top.map(r => r.avgPerformance);
      datasetLabel = 'Performans Puanı';
    } else if (this.selectedReportId === 'vehicle-usage') {
      const counts: Record<string, number> = {};
      this.tableData.forEach(r => { counts[r.statusLabel] = (counts[r.statusLabel] || 0) + 1; });
      labels = Object.keys(counts);
      dataValues = Object.values(counts);
      datasetLabel = 'Araç Sayısı';
    } else if (this.selectedReportId === 'category-dist') {
      labels = this.tableData.map(r => r.categoryName);
      dataValues = this.tableData.map(r => r.count);
      datasetLabel = 'Talep Sayısı';
    } else if (this.selectedReportId === 'critical-stock') {
      const top = [...this.tableData].slice(0, 10);
      labels = top.map(r => r['name']);
      dataValues = top.map(r => r['difference']);
      datasetLabel = 'Eksik Adet';
    }

    const bgColors = labels.map((_, i) => palette[i % palette.length]);
    const borderColors = labels.map((_, i) => border[i % border.length]);

    const isPieLike = ['pie', 'doughnut'].includes(opt.chartType);
    const isDark = document.body.classList.contains('dark-theme');

    this.chartInstance = new Chart(ctx, {
      type: opt.chartType,
      data: {
        labels,
        datasets: [{
          label: datasetLabel,
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: isPieLike ? (isDark ? '#111827' : '#ffffff') : borderColors,
          borderWidth: isPieLike ? 3 : 0,
          borderRadius: isPieLike ? 6 : 10,
          borderSkipped: false,
          hoverOffset: isPieLike ? 10 : 0,
          maxBarThickness: 46
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Doughnut'ta geniş merkez boşluğu — modern halka görünümü
        cutout: opt.chartType === 'doughnut' ? '62%' : undefined,
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            display: isPieLike,
            position: 'bottom',
            labels: {
              font: { family: 'Inter', size: 11, weight: '600' },
              color: isDark ? '#cbd5e1' : '#475569',
              padding: 14,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.95)',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            boxPadding: 4,
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 11 }
          }
        },
        scales: isPieLike ? undefined : {
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: {
              color: isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7',
              drawTicks: false
            },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 }, padding: 8 }
          },
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  // ====================================================================
  // EXPORT & PRINT
  // ====================================================================
  exportData(format: 'json' | 'csv'): void {
    if (this.tableData.length === 0) return;
    const filename = `rapor-${this.selectedReportId}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.tableData, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      const header = this.tableColumns.join(',');
      const csvBody = this.tableData
        .map(row => this.tableKeys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const csv = '﻿' + header + '\r\n' + csvBody; // BOM for Excel TR uyumu
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  printPage(): void {
    window.print();
  }
}
