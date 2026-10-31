import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestBed } from '@angular/core/testing';
import { RuleEngineService } from './rule-engine.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { StorageService } from '../storage/storage.service';
import { RuleResult } from '../models/rule-result.model';
import { MockStorageService } from '../testing/mock-storage.service';

describe('RuleEngineService.resolveConflicts', () => {
    let service: RuleEngineService;
    let auditLog: any;
    let notifications: any;

    const result = (id: string, priority: number, createdAt: string): RuleResult => ({ rule: { id, name: id, priority, createdAt }, allowed: true, reason: '' } as unknown as RuleResult);

    beforeEach(() => {
        auditLog = {
            logRuleConflict: vi.fn().mockName("AuditLogService.logRuleConflict"),
            logAction: vi.fn().mockName("AuditLogService.logAction")
        };
        notifications = {
            createNotification: vi.fn().mockName("NotificationService.createNotification")
        };
        TestBed.configureTestingModule({
            providers: [
                RuleEngineService,
                { provide: StorageService, useValue: new MockStorageService() },
                { provide: AuditLogService, useValue: auditLog },
                { provide: NotificationService, useValue: notifications },
                { provide: PermissionService, useValue: { assertPermission: () => { } } }
            ]
        });
        service = TestBed.inject(RuleEngineService);
    });

    it('tek kural varsa olduğu gibi döner ve çakışma yazmaz', () => {
        const only = result('a', 1, '2026-01-01');
        expect(service.resolveConflicts([only])).toEqual([only]);
        expect(auditLog.logRuleConflict).not.toHaveBeenCalled();
    });

    it('düşük priority numaralı kural kazanır', () => {
        const [winner] = service.resolveConflicts([result('low', 5, '2026-01-01'), result('high', 2, '2026-03-01')]);
        expect(winner.rule.id).toBe('high');
    });

    it('priority eşitse eski kural kazanır', () => {
        const [winner] = service.resolveConflicts([result('new', 2, '2026-02-01'), result('old', 2, '2026-01-10')]);
        expect(winner.rule.id).toBe('old');
    });

    it('sonuç girdi sırasına bağlı değildir', () => {
        const a = result('a', 2, '2026-01-10');
        const b = result('b', 2, '2026-02-01');
        const c = result('c', 5, '2026-03-12');
        expect(service.resolveConflicts([a, b, c])[0].rule.id).toBe('a');
        expect(service.resolveConflicts([c, b, a])[0].rule.id).toBe('a');
    });

    it('kaybeden her kural için audit log ve bildirim üretir', () => {
        const winnerAndLosers = [result('a', 1, '2026-01-01'), result('b', 2, '2026-01-01'), result('c', 3, '2026-01-01')];
        expect(service.resolveConflicts(winnerAndLosers).length).toBe(1);
        expect(auditLog.logRuleConflict).toHaveBeenCalledTimes(2);
        expect(auditLog.logRuleConflict).toHaveBeenCalledWith('b', 'a', 'a');
        expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    });
});
