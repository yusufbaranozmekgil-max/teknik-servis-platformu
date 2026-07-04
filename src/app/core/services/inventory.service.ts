import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { SparePart } from '../models/spare-part.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private authState = inject(AuthStateService);

  getSpareParts(): SparePart[] {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    return this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
  }

  getSparePartById(id: string): SparePart | null {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    return this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, id);
  }

  getAvailableQuantity(partId: string): number {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId);
    if (!part) return 0;
    return part.stockQuantity - part.reservedQuantity;
  }

  private validateSparePart(part: Partial<SparePart>): void {
    if (part.code !== undefined) {
      if (!part.code || part.code.trim().length === 0) throw new Error('Parça kodu sadece boşluklardan oluşamaz.');
      if (part.code.length > 20) throw new Error('Parça kodu en fazla 20 karakter olabilir.');
    }
    if (part.name !== undefined) {
      if (!part.name || part.name.trim().length === 0) throw new Error('Parça adı sadece boşluklardan oluşamaz.');
      if (part.name.length > 70) throw new Error('Parça adı en fazla 70 karakter olabilir.');
    }
    if (part.category !== undefined) {
      if (!part.category || part.category.trim().length === 0) throw new Error('Kategori sadece boşluklardan oluşamaz.');
      if (part.category.length > 50) throw new Error('Kategori en fazla 50 karakter olabilir.');
    }
    if (part.compatibleDevices !== undefined && part.compatibleDevices !== null) {
      if (part.compatibleDevices.length > 70) throw new Error('Uyumlu cihazlar en fazla 70 karakter olabilir.');
    }
    if (part.unit !== undefined) {
      if (!part.unit || part.unit.trim().length === 0) throw new Error('Birim sadece boşluklardan oluşamaz.');
      if (part.unit.length > 10) throw new Error('Birim en fazla 10 karakter olabilir.');
    }
    if (part.stockQuantity !== undefined) {
      const sq = Number(part.stockQuantity);
      if (isNaN(sq) || sq < 0 || sq > 100000) throw new Error('Stok miktarı 0 ile 100000 arasında olmalıdır.');
    }
    if (part.minStockThreshold !== undefined) {
      const mst = Number(part.minStockThreshold);
      if (isNaN(mst) || mst < 0 || mst > 100000) throw new Error('Minimum stok seviyesi 0 ile 100000 arasında olmalıdır.');
    }
    if (part.unitPrice !== undefined) {
      const up = Number(part.unitPrice);
      if (isNaN(up) || up < 0 || up > 1000000) throw new Error('Birim fiyatı 0 ile 1000000 arasında olmalıdır.');
    }
    if (part.reservedQuantity !== undefined && part.stockQuantity !== undefined) {
      if (part.reservedQuantity > part.stockQuantity) {
        throw new Error('Rezerve miktarı fiziksel stok miktarını aşamaz.');
      }
    }
  }

  createSparePart(part: Omit<SparePart, 'id' | 'reservedQuantity' | 'createdAt'>): SparePart {
    this.permissionService.assertPermission('INVENTORY_CREATE');
    this.validateSparePart(part);
    
    const parts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
    if (parts.some(p => p.code.toLowerCase() === part.code.toLowerCase())) {
      throw new Error('Bu parça kodu zaten kullanılıyor.');
    }

    const newPart: SparePart = {
      ...part,
      id: `part-${Date.now()}`,
      reservedQuantity: 0,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<SparePart>(STORAGE_KEYS.SPARE_PARTS, newPart);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SPARE_PART',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni Yedek Parça oluşturuldu: ${created.name} (${created.code})`
    });

    return created;
  }

  updateSparePart(id: string, part: Partial<SparePart>): SparePart {
    this.permissionService.assertPermission('INVENTORY_UPDATE');
    // For reservation updates or partial saves, we merge with old values for cross-field check:
    const oldPart = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, id);
    if (!oldPart) throw new Error('Güncellenecek parça bulunamadı.');

    const merged = { ...oldPart, ...part };
    this.validateSparePart(merged);

    if (part.code) {
      const parts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
      if (parts.some(p => p.code.toLowerCase() === part.code!.toLowerCase() && p.id !== id)) {
        throw new Error('Bu parça kodu zaten kullanılıyor.');
      }
    }

    const updated = this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, id, part);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SPARE_PART',
      entityId: id,
      oldValue: JSON.stringify(oldPart),
      newValue: JSON.stringify(updated),
      description: `Yedek Parça güncellendi: ${updated.name} (${updated.code})`
    });

    return updated;
  }

  deleteSparePart(id: string, forceDelete = false): boolean {
    this.permissionService.assertPermission('INVENTORY_DELETE');
    const oldPart = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, id);
    if (!oldPart) throw new Error('Silinecek parça bulunamadı.');

    const isAdmin = this.authState.currentRole() === 'SYSTEM_ADMIN';

    if (forceDelete && isAdmin) {
      const success = this.storage.delete(STORAGE_KEYS.SPARE_PARTS, id);
      if (success) {
        this.auditLog.logAction({
          actionType: 'DELETE',
          entityType: 'SPARE_PART',
          entityId: id,
          oldValue: JSON.stringify(oldPart),
          newValue: null,
          description: `Yedek Parça silindi: ${oldPart.name} (${oldPart.code})`
        });
      }
      return success;
    } else {
      // Soft delete -> deactivation
      const updated = { ...oldPart, isActive: false };
      this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, id, updated);
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'SPARE_PART',
        entityId: id,
        oldValue: JSON.stringify(oldPart),
        newValue: JSON.stringify(updated),
        description: 'Record deactivated'
      });
      return true;
    }
  }
}
