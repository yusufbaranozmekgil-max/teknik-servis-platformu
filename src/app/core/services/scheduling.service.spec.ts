import { TestBed } from '@angular/core/testing';
import { SchedulingService } from './scheduling.service';
import { PermissionService } from './permission.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { MockStorageService } from '../testing/mock-storage.service';

describe('SchedulingService', () => {
  let service: SchedulingService;
  let storage: MockStorageService;

  const slot = (start: string, end: string) => ({ start: `2026-11-02T${start}:00`, end: `2026-11-02T${end}:00` });
  const workOrder = (status: string) => ({
    id: 'wo-1',
    technicianId: 'tech-1',
    vehicleId: 'veh-1',
    status,
    plannedStart: '2026-11-02T09:00:00',
    plannedEnd: '2026-11-02T11:00:00'
  });

  beforeEach(() => {
    storage = new MockStorageService();
    TestBed.configureTestingModule({
      providers: [
        SchedulingService,
        { provide: StorageService, useValue: storage },
        { provide: PermissionService, useValue: { assertPermission: () => {} } }
      ]
    });
    service = TestBed.inject(SchedulingService);
  });

  describe('isOverlapping', () => {
    it('kesişen aralıkları çakışma sayar', () => {
      expect(service.isOverlapping(slot('09:00', '11:00'), slot('10:00', '12:00'))).toBeTrue();
    });

    it('birbirini içeren aralıkları çakışma sayar', () => {
      expect(service.isOverlapping(slot('09:00', '12:00'), slot('10:00', '11:00'))).toBeTrue();
    });

    it('uç uca eklenen aralıkları çakışma saymaz', () => {
      expect(service.isOverlapping(slot('09:00', '11:00'), slot('11:00', '12:00'))).toBeFalse();
    });
  });

  describe('technicianHasConflict', () => {
    it('aktif iş emriyle kesişen slotu reddeder', () => {
      storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [workOrder('PLANNED')]);
      expect(service.technicianHasConflict('tech-1', slot('10:00', '12:00'))).toBeTrue();
    });

    it('başka teknisyenin işini çakışma saymaz', () => {
      storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [workOrder('PLANNED')]);
      expect(service.technicianHasConflict('tech-2', slot('10:00', '12:00'))).toBeFalse();
    });

    ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'].forEach(status => {
      it(`${status} iş emri slotu serbest bırakır`, () => {
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [workOrder(status)]);
        expect(service.technicianHasConflict('tech-1', slot('10:00', '12:00'))).toBeFalse();
      });
    });

    it('düzenlenen iş emrini kendisiyle çakıştırmaz', () => {
      storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [workOrder('PLANNED')]);
      expect(service.technicianHasConflict('tech-1', slot('10:00', '12:00'), 'wo-1')).toBeFalse();
    });
  });

  it('vehicleHasConflict aktif iş emriyle kesişen aracı yakalar', () => {
    storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [workOrder('ON_SITE')]);
    expect(service.vehicleHasConflict('veh-1', slot('10:00', '12:00'))).toBeTrue();
    expect(service.vehicleHasConflict('veh-2', slot('10:00', '12:00'))).toBeFalse();
  });
});
