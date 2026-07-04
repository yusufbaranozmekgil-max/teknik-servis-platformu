import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RuleEngineService } from '../../../../core/services/rule-engine.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RuleResult } from '../../../../core/models/rule-result.model';

@Component({
  selector: 'app-rule-test',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h2>Kural Test Sandbox</h2>
            <p class="subtitle">İş kuralları motorunun dinamik değerlendirmelerini ve çakışma durumlarını canlı olarak test edin.</p>
          </div>
          <a routerLink="/kurallar" class="btn-back">← Kurallara Dön</a>
        </div>
      </div>

      <div class="sandbox-container card">
        <div class="sandbox-form">
          <h3>Test Senaryosu Parametreleri</h3>
          <p class="section-desc">Aşağıdaki alanları değiştirerek kural motorunun atamaları nasıl blokladığını veya onay gerektirdiğini gözlemleyin.</p>

          <div class="form-grid">
            <div class="form-group">
              <label>Test Talep Önceliği</label>
              <select [value]="mockPriority" (change)="mockPriority = $any($event.target).value" class="form-control">
                <option value="STANDARD">Standart</option>
                <option value="URGENT">Acil</option>
                <option value="CRITICAL">Kritik</option>
              </select>
            </div>

            <div class="form-group">
              <label>Test İş Emri Maliyeti (TL)</label>
              <input type="number" [value]="mockCost" (input)="onCostInput($any($event.target))" class="form-control" />
            </div>

            <div class="form-group">
              <label>Araç Son Bakımından Beri Geçen Gün</label>
              <input type="number" [value]="mockMaintenanceDays" (input)="onMaintenanceInput($any($event.target))" class="form-control" />
            </div>

            <div class="form-group">
              <label>Araç Yakıt Seviyesi (%)</label>
              <input type="number" [value]="mockFuelLevel" (input)="onFuelInput($any($event.target))" class="form-control" />
            </div>

            <div class="form-group">
              <label>Yedek Parça Stok Durumu</label>
              <select [value]="mockStockCritical ? '1' : '0'" (change)="mockStockCritical = $any($event.target).value === '1'" class="form-control">
                <option value="0">Yeterli (stok 50 / eşik 5)</option>
                <option value="1">Kritik (stok 2 / eşik 5)</option>
              </select>
            </div>

            <div class="form-group">
              <label>SLA Durumu</label>
              <select [value]="mockSlaState" (change)="mockSlaState = $any($event.target).value" class="form-control">
                <option value="NORMAL">Normal (bol süre)</option>
                <option value="APPROACHING">Yaklaşıyor (2 saatten az)</option>
                <option value="OVERDUE">Gecikmiş (süre aşıldı)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Teknisyen Durumu</label>
              <select [value]="mockTechnicianState" (change)="mockTechnicianState = $any($event.target).value" class="form-control">
                <option value="ACTIVE">Aktif</option>
                <option value="ON_LEAVE">İzinli</option>
                <option value="INACTIVE">Pasif</option>
              </select>
            </div>

            <div class="form-group">
              <label>Şube Günlük Kapasitesi</label>
              <select [value]="mockBranchFull ? '1' : '0'" (change)="mockBranchFull = $any($event.target).value === '1'" class="form-control">
                <option value="0">Uygun (2 / 10)</option>
                <option value="1">Dolu (10 / 10)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Garanti / Müşteri Onayı</label>
              <select [value]="mockWarranty" (change)="mockWarranty = $any($event.target).value" class="form-control">
                <option value="PAID_NO_APPROVAL">Garanti dışı, onay YOK</option>
                <option value="PAID_APPROVED">Garanti dışı, onaylı</option>
                <option value="WARRANTY">Garanti kapsamında</option>
              </select>
            </div>
          </div>

          <button (click)="runSimulation()" class="simulate-btn">Simülasyon Değerlendirmesini Başlat</button>
        </div>

        <div class="sandbox-results" *ngIf="simulationRan">
          <h3>Simülasyon Değerlendirme Sonuçları</h3>

          <div class="alert alert-info" *ngIf="simResults.length === 0">
            Girilen parametrelere göre tetiklenen aktif kural bulunmadı. İşlem engelsiz devam eder.
          </div>

          <div *ngIf="simResults.length > 0">
            <div class="winner-box">
              <h5>Uygulanan / Kazanan Kural</h5>
              <div class="rule-result-item winner">
                <p class="rule-title">{{ simResults[0].rule.name }}</p>
                <p class="rule-details">
                  Öncelik Seviyesi: {{ simResults[0].rule.priority }} | İşlem Durumu:
                  <span class="badge" [class.blocked]="!simResults[0].allowed" [class.allowed]="simResults[0].allowed">
                    {{ simResults[0].allowed ? 'Geçiş Serbest' : 'ENGELLEDİ / ONAY GEREK' }}
                  </span>
                </p>
                <p class="rule-reason" *ngIf="simResults[0].reason">
                  <strong>Gerekçe:</strong> {{ simResults[0].reason }}
                </p>
              </div>
            </div>

            <div class="losers-box" *ngIf="getLoserRules().length > 0">
              <h5>Elenebilecek / Diğer Tetiklenen Kurallar</h5>
              <div *ngFor="let r of getLoserRules()" class="rule-result-item loser">
                <p class="rule-title">{{ r.rule.name }}</p>
                <p class="rule-details">
                  Öncelik Seviyesi: {{ r.rule.priority }} (Daha düşük öncelik olduğundan ezildi)
                </p>
                <p class="rule-reason" *ngIf="r.reason">
                  <strong>Gerekçe:</strong> {{ r.reason }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      font-family: 'Inter', sans-serif;
    }
    .header-section { margin-bottom: 2rem; }
    h2 { font-size: 1.875rem; color: #0f172a; margin: 0 0 0.5rem; font-weight: 700; }
    .subtitle { color: #64748b; font-size: 1rem; margin: 0; }
    
    .btn-back {
      padding: 0.5rem 1rem;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 0.375rem;
      color: #334155;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .btn-back:hover { background: #f8fafc; }

    .sandbox-container {
      background: white;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      padding: 2rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      
      label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .form-control {
      padding: 0.625rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      outline: none;
    }
    .form-control:focus { border-color: #2563eb; }

    .simulate-btn {
      width: 100%;
      padding: 0.75rem;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .simulate-btn:hover { background: #1d4ed8; }

    .sandbox-results {
      margin-top: 2.5rem;
      border-top: 2px dashed #e2e8f0;
      padding-top: 2rem;
    }

    .alert-info {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.9rem;
    }

    .winner-box, .losers-box {
      margin-top: 1.5rem;
      
      h5 {
        font-size: 0.85rem;
        text-transform: uppercase;
        font-weight: 700;
        color: #475569;
        margin-bottom: 0.5rem;
        letter-spacing: 0.05em;
      }
    }

    .rule-result-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;

      &.winner {
        border-left: 5px solid #2563eb;
        background: #f8fafc;
      }

      &.loser {
        opacity: 0.75;
        border-left: 5px solid #64748b;
      }

      .rule-title {
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.25rem 0;
        font-size: 0.95rem;
      }

      .rule-details {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0 0 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .rule-reason {
        font-size: 0.85rem;
        color: #334155;
        margin: 0;
        background: white;
        padding: 0.5rem;
        border-radius: 0.25rem;
        border: 1px solid #f1f5f9;
      }
    }

    .badge {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;

      &.allowed { background: #d1fae5; color: #065f46; }
      &.blocked { background: #fee2e2; color: #991b1b; }
    }
  `]
})
export class RuleTestComponent {
  private ruleService = inject(RuleEngineService);
  private permission = inject(PermissionService);
  private toast = inject(ToastService);

  mockPriority = 'STANDARD';
  mockCost = 1500;
  mockMaintenanceDays = 30;
  mockFuelLevel = 80;
  mockStockCritical = false;                 // rule-3
  mockSlaState = 'NORMAL';                    // rule-4 / rule-5
  mockTechnicianState = 'ACTIVE';             // rule-8
  mockBranchFull = false;                     // rule-9
  mockWarranty = 'PAID_NO_APPROVAL';          // rule-10

  simulationRan = false;
  simResults: RuleResult[] = [];
  allSimTriggered: RuleResult[] = [];

  constructor() {
    this.permission.assertPermission('RULE_MANAGE');
  }

  onCostInput(target: HTMLInputElement): void {
    let val = target.value.replace(/[^0-9]/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    this.mockCost = val === '' ? 0 : Number(val);
    target.value = String(this.mockCost);
  }

  onMaintenanceInput(target: HTMLInputElement): void {
    let val = target.value.replace(/[^0-9]/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    this.mockMaintenanceDays = val === '' ? 0 : Number(val);
    target.value = String(this.mockMaintenanceDays);
  }

  onFuelInput(target: HTMLInputElement): void {
    let val = target.value.replace(/[^0-9]/g, '');
    if (val.length > 3) val = val.slice(0, 3);
    let num = val === '' ? 0 : Number(val);
    if (num > 100) num = 100;
    this.mockFuelLevel = num;
    target.value = String(this.mockFuelLevel);
  }

  runSimulation(): void {
    try {
      this.permission.assertPermission('RULE_MANAGE');

      // Create a mock context representing this state
      const mockContext = {
        request: {
          id: 'mock-req-01',
          code: 'REQ-MOCK',
          customerId: 'cust-1',
          customerPhone: '5550000000',
          branchId: 'sube-ist-01',
          title: 'Örnek Servis Talebi',
          description: 'Çakışma testi açıklaması',
          requiredSkill: 'HVAC',
          priority: this.mockPriority,
          status: 'OPENED',
          slaDeadline: this.computeMockSla(),
          hasWarranty: this.mockWarranty === 'WARRANTY',
          hasCustomerApproval: this.mockWarranty === 'PAID_APPROVED',
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
          isActive: this.mockTechnicianState !== 'INACTIVE',
          isOnLeave: this.mockTechnicianState === 'ON_LEAVE',
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
          fuelLevel: this.mockFuelLevel,
          lastMaintenanceDate: new Date(Date.now() - this.mockMaintenanceDays * 24 * 60 * 60 * 1000).toISOString(),
          equipments: ['VACUUM_PUMP'],
          payloadCapacityKg: 800,
          assignedTechnicianId: null,
          isActive: true,
          createdAt: new Date().toISOString()
        },
        sparePart: {
          id: 'part-mock', code: 'PM-01', name: 'Test Parça', category: 'FILTER',
          branchId: 'sube-ist-01', compatibleDevices: '', unit: 'PCS',
          stockQuantity: this.mockStockCritical ? 2 : 50,
          reservedQuantity: 0,
          minStockThreshold: 5,
          unitPrice: 100, isActive: true, createdAt: new Date().toISOString()
        },
        branch: {
          id: 'sube-ist-01', name: 'İstanbul Merkez', isActive: true, dailyCapacity: 10
        },
        branchCurrentOrdersCount: this.mockBranchFull ? 10 : 2,
        estimatedCost: this.mockCost
      };

      const activeRules = this.ruleService.getActiveRules();
      const triggered: RuleResult[] = [];

      // Gerçek kural değerlendirmesi: testRule koşulu tetikliyorsa sonuca dahil et.
      for (const r of activeRules) {
        const res = this.ruleService.testRule(r, mockContext);
        if (res.triggered) {
          triggered.push(res);
        }
      }

      this.allSimTriggered = triggered;
      this.simResults = this.ruleService.resolveConflicts(triggered);
      this.simulationRan = true;

      this.toast.showSuccess('Simülasyon başarıyla tamamlandı.');
    } catch (e: any) {
      this.toast.showError(e.message || 'Simülasyon çalıştırılırken hata oluştu.');
    }
  }

  /** SLA senaryosuna göre mock son müdahale tarihi üretir (rule-4 gecikme / rule-5 yaklaşma). */
  private computeMockSla(): string {
    const now = Date.now();
    if (this.mockSlaState === 'OVERDUE') return new Date(now - 60 * 60 * 1000).toISOString();
    if (this.mockSlaState === 'APPROACHING') return new Date(now + 60 * 60 * 1000).toISOString();
    return new Date(now + 10 * 60 * 60 * 1000).toISOString();
  }

  getLoserRules(): RuleResult[] {
    if (this.simResults.length === 0) return [];
    const winnerId = this.simResults[0].rule.id;
    return this.allSimTriggered.filter(x => x.rule.id !== winnerId);
  }
}
