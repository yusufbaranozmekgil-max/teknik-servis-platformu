import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BranchService } from '../../../../core/services/branch.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS, NUMERIC_LIMITS } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-branch-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormFieldComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/subeler" class="back-link">← Şubelere Dön</a>
          <h2>Yeni Şube Ekle</h2>
        </div>
      </div>

      <div class="card-content">
        <form [formGroup]="branchForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <app-form-field
              label="Şube Kodu"
              [control]="$any(branchForm.get('code'))"
              [maxLength]="FIELD_LIMITS.branchCode"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: SUBE-ANK-03"
            ></app-form-field>

            <app-form-field
              label="Şube Adı"
              [control]="$any(branchForm.get('name'))"
              [maxLength]="FIELD_LIMITS.branchName"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Ankara Çankaya Şubesi"
            ></app-form-field>

            <app-form-field
              label="Şehir"
              [control]="$any(branchForm.get('city'))"
              [maxLength]="FIELD_LIMITS.city"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Ankara"
            ></app-form-field>

            <app-form-field
              label="İlçe"
              [control]="$any(branchForm.get('district'))"
              [maxLength]="FIELD_LIMITS.district"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Çankaya"
            ></app-form-field>

            <app-form-field
              label="Sorumlu Kişi"
              [control]="$any(branchForm.get('contactPerson'))"
              [maxLength]="FIELD_LIMITS.responsiblePerson"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Ahmet Yılmaz"
            ></app-form-field>

            <app-form-field
              label="Günlük Teknisyen Kapasitesi"
              type="number"
              [control]="$any(branchForm.get('dailyCapacity'))"
              [min]="NUMERIC_LIMITS.dailyCapacity.min"
              [max]="NUMERIC_LIMITS.dailyCapacity.max"
              [maxLength]="10"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Enlem"
              type="number"
              step="0.000001"
              [control]="$any(branchForm.get('latitude'))"
              [min]="NUMERIC_LIMITS.latitude.min"
              [max]="NUMERIC_LIMITS.latitude.max"
              [maxLength]="10"
              [maxDecimals]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Boylam"
              type="number"
              step="0.000001"
              [control]="$any(branchForm.get('longitude'))"
              [min]="NUMERIC_LIMITS.longitude.min"
              [max]="NUMERIC_LIMITS.longitude.max"
              [maxLength]="10"
              [maxDecimals]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Mesai Başlangıcı"
              type="time"
              [control]="$any(branchForm.get('workingHoursStart'))"
              placeholder="08:00"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Mesai Bitişi"
              type="time"
              [control]="$any(branchForm.get('workingHoursEnd'))"
              placeholder="18:00"
              [required]="true"
            ></app-form-field>
          </div>
          <div class="error-alert" *ngIf="branchForm.errors?.['workingHoursRange'] && (branchForm.get('workingHoursStart')?.touched || branchForm.get('workingHoursEnd')?.touched)">
            Mesai bitişi başlangıç saatinden sonra olmalıdır.
          </div>

          <div class="form-group full-width">
            <label>Hizmet Verdiği Bölgeler / Mahalleler</label>
            <div class="tag-input-container">
              <input 
                #areaInput 
                type="text" 
                placeholder="Semt/Mahalle yazıp ekleyin" 
                [attr.maxlength]="FIELD_LIMITS.serviceArea"
                (keydown.enter)="addArea($event, areaInput)" 
              />
              <button type="button" (click)="addAreaBtn(areaInput)" class="tag-add-btn">Ekle</button>
            </div>
            <div class="area-error" *ngIf="areaError">{{ areaError }}</div>
            <div class="area-count">{{ serviceAreas.length }} / 20 bölge</div>

            <div class="chips-container">
              <span class="tag-chip" *ngFor="let area of serviceAreas; let i = index">
                {{ area }}
                <button type="button" (click)="removeArea(i)" class="tag-remove-btn">&times;</button>
              </span>
              <span class="no-tags" *ngIf="serviceAreas.length === 0">Eklenmiş bölge yok.</span>
            </div>
          </div>

          <div class="form-group full-width check-group">
            <label class="switch-label">
              <input type="checkbox" formControlName="isActive" />
              <span class="switch-text">Şube Aktif</span>
            </label>
          </div>

          <div class="form-actions">
            <button type="button" routerLink="/subeler" class="cancel-btn" [disabled]="loading">İptal</button>
            <button type="submit" class="save-btn" [disabled]="branchForm.invalid || loading">
              {{ loading ? 'Kaydediliyor...' : 'Kaydet' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./branch-create.component.scss']
})
export class BranchCreatePage {
  private branchService = inject(BranchService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  FIELD_LIMITS = FIELD_LIMITS;
  NUMERIC_LIMITS = NUMERIC_LIMITS;

  serviceAreas: string[] = [];
  errorMessage: string | null = null;
  loading = false;
  isSubmitted = false;

  static readonly MAX_SERVICE_AREAS = 20;
  areaError: string | null = null;

  branchForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.branchCode), CustomValidators.noWhitespace()]],
    name: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.branchName), CustomValidators.noWhitespace()]],
    city: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.city), CustomValidators.noWhitespace()]],
    district: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.district), CustomValidators.noWhitespace()]],
    contactPerson: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.responsiblePerson), CustomValidators.noWhitespace()]],
    latitude: [40, [Validators.required, CustomValidators.numberRange(NUMERIC_LIMITS.latitude.min, NUMERIC_LIMITS.latitude.max)]],
    longitude: [30, [Validators.required, CustomValidators.numberRange(NUMERIC_LIMITS.longitude.min, NUMERIC_LIMITS.longitude.max)]],
    workingHoursStart: ['08:00', [Validators.required, CustomValidators.timeFormat()]],
    workingHoursEnd: ['18:00', [Validators.required, CustomValidators.timeFormat()]],
    dailyCapacity: [5, [Validators.required, CustomValidators.numberRange(NUMERIC_LIMITS.dailyCapacity.min, NUMERIC_LIMITS.dailyCapacity.max)]],
    isActive: [true]
  }, { validators: CustomValidators.workingHoursRange('workingHoursStart', 'workingHoursEnd') });

  private tryAddArea(rawValue: string, input: HTMLInputElement): void {
    this.areaError = null;
    const value = (rawValue || '').trim();
    if (!value) { this.areaError = 'Boş bölge eklenemez.'; return; }
    if (value.length > FIELD_LIMITS.serviceArea) {
      this.areaError = `Bölge adı en fazla ${FIELD_LIMITS.serviceArea} karakter olabilir.`;
      return;
    }
    if (this.serviceAreas.some(a => a.toLowerCase() === value.toLowerCase())) {
      this.areaError = 'Bu bölge zaten eklenmiş.';
      return;
    }
    if (this.serviceAreas.length >= BranchCreatePage.MAX_SERVICE_AREAS) {
      this.areaError = `En fazla ${BranchCreatePage.MAX_SERVICE_AREAS} hizmet bölgesi ekleyebilirsiniz.`;
      return;
    }
    this.serviceAreas.push(value);
    input.value = '';
  }

  addArea(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    this.tryAddArea(input.value, input);
  }

  addAreaBtn(input: HTMLInputElement): void {
    this.tryAddArea(input.value, input);
  }

  removeArea(index: number): void {
    this.serviceAreas.splice(index, 1);
  }

  canDeactivate(): boolean {
    if (this.branchForm.dirty && !this.isSubmitted) {
      return confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (this.branchForm.valid) {
      const approved = await this.confirmService.confirm(
        'Şube Kaydet',
        'Yeni şube kaydını oluşturmak istediğinize emin misiniz?'
      );
      if (!approved) return;

      this.loading = true;
      this.errorMessage = null;

      try {
        const payload = {
          ...this.branchForm.value,
          serviceAreas: this.serviceAreas
        };
        this.branchService.createBranch(payload);
        this.isSubmitted = true;
        this.toastService.showSuccess('Kayıt başarıyla oluşturuldu.');
        this.router.navigate(['/subeler']);
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
        this.toastService.showError(this.errorMessage!);
      } finally {
        this.loading = false;
      }
    }
  }
}
