import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { AuditLog } from '../models/audit-log.model';
import { UserRole } from '../models/user-role.model';
import { AuthStateService } from '../auth/auth-state.service';
import { computeDiff, prettyJson, DiffEntry } from '../utils/diff.util';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private storage = inject(StorageService);
  private authState = inject(AuthStateService);

  // Oturum başına bir kez üretilir, böylece bir kullanıcının aynı oturumdaki
  // tüm aksiyonları aynı IP'den gelmiş gibi görünür (gerçek dünyaya yakın simülasyon).
  private sessionIp: string = this.generateSimulatedIp();

  private generateSimulatedIp(): string {
    // 10.x.x.x ve 192.168.x.x özel ağ blokları arasında değişken — gerçekçi görünür.
    const blocks: Array<() => string> = [
      () => `192.168.${rand(0, 255)}.${rand(1, 254)}`,
      () => `10.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`,
      () => `172.${rand(16, 31)}.${rand(0, 255)}.${rand(1, 254)}`
    ];
    function rand(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    const pickBlock = blocks[Math.floor(Math.random() * blocks.length)];
    return pickBlock();
  }

  getLogs(): AuditLog[] {
    const list = this.storage.getCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getLogsByEntity(entityType: string, entityId: string): AuditLog[] {
    const list = this.storage.getCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    return list
      .filter(l => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  logAction(action: Omit<AuditLog, 'id' | 'createdAt' | 'simulatedIp' | 'userId' | 'username' | 'userRole'>): void {
    const logs = this.storage.getCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    const sessionInfo = this.getCurrentSession();

    const newLog: AuditLog = {
      ...action,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId: sessionInfo.userId,
      username: sessionInfo.username,
      userRole: sessionInfo.userRole,
      simulatedIp: this.sessionIp,
      createdAt: new Date().toISOString(),
      result: action.result || 'SUCCESS',
      failureReason: action.failureReason || null
    };

    logs.push(newLog);
    this.storage.setCollection(STORAGE_KEYS.AUDIT_LOGS, logs);
    console.log(`[AuditLog] ${newLog.description}`);
  }

  logSuccess(
    userId: string,
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATE_TRANSITION' | 'SECURITY_VIOLATION' | 'SYSTEM_EVENT' | 'IMPORT',
    entityType: 'BRANCH' | 'TECHNICIAN' | 'SPARE_PART' | 'SERVICE_REQUEST' | 'WORK_ORDER' | 'VEHICLE' | 'RULE' | 'SYSTEM',
    entityId: string,
    oldValue: string | null,
    newValue: string | null,
    description: string
  ): void {
    this.logAction({
      actionType,
      entityType,
      entityId,
      oldValue,
      newValue,
      description,
      result: 'SUCCESS',
      failureReason: null
    });
  }

  logFailure(
    userId: string,
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATE_TRANSITION' | 'SECURITY_VIOLATION' | 'SYSTEM_EVENT' | 'IMPORT',
    entityType: 'BRANCH' | 'TECHNICIAN' | 'SPARE_PART' | 'SERVICE_REQUEST' | 'WORK_ORDER' | 'VEHICLE' | 'RULE' | 'SYSTEM',
    entityId: string,
    oldValue: string | null,
    description: string,
    failureReason: string
  ): void {
    this.logAction({
      actionType,
      entityType,
      entityId,
      oldValue,
      newValue: null,
      description,
      result: 'FAILURE',
      failureReason
    });
  }

  logUnauthorized(userId: string, actionType: any, entityType: any, description: string): void {
    this.logAction({
      actionType: 'SECURITY_VIOLATION',
      entityType,
      entityId: 'unauthorized',
      oldValue: null,
      newValue: null,
      description: `YETKİSİZ ERİŞİM DENEMESİ: ${description}`,
      result: 'FAILURE',
      failureReason: 'Yetersiz Rol / Yetki Sınırı Aşıldı'
    });
  }

  logInvalidTransition(userId: string, entityId: string, currentStatus: string, nextStatus: string): void {
    this.logAction({
      actionType: 'STATE_TRANSITION',
      entityType: 'WORK_ORDER',
      entityId,
      oldValue: currentStatus,
      newValue: nextStatus,
      description: `GEÇERSİZ DURUM GEÇİŞ DENEMESİ: ${currentStatus} -> ${nextStatus}`,
      result: 'FAILURE',
      failureReason: 'Durum makinesi geçiş matrisi kurallarına aykırı'
    });
  }

  logRuleConflict(ruleAId: string, ruleBId: string, resolvedWinnerId: string): void {
    this.logAction({
      actionType: 'SYSTEM_EVENT',
      entityType: 'RULE',
      entityId: resolvedWinnerId,
      oldValue: `Çakışan: ${ruleAId} & ${ruleBId}`,
      newValue: `Kazanan: ${resolvedWinnerId}`,
      description: `Kural çakışması deterministik olarak çözüldü. Kazanan: ${resolvedWinnerId}`,
      result: 'SUCCESS',
      failureReason: null
    });
  }

  logImport(userId: string, filename: string, status: 'SUCCESS' | 'FAILURE', details: string): void {
    this.logAction({
      actionType: 'IMPORT',
      entityType: 'SYSTEM',
      entityId: 'import-export',
      oldValue: null,
      newValue: details,
      description: `Dosya İçe Aktarıldı (${filename}). Durum: ${status}`,
      result: status,
      failureReason: status === 'FAILURE' ? details : null
    });
  }

  // Diff hesabı core/utils/diff.util.ts içinde merkezi olarak yapılır.
  getDiff(oldVal: string | null, newVal: string | null): DiffEntry[] {
    return computeDiff(oldVal, newVal);
  }

  parsePrettyJson(val: string | null): string {
    return prettyJson(val);
  }

  stringifyValue(val: any): string {
    if (val === null || val === undefined) return 'Boş / Belirtilmedi';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  private getCurrentSession(): { userId: string; username: string; userRole: UserRole } {
    const u = this.authState.currentUser();
    if (!u) return { userId: 'system', username: 'system', userRole: 'SYSTEM_ADMIN' };
    return {
      userId: u.id || 'system',
      username: u.username || 'system',
      userRole: u.role || 'SYSTEM_ADMIN'
    };
  }
}
