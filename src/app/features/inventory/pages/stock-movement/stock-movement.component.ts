import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StockMovementService } from '../../../../core/services/stock-movement.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BranchService } from '../../../../core/services/branch.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { StockMovement } from '../../../../core/models/stock-movement.model';
import { SparePart } from '../../../../core/models/spare-part.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS, NUMERIC_LIMITS } from '../../../../core/constants/form-limits.const';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { STOCK_MOVEMENT_TYPE_LABELS } from '../../../../core/constants/labels.const';

type MovementMode = 'STANDARD' | 'TRANSFER' | 'FIRE' | 'ADJUSTMENT';

@Component({
  selector: 'app-stock-movement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, DataTableComponent, FormFieldComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/stok" class="back-link">← Envantere Dön</a>
          <h2>Stok Hareketleri Giriş/Çıkış Takibi</h2>
        </div>
      </div>

      <!-- Mod seçici (hareket tipi) -->
      <div class="mode-bar" *ngIf="permissionService.hasPermission('STOCK_MOVEMENT_CREATE')">
        <button
          *ngFor="let m of modes"
          class="mode-chip"
          [class.active]="activeMode === m.key"
          (click)="selectMode(m.key)"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- Standart Giriş / Çıkış Formu -->
      <div class="card-content form-card animate-slide" *ngIf="showForm && activeMode === 'STANDARD'">
        <h3>Standart Stok Hareketi (Giriş / Çıkış)</h3>
        <form [formGroup]="movementForm" (ngSubmit)="onSubmitStandard()">
          <div class="form-grid">
            <app-form-field
              label="Yedek Parça"
              type="select"
              [control]="$any(movementForm.get('partId'))"
              [required]="true"
            >
              <option value="" disabled selected>Parça Seçin</option>
              <option *ngFor="let p of parts" [value]="p.id">{{ p.name }} ({{ p.code }}) - Şube: {{ getBranchName(p.branchId) }}</option>
            </app-form-field>

            <app-form-field
              label="Hareket Yönü"
              type="select"
              [control]="$any(movementForm.get('type'))"
              [required]="true"
            >
              <option value="IN">Giriş - Stok Ekle</option>
              <option value="OUT">Çıkış - Stok Düş</option>
            </app-form-field>

            <app-form-field
              label="Miktar"
              type="number"
              [control]="$any(movementForm.get('quantity'))"
              [min]="NUMERIC_LIMITS.movementQuantity.min"
              [max]="NUMERIC_LIMITS.movementQuantity.max"
              [maxLength]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Açıklama / Fatura / Gerekçe"
              [control]="$any(movementForm.get('description'))"
              [maxLength]="FIELD_LIMITS.stockMovementNote"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: X tedarikçisinden alım"
            ></app-form-field>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <div class="form-actions">
            <button type="button" (click)="closeForm()" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="movementForm.invalid" class="save-btn">Hareketi İşle</button>
          </div>
        </form>
      </div>

      <!-- Transfer Formu -->
      <div class="card-content form-card animate-slide" *ngIf="showForm && activeMode === 'TRANSFER'">
        <h3>Şubeler Arası Transfer</h3>
        <p class="form-hint">Bir parçayı kaynak şubeden hedef şubeye taşır. Hedef şubede aynı kodlu aktif parça bulunmalıdır.</p>
        <form [formGroup]="transferForm" (ngSubmit)="onSubmitTransfer()">
          <div class="form-grid">
            <app-form-field
              label="Kaynak Parça"
              type="select"
              [control]="$any(transferForm.get('sourcePartId'))"
              [required]="true"
            >
              <option value="" disabled selected>Parça Seçin</option>
              <option *ngFor="let p of parts" [value]="p.id">{{ p.name }} ({{ p.code }}) - {{ getBranchName(p.branchId) }} (Stok: {{ p.stockQuantity }})</option>
            </app-form-field>

            <app-form-field
              label="Hedef Şube"
              type="select"
              [control]="$any(transferForm.get('targetBranchId'))"
              [required]="true"
            >
              <option value="" disabled selected>Şube Seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }} ({{ b.city }})</option>
            </app-form-field>

            <app-form-field
              label="Transfer Miktarı"
              type="number"
              [control]="$any(transferForm.get('quantity'))"
              [min]="NUMERIC_LIMITS.movementQuantity.min"
              [max]="NUMERIC_LIMITS.movementQuantity.max"
              [maxLength]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Gerekçe / Açıklama"
              [control]="$any(transferForm.get('description'))"
              [maxLength]="FIELD_LIMITS.stockMovementNote"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Kadıköy şubesi stoğu için takviye"
            ></app-form-field>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <div class="form-actions">
            <button type="button" (click)="closeForm()" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="transferForm.invalid" class="save-btn">Transferi Onayla</button>
          </div>
        </form>
      </div>

      <!-- Fire Formu -->
      <div class="card-content form-card animate-slide" *ngIf="showForm && activeMode === 'FIRE'">
        <h3>Fire / Hasar Kaydı</h3>
        <p class="form-hint">Hasarlı, kullanılamaz veya kayıp olarak işaretlenecek parça miktarı stoktan düşülür.</p>
        <form [formGroup]="fireForm" (ngSubmit)="onSubmitFire()">
          <div class="form-grid">
            <app-form-field
              label="Yedek Parça"
              type="select"
              [control]="$any(fireForm.get('partId'))"
              [required]="true"
            >
              <option value="" disabled selected>Parça Seçin</option>
              <option *ngFor="let p of parts" [value]="p.id">{{ p.name }} ({{ p.code }}) - Şube: {{ getBranchName(p.branchId) }} (Stok: {{ p.stockQuantity }})</option>
            </app-form-field>

            <app-form-field
              label="Fire Miktarı"
              type="number"
              [control]="$any(fireForm.get('quantity'))"
              [min]="NUMERIC_LIMITS.movementQuantity.min"
              [max]="NUMERIC_LIMITS.movementQuantity.max"
              [maxLength]="6"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Hasar / Fire Nedeni"
              [control]="$any(fireForm.get('description'))"
              [maxLength]="FIELD_LIMITS.stockMovementNote"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Nakliye sırasında hasar gördü"
            ></app-form-field>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <div class="form-actions">
            <button type="button" (click)="closeForm()" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="fireForm.invalid" class="save-btn warning">Fire Kaydını Onayla</button>
          </div>
        </form>
      </div>

      <!-- Sayım Düzeltmesi Formu -->
      <div class="card-content form-card animate-slide" *ngIf="showForm && activeMode === 'ADJUSTMENT'">
        <h3>Sayım Düzeltmesi</h3>
        <p class="form-hint">Fiziksel sayımla sistem stoğu arasındaki fark için stok değeri yeni mutlak değere ayarlanır.</p>
        <form [formGroup]="adjustForm" (ngSubmit)="onSubmitAdjust()">
          <div class="form-grid">
            <app-form-field
              label="Yedek Parça"
              type="select"
              [control]="$any(adjustForm.get('partId'))"
              [required]="true"
            >
              <option value="" disabled selected>Parça Seçin</option>
              <option *ngFor="let p of parts" [value]="p.id">{{ p.name }} ({{ p.code }}) - {{ getBranchName(p.branchId) }} (Mevcut: {{ p.stockQuantity }}, Rezerve: {{ p.reservedQuantity }})</option>
            </app-form-field>

            <app-form-field
              label="Yeni Sayım Değeri"
              type="number"
              [control]="$any(adjustForm.get('newQuantity'))"
              [min]="0"
              [max]="1000000"
              [maxLength]="7"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Sayım Gerekçesi"
              [control]="$any(adjustForm.get('description'))"
              [maxLength]="FIELD_LIMITS.stockMovementNote"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Yıl sonu sayımı, raf kontrol farkı"
            ></app-form-field>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <div class="form-actions">
            <button type="button" (click)="closeForm()" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="adjustForm.invalid" class="save-btn">Sayımı Kaydet</button>
          </div>
        </form>
      </div>

      <!-- Movement History List -->
      <div class="table-container">
        <h3>Stok Hareket Geçmişi</h3>
        <app-data-table
          [data]="movementsWithPartInfo"
          [columns]="columns"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./stock-movement.component.scss']
})
export class StockMovementPage implements OnInit {
  private movementService = inject(StockMovementService);
  private inventoryService = inject(InventoryService);
  private branchService = inject(BranchService);
  permissionService = inject(PermissionService);
  private fb = inject(FormBuilder);

  movements: StockMovement[] = [];
  movementsWithPartInfo: any[] = [];
  parts: SparePart[] = [];
  branches: any[] = [];
  showForm = false;
  activeMode: MovementMode = 'STANDARD';
  errorMessage: string | null = null;

  FIELD_LIMITS = FIELD_LIMITS;
  NUMERIC_LIMITS = NUMERIC_LIMITS;

  readonly modes: { key: MovementMode; label: string }[] = [
    { key: 'STANDARD', label: '+ Giriş / Çıkış' },
    { key: 'TRANSFER', label: '↔ Şubeler Arası Transfer' },
    { key: 'FIRE', label: '⚠ Fire / Hasar' },
    { key: 'ADJUSTMENT', label: '✎ Sayım Düzeltmesi' }
  ];

  movementForm: FormGroup = this.fb.group({
    partId: ['', [Validators.required]],
    type: ['IN', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(NUMERIC_LIMITS.movementQuantity.min), Validators.max(NUMERIC_LIMITS.movementQuantity.max)]],
    description: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.stockMovementNote), CustomValidators.noWhitespace()]]
  });

  transferForm: FormGroup = this.fb.group({
    sourcePartId: ['', [Validators.required]],
    targetBranchId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(NUMERIC_LIMITS.movementQuantity.min), Validators.max(NUMERIC_LIMITS.movementQuantity.max)]],
    description: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.stockMovementNote), CustomValidators.noWhitespace()]]
  });

  fireForm: FormGroup = this.fb.group({
    partId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(NUMERIC_LIMITS.movementQuantity.min), Validators.max(NUMERIC_LIMITS.movementQuantity.max)]],
    description: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.stockMovementNote), CustomValidators.noWhitespace()]]
  });

  adjustForm: FormGroup = this.fb.group({
    partId: ['', [Validators.required]],
    newQuantity: [0, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    description: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.stockMovementNote), CustomValidators.noWhitespace()]]
  });

  columns: TableColumn[] = [
    { key: 'partCode', label: 'Parça Kodu', sortable: true, filterMaxLength: 15 },
    { key: 'partName', label: 'Parça Adı', sortable: true, filterMaxLength: 25 },
    { key: 'typeLabel', label: 'Hareket Tipi', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'quantity', label: 'Miktar', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'description', label: 'Açıklama', sortable: true, filterMaxLength: 25 },
    { key: 'createdAt', label: 'Tarih', sortable: true, type: 'date' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadParts();
    this.loadMovements();
  }

  loadMovements(): void {
    try {
      this.movements = this.movementService.getStockMovements();
      this.movementsWithPartInfo = this.movements.map(m => {
        const part = this.parts.find(p => p.id === m.partId);
        return {
          ...m,
          partCode: part ? part.code : 'Bilinmeyen',
          partName: part ? part.name : 'Bilinmeyen',
          typeLabel: STOCK_MOVEMENT_TYPE_LABELS[m.type] || m.type,
          branchName: part ? this.getBranchName(part.branchId) : 'Bilinmeyen'
        };
      });
    } catch (err: any) {
      console.error('Stok hareketleri yüklenemedi:', err.message);
    }
  }

  loadParts(): void {
    try {
      this.parts = this.inventoryService.getSpareParts();
    } catch (err: any) {
      console.error('Parçalar yüklenemedi:', err.message);
    }
  }

  loadBranches(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      console.error('Şubeler yüklenemedi:', err.message);
    }
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }

  selectMode(mode: MovementMode): void {
    this.errorMessage = null;
    if (this.activeMode === mode && this.showForm) {
      this.closeForm();
      return;
    }
    this.activeMode = mode;
    this.showForm = true;
    this.resetActiveForm();
  }

  closeForm(): void {
    this.showForm = false;
    this.errorMessage = null;
  }

  private resetActiveForm(): void {
    if (this.activeMode === 'STANDARD') {
      this.movementForm.reset({ partId: '', type: 'IN', quantity: 1, description: '' });
    } else if (this.activeMode === 'TRANSFER') {
      this.transferForm.reset({ sourcePartId: '', targetBranchId: '', quantity: 1, description: '' });
    } else if (this.activeMode === 'FIRE') {
      this.fireForm.reset({ partId: '', quantity: 1, description: '' });
    } else if (this.activeMode === 'ADJUSTMENT') {
      this.adjustForm.reset({ partId: '', newQuantity: 0, description: '' });
    }
  }

  onSubmitStandard(): void {
    if (!this.movementForm.valid) return;
    try {
      const formVal = this.movementForm.value;
      this.movementService.createStockMovement({
        ...formVal,
        workOrderId: null
      });
      this.afterSuccess();
    } catch (err: any) {
      this.errorMessage = err.message || 'Hata oluştu.';
    }
  }

  onSubmitTransfer(): void {
    if (!this.transferForm.valid) return;
    try {
      this.movementService.transferBetweenBranches(this.transferForm.value);
      this.afterSuccess();
    } catch (err: any) {
      this.errorMessage = err.message || 'Transfer başarısız.';
    }
  }

  onSubmitFire(): void {
    if (!this.fireForm.valid) return;
    try {
      this.movementService.recordWaste(this.fireForm.value);
      this.afterSuccess();
    } catch (err: any) {
      this.errorMessage = err.message || 'Fire kaydı başarısız.';
    }
  }

  onSubmitAdjust(): void {
    if (!this.adjustForm.valid) return;
    try {
      this.movementService.adjustStock(this.adjustForm.value);
      this.afterSuccess();
    } catch (err: any) {
      this.errorMessage = err.message || 'Sayım düzeltmesi başarısız.';
    }
  }

  private afterSuccess(): void {
    this.loadParts();
    this.loadMovements();
    this.closeForm();
  }
}
