import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

export const routes: Routes = [
  {
    path: 'giris',
    loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  // Eski İngilizce yolları Türkçe eşdeğerlerine yönlendir
  { path: 'login', redirectTo: 'giris', pathMatch: 'full' },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'panel',
        pathMatch: 'full'
      },
      {
        path: 'panel',
        loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      { path: 'dashboard', redirectTo: 'panel', pathMatch: 'full' },

      // ==================== ŞUBELER ====================
      {
        path: 'subeler',
        loadComponent: () => import('./features/branches/pages/branch-list/branch-list.component').then(m => m.BranchListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'BRANCH_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER', 'WAREHOUSE_MANAGER'] }
      },
      {
        path: 'subeler/yeni',
        loadComponent: () => import('./features/branches/pages/branch-create/branch-create.component').then(m => m.BranchCreatePage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'BRANCH_CREATE' }
      },
      {
        path: 'subeler/duzenle/:id',
        loadComponent: () => import('./features/branches/pages/branch-edit/branch-edit.component').then(m => m.BranchEditPage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'BRANCH_UPDATE' }
      },
      {
        path: 'subeler/detay/:id',
        loadComponent: () => import('./features/branches/pages/branch-detail/branch-detail.component').then(m => m.BranchDetailPage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'BRANCH_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER', 'WAREHOUSE_MANAGER'] }
      },
      { path: 'branches', redirectTo: 'subeler', pathMatch: 'full' },
      { path: 'branches/create', redirectTo: 'subeler/yeni', pathMatch: 'full' },
      { path: 'branches/edit/:id', redirectTo: 'subeler/duzenle/:id', pathMatch: 'full' },
      { path: 'branches/detail/:id', redirectTo: 'subeler/detay/:id', pathMatch: 'full' },

      // ==================== TEKNİSYENLER ====================
      {
        path: 'teknisyenler',
        loadComponent: () => import('./features/technicians/pages/technician-list/technician-list.component').then(m => m.TechnicianListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'TECHNICIAN_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER'] }
      },
      {
        path: 'teknisyenler/yeni',
        loadComponent: () => import('./features/technicians/pages/technician-create/technician-create.component').then(m => m.TechnicianCreatePage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'TECHNICIAN_CREATE' }
      },
      {
        path: 'teknisyenler/duzenle/:id',
        loadComponent: () => import('./features/technicians/pages/technician-edit/technician-edit.component').then(m => m.TechnicianEditPage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'TECHNICIAN_UPDATE' }
      },
      {
        path: 'teknisyenler/takvim/:id',
        loadComponent: () => import('./features/technicians/pages/technician-schedule/technician-schedule.component').then(m => m.TechnicianSchedulePage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'TECHNICIAN_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER'] }
      },
      {
        path: 'teknisyenler/performans/:id',
        loadComponent: () => import('./features/technicians/pages/technician-performance/technician-performance.component').then(m => m.TechnicianPerformancePage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'TECHNICIAN_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER'] }
      },
      { path: 'technicians', redirectTo: 'teknisyenler', pathMatch: 'full' },
      { path: 'technicians/create', redirectTo: 'teknisyenler/yeni', pathMatch: 'full' },
      { path: 'technicians/edit/:id', redirectTo: 'teknisyenler/duzenle/:id', pathMatch: 'full' },
      { path: 'technicians/schedule/:id', redirectTo: 'teknisyenler/takvim/:id', pathMatch: 'full' },
      { path: 'technicians/performance/:id', redirectTo: 'teknisyenler/performans/:id', pathMatch: 'full' },

      // ==================== STOK ====================
      {
        path: 'stok',
        loadComponent: () => import('./features/inventory/pages/spare-part-list/spare-part-list.component').then(m => m.SparePartListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'INVENTORY_VIEW' }
      },
      {
        path: 'stok/yeni',
        loadComponent: () => import('./features/inventory/pages/spare-part-create/spare-part-create.component').then(m => m.SparePartCreatePage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'INVENTORY_CREATE' }
      },
      {
        path: 'stok/duzenle/:id',
        loadComponent: () => import('./features/inventory/pages/spare-part-edit/spare-part-edit.component').then(m => m.SparePartEditPage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'INVENTORY_UPDATE' }
      },
      {
        path: 'stok/hareket',
        loadComponent: () => import('./features/inventory/pages/stock-movement/stock-movement.component').then(m => m.StockMovementPage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'STOCK_MOVEMENT_VIEW' }
      },
      {
        path: 'stok/kritik',
        loadComponent: () => import('./features/inventory/pages/critical-stock/critical-stock.component').then(m => m.CriticalStockPage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'INVENTORY_VIEW', showOnlyCritical: true }
      },
      {
        path: 'stok/sube-stok',
        loadComponent: () => import('./features/inventory/pages/branch-stock/branch-stock.component').then(m => m.BranchStockPage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'INVENTORY_VIEW' }
      },
      { path: 'inventory', redirectTo: 'stok', pathMatch: 'full' },
      { path: 'inventory/create', redirectTo: 'stok/yeni', pathMatch: 'full' },
      { path: 'inventory/edit/:id', redirectTo: 'stok/duzenle/:id', pathMatch: 'full' },
      { path: 'inventory/movement', redirectTo: 'stok/hareket', pathMatch: 'full' },
      { path: 'inventory/critical', redirectTo: 'stok/kritik', pathMatch: 'full' },
      { path: 'inventory/branch-stock', redirectTo: 'stok/sube-stok', pathMatch: 'full' },

      // ==================== SERVİS TALEPLERİ ====================
      {
        path: 'servis-talepleri',
        loadComponent: () => import('./features/service-requests/pages/request-list/request-list.component').then(m => m.RequestListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'SERVICE_REQUEST_VIEW' }
      },
      {
        path: 'servis-talepleri/yeni',
        loadComponent: () => import('./features/service-requests/pages/request-create/request-create.component').then(m => m.RequestCreatePage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'SERVICE_REQUEST_CREATE' }
      },
      {
        path: 'servis-talepleri/detay/:id',
        loadComponent: () => import('./features/service-requests/pages/request-detail/request-detail.component').then(m => m.RequestDetailPage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'SERVICE_REQUEST_VIEW' }
      },
      { path: 'service-requests', redirectTo: 'servis-talepleri', pathMatch: 'full' },
      { path: 'service-requests/create', redirectTo: 'servis-talepleri/yeni', pathMatch: 'full' },
      { path: 'service-requests/detail/:id', redirectTo: 'servis-talepleri/detay/:id', pathMatch: 'full' },

      // ==================== İŞ EMİRLERİ ====================
      {
        path: 'is-emirleri',
        loadComponent: () => import('./features/work-orders/pages/work-order-list/work-order-list.component').then(m => m.WorkOrderListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'WORK_ORDER_VIEW', blockedRoles: ['WAREHOUSE_MANAGER'] }
      },
      { path: 'work-orders', redirectTo: 'is-emirleri', pathMatch: 'full' },

      // ==================== PLANLAMA ====================
      {
        path: 'planlama',
        loadComponent: () => import('./features/scheduling/pages/schedule-board/schedule-board.component').then(m => m.ScheduleBoardComponent),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'WORK_ORDER_PLAN' }
      },
      { path: 'scheduling', redirectTo: 'planlama', pathMatch: 'full' },

      // ==================== VARDİYALAR ====================
      {
        path: 'vardiyalar',
        loadComponent: () => import('./features/shifts/pages/shift-list/shift-list.component').then(m => m.ShiftListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'SHIFT_VIEW' }
      },
      { path: 'shifts', redirectTo: 'vardiyalar', pathMatch: 'full' },

      // ==================== ARAÇLAR ====================
      {
        path: 'araclar',
        loadComponent: () => import('./features/vehicles/pages/vehicle-list/vehicle-list.component').then(m => m.VehicleListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'VEHICLE_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER'] }
      },
      {
        path: 'araclar/yeni',
        loadComponent: () => import('./features/vehicles/pages/vehicle-create/vehicle-create.component').then(m => m.VehicleCreatePage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'VEHICLE_CREATE' }
      },
      {
        path: 'araclar/duzenle/:id',
        loadComponent: () => import('./features/vehicles/pages/vehicle-edit/vehicle-edit.component').then(m => m.VehicleEditPage),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'VEHICLE_UPDATE' }
      },
      {
        path: 'araclar/bakim/:id',
        loadComponent: () => import('./features/vehicles/pages/vehicle-maintenance/vehicle-maintenance.component').then(m => m.VehicleMaintenancePage),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'VEHICLE_VIEW', blockedRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER'] }
      },
      { path: 'vehicles', redirectTo: 'araclar', pathMatch: 'full' },
      { path: 'vehicles/create', redirectTo: 'araclar/yeni', pathMatch: 'full' },
      { path: 'vehicles/edit/:id', redirectTo: 'araclar/duzenle/:id', pathMatch: 'full' },
      { path: 'vehicles/maintenance/:id', redirectTo: 'araclar/bakim/:id', pathMatch: 'full' },

      // ==================== KURALLAR ====================
      {
        path: 'kurallar',
        loadComponent: () => import('./features/rules/pages/rule-list/rule-list.component').then(m => m.RuleListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'RULE_VIEW' }
      },
      {
        path: 'kurallar/yeni',
        loadComponent: () => import('./features/rules/pages/rule-form/rule-form.component').then(m => m.RuleFormComponent),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'RULE_MANAGE' }
      },
      {
        path: 'kurallar/duzenle/:id',
        loadComponent: () => import('./features/rules/pages/rule-form/rule-form.component').then(m => m.RuleFormComponent),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'RULE_MANAGE' }
      },
      {
        path: 'kurallar/test',
        loadComponent: () => import('./features/rules/pages/rule-test/rule-test.component').then(m => m.RuleTestComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'RULE_MANAGE' }
      },
      { path: 'rules', redirectTo: 'kurallar', pathMatch: 'full' },
      { path: 'rules/create', redirectTo: 'kurallar/yeni', pathMatch: 'full' },
      { path: 'rules/edit/:id', redirectTo: 'kurallar/duzenle/:id', pathMatch: 'full' },
      { path: 'rules/test', redirectTo: 'kurallar/test', pathMatch: 'full' },

      // ==================== BİLDİRİMLER ====================
      {
        path: 'bildirimler',
        loadComponent: () => import('./features/notifications/pages/notification-center/notification-center.component').then(m => m.NotificationCenterComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'NOTIFICATION_VIEW' }
      },
      { path: 'notifications', redirectTo: 'bildirimler', pathMatch: 'full' },

      // ==================== RAPORLAR ====================
      {
        path: 'raporlar',
        loadComponent: () => import('./features/reports/pages/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'REPORT_VIEW' }
      },
      { path: 'reports', redirectTo: 'raporlar', pathMatch: 'full' },

      // ==================== DENETİM KAYITLARI ====================
      {
        path: 'denetim-kayitlari',
        loadComponent: () => import('./features/audit-log/pages/audit-list/audit-list.component').then(m => m.AuditListComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'AUDIT_LOG_VIEW' }
      },
      { path: 'audit-log', redirectTo: 'denetim-kayitlari', pathMatch: 'full' },

      // ==================== VERİ TRANSFERİ ====================
      {
        path: 'veri-transferi',
        loadComponent: () => import('./features/import-export/pages/import-export/import-export.component').then(m => m.ImportExportComponent),
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { requiredPermission: 'IMPORT_EXECUTE' }
      },
      { path: 'import-export', redirectTo: 'veri-transferi', pathMatch: 'full' },

      // ==================== SİMÜLASYON ====================
      {
        path: 'simulasyon',
        loadComponent: () => import('./features/simulation/pages/simulation/simulation.component').then(m => m.SimulationComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'SIMULATION_RUN' }
      },
      { path: 'simulation', redirectTo: 'simulasyon', pathMatch: 'full' },

      // ==================== AYARLAR ====================
      {
        path: 'ayarlar',
        loadComponent: () => import('./features/settings/pages/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'SETTINGS_MANAGE' }
      },
      { path: 'settings', redirectTo: 'ayarlar', pathMatch: 'full' }
    ]
  },
  {
    path: '**',
    redirectTo: 'panel'
  }
];
