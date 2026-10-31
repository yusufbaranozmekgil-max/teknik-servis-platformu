import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestBed } from '@angular/core/testing';
import { StockMovementService } from './stock-movement.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { SparePart } from '../models/spare-part.model';
import { MockStorageService } from '../testing/mock-storage.service';

describe('StockMovementService.transferBetweenBranches', () => {
    let service: StockMovementService;
    let storage: MockStorageService;

    const source = { id: 'part-1', code: 'PRT-1', name: 'Fan', branchId: 'branch-1', stockQuantity: 10, reservedQuantity: 2, minStockThreshold: 1, unitPrice: 50, isActive: true };
    const params = { sourcePartId: 'part-1', targetBranchId: 'branch-2', quantity: 3, description: 'Şube ihtiyacı' };
    const parts = () => storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
    const target = () => parts().find(p => p.branchId === 'branch-2')!;

    beforeEach(() => {
        storage = new MockStorageService();
        TestBed.configureTestingModule({
            providers: [
                StockMovementService,
                { provide: StorageService, useValue: storage },
                { provide: AuditLogService, useValue: { logAction: () => { } } },
                { provide: NotificationService, useValue: {
                        createNotification: vi.fn().mockName("NotificationService.createNotification"),
                        createForRole: vi.fn().mockName("NotificationService.createForRole")
                    } },
                { provide: PermissionService, useValue: { assertPermission: () => { } } }
            ]
        });
        service = TestBed.inject(StockMovementService);
    });

    it('hedef şubede parça yoksa aynı kodla oluşturur', () => {
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [source]);

        service.transferBetweenBranches(params);

        expect(parts().find(p => p.id === 'part-1')!.stockQuantity).toBe(7);
        expect(target().code).toBe('PRT-1');
        expect(target().id).not.toBe('part-1');
        expect(target().stockQuantity).toBe(3);
        expect(target().reservedQuantity).toBe(0);
    });

    it('hedef şubede parça varsa stoğunu artırır', () => {
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [source, { ...source, id: 'part-2', branchId: 'branch-2', stockQuantity: 4 }]);

        service.transferBetweenBranches(params);

        expect(parts().length).toBe(2);
        expect(target().stockQuantity).toBe(7);
    });

    it('rezerve edilmiş stoğu transfer ettirmez', () => {
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [source]);

        expect(() => service.transferBetweenBranches({ ...params, quantity: 9 })).toThrowError(/stok yetersiz/i);
        expect(parts().find(p => p.id === 'part-1')!.stockQuantity).toBe(10);
    });
});
