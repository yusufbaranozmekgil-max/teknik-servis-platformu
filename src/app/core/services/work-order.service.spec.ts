import { TestBed } from '@angular/core/testing';
import { WorkOrderService } from './work-order.service';
import { AuditLogService } from './audit-log.service';
import { InventoryService } from './inventory.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { ReservationService } from './reservation.service';
import { SchedulingService } from './scheduling.service';
import { VehicleScoringService } from './vehicle-scoring.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { WorkOrder, WorkOrderStatus } from '../models/work-order.model';
import { MockStorageService } from '../testing/mock-storage.service';

describe('WorkOrderService durum makinesi', () => {
  let service: WorkOrderService;
  let storage: MockStorageService;
  let auditLog: jasmine.SpyObj<AuditLogService>;
  let reservations: jasmine.SpyObj<ReservationService>;

  const seed = (status: WorkOrderStatus) =>
    storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{
      id: 'wo-1',
      code: 'WO-1',
      status,
      branchId: 'br-1',
      serviceRequestId: 'sr-1',
      technicianId: 'tech-1',
      vehicleId: 'veh-1',
      plannedStart: '2026-11-02T09:00:00',
      plannedEnd: '2026-11-02T11:00:00',
      notes: ''
    }]);
  const stored = () => storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, 'wo-1')!;

  beforeEach(() => {
    storage = new MockStorageService();
    auditLog = jasmine.createSpyObj('AuditLogService', ['logAction']);
    reservations = jasmine.createSpyObj('ReservationService', ['releaseAllReservationsInternal']);
    TestBed.configureTestingModule({
      providers: [
        WorkOrderService,
        { provide: StorageService, useValue: storage },
        { provide: AuditLogService, useValue: auditLog },
        { provide: ReservationService, useValue: reservations },
        { provide: PermissionService, useValue: { assertPermission: () => {} } },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['createNotification', 'createForUser']) },
        { provide: SchedulingService, useValue: {} },
        { provide: VehicleScoringService, useValue: {} },
        { provide: InventoryService, useValue: {} }
      ]
    });
    service = TestBed.inject(WorkOrderService);
  });

  const allowed: [WorkOrderStatus, WorkOrderStatus][] = [
    ['OPENED', 'PLANNED'], ['OPENED', 'CANCELLED'],
    ['PLANNED', 'ON_THE_WAY'], ['PLANNED', 'CANCELLED'],
    ['ON_THE_WAY', 'ON_SITE'], ['ON_THE_WAY', 'FAILED'], ['ON_THE_WAY', 'CANCELLED'],
    ['ON_SITE', 'COMPLETED'], ['ON_SITE', 'PARTIALLY_COMPLETED'], ['ON_SITE', 'FAILED']
  ];
  allowed.forEach(([from, to]) => {
    it(`${from} -> ${to} geçişine izin verir`, () => {
      expect(service.validateTransition(from, to)).toBeTrue();
    });
  });

  const rejected: [WorkOrderStatus, WorkOrderStatus][] = [
    ['OPENED', 'COMPLETED'], ['PLANNED', 'ON_SITE'], ['ON_SITE', 'CANCELLED']
  ];
  rejected.forEach(([from, to]) => {
    it(`${from} -> ${to} geçişini reddeder`, () => {
      expect(service.validateTransition(from, to)).toBeFalse();
    });
  });

  (['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'] as WorkOrderStatus[]).forEach(status => {
    it(`${status} son durumdur`, () => {
      expect(service.getAllowedTransitions(status)).toEqual([]);
    });
  });

  it('geçersiz geçişte durumu değiştirmez, hata fırlatır ve denemeyi loglar', () => {
    seed('OPENED');
    expect(() => service.transitionWorkOrder('wo-1', 'COMPLETED')).toThrowError(/Geçersiz durum geçişi/);
    expect(stored().status).toBe('OPENED');
    expect(auditLog.logAction).toHaveBeenCalledTimes(1);
  });

  it('ON_THE_WAY geçişi gerçek başlangıç zamanını yazar', () => {
    seed('PLANNED');
    service.transitionWorkOrder('wo-1', 'ON_THE_WAY');
    expect(stored().status).toBe('ON_THE_WAY');
    expect(stored().actualStart).toBeTruthy();
  });

  it('iptal rezervasyonları bırakır, kaynakları boşaltır ve talebi NEW yapar', () => {
    seed('PLANNED');
    storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [{ id: 'sr-1', status: 'PLANNED' }]);

    service.cancelWorkOrder('wo-1', 'Müşteri vazgeçti');

    expect(reservations.releaseAllReservationsInternal).toHaveBeenCalledOnceWith('wo-1');
    expect(stored().status).toBe('CANCELLED');
    expect(stored().technicianId).toBeNull();
    expect(stored().vehicleId).toBeNull();
    expect(stored().plannedStart).toBeNull();
    expect(storage.getById<any>(STORAGE_KEYS.SERVICE_REQUESTS, 'sr-1').status).toBe('NEW');
  });

  it('boş iptal nedenini reddeder ve rezervasyona dokunmaz', () => {
    seed('PLANNED');
    expect(() => service.cancelWorkOrder('wo-1', '   ')).toThrowError(/İptal nedeni/);
    expect(reservations.releaseAllReservationsInternal).not.toHaveBeenCalled();
    expect(stored().status).toBe('PLANNED');
  });
});
