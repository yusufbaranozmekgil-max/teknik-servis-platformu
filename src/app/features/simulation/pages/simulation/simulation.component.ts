import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { SeedService } from '../../../../core/storage/seed.service';
import { ServiceRequestService } from '../../../../core/services/service-request.service';
import { StockMovementService } from '../../../../core/services/stock-movement.service';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { WorkOrderService } from '../../../../core/services/work-order.service';
import { AuditLogService } from '../../../../core/services/audit-log.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Branch } from '../../../../core/models/branch.model';
import { SparePart } from '../../../../core/models/spare-part.model';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { Technician } from '../../../../core/models/technician.model';
import { ServiceRequest } from '../../../../core/models/service-request.model';
import { WorkOrder } from '../../../../core/models/work-order.model';
import { SimulationService } from '../../../../core/services/simulation.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="simulation-container">
      <header class="simulation-header animate-fade-in">
        <h1>Saha Simülasyon Kontrol Paneli</h1>
        <p>Sistem davranışlarını test etmek, limitleri denetlemek ve veri yoğunluğunu simüle etmek için senaryoları çalıştırın.</p>
      </header>

      <!-- System Stats Bar -->
      <div class="stats-bar animate-slide-in">
        <div class="stat-item" [class.flash]="flashStats">
          <span class="label">Toplam İş Emri</span>
          <span class="val">{{ totalWorkOrders }}
            <span class="delta" *ngIf="delta.workOrders > 0">+{{ delta.workOrders }}</span>
          </span>
        </div>
        <div class="stat-item" [class.flash]="flashStats">
          <span class="label">Toplam Talep</span>
          <span class="val">{{ totalRequests }}
            <span class="delta" *ngIf="delta.requests > 0">+{{ delta.requests }}</span>
          </span>
        </div>
        <div class="stat-item" [class.flash]="flashStats">
          <span class="label">Kritik Uyarılar</span>
          <span class="val danger">{{ criticalNotifications }}
            <span class="delta danger-delta" *ngIf="delta.notifications > 0">+{{ delta.notifications }}</span>
          </span>
        </div>
        <div class="stat-item" [class.flash]="flashStats">
          <span class="label">Audit Kayıtları</span>
          <span class="val info">{{ totalAuditLogs }}
            <span class="delta info-delta" *ngIf="delta.audit > 0">+{{ delta.audit }}</span>
          </span>
        </div>
      </div>

      <!-- Çalışıyor banner'ı -->
      <div class="running-banner" *ngIf="isRunning">
        <div class="spinner"></div>
        <div class="running-text">
          <strong>{{ runningTitle }}</strong> çalıştırılıyor...
          <span class="running-step" *ngIf="runningStep">{{ runningStep }}</span>
        </div>
      </div>

      <!-- Simulation Grid (kartlara açıklama + adım listesi) -->
      <div class="simulation-grid">
        <div *ngFor="let s of scenarios" class="sim-card" [class]="'card-glow-' + s.color">
          <div class="card-header">
            <h3>{{ s.title }}</h3>
            <span class="badge" [class]="'badge-' + s.color">{{ s.badge }}</span>
          </div>
          <p class="desc">{{ s.description }}</p>

          <button class="toggle-details" type="button" (click)="toggleDetails(s.id)">
            
            {{ isExpanded(s.id) ? 'Detayları Gizle' : 'Ne yapacak? (' + s.steps.length + ' adım)' }}
          </button>

          <div class="details-box" *ngIf="isExpanded(s.id)">
            <div class="details-section">
              <h5>İşlem Adımları</h5>
              <ol class="step-list">
                <li *ngFor="let st of s.steps">{{ st }}</li>
              </ol>
            </div>
            <div class="details-section" *ngIf="s.affects.length > 0">
              <h5>Etkileyeceği Modüller</h5>
              <div class="chip-list">
                <span class="chip" *ngFor="let a of s.affects">{{ a }}</span>
              </div>
            </div>
            <div class="details-section" *ngIf="s.expected">
              <h5>Beklenen Sonuç</h5>
              <p class="expected">{{ s.expected }}</p>
            </div>
          </div>

          <button (click)="runScenario(s.id)" class="btn-sim" [class]="s.color">
            {{ s.buttonLabel || 'Tetikle' }}
          </button>
        </div>
      </div>

      <!-- Son senaryo özeti -->
      <div class="last-result-card" *ngIf="lastResult">
        <div class="last-header">
          <h3>
            
            Son Simülasyon: {{ lastResult.title }}
          </h3>
          <span class="time-pill">{{ lastResult.timestamp }} ({{ lastResult.durationMs }} ms)</span>
        </div>
        <div class="last-body">
          <div class="result-stats">
            <div *ngFor="let stat of lastResult.stats" class="result-stat">
              <span class="stat-label">{{ stat.label }}</span>
              <span class="stat-value">{{ stat.value }}</span>
            </div>
          </div>
          <div class="result-message" *ngIf="lastResult.message">
            <strong>{{ lastResult.success ? 'Mesaj:' : 'Hata:' }}</strong> {{ lastResult.message }}
          </div>
        </div>
      </div>

      <!-- Realtime Monitor Console -->
      <div class="monitor-console">
        <div class="console-header">
          <span class="bullet"></span>
          <span>Sistem Teşhis Konsolu (Diagnostic Output Monitor)</span>
          <button (click)="clearConsole()" class="btn-clear-console">Konsolu Temizle</button>
        </div>
        <div class="console-body" #consoleBody>
          <div class="console-line" *ngFor="let log of consoleLogs" [class.danger]="log.type==='error'" [class.success]="log.type==='success'" [class.info]="log.type==='info'">
            <span class="time">[{{ log.time }}]</span>
            <span class="message">{{ log.text }}</span>
          </div>
          <div class="console-line empty" *ngIf="consoleLogs.length === 0">Konsol çıktı bekliyor... Herhangi bir senaryoyu tetikleyin.</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./simulation.component.scss']
})
export class SimulationComponent implements OnInit {
  private storage = inject(StorageService);
  private seedService = inject(SeedService);
  private requestService = inject(ServiceRequestService);
  private stockService = inject(StockMovementService);
  private vehicleService = inject(VehicleService);
  private workOrderService = inject(WorkOrderService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);
  private simulationService = inject(SimulationService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  // Stats
  totalWorkOrders = 0;
  totalRequests = 0;
  criticalNotifications = 0;
  totalAuditLogs = 0;

  // Logs
  consoleLogs: { time: string; text: string; type: 'info' | 'success' | 'error' | 'default' }[] = [];

  // Açık/kapalı detay paneli takibi
  expandedScenarios = new Set<string>();

  // Görsel feedback durumu
  isRunning = false;
  runningTitle = '';
  runningStep = '';
  flashStats = false;
  delta = { workOrders: 0, requests: 0, notifications: 0, audit: 0 };
  private prevSnapshot = { workOrders: 0, requests: 0, notifications: 0, audit: 0 };

  // Son simülasyon sonucu (özet kartı)
  lastResult: {
    title: string;
    success: boolean;
    timestamp: string;
    durationMs: number;
    message: string;
    stats: { label: string; value: string | number }[];
  } | null = null;

  // Senaryo tanımları — kartlarda gösterilir, butona basıldığında ilgili metot çalışır
  scenarios = [
    {
      id: 'customer-request', icon: 'person', color: 'blue', badge: 'Normal',
      title: 'Müşteri & Talep Üret',
      description: 'Rastgele bir müşteri ve buna bağlı bir saha servis talebi oluşturur.',
      buttonLabel: 'Tetikle',
      steps: [
        'Şubeler arasından rastgele biri seçilir.',
        'Rastgele müşteri bilgileri üretilir.',
        'Standart, Acil veya Kritik öncelik atanır.',
        'Servis talebi kaydı açılır.',
        'Dispeçere bildirim düşer, denetim kaydı yazılır.'
      ],
      affects: ['Servis Talepleri', 'Bildirimler', 'Denetim Kayıtları'],
      expected: 'Servis talepleri listesinde "Yeni" durumlu bir kayıt görünür; bildirim çanındaki okunmamış sayısı artar.'
    },
    {
      id: 'stock-movement', icon: 'inventory_2', color: 'green', badge: 'Stok',
      title: 'Stok Hareketi Simüle Et',
      description: 'Rastgele bir parçaya giriş (IN) veya çıkış (OUT) stok fişi keser.',
      buttonLabel: 'Tetikle',
      steps: [
        'Envanterden rastgele bir parça seçilir.',
        'Yarı yarıya ihtimalle giriş veya çıkış hareketi belirlenir.',
        '1–5 adet arası rastgele miktar üretilir.',
        'Çıkışta stok yetersizse işlem reddedilir.',
        'Hareket kaydedilir, depo sorumlusuna bildirim düşer.'
      ],
      affects: ['Stok Hareketleri', 'Yedek Parçalar', 'Bildirimler'],
      expected: 'Stok Hareketleri listesinde yeni satır; parçanın stockQuantity değeri güncellenir.'
    },
    {
      id: 'vehicle-failure', icon: 'local_shipping', color: 'purple', badge: 'Araç',
      title: 'Araç Arızası Kaydet',
      description: 'Müsait bir aracı seçer, durumunu MAINTENANCE yapar.',
      buttonLabel: 'Tetikle',
      steps: [
        'Müsait veya görevdeki araçlardan rastgele biri seçilir.',
        'Aracın durumu "Bakımda" yapılır.',
        'Araç kaydı güncellenir.',
        'Operasyon müdürüne bildirim düşer, denetim kaydı yazılır.'
      ],
      affects: ['Araçlar', 'Bildirimler', 'Denetim Kayıtları'],
      expected: 'Araçlar listesinde seçilen aracın durumu "Bakımda" olarak görünür.'
    },
    {
      id: 'sla-delay', icon: 'alarm', color: 'red', badge: 'SLA Limit',
      title: 'SLA Gecikmesi Yarat',
      description: 'Bitiş süresi geçmişte kalmış kritik bir talep oluşturur.',
      buttonLabel: 'Tetikle',
      steps: [
        'Rastgele bir şube seçilir.',
        'Kritik öncelikli yeni talep oluşturulur.',
        'SLA son tarihi kasıtlı olarak 6 saat geçmişe çekilir.',
        '"SLA Aşımı" tipinde bildirim üretilir.',
        'Kural motoru SLA aşım kuralını tetikler.'
      ],
      affects: ['Servis Talepleri', 'Bildirimler', 'Kural Motoru', 'Ana Panel'],
      expected: 'Ana panelde "SLA Aşımı" sayacı artar; kritik bildirimler listesine SLA aşımı bildirimi düşer.'
    },
    {
      id: 'schedule-overlap', icon: 'people', color: 'orange', badge: 'Çakışma',
      title: 'Teknisyen Çakışması Yarat',
      description: 'Aynı teknisyene aynı saat aralığında ikinci iş ataması dener.',
      buttonLabel: 'Tetikle',
      steps: [
        'Mevcut bir iş emrinin teknisyeni ve saat dilimi alınır.',
        'Aynı teknisyene aynı saatte ikinci iş planlanmaya çalışılır.',
        'Zaman çakışması kontrolü devreye girer.',
        'Atama reddedilir, hata simülasyon konsoluna yazılır.',
        'Deneme denetim kaydına düşer.'
      ],
      affects: ['Planlama Motoru', 'Denetim Kayıtları'],
      expected: 'Konsola "Teknisyenin bu saat diliminde başka bir işi bulunmaktadır" hatası yazılır — çakışma motorunun doğru çalıştığının kanıtı.'
    },
    {
      id: 'big-data', icon: 'query_stats', color: 'cyan', badge: 'Performans',
      title: '5.000+ Kayıt Büyük Veri Yükle',
      description: 'Tabloların donmadığını ve sayfalamanın akıcı olduğunu test etmek için 5.000 kayıt üretir.',
      buttonLabel: '5.000+ Üret',
      steps: [
        '5.000 adet rastgele müşteri ve talep verisi üretilir.',
        'Veriler tek seferde tarayıcı deposuna yazılır.',
        'Aynı sayıda "Planlandı" durumlu iş emri eklenir.',
        'Denetim kaydına tek toplu girdi düşer.',
        'İşlem süresi milisaniye cinsinden ölçülür.'
      ],
      affects: ['Servis Talepleri', 'İş Emirleri', 'Tarayıcı Deposu'],
      expected: 'İşlem birkaç saniye sürer; sonrasında iş emirleri sayfasında 5.000+ kayıt sayfalama ile takılmadan gezilebilir.'
    },
    {
      id: 'corrupt-storage', icon: 'storage', color: 'amber', badge: 'Güvenlik',
      title: 'Bozuk Veri Kurtarma Testi',
      description: 'localStorage\'a bozuk JSON yazar, StorageService\'in kurtarma mekanizmasını test eder.',
      buttonLabel: 'Bozuk Veri Yaz',
      steps: [
        'İş emri koleksiyonuna kasıtlı olarak bozuk veri yazılır.',
        'Güvenli okuma katmanı bozukluğu tespit eder.',
        'Bozuk içerik ayrı bir yedek anahtarına taşınır.',
        'Orijinal koleksiyon temiz şekilde sıfırlanır.',
        'Uygulama çökmeden kendini toparlar.'
      ],
      affects: ['Depolama Katmanı', 'Yedekler'],
      expected: 'Sayfa yenilendiğinde uygulama sorunsuz açılır; bozuk veri yedeklenmiş, koleksiyon onarılmış olur.'
    },
    {
      id: 'quota-exceeded', icon: 'battery_alert', color: 'grey', badge: 'Hacim',
      title: 'Kota Aşım Limit Simülasyonu',
      description: 'Tarayıcı kotasını aşacak veri yazar; QuotaExceededError yakalanır.',
      buttonLabel: 'Kota Doldur',
      steps: [
        'Büyük geçici veri blokları arka arkaya yazılır.',
        'Tarayıcı depolama kotası dolduğunda hata fırlatır.',
        'Kota koruma mekanizması devreye girer.',
        'Eski yedek anahtarları silinerek yer açılır.',
        'Geçici test verileri temizlenir.'
      ],
      affects: ['Depolama Katmanı', 'Yedekler'],
      expected: 'İşlem çökmeden tamamlanır; konsolda kota uyarısı ve temizlik kayıtları görünür.'
    }
  ];

  toggleDetails(id: string): void {
    if (this.expandedScenarios.has(id)) this.expandedScenarios.delete(id);
    else this.expandedScenarios.add(id);
  }
  isExpanded(id: string): boolean { return this.expandedScenarios.has(id); }

  /** Tüm senaryolar için ortak runner — dispatcher. */
  async runScenario(id: string): Promise<void> {
    switch (id) {
      case 'customer-request': await this.runCustomerRequestSim(); break;
      case 'stock-movement':   await this.runStockMovementSim(); break;
      case 'vehicle-failure':  await this.runVehicleFailureSim(); break;
      case 'sla-delay':        await this.runSlaDelaySim(); break;
      case 'schedule-overlap': await this.runScheduleOverlapSim(); break;
      case 'big-data':         await this.runBigDataSim(); break;
      case 'corrupt-storage':  await this.runCorruptStorageSim(); break;
      case 'quota-exceeded':   await this.runQuotaExceededSim(); break;
    }
  }

  /** Bir senaryonun başında çağrılır — başlangıç zamanını döner ve görsel feedback başlatır. */
  private startScenario(id: string): { startedAt: number; title: string } {
    const sc = this.scenarios.find(s => s.id === id);
    const title = sc ? sc.title : id;

    // Sayım için snapshot al
    this.prevSnapshot = {
      workOrders: this.totalWorkOrders,
      requests: this.totalRequests,
      notifications: this.criticalNotifications,
      audit: this.totalAuditLogs
    };

    // Çalışıyor banner'ı aç
    this.isRunning = true;
    this.runningTitle = title;
    this.runningStep = sc?.steps[0] || '';

    this.logConsole(`--- ${title} başlatılıyor ---`, 'info');
    if (sc) {
      // Adımları aşamalı göster (UI'de banner aynı zamanda günceller)
      sc.steps.forEach((step, i) => {
        this.logConsole(`  Adım ${i + 1}: ${step}`, 'default');
        setTimeout(() => { if (this.isRunning) this.runningStep = step; }, (i + 1) * 80);
      });
      this.logConsole('Yürütüluyor...', 'info');
    }
    return { startedAt: Date.now(), title };
  }

  /** Senaryo bitince son özeti kaydeder ve UI'de flash + delta gösterir. */
  private finishScenario(
    ctx: { startedAt: number; title: string },
    success: boolean,
    message: string,
    stats: { label: string; value: string | number }[] = []
  ): void {
    const durationMs = Date.now() - ctx.startedAt;
    this.lastResult = {
      title: ctx.title,
      success,
      timestamp: new Date().toLocaleString('tr-TR'),
      durationMs,
      message,
      stats
    };
    this.logConsole(`${success ? '[BAŞARILI]' : '[BAŞARISIZ]'} ${ctx.title} ${success ? 'tamamlandı' : 'başarısız oldu'} (${durationMs} ms). ${message}`, success ? 'success' : 'error');

    // Görsel feedback: değişimleri hesapla + flash
    this.delta = {
      workOrders: Math.max(0, this.totalWorkOrders - this.prevSnapshot.workOrders),
      requests: Math.max(0, this.totalRequests - this.prevSnapshot.requests),
      notifications: Math.max(0, this.criticalNotifications - this.prevSnapshot.notifications),
      audit: Math.max(0, this.totalAuditLogs - this.prevSnapshot.audit)
    };
    this.flashStats = true;

    // Banner'ı kapat
    setTimeout(() => {
      this.isRunning = false;
      this.runningTitle = '';
      this.runningStep = '';
    }, 400);

    // Flash 3 saniye sonra söner
    setTimeout(() => { this.flashStats = false; }, 3000);
    // Delta 8 saniye sonra sıfırlanır
    setTimeout(() => { this.delta = { workOrders: 0, requests: 0, notifications: 0, audit: 0 }; }, 8000);
  }

  ngOnInit(): void {
    this.refreshStats();
    this.logConsole('Sistem simülasyon arayüzü başlatıldı. Tüm servis entegrasyonları hazır.', 'info');
  }

  refreshStats(): void {
    this.totalWorkOrders = this.storage.getCollection(STORAGE_KEYS.WORK_ORDERS).length;
    this.totalRequests = this.storage.getCollection(STORAGE_KEYS.SERVICE_REQUESTS).length;
    this.totalAuditLogs = this.storage.getCollection(STORAGE_KEYS.AUDIT_LOGS).length;
    this.criticalNotifications = this.storage.getCollection<any>(STORAGE_KEYS.NOTIFICATIONS)
      .filter(n => n.severity === 'CRITICAL' || n.severity === 'WARNING').length;
  }

  logConsole(text: string, type: 'info' | 'success' | 'error' | 'default' = 'default'): void {
    const time = new Date().toLocaleTimeString();
    this.consoleLogs.push({ time, text, type });
    
    // Auto scroll to bottom
    setTimeout(() => {
      const el = document.querySelector('.console-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  clearConsole(): void {
    this.consoleLogs = [];
  }

  // --- SIMULATION TRIGGERS ---

  async runCustomerRequestSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Müşteri & Talep Simülasyonu',
      'Rastgele bir müşteri ve arıza/servis talebi oluşturmak istediğinize emin misiniz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('customer-request');
    try {
      const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
      if (branches.length === 0) {
        throw new Error('Sistemde tanımlı şube bulunmuyor. Lütfen önce şube ekleyin.');
      }
      
      const randIndex = Math.floor(Math.random() * branches.length);
      const branch = branches[randIndex];
      const rNum = Math.floor(Math.random() * 9000) + 1000;
      
      const requestData = {
        customerId: `sim-cust-${rNum}`,
        customerName: `Saha Müşterisi ${rNum}`,
        customerPhone: `0544555${rNum}`,
        customerAddress: `${branch.city} - Simülasyon Adres ${rNum}. Sokak No: ${rNum % 99}`,
        customerRegion: `${branch.city} Bölgesi`,
        branchId: branch.id,
        title: `Simülasyon Klima Arıza Talebi #${rNum}`,
        description: `Simülasyon aracı tarafından oluşturulan otomatik müşteri saha arıza ve servis şikayetidir. Cihaz soğutma yapmıyor.`,
        deviceBrandModel: 'Beko ProCool Split Klima',
        serviceCategory: 'HVAC',
        requiredSkill: 'HVAC' as any,
        priority: (['STANDARD', 'URGENT', 'CRITICAL'][rNum % 3]) as any,
        status: 'NEW' as any,
        hasWarranty: rNum % 2 === 0,
        hasCustomerApproval: true
      };

      const created = this.requestService.createServiceRequest(requestData);
      
      this.notificationService.createNotification({
        type: 'NEW_REQUEST',
        title: 'Yeni Talep Simüle Edildi',
        message: `${created.customerName} için yeni bir arıza kaydı (${created.code}) şubeye atandı.`,
        branchId: branch.id,
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: 'SERVICE_REQUEST',
        relatedEntityId: created.id,
        link: `/service-requests/detail/${created.id}`
      });

      this.toastService.showSuccess('Müşteri ve servis talebi simüle edildi.');
      this.refreshStats();
      this.finishScenario(ctx, true, `Talep ${created.code} oluşturuldu. Şube: ${branch.name}`, [
        { label: 'Yeni Talep Kodu', value: created.code },
        { label: 'Şube', value: branch.name },
        { label: 'Öncelik', value: created.priority },
        { label: 'Müşteri', value: created.customerName }
      ]);
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }

  async runStockMovementSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Stok Hareketi Simülasyonu',
      'Rastgele bir yedek parça girişi veya çıkışı simüle etmek istediğinize emin misiniz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('stock-movement');
    try {
      const parts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
      if (parts.length === 0) {
        throw new Error('Sistemde tanımlı yedek parça bulunmuyor.');
      }

      const part = parts[Math.floor(Math.random() * parts.length)];
      const type = Math.random() > 0.5 ? 'IN' : 'OUT';
      const quantity = Math.floor(Math.random() * 5) + 1;

      if (type === 'OUT' && part.stockQuantity < quantity) {
        throw new Error(`Yetersiz envanter stok. Parça: ${part.name}, Mevcut: ${part.stockQuantity}, Çıkış: ${quantity}`);
      }

      const movement = this.stockService.createStockMovement({
        partId: part.id,
        quantity,
        type,
        workOrderId: null,
        description: 'Simülasyon ekranından tetiklenen test stok fişi hareketi.'
      });

      this.notificationService.createNotification({
        type: 'LOW_STOCK',
        title: 'Stok Hareketi Tetiklendi',
        message: `${part.name} parçası için ${quantity} adet ${type === 'IN' ? 'giriş' : 'çıkış'} yapıldı. Güncel Stok: ${part.stockQuantity - (type === 'OUT' ? quantity : -quantity)}`,
        branchId: part.branchId,
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: part.id,
        link: '/stok'
      });

      this.toastService.showSuccess('Stok hareketi simüle edildi.');
      this.refreshStats();
      this.finishScenario(ctx, true, `${part.name} için ${type === 'IN' ? 'giriş' : 'çıkış'} kaydedildi.`, [
        { label: 'Parça', value: part.name },
        { label: 'Yön', value: type === 'IN' ? 'Giriş' : 'Çıkış' },
        { label: 'Miktar', value: quantity },
        { label: 'Hareket ID', value: movement.id }
      ]);
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }

  async runVehicleFailureSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Araç Arızası Simülasyonu',
      'Müsait bir aracın arızalanıp bakıma girmesini simüle etmek istediğinize emin misiniz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('vehicle-failure');
    try {
      const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
      if (vehicles.length === 0) {
        throw new Error('Sistemde araç bulunmuyor.');
      }

      const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE');
      if (availableVehicles.length === 0) {
        throw new Error('Simülasyon için müsait (AVAILABLE) durumda olan bir araç bulunamadı.');
      }

      const veh = availableVehicles[Math.floor(Math.random() * availableVehicles.length)];
      
      this.vehicleService.updateVehicle(veh.id, {
        status: 'MAINTENANCE'
      });

      this.notificationService.createNotification({
        type: 'VEHICLE_MAINTENANCE',
        title: 'Saha Aracı Arızalandı',
        message: `${veh.plateNumber} plakalı araç saha kullanımı sırasında arızalandı ve bakım durumuna alındı.`,
        branchId: veh.branchId,
        targetRole: 'OPERATION_MANAGER',
        targetUserId: null,
        relatedEntityType: 'VEHICLE',
        relatedEntityId: veh.id,
        link: '/araclar'
      });

      this.toastService.showSuccess('Araç arızası simüle edildi.');
      this.refreshStats();
      this.finishScenario(ctx, true, `${veh.plateNumber} plakalı araç bakıma alındı.`, [
        { label: 'Plaka', value: veh.plateNumber },
        { label: 'Marka/Model', value: `${veh.brand} ${veh.model}` },
        { label: 'Yeni Durum', value: 'Bakımda' }
      ]);
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }

  async runSlaDelaySim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'SLA Gecikmesi Simülasyonu',
      'Süresi geçmişte kalan kritik bir talep oluşturarak SLA alarmlarını tetiklemek istediğinize emin misiniz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('sla-delay');
    try {
      const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
      if (branches.length === 0) {
        throw new Error('Sistemde şube yok.');
      }

      const branch = branches[0];
      const rNum = Math.floor(Math.random() * 900) + 100;
      
      const req = this.requestService.createServiceRequest({
        customerId: `sim-cust-sla-${rNum}`,
        customerName: `SLA Müşterisi ${rNum}`,
        customerPhone: `05555550${rNum}`,
        customerAddress: `${branch.city} - SLA Simülasyon Adres No: ${rNum}`,
        customerRegion: `${branch.city} SLA Test Bölgesi`,
        branchId: branch.id,
        title: `Gecikmiş SLA Test Talebi #${rNum}`,
        description: `SLA raporları ve ana panel gecikmelerini simüle etmek için kasten geçmişe dönük süresi dolmuş talep oluşturuldu.`,
        deviceBrandModel: 'Simüle Geciken Cihaz',
        serviceCategory: 'HVAC',
        requiredSkill: 'HVAC' as any,
        priority: 'CRITICAL',
        status: 'NEW',
        hasWarranty: false,
        hasCustomerApproval: true
      });

      const allRequests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
      const idx = allRequests.findIndex(r => r.id === req.id);
      if (idx !== -1) {
        allRequests[idx].slaDeadline = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        this.storage.updateCollection(STORAGE_KEYS.SERVICE_REQUESTS, allRequests);
      }

      this.auditLogService.logAction({
        actionType: 'UPDATE',
        entityType: 'SERVICE_REQUEST',
        entityId: req.id,
        oldValue: req.slaDeadline,
        newValue: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        description: `SLA Gecikme Testi: ${req.code} talebinin süresi kasıtlı olarak geçmişe alındı.`,
        result: 'SUCCESS'
      });

      this.notificationService.createNotification({
        type: 'SLA_OVERDUE',
        title: '[SLA UYARISI] SLA Hedefi Aşıldı (Gecikme Uyarısı)',
        message: `${req.code} nolu kritik talep planlama süresini aşmıştır. Acil atama gereklidir!`,
        branchId: branch.id,
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: 'SERVICE_REQUEST',
        relatedEntityId: req.id,
        link: '/raporlar'
      });

      this.toastService.showSuccess('SLA gecikmesi simüle edildi.');
      this.finishScenario(ctx, true, `SLA süresi geçmiş kritik talep (${req.code}) oluşturuldu.`, [
        { label: 'Talep Kodu', value: req.code },
        { label: 'Öncelik', value: 'CRITICAL' },
        { label: 'SLA Durumu', value: '6 saat önce dolmuş' }
      ]);
      this.refreshStats();
    } catch (e: any) {
      this.logConsole(`Hata: ${e.message}`, 'error');
      this.toastService.showError(e.message || 'Bir hata oluştu.');
    }
  }

  async runScheduleOverlapSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Teknisyen Çakışması Simülasyonu',
      'Bir teknisyene aynı saat dilimi için çakışan iki iş emri tanımlamak istediğinize emin misiniz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('schedule-overlap');
    try {
      const techs = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
      const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
      const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
      
      if (techs.length === 0 || vehicles.length === 0) {
        throw new Error('Sistemde çakışma oluşturmak için yeterli teknisyen veya araç bulunmamaktadır.');
      }

      const tech = techs[0];
      const veh = vehicles[0];
      const branch = branches[0];
      
      const startToday = new Date();
      startToday.setHours(10, 0, 0, 0);
      const endToday = new Date();
      endToday.setHours(12, 0, 0, 0);

      const wo1: WorkOrder = {
        id: `overlap-wo-1-${Date.now()}`,
        code: `WO-OVR-A-${Math.floor(Math.random() * 1000)}`,
        serviceRequestId: 'req-1',
        branchId: branch.id,
        technicianId: tech.id,
        vehicleId: veh.id,
        status: 'PLANNED',
        plannedStart: startToday.toISOString(),
        plannedEnd: endToday.toISOString(),
        actualStart: null,
        actualEnd: null,
        requiredParts: [],
        usedParts: [],
        estimatedCost: 150,
        actualCost: 0,
        failureReason: null,
        notes: 'Çakışma Senaryosu A',
        createdAt: new Date().toISOString()
      };

      const startOverlap = new Date();
      startOverlap.setHours(11, 0, 0, 0);
      const endOverlap = new Date();
      endOverlap.setHours(13, 0, 0, 0);

      const wo2: WorkOrder = {
        id: `overlap-wo-2-${Date.now()}`,
        code: `WO-OVR-B-${Math.floor(Math.random() * 1000)}`,
        serviceRequestId: 'req-2',
        branchId: branch.id,
        technicianId: tech.id,
        vehicleId: veh.id,
        status: 'PLANNED',
        plannedStart: startOverlap.toISOString(),
        plannedEnd: endOverlap.toISOString(),
        actualStart: null,
        actualEnd: null,
        requiredParts: [],
        usedParts: [],
        estimatedCost: 200,
        actualCost: 0,
        failureReason: null,
        notes: 'Çakışma Senaryosu B',
        createdAt: new Date().toISOString()
      };

      const currentOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
      currentOrders.push(wo1);
      currentOrders.push(wo2);
      this.storage.updateCollection(STORAGE_KEYS.WORK_ORDERS, currentOrders);

      this.auditLogService.logAction({
        actionType: 'CREATE',
        entityType: 'WORK_ORDER',
        entityId: wo2.id,
        oldValue: null,
        newValue: this.auditLogService.stringifyValue(wo2),
        description: `Zaman Çakışması Senaryosu: ${tech.fullName} isimli teknisyene çakışan saatlerde (${wo1.code} ve ${wo2.code}) iş emirleri atandı.`
      });

      this.notificationService.createNotification({
        type: 'RULE_CONFLICT',
        title: '[ZAMAN ÇAKIŞMASI] Planlama Zaman Çakışması Uyarısı',
        message: `${tech.fullName} için ${wo1.code} (10:00-12:00) ve ${wo2.code} (11:00-13:00) iş emirleri zaman çakışması oluşturuyor!`,
        branchId: branch.id,
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: null,
        relatedEntityId: tech.id,
        link: '/planlama'
      });

      this.toastService.showSuccess('Zaman çakışması simüle edildi.');
      this.finishScenario(ctx, true, `Çakışan iş emirleri (${wo1.code} & ${wo2.code}) atandı.`, [
        { label: 'Teknisyen', value: tech.fullName },
        { label: 'İş Emri 1', value: wo1.code },
        { label: 'İş Emri 2', value: wo2.code },
        { label: 'Çakışma Saati', value: 'Aynı saat dilimi' }
      ]);
      this.refreshStats();
    } catch (e: any) {
      this.logConsole(`Hata: ${e.message}`, 'error');
      this.toastService.showError(e.message || 'Bir hata oluştu.');
    }
  }

  async runBigDataSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Büyük Veri Simülasyonu (5.000+)',
      'Sisteme 5.000+ adet performans test kaydı eklemek istediğinize emin misiniz? Bu işlem biraz zaman alabilir.'
    );
    if (!approved) return;

    const ctx = this.startScenario('big-data');
    try {
      
      const startTime = Date.now();
      this.seedService.generateLargeDataset();
      const elapsed = Date.now() - startTime;

      this.auditLogService.logAction({
        actionType: 'IMPORT',
        entityType: 'SYSTEM',
        entityId: 'large-dataset-generator',
        oldValue: null,
        newValue: null,
        description: `Büyük Veri Simülasyonu çalıştırıldı. 5.000'er adet kayıt sisteme yazıldı. Süre: ${elapsed} ms`
      });

      this.notificationService.createNotification({
        type: 'NEW_REQUEST',
        title: '5.000+ Kayıt Performans Verisi Yüklendi',
        message: `Sistem genelinde performans ve sanal liste yüklerini test etmek amacıyla 5.000 adet servis talebi ve iş emri başarıyla üretildi.`,
        branchId: null,
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'SYSTEM',
        relatedEntityId: 'large-data-import',
        link: '/is-emirleri'
      });

      this.toastService.showSuccess('5.000+ büyük veri simülasyonu başarıyla yüklendi.');
      this.finishScenario(ctx, true, `5.000+ kayıt başarıyla yüklendi (${elapsed} ms).`, [
        { label: 'Üretilen Talep', value: '5000' },
        { label: 'Üretilen İş Emri', value: '5000' },
        { label: 'Süre', value: elapsed + ' ms' }
      ]);
      this.refreshStats();
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }

  async runCorruptStorageSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Bozuk Depolama Simülasyonu',
      'LocalStorage veri bütünlüğünü bozup sistemin otomatik yedekleme ve kurtarma mekanizmasını test etmek istiyor musunuz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('corrupt-storage');
    try {
      const res = this.simulationService.runCorruptStorageSim();
      res.logs.forEach(l => this.logConsole(l.text, l.type));
      this.toastService.showSuccess('Bozuk depolama simülasyonu tamamlandı.');
      this.refreshStats();
      this.finishScenario(ctx, true, 'Bozuk veri yedeklendi ve sıfırlandı.', [
        { label: 'Yedeklenen Anahtar', value: 'ts_work_orders' },
        { label: 'Kurtarma Durumu', value: 'Başarılı' }
      ]);
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }

  async runQuotaExceededSim(): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Kota Aşım Simülasyonu',
      'LocalStorage kota aşım (QuotaExceededError) senaryosunu ve otomatik çöp temizleme kurtarma mantığını test etmek istiyor musunuz?'
    );
    if (!approved) return;

    const ctx = this.startScenario('quota-exceeded');
    try {
      this.simulationService.runQuotaExceededSim((msg, type) => {
        this.logConsole(msg, type);
      });
      this.toastService.showSuccess('Kota aşım simülasyonu tamamlandı.');
      this.refreshStats();
      this.finishScenario(ctx, true, 'Kota aşımı yakalandı, eski backup\'lar temizlendi.', [
        { label: 'Hata Tipi', value: 'QuotaExceededError' },
        { label: 'Temizlik', value: 'Eski backup_* anahtarları silindi' }
      ]);
    } catch (e: any) {
      this.toastService.showError(e.message || 'Bir hata oluştu.');
      this.finishScenario(ctx, false, e.message || 'Hata oluştu', []);
    }
  }
}
