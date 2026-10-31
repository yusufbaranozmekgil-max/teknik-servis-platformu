import { RuleEngineService } from './rule-engine.service';
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    let auditLog: any;
    let reservations: any;

    const seed = (status: WorkOrderStatus) => storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{
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
        auditLog = {
            logAction: vi.fn().mockName("AuditLogService.logAction")
        };
        reservations = {
            releaseAllReservationsInternal: vi.fn().mockName("ReservationService.releaseAllReservationsInternal"),
            reserveParts: vi.fn().mockName("ReservationService.reserveParts"),
            consumeReservedPartsInternal: vi.fn().mockName("ReservationService.consumeReservedPartsInternal")
        };
        TestBed.configureTestingModule({
            providers: [
                WorkOrderService,
                { provide: StorageService, useValue: storage },
                { provide: AuditLogService, useValue: auditLog },
                { provide: ReservationService, useValue: reservations },
                { provide: PermissionService, useValue: { assertPermission: () => { } } },
                { provide: NotificationService, useValue: {
                        createNotification: vi.fn().mockName("NotificationService.createNotification"),
                        createForTechnician: vi.fn().mockName("NotificationService.createForTechnician")
                    } },
                { provide: SchedulingService, useValue: {} },
                { provide: VehicleScoringService, useValue: {} },
                { provide: InventoryService, useValue: {} },
                { provide: RuleEngineService, useValue: { isRuleActive: () => true, evaluateRules: () => [] } }
            ]
        });
        service = TestBed.inject(WorkOrderService);
    });

    const allowed: [
        WorkOrderStatus,
        WorkOrderStatus
    ][] = [
        ['OPENED', 'PLANNED'], ['OPENED', 'CANCELLED'],
        ['PLANNED', 'ON_THE_WAY'], ['PLANNED', 'CANCELLED'],
        ['ON_THE_WAY', 'ON_SITE'], ['ON_THE_WAY', 'FAILED'], ['ON_THE_WAY', 'CANCELLED'],
        ['ON_SITE', 'COMPLETED'], ['ON_SITE', 'PARTIALLY_COMPLETED'], ['ON_SITE', 'FAILED']
    ];
    allowed.forEach(([from, to]) => {
        it(`${from} -> ${to} geçişine izin verir`, () => {
            expect(service.validateTransition(from, to)).toBe(true);
        });
    });

    const rejected: [
        WorkOrderStatus,
        WorkOrderStatus
    ][] = [
        ['OPENED', 'COMPLETED'], ['PLANNED', 'ON_SITE'], ['ON_SITE', 'CANCELLED']
    ];
    rejected.forEach(([from, to]) => {
        it(`${from} -> ${to} geçişini reddeder`, () => {
            expect(service.validateTransition(from, to)).toBe(false);
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

        expect(reservations.releaseAllReservationsInternal).toHaveBeenCalledTimes(1);

        expect(reservations.releaseAllReservationsInternal).toHaveBeenCalledWith('wo-1');
        expect(stored().status).toBe('CANCELLED');
        expect(stored().technicianId).toBeNull();
        expect(stored().vehicleId).toBeNull();
        expect(stored().plannedStart).toBeNull();
        expect(storage.getById<any>(STORAGE_KEYS.SERVICE_REQUESTS, 'sr-1').status).toBe('NEW');
    });

    it('art arda oluşturulan iş emirlerine benzersiz kod verir', () => {
        const year = new Date().getFullYear();
        storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [
            { id: 'sr-1', code: `TALEP-${year}-0001`, status: 'NEW' },
            { id: 'sr-2', code: `TALEP-${year}-0002`, status: 'NEW' }
        ]);
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-old', code: `WO-${year}-0002`, serviceRequestId: 'sr-old' }]);

        const first = service.createWorkOrderFromRequest('sr-1');
        const second = service.createWorkOrderFromRequest('sr-2');

        expect(first.code).toBe(`WO-${year}-0003`);
        expect(second.code).toBe(`WO-${year}-0004`);
    });

    it('iptal edilen işin talebi için yeni iş emri açar', () => {
        storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [{ id: 'sr-1', code: 'TALEP-2026-0001', status: 'NEW' }]);
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-old', code: 'WO-2026-0001', serviceRequestId: 'sr-1', status: 'CANCELLED' }]);

        const created = service.createWorkOrderFromRequest('sr-1');

        expect(created.id).not.toBe('wo-old');
        expect(created.status).toBe('OPENED');
    });

    it('aktif iş emri varsa yenisini açmaz', () => {
        storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [{ id: 'sr-1', code: 'TALEP-2026-0001', status: 'PLANNED' }]);
        storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-1', code: 'WO-2026-0001', serviceRequestId: 'sr-1', status: 'PLANNED' }]);

        expect(service.createWorkOrderFromRequest('sr-1').id).toBe('wo-1');
    });

    describe('geri alma', () => {
        it('kısmi işin bekleyen takip talebini geri almada kaldırır', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-1', code: 'WO-1', status: 'PARTIALLY_COMPLETED', serviceRequestId: 'sr-1', notes: '', requiredParts: [], usedParts: [], actualEnd: new Date().toISOString() }]);
            storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [{ id: 'sr-1', status: 'CLOSED' }, { id: 'sr-2', status: 'NEW', sourceWorkOrderId: 'wo-1' }]);

            service.reopenWorkOrder('wo-1', 'Yanlışlıkla kapatıldı');

            expect(storage.getCollection<any>(STORAGE_KEYS.SERVICE_REQUESTS).map(r => r.id)).toEqual(['sr-1']);
        });

        it('takip talebi planlanmışsa geri almaz', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-1', code: 'WO-1', status: 'PARTIALLY_COMPLETED', serviceRequestId: 'sr-1', notes: '', requiredParts: [], usedParts: [], actualEnd: new Date().toISOString() }]);
            storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [{ id: 'sr-2', status: 'PLANNED', sourceWorkOrderId: 'wo-1' }]);

            expect(() => service.reopenWorkOrder('wo-1', 'Yanlışlıkla kapatıldı')).toThrowError(/takip talebi/);
            expect(stored().status).toBe('PARTIALLY_COMPLETED');
        });

        const closed = (status: WorkOrderStatus, extra = {}) => ({
            id: 'wo-1', code: 'WO-1', status, serviceRequestId: 'sr-1', technicianId: 'tech-1', notes: '',
            requiredParts: [{ partId: 'part-1', quantity: 2 }],
            usedParts: [{ partId: 'part-1', quantity: 1 }],
            actualEnd: new Date().toISOString(),
            ...extra
        });

        it('tamamlanan iş geri alınınca parçaları yeniden rezerve eder', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [closed('COMPLETED')]);
            storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [{ id: 'part-1', stockQuantity: 5, reservedQuantity: 0 }]);

            service.reopenWorkOrder('wo-1', 'Yanlışlıkla kapatıldı');

            expect(stored().status).toBe('PLANNED');
            expect(reservations.reserveParts).toHaveBeenCalledTimes(1);
            expect(reservations.reserveParts).toHaveBeenCalledWith('wo-1', [{ partId: 'part-1', quantity: 2 }]);
            expect(storage.getById<any>(STORAGE_KEYS.SPARE_PARTS, 'part-1').stockQuantity).toBe(6);
        });

        it('tamamlanan iş geri alınınca teknisyen sayacını düşürür', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [closed('COMPLETED')]);
            storage.setCollection(STORAGE_KEYS.TECHNICIANS, [{ id: 'tech-1', completedJobsCount: 5, performanceScore: 80 }]);

            service.reopenWorkOrder('wo-1', 'Yanlışlıkla kapatıldı');

            expect(storage.getById<any>(STORAGE_KEYS.TECHNICIANS, 'tech-1').completedJobsCount).toBe(4);
        });

        it('iptal edilen iş rezervasyon oluşturmadan OPENED olur', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [closed('CANCELLED', { usedParts: [] })]);

            service.reopenWorkOrder('wo-1', 'Müşteri geri döndü');

            expect(stored().status).toBe('OPENED');
            expect(reservations.reserveParts).not.toHaveBeenCalled();
        });

        it('aynı talep için aktif iş varsa iptali geri almaz', () => {
            storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [
                closed('CANCELLED', { usedParts: [] }),
                { id: 'wo-2', code: 'WO-2', status: 'PLANNED', serviceRequestId: 'sr-1' }
            ]);

            expect(() => service.reopenWorkOrder('wo-1', 'Müşteri geri döndü')).toThrowError(/aktif bir iş emri/);
            expect(stored().status).toBe('CANCELLED');
        });
    });

    it('tamamlanınca kullanılan parçalardan gerçek maliyeti hesaplar', () => {
        seed('ON_SITE');
        storage.setCollection(STORAGE_KEYS.SPARE_PARTS, [{ id: 'part-1', unitPrice: 250 }]);
        storage.update<any>(STORAGE_KEYS.WORK_ORDERS, 'wo-1', { requiredParts: [{ partId: 'part-1', quantity: 2 }] });

        service.completeWorkOrder('wo-1', [{ partId: 'part-1', quantity: 2 }]);

        expect(stored().actualCost).toBe(500);
    });

    it('boş iptal nedenini reddeder ve rezervasyona dokunmaz', () => {
        seed('PLANNED');
        expect(() => service.cancelWorkOrder('wo-1', '   ')).toThrowError(/İptal nedeni/);
        expect(reservations.releaseAllReservationsInternal).not.toHaveBeenCalled();
        expect(stored().status).toBe('PLANNED');
    });
});
