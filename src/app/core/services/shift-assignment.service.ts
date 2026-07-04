import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { ShiftAssignment } from '../models/shift-assignment.model';
import { Technician } from '../models/technician.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { SchedulingService } from './scheduling.service';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class ShiftAssignmentService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private notificationService = inject(NotificationService);
  private scheduling = inject(SchedulingService);
  private authState = inject(AuthStateService);

  getAll(): ShiftAssignment[] {
    this.permissionService.assertPermission('SHIFT_VIEW');
    return this.storage.getCollection<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getById(id: string): ShiftAssignment | null {
    this.permissionService.assertPermission('SHIFT_VIEW');
    return this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, id);
  }

  /**
   * Yeni vardiya / görev kaydı oluşturur. Atama bu aşamada yapılmaz; ayrı bir adımdır.
   */
  create(input: Omit<ShiftAssignment, 'id' | 'code' | 'createdAt' | 'createdBy' | 'assignedTechnicianIds' | 'status'>): ShiftAssignment {
    this.permissionService.assertPermission('SHIFT_CREATE');
    this.validate(input);

    const list = this.storage.getCollection<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS);
    const code = `VRD-${new Date().getFullYear()}-${(list.length + 1).toString().padStart(4, '0')}`;

    const me = this.authState.currentUser();
    const newShift: ShiftAssignment = {
      ...input,
      id: `shift-${Date.now()}`,
      code,
      assignedTechnicianIds: [],
      status: 'PLANNED',
      createdBy: me?.id || null,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, newShift);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SYSTEM',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Vardiya / Görev oluşturuldu: ${created.code} - ${created.title}`
    });

    return created;
  }

  /**
   * Bir teknisyeni vardiyaya atar. Uyumluluk kuralları:
   *  1) Teknisyen aktif olmalı, izinli olmamalı.
   *  2) Yetkinlik (skill) uyuşmalı — yoksa reddedilir.
   *  3) Bölge / şube uyum (esnek): teknisyenin şubesi vardiya şubesi olmalı veya bölge eşleşmeli.
   *  4) Aynı zaman dilimine başka aktif iş emri ya da vardiya çakışmamalı.
   *  5) Aynı vardiyaya zaten atanmış olmamalı.
   *  6) Vardiyanın kişi sayısı (requiredHeadcount) aşılmamalı.
   */
  assignTechnician(shiftId: string, technicianId: string): ShiftAssignment {
    this.permissionService.assertPermission('SHIFT_ASSIGN');

    const shift = this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shiftId);
    if (!shift) throw new Error('Vardiya bulunamadı.');
    if (shift.status === 'CANCELLED' || shift.status === 'COMPLETED') {
      throw new Error('Tamamlanmış veya iptal edilmiş vardiyaya yeni atama yapılamaz.');
    }

    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) throw new Error('Teknisyen bulunamadı.');
    if (!tech.isActive) throw new Error(`${tech.fullName} aktif değil; vardiyaya atanamaz.`);
    if (tech.isOnLeave) throw new Error(`${tech.fullName} şu an izinli; vardiyaya atanamaz.`);

    if (shift.assignedTechnicianIds.includes(technicianId)) {
      throw new Error(`${tech.fullName} bu vardiyaya zaten atanmış.`);
    }
    if (shift.assignedTechnicianIds.length >= shift.requiredHeadcount) {
      throw new Error(`Vardiyanın gerektirdiği kişi sayısı (${shift.requiredHeadcount}) doldu.`);
    }

    if (!tech.skills?.includes(shift.requiredSkill)) {
      this.auditLog.logAction({
        actionType: 'SECURITY_VIOLATION',
        entityType: 'SYSTEM',
        entityId: shiftId,
        oldValue: null,
        newValue: null,
        description: `Yetkinlik uyumsuzluğu nedeniyle vardiya atama reddedildi: ${tech.fullName} → ${shift.code}`,
        result: 'FAILURE',
        failureReason: `Yetkinlik '${shift.requiredSkill}' teknisyende bulunmuyor.`
      });
      throw new Error(`Yetkinlik uyumsuzluğu: ${tech.fullName} '${shift.requiredSkill}' yetkinliğine sahip değil.`);
    }

    const sameBranch = tech.branchId === shift.branchId;
    const sameRegion = tech.region && shift.region && tech.region.toLowerCase() === shift.region.toLowerCase();
    if (!sameBranch && !sameRegion) {
      throw new Error(`Bölge uyumsuzluğu: ${tech.fullName} farklı şube ve farklı bölgede. Atama reddedildi.`);
    }

    const slot = { start: shift.start, end: shift.end };
    if (this.scheduling.technicianHasConflict(technicianId, slot)) {
      throw new Error(`${tech.fullName} aynı zaman diliminde başka bir iş emrine atanmış (çakışma).`);
    }
    if (this.technicianHasShiftConflict(technicianId, slot, shiftId)) {
      throw new Error(`${tech.fullName} aynı zaman diliminde başka bir vardiyaya atanmış (vardiya çakışması).`);
    }

    const oldShift = { ...shift, assignedTechnicianIds: [...shift.assignedTechnicianIds] };
    shift.assignedTechnicianIds = [...shift.assignedTechnicianIds, technicianId];
    const updated = this.storage.update<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shift.id, shift);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SYSTEM',
      entityId: shift.id,
      oldValue: JSON.stringify(oldShift),
      newValue: JSON.stringify(updated),
      description: `Teknisyen vardiyaya atandı: ${tech.fullName} → ${shift.code} (${shift.title})`
    });

    try {
      this.notificationService.createForUser(
        tech.id,
        'TECHNICIAN_ASSIGNED',
        'Yeni Vardiya / Görev',
        `${shift.code} (${shift.title}) vardiyasına atandınız. Başlangıç: ${new Date(shift.start).toLocaleString('tr-TR')}.`,
        'INFO',
        { type: 'SHIFT', id: shift.id, link: '/vardiyalar' }
      );
    } catch {
      // bildirim akışı hatası ana akışı bloklamasın
    }

    return updated;
  }

  removeTechnician(shiftId: string, technicianId: string): ShiftAssignment {
    this.permissionService.assertPermission('SHIFT_ASSIGN');
    const shift = this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shiftId);
    if (!shift) throw new Error('Vardiya bulunamadı.');
    if (!shift.assignedTechnicianIds.includes(technicianId)) {
      throw new Error('Bu teknisyen vardiyaya atanmamış.');
    }

    const oldShift = { ...shift, assignedTechnicianIds: [...shift.assignedTechnicianIds] };
    shift.assignedTechnicianIds = shift.assignedTechnicianIds.filter(id => id !== technicianId);
    const updated = this.storage.update<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shift.id, shift);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SYSTEM',
      entityId: shift.id,
      oldValue: JSON.stringify(oldShift),
      newValue: JSON.stringify(updated),
      description: `Teknisyen vardiyadan çıkarıldı: ${technicianId} → ${shift.code}`
    });
    return updated;
  }

  updateStatus(shiftId: string, status: ShiftAssignment['status']): ShiftAssignment {
    this.permissionService.assertPermission('SHIFT_ASSIGN');
    const shift = this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shiftId);
    if (!shift) throw new Error('Vardiya bulunamadı.');

    const oldShift = { ...shift };
    shift.status = status;
    const updated = this.storage.update<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shift.id, shift);

    this.auditLog.logAction({
      actionType: 'STATE_TRANSITION',
      entityType: 'SYSTEM',
      entityId: shift.id,
      oldValue: JSON.stringify(oldShift),
      newValue: JSON.stringify(updated),
      description: `Vardiya durumu güncellendi: ${shift.code} → ${status}`
    });

    return updated;
  }

  delete(id: string): void {
    this.permissionService.assertPermission('SHIFT_DELETE');
    const shift = this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, id);
    if (!shift) throw new Error('Vardiya bulunamadı.');

    this.storage.delete<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, id);

    this.auditLog.logAction({
      actionType: 'DELETE',
      entityType: 'SYSTEM',
      entityId: id,
      oldValue: JSON.stringify(shift),
      newValue: null,
      description: `Vardiya silindi: ${shift.code} - ${shift.title}`
    });
  }

  /**
   * Verilen vardiya için kurallara uygun (eligible) teknisyen listesini döndürür.
   * Şartname Bölüm 11: yetkinlik + bölge yakınlığı + müsaitlik + performans puanı kriterleri.
   * Uygun olanlar performans puanı azalan sırayla en üste alınır.
   */
  getEligibleTechnicians(shiftId: string): { technician: Technician; reason: string | null }[] {
    this.permissionService.assertPermission('SHIFT_VIEW');
    const shift = this.storage.getById<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shiftId);
    if (!shift) return [];

    const techs = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
    const evaluated = techs
      .filter(t => t.isActive && !t.isOnLeave)
      .map(t => {
        if (shift.assignedTechnicianIds.includes(t.id)) {
          return { technician: t, reason: 'Zaten atanmış' as string | null };
        }
        if (!t.skills?.includes(shift.requiredSkill)) {
          return { technician: t, reason: `'${shift.requiredSkill}' yetkinliği yok` as string | null };
        }
        const sameBranch = t.branchId === shift.branchId;
        const sameRegion = t.region && shift.region && t.region.toLowerCase() === shift.region.toLowerCase();
        if (!sameBranch && !sameRegion) {
          return { technician: t, reason: 'Bölge / şube dışı' as string | null };
        }
        const slot = { start: shift.start, end: shift.end };
        if (this.scheduling.technicianHasConflict(t.id, slot)) {
          return { technician: t, reason: 'İş emri çakışması' as string | null };
        }
        if (this.technicianHasShiftConflict(t.id, slot, shiftId)) {
          return { technician: t, reason: 'Vardiya çakışması' as string | null };
        }
        return { technician: t, reason: null as string | null };
      });

    // Uygun adaylar en üste, performans puanı azalan; ineligible olanlar altta.
    return evaluated.sort((a, b) => {
      if (!a.reason && b.reason) return -1;
      if (a.reason && !b.reason) return 1;
      return (b.technician.performanceScore || 0) - (a.technician.performanceScore || 0);
    });
  }

  /**
   * Bir teknisyenin belirli aralıkta başka bir vardiyaya atanmış olup olmadığını kontrol eder.
   */
  private technicianHasShiftConflict(technicianId: string, slot: { start: string; end: string }, excludeShiftId?: string): boolean {
    const all = this.storage.getCollection<ShiftAssignment>(STORAGE_KEYS.SHIFT_ASSIGNMENTS);
    return all.some(s => {
      if (s.id === excludeShiftId) return false;
      if (s.status === 'CANCELLED') return false;
      if (!s.assignedTechnicianIds.includes(technicianId)) return false;
      return this.scheduling.isOverlapping(slot, { start: s.start, end: s.end });
    });
  }

  private validate(input: Partial<ShiftAssignment>): void {
    if (!input.title || input.title.trim().length === 0) throw new Error('Vardiya başlığı boş olamaz.');
    if (input.title.length > 100) throw new Error('Vardiya başlığı en fazla 100 karakter olabilir.');
    if (!input.taskType) throw new Error('Görev tipi seçilmelidir.');
    if (!input.branchId) throw new Error('Şube / lokasyon seçilmelidir.');
    if (!input.region || input.region.trim().length === 0) throw new Error('Bölge boş olamaz.');
    if (input.region.length > 60) throw new Error('Bölge en fazla 60 karakter olabilir.');
    if (!input.requiredSkill) throw new Error('Gerekli yetkinlik seçilmelidir.');
    if (!input.requiredHeadcount || input.requiredHeadcount < 1 || input.requiredHeadcount > 50) {
      throw new Error('Kişi sayısı 1 ile 50 arasında olmalıdır.');
    }
    if (!input.start || !input.end) throw new Error('Başlangıç ve bitiş zamanı zorunludur.');
    const startMs = new Date(input.start).getTime();
    const endMs = new Date(input.end).getTime();
    if (isNaN(startMs) || isNaN(endMs)) throw new Error('Geçersiz tarih / saat.');
    if (endMs <= startMs) throw new Error('Bitiş zamanı başlangıçtan sonra olmalıdır.');
    if (endMs - startMs > 30 * 24 * 60 * 60 * 1000) {
      throw new Error('Vardiya en fazla 30 gün sürebilir.');
    }
    if (!input.priority) throw new Error('Öncelik seçilmelidir.');
    if (input.description && input.description.length > 300) {
      throw new Error('Açıklama en fazla 300 karakter olabilir.');
    }
    if (input.notes && input.notes.length > 300) {
      throw new Error('Notlar en fazla 300 karakter olabilir.');
    }
  }
}
