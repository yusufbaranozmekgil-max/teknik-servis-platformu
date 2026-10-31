import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { AuthStateService } from '../auth/auth-state.service';

describe('PermissionService kapsam', () => {
  let user: any;
  let service: PermissionService;

  const orders = [
    { id: 'a', branchId: 'branch-1', technicianId: 'tech-1' },
    { id: 'b', branchId: 'branch-2', technicianId: 'tech-2' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: AuthStateService, useValue: { currentUser: () => user, currentRole: () => user?.role } },
        { provide: AuditLogService, useValue: {} },
        { provide: NotificationService, useValue: {} }
      ]
    });
    service = TestBed.inject(PermissionService);
  });

  it('şube sorumlusu yalnız kendi şubesini görür', () => {
    user = { role: 'BRANCH_MANAGER', branchId: 'branch-1' };
    expect(service.scopeToBranch(orders).map(o => o.id)).toEqual(['a']);
  });

  it('yönetici tüm şubeleri görür', () => {
    user = { role: 'SYSTEM_ADMIN', branchId: null };
    expect(service.scopeToBranch(orders).length).toBe(2);
  });

  it('dispeçerin şube ataması listeyi daraltmaz', () => {
    user = { role: 'DISPATCHER', branchId: 'branch-1' };
    expect(service.scopeToBranch(orders).length).toBe(2);
  });

  it('teknisyen yalnız kendi iş emirlerini görür', () => {
    user = { role: 'TECHNICIAN', branchId: 'branch-1', technicianId: 'tech-2' };
    expect(service.scopeWorkOrders(orders).map(o => o.id)).toEqual(['b']);
  });

  it('teknisyen kaydı olmayan teknisyen hiç iş görmez', () => {
    user = { role: 'TECHNICIAN', branchId: 'branch-1', technicianId: null };
    expect(service.scopeWorkOrders(orders)).toEqual([]);
  });

  it('şube sorumlusu iş emirlerinde de kendi şubesini görür', () => {
    user = { role: 'BRANCH_MANAGER', branchId: 'branch-2' };
    expect(service.scopeWorkOrders(orders).map(o => o.id)).toEqual(['b']);
  });
});
