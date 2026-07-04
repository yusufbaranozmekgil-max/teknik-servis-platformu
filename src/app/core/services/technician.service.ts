import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Technician } from '../models/technician.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class TechnicianService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private authState = inject(AuthStateService);

  getTechnicians(): Technician[] {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    return this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
  }

  getTechnicianById(id: string): Technician | null {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    return this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, id);
  }

  private validateTechnician(tech: Partial<Technician>): void {
    if (tech.fullName !== undefined) {
      if (!tech.fullName || tech.fullName.trim().length === 0) throw new Error('Ad soyad sadece boşluklardan oluşamaz.');
      if (tech.fullName.length > 50) throw new Error('Ad soyad en fazla 50 karakter olabilir.');
    }
    if (tech.phone !== undefined) {
      if (!tech.phone || tech.phone.trim().length === 0) throw new Error('Telefon numarası sadece boşluklardan oluşamaz.');
      if (tech.phone.length > 15) throw new Error('Telefon numarası en fazla 15 karakter olabilir.');
      const cleanPhone = tech.phone.replace(/\D/g, '');
      const phoneRegex = /^(0?5[0-9]{9})$/;
      if (!phoneRegex.test(cleanPhone)) throw new Error('Geçersiz telefon formatı (Örn: 05551234567).');
    }
    if (tech.email !== undefined) {
      if (!tech.email || tech.email.trim().length === 0) throw new Error('E-posta sadece boşluklardan oluşamaz.');
      if (tech.email.length > 80) throw new Error('E-posta en fazla 80 karakter olabilir.');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(tech.email)) throw new Error('Geçersiz e-posta adresi.');
    }
    if (tech.region !== undefined) {
      if (!tech.region || tech.region.trim().length === 0) throw new Error('Bölge kodu sadece boşluklardan oluşamaz.');
      if (tech.region.length > 20) throw new Error('Bölge kodu en fazla 20 karakter olabilir.');
    }
    if (tech.completedJobsCount !== undefined && tech.completedJobsCount !== null) {
      const val = Number(tech.completedJobsCount);
      if (isNaN(val) || val < 0 || val > 10000) throw new Error('Tamamlanan iş sayısı 0 ile 10000 arasında olmalıdır.');
    }
    if (tech.performanceScore !== undefined && tech.performanceScore !== null) {
      const val = Number(tech.performanceScore);
      if (isNaN(val) || val < 0 || val > 100) throw new Error('Performans skoru 0 ile 100 arasında olmalıdır.');
    }
    if ((tech as any).dailyCapacity !== undefined && (tech as any).dailyCapacity !== null) {
      const val = Number((tech as any).dailyCapacity);
      if (isNaN(val) || val < 1 || val > 12) throw new Error('Günlük kapasite 1 ile 12 arasında olmalıdır.');
    }
    if ((tech as any).skillLevels !== undefined && (tech as any).skillLevels !== null) {
      const validLevels = new Set(['BEGINNER', 'INTERMEDIATE', 'EXPERT']);
      const entries = Object.entries((tech as any).skillLevels);
      for (const [_, lvl] of entries) {
        if (!validLevels.has(String(lvl))) {
          throw new Error('Yetkinlik seviyesi yalnızca Başlangıç, Orta veya Uzman olabilir.');
        }
      }
    }
    if (tech.isOnLeave) {
      if (!tech.leaveStart) throw new Error('İzin başlangıç tarihi zorunludur.');
      if (!tech.leaveEnd) throw new Error('İzin bitiş tarihi zorunludur.');
      const start = new Date(tech.leaveStart).getTime();
      const end = new Date(tech.leaveEnd).getTime();
      if (isNaN(start) || isNaN(end)) throw new Error('Geçersiz izin tarihleri.');
      if (end <= start) throw new Error('İzin bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
    }
  }

  createTechnician(tech: Omit<Technician, 'id' | 'createdAt'>): Technician {
    this.permissionService.assertPermission('TECHNICIAN_CREATE');
    this.validateTechnician(tech);

    const techs = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
    if (techs.some(t => t.phone === tech.phone)) {
      throw new Error('Bu telefon numarası zaten kayıtlı.');
    }
    if (techs.some(t => t.email.toLowerCase() === tech.email.toLowerCase())) {
      throw new Error('Bu e-posta zaten kullanılıyor.');
    }

    const newTech: Technician = {
      ...tech,
      id: `tech-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<Technician>(STORAGE_KEYS.TECHNICIANS, newTech);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'TECHNICIAN',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni Teknisyen oluşturuldu: ${created.fullName}`
    });

    return created;
  }

  updateTechnician(id: string, tech: Partial<Technician>): Technician {
    this.permissionService.assertPermission('TECHNICIAN_UPDATE');
    this.validateTechnician(tech);
    const oldTech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, id);
    if (!oldTech) throw new Error('Güncellenecek teknisyen bulunamadı.');

    const techs = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
    if (tech.phone) {
      if (techs.some(t => t.phone === tech.phone && t.id !== id)) {
        throw new Error('Bu telefon numarası zaten kayıtlı.');
      }
    }
    if (tech.email) {
      if (techs.some(t => t.email.toLowerCase() === tech.email!.toLowerCase() && t.id !== id)) {
        throw new Error('Bu e-posta zaten kullanılıyor.');
      }
    }

    const updated = this.storage.update<Technician>(STORAGE_KEYS.TECHNICIANS, id, tech);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'TECHNICIAN',
      entityId: id,
      oldValue: JSON.stringify(oldTech),
      newValue: JSON.stringify(updated),
      description: `Teknisyen güncellendi: ${updated.fullName}`
    });

    return updated;
  }

  deleteTechnician(id: string, forceDelete = false): boolean {
    this.permissionService.assertPermission('TECHNICIAN_DELETE');
    const oldTech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, id);
    if (!oldTech) throw new Error('Silinecek teknisyen bulunamadı.');

    const isAdmin = this.authState.currentRole() === 'SYSTEM_ADMIN';

    if (forceDelete && isAdmin) {
      const success = this.storage.delete(STORAGE_KEYS.TECHNICIANS, id);
      if (success) {
        this.auditLog.logAction({
          actionType: 'DELETE',
          entityType: 'TECHNICIAN',
          entityId: id,
          oldValue: JSON.stringify(oldTech),
          newValue: null,
          description: `Teknisyen silindi: ${oldTech.fullName}`
        });
      }
      return success;
    } else {
      // Soft delete -> deactivation
      const updated = { ...oldTech, isActive: false };
      this.storage.update<Technician>(STORAGE_KEYS.TECHNICIANS, id, updated);
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'TECHNICIAN',
        entityId: id,
        oldValue: JSON.stringify(oldTech),
        newValue: JSON.stringify(updated),
        description: 'Record deactivated'
      });
      return true;
    }
  }
}
