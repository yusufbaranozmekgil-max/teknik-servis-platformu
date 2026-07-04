import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RuleEngineService } from '../../../../core/services/rule-engine.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { Rule } from '../../../../core/models/rule.model';
import { RuleResult } from '../../../../core/models/rule-result.model';
import { PermissionService } from '../../../../core/services/permission.service';
import { AuditLogService } from '../../../../core/services/audit-log.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RULE_TRIGGER_LABELS } from '../../../../core/constants/labels.const';
import { RoleVisibilityDirective } from '../../../../shared/directives/role-visibility.directive';

@Component({
  selector: 'app-rule-list',
  standalone: true,
  imports: [CommonModule, RouterModule, RoleVisibilityDirective],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
          <div>
            <h2>İş Kuralları Motoru Yönetimi</h2>
            <p class="subtitle">Platform genelindeki otomatik atama engellerini, onay süreçlerini ve SLA önceliklendirmelerini yönetin.</p>
          </div>
          <button *appRoleVisibility="['SYSTEM_ADMIN', 'OPERATION_MANAGER']"
                  routerLink="/kurallar/yeni"
                  class="simulate-btn"
                  style="padding:0.5rem 1rem;">+ Yeni Kural</button>
        </div>
      </div>

      <div class="rules-grid">
        <!-- Sol Bölüm: Kural Listesi -->
        <div class="card list-card">
          <div class="list-header">
            <h3>Sistem Kuralları</h3>
            <div class="search-box">
              <input
                type="text"
                [value]="searchTerm"
                (input)="onSearchInput($any($event.target))"
                placeholder="Kural ara..."
                maxlength="30"
              />
              <span class="counter">{{ searchTerm.length }} / 30</span>
            </div>
          </div>
          <div class="rules-table-container">
            <table class="rules-table">
              <thead>
                <tr>
                  <th>Kural Adı</th>
                  <th>Tetikleyici (Trigger)</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of paginatedRules" [class.inactive-row]="!r.isActive">
                  <td>
                    <div class="rule-name-box">
                      <span class="font-bold">{{ r.name }}</span>
                      <span class="desc-text">{{ r.description }}</span>
                    </div>
                  </td>
                  <td><span class="trigger-badge">{{ translateTrigger(r.trigger) }}</span></td>
                  <td>
                    <span class="priority-badge" [class.p1]="r.priority === 1" [class.p2]="r.priority === 2" [class.p3]="r.priority >= 3">
                      Öncelik: {{ r.priority }}
                    </span>
                  </td>
                  <td>
                    <label class="switch">
                      <input type="checkbox" [checked]="r.isActive" (change)="toggleRule(r)" [disabled]="!permissionService.hasPermission('RULE_MANAGE')" />
                      <span class="slider round"></span>
                    </label>
                  </td>
                  <td>
                    <a *ngIf="permissionService.hasPermission('RULE_MANAGE')"
                       [routerLink]="['/kurallar/duzenle', r.id]"
                       class="trigger-badge" style="cursor:pointer;text-decoration:none;">Düzenle</a>
                  </td>
                </tr>
                <tr *ngIf="filteredRules.length === 0">
                  <td colspan="5" class="empty-state">Eşleşen kural bulunamadı.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Pagination (sayfa boyutu 5 sabit) -->
          <div class="rules-pagination" *ngIf="filteredRules.length > 0">
            <span class="page-info">
              Toplam <strong>{{ filteredRules.length }}</strong> kayıt — {{ startIdx + 1 }}–{{ endIdx }} arası
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

        <!-- Sağ Bölüm: Simülatör ve Test Paneli -->
        <div class="card simulator-card">
          <h3>Çakışma ve Kurallar Simülatörü</h3>
          <p class="section-desc">Aşağıdaki alanları değiştirerek kural motorunun çelişen durumları nasıl deterministik olarak (öncelik sırasına göre) çözdüğünü test edin.</p>

          <div class="sim-form">
            <div class="form-group">
              <label>Talep Önceliği</label>
              <select [value]="mockPriority" (change)="mockPriority = $any($event.target).value" class="form-control">
                <option value="STANDARD">Standart</option>
                <option value="URGENT">Acil</option>
                <option value="CRITICAL">Kritik (Kural 1 ve 5'i tetikler)</option>
              </select>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label>İş Emri Tahmini Maliyeti (TL)</label>
                <span class="counter">{{ String(mockCost).length }} / 8</span>
              </div>
              <input type="number" [value]="mockCost"
                     (keydown)="blockNumberKeys($event)"
                     (input)="onNumberInput($any($event.target), 'mockCost', 8)"
                     min="0" max="10000000" maxlength="8" class="form-control" />
              <small class="help-text" *ngIf="mockCost > 50000">Kural 2 tetiklenecek (> 50.000 TL Şube Onayı)</small>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label>Araç Son Bakımından Beri Geçen Gün</label>
                <span class="counter">{{ String(mockMaintenanceDays).length }} / 4</span>
              </div>
              <input type="number" [value]="mockMaintenanceDays"
                     (keydown)="blockNumberKeys($event)"
                     (input)="onNumberInput($any($event.target), 'mockMaintenanceDays', 4)"
                     min="0" max="10000" maxlength="4" class="form-control" />
              <small class="help-text" *ngIf="mockMaintenanceDays > 180">Kural 6 tetiklenecek (Bakım Gecikmesi Engeli)</small>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label>Araç Yakıt Seviyesi (%)</label>
                <span class="counter">{{ String(mockFuelLevel).length }} / 3</span>
              </div>
              <input type="number" [value]="mockFuelLevel"
                     (keydown)="blockNumberKeys($event)"
                     (input)="onNumberInput($any($event.target), 'mockFuelLevel', 3)"
                     min="0" max="100" maxlength="3" class="form-control" />
              <small class="help-text" *ngIf="mockFuelLevel < 30">Kural 7 tetiklenecek (Düşük Yakıt Engeli)</small>
            </div>

            <button (click)="runSimulation()" class="simulate-btn">Simülasyonu Çalıştır</button>
          </div>

          <!-- Simülasyon Sonuçları -->
          <div class="sim-results" *ngIf="simulationRan">
            <h4>Değerlendirme Sonuçları</h4>
            
            <div class="alert alert-info" *ngIf="simResults.length === 0">
              Girilen parametrelere göre tetiklenen kural bulunmadı. İşlem engelsiz devam eder.
            </div>

            <div *ngIf="simResults.length > 0">
              <div class="winner-box">
                <h5>Uygulanan / Kazanan Kural</h5>
                <div class="rule-result-item winner">
                  <p class="rule-title">{{ simResults[0].rule.name }}</p>
                  <p class="rule-details">
                    Öncelik Seviyesi: {{ simResults[0].rule.priority }} | Durum: 
                    <span class="badge" [class.blocked]="!simResults[0].allowed" [class.allowed]="simResults[0].allowed">
                      {{ simResults[0].allowed ? 'Geçerli / Uyarı' : 'ENGELLEME (BLOCKED)' }}
                    </span>
                  </p>
                  <p class="rule-reason"><strong>Gerekçe:</strong> {{ simResults[0].reason }}</p>
                </div>
              </div>

              <!-- Overridden rules (losers) -->
              <div class="losers-box" *ngIf="allSimTriggered.length > 1">
                <h5>Çakışma Nedeniyle Devre Dışı Kalan (Ezilen) Kurallar</h5>
                <div *ngFor="let item of getLoserRules()" class="rule-result-item loser">
                  <p class="rule-title">{{ item.rule.name }}</p>
                  <p class="rule-details">Öncelik: {{ item.rule.priority }} | Durum: Ezildi (Overridden)</p>
                  <p class="rule-reason"><strong>Çözüm Gerekçesi:</strong> Bu kuralın öncelik numarası kazanan kuraldan daha düşüktür veya kazanan kural sisteme daha önce eklenmiştir.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrls: ['./rule-list.component.scss']
})
export class RuleListComponent implements OnInit {
  private ruleService = inject(RuleEngineService);
  private storage = inject(StorageService);
  private auditLog = inject(AuditLogService);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  rules: Rule[] = [];

  translateTrigger(value: string | undefined | null): string {
    if (!value) return '—';
    return RULE_TRIGGER_LABELS[value] || value;
  }

  // Arama + Sayfalama (sayfa boyutu 5 sabit)
  searchTerm = '';
  page = 1;
  readonly pageSize = 5;
  String = String; // template'te String(...) için

  get filteredRules(): Rule[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.rules;
    return this.rules.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.trigger || '').toLowerCase().includes(q)
    );
  }
  get totalPages(): number { return Math.ceil(this.filteredRules.length / this.pageSize); }
  get startIdx(): number { return (this.page - 1) * this.pageSize; }
  get endIdx(): number { return Math.min(this.startIdx + this.pageSize, this.filteredRules.length); }
  get paginatedRules(): Rule[] { return this.filteredRules.slice(this.startIdx, this.endIdx); }

  setPage(p: number): void { if (p >= 1 && p <= this.totalPages) this.page = p; }
  onSearchInput(target: HTMLInputElement): void {
    let v = target.value || '';
    if (v.length > 30) { v = v.slice(0, 30); target.value = v; }
    this.searchTerm = v;
    this.page = 1; // arama değişince başa dön
  }

  // Simulator Inputs
  mockPriority = 'CRITICAL';
  mockCost = 65000;
  mockMaintenanceDays = 190;
  mockFuelLevel = 25;

  // Simulator Outputs
  simulationRan = false;
  simResults: RuleResult[] = [];
  allSimTriggered: RuleResult[] = [];

  /** Number input: e/E/+/- bloklanır. */
  blockNumberKeys(ev: KeyboardEvent): void {
    if (['e', 'E', '+', '-'].includes(ev.key)) ev.preventDefault();
  }

  /** Field'a göre üst sınır. */
  private fieldMax(field: 'mockCost' | 'mockMaintenanceDays' | 'mockFuelLevel'): number {
    if (field === 'mockCost') return 10000000;
    if (field === 'mockMaintenanceDays') return 10000;
    return 100; // mockFuelLevel
  }

  /** Number input için manuel maxLength + üst sınır kırpma (anlık). */
  onNumberInput(target: HTMLInputElement, field: 'mockCost' | 'mockMaintenanceDays' | 'mockFuelLevel', maxLen: number): void {
    let v = (target.value ?? '').replace(/[eE+]/g, '');
    if (v.length > maxLen) v = v.slice(0, maxLen);
    let n = v === '' ? 0 : Number(v);
    if (isNaN(n)) n = 0;
    const limit = this.fieldMax(field);
    if (n > limit) n = limit;
    if (n < 0) n = 0;
    const final = String(n);
    if (final !== target.value) target.value = final;
    (this as any)[field] = n;
  }

  ngOnInit(): void {
    this.loadRules();
  }

  loadRules(): void {
    try {
      this.rules = this.storage.getCollection<Rule>(STORAGE_KEYS.RULES)
        .sort((a, b) => a.priority - b.priority);
    } catch (e) {
      console.error(e);
    }
  }

  async toggleRule(rule: Rule): Promise<void> {
    this.permissionService.assertPermission('RULE_MANAGE');
    
    const actionText = rule.isActive ? 'pasifleştirmek' : 'aktifleştirmek';
    const approved = await this.confirmService.confirm(
      'Kural Durumu Değişikliği',
      `"${rule.name}" kuralını ${actionText} istediğinize emin misiniz?`
    );
    if (!approved) {
      this.loadRules();
      return;
    }

    const oldRule = { ...rule };
    rule.isActive = !rule.isActive;
    rule.updatedAt = new Date().toISOString();

    try {
      this.storage.update<Rule>(STORAGE_KEYS.RULES, rule.id, rule);
      
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'RULE',
        entityId: rule.id,
        oldValue: this.auditLog.stringifyValue(oldRule),
        newValue: this.auditLog.stringifyValue(rule),
        description: `İş Kuralı durumu değiştirildi: ${rule.name} (Aktif: ${rule.isActive})`
      });

      this.toastService.showSuccess(`Kural başarıyla ${rule.isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.`);
      this.loadRules();
      if (this.simulationRan) {
        this.runSimulation(); // Recalculate simulation if running
      }
    } catch (e: any) {
      this.toastService.showError(e.message || 'Kural güncellenirken hata oluştu.');
      this.loadRules();
    }
  }

  runSimulation(): void {
    this.simulationRan = true;
    this.simResults = [];
    this.allSimTriggered = [];

    // Create a mock context representing inputs
    const mockContext = {
      request: {
        id: 'mock-req-01',
        code: 'TALEP-MOCK',
        customerId: 'cust-1',
        customerName: 'Örnek Müşteri',
        customerPhone: '5550000000',
        customerAddress: 'Örnek Adres - Test Sokak No: 1',
        customerRegion: 'Örnek Bölge',
        branchId: 'sube-ist-01',
        title: 'Örnek Servis Talebi',
        description: 'Çakışma testi açıklaması',
        requiredSkill: 'HVAC',
        priority: this.mockPriority,
        status: 'NEW',
        slaDeadline: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours remaining (triggers Rule 5)
        hasWarranty: false,
        hasCustomerApproval: false,
        createdAt: new Date().toISOString()
      },
      workOrder: {
        id: 'mock-wo-01',
        code: 'WO-MOCK',
        serviceRequestId: 'mock-req-01',
        branchId: 'sube-ist-01',
        technicianId: 'tech-1',
        vehicleId: 'veh-1',
        status: 'OPENED',
        plannedStart: null,
        plannedEnd: null,
        actualStart: null,
        actualEnd: null,
        requiredParts: [],
        usedParts: [],
        estimatedCost: this.mockCost,
        actualCost: 0,
        failureReason: null,
        notes: '',
        createdAt: new Date().toISOString()
      },
      technician: {
        id: 'tech-1',
        fullName: 'İzinli Örnek Teknisyen',
        phone: '5551111111',
        email: 'mock@test.com',
        branchId: 'sube-ist-01',
        region: 'Kadıköy',
        level: 'SENIOR',
        skills: ['HVAC'],
        workingHoursStart: '08:30',
        workingHoursEnd: '17:30',
        workingDays: [1, 2, 3, 4, 5],
        isActive: true,
        isOnLeave: true, // triggers Rule 8 (isOnLeave)
        leaveStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        leaveEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        performanceScore: 85,
        completedJobsCount: 40,
        createdAt: new Date().toISOString()
      },
      vehicle: {
        id: 'veh-1',
        plateNumber: '34MOCK34',
        brand: 'Renault',
        model: 'Kangoo',
        vehicleType: 'Kamyonet',
        branchId: 'sube-ist-01',
        status: 'AVAILABLE',
        fuelLevel: this.mockFuelLevel, // fuel Level (Rule 7)
        lastMaintenanceDate: new Date(Date.now() - this.mockMaintenanceDays * 24 * 60 * 60 * 1000).toISOString(), // maintenance days (Rule 6)
        equipments: ['VACUUM_PUMP'],
        payloadCapacityKg: 800,
        assignedTechnicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      estimatedCost: this.mockCost
    };

    // Run active rules on WORK_ORDER_PLAN trigger
    const activeRules = this.ruleService.getActiveRules();
    
    // Evaluate manually in component to collect all triggered rules for display
    const triggered: RuleResult[] = [];
    for (const r of activeRules) {
      const res = this.ruleService.testRule(r, mockContext);
      // We check if rule conditions actually apply/trigger:
      // For simulator, if allowed is false or some conditions match:
      if (this.doesSimulatorRuleMatch(r.id)) {
        triggered.push(res);
      }
    }

    this.allSimTriggered = triggered;

    // Use RuleEngineService resolveConflicts to pick deterministic winner
    this.simResults = this.ruleService.resolveConflicts(triggered);
  }

  // Helper check for simulator matches
  private doesSimulatorRuleMatch(ruleId: string): boolean {
    if (ruleId === 'rule-1' && this.mockPriority === 'CRITICAL') return true;
    if (ruleId === 'rule-2' && this.mockCost > 50000) return true;
    if (ruleId === 'rule-5' && this.mockPriority === 'CRITICAL') return true; // SLA under 2 hours
    if (ruleId === 'rule-6' && this.mockMaintenanceDays > 180) return true;
    if (ruleId === 'rule-7' && this.mockFuelLevel < 30) return true;
    if (ruleId === 'rule-8') return true; // mock tech is always on leave in simulator
    if (ruleId === 'rule-10' && this.mockPriority !== 'CRITICAL') return true; // mock request has no customer approval
    return false;
  }

  getLoserRules(): RuleResult[] {
    if (this.simResults.length === 0) return [];
    const winnerId = this.simResults[0].rule.id;
    return this.allSimTriggered.filter(x => x.rule.id !== winnerId);
  }
}
