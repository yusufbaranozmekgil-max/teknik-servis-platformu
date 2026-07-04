import { TestBed } from '@angular/core/testing';
import { ReservationService } from './reservation.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { SparePart } from '../models/spare-part.model';
import { PartReservation } from '../models/part-reservation.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';

class MockStorageService {
  private store: Record<string, any[]> = {};

  getCollection<T>(key: string): T[] {
    return this.store[key] || [];
  }

  setCollection<T>(key: string, data: T[]): boolean {
    this.store[key] = JSON.parse(JSON.stringify(data)); // deep clone
    return true;
  }

  getById<T extends { id: string }>(key: string, id: string): T | null {
    return this.getCollection<T>(key).find(item => item.id === id) || null;
  }

  create<T extends { id: string }>(key: string, item: T): T {
    const list = this.getCollection<T>(key);
    list.push(item);
    this.setCollection(key, list);
    return item;
  }

  update<T extends { id: string }>(key: string, id: string, item: Partial<T>): T {
    const list = this.getCollection<T>(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Not found');
    list[idx] = { ...list[idx], ...item };
    this.setCollection(key, list);
    return list[idx];
  }

  clear() {
    this.store = {};
  }
}

class MockPermissionService {
  assertPermission(p: string) {}
}

class MockAuditLogService {
  logAction(a: any) {}
}

class MockNotificationService {
  createForRole(..._args: any[]) {}
  createNotification(_n: any) {}
}

describe('ReservationService', () => {
  let service: ReservationService;
  let mockStorage: MockStorageService;

  beforeEach(() => {
    mockStorage = new MockStorageService();

    TestBed.configureTestingModule({
      providers: [
        ReservationService,
        { provide: StorageService, useValue: mockStorage },
        { provide: PermissionService, useClass: MockPermissionService },
        { provide: AuditLogService, useClass: MockAuditLogService },
        { provide: NotificationService, useClass: MockNotificationService }
      ]
    });

    service = TestBed.inject(ReservationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Test 1: stok 10, rezerve 0, 3 rezerve => stok 10, rezerve 3, available 7
  it('should reserve parts correctly (stock 10, reserved 0, reserve 3 => stock 10, reserved 3, available 7)', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 0,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);

    const res = service.reservePart('wo-123', 'part-1', 3);

    expect(res).toBeTruthy();
    expect(res.quantity).toEqual(3);
    expect(res.status).toEqual('ACTIVE');

    const updatedPart = mockStorage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, 'part-1');
    expect(updatedPart?.stockQuantity).toEqual(10);
    expect(updatedPart?.reservedQuantity).toEqual(3);
    expect(service.getAvailableQuantity('part-1')).toEqual(7);
  });

  // Test 2: stok 10, rezerve 3, iptal => stok 10, rezerve 0, available 10
  it('should release reservations correctly (stock 10, reserved 3, cancel => stock 10, reserved 0, available 10)', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 3,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    const reservation: PartReservation = {
      id: 'res-999',
      partId: 'part-1',
      workOrderId: 'wo-123',
      quantity: 3,
      status: 'ACTIVE',
      reservedAt: '',
      consumedAt: null,
      releasedAt: null
    };

    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);
    mockStorage.setCollection(STORAGE_KEYS.PART_RESERVATIONS, [reservation]);

    service.releaseReservation('res-999');

    const updatedPart = mockStorage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, 'part-1');
    expect(updatedPart?.stockQuantity).toEqual(10);
    expect(updatedPart?.reservedQuantity).toEqual(0);
    expect(service.getAvailableQuantity('part-1')).toEqual(10);

    const updatedRes = mockStorage.getById<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, 'res-999');
    expect(updatedRes?.status).toEqual('RELEASED');
  });

  // Test 3: stok 10, rezerve 3, tamamlandı ve 2 kullanıldı => stok 8, rezerve 0, available 8
  it('should consume reserved parts completely (stock 10, reserved 3, consume 2 => stock 8, reserved 0, available 8)', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 3,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    const reservation: PartReservation = {
      id: 'res-999',
      partId: 'part-1',
      workOrderId: 'wo-123',
      quantity: 3,
      status: 'ACTIVE',
      reservedAt: '',
      consumedAt: null,
      releasedAt: null
    };

    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);
    mockStorage.setCollection(STORAGE_KEYS.PART_RESERVATIONS, [reservation]);

    service.consumeReservedPart('wo-123', 'part-1', 2);

    const updatedPart = mockStorage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, 'part-1');
    expect(updatedPart?.stockQuantity).toEqual(8);
    expect(updatedPart?.reservedQuantity).toEqual(0);
    expect(service.getAvailableQuantity('part-1')).toEqual(8);

    const updatedRes = mockStorage.getById<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, 'res-999');
    expect(updatedRes?.status).toEqual('CONSUMED');
  });

  // Test 4: stok 10, rezerve 3, kısmi tamamlandı ve 1 kullanıldı => stok 9, rezerve 0, available 9
  it('should consume reserved parts partially (stock 10, reserved 3, consume 1 => stock 9, reserved 0, available 9)', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 3,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    const reservation: PartReservation = {
      id: 'res-999',
      partId: 'part-1',
      workOrderId: 'wo-123',
      quantity: 3,
      status: 'ACTIVE',
      reservedAt: '',
      consumedAt: null,
      releasedAt: null
    };

    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);
    mockStorage.setCollection(STORAGE_KEYS.PART_RESERVATIONS, [reservation]);

    service.consumeReservedPart('wo-123', 'part-1', 1);

    const updatedPart = mockStorage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, 'part-1');
    expect(updatedPart?.stockQuantity).toEqual(9);
    expect(updatedPart?.reservedQuantity).toEqual(0);
    expect(service.getAvailableQuantity('part-1')).toEqual(9);
  });

  // Test 5: stok aşan rezervasyon reddedilir
  it('should reject reservation that exceeds available stock', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 8,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);

    expect(() => {
      service.reservePart('wo-123', 'part-1', 3);
    }).toThrowError(/Yetersiz stok/);
  });

  // Test 6: usedQuantity reservedQuantity değerini aşarsa reddedilir
  it('should reject consumption if used quantity exceeds reserved quantity', () => {
    const part: SparePart = {
      id: 'part-1',
      code: 'PART-A',
      name: 'Yedek Parca A',
      category: 'CONSUMABLES',
      branchId: 'sube-1',
      compatibleDevices: 'All',
      unit: 'PCS',
      stockQuantity: 10,
      reservedQuantity: 3,
      minStockThreshold: 2,
      unitPrice: 100,
      isActive: true,
      createdAt: ''
    };
    const reservation: PartReservation = {
      id: 'res-999',
      partId: 'part-1',
      workOrderId: 'wo-123',
      quantity: 3,
      status: 'ACTIVE',
      reservedAt: '',
      consumedAt: null,
      releasedAt: null
    };

    mockStorage.setCollection(STORAGE_KEYS.SPARE_PARTS, [part]);
    mockStorage.setCollection(STORAGE_KEYS.PART_RESERVATIONS, [reservation]);

    expect(() => {
      service.consumeReservedPart('wo-123', 'part-1', 4);
    }).toThrowError(/rezerve edilen miktarı aşamaz/);
  });
});
