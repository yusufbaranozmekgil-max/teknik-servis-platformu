import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { ServiceRequest } from '../models/service-request.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { SlaService } from './sla.service';

@Injectable({
  providedIn: 'root'
})
export class ServiceRequestService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private slaService = inject(SlaService);

  getServiceRequests(): ServiceRequest[] {
    this.permissionService.assertPermission('SERVICE_REQUEST_VIEW');
    return this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
  }

  getServiceRequestById(id: string): ServiceRequest | null {
    this.permissionService.assertPermission('SERVICE_REQUEST_VIEW');
    return this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, id);
  }

  private validateServiceRequest(request: Partial<ServiceRequest>): void {
    if (request.customerName !== undefined) {
      if (!request.customerName || request.customerName.trim().length === 0) throw new Error('Müşteri ismi sadece boşluklardan oluşamaz.');
      if (request.customerName.length > 50) throw new Error('Müşteri ismi en fazla 50 karakter olabilir.');
    }
    if (request.customerPhone !== undefined) {
      if (!request.customerPhone || request.customerPhone.trim().length === 0) throw new Error('Müşteri telefonu sadece boşluklardan oluşamaz.');
      if (request.customerPhone.length > 15) throw new Error('Müşteri telefonu en fazla 15 karakter olabilir.');
      const cleanPhone = request.customerPhone.replace(/\D/g, '');
      const phoneRegex = /^(0?5[0-9]{9})$/;
      if (!phoneRegex.test(cleanPhone)) throw new Error('Geçersiz telefon formatı (Örn: 05551234567).');
    }
    if (request.customerAddress !== undefined) {
      if (!request.customerAddress || request.customerAddress.trim().length === 0) throw new Error('Müşteri adresi sadece boşluklardan oluşamaz.');
      if (request.customerAddress.length > 200) throw new Error('Müşteri adresi en fazla 200 karakter olabilir.');
    }
    if (request.customerRegion !== undefined) {
      if (!request.customerRegion || request.customerRegion.trim().length === 0) throw new Error('Müşteri bölgesi sadece boşluklardan oluşamaz.');
      if (request.customerRegion.length > 60) throw new Error('Müşteri bölgesi en fazla 60 karakter olabilir.');
    }
    if (request.deviceBrandModel !== undefined) {
      if (!request.deviceBrandModel || request.deviceBrandModel.trim().length === 0) throw new Error('Cihaz marka/model sadece boşluklardan oluşamaz.');
      if (request.deviceBrandModel.length > 50) throw new Error('Cihaz marka/model en fazla 50 karakter olabilir.');
    }
    if (request.title !== undefined) {
      if (!request.title || request.title.trim().length === 0) throw new Error('Başlık sadece boşluklardan oluşamaz.');
      if (request.title.length > 100) throw new Error('Başlık en fazla 100 karakter olabilir.');
    }
    if (request.description !== undefined) {
      if (!request.description || request.description.trim().length === 0) throw new Error('Arıza açıklaması sadece boşluklardan oluşamaz.');
      if (request.description.length > 300) throw new Error('Arıza açıklaması en fazla 300 karakter olabilir.');
    }
    if (request.serviceCategory !== undefined) {
      if (request.serviceCategory.length > 50) throw new Error('Hizmet kategorisi en fazla 50 karakter olabilir.');
    }
  }

  createServiceRequest(request: Omit<ServiceRequest, 'id' | 'code' | 'slaDeadline' | 'createdAt'> & { code?: string }): ServiceRequest {
    this.permissionService.assertPermission('SERVICE_REQUEST_CREATE');
    this.validateServiceRequest(request);

    const requests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
    const generatedCode = `TALEP-${new Date().getFullYear()}-${(requests.length + 1).toString().padStart(4, '0')}`;
    const code = request.code || generatedCode;

    if (requests.some(r => r.code.toLowerCase() === code.toLowerCase())) {
      throw new Error('Bu talep kodu zaten kullanılıyor.');
    }

    const slaDeadline = this.slaService.calculateSlaDeadline(request.priority, request.requiredSkill);

    const newRequest: ServiceRequest = {
      ...request,
      id: `req-${Date.now()}`,
      code,
      slaDeadline,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, newRequest);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SERVICE_REQUEST',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni Servis Talebi oluşturuldu: ${created.title} (${created.code})`
    });

    return created;
  }

  updateServiceRequest(id: string, request: Partial<ServiceRequest>): ServiceRequest {
    this.permissionService.assertPermission('SERVICE_REQUEST_UPDATE');
    this.validateServiceRequest(request);
    const oldRequest = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, id);
    if (!oldRequest) throw new Error('Güncellenecek servis talebi bulunamadı.');

    if (request.code) {
      const requests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
      if (requests.some(r => r.code.toLowerCase() === request.code!.toLowerCase() && r.id !== id)) {
        throw new Error('Bu talep kodu zaten kullanılıyor.');
      }
    }

    if (request.priority && request.priority !== oldRequest.priority) {
      const category = request.requiredSkill ?? oldRequest.requiredSkill;
      request.slaDeadline = this.slaService.calculateSlaDeadline(request.priority, category, new Date(oldRequest.createdAt));
    }

    const updated = this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, id, request);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SERVICE_REQUEST',
      entityId: id,
      oldValue: JSON.stringify(oldRequest),
      newValue: JSON.stringify(updated),
      description: `Servis Talebi güncellendi: ${updated.title} (${updated.code})`
    });

    return updated;
  }

  deleteServiceRequest(id: string): boolean {
    this.permissionService.assertPermission('SERVICE_REQUEST_DELETE');
    const oldRequest = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, id);
    if (!oldRequest) throw new Error('Silinecek servis talebi bulunamadı.');

    const success = this.storage.delete(STORAGE_KEYS.SERVICE_REQUESTS, id);
    if (success) {
      this.auditLog.logAction({
        actionType: 'DELETE',
        entityType: 'SERVICE_REQUEST',
        entityId: id,
        oldValue: JSON.stringify(oldRequest),
        newValue: null,
        description: `Servis Talebi silindi: ${oldRequest.title} (${oldRequest.code})`
      });
    }

    return success;
  }
}
