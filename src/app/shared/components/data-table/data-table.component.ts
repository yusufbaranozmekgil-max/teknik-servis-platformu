import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { SmartDateInputComponent } from '../smart-date-input/smart-date-input.component';
import { PermissionService } from '../../../core/services/permission.service';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'status' | 'boolean' | 'currency' | 'actions';
  filterMaxLength?: number;                                  // Text filter maxlength (override)
  filterMin?: number;                                         // Number filter min
  filterMax?: number;                                         // Number filter max
  filterInputMode?: 'letters' | 'digits' | 'text';            // Karakter sınıfı kısıtı
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, SmartDateInputComponent],
  template: `
    <div class="table-wrapper">
      <!-- Search & Filters Controls -->
      <div class="table-header-controls" *ngIf="showSearch">
        <div class="search-wrapper">
          <input
            type="text"
            [value]="searchQuery"
            (input)="onSearchInput($any($event.target).value)"
            placeholder="Tabloda ara..."
            class="global-search-input"
            [attr.maxlength]="searchMaxLength"
          />
          <span class="search-counter">{{ searchQuery.length }} / {{ searchMaxLength }}</span>
        </div>
        <button
          (click)="toggleFilters()"
          class="filter-toggle-btn"
          [class.active]="showFilters"
        >
          Gelişmiş Arama
        </button>
      </div>

      <!-- Main Data Table -->
      <div class="table-responsive">
        <table class="premium-table">
          <thead>
            <tr>
              <th *ngFor="let col of columns" (click)="sort(col)" [class.sortable]="col.sortable">
                <div class="th-content">
                  {{ col.label }}
                  <span class="sort-icon" *ngIf="col.sortable && sortKey === col.key">
                    {{ sortDirection === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>
            </tr>
            
            <!-- Column-based Filters Row -->
            <tr *ngIf="showFilters" class="filter-row" (click)="$event.stopPropagation()">
              <th *ngFor="let col of columns">
                <ng-container [ngSwitch]="col.type">
                  <!-- Actions column gets no filter -->
                  <span *ngSwitchCase="'actions'"></span>
                  
                  <!-- Date range filter (akıllı tarih girişi: GG/AA/YYYY) -->
                  <div *ngSwitchCase="'date'" class="date-filter-group">
                    <app-smart-date-input
                      [value]="dateRangeFilters[col.key].start || ''"
                      (valueChange)="dateRangeFilters[col.key].start = $event || ''; onFilterChange()"
                    ></app-smart-date-input>
                    <app-smart-date-input
                      [value]="dateRangeFilters[col.key].end || ''"
                      (valueChange)="dateRangeFilters[col.key].end = $event || ''; onFilterChange()"
                    ></app-smart-date-input>
                  </div>

                  <!-- Boolean filter -->
                  <select 
                    *ngSwitchCase="'boolean'" 
                    [value]="columnFilters[col.key] || ''" 
                    (change)="columnFilters[col.key] = $any($event.target).value; onFilterChange()"
                    class="filter-select"
                  >
                    <option value="">Tümü</option>
                    <option value="true">Evet</option>
                    <option value="false">Hayır</option>
                  </select>

                  <!-- Status filter -->
                  <select 
                    *ngSwitchCase="'status'" 
                    [value]="columnFilters[col.key] || ''" 
                    (change)="columnFilters[col.key] = $any($event.target).value; onFilterChange()"
                    class="filter-select"
                  >
                    <option value="">Tümü</option>
                    <option *ngFor="let opt of getUniqueStatusValues(col.key)" [value]="opt">
                      {{ opt }}
                    </option>
                  </select>

                  <!-- Number filter (min/max + JS-enforced maxlength + e/E/+ engeli) -->
                  <input
                    *ngSwitchCase="'number'"
                    type="number"
                    [value]="columnFilters[col.key] || ''"
                    (keydown)="onNumberKeyDown($event)"
                    (input)="onNumberFilterInput($any($event.target), col)"
                    placeholder="Ara..."
                    class="filter-input"
                    [attr.min]="col.filterMin ?? 0"
                    [attr.max]="col.filterMax ?? 100000"
                  />

                  <!-- Default text filter -->
                  <input
                    *ngSwitchDefault
                    type="text"
                    [value]="columnFilters[col.key] || ''"
                    (input)="onTextFilterInput($any($event.target), col)"
                    placeholder="Ara..."
                    class="filter-input"
                    [attr.maxlength]="col.filterMaxLength ?? filterMaxLength"
                  />
                </ng-container>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of paginatedData; trackBy: trackByFn" (click)="onRowClick(row)">
              <td *ngFor="let col of columns">
                <!-- Cell Content Formatting -->
                <ng-container [ngSwitch]="col.type">
                  <span *ngSwitchCase="'currency'" class="cell-currency">
                    {{ row[col.key] | currency:'TRY':'symbol-narrow':'1.2-2' }}
                  </span>
                  
                  <span *ngSwitchCase="'date'" class="cell-date">
                    {{ row[col.key] ? (row[col.key] | date:'dd.MM.yyyy HH:mm') : '-' }}
                  </span>
                  
                  <span *ngSwitchCase="'boolean'" class="cell-boolean" [ngClass]="row[col.key] ? 'bool-true' : 'bool-false'">
                    {{ row[col.key] ? 'Evet' : 'Hayır' }}
                  </span>

                  <app-status-badge *ngSwitchCase="'status'" [status]="row[col.key]"></app-status-badge>

                  <span *ngSwitchCase="'actions'" class="cell-actions" (click)="$event.stopPropagation()">
                    <button *ngIf="showScheduleBtn && permissionService.hasPermission('WORK_ORDER_PLAN')" class="action-btn schedule-btn" (click)="onScheduleClick(row)">Takvim</button>
                    <button *ngIf="showPerformanceBtn && permissionService.hasPermission('TECHNICIAN_VIEW')" class="action-btn performance-btn" (click)="onPerformanceClick(row)">Performans</button>
                    <button *ngIf="showEditBtn && (!requiredEditPermission || permissionService.hasPermission($any(requiredEditPermission)))" class="action-btn edit-btn" (click)="onEditClick(row)">{{ editLabel }}</button>
                    <button *ngIf="showDeleteBtn && (!requiredDeletePermission || permissionService.hasPermission($any(requiredDeletePermission)))" class="action-btn delete-btn" (click)="onDeleteClick(row)">Sil</button>
                  </span>

                  <span *ngSwitchDefault>
                    {{ row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-' }}
                  </span>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="filteredData.length === 0">
              <td [attr.colspan]="columns.length" class="empty-state-cell">
                <div class="empty-state-container">
                  <div class="empty-state-icon"></div>
                  <div class="empty-state-title">Kayıt Bulunmadı</div>
                  <div class="empty-state-desc">Arama kriterlerinize veya filtrelerinize uygun herhangi bir veri bulunamadı. Lütfen kriterlerinizi kontrol edin veya yeni bir arama yapın.</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination (sayfa boyutu 5 sabit) -->
      <div class="mini-pagination" *ngIf="showPagination && filteredData.length > 0">
        <div class="page-info">
          Toplam <strong>{{ filteredData.length }}</strong> kayıt — {{ startIndex + 1 }}-{{ endIndex }} arası
        </div>
        <div class="page-controls">
          <button [disabled]="currentPage === 1" (click)="setPage(1)" title="İlk sayfa">«</button>
          <button [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)" title="Önceki">‹</button>
          <span class="page-num">{{ currentPage }} / {{ totalPages || 1 }}</span>
          <button [disabled]="currentPage >= totalPages" (click)="setPage(currentPage + 1)" title="Sonraki">›</button>
          <button [disabled]="currentPage >= totalPages" (click)="setPage(totalPages)" title="Son sayfa">»</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./data-table.component.scss']
})
export class DataTableComponent implements OnInit, OnChanges {
  @Input() data: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() showSearch = true;
  @Input() showPagination = true;
  /** Sayfa boyutu sabit 5 — kullanıcı değiştirememeli (UI tutarlılığı için). */
  readonly pageSize = 5;
  @Input() searchMaxLength = 30;
  @Input() filterMaxLength = 25;
  @Input() showScheduleBtn = false;
  @Input() showPerformanceBtn = false;
  @Input() showEditBtn = true;
  @Input() showDeleteBtn = true;
  @Input() requiredEditPermission = '';
  @Input() requiredDeletePermission = '';
  // Salt-okunur detay açan listelerde "Görüntüle" olarak ayarlanır (düzenlenecek bilgi yoksa).
  @Input() editLabel = 'Düzenle';

  permissionService = inject(PermissionService);

  @Output() rowClick = new EventEmitter<any>();
  @Output() editClick = new EventEmitter<any>();
  @Output() deleteClick = new EventEmitter<any>();
  @Output() scheduleClick = new EventEmitter<any>();
  @Output() performanceClick = new EventEmitter<any>();

  onScheduleClick(row: any): void {
    this.scheduleClick.emit(row);
  }

  onPerformanceClick(row: any): void {
    this.performanceClick.emit(row);
  }

  searchQuery = '';
  sortKey = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage = 1;
  showFilters = false;

  // RxJS debounce: 5.000+ kayıtlı listede her tuş vuruşunda filtreleme yapmak
  // yerine kullanıcı yazmayı bıraktıktan 250ms sonra tek sefer süzülür (Bölüm 21.6 ölçek şartı).
  private readonly searchInput$ = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.onSearchChange());
  }

  columnFilters: { [key: string]: string } = {};
  dateRangeFilters: { [key: string]: { start: string; end: string } } = {};

  filteredData: any[] = [];
  paginatedData: any[] = [];

  ngOnInit(): void {
    this.initFilters();
    this.processData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.initFilters();
    }
    if (changes['data'] || changes['pageSize'] || changes['columns']) {
      this.currentPage = 1;
      this.processData();
    }
  }

  initFilters(): void {
    this.columnFilters = {};
    this.dateRangeFilters = {};
    this.columns.forEach(col => {
      if (col.key !== 'actions') {
        this.columnFilters[col.key] = '';
        if (col.type === 'date') {
          this.dateRangeFilters[col.key] = { start: '', end: '' };
        }
      }
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    if (!this.showFilters) {
      // Clear filters on close
      this.initFilters();
      this.processData();
    }
  }

  processData(): void {
    let result = [...this.data];

    // Global Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(row => {
        return Object.keys(row).some(key => {
          const val = row[key];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        });
      });
    }

    // Column Filters
    Object.keys(this.columnFilters).forEach(key => {
      const filterVal = this.columnFilters[key];
      if (filterVal !== undefined && filterVal !== null && filterVal !== '') {
        const col = this.columns.find(c => c.key === key);
        if (col) {
          if (col.type === 'boolean') {
            const boolVal = filterVal === 'true';
            result = result.filter(row => row[key] === boolVal);
          } else {
            result = result.filter(row => {
              const val = row[key];
              return val !== null && val !== undefined && String(val).toLowerCase().includes(filterVal.toLowerCase());
            });
          }
        }
      }
    });

    // Date Range Filters
    Object.keys(this.dateRangeFilters).forEach(key => {
      const range = this.dateRangeFilters[key];
      if (range && (range.start || range.end)) {
        result = result.filter(row => {
          const val = row[key];
          if (!val) return false;
          const rowTime = new Date(val).getTime();
          
          if (range.start) {
            const startTime = new Date(range.start + 'T00:00:00').getTime();
            if (rowTime < startTime) return false;
          }
          if (range.end) {
            const endTime = new Date(range.end + 'T23:59:59').getTime();
            if (rowTime > endTime) return false;
          }
          return true;
        });
      }
    });

    // Sorting
    if (this.sortKey) {
      result.sort((a, b) => {
        let valA = a[this.sortKey];
        let valB = b[this.sortKey];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredData = result;
    this.updatePagination();
  }

  updatePagination(): void {
    if (!this.showPagination) {
      this.paginatedData = this.filteredData;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedData = this.filteredData.slice(start, end);
  }

  sort(col: TableColumn): void {
    if (!col.sortable) return;

    if (this.sortKey === col.key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = col.key;
      this.sortDirection = 'asc';
    }
    this.processData();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.processData();
  }

  /**
   * HTML <input type="number"> maxlength attribute'unu yoksayar; bu yüzden
   * number filtrelerinde uzunluğu manuel kesiyoruz. Varsayılan 10 karakter.
   */
  /** Text filtresi için karakter sınıfı + maxlength filtresi. */
  onTextFilterInput(target: HTMLInputElement, col: TableColumn): void {
    let v = target.value ?? '';
    if (col.filterInputMode === 'letters') {
      const cleaned = v.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s'-]/g, '');
      if (cleaned !== v) { v = cleaned; target.value = v; }
    } else if (col.filterInputMode === 'digits') {
      const cleaned = v.replace(/[^0-9]/g, '');
      if (cleaned !== v) { v = cleaned; target.value = v; }
    }
    const maxLen = col.filterMaxLength ?? this.filterMaxLength;
    if (maxLen && v.length > maxLen) {
      v = v.slice(0, maxLen);
      target.value = v;
    }
    this.columnFilters[col.key] = v;
    this.onFilterChange();
  }

  /** type="date" inputlarında geçersiz gün'ü o ayın son geçerli gününe clamp et. */
  onDateRangeChange(target: HTMLInputElement, key: string, endpoint: 'start' | 'end'): void {
    const raw = target.value ?? '';
    if (!raw) return;
    const m = /^(\d{1,5})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (!m) return;
    let year = +m[1], month = +m[2], day = +m[3];
    if (year < 1900) year = 1900;
    if (year > 2099) year = 2099;
    if (month < 1) month = 1;
    if (month > 12) month = 12;
    const last = new Date(year, month, 0).getDate();
    if (day < 1) day = 1;
    if (day > last) day = last;
    const normalized = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (normalized !== raw) {
      target.value = normalized;
      this.dateRangeFilters[key][endpoint] = normalized;
      this.onFilterChange();
    }
  }

  /** type="number"'da 'e', 'E', '+' tuşlarını engelle (bilimsel gösterim sınırı bozar). */
  onNumberKeyDown(ev: KeyboardEvent): void {
    if (['e', 'E', '+'].includes(ev.key)) {
      ev.preventDefault();
    }
  }

  onNumberFilterInput(target: HTMLInputElement, col: TableColumn): void {
    const maxLen = col.filterMaxLength ?? 10;
    let v = target.value ?? '';
    // Yapıştırma yoluyla gelen e/E/+ temizliği
    const cleaned = v.replace(/[eE+]/g, '');
    if (cleaned !== v) { v = cleaned; target.value = v; }
    if (v.length > maxLen) {
      v = v.slice(0, maxLen);
      target.value = v;
    }
    if (v !== '') {
      const num = Number(v);
      if (col.filterMax !== undefined && num > col.filterMax) {
        v = String(col.filterMax);
        target.value = v;
      }
    }
    this.columnFilters[col.key] = v;
    this.onFilterChange();
  }

  onSearchInput(value: string): void {
    // Servis tarafında da kırpma — kullanıcı maxlength'i devre dışı bırakırsa diye
    this.searchQuery = (value ?? '').slice(0, this.searchMaxLength);
    // Filtreleme debounce'lu çalışır (RxJS); sayaç ise anında güncellenir.
    this.searchInput$.next(this.searchQuery);
  }

  // pageSize sabit 5 — değiştirilemez. (Eski changePageSize metodu kaldırıldı.)

  onFilterChange(): void {
    this.currentPage = 1;
    this.processData();
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.filteredData.length / this.pageSize);
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  get endIndex(): number {
    return Math.min(this.startIndex + this.pageSize, this.filteredData.length);
  }

  onRowClick(row: any): void {
    this.rowClick.emit(row);
  }

  onEditClick(row: any): void {
    this.editClick.emit(row);
  }

  onDeleteClick(row: any): void {
    this.deleteClick.emit(row);
  }

  trackByFn(index: number, item: any): string {
    return item.id || String(index);
  }

  getUniqueStatusValues(key: string): string[] {
    const values = this.data
      .map(row => row[key])
      .filter(v => v !== null && v !== undefined && v !== '');
    return Array.from(new Set(values));
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    return 'status-' + status.toLowerCase().replace(/\s/g, '_');
  }
}
