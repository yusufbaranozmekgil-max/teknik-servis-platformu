import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BranchService } from '../../../../core/services/branch.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { SparePart } from '../../../../core/models/spare-part.model';
import { Branch } from '../../../../core/models/branch.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PermissionVisibilityDirective } from '../../../../shared/directives/permission-visibility.directive';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-spare-part-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent, PermissionVisibilityDirective, TooltipDirective],
  template: `
    <div class="crud-container">
      <div class="header-section">
        <h2>Yedek Parça ve Stok Yönetimi</h2>

        <div class="action-buttons-group">
          <button (click)="openBranchStockPage()" class="secondary-btn" appTooltip="Parçaların şubelere göre dağılımını görüntüle">Şube Dağılımları</button>
          <button (click)="openCriticalStockPage()" class="warning-btn" appTooltip="Minimum eşiğin altına düşen parçalar">Kritik Limitler</button>
          <button (click)="openStockMovementPage()" class="info-btn" appTooltip="Giriş, çıkış, transfer, fire ve sayım hareketleri">Stok Hareketleri</button>
          <button *appPermissionVisibility="'INVENTORY_CREATE'" (click)="openCreatePage()" class="primary-btn">
            + Yeni Parça Ekle
          </button>
        </div>
      </div>

      <div class="table-container">
        <app-data-table 
          [data]="partsWithAvailability" 
          [columns]="columns" 
          [requiredEditPermission]="'INVENTORY_UPDATE'"
          [requiredDeletePermission]="'INVENTORY_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
          (rowClick)="onViewDetails($event)"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./spare-part-list.component.scss']
})
export class SparePartListComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private branchService = inject(BranchService);
  private router = inject(Router);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  parts: SparePart[] = [];
  partsWithAvailability: any[] = [];
  branches: Branch[] = [];

  columns: TableColumn[] = [
    { key: 'code', label: 'Parça Kodu', sortable: true, filterMaxLength: 15 },
    { key: 'name', label: 'Parça Adı', sortable: true, filterMaxLength: 25 },
    { key: 'category', label: 'Kategori', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'compatibleDevices', label: 'Uyumlu Cihaz', sortable: true, filterMaxLength: 25 },
    { key: 'stockQuantity', label: 'Fiziksel Stok', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'reservedQuantity', label: 'Rezerve', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'availableQuantity', label: 'Kullanılabilir', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'unitPrice', label: 'Birim Fiyat', sortable: true, type: 'currency' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadParts();
  }

  private categoryLabels: Record<string, string> = {
    COMPRESSOR: 'Kompresör', BOARD_ELECTRONIC: 'Elektronik Kart', MOTOR: 'Motor',
    SENSOR: 'Sensör', SEAL_GASKET: 'Conta / Conta Seti', FILTER: 'Filtre',
    CABLE_CONNECTION: 'Kablo / Bağlantı', CONSUMABLES: 'Sarf Malzeme'
  };

  loadParts(): void {
    try {
      // Pasifleştirilen (silinen) parçalar listede gösterilmez.
      this.parts = this.inventoryService.getSpareParts().filter(p => p.isActive !== false);
      this.partsWithAvailability = this.parts.map(p => ({
        ...p,
        category: this.categoryLabels[p.category as string] ?? p.category,
        branchName: this.getBranchName(p.branchId),
        availableQuantity: this.inventoryService.getAvailableQuantity(p.id)
      }));
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

  openCreatePage(): void {
    this.router.navigate(['/stok/yeni']);
  }

  openBranchStockPage(): void {
    this.router.navigate(['/stok/sube-stok']);
  }

  openCriticalStockPage(): void {
    this.router.navigate(['/stok/kritik']);
  }

  openStockMovementPage(): void {
    this.router.navigate(['/stok/hareket']);
  }

  onEdit(row: SparePart): void {
    this.router.navigate(['/stok/duzenle', row.id]);
  }

  async onDelete(row: SparePart): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Parça Silme / Pasifleştirme',
      `${row.name} yedek parçasını silmek veya pasifleştirmek istediğinize emin misiniz?`
    );
    if (approved) {
      try {
        this.inventoryService.deleteSparePart(row.id);
        this.toastService.showSuccess('Yedek parça başarıyla pasifleştirildi/silindi.');
        this.loadParts();
      } catch (err: any) {
        this.toastService.showError(err.message || 'Bir hata oluştu.');
      }
    }
  }

  onViewDetails(row: SparePart): void {
    this.router.navigate(['/stok/duzenle', row.id]);
  }
}
