import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ServiceRequestService } from '../../../../core/services/service-request.service';
import { BranchService } from '../../../../core/services/branch.service';
import { SlaService } from '../../../../core/services/sla.service';
import { Branch } from '../../../../core/models/branch.model';
import { ServicePriority } from '../../../../core/models/service-request.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-request-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormFieldComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/servis-talepleri" class="back-link">← Taleplere Dön</a>
          <h2>Yeni Servis Talebi Ekle</h2>
        </div>
      </div>

      <div class="card-content">
        <form [formGroup]="requestForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <app-form-field
              label="Müşteri Adı Soyadı"
              [control]="$any(requestForm.get('customerName'))"
              [maxLength]="FIELD_LIMITS.customerName"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Ayşe Yılmaz"
            ></app-form-field>

            <app-form-field
              label="Müşteri Telefon"
              [control]="$any(requestForm.get('customerPhone'))"
              [maxLength]="FIELD_LIMITS.customerPhone"
              [required]="true"
              [showCounter]="true"
              inputFilter="digits"
              placeholder="Örn: 05321234567"
            ></app-form-field>

            <app-form-field
              label="Müşteri Adresi"
              [control]="$any(requestForm.get('customerAddress'))"
              [maxLength]="200"
              [required]="true"
              [showCounter]="true"
              placeholder="Mahalle, sokak, kapı no, daire, ilçe / il"
            ></app-form-field>

            <app-form-field
              label="Müşteri Bölgesi"
              [control]="$any(requestForm.get('customerRegion'))"
              [maxLength]="60"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Anadolu Yakası, Çankaya"
            ></app-form-field>

            <app-form-field
              label="Hizmet Alacak Şube"
              type="select"
              [control]="$any(requestForm.get('branchId'))"
              [required]="true"
            >
              <option value="" disabled>Şube Seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </app-form-field>

            <app-form-field
              label="Cihaz Marka / Model"
              [control]="$any(requestForm.get('deviceBrandModel'))"
              [maxLength]="FIELD_LIMITS.customerName"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Arçelik No-Frost Kombi"
            ></app-form-field>

            <app-form-field
              label="Hizmet Kategorisi"
              [control]="$any(requestForm.get('serviceCategory'))"
              [maxLength]="FIELD_LIMITS.serviceCategory"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Isıtma Grubu veya Beyaz Eşya"
            ></app-form-field>

            <app-form-field
              label="Gerekli Teknisyen Yetkinliği"
              type="select"
              [control]="$any(requestForm.get('requiredSkill'))"
              [required]="true"
            >
              <option value="WHITE_GOODS">Beyaz Eşya</option>
              <option value="HVAC">Klima / Soğutma</option>
              <option value="ELECTRIC">Elektrik Tesisatı</option>
              <option value="ELECTRONICS_MOTHERBOARD">Elektronik / Anakart</option>
              <option value="PLUMBING">Sıhhi Tesisat</option>
              <option value="BOILER_HEATING">Kombi / Isıtma</option>
            </app-form-field>

            <app-form-field
              label="Öncelik Seviyesi"
              type="select"
              [control]="$any(requestForm.get('priority'))"
              [required]="true"
              (change)="updateSlaPreview()"
            >
              <option value="STANDARD">Standart (48 Saat SLA)</option>
              <option value="URGENT">Acil (12 Saat SLA)</option>
              <option value="CRITICAL">Kritik (4 Saat SLA)</option>
            </app-form-field>

            <div class="form-group sla-preview-group">
              <label>SLA Hedef Bitiş Süresi</label>
              <div class="sla-preview-box">
                {{ slaPreviewText | date:'dd.MM.yyyy HH:mm' }}
              </div>
            </div>
          </div>

          <div class="form-group full-width" style="margin-top: 1rem;">
            <app-form-field
              label="Arıza / Hizmet Başlığı"
              [control]="$any(requestForm.get('title'))"
              [maxLength]="100"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Cihaz elektrik almıyor veya su akıtıyor"
            ></app-form-field>
          </div>

          <div class="form-group full-width" style="margin-top: 1rem;">
            <app-form-field
              label="Arıza Açıklaması / Detaylar"
              type="textarea"
              [control]="$any(requestForm.get('description'))"
              [maxLength]="FIELD_LIMITS.faultDescription"
              [required]="true"
              [showCounter]="true"
              placeholder="Lütfen arızayı detaylı tarif edin..."
            ></app-form-field>
          </div>

          <div class="form-row check-row" style="margin-top: 1.25rem;">
            <div class="form-group check-group">
              <label class="switch-label">
                <input type="checkbox" formControlName="hasWarranty" />
                <span class="switch-text">Garanti Kapsamında</span>
              </label>
            </div>

            <div class="form-group check-group">
              <label class="switch-label">
                <input type="checkbox" formControlName="hasCustomerApproval" />
                <span class="switch-text">Müşteri Ön Onayı Alındı</span>
              </label>
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-alert" style="margin-top: 1rem;">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button type="button" routerLink="/servis-talepleri" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="requestForm.invalid || loading" class="save-btn">
              {{ loading ? 'Kaydediliyor...' : 'Talebi Oluştur' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./request-create.component.scss']
})
export class RequestCreatePage implements OnInit, ComponentCanDeactivate {
  private requestService = inject(ServiceRequestService);
  private branchService = inject(BranchService);
  private slaService = inject(SlaService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  branches: Branch[] = [];
  slaPreviewText = '';
  errorMessage: string | null = null;
  loading = false;
  isSubmitted = false;

  FIELD_LIMITS = FIELD_LIMITS;

  requestForm: FormGroup = this.fb.group({
    customerId: ['cust-' + Date.now()],
    customerName: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.customerName), CustomValidators.noWhitespace()]],
    customerPhone: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.customerPhone), CustomValidators.phone(), CustomValidators.noWhitespace()]],
    customerAddress: ['', [Validators.required, Validators.maxLength(200), CustomValidators.noWhitespace()]],
    customerRegion: ['', [Validators.required, Validators.maxLength(60), CustomValidators.noWhitespace()]],
    branchId: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(100), CustomValidators.noWhitespace()]],
    description: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.faultDescription), CustomValidators.noWhitespace()]],
    deviceBrandModel: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.customerName), CustomValidators.noWhitespace()]],
    serviceCategory: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.serviceCategory), CustomValidators.noWhitespace()]],
    requiredSkill: ['WHITE_GOODS', [Validators.required]],
    priority: ['STANDARD', [Validators.required]],
    status: ['NEW', [Validators.required]],
    hasWarranty: [true],
    hasCustomerApproval: [false]
  });

  ngOnInit(): void {
    try {
      this.branches = this.branchService.getBranches();
      this.updateSlaPreview();
    } catch (err: any) {
      this.errorMessage = 'Şubeler yüklenemedi: ' + err.message;
    }
  }

  updateSlaPreview(): void {
    const priority = this.requestForm.value.priority as ServicePriority;
    this.slaPreviewText = this.slaService.calculateSlaDeadline(priority);
  }

  canDeactivate(): boolean {
    if (this.requestForm.dirty && !this.isSubmitted) {
      return confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (this.requestForm.valid) {
      const approved = await this.confirmService.confirm(
        'Talep Oluştur',
        'Yeni servis talebi kaydını oluşturmak istediğinize emin misiniz?'
      );
      if (!approved) return;

      this.loading = true;
      this.errorMessage = null;

      try {
        this.requestService.createServiceRequest(this.requestForm.value);
        this.isSubmitted = true;
        this.toastService.showSuccess('Servis talebi başarıyla oluşturuldu.');
        this.router.navigate(['/servis-talepleri']);
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
        this.toastService.showError(this.errorMessage!);
      } finally {
        this.loading = false;
      }
    }
  }
}
