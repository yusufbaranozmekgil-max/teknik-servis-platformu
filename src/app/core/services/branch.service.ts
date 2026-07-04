import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Branch } from '../models/branch.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private authState = inject(AuthStateService);

  getBranches(): Branch[] {
    this.permissionService.assertPermission('BRANCH_VIEW');
    return this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
  }

  getBranchById(id: string): Branch | null {
    this.permissionService.assertPermission('BRANCH_VIEW');
    return this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, id);
  }

  private validateBranch(branch: Partial<Branch>): void {
    if (branch.code !== undefined) {
      if (!branch.code || branch.code.trim().length === 0) throw new Error('Şube kodu sadece boşluklardan oluşamaz.');
      if (branch.code.length > 20) throw new Error('Şube kodu en fazla 20 karakter olabilir.');
    }
    if (branch.name !== undefined) {
      if (!branch.name || branch.name.trim().length === 0) throw new Error('Şube adı sadece boşluklardan oluşamaz.');
      if (branch.name.length > 50) throw new Error('Şube adı en fazla 50 karakter olabilir.');
    }
    if (branch.city !== undefined) {
      if (!branch.city || branch.city.trim().length === 0) throw new Error('Şehir sadece boşluklardan oluşamaz.');
      if (branch.city.length > 30) throw new Error('Şehir en fazla 30 karakter olabilir.');
    }
    if (branch.district !== undefined) {
      if (!branch.district || branch.district.trim().length === 0) throw new Error('İlçe sadece boşluklardan oluşamaz.');
      if (branch.district.length > 30) throw new Error('İlçe en fazla 30 karakter olabilir.');
    }
    if (branch.contactPerson !== undefined) {
      if (!branch.contactPerson || branch.contactPerson.trim().length === 0) throw new Error('Sorumlu kişi sadece boşluklardan oluşamaz.');
      if (branch.contactPerson.length > 50) throw new Error('Sorumlu kişi en fazla 50 karakter olabilir.');
    }
    if (branch.dailyCapacity !== undefined) {
      const cap = Number(branch.dailyCapacity);
      if (isNaN(cap) || cap < 1 || cap > 10) throw new Error('Günlük kapasite 1 ile 10 arasında olmalıdır.');
    }
    if ((branch as any).workingHoursStart !== undefined || (branch as any).workingHoursEnd !== undefined) {
      const re = /^([01]\d|2[0-3]):[0-5]\d$/;
      const s = (branch as any).workingHoursStart;
      const e = (branch as any).workingHoursEnd;
      if (s !== undefined && !re.test(String(s))) throw new Error('Mesai başlangıç saati geçerli HH:mm formatında olmalıdır.');
      if (e !== undefined && !re.test(String(e))) throw new Error('Mesai bitiş saati geçerli HH:mm formatında olmalıdır.');
      if (s && e) {
        const [sh, sm] = String(s).split(':').map(Number);
        const [eh, em] = String(e).split(':').map(Number);
        if ((eh * 60 + em) <= (sh * 60 + sm)) {
          throw new Error('Mesai bitişi başlangıç saatinden sonra olmalıdır.');
        }
      }
    }
    if ((branch as any).serviceAreas !== undefined && Array.isArray((branch as any).serviceAreas)) {
      const list: string[] = (branch as any).serviceAreas;
      if (list.length > 20) throw new Error('En fazla 20 hizmet bölgesi ekleyebilirsiniz.');
      const seen = new Set<string>();
      for (const a of list) {
        const v = String(a || '').trim();
        if (!v) throw new Error('Boş bölge eklenemez.');
        if (v.length > 50) throw new Error('Bölge adı en fazla 50 karakter olabilir.');
        const k = v.toLowerCase();
        if (seen.has(k)) throw new Error('Aynı bölge tekrar eklenemez.');
        seen.add(k);
      }
    }
    if (branch.latitude !== undefined && branch.latitude !== null) {
      const lat = Number(branch.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) throw new Error('Enlem -90 ile 90 arasında olmalıdır.');
    }
    if (branch.longitude !== undefined && branch.longitude !== null) {
      const lng = Number(branch.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) throw new Error('Boylam -180 ile 180 arasında olmalıdır.');
    }
  }

  createBranch(branch: Omit<Branch, 'id' | 'createdAt'>): Branch {
    this.permissionService.assertPermission('BRANCH_CREATE');
    this.validateBranch(branch);
    
    const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
    if (branches.some(b => b.code.toLowerCase() === branch.code.toLowerCase())) {
      throw new Error('Bu şube kodu zaten kullanılıyor.');
    }

    const newBranch: Branch = {
      ...branch,
      id: `branch-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<Branch>(STORAGE_KEYS.BRANCHES, newBranch);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'BRANCH',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni şube oluşturuldu: ${created.name} (${created.code})`
    });

    return created;
  }

  updateBranch(id: string, branch: Partial<Branch>): Branch {
    this.permissionService.assertPermission('BRANCH_UPDATE');
    this.validateBranch(branch);
    const oldBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, id);
    if (!oldBranch) throw new Error('Güncellenecek şube bulunamadı.');

    if (branch.code) {
      const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
      if (branches.some(b => b.code.toLowerCase() === branch.code!.toLowerCase() && b.id !== id)) {
        throw new Error('Bu şube kodu zaten kullanılıyor.');
      }
    }

    const updated = this.storage.update<Branch>(STORAGE_KEYS.BRANCHES, id, branch);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'BRANCH',
      entityId: id,
      oldValue: JSON.stringify(oldBranch),
      newValue: JSON.stringify(updated),
      description: `Şube güncellendi: ${updated.name} (${updated.code})`
    });

    return updated;
  }

  deleteBranch(id: string, forceDelete = false): boolean {
    this.permissionService.assertPermission('BRANCH_DELETE');
    const oldBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, id);
    if (!oldBranch) throw new Error('Silinecek şube bulunamadı.');

    const isAdmin = this.authState.currentRole() === 'SYSTEM_ADMIN';

    if (forceDelete && isAdmin) {
      const success = this.storage.delete(STORAGE_KEYS.BRANCHES, id);
      if (success) {
        this.auditLog.logAction({
          actionType: 'DELETE',
          entityType: 'BRANCH',
          entityId: id,
          oldValue: JSON.stringify(oldBranch),
          newValue: null,
          description: `Şube silindi: ${oldBranch.name} (${oldBranch.code})`
        });
      }
      return success;
    } else {
      // Soft delete -> deactivation
      const updated = { ...oldBranch, isActive: false };
      this.storage.update<Branch>(STORAGE_KEYS.BRANCHES, id, updated);
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'BRANCH',
        entityId: id,
        oldValue: JSON.stringify(oldBranch),
        newValue: JSON.stringify(updated),
        description: 'Şube pasif duruma alındı.'
      });
      return true;
    }
  }
}
