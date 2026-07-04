import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ServiceRequestService } from '../../../../core/services/service-request.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { WorkOrderService } from '../../../../core/services/work-order.service';
import { TechnicianScoringService, TechnicianScoreResult } from '../../../../core/services/technician-scoring.service';
import { VehicleScoringService, VehicleScoreResult } from '../../../../core/services/vehicle-scoring.service';
import { ServiceRequest } from '../../../../core/models/service-request.model';
import { SparePart } from '../../../../core/models/spare-part.model';
import { RequiredPart } from '../../../../core/models/work-order.model';
import { TimeSlot } from '../../../../core/models/time-slot.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import { SmartDateInputComponent } from '../../../../shared/components/smart-date-input/smart-date-input.component';

@Component({
  selector: 'app-schedule-board',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SmartDateInputComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h2>İş Emri Planlama ve Kaynak Atama</h2>
        <p class="subtitle">Açık servis taleplerini değerlendirip, en uygun teknisyen, araç ve yedek parçayı atayarak planlama yapın.</p>
      </div>

      <div class="planning-grid">
        <!-- Sol Kolon: Seçimler ve Planlama Parametreleri -->
        <div class="control-panel card">
          <h3>1. Talep ve Zaman Dilimi Seçimi</h3>
          
          <div class="form-group">
            <label for="requestSelect">Açık Servis Talebi</label>
            <select id="requestSelect" [value]="selectedRequestId" (change)="selectedRequestId = $any($event.target).value; onRequestChange()" class="form-control">
              <option value="" disabled selected>-- Talep Seçiniz --</option>
              <option *ngFor="let req of openRequests" [value]="req.id">
                [{{ req.code }}] - {{ req.customerName }} - {{ req.title }} ({{ translatePriority(req.priority) }})
              </option>
            </select>
          </div>

          <!-- Seçilen Talep Detayları -->
          <div class="request-details-box" *ngIf="selectedRequest">
            <h4>Talep Bilgileri</h4>
            <p><strong>Cihaz/Marka/Model:</strong> {{ selectedRequest.deviceBrandModel }}</p>
            <p><strong>Gerekli Yetkinlik:</strong> <span class="badge skill-badge">{{ translateSkill(selectedRequest.requiredSkill) }}</span></p>
            <p><strong>Öncelik:</strong> <span class="badge priority-badge" [class]="selectedRequest.priority.toLowerCase()">{{ translatePriority(selectedRequest.priority) }}</span></p>
            <p><strong>SLA Deadline:</strong> {{ selectedRequest.slaDeadline | date:'dd.MM.yyyy HH:mm' }}</p>
            <p><strong>Arıza Açıklaması:</strong> {{ selectedRequest.description }}</p>
          </div>

          <hr class="divider" />

          <h3>2. Randevu Saatleri</h3>
          <div class="date-time-grid">
            <div class="form-group">
              <label for="slotDate">Tarih</label>
              <app-smart-date-input
                [value]="slotDate"
                (valueChange)="slotDate = $event || ''; onSlotChange()"
                [minDate]="todayISO"
                [maxDate]="'2099-12-31'"
                [minYear]="2025"
                [maxYear]="2099"
              ></app-smart-date-input>
            </div>
            <div class="form-group">
              <label for="slotStart">Başlangıç</label>
              <input id="slotStart" type="time" [value]="slotStart" (change)="slotStart = $any($event.target).value; onSlotChange()" class="form-control" />
            </div>
            <div class="form-group">
              <label for="slotEnd">Bitiş</label>
              <input id="slotEnd" type="time" [value]="slotEnd" (change)="slotEnd = $any($event.target).value; onSlotChange()" class="form-control" />
            </div>
          </div>

          <hr class="divider" />

          <h3>3. Gerekli Yedek Parçalar</h3>
          <div class="parts-selector-box" *ngIf="selectedRequest">
            <div class="parts-add-form">
              <div class="form-group select-part-group">
                <label>Parça Seç</label>
                <select [value]="selectedPartId" (change)="selectedPartId = $any($event.target).value" class="form-control">
                  <option value="" disabled>-- Parça Seçiniz --</option>
                  <option *ngFor="let p of branchParts" [value]="p.id">
                    {{ p.name }} (Kod: {{ p.code }}) - Kalan: {{ getPartAvailable(p) }}
                  </option>
                </select>
              </div>
              <div class="form-group qty-group">
                <label>Miktar</label>
                <input type="number" [value]="selectedPartQty" (input)="selectedPartQty = $any($event.target).valueAsNumber || 0" min="1" class="form-control" />
              </div>
              <button (click)="addPartToPlan()" class="add-part-btn">Ekle</button>
            </div>

            <!-- Eklenen Parçalar Tablosu -->
            <div class="added-parts-list" *ngIf="plannedParts.length > 0">
              <table class="parts-table">
                <thead>
                  <tr>
                    <th>Parça</th>
                    <th>Miktar</th>
                    <th>Mevcut</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of plannedParts; let idx = index">
                    <td>{{ getPartName(p.partId) }}</td>
                    <td class="font-bold">{{ p.quantity }}</td>
                    <td>{{ getPartAvailableById(p.partId) }}</td>
                    <td><button (click)="removePartFromPlan(idx)" class="delete-link">Kaldır</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="alert alert-info" *ngIf="!selectedRequest">
            Öncelikle bir servis talebi seçmelisiniz.
          </div>
        </div>

        <!-- Sağ Kolon: Skorlama Kırılımları ve Atama -->
        <div class="results-panel card">
          <div class="panel-section-header">
            <h3>4. Kaynak Atama ve Skorlama</h3>
            <span class="step-desc">Seçilen zamana ve talebe göre en uyumlu kaynaklar puanlanarak sıralanmıştır.</span>
          </div>

          <!-- Hata ve Başarı Mesajları -->
          <div class="alert alert-danger" *ngIf="errorMessage">
            <strong>Planlama Başarısız:</strong> {{ errorMessage }}
          </div>
          <div class="alert alert-success" *ngIf="successMessage">
            <strong>Başarılı:</strong> {{ successMessage }}
          </div>

          <!-- Teknisyen Atama -->
          <div class="resource-section">
            <h4>Uygun Teknisyenler</h4>
            <div class="resource-list" *ngIf="selectedRequest && eligibleTechnicians.length > 0">
              <div
                *ngFor="let item of paginatedTechnicians"
                class="resource-card"
                [class.selected]="selectedTechnicianId === item.technician.id"
                (click)="selectTechnician(item.technician.id)"
              >
                <div class="card-header">
                  <div class="card-title-info">
                    <h5>{{ item.technician.fullName }}</h5>
                    <span class="sub-label">{{ translateLevel(item.technician.level) }} | Bölge: {{ item.technician.region }}</span>
                  </div>
                  <div class="score-badge" [class.high-score]="item.totalScore >= 75">
                    {{ item.totalScore }} Puan
                  </div>
                </div>

                <!-- Explanation / Breakdown -->
                <div class="card-body">
                  <ul class="breakdown-list">
                    <li *ngFor="let exp of item.explanation">{{ exp }}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="mini-pagination" *ngIf="selectedRequest && eligibleTechnicians.length > 0">
              <span class="page-info">
                <strong>{{ eligibleTechnicians.length }}</strong> uygun teknisyenden {{ techStartIdx + 1 }}–{{ techEndIdx }} arası
              </span>
              <div class="page-controls">
                <button [disabled]="techPage === 1" (click)="setTechPage(techPage - 1)">‹</button>
                <span class="page-num">{{ techPage }} / {{ techTotalPages || 1 }}</span>
                <button [disabled]="techPage >= techTotalPages" (click)="setTechPage(techPage + 1)">›</button>
              </div>
            </div>
            <div class="alert alert-info" *ngIf="!selectedRequest">
              Teknisyenleri listelemek için talep seçiniz.
            </div>
            <div class="alert alert-warning" *ngIf="selectedRequest && eligibleTechnicians.length === 0">
              Bu kriterlere uygun teknisyen bulunamadı.
            </div>
          </div>

          <!-- Araç Atama -->
          <div class="resource-section">
            <h4>Uygun Araçlar</h4>
            <div class="resource-list" *ngIf="selectedRequest && eligibleVehicles.length > 0">
              <div
                *ngFor="let item of paginatedVehicles"
                class="resource-card"
                [class.selected]="selectedVehicleId === item.vehicle.id"
                (click)="selectVehicle(item.vehicle.id)"
              >
                <div class="card-header">
                  <div class="card-title-info">
                    <h5>{{ item.vehicle.brand }} {{ item.vehicle.model }}</h5>
                    <span class="sub-label">Plaka: {{ item.vehicle.plateNumber }} | Yakıt: %{{ item.vehicle.fuelLevel }}</span>
                  </div>
                  <div class="score-badge vehicle-badge" [class.high-score]="item.totalScore >= 75">
                    {{ item.totalScore }} Puan
                  </div>
                </div>

                <div class="card-body">
                  <ul class="breakdown-list">
                    <li *ngFor="let exp of item.explanation">{{ exp }}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="mini-pagination" *ngIf="selectedRequest && eligibleVehicles.length > 0">
              <span class="page-info">
                <strong>{{ eligibleVehicles.length }}</strong> uygun araçtan {{ vehStartIdx + 1 }}–{{ vehEndIdx }} arası
              </span>
              <div class="page-controls">
                <button [disabled]="vehPage === 1" (click)="setVehPage(vehPage - 1)">‹</button>
                <span class="page-num">{{ vehPage }} / {{ vehTotalPages || 1 }}</span>
                <button [disabled]="vehPage >= vehTotalPages" (click)="setVehPage(vehPage + 1)">›</button>
              </div>
            </div>
            <div class="alert alert-info" *ngIf="!selectedRequest">
              Araçları listelemek için talep seçiniz.
            </div>
            <div class="alert alert-warning" *ngIf="selectedRequest && eligibleVehicles.length === 0">
              Bu kriterlere uygun araç bulunamadı.
            </div>
          </div>

          <!-- Planlama Butonu -->
          <div class="planning-actions" *ngIf="selectedRequest">
            <button 
              [disabled]="!selectedTechnicianId || !selectedVehicleId || isPlanning" 
              (click)="onPlanSubmit()" 
              class="plan-submit-btn"
            >
              {{ isPlanning ? 'Planlanıyor...' : 'İş Emrini Oluştur ve Planla' }}
            </button>
            <p class="help-text" *ngIf="!selectedTechnicianId || !selectedVehicleId">
              Planlama yapabilmek için listeden uygun bir teknisyen ve araç seçmelisiniz.
            </p>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrls: ['./schedule-board.component.scss']
})
export class ScheduleBoardComponent implements OnInit, ComponentCanDeactivate {
  private requestService = inject(ServiceRequestService);
  private inventoryService = inject(InventoryService);
  private workOrderService = inject(WorkOrderService);
  private techScoringService = inject(TechnicianScoringService);
  private vehicleScoringService = inject(VehicleScoringService);
  private router = inject(Router);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  isSubmitted = false;

  // Lists
  openRequests: ServiceRequest[] = [];
  branchParts: SparePart[] = [];

  // Selections
  selectedRequestId = '';
  selectedRequest: ServiceRequest | null = null;
  selectedPartId = '';
  selectedPartQty = 1;
  
  // Slot parameters
  slotDate = '';
  slotStart = '09:00';
  slotEnd = '11:00';
  todayISO = new Date().toISOString().substring(0, 10);

  // Planned payload
  plannedParts: RequiredPart[] = [];
  selectedTechnicianId = '';
  selectedVehicleId = '';

  // Results
  scoredTechnicians: TechnicianScoreResult[] = [];
  scoredVehicles: VehicleScoreResult[] = [];

  // Mini pagination (max 5 per page) — sadece UYGUN kaynaklar gösterilir
  readonly resourcePageSize = 5;
  techPage = 1;
  vehPage = 1;

  get eligibleTechnicians(): TechnicianScoreResult[] { return this.scoredTechnicians.filter(t => t.eligible); }
  get eligibleVehicles(): VehicleScoreResult[] { return this.scoredVehicles.filter(v => v.eligible); }

  get techTotalPages(): number { return Math.ceil(this.eligibleTechnicians.length / this.resourcePageSize); }
  get techStartIdx(): number { return (this.techPage - 1) * this.resourcePageSize; }
  get techEndIdx(): number { return Math.min(this.techStartIdx + this.resourcePageSize, this.eligibleTechnicians.length); }
  get paginatedTechnicians(): TechnicianScoreResult[] { return this.eligibleTechnicians.slice(this.techStartIdx, this.techEndIdx); }
  setTechPage(p: number): void { if (p >= 1 && p <= this.techTotalPages) this.techPage = p; }

  get vehTotalPages(): number { return Math.ceil(this.eligibleVehicles.length / this.resourcePageSize); }
  get vehStartIdx(): number { return (this.vehPage - 1) * this.resourcePageSize; }
  get vehEndIdx(): number { return Math.min(this.vehStartIdx + this.resourcePageSize, this.eligibleVehicles.length); }
  get paginatedVehicles(): VehicleScoreResult[] { return this.eligibleVehicles.slice(this.vehStartIdx, this.vehEndIdx); }
  setVehPage(p: number): void { if (p >= 1 && p <= this.vehTotalPages) this.vehPage = p; }

  // UI state
  isPlanning = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    // Get requests in NEW status
    this.loadOpenRequests();
    
    // Set default date to today
    const today = new Date();
    this.slotDate = today.toISOString().split('T')[0];
  }

  loadOpenRequests(): void {
    try {
      this.openRequests = this.requestService.getServiceRequests().filter(r => r.status === 'NEW');
    } catch (err: any) {
      this.errorMessage = err.message || 'Hizmet talepleri yüklenemedi.';
    }
  }

  onRequestChange(): void {
    this.selectedRequest = this.openRequests.find(r => r.id === this.selectedRequestId) || null;
    this.plannedParts = [];
    this.selectedPartId = '';
    this.selectedPartQty = 1;
    this.selectedTechnicianId = '';
    this.selectedVehicleId = '';
    this.errorMessage = null;
    this.successMessage = null;

    if (this.selectedRequest) {
      // Load parts for request's branch
      try {
        const parts = this.inventoryService.getSpareParts();
        this.branchParts = parts.filter(p => p.branchId === this.selectedRequest!.branchId);
      } catch (err: any) {
        console.error('Parçalar yüklenemedi:', err.message);
      }
      this.recalculateScores();
    } else {
      this.branchParts = [];
      this.scoredTechnicians = [];
      this.scoredVehicles = [];
    }
  }

  onSlotChange(): void {
    this.errorMessage = null;
    this.successMessage = null;
    this.recalculateScores();
  }

  recalculateScores(): void {
    if (!this.selectedRequest || !this.slotDate || !this.slotStart || !this.slotEnd) {
      return;
    }

    const slot: TimeSlot = {
      start: `${this.slotDate}T${this.slotStart}:00`,
      end: `${this.slotDate}T${this.slotEnd}:00`
    };

    try {
      this.scoredTechnicians = this.techScoringService.getEligibleTechnicians(this.selectedRequest.id, slot);
      this.scoredVehicles = this.vehicleScoringService.getEligibleVehicles(this.selectedRequest.id, slot);
      // Skor değişti → sayfaları başa al
      this.techPage = 1;
      this.vehPage = 1;

      // Reset selection if the previously selected resource is no longer eligible
      if (this.selectedTechnicianId) {
        const match = this.scoredTechnicians.find(t => t.technician.id === this.selectedTechnicianId);
        if (!match || !match.eligible) {
          this.selectedTechnicianId = '';
        }
      }

      if (this.selectedVehicleId) {
        const match = this.scoredVehicles.find(v => v.vehicle.id === this.selectedVehicleId);
        if (!match || !match.eligible) {
          this.selectedVehicleId = '';
        }
      }

    } catch (err: any) {
      this.errorMessage = err.message || 'Skor hesaplama sırasında bir hata oluştu.';
    }
  }

  addPartToPlan(): void {
    if (!this.selectedPartId || this.selectedPartQty <= 0) return;
    this.errorMessage = null;
    const avail = this.getPartAvailableById(this.selectedPartId);
    const existing = this.plannedParts.find(p => p.partId === this.selectedPartId);
    const targetQty = existing ? existing.quantity + this.selectedPartQty : this.selectedPartQty;
    
    if (targetQty > avail) {
      this.errorMessage = `Yetersiz stok. Mevcut kullanılabilir miktar: ${avail}`;
      this.toastService.showError(this.errorMessage);
      return;
    }
    
    if (existing) {
      existing.quantity = targetQty;
    } else {
      this.plannedParts.push({
        partId: this.selectedPartId,
        quantity: this.selectedPartQty
      });
    }

    // Reset part inputs
    this.selectedPartId = '';
    this.selectedPartQty = 1;
  }

  removePartFromPlan(index: number): void {
    this.plannedParts.splice(index, 1);
  }

  getPartName(partId: string): string {
    const p = this.branchParts.find(x => x.id === partId);
    return p ? `${p.name} (${p.code})` : 'Bilinmeyen Parça';
  }

  getPartAvailable(part: SparePart): number {
    return part.stockQuantity - part.reservedQuantity;
  }

  getPartAvailableById(partId: string): number {
    const p = this.branchParts.find(x => x.id === partId);
    return p ? p.stockQuantity - p.reservedQuantity : 0;
  }

  selectTechnician(id: string): void {
    this.selectedTechnicianId = id;
    this.errorMessage = null;
  }

  selectVehicle(id: string): void {
    this.selectedVehicleId = id;
    this.errorMessage = null;
  }

  canDeactivate(): boolean {
    if (this.selectedRequest && !this.isSubmitted) {
      return confirm('Planlama süreci devam ediyor. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onPlanSubmit(): Promise<void> {
    if (!this.selectedRequest || !this.selectedTechnicianId || !this.selectedVehicleId) {
      return;
    }

    const approved = await this.confirmService.confirm(
      'İş Emri Planlama',
      'Bu kaynak atamasını onaylayarak iş emrini planlamak istediğinize emin misiniz?'
    );
    if (!approved) return;

    this.isPlanning = true;
    this.errorMessage = null;
    this.successMessage = null;

    const slot: TimeSlot = {
      start: `${this.slotDate}T${this.slotStart}:00`,
      end: `${this.slotDate}T${this.slotEnd}:00`
    };

    try {
      // 1. Create a work order for the request
      const wo = this.workOrderService.createWorkOrderFromRequest(this.selectedRequest.id);

      // 2. Plan the work order with technician, vehicle, time slot, and parts
      this.workOrderService.planWorkOrder(
        wo.id,
        this.selectedTechnicianId,
        this.selectedVehicleId,
        slot,
        this.plannedParts
      );

      this.isSubmitted = true;
      this.successMessage = `İş emri başarıyla planlandı. Kod: ${wo.code}`;
      this.toastService.showSuccess(this.successMessage);
      
      // Reset form state
      this.selectedRequestId = '';
      this.selectedRequest = null;
      this.plannedParts = [];
      this.selectedTechnicianId = '';
      this.selectedVehicleId = '';
      this.isSubmitted = false; // Reset for next planning
      
      // Reload list of requests
      this.loadOpenRequests();

    } catch (err: any) {
      this.errorMessage = err.message || 'Planlama sırasında beklenmeyen bir hata oluştu.';
      this.toastService.showError(this.errorMessage!);
    } finally {
      this.isPlanning = false;
    }
  }

  translatePriority(val: string): string {
    const map: Record<string, string> = {
      CRITICAL: 'Kritik',
      URGENT: 'Acil',
      STANDARD: 'Standart'
    };
    return map[val] || val;
  }

  translateSkill(val: string): string {
    const map: Record<string, string> = {
      WHITE_GOODS: 'Beyaz Eşya',
      HVAC: 'Klima / Soğutma',
      ELECTRIC: 'Elektrik Tesisatı',
      ELECTRONICS_MOTHERBOARD: 'Elektronik / Anakart',
      PLUMBING: 'Sıhhi Tesisat',
      BOILER_HEATING: 'Kombi / Isıtma'
    };
    return map[val] || val;
  }

  translateLevel(val: string): string {
    const map: Record<string, string> = {
      JUNIOR: 'Çırak',
      MID: 'Kalfa',
      SENIOR: 'Usta'
    };
    return map[val] || val;
  }
}
