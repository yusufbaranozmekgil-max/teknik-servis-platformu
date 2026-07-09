import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ServiceRequestService } from '../../../../core/services/service-request.service';
import { BranchService } from '../../../../core/services/branch.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ServiceRequest } from '../../../../core/models/service-request.model';
import { Branch } from '../../../../core/models/branch.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  template: `
    <div class="crud-container">
      <div class="header-section">
        <h2>Servis Talepleri Yönetimi</h2>
        <button *ngIf="permissionService.hasPermission('SERVICE_REQUEST_CREATE')" (click)="openCreatePage()" class="primary-btn">
          + Yeni Talep Oluştur
        </button>
      </div>

      <!-- Filtreler -->
      <div class="filters-bar" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <label><strong>Şube Filtresi:</strong></label>
        <select [value]="branchFilter" (change)="onBranchFilterChange($any($event.target).value)" class="form-control" style="width: 250px; padding: 0.4rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background-color: white; color: #0f172a;">
          <option value="">-- Tüm Şubeler --</option>
          <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
        </select>
      </div>

      <div class="table-container">
        <app-data-table
          [data]="requestsWithBranch"
          [columns]="columns"
          [editLabel]="'Görüntüle'"
          [requiredEditPermission]="'SERVICE_REQUEST_UPDATE'"
          [requiredDeletePermission]="'SERVICE_REQUEST_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
          (rowClick)="onViewDetails($event)"
        ></app-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./request-list.component.scss']
})
export class RequestListComponent implements OnInit {
  private requestService = inject(ServiceRequestService);
  private branchService = inject(BranchService);
  private router = inject(Router);
  permissionService = inject(PermissionService);

  requests: ServiceRequest[] = [];
  requestsWithBranch: any[] = [];
  branches: Branch[] = [];
  branchFilter = '';

  private route = inject(ActivatedRoute);

  columns: TableColumn[] = [
    { key: 'code', label: 'Talep Kodu', sortable: true, filterMaxLength: 15 },
    { key: 'title', label: 'Başlık', sortable: true, filterMaxLength: 30 },
    { key: 'customerName', label: 'Müşteri', sortable: true, filterMaxLength: 30, filterInputMode: 'letters' },
    { key: 'deviceBrandModel', label: 'Cihaz Marka/Model', sortable: true, filterMaxLength: 25 },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'priority', label: 'Öncelik', sortable: true, type: 'status' },
    { key: 'status', label: 'Durum', sortable: true, type: 'status' },
    { key: 'slaDeadline', label: 'SLA Sınırı', sortable: true, type: 'date' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.route.queryParams.subscribe(params => {
      if (params['branchId']) {
        this.branchFilter = params['branchId'];
      }
      this.loadRequests();
    });
  }

  loadRequests(): void {
    try {
      this.requests = this.requestService.getServiceRequests();
      let filtered = [...this.requests];
      if (this.branchFilter) {
        filtered = filtered.filter(r => r.branchId === this.branchFilter);
      }
      this.requestsWithBranch = filtered.map(r => ({
        ...r,
        branchName: this.getBranchName(r.branchId)
      }));
    } catch (err: any) {
      console.error('Servis talepleri yüklenemedi:', err.message);
    }
  }

  onBranchFilterChange(val: string): void {
    this.branchFilter = val;
    this.loadRequests();
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
    this.router.navigate(['/servis-talepleri/yeni']);
  }

  onEdit(row: ServiceRequest): void {
    this.router.navigate(['/servis-talepleri/detay', row.id]);
  }

  onDelete(row: ServiceRequest): void {
    if (confirm(`${row.code} numaralı servis talebini silmek istediğinize emin misiniz?`)) {
      try {
        this.requestService.deleteServiceRequest(row.id);
        this.loadRequests();
      } catch (err: any) {
        alert(err.message);
      }
    }
  }

  onViewDetails(row: ServiceRequest): void {
    this.router.navigate(['/servis-talepleri/detay', row.id]);
  }
}
