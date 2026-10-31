import { beforeEach, describe, expect, it } from "vitest";
import { TestBed } from '@angular/core/testing';
import { BranchService } from './branch.service';
import { InventoryService } from './inventory.service';
import { TechnicianService } from './technician.service';
import { VehicleService } from './vehicle.service';
import { AuditLogService } from './audit-log.service';
import { PermissionService } from './permission.service';
import { AuthStateService } from '../auth/auth-state.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { MockStorageService } from '../testing/mock-storage.service';

describe('Silme korumaları', () => {
    let storage: MockStorageService;
    const order = (status: string) => ({ id: 'wo-1', status, technicianId: 'tech-1', vehicleId: 'veh-1', branchId: 'br-1' });

    beforeEach(() => {
        storage = new MockStorageService();
        storage.setCollection(STORAGE_KEYS.TECHNICIANS, [{ id: 'tech-1', isActive: true }]);
        storage.setCollection(STORAGE_KEYS.VEHICLES, [{ id: 'veh-1', isActive: true }]);
        storage.setCollection(STORAGE_KEYS.BRANCHES, [{ id: 'br-1', isActive: true }]);
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [{ id: 'part-1', isActive: true, reservedQuantity: 0 }]);
        TestBed.configureTestingModule({
            providers: [
                { provide: StorageService, useValue: storage },
                { provide: PermissionService, useValue: { assertPermission: () => { } } },
                { provide: AuditLogService, useValue: { logAction: () => { } } },
                { provide: AuthStateService, useValue: { currentRole: () => 'SYSTEM_ADMIN' } }
            ]
        });
    });

    const isActive = (key: string, id: string) => storage.getById<any>(key, id).isActive;

    ['PLANNED', 'ON_THE_WAY', 'ON_SITE'].forEach(status => {
        it(`${status} işi olan teknisyen silinemez`, () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [order(status)]);
            expect(() => TestBed.inject(TechnicianService).deleteTechnician('tech-1')).toThrowError(/aktif iş emri/);
            expect(isActive(STORAGE_KEYS.TECHNICIANS, 'tech-1')).toBe(true);
        });

        it(`${status} işi olan araç silinemez`, () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [order(status)]);
            expect(() => TestBed.inject(VehicleService).deleteVehicle('veh-1')).toThrowError(/aktif iş emri/);
            expect(isActive(STORAGE_KEYS.VEHICLES, 'veh-1')).toBe(true);
        });
    });

    it('açık işi olan şube silinemez', () => {
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [order('OPENED')]);
        expect(() => TestBed.inject(BranchService).deleteBranch('br-1')).toThrowError(/aktif iş emri/);
        expect(isActive(STORAGE_KEYS.BRANCHES, 'br-1')).toBe(true);
    });

    it('kapatılmış işler silmeyi engellemez', () => {
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [order('COMPLETED')]);
        expect(TestBed.inject(TechnicianService).deleteTechnician('tech-1')).toBe(true);
        expect(isActive(STORAGE_KEYS.TECHNICIANS, 'tech-1')).toBe(false);
    });

    it('rezervasyonu olan parça silinemez', () => {
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [{ id: 'part-1', isActive: true, reservedQuantity: 2 }]);
        expect(() => TestBed.inject(InventoryService).deleteSparePart('part-1')).toThrowError(/rezerve/);
        expect(isActive(STORAGE_KEYS.SPARE_PARTS, 'part-1')).toBe(true);
    });
});
