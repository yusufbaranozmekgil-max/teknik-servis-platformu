import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BranchService } from '../../../../core/services/branch.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { Branch } from '../../../../core/models/branch.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  template: `
    <div class="crud-container">
      <div class="header-section">
        <h2>Şube Yönetimi</h2>
        <button *ngIf="permissionService.hasPermission('BRANCH_CREATE')" (click)="openCreatePage()" class="primary-btn">
          + Yeni Şube Ekle
        </button>
      </div>

      <!-- Main Data Table -->
      <div class="table-container">
        <app-data-table 
          [data]="branches" 
          [columns]="columns" 
          [requiredEditPermission]="'BRANCH_UPDATE'"
          [requiredDeletePermission]="'BRANCH_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
          (rowClick)="onViewDetails($event)"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./branch-list.component.scss']
})
export class BranchListComponent implements OnInit {
  private branchService = inject(BranchService);
  private router = inject(Router);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  branches: Branch[] = [];

  columns: TableColumn[] = [
    { key: 'code', label: 'Şube Kodu', sortable: true, filterMaxLength: 20 },
    { key: 'name', label: 'Şube Adı', sortable: true, filterMaxLength: 50 },
    { key: 'city', label: 'Şehir', sortable: true, filterMaxLength: 30, filterInputMode: 'letters' },
    { key: 'district', label: 'İlçe', sortable: true, filterMaxLength: 30, filterInputMode: 'letters' },
    { key: 'contactPerson', label: 'Sorumlu', sortable: true, filterMaxLength: 50, filterInputMode: 'letters' },
    { key: 'dailyCapacity', label: 'Kapasite', sortable: true, type: 'number', filterMin: 1, filterMax: 10, filterMaxLength: 2 },
    { key: 'isActive', label: 'Aktif', sortable: true, type: 'boolean' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    try {
      // Pasifleştirilen (silinen) şubeler listede gösterilmez.
      this.branches = this.branchService.getBranches().filter(b => b.isActive !== false);
    } catch (err: any) {
      console.error('Şubeler yüklenemedi:', err.message);
    }
  }

  openCreatePage(): void {
    this.router.navigate(['/subeler/yeni']);
  }

  onEdit(row: Branch): void {
    this.router.navigate(['/subeler/duzenle', row.id]);
  }

  async onDelete(row: Branch): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Şube Silme / Pasifleştirme',
      `${row.name} şubesini silmek veya pasifleştirmek istediğinize emin misiniz?`
    );
    if (approved) {
      try {
        this.branchService.deleteBranch(row.id);
        this.toastService.showSuccess('Şube başarıyla pasifleştirildi/silindi.');
        this.loadBranches();
      } catch (err: any) {
        this.toastService.showError(err.message || 'Bir hata oluştu.');
      }
    }
  }

  onViewDetails(row: Branch): void {
    this.router.navigate(['/subeler/detay', row.id]);
  }
}
