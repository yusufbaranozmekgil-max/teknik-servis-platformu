import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLogService } from '../../../../core/services/audit-log.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { AuditLog } from '../../../../core/models/audit-log.model';
import { UserRole } from '../../../../core/models/user-role.model';
import { StatusLabelPipe } from '../../../../shared/pipes/status-label.pipe';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';
import { SmartDateInputComponent } from '../../../../shared/components/smart-date-input/smart-date-input.component';

@Component({
  selector: 'app-audit-list',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe, RoleLabelPipe, SmartDateInputComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div>
          <h2>Sistem Değişiklik Günlüğü</h2>
          <p class="subtitle">Sistem üzerinde gerçekleştirilen tüm veri kayıt, güncelleme, silme, durum geçişleri ve yetkilendirme hareketleri burada listelenir.</p>
        </div>
        <div class="export-buttons">
          <button (click)="exportLogs('csv')" class="btn-export" [disabled]="filteredLogs.length === 0">CSV İndir</button>
          <button (click)="exportLogs('json')" class="btn-export" [disabled]="filteredLogs.length === 0">JSON İndir</button>
        </div>
      </div>

      <!-- Değiştirilemezlik bilgisi — kasıtlı tasarım -->
      <div class="immutable-banner">
        <strong>Denetim güvenliği:</strong> Bu kayıtlar izlenebilirlik gereği <u>silinemez ve düzenlenemez</u>.
        Güvenlik ihlali dahil tüm girdiler kalıcıdır; yalnızca görüntüleme, filtreleme ve dışa aktarma yapılabilir.
      </div>

      <!-- Filtre Paneli -->
      <div class="card filter-card">
        <div class="filter-grid">
          <div class="form-group">
            <label>Arama (Açıklama, Kullanıcı, ID)</label>
            <input type="text" [value]="searchQuery" (input)="searchQuery = $any($event.target).value; applyFilters()" placeholder="Arama yapın..." class="form-control" />
          </div>

          <div class="form-group">
            <label>Varlık Türü (Entity)</label>
            <select [value]="entityFilter" (change)="entityFilter = $any($event.target).value; applyFilters()" class="form-control">
              <option value="">Tümü</option>
              <option value="BRANCH">Şube</option>
              <option value="TECHNICIAN">Teknisyen</option>
              <option value="SPARE_PART">Yedek Parça</option>
              <option value="SERVICE_REQUEST">Servis Talebi</option>
              <option value="WORK_ORDER">İş Emri</option>
              <option value="VEHICLE">Araç</option>
              <option value="RULE">İş Kuralı</option>
              <option value="SYSTEM">Sistem</option>
            </select>
          </div>

          <div class="form-group">
            <label>İşlem Türü (Action)</label>
            <select [value]="actionFilter" (change)="actionFilter = $any($event.target).value; applyFilters()" class="form-control">
              <option value="">Tümü</option>
              <option value="CREATE">Oluşturma</option>
              <option value="UPDATE">Güncelleme</option>
              <option value="DELETE">Silme</option>
              <option value="STATE_TRANSITION">Durum Geçişi</option>
              <option value="SECURITY_VIOLATION">Güvenlik İhlali</option>
              <option value="SYSTEM_EVENT">Sistem Olayı</option>
              <option value="IMPORT">İçe Aktarma</option>
            </select>
          </div>

          <div class="form-group">
            <label>Kullanıcı Rolü</label>
            <select [value]="roleFilter" (change)="roleFilter = $any($event.target).value; applyFilters()" class="form-control">
              <option value="">Tümü</option>
              <option value="SYSTEM_ADMIN">Sistem Yöneticisi</option>
              <option value="BRANCH_MANAGER">Şube Müdürü</option>
              <option value="DISPATCHER">Planlama Sorumlusu</option>
              <option value="TECHNICIAN">Teknisyen</option>
            </select>
          </div>

          <div class="form-group">
            <label>Tarih Filtresi</label>
            <app-smart-date-input [value]="dateFilter" (valueChange)="dateFilter = $event || ''; applyFilters()"></app-smart-date-input>
          </div>
        </div>
      </div>

      <!-- Log Tablosu -->
      <div class="card table-card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>İşlem</th>
                <th>Varlık</th>
                <th>Açıklama</th>
                <th>Sonuç</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of paginatedLogs" [class.failed-row]="log.result === 'FAILURE'">
                <td>{{ log.createdAt | date:'dd.MM.yyyy HH:mm:ss' }}</td>
                <td class="font-bold">{{ log.username }}</td>
                <td><span class="role-badge">{{ log.userRole | roleLabel }}</span></td>
                <td><span class="action-badge" [class]="log.actionType.toLowerCase()">{{ log.actionType | statusLabel:'action' }}</span></td>
                <td>
                  <div class="entity-cell">
                    <span class="entity-badge">{{ log.entityType | statusLabel:'entity' }}</span>
                    <span class="entity-name" *ngIf="entityDisplayName(log)">{{ entityDisplayName(log) }}</span>
                  </div>
                </td>
                <td class="desc-cell">{{ humanizeDescription(log) }}</td>
                <td>
                  <span class="result-badge" [class]="(log.result || 'SUCCESS').toLowerCase()">{{ (log.result || 'SUCCESS') | statusLabel:'result' }}</span>
                </td>
                <td>
                  <button (click)="openDetailModal(log)" class="view-btn">Farkı İncele</button>
                </td>
              </tr>
              <tr *ngIf="filteredLogs.length === 0">
                <td colspan="8" class="text-center text-muted">Arama kriterlerine uygun güncellenmiş kayıt bulunamadı.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination (sayfa boyutu 5 sabit) -->
        <div class="audit-pagination" *ngIf="filteredLogs.length > 0">
          <span class="page-info">
            Toplam <strong>{{ filteredLogs.length }}</strong> kayıt — {{ startIdx + 1 }}–{{ endIdx }} arası
          </span>
          <div class="page-controls">
            <button [disabled]="page === 1" (click)="setPage(1)" title="İlk">«</button>
            <button [disabled]="page === 1" (click)="setPage(page - 1)" title="Önceki">‹</button>
            <span class="page-num">{{ page }} / {{ totalPages || 1 }}</span>
            <button [disabled]="page >= totalPages" (click)="setPage(page + 1)" title="Sonraki">›</button>
            <button [disabled]="page >= totalPages" (click)="setPage(totalPages)" title="Son">»</button>
          </div>
        </div>
      </div>

      <!-- Detay Modal (Fark Görünümü ile) -->
      <div class="modal-backdrop" *ngIf="isModalOpen && selectedLog">
        <div class="modal-box">
          <div class="modal-header">
            <h3>İşlem Detayları ve Değişim Farkları</h3>
            <button (click)="closeModal()" class="close-btn">&times;</button>
          </div>
          
          <div class="modal-body">
            <div class="meta-info-grid">
              <p><strong>Log ID:</strong> {{ selectedLog.id }}</p>
              <p><strong>Tarih:</strong> {{ selectedLog.createdAt | date:'dd.MM.yyyy HH:mm:ss' }}</p>
              <p><strong>Kullanıcı (ID):</strong> {{ selectedLog.username }} ({{ selectedLog.userId }})</p>
              <p><strong>Rol / IP Adresi:</strong> {{ selectedLog.userRole | roleLabel }} / {{ selectedLog.simulatedIp }}</p>
              <p><strong>Etkilenen Kayıt:</strong> {{ selectedLog.entityType | statusLabel:'entity' }}{{ entityDisplayName(selectedLog) ? ' — ' + entityDisplayName(selectedLog) : '' }}</p>
              <p><strong>İşlem Durumu:</strong>
                <span class="result-badge" [class]="(selectedLog.result || 'SUCCESS').toLowerCase()">{{ (selectedLog.result || 'SUCCESS') | statusLabel:'result' }}</span>
              </p>
            </div>

            <!-- Ne oldu? — olayın sade dille anlatımı -->
            <div class="explain-box" [class.explain-danger]="selectedLog.actionType === 'SECURITY_VIOLATION'">
              <h4>Ne oldu?</h4>
              <p *ngFor="let line of getExplanation(selectedLog)">{{ line }}</p>
            </div>

            <div class="alert alert-danger" *ngIf="selectedLog.result === 'FAILURE'">
              <strong>Başarısızlık Gerekçesi:</strong> {{ selectedLog.failureReason || 'Belirtilmedi.' }}
            </div>

            <div class="diff-section">
              <h4>Veri Değişim Detayı</h4>
              
              <!-- Case 1: Create (No oldValue) -->
              <div *ngIf="selectedLog.actionType === 'CREATE'" class="diff-summary create">
                <p class="summary-text">Nesne ilk kez oluşturuldu. Detaylar:</p>
                <pre class="json-code">{{ parsePrettyJson(selectedLog.newValue) }}</pre>
              </div>

              <!-- Case 2: Delete (No newValue) -->
              <div *ngIf="selectedLog.actionType === 'DELETE'" class="diff-summary delete">
                <p class="summary-text">Nesne veritabanından silindi. Son durum:</p>
                <pre class="json-code">{{ parsePrettyJson(selectedLog.oldValue) }}</pre>
              </div>

              <!-- Case 3: Update / State Transition (Show key-by-key comparison) -->
              <div *ngIf="(selectedLog.actionType === 'UPDATE' || selectedLog.actionType === 'STATE_TRANSITION') && getDiffList().length > 0">
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th>Alan</th>
                      <th>Eski Değer</th>
                      <th>Yeni Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of getDiffList()">
                      <td class="diff-key">{{ translateFieldName(item.key) }}</td>
                      <td class="diff-old">{{ stringifyDiffVal(item.old) }}</td>
                      <td class="diff-new">{{ stringifyDiffVal(item.new) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Case 4: No change or unparseable -->
              <div *ngIf="(selectedLog.actionType === 'UPDATE' || selectedLog.actionType === 'STATE_TRANSITION') && getDiffList().length === 0" class="diff-summary info">
                <p class="summary-text">Değişen özellik bulunamadı veya ham log değeri kaydedildi.</p>
                <div class="raw-values-grid">
                  <div>
                    <h5>Eski Değer</h5>
                    <pre class="raw-code">{{ selectedLog.oldValue || 'Boş' }}</pre>
                  </div>
                  <div>
                    <h5>Yeni Değer</h5>
                    <pre class="raw-code">{{ selectedLog.newValue || 'Boş' }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button (click)="closeModal()" class="btn btn-secondary">Kapat</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./audit-list.component.scss']
})
export class AuditListComponent implements OnInit {
  private auditService = inject(AuditLogService);
  private storage = inject(StorageService);

  // Logs
  logs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];

  // Filter models
  searchQuery = '';
  entityFilter = '';
  actionFilter = '';
  roleFilter = '';
  dateFilter = '';

  // Pagination — sayfa boyutu 5 sabit
  page = 1;
  readonly pageSize = 5;

  // Modal details
  isModalOpen = false;
  selectedLog: AuditLog | null = null;

  get totalPages(): number { return Math.ceil(this.filteredLogs.length / this.pageSize); }
  get startIdx(): number { return (this.page - 1) * this.pageSize; }
  get endIdx(): number { return Math.min(this.startIdx + this.pageSize, this.filteredLogs.length); }
  get paginatedLogs(): AuditLog[] { return this.filteredLogs.slice(this.startIdx, this.endIdx); }
  setPage(p: number): void { if (p >= 1 && p <= this.totalPages) this.page = p; }
  /** Geriye uyumluluk için tutulan boş metod (pageSize sabit 5). */
  changePageSize(_s: number): void { /* no-op */ }

  // İnsanlaştırma sözlükleri
  private readonly ACTION_VERB: Record<string, string> = {
    CREATE: 'oluşturdu',
    UPDATE: 'güncelledi',
    DELETE: 'sildi',
    STATE_TRANSITION: 'durumunu değiştirdi',
    SECURITY_VIOLATION: 'yetkisiz işlem denedi',
    SYSTEM_EVENT: 'sistem olayı tetikledi',
    IMPORT: 'içe aktardı'
  };
  private readonly ENTITY_LABEL: Record<string, string> = {
    BRANCH: 'şube',
    TECHNICIAN: 'teknisyen',
    SPARE_PART: 'yedek parça',
    SERVICE_REQUEST: 'servis talebi',
    WORK_ORDER: 'iş emri',
    VEHICLE: 'araç',
    RULE: 'iş kuralı',
    SYSTEM: 'sistem',
    PART_RESERVATION: 'parça rezervasyonu'
  };

  /**
   * Log için Türkçe, doğal cümle üretir. Eğer service tarafında özel description varsa onu
   * tercih eder; aksi halde actionType + entityType'tan otomatik cümle kurar.
   */
  humanizeDescription(log: AuditLog): string {
    // Service tarafında zaten anlamlı bir Türkçe açıklama varsa olduğu gibi göster
    const raw = (log.description || '').trim();
    const looksGeneric = !raw || /^[A-Z_]+\b/.test(raw) || raw.toUpperCase() === raw && raw.length < 25;
    if (!looksGeneric) return raw;

    const verb = this.ACTION_VERB[log.actionType] ?? log.actionType.toLowerCase();
    const entity = this.ENTITY_LABEL[log.entityType] ?? log.entityType.toLowerCase();
    const user = log.username || 'Kullanıcı';
    const resultSuffix = log.result === 'FAILURE'
      ? ` — [BAŞARISIZ]${log.failureReason ? ': ' + log.failureReason : ''}`
      : '';

    if (log.actionType === 'SECURITY_VIOLATION') {
      return `${user}, yetkisiz bir işlem girişiminde bulundu (${entity}).${resultSuffix}`;
    }
    if (log.actionType === 'STATE_TRANSITION') {
      const from = log.oldValue ? String(log.oldValue).replace(/"/g, '') : '?';
      const to = log.newValue ? String(log.newValue).replace(/"/g, '') : '?';
      return `${user}, ${entity} durumunu "${from}" → "${to}" olarak güncelledi.${resultSuffix}`;
    }
    if (log.actionType === 'IMPORT') {
      return `${user} sisteme veri içe aktarımı gerçekleştirdi.${resultSuffix}`;
    }
    return `${user}, ${entity} kaydını ${verb}.${resultSuffix}`;
  }

  ngOnInit(): void {
    this.buildEntityNameMap();
    this.loadLogs();
  }

  loadLogs(): void {
    try {
      this.logs = this.auditService.getLogs();
      this.applyFilters();
    } catch (e) {
      console.error('Denetim kayıtları yüklenemedi:', e);
    }
  }

  /** entityId → insan-okur ad (iş emri kodu, parça kodu, teknisyen adı vb.) */
  private entityNames = new Map<string, string>();

  private buildEntityNameMap(): void {
    const add = (id: string, name: string) => { if (id && name) this.entityNames.set(id, name); };
    try {
      this.storage.getCollection<any>(STORAGE_KEYS.WORK_ORDERS).forEach(w => add(w.id, w.code));
      this.storage.getCollection<any>(STORAGE_KEYS.SERVICE_REQUESTS).forEach(r => add(r.id, r.code));
      this.storage.getCollection<any>(STORAGE_KEYS.SPARE_PARTS).forEach(p => add(p.id, `${p.code} — ${p.name}`));
      this.storage.getCollection<any>(STORAGE_KEYS.TECHNICIANS).forEach(t => add(t.id, t.fullName));
      this.storage.getCollection<any>(STORAGE_KEYS.BRANCHES).forEach(b => add(b.id, b.name));
      this.storage.getCollection<any>(STORAGE_KEYS.VEHICLES).forEach(v => add(v.id, v.plateNumber));
      this.storage.getCollection<any>(STORAGE_KEYS.RULES).forEach(r => add(r.id, r.name));
      this.storage.getCollection<any>(STORAGE_KEYS.USERS).forEach(u => add(u.id, u.fullName));
    } catch { /* eksik koleksiyon isim çözümlemeyi engellemesin */ }
  }

  /** Ham entityId yerine görünen ad döndürür; çözülemezse boş (hücrede gizlenir). */
  entityDisplayName(log: AuditLog): string {
    if (!log.entityId || log.entityId === 'anonymous' || log.entityId === 'seed') return '';
    return this.entityNames.get(log.entityId) || '';
  }

  applyFilters(): void {
    let list = [...this.logs];

    // Global search query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        l =>
          l.description.toLowerCase().includes(q) ||
          l.username.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q)
      );
    }

    // Entity filter
    if (this.entityFilter) {
      list = list.filter(l => l.entityType === this.entityFilter);
    }

    // Action filter
    if (this.actionFilter) {
      list = list.filter(l => l.actionType === this.actionFilter);
    }

    // User Role filter
    if (this.roleFilter) {
      list = list.filter(l => l.userRole === this.roleFilter);
    }

    // Date filter (YYYY-MM-DD)
    if (this.dateFilter) {
      list = list.filter(l => l.createdAt.startsWith(this.dateFilter));
    }

    this.filteredLogs = list;
    this.page = 1; // filtre değişince başa dön
  }

  openDetailModal(log: AuditLog): void {
    this.selectedLog = log;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedLog = null;
  }

  /** Sık görülen model alan adlarının Türkçe karşılıkları (diff tablosu için). */
  private static readonly FIELD_LABELS: Record<string, string> = {
    status: 'Durum',
    name: 'Ad',
    fullName: 'Ad Soyad',
    title: 'Başlık',
    description: 'Açıklama',
    city: 'Şehir',
    district: 'İlçe',
    phone: 'Telefon',
    email: 'E-posta',
    stockQuantity: 'Stok Miktarı',
    reservedQuantity: 'Rezerve Miktarı',
    minStockThreshold: 'Minimum Stok Eşiği',
    unitPrice: 'Birim Fiyat',
    performanceScore: 'Performans Puanı',
    completedJobsCount: 'Tamamlanan İş Sayısı',
    dailyCapacity: 'Günlük Kapasite',
    isActive: 'Aktif mi',
    isOnLeave: 'İzinli mi',
    fuelLevel: 'Yakıt Seviyesi',
    lastMaintenanceDate: 'Son Bakım Tarihi',
    plateNumber: 'Plaka',
    estimatedCost: 'Tahmini Maliyet',
    actualCost: 'Gerçekleşen Maliyet',
    plannedStart: 'Planlanan Başlangıç',
    plannedEnd: 'Planlanan Bitiş',
    actualStart: 'Gerçek Başlangıç',
    actualEnd: 'Gerçek Bitiş',
    technicianId: 'Teknisyen',
    vehicleId: 'Araç',
    branchId: 'Şube',
    priority: 'Öncelik',
    slaDeadline: 'SLA Son Tarihi',
    managerApproved: 'Yönetici Onayı',
    failureReason: 'Başarısızlık Nedeni',
    notes: 'Notlar',
    code: 'Kod'
  };

  translateFieldName(key: string): string {
    return AuditListComponent.FIELD_LABELS[key] || key;
  }

  /** Olayın sade Türkçe anlatımı — işlem tipine göre satır satır açıklama üretir. */
  getExplanation(log: AuditLog): string[] {
    const who = `${log.username} (${new RoleLabelPipe().transform(log.userRole)})`;
    const when = new Date(log.createdAt).toLocaleString('tr-TR');
    const lines: string[] = [];

    switch (log.actionType) {
      case 'SECURITY_VIOLATION': {
        lines.push(`${when} tarihinde ${who} yetkisi olmayan bir işlem denedi.`);
        // newValue içinde attemptedUrl / attemptedPermission olabilir
        try {
          const detail = JSON.parse(log.newValue || '{}');
          if (detail.attemptedUrl) {
            lines.push(`Denenen adres: ${detail.attemptedUrl} — bu sayfa kullanıcının rolüne kapalıdır.`);
          }
          if (detail.attemptedPermission) {
            lines.push(`Denenen yetki: "${detail.attemptedPermission}" — kullanıcının rol izin matrisinde bu yetki bulunmuyor.`);
          }
        } catch { /* ham değer okunamadıysa genel açıklamayla devam */ }
        lines.push(`Sistem isteği reddetti; kullanıcı ${log.simulatedIp} IP adresinden işlem yapıyordu.`);
        lines.push('Bu kayıt güvenlik izi olarak kalıcıdır; silinemez ve değiştirilemez.');
        break;
      }
      case 'STATE_TRANSITION': {
        lines.push(`${when} tarihinde ${who} bir durum geçişi gerçekleştirdi.`);
        try {
          const oldS = JSON.parse(log.oldValue || '{}').status;
          const newS = JSON.parse(log.newValue || '{}').status;
          if (oldS && newS) {
            const label = (s: string) => new StatusLabelPipe().transform(s, 'workOrder');
            lines.push(`Kayıt durumu "${label(oldS)}" konumundan "${label(newS)}" konumuna taşındı.`);
          }
        } catch { /* durum çifti yoksa genel açıklama yeterli */ }
        lines.push('Geçiş, merkezi durum makinesi kurallarından geçerek onaylandı (geçersiz sıçramalar otomatik engellenir).');
        break;
      }
      case 'CREATE':
        lines.push(`${when} tarihinde ${who} sisteme yeni bir kayıt ekledi.`);
        lines.push('Aşağıdaki "Veri Değişim Detayı" bölümünde oluşturulan kaydın tüm alanlarını görebilirsiniz.');
        break;
      case 'UPDATE':
        lines.push(`${when} tarihinde ${who} mevcut bir kaydı güncelledi.`);
        lines.push('Aşağıdaki tabloda hangi alanın hangi değerden hangi değere değiştiği satır satır listelenmiştir.');
        break;
      case 'DELETE':
        lines.push(`${when} tarihinde ${who} bir kaydı sildi.`);
        lines.push('Silinen kaydın son hali aşağıda saklanmıştır; gerekirse bu bilgilerle kayıt yeniden oluşturulabilir.');
        break;
      case 'IMPORT':
        lines.push(`${when} tarihinde ${who} sisteme dosyadan toplu veri aktardı.`);
        break;
      case 'SYSTEM_EVENT':
        lines.push(`${when} tarihinde sistem otomatik bir işlem gerçekleştirdi (kullanıcı tetiklemesi olmadan).`);
        break;
      default:
        lines.push(`${when} tarihinde ${who} tarafından bir işlem gerçekleştirildi.`);
    }
    return lines;
  }

  /** Filtrelenmiş denetim kayıtlarını CSV veya JSON olarak indirir (kayıtlar salt-okunur; tek meşru dışa aksiyon). */
  exportLogs(format: 'csv' | 'json'): void {
    if (this.filteredLogs.length === 0) return;
    const filename = `denetim-kayitlari-${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(this.filteredLogs, null, 2)], { type: 'application/json' });
      this.downloadBlob(blob, `${filename}.json`);
    } else {
      const header = ['Tarih', 'Kullanıcı', 'Rol', 'İşlem', 'Varlık', 'Açıklama', 'Sonuç', 'IP'];
      const rows = this.filteredLogs.map(l => [
        l.createdAt, l.username, l.userRole, l.actionType, l.entityType,
        l.description, l.result || 'SUCCESS', l.simulatedIp
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = '﻿' + header.join(',') + '\r\n' + rows.join('\r\n'); // BOM: Excel Türkçe uyumu
      this.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  getDiffList(): Array<{ key: string; old: any; new: any }> {
    if (!this.selectedLog) return [];
    return this.auditService.getDiff(this.selectedLog.oldValue, this.selectedLog.newValue);
  }

  parsePrettyJson(val: string | null): string {
    return this.auditService.parsePrettyJson(val);
  }

  stringifyDiffVal(val: any): string {
    return this.auditService.stringifyValue(val);
  }
}
