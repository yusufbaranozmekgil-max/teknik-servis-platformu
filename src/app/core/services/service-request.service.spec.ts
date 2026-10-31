import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ServiceRequestService } from './service-request.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { RuleEngineService } from './rule-engine.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { MockStorageService } from '../testing/mock-storage.service';

describe('ServiceRequestService', () => {
  let storage: MockStorageService;
  let service: ServiceRequestService;
  const notifications = { createNotification: vi.fn(), createForRole: vi.fn() };
  const base = { id: 'sr-1', code: 'TALEP-2026-0001', priority: 'STANDARD', requiredSkill: 'WHITE_GOODS', createdAt: '2026-11-02T09:00:00.000Z', slaDeadline: '2026-11-04T09:00:00.000Z' };

  beforeEach(() => {
    storage = new MockStorageService();
    TestBed.configureTestingModule({
      providers: [
        ServiceRequestService,
        { provide: StorageService, useValue: storage },
        { provide: PermissionService, useValue: { assertPermission: () => {} } },
        { provide: AuditLogService, useValue: { logAction: () => {} } },
        { provide: NotificationService, useValue: notifications },
        { provide: RuleEngineService, useValue: { evaluateRules: () => [] } }
      ]
    });
    service = TestBed.inject(ServiceRequestService);
  });

  it('aktif iş emri olan talep silinemez', () => {
    storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [base]);
    storage.setCollection(STORAGE_KEYS.WORK_ORDERS, [{ id: 'wo-1', serviceRequestId: 'sr-1', status: 'PLANNED' }]);
    expect(() => service.deleteServiceRequest('sr-1')).toThrowError(/aktif iş emri/);
    expect(storage.getCollection(STORAGE_KEYS.SERVICE_REQUESTS).length).toBe(1);
  });

  it('yetkinlik değişince SLA yeniden hesaplanır', () => {
    storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, [base]);
    const updated = service.updateServiceRequest('sr-1', { requiredSkill: 'BOILER_HEATING' } as any);
    expect(new Date(updated.slaDeadline).getTime()).toBe(new Date(base.createdAt).getTime() + 36 * 3600 * 1000);
  });
});
