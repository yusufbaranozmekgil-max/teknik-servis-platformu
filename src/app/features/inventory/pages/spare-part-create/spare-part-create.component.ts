import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch } from '../../../../core/models/branch.model';
import { PartCategory } from '../../../../core/models/part-category.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS, NUMERIC_LIMITS } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-spare-part-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormFieldComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/stok" class="back-link">← Envantere Dön</a>
          <h2>Yeni Yedek Parça Ekle</h2>
        </div>
      </div>

      <div class="card-content">
        <form [formGroup]="partForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <app-form-field
              label="Parça Kodu"
              [control]="$any(partForm.get('code'))"
              [maxLength]="FIELD_LIMITS.partCode"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: PRT-1234"
            ></app-form-field>

            <app-form-field
              label="Parça Adı"
              [control]="$any(partForm.get('name'))"
              [maxLength]="FIELD_LIMITS.partName"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: 12V Fan Motoru"
            ></app-form-field>

            <app-form-field
              label="Kategori"
              type="select"
              [control]="$any(partForm.get('category'))"
              [required]="true"
            >
              <option *ngFor="let cat of categoryOptions" [value]="cat">{{ getCategoryLabel(cat) }}</option>
            </app-form-field>

            <app-form-field
              label="Bulunduğu Şube"
              type="select"
              [control]="$any(partForm.get('branchId'))"
              [required]="true"
            >
              <option value="" disabled selected>Şube Seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </app-form-field>

            <app-form-field
              label="Uyumlu Cihaz / Marka"
              [control]="$any(partForm.get('compatibleDevices'))"
              [maxLength]="FIELD_LIMITS.compatibleDevice"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Bosch / Siemens Bulaşık Makinesi"
            ></app-form-field>

            <app-form-field
              label="Ölçü Birimi"
              type="select"
              [control]="$any(partForm.get('unit'))"
              [required]="true"
            >
              <option value="PCS">Adet (PCS)</option>
              <option value="METERS">Metre (Meters)</option>
              <option value="KG">Kilogram (KG)</option>
              <option value="LITERS">Litre (Liters)</option>
            </app-form-field>

            <app-form-field
              label="Fiziksel Stok Miktarı"
              type="number"
              [control]="$any(partForm.get('stockQuantity'))"
              [min]="NUMERIC_LIMITS.stockQuantity.min"
              [max]="NUMERIC_LIMITS.stockQuantity.max"
              [maxLength]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Minimum Kritik Stok Eşiği"
              type="number"
              [control]="$any(partForm.get('minStockThreshold'))"
              [min]="NUMERIC_LIMITS.minimumStockLevel.min"
              [max]="NUMERIC_LIMITS.minimumStockLevel.max"
              [maxLength]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Birim Maliyet (TL)"
              type="number"
              [control]="$any(partForm.get('unitPrice'))"
              [min]="NUMERIC_LIMITS.unitCost.min"
              [max]="NUMERIC_LIMITS.unitCost.max"
              [maxLength]="9"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>
          </div>

          <div class="form-group check-group">
            <label class="switch-label">
              <input type="checkbox" formControlName="isActive" />
              <span class="switch-text">Aktif Kullanımda</span>
            </label>
          </div>

          <div *ngIf="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button type="button" routerLink="/stok" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="partForm.invalid || loading" class="save-btn">
              {{ loading ? 'Kaydediliyor...' : 'Parçayı Kaydet' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./spare-part-create.component.scss']
})
export class SparePartCreatePage implements OnInit, ComponentCanDeactivate {
  private inventoryService = inject(InventoryService);
  private branchService = inject(BranchService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  branches: Branch[] = [];
  errorMessage: string | null = null;
  loading = false;
  isSubmitted = false;

  FIELD_LIMITS = FIELD_LIMITS;
  NUMERIC_LIMITS = NUMERIC_LIMITS;

  categoryOptions: PartCategory[] = [
    'COMPRESSOR',
    'BOARD_ELECTRONIC',
    'MOTOR',
    'SENSOR',
    'SEAL_GASKET',
    'FILTER',
    'CABLE_CONNECTION',
    'CONSUMABLES'
  ];

  partForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.partCode), CustomValidators.noWhitespace()]],
    name: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.partName), CustomValidators.noWhitespace()]],
    category: ['CONSUMABLES', [Validators.required]],
    branchId: ['', [Validators.required]],
    compatibleDevices: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.compatibleDevice), CustomValidators.noWhitespace()]],
    unit: ['PCS', [Validators.required]],
    stockQuantity: [10, [Validators.required, Validators.min(NUMERIC_LIMITS.stockQuantity.min), Validators.max(NUMERIC_LIMITS.stockQuantity.max)]],
    minStockThreshold: [5, [Validators.required, Validators.min(NUMERIC_LIMITS.minimumStockLevel.min), Validators.max(NUMERIC_LIMITS.minimumStockLevel.max)]],
    unitPrice: [100, [Validators.required, Validators.min(NUMERIC_LIMITS.unitCost.min), Validators.max(NUMERIC_LIMITS.unitCost.max)]],
    isActive: [true]
  });

  ngOnInit(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      this.errorMessage = 'Şubeler yüklenemedi: ' + err.message;
    }
  }

  getCategoryLabel(category: PartCategory): string {
    const labels: Record<PartCategory, string> = {
      COMPRESSOR: 'Kompresör',
      BOARD_ELECTRONIC: 'Elektronik Kart',
      MOTOR: 'Motor',
      SENSOR: 'Sensör',
      SEAL_GASKET: 'Conta / Conta Seti',
      FILTER: 'Filtre',
      CABLE_CONNECTION: 'Kablo / Bağlantı',
      CONSUMABLES: 'Sarf Malzeme'
    };
    return labels[category];
  }

  canDeactivate(): boolean {
    if (this.partForm.dirty && !this.isSubmitted) {
      return confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (this.partForm.valid) {
      const approved = await this.confirmService.confirm(
        'Yedek Parça Kaydet',
        'Yeni yedek parça kaydını oluşturmak istediğinize emin misiniz?'
      );
      if (!approved) return;

      this.loading = true;
      this.errorMessage = null;

      try {
        this.inventoryService.createSparePart(this.partForm.value);
        this.isSubmitted = true;
        this.toastService.showSuccess('Yedek parça başarıyla kaydedildi.');
        this.router.navigate(['/stok']);
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
        this.toastService.showError(this.errorMessage!);
      } finally {
        this.loading = false;
      }
    }
  }
}
