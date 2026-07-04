import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BranchService } from '../../../../core/services/branch.service';
import { SparePart } from '../../../../core/models/spare-part.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-critical-stock',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/stok" class="back-link">← Envantere Dön</a>
          <h2>Kritik Stok Limit Uyarıları</h2>
          <p class="subtitle">Kullanılabilir miktarı, kritik eşik seviyesinin altına düşen parçalar listelenmektedir.</p>
        </div>
      </div>

      <div class="alert-banner" *ngIf="criticalParts.length > 0">
        Toplam <strong>{{ criticalParts.length }}</strong> kalem yedek parçada kritik stok eşiği aşılmıştır! Tedarik sürecinin başlatılması önerilir.
      </div>

      <div class="table-container">
        <app-data-table 
          [data]="criticalParts" 
          [columns]="columns"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./critical-stock.component.scss']
})
export class CriticalStockPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private branchService = inject(BranchService);

  criticalParts: any[] = [];
  branches: any[] = [];

  columns: TableColumn[] = [
    { key: 'code', label: 'Parça Kodu', sortable: true, filterMaxLength: 15 },
    { key: 'name', label: 'Parça Adı', sortable: true, filterMaxLength: 25 },
    { key: 'category', label: 'Kategori', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'compatibleDevices', label: 'Uyumlu Cihaz', sortable: true, filterMaxLength: 25 },
    { key: 'stockQuantity', label: 'Mevcut Stok', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'reservedQuantity', label: 'Rezerve', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'availableQuantity', label: 'Kullanılabilir', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'minStockThreshold', label: 'Kritik Eşik', sortable: true, type: 'number', filterMin: 0, filterMax: 1000, filterMaxLength: 4 }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadCriticalParts();
  }

  loadBranches(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      console.error('Şubeler yüklenemedi:', err.message);
    }
  }

  private categoryLabels: Record<string, string> = {
    COMPRESSOR: 'Kompresör', BOARD_ELECTRONIC: 'Elektronik Kart', MOTOR: 'Motor',
    SENSOR: 'Sensör', SEAL_GASKET: 'Conta / Conta Seti', FILTER: 'Filtre',
    CABLE_CONNECTION: 'Kablo / Bağlantı', CONSUMABLES: 'Sarf Malzeme'
  };

  loadCriticalParts(): void {
    try {
      const allParts = this.inventoryService.getSpareParts();
      this.criticalParts = allParts
        .map(p => {
          const availableQuantity = this.inventoryService.getAvailableQuantity(p.id);
          return {
            ...p,
            category: this.categoryLabels[p.category as string] ?? p.category,
            branchName: this.getBranchName(p.branchId),
            availableQuantity
          };
        })
        .filter(p => p.availableQuantity <= p.minStockThreshold);
    } catch (err: any) {
      console.error('Kritik stok listesi yüklenemedi:', err.message);
    }
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }
}
