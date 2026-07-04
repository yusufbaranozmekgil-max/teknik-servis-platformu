import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Rule, RuleActionType } from '../models/rule.model';
import { RuleResult } from '../models/rule-result.model';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { ServiceRequest } from '../models/service-request.model';
import { WorkOrder } from '../models/work-order.model';
import { Technician } from '../models/technician.model';
import { Vehicle } from '../models/vehicle.model';
import { SparePart } from '../models/spare-part.model';
import { Branch } from '../models/branch.model';

@Injectable({
  providedIn: 'root'
})
export class RuleEngineService {
  private storage = inject(StorageService);
  private auditLog = inject(AuditLogService);
  private notificationService = inject(NotificationService);
  private permissionService = inject(PermissionService);

  constructor() {
    this.seedDefaultRules();
  }

  getActiveRules(): Rule[] {
    const list = this.storage.getCollection<Rule>(STORAGE_KEYS.RULES);
    return list.filter(r => r.isActive);
  }

  evaluateRules(
    trigger: 'WORK_ORDER_PLAN' | 'SPARE_PART_CONSUMPTION' | 'SERVICE_REQUEST_CREATE' | 'SYSTEM_EVENT',
    context: {
      request?: ServiceRequest;
      workOrder?: WorkOrder;
      technician?: Technician;
      vehicle?: Vehicle;
      sparePart?: SparePart;
      branch?: Branch;
      estimatedCost?: number;
      quantity?: number;
    }
  ): RuleResult[] {
    const activeRules = this.getActiveRules().filter(r => r.trigger === trigger);
    const triggeredResults: RuleResult[] = [];

    for (const rule of activeRules) {
      const match = this.evaluateCondition(rule, context);
      if (match.triggered) {
        triggeredResults.push({
          rule,
          allowed: match.allowed,
          reason: match.reason
        });
      }
    }

    if (triggeredResults.length === 0) {
      return [];
    }

    // Resolve conflicts if there are multiple rules triggered
    return this.resolveConflicts(triggeredResults);
  }

  resolveConflicts(results: RuleResult[]): RuleResult[] {
    if (results.length <= 1) return results;

    // Sort by priority ascending (lower number is higher priority),
    // then by createdAt ascending (older rule wins)
    const sorted = [...results].sort((a, b) => {
      if (a.rule.priority !== b.rule.priority) {
        return a.rule.priority - b.rule.priority;
      }
      return new Date(a.rule.createdAt).getTime() - new Date(b.rule.createdAt).getTime();
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Log the conflict and winner/losers
    for (const loser of losers) {
      this.auditLog.logRuleConflict(loser.rule.id, winner.rule.id, winner.rule.id);
      
      // Notify about rule override
      this.notificationService.createNotification({
        type: 'RULE_CONFLICT',
        severity: 'WARNING',
        title: 'Kural Çakışması Çözüldü',
        message: `Kural çakışması çözüldü. '${winner.rule.name}' kuralı öncelikli uygulandı. '${loser.rule.name}' kuralı ezildi.`,
        branchId: null,
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'RULE',
        relatedEntityId: winner.rule.id,
        link: '/kurallar'
      });
    }

    // Return only the winning rule result as the final outcome
    return [winner];
  }

  testRule(rule: Rule, sampleContext: any): RuleResult {
    this.permissionService.assertPermission('RULE_MANAGE');
    const match = this.evaluateCondition(rule, sampleContext);
    return {
      rule,
      allowed: match.allowed,
      reason: match.reason
    };
  }

  private evaluateCondition(
    rule: Rule,
    context: any
  ): { triggered: boolean; allowed: boolean; reason?: string } {
    try {
      const now = new Date();

      switch (rule.id) {
        case 'rule-1': // Kritik talepler otomatik en üst sıraya
          if (context.request && context.request.priority === 'CRITICAL') {
            return {
              triggered: true,
              allowed: true,
              reason: 'Kritik talepler otomatik olarak en üst sıraya alınmıştır.'
            };
          }
          break;

        case 'rule-2': // 50K TL üzeri şube sorumlusu onayı
          const cost = context.estimatedCost || (context.workOrder ? context.workOrder.estimatedCost : 0);
          if (cost > 50000) {
            return {
              triggered: true,
              allowed: false,
              reason: '50.000 TL üzerindeki iş emirleri şube sorumlusu onayı gerektirir.'
            };
          }
          break;

        case 'rule-3': // Minimum stok seviyesi
          if (context.sparePart) {
            const available = context.sparePart.stockQuantity - context.sparePart.reservedQuantity;
            if (available < context.sparePart.minimumStockLevel) {
              return {
                triggered: true,
                allowed: true,
                reason: `Stok seviyesi kritik limitin (${context.sparePart.minimumStockLevel}) altına düştü.`
              };
            }
          }
          break;

        case 'rule-4': // SLA hedefi aşımı
          if (context.request && context.request.slaDeadline) {
            const deadline = new Date(context.request.slaDeadline);
            if (now.getTime() > deadline.getTime() && context.request.status !== 'CLOSED') {
              return {
                triggered: true,
                allowed: true,
                reason: 'SLA hedef süresi aşıldı, iş emri gecikmiş olarak işaretlendi.'
              };
            }
          }
          break;

        case 'rule-5': // SLA < 2 saat kalan
          if (context.request && context.request.slaDeadline && context.request.status !== 'CLOSED') {
            const deadline = new Date(context.request.slaDeadline);
            const remainingHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (remainingHours > 0 && remainingHours < 2) {
              return {
                triggered: true,
                allowed: true,
                reason: 'SLA süresine 2 saatten az süre kaldı, iş öncelikli duruma getirildi.'
              };
            }
          }
          break;

        case 'rule-6': // Son bakım > 180 gün araç atanamaz
          if (context.vehicle) {
            const maint = new Date(context.vehicle.lastMaintenanceDate).getTime();
            const diffDays = (now.getTime() - maint) / (1000 * 60 * 60 * 24);
            if (diffDays > 180) {
              return {
                triggered: true,
                allowed: false,
                reason: `Aracın son bakım tarihi 180 günü aşmıştır (${Math.floor(diffDays)} gün). Atama engellendi.`
              };
            }
          }
          break;

        case 'rule-7': // Yakıt seviyesi %30 altı
          if (context.vehicle && context.vehicle.fuelLevel < 30) {
            return {
              triggered: true,
              allowed: false,
              reason: `Aracın yakıt seviyesi %30 altındadır (%${context.vehicle.fuelLevel}). Atama engellendi.`
            };
          }
          break;

        case 'rule-8': // İzinli/pasif teknisyen atanamaz
          if (context.technician) {
            if (!context.technician.isActive) {
              return {
                triggered: true,
                allowed: false,
                reason: 'Teknisyen pasif durumdadır. Atama engellendi.'
              };
            }
            if (context.technician.isOnLeave) {
              return {
                triggered: true,
                allowed: false,
                reason: 'Teknisyen izinli durumdadır. Atama engellendi.'
              };
            }
          }
          break;

        case 'rule-9': // Şube kapasitesi doluysa yeni atama engellensin
          if (context.branch) {
            // Evaluated by scheduling service, but mapped here as rule check
            if (context.branch.isActive && context.branchCurrentOrdersCount >= context.branch.dailyCapacity) {
              return {
                triggered: true,
                allowed: false,
                reason: `Şube günlük iş kapasitesi (${context.branch.dailyCapacity}) dolmuştur.`
              };
            }
          }
          break;

        case 'rule-10': // Garanti dışı işlerde onay yoksa parça engeli
          if (context.request) {
            if (!context.request.hasWarranty && !context.request.hasCustomerApproval) {
              return {
                triggered: true,
                allowed: false,
                reason: 'Garanti kapsamı dışındaki işlerde müşteri onayı alınmadan parça rezervasyonu/çıkışı yapılamaz.'
              };
            }
          }
          break;

        default:
          // User-defined dynamic rule evaluation
          if (rule.conditionField && rule.operator && rule.conditionValue !== undefined) {
            const parts = rule.conditionField.split('.');
            let value: any = null;
            if (parts.length === 2) {
              const ctxObj = context[parts[0]];
              if (ctxObj) {
                value = ctxObj[parts[1]];
              }
            } else {
              value = context[rule.conditionField];
            }

            if (value !== undefined && value !== null) {
              const condVal = rule.conditionValue;
              const numVal = Number(value);
              const numCond = Number(condVal);
              const isNumeric = !isNaN(numVal) && !isNaN(numCond) && value !== '' && condVal !== '';

              let triggered = false;
              switch (rule.operator) {
                case 'EQUALS':
                  triggered = isNumeric ? numVal === numCond : String(value).toUpperCase() === String(condVal).toUpperCase();
                  break;
                case 'NOT_EQUALS':
                  triggered = isNumeric ? numVal !== numCond : String(value).toUpperCase() !== String(condVal).toUpperCase();
                  break;
                case 'GREATER_THAN':
                  triggered = isNumeric ? numVal > numCond : String(value) > String(condVal);
                  break;
                case 'LESS_THAN':
                  triggered = isNumeric ? numVal < numCond : String(value) < String(condVal);
                  break;
                case 'CONTAINS':
                  triggered = String(value).toLowerCase().includes(String(condVal).toLowerCase());
                  break;
              }

              if (triggered) {
                const allowed = rule.actionType !== 'BLOCK_ASSIGNMENT';
                const actionText = rule.actionType === 'REQUIRE_APPROVAL' ? 'onay gerektirir' :
                                   rule.actionType === 'BLOCK_ASSIGNMENT' ? 'engellendi' :
                                   rule.actionType === 'TRIGGER_ALERT' ? 'uyarı' : 'önceliklendirildi';
                return {
                  triggered: true,
                  allowed,
                  reason: `Kural '${rule.name}' tetiklendi: ${rule.conditionField} (${value}) ${rule.operator} ${rule.conditionValue}. Aksiyon: ${actionText} (${rule.actionValue || ''})`
                };
              }
            }
          }
          break;
      }
    } catch (e) {
      console.error('Kural değerlendirme hatası:', e);
    }

    return { triggered: false, allowed: true };
  }

  validateRule(rule: Partial<Rule>): void {
    if (rule.name !== undefined) {
      if (!rule.name || rule.name.trim().length === 0) throw new Error('Kural adı sadece boşluklardan oluşamaz.');
      if (rule.name.length > 70) throw new Error('Kural adı en fazla 70 karakter olabilir.');
    }
    if (rule.description !== undefined) {
      if (!rule.description || rule.description.trim().length === 0) throw new Error('Kural açıklaması sadece boşluklardan oluşamaz.');
      if (rule.description.length > 250) throw new Error('Kural açıklaması en fazla 250 karakter olabilir.');
    }
    if (rule.conditionField !== undefined) {
      if (!rule.conditionField || rule.conditionField.trim().length === 0) throw new Error('Koşul alanı boşluk olamaz.');
      if (rule.conditionField.length > 60) throw new Error('Koşul alanı en fazla 60 karakter olabilir.');
    }
    if (rule.conditionValue !== undefined) {
      if (rule.conditionValue && rule.conditionValue.length > 100) throw new Error('Koşul değeri en fazla 100 karakter olabilir.');
    }
    if (rule.actionValue !== undefined) {
      if (rule.actionValue && rule.actionValue.length > 250) throw new Error('Aksiyon değeri en fazla 250 karakter olabilir.');
    }
    if (rule.priority !== undefined) {
      const p = Number(rule.priority);
      if (isNaN(p) || p < 1 || p > 999) throw new Error('Öncelik değeri 1 ile 999 arasında olmalıdır.');
    }
  }

  isRuleNameUnique(name: string, id?: string): boolean {
    const list = this.storage.getCollection<Rule>(STORAGE_KEYS.RULES);
    return !list.some(r => r.name.toLowerCase() === name.toLowerCase() && r.id !== id);
  }

  getRules(): Rule[] {
    this.permissionService.assertPermission('RULE_MANAGE');
    return this.storage.getCollection<Rule>(STORAGE_KEYS.RULES);
  }

  getRuleById(id: string): Rule | null {
    this.permissionService.assertPermission('RULE_MANAGE');
    return this.storage.getById<Rule>(STORAGE_KEYS.RULES, id);
  }

  createRule(rule: Omit<Rule, 'id' | 'createdAt'>): Rule {
    this.permissionService.assertPermission('RULE_MANAGE');
    this.validateRule(rule);

    if (!this.isRuleNameUnique(rule.name)) {
      throw new Error('Bu kural adı zaten kullanılıyor.');
    }

    const newRule: Rule = {
      ...rule,
      id: `rule-custom-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<Rule>(STORAGE_KEYS.RULES, newRule);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'RULE',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni kural oluşturuldu: ${created.name}`
    });

    return created;
  }

  updateRule(id: string, rule: Partial<Rule>): Rule {
    this.permissionService.assertPermission('RULE_MANAGE');
    this.validateRule(rule);

    const oldRule = this.storage.getById<Rule>(STORAGE_KEYS.RULES, id);
    if (!oldRule) throw new Error('Güncellenecek kural bulunamadı.');

    if (rule.name && !this.isRuleNameUnique(rule.name, id)) {
      throw new Error('Bu kural adı zaten kullanılıyor.');
    }

    const updated = this.storage.update<Rule>(STORAGE_KEYS.RULES, id, rule);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'RULE',
      entityId: id,
      oldValue: JSON.stringify(oldRule),
      newValue: JSON.stringify(updated),
      description: `Kural güncellendi: ${updated.name}`
    });

    return updated;
  }

  toggleRuleStatus(id: string): Rule {
    this.permissionService.assertPermission('RULE_MANAGE');
    const oldRule = this.storage.getById<Rule>(STORAGE_KEYS.RULES, id);
    if (!oldRule) throw new Error('Kural bulunamadı.');

    const updated = this.storage.update<Rule>(STORAGE_KEYS.RULES, id, { isActive: !oldRule.isActive });

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'RULE',
      entityId: id,
      oldValue: JSON.stringify(oldRule),
      newValue: JSON.stringify(updated),
      description: `Kural durumu değiştirildi: ${oldRule.name} (${oldRule.isActive ? 'Aktif -> Pasif' : 'Pasif -> Aktif'})`
    });

    return updated;
  }

  deleteRule(id: string): boolean {
    this.permissionService.assertPermission('RULE_MANAGE');
    const oldRule = this.storage.getById<Rule>(STORAGE_KEYS.RULES, id);
    if (!oldRule) throw new Error('Kural bulunamadı.');

    const success = this.storage.delete(STORAGE_KEYS.RULES, id);

    if (success) {
      this.auditLog.logAction({
        actionType: 'DELETE',
        entityType: 'RULE',
        entityId: id,
        oldValue: JSON.stringify(oldRule),
        newValue: null,
        description: `Kural silindi: ${oldRule.name}`
      });
    }

    return success;
  }

  seedDefaultRules(): void {
    const list = this.storage.getCollection<Rule>(STORAGE_KEYS.RULES);
    if (list.length > 0) return;

    const defaultRules: Rule[] = [
      {
        id: 'rule-1',
        name: 'Kritik Talep Otomatik Önceliklendirme',
        description: 'Önceliği CRITICAL olan servis taleplerini otomatik en üst sıraya çeker.',
        trigger: 'SERVICE_REQUEST_CREATE',
        conditions: JSON.stringify({ priority: 'CRITICAL' }),
        actions: JSON.stringify({ action: 'AUTO_PRIORITIZE' }),
        priority: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-2',
        name: '50.000 TL Üzeri Harcama Onayı',
        description: 'Tahmini tutarı 50.000 TL üzerindeki iş emirleri için şube yöneticisi onayı gerektirir.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ estimatedCostGreaterThan: 50000 }),
        actions: JSON.stringify({ action: 'REQUIRE_APPROVAL' }),
        priority: 3,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-3',
        name: 'Minimum Stok Seviyesi Uyarısı',
        description: 'Stok miktarı minimum kritik seviyenin altına düşen parçalar için uyarı bildirimi üretir.',
        trigger: 'SYSTEM_EVENT',
        conditions: JSON.stringify({ availableStockLessThanMin: true }),
        actions: JSON.stringify({ action: 'TRIGGER_ALERT', type: 'LOW_STOCK' }),
        priority: 5,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-4',
        name: 'SLA Süresi Aşım Uyarısı',
        description: 'SLA deadline süresini geçen açık talepleri gecikmiş olarak işaretler.',
        trigger: 'SYSTEM_EVENT',
        conditions: JSON.stringify({ nowGreaterThanSlaDeadline: true }),
        actions: JSON.stringify({ action: 'TRIGGER_ALERT', type: 'SLA_OVERDUE' }),
        priority: 2,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-5',
        name: 'SLA < 2 Saat Kalan Alarmı',
        description: 'SLA deadline dolmasına 2 saatten az süre kalan işleri acil olarak işaretler.',
        trigger: 'SYSTEM_EVENT',
        conditions: JSON.stringify({ hoursToSlaDeadlineLessThan: 2 }),
        actions: JSON.stringify({ action: 'AUTO_PRIORITIZE', priority: 'CRITICAL' }),
        priority: 2,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-6',
        name: 'Bakımsız Araç Engeli',
        description: 'Son bakım tarihinin üzerinden 180 gün geçen araçların iş emirlerine atanmasını engeller.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ daysSinceMaintenanceGreaterThan: 180 }),
        actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
        priority: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-7',
        name: 'Düşük Yakıt Seviyesi Engeli',
        description: 'Yakıt seviyesi %30 altındaki araçların görevlendirilmesini engeller.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ fuelLevelLessThan: 30 }),
        actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
        priority: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-8',
        name: 'İzinli/Pasif Teknisyen Engeli',
        description: 'İzinli veya pasif durumda olan teknisyenlerin planlamaya dahil edilmesini engeller.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ isOnLeaveOrInactive: true }),
        actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
        priority: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-9',
        name: 'Şube Günlük Kapasite Sınırı',
        description: 'Günlük planlanan iş sayısı şube kapasite sınırını aşan durumlarda yeni atamaları engeller.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ branchCapacityFull: true }),
        actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
        priority: 4,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'rule-10',
        name: 'Garanti Dışı İşlerde Müşteri Onayı',
        description: 'Garanti kapsamı dışındaki işlerde müşteri onayı yoksa yedek parça kullanımını engeller.',
        trigger: 'WORK_ORDER_PLAN',
        conditions: JSON.stringify({ noWarrantyAndNoCustomerApproval: true }),
        actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
        priority: 3,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ];

    for (const rule of defaultRules) {
      this.storage.create<Rule>(STORAGE_KEYS.RULES, rule);
    }
  }
}
