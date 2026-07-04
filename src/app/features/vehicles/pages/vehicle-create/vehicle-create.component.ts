import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { BranchService } from '../../../../core/services/branch.service';
import { TechnicianService } from '../../../../core/services/technician.service';
import { Branch } from '../../../../core/models/branch.model';
import { Technician } from '../../../../core/models/technician.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { SmartDateInputComponent } from '../../../../shared/components/smart-date-input/smart-date-input.component';
import { FIELD_LIMITS, NUMERIC_LIMITS, DATE_LIMITS, todayISO } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-vehicle-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormFieldComponent, SmartDateInputComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/araclar" class="back-link">← Araçlara Dön</a>
          <h2>Yeni Araç Ekle</h2>
        </div>
      </div>

      <div class="card-content">
        <form [formGroup]="vehicleForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <app-form-field
              label="Plaka Numarası"
              [control]="$any(vehicleForm.get('plateNumber'))"
              [maxLength]="FIELD_LIMITS.plate"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: 34ABC123"
            ></app-form-field>

            <app-form-field
              label="Araç Tipi"
              type="select"
              [control]="$any(vehicleForm.get('vehicleType'))"
              [required]="true"
            >
              <option value="Panelvan">Panelvan</option>
              <option value="Kamyonet">Kamyonet</option>
              <option value="Motosiklet">Motosiklet</option>
              <option value="Otomobil">Otomobil</option>
            </app-form-field>

            <app-form-field
              label="Marka"
              [control]="$any(vehicleForm.get('brand'))"
              [maxLength]="FIELD_LIMITS.brand"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Renault"
            ></app-form-field>

            <app-form-field
              label="Model"
              [control]="$any(vehicleForm.get('model'))"
              [maxLength]="FIELD_LIMITS.model"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Kangoo"
            ></app-form-field>

            <app-form-field
              label="Bağlı Şube"
              type="select"
              [control]="$any(vehicleForm.get('branchId'))"
              [required]="true"
            >
              <option value="" disabled selected>Şube Seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </app-form-field>

            <app-form-field
              label="Atanmış Teknisyen (Sürücü)"
              type="select"
              [control]="$any(vehicleForm.get('assignedTechnicianId'))"
            >
              <option [value]="null">Atama Yok</option>
              <option *ngFor="let t of technicians" [value]="t.id">{{ t.fullName }}</option>
            </app-form-field>

            <app-form-field
              label="Taşıma Kapasitesi (kg)"
              type="number"
              [control]="$any(vehicleForm.get('payloadCapacityKg'))"
              [min]="NUMERIC_LIMITS.vehicleCapacity.min"
              [max]="NUMERIC_LIMITS.vehicleCapacity.max"
              [maxLength]="5"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Mevcut Yakıt Seviyesi (%)"
              type="number"
              [control]="$any(vehicleForm.get('fuelLevel'))"
              [min]="NUMERIC_LIMITS.fuelLevel.min"
              [max]="NUMERIC_LIMITS.fuelLevel.max"
              [maxLength]="3"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Durum"
              type="select"
              [control]="$any(vehicleForm.get('status'))"
              [required]="true"
            >
              <option value="AVAILABLE">Müsait</option>
              <option value="ACTIVE">Görevde</option>
              <option value="MAINTENANCE">Bakımda</option>
              <option value="OUT_OF_SERVICE">Pasif</option>
            </app-form-field>

            <div class="form-group">
              <label>Son Bakım Tarihi <span style="color:#dc2626">*</span></label>
              <app-smart-date-input
                formControlName="lastMaintenanceDate"
                [minDate]="DATE_LIMITS.PAST_MIN"
                [maxDate]="todayISO()"
                [minYear]="2000"
                [maxYear]="2099"
              ></app-smart-date-input>
              <small class="hint-text" style="color:#64748b;font-size:0.75rem">Gün/Ay/Yıl (örn. 15/06/2025). 30 Şubat gibi geçersiz tarih otomatik düzeltilir.</small>
            </div>
          </div>

          <div class="form-group full-width" style="margin-top: 1rem;">
            <label>Araç İçi Ekipman Seti / Demirbaşlar (Virgülle ayırarak yazın)</label>
            <input id="equipmentsInput" type="text" placeholder="Merdiven, Jeneratör, Alet Çantası, Matkap..." />
            <span class="hint-text">Ekipmanlar planlama kurallarında test edilir.</span>
          </div>

          <div class="form-group check-group" style="margin-top: 1.25rem;">
            <label class="switch-label">
              <input type="checkbox" formControlName="isActive" />
              <span class="switch-text">Aktif Kullanımda</span>
            </label>
          </div>

          <div *ngIf="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button type="button" routerLink="/araclar" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="vehicleForm.invalid || loading" class="save-btn">
              {{ loading ? 'Kaydediliyor...' : 'Aracı Kaydet' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./vehicle-create.component.scss']
})
export class VehicleCreatePage implements OnInit, ComponentCanDeactivate {
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private techService = inject(TechnicianService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  branches: Branch[] = [];
  technicians: Technician[] = [];
  errorMessage: string | null = null;
  loading = false;
  isSubmitted = false;

  FIELD_LIMITS = FIELD_LIMITS;
  NUMERIC_LIMITS = NUMERIC_LIMITS;
  DATE_LIMITS = DATE_LIMITS;
  todayISO = todayISO;

  vehicleForm: FormGroup = this.fb.group({
    plateNumber: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.plate), CustomValidators.plateNumber(), CustomValidators.noWhitespace()]],
    vehicleType: ['Panelvan', [Validators.required]],
    brand: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.brand), CustomValidators.noWhitespace()]],
    model: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.model), CustomValidators.noWhitespace()]],
    branchId: ['', [Validators.required]],
    assignedTechnicianId: [null],
    payloadCapacityKg: [1000, [Validators.required, Validators.min(NUMERIC_LIMITS.vehicleCapacity.min), Validators.max(NUMERIC_LIMITS.vehicleCapacity.max)]],
    fuelLevel: [100, [Validators.required, Validators.min(NUMERIC_LIMITS.fuelLevel.min), Validators.max(NUMERIC_LIMITS.fuelLevel.max)]],
    status: ['AVAILABLE', [Validators.required]],
    lastMaintenanceDate: [todayISO(), [Validators.required, CustomValidators.dateRange(DATE_LIMITS.PAST_MIN, todayISO())]],
    isActive: [true]
  });

  ngOnInit(): void {
    try {
      this.branches = this.branchService.getBranches();
      this.technicians = this.techService.getTechnicians();
    } catch (err: any) {
      this.errorMessage = 'Veriler yüklenemedi: ' + err.message;
    }
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }

  canDeactivate(): boolean {
    if (this.vehicleForm.dirty && !this.isSubmitted) {
      return confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (this.vehicleForm.valid) {
      const formVal = this.vehicleForm.value;
      const equipmentStr = (document.querySelector('#equipmentsInput') as HTMLInputElement)?.value || '';
      const equipments = equipmentStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

      for (const eq of equipments) {
        if (eq.length > 50) {
          this.errorMessage = `Her bir ekipman adı en fazla 50 karakter olabilir ("${eq}" çok uzun).`;
          this.toastService.showError(this.errorMessage);
          return;
        }
      }

      const approved = await this.confirmService.confirm(
        'Araç Kaydet',
        'Yeni araç kaydını oluşturmak istediğinize emin misiniz?'
      );
      if (!approved) return;

      this.loading = true;
      this.errorMessage = null;

      try {
        const payload = {
          ...formVal,
          equipments,
          lastMaintenanceDate: new Date(formVal.lastMaintenanceDate).toISOString()
        };
        this.vehicleService.createVehicle(payload);
        this.isSubmitted = true;
        this.toastService.showSuccess('Araç başarıyla kaydedildi.');
        this.router.navigate(['/araclar']);
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
        this.toastService.showError(this.errorMessage!);
      } finally {
        this.loading = false;
      }
    }
  }
}
