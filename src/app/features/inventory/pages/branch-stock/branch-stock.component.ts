import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch } from '../../../../core/models/branch.model';
import { SparePart } from '../../../../core/models/spare-part.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-branch-stock',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, DataTableComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/stok" class="back-link">← Envantere Dön</a>
          <h2>Şube Stok Dağılım ve Değer Analizi</h2>
        </div>
      </div>

      <!-- Branch Selector & Stats -->
      <div class="card-content filters-card">
        <form [formGroup]="filterForm" class="filter-form">
          <div class="form-group">
            <label for="branchSelect">Analiz Edilecek Şube</label>
            <select id="branchSelect" formControlName="branchId" (change)="onBranchChange()">
              <option value="ALL">Tüm Şubeler</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>
        </form>

        <div class="stats-overview" *ngIf="selectedStats">
          <div class="stat-card">
            <span class="lbl">Toplam Çeşit</span>
            <span class="val">{{ selectedStats.totalUniqueParts }}</span>
          </div>
          <div class="stat-card">
            <span class="lbl">Fiziksel Stok Adedi</span>
            <span class="val">{{ selectedStats.totalQuantity }}</span>
          </div>
          <div class="stat-card">
            <span class="lbl">Toplam Rezerve Stok</span>
            <span class="val">{{ selectedStats.totalReserved }}</span>
          </div>
          <div class="stat-card valuation-card">
            <span class="lbl">Toplam Envanter Değeri</span>
            <span class="val">{{ selectedStats.totalValuation | currency:'TRY':'symbol-narrow' }}</span>
          </div>
        </div>
      </div>

      <!-- Parts list in selected branch -->
      <div class="table-container">
        <h3>Şube Stok Detay Listesi</h3>
        <app-data-table 
          [data]="filteredParts" 
          [columns]="columns"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./branch-stock.component.scss']
})
export class BranchStockPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private branchService = inject(BranchService);
  private fb = inject(FormBuilder);

  branches: Branch[] = [];
  parts: SparePart[] = [];
  filteredParts: any[] = [];
  selectedStats: any = null;

  private categoryLabels: Record<string, string> = {
    COMPRESSOR: 'Kompresör', BOARD_ELECTRONIC: 'Elektronik Kart', MOTOR: 'Motor',
    SENSOR: 'Sensör', SEAL_GASKET: 'Conta / Conta Seti', FILTER: 'Filtre',
    CABLE_CONNECTION: 'Kablo / Bağlantı', CONSUMABLES: 'Sarf Malzeme'
  };

  filterForm: FormGroup = this.fb.group({
    branchId: ['ALL']
  });

  columns: TableColumn[] = [
    { key: 'code', label: 'Parça Kodu', sortable: true, filterMaxLength: 15 },
    { key: 'name', label: 'Parça Adı', sortable: true, filterMaxLength: 25 },
    { key: 'category', label: 'Kategori', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'stockQuantity', label: 'Mevcut Stok', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'reservedQuantity', label: 'Rezerve', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'availableQuantity', label: 'Kullanılabilir', sortable: true, type: 'number', filterMin: 0, filterMax: 100000, filterMaxLength: 6 },
    { key: 'unitPrice', label: 'Birim Fiyat', sortable: true, type: 'currency' },
    { key: 'totalValue', label: 'Toplam Değer', sortable: true, type: 'currency' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadParts();
  }

  loadBranches(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      console.error('Şubeler yüklenemedi:', err.message);
    }
  }

  loadParts(): void {
    try {
      this.parts = this.inventoryService.getSpareParts();
      this.onBranchChange(); // Initial stats & filter
    } catch (err: any) {
      console.error('Parçalar yüklenemedi:', err.message);
    }
  }

  onBranchChange(): void {
    const branchId = this.filterForm.value.branchId;
    let rawFiltered = [...this.parts];
    if (branchId !== 'ALL') {
      rawFiltered = this.parts.filter(p => p.branchId === branchId);
    }

    this.filteredParts = rawFiltered.map(p => {
      const availableQuantity = this.inventoryService.getAvailableQuantity(p.id);
      return {
        ...p,
        category: this.categoryLabels[p.category as string] ?? p.category,
        branchName: this.getBranchName(p.branchId),
        availableQuantity,
        totalValue: p.stockQuantity * p.unitPrice
      };
    });

    this.calculateStats(this.filteredParts);
  }

  calculateStats(partsList: any[]): void {
    let totalUniqueParts = partsList.length;
    let totalQuantity = 0;
    let totalReserved = 0;
    let totalValuation = 0;

    partsList.forEach(p => {
      totalQuantity += p.stockQuantity;
      totalReserved += p.reservedQuantity;
      totalValuation += p.totalValue;
    });

    this.selectedStats = {
      totalUniqueParts,
      totalQuantity,
      totalReserved,
      totalValuation
    };
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }
}
