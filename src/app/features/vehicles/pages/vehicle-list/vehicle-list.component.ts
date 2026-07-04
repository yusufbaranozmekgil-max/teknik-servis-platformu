import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { BranchService } from '../../../../core/services/branch.service';
import { TechnicianService } from '../../../../core/services/technician.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { Branch } from '../../../../core/models/branch.model';
import { Technician } from '../../../../core/models/technician.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  template: `
    <div class="crud-container">
      <div class="header-section">
        <h2>Saha Araçları Yönetimi</h2>
        <button *ngIf="permissionService.hasPermission('VEHICLE_CREATE')" (click)="openCreatePage()" class="primary-btn">
          + Yeni Araç Ekle
        </button>
      </div>

      <div class="table-container">
        <app-data-table 
          [data]="vehiclesWithDetails" 
          [columns]="columns" 
          [requiredEditPermission]="'VEHICLE_UPDATE'"
          [requiredDeletePermission]="'VEHICLE_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
          (rowClick)="onViewDetails($event)"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./vehicle-list.component.scss']
})
export class VehicleListComponent implements OnInit {
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private techService = inject(TechnicianService);
  private router = inject(Router);
  permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  vehicles: Vehicle[] = [];
  vehiclesWithDetails: any[] = [];
  branches: Branch[] = [];
  technicians: Technician[] = [];

  columns: TableColumn[] = [
    { key: 'plateNumber', label: 'Plaka', sortable: true, filterMaxLength: 10 },
    { key: 'vehicleType', label: 'Tip', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'brandModel', label: 'Marka / Model', sortable: true, filterMaxLength: 25 },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'driverName', label: 'Atanmış Teknisyen', sortable: true, filterMaxLength: 30, filterInputMode: 'letters' },
    { key: 'fuelLevelPercent', label: 'Yakıt Seviyesi', sortable: true, filterMaxLength: 5 },
    { key: 'status', label: 'Durum', sortable: true, type: 'status' },
    { key: 'lastMaintenanceDate', label: 'Son Bakım', sortable: true, type: 'date' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadTechnicians();
    this.loadVehicles();
  }

  loadVehicles(): void {
    try {
      this.vehicles = this.vehicleService.getVehicles();
      this.vehiclesWithDetails = this.vehicles.map(v => ({
        ...v,
        brandModel: `${v.brand} ${v.model}`,
        branchName: this.getBranchName(v.branchId),
        driverName: this.getDriverName(v.assignedTechnicianId),
        fuelLevelPercent: `%${v.fuelLevel}`
      }));
    } catch (err: any) {
      console.error('Araçlar yüklenemedi:', err.message);
    }
  }

  loadBranches(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      console.error('Şubeler yüklenemedi:', err.message);
    }
  }

  loadTechnicians(): void {
    try {
      this.technicians = this.techService.getTechnicians();
    } catch (err: any) {
      console.error('Teknisyenler yüklenemedi:', err.message);
    }
  }

  getBranchName(id: string): string {
    const matched = this.branches.find(b => b.id === id);
    return matched ? matched.name : 'Belirtilmedi';
  }

  getDriverName(id: string | null): string {
    if (!id) return 'Boşta';
    const matched = this.technicians.find(t => t.id === id);
    return matched ? matched.fullName : 'Bilinmeyen';
  }

  openCreatePage(): void {
    this.router.navigate(['/araclar/yeni']);
  }

  onEdit(row: Vehicle): void {
    this.router.navigate(['/araclar/duzenle', row.id]);
  }

  async onDelete(row: Vehicle): Promise<void> {
    const approved = await this.confirmService.confirm(
      'Araç Silme / Pasifleştirme',
      `${row.plateNumber} plakalı aracı silmek veya pasifleştirmek istediğinize emin misiniz?`
    );
    if (approved) {
      try {
        this.vehicleService.deleteVehicle(row.id);
        this.toastService.showSuccess('Araç başarıyla pasifleştirildi/silindi.');
        this.loadVehicles();
      } catch (err: any) {
        this.toastService.showError(err.message || 'Bir hata oluştu.');
      }
    }
  }

  onViewDetails(row: Vehicle): void {
    this.router.navigate(['/araclar/bakim', row.id]);
  }
}
