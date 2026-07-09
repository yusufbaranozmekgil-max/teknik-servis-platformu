import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TechnicianService } from '../../../../core/services/technician.service';
import { BranchService } from '../../../../core/services/branch.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { Technician } from '../../../../core/models/technician.model';
import { Branch } from '../../../../core/models/branch.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TECHNICIAN_LEVEL_LABELS } from '../../../../core/constants/labels.const';

@Component({
  selector: 'app-technician-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  template: `
    <div class="crud-container">
      <div class="header-section">
        <h2>Teknisyen Yönetimi</h2>
        <button *ngIf="permissionService.hasPermission('TECHNICIAN_CREATE')" (click)="openCreatePage()" class="primary-btn">
          + Yeni Teknisyen Ekle
        </button>
      </div>

      <div class="table-container">
        <app-data-table 
          [data]="techniciansWithBranch" 
          [columns]="columns"
          [showScheduleBtn]="true"
          [showPerformanceBtn]="true"
          [requiredEditPermission]="'TECHNICIAN_UPDATE'"
          [requiredDeletePermission]="'TECHNICIAN_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
          (scheduleClick)="onSchedule($event)"
          (performanceClick)="onPerformance($event)"
          (rowClick)="onViewDetails($event)"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./technician-list.component.scss']
})
export class TechnicianListComponent implements OnInit {
  private techService = inject(TechnicianService);
  private branchService = inject(BranchService);
  private router = inject(Router);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  technicians: Technician[] = [];
  techniciansWithBranch: any[] = [];
  branches: Branch[] = [];

  columns: TableColumn[] = [
    { key: 'fullName', label: 'Ad Soyad', sortable: true, filterMaxLength: 30, filterInputMode: 'letters' },
    { key: 'phone', label: 'Telefon', sortable: true, filterMaxLength: 11, filterInputMode: 'digits' },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'region', label: 'Bölge', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'levelLabel', label: 'Seviye', sortable: true, filterMaxLength: 15, filterInputMode: 'letters' },
    { key: 'performanceScore', label: 'Performans', sortable: true, type: 'number', filterMin: 0, filterMax: 100, filterMaxLength: 3 },
    { key: 'completedJobsCount', label: 'Tamamlanan İş', sortable: true, type: 'number', filterMin: 0, filterMax: 10000, filterMaxLength: 5 },
    { key: 'isActive', label: 'Aktif', sortable: true, type: 'boolean' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadTechnicians();
  }

  loadTechnicians(): void {
    try {
      // Pasifleştirilen (silinen) teknisyenler listede gösterilmez.
      this.technicians = this.techService.getTechnicians().filter(t => t.isActive !== false);
      this.techniciansWithBranch = this.technicians.map(t => ({
        ...t,
        branchName: this.getBranchName(t.branchId),
        levelLabel: TECHNICIAN_LEVEL_LABELS[t.level] || t.level
      }));
    } catch (err: any) {
      console.error('Teknisyenler yüklenemedi:', err.message);
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
    this.router.navigate(['/teknisyenler/yeni']);
  }

  onEdit(row: Technician): void {
    this.router.navigate(['/teknisyenler/duzenle', row.id]);
  }

  onSchedule(row: Technician): void {
    this.router.navigate(['/teknisyenler/takvim', row.id]);
  }

  onPerformance(row: Technician): void {
    this.router.navigate(['/teknisyenler/performans', row.id]);
  }

  async onDelete(row: Technician): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Teknisyen Silme / Pasifleştirme',
      `${row.fullName} isimli teknisyeni silmek veya pasifleştirmek istediğinize emin misiniz?`
    );
    if (approved) {
      try {
        this.techService.deleteTechnician(row.id);
        this.toastService.showSuccess('Teknisyen başarıyla pasifleştirildi/silindi.');
        this.loadTechnicians();
      } catch (err: any) {
        this.toastService.showError(err.message || 'Bir hata oluştu.');
      }
    }
  }

  onViewDetails(row: Technician): void {
    this.router.navigate(['/teknisyenler/takvim', row.id]);
  }
}
