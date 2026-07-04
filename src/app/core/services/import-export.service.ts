import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { Branch } from '../models/branch.model';
import { Technician } from '../models/technician.model';
import { SparePart } from '../models/spare-part.model';
import { Vehicle } from '../models/vehicle.model';
import { Customer } from '../models/customer.model';
import { ServiceRequest } from '../models/service-request.model';

export interface ImportFailedRecord {
  rowIndex: number;
  data: any;
  errors: string[];
}

export interface ImportResult {
  total: number;
  successCount: number;
  failedCount: number;
  importedRecords: any[];
  failedRecords: ImportFailedRecord[];
}

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private storage = inject(StorageService);
  private auditLog = inject(AuditLogService);
  private notification = inject(NotificationService);
  private permission = inject(PermissionService);

  exportToJson(collectionKey: string): string {
    this.permission.assertPermission('EXPORT_EXECUTE');
    const data = this.storage.getCollection<any>(collectionKey);
    return JSON.stringify(data, null, 2);
  }

  exportToCsv(collectionKey: string): string {
    this.permission.assertPermission('EXPORT_EXECUTE');
    const data = this.storage.getCollection<any>(collectionKey);
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const val = row[header];
          const stringified = val === null || val === undefined ? '' : String(val);
          return `"${stringified.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  parseJsonFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else {
            resolve([parsed]);
          }
        } catch (err) {
          reject(new Error('Dosya geçerli bir JSON formatında değil.'));
        }
      };
      reader.onerror = () => reject(new Error('Dosya okuma hatası.'));
      reader.readAsText(file);
    });
  }

  validateImportedRecord(record: any, entityType: string, tempImportedList?: any[]): string[] {
    const errors: string[] = [];

    if (!record || typeof record !== 'object') {
      return ['Kayıt geçersiz bir objedir.'];
    }

    // Common validations depending on entityType
    switch (entityType) {
      case 'BRANCH':
        if (!record.code) errors.push('Şube kodu (code) zorunludur.');
        if (record.code && record.code.length > 20) errors.push('Şube kodu en fazla 20 karakter olabilir.');
        if (record.code && record.code.trim().length === 0) errors.push('Şube kodu sadece boşluklardan oluşamaz.');
        
        if (!record.name) errors.push('Şube adı (name) zorunludur.');
        if (record.name && record.name.length > 50) errors.push('Şube adı en fazla 50 karakter olabilir.');
        if (record.name && record.name.trim().length === 0) errors.push('Şube adı sadece boşluklardan oluşamaz.');
        
        if (!record.city) errors.push('Şehir (city) zorunludur.');
        if (record.city && record.city.length > 30) errors.push('Şehir en fazla 30 karakter olabilir.');
        if (record.city && record.city.trim().length === 0) errors.push('Şehir sadece boşluklardan oluşamaz.');
        
        if (!record.district) errors.push('İlçe (district) zorunludur.');
        if (record.district && record.district.length > 30) errors.push('İlçe en fazla 30 karakter olabilir.');
        if (record.district && record.district.trim().length === 0) errors.push('İlçe sadece boşluklardan oluşamaz.');
        
        if (record.contactPerson && record.contactPerson.length > 50) errors.push('Sorumlu kişi en fazla 50 karakter olabilir.');
        if (record.contactPerson && record.contactPerson.trim().length === 0) errors.push('Sorumlu kişi sadece boşluklardan oluşamaz.');
        
        if (record.dailyCapacity === undefined || isNaN(Number(record.dailyCapacity))) {
          errors.push('Günlük kapasite (dailyCapacity) sayısal bir değer olmalıdır.');
        } else {
          const cap = Number(record.dailyCapacity);
          if (cap < 1 || cap > 100) errors.push('Günlük kapasite 1 ile 100 arasında olmalıdır.');
        }
        if (record.latitude !== undefined && record.latitude !== null && !isNaN(Number(record.latitude))) {
          const lat = Number(record.latitude);
          if (lat < -90 || lat > 90) errors.push('Enlem -90 ile 90 arasında olmalıdır.');
        }
        if (record.longitude !== undefined && record.longitude !== null && !isNaN(Number(record.longitude))) {
          const lng = Number(record.longitude);
          if (lng < -180 || lng > 180) errors.push('Boylam -180 ile 180 arasında olmalıdır.');
        }
        // Unique code check
        const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
        const branchCodeLower = String(record.code || '').toLowerCase();
        if (branches.some(b => b.code.toLowerCase() === branchCodeLower) ||
            (tempImportedList && tempImportedList.some(b => String(b.code || '').toLowerCase() === branchCodeLower))) {
          errors.push(`Bu şube kodu zaten kullanılıyor.`);
        }
        break;

      case 'TECHNICIAN':
        if (!record.fullName) errors.push('Ad Soyad (fullName) zorunludur.');
        if (record.fullName && record.fullName.length > 50) errors.push('Ad soyad en fazla 50 karakter olabilir.');
        if (record.fullName && record.fullName.trim().length === 0) errors.push('Ad soyad sadece boşluklardan oluşamaz.');
        
        if (!record.phone) errors.push('Telefon (phone) zorunludur.');
        if (record.phone && record.phone.length > 15) errors.push('Telefon en fazla 15 karakter olabilir.');
        if (record.phone) {
          const cleanPhone = String(record.phone).replace(/\D/g, '');
          const phoneRegex = /^(0?5[0-9]{9})$/;
          if (!phoneRegex.test(cleanPhone)) errors.push('Geçersiz telefon formatı.');
        }
        
        if (!record.email) errors.push('E-posta (email) zorunludur.');
        if (record.email && record.email.length > 80) errors.push('E-posta en fazla 80 karakter olabilir.');
        if (record.email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(record.email)) errors.push('Geçersiz e-posta adresi.');
        }
        
        if (record.region && record.region.length > 20) errors.push('Bölge kodu en fazla 20 karakter olabilir.');
        if (record.completedJobsCount !== undefined && !isNaN(Number(record.completedJobsCount))) {
          const cjc = Number(record.completedJobsCount);
          if (cjc < 0 || cjc > 10000) errors.push('Tamamlanan iş sayısı 0 ile 10000 arasında olmalıdır.');
        }
        if (record.performanceScore !== undefined && !isNaN(Number(record.performanceScore))) {
          const ps = Number(record.performanceScore);
          if (ps < 0 || ps > 100) errors.push('Performans skoru 0 ile 100 arasında olmalıdır.');
        }
        if (!record.branchId) {
          errors.push('Bağlı Şube ID (branchId) zorunludur.');
        } else {
          const bs = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
          if (!bs.some(b => b.id === record.branchId)) {
            errors.push(`Atanmak istenen Şube ID '${record.branchId}' sistemde bulunamadı.`);
          }
        }
        // Unique phone & email checks
        const techs = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
        const phoneStr = String(record.phone || '');
        const emailLower = String(record.email || '').toLowerCase();
        if (techs.some(t => t.phone === phoneStr) ||
            (tempImportedList && tempImportedList.some(t => String(t.phone || '') === phoneStr))) {
          errors.push(`Bu telefon numarası zaten kayıtlı.`);
        }
        if (techs.some(t => t.email.toLowerCase() === emailLower) ||
            (tempImportedList && tempImportedList.some(t => String(t.email || '').toLowerCase() === emailLower))) {
          errors.push(`Bu e-posta zaten kullanılıyor.`);
        }
        break;

      case 'SPARE_PART':
        if (!record.code) errors.push('Parça kodu (code) zorunludur.');
        if (record.code && record.code.length > 20) errors.push('Parça kodu en fazla 20 karakter olabilir.');
        
        if (!record.name) errors.push('Parça adı (name) zorunludur.');
        if (record.name && record.name.length > 70) errors.push('Parça adı en fazla 70 karakter olabilir.');
        
        if (!record.category) errors.push('Kategori (category) zorunludur.');
        if (record.category && record.category.length > 50) errors.push('Kategori en fazla 50 karakter olabilir.');
        
        if (record.compatibleDevices && record.compatibleDevices.length > 70) errors.push('Uyumlu cihazlar en fazla 70 karakter olabilir.');
        if (record.unit && record.unit.length > 10) errors.push('Birim en fazla 10 karakter olabilir.');
        
        if (record.stockQuantity === undefined || isNaN(Number(record.stockQuantity))) {
          errors.push('Stok miktarı (stockQuantity) sayısal bir değer olmalıdır.');
        } else {
          const sq = Number(record.stockQuantity);
          if (sq < 0 || sq > 100000) errors.push('Stok miktarı 0 ile 100000 arasında olmalıdır.');
        }
        
        if (record.minStockThreshold !== undefined && !isNaN(Number(record.minStockThreshold))) {
          const mst = Number(record.minStockThreshold);
          if (mst < 0 || mst > 100000) errors.push('Minimum stok seviyesi 0 ile 100000 arasında olmalıdır.');
        }
        if (record.unitPrice !== undefined && !isNaN(Number(record.unitPrice))) {
          const up = Number(record.unitPrice);
          if (up < 0 || up > 1000000) errors.push('Birim fiyatı 0 ile 1000000 arasında olmalıdır.');
        }
        if (record.stockQuantity !== undefined && record.reservedQuantity !== undefined) {
          if (Number(record.reservedQuantity) > Number(record.stockQuantity)) {
            errors.push('Rezerve miktarı fiziksel stok miktarını aşamaz.');
          }
        }
        if (!record.branchId) {
          errors.push('Şube ID (branchId) zorunludur.');
        } else {
          const bs = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
          if (!bs.some(b => b.id === record.branchId)) {
            errors.push(`Atanmak istenen Şube ID '${record.branchId}' sistemde bulunamadı.`);
          }
        }
        // Unique code check
        const parts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
        const partCodeLower = String(record.code || '').toLowerCase();
        if (parts.some(p => p.code.toLowerCase() === partCodeLower) ||
            (tempImportedList && tempImportedList.some(p => String(p.code || '').toLowerCase() === partCodeLower))) {
          errors.push(`Bu parça kodu zaten kullanılıyor.`);
        }
        break;

      case 'VEHICLE':
        if (!record.plateNumber) errors.push('Plaka numarası (plateNumber) zorunludur.');
        if (record.plateNumber && record.plateNumber.length > 10) errors.push('Plaka en fazla 10 karakter olabilir.');
        if (record.plateNumber) {
          const cleanVal = String(record.plateNumber).replace(/\s+/g, '').toUpperCase();
          const plateRegex = /^(0[1-9]|[1-7][0-9]|8[0-1])[A-Z]{1,3}[0-9]{2,4}$/;
          if (!plateRegex.test(cleanVal)) errors.push('Geçersiz plaka formatı.');
        }
        
        if (!record.brand) errors.push('Marka (brand) zorunludur.');
        if (record.brand && record.brand.length > 40) errors.push('Marka en fazla 40 karakter olabilir.');
        
        if (!record.model) errors.push('Model (model) zorunludur.');
        if (record.model && record.model.length > 40) errors.push('Model en fazla 40 karakter olabilir.');
        
        if (record.vehicleType && record.vehicleType.length > 40) errors.push('Araç tipi en fazla 40 karakter olabilir.');
        
        if (record.fuelLevel !== undefined && !isNaN(Number(record.fuelLevel))) {
          const fl = Number(record.fuelLevel);
          if (fl < 0 || fl > 100) errors.push('Yakıt seviyesi 0 ile 100 arasında olmalıdır.');
        }
        if (record.payloadCapacityKg !== undefined && !isNaN(Number(record.payloadCapacityKg))) {
          const pc = Number(record.payloadCapacityKg);
          if (pc < 1 || pc > 10000) errors.push('Taşıma kapasitesi 1 ile 10000 arasında olmalıdır.');
        }
        if (!record.status) errors.push('Durum (status) zorunludur.');
        if (!record.branchId) {
          errors.push('Şube ID (branchId) zorunludur.');
        } else {
          const bs = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
          if (!bs.some(b => b.id === record.branchId)) {
            errors.push(`Atanmak istenen Şube ID '${record.branchId}' sistemde bulunamadı.`);
          }
        }
        // Unique plate check
        const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
        const plateLower = String(record.plateNumber || '').replace(/\s+/g, '').toLowerCase();
        if (vehicles.some(v => v.plateNumber.replace(/\s+/g, '').toLowerCase() === plateLower) ||
            (tempImportedList && tempImportedList.some(v => String(v.plateNumber || '').replace(/\s+/g, '').toLowerCase() === plateLower))) {
          errors.push(`Bu plaka zaten kayıtlı.`);
        }
        break;

      case 'CUSTOMER':
        if (!record.name) errors.push('Müşteri ismi (name) zorunludur.');
        if (record.name && record.name.length > 50) errors.push('Müşteri ismi en fazla 50 karakter olabilir.');
        if (!record.phone) errors.push('Müşteri telefonu (phone) zorunludur.');
        if (record.phone && record.phone.length > 15) errors.push('Müşteri telefonu en fazla 15 karakter olabilir.');
        break;

      case 'SERVICE_REQUEST':
        if (!record.code) errors.push('Talep kodu (code) zorunludur.');
        if (record.code && record.code.length > 20) errors.push('Talep kodu en fazla 20 karakter olabilir.');
        if (!record.customerId) errors.push('Müşteri ID (customerId) zorunludur.');
        
        if (!record.title) errors.push('Başlık (title) zorunludur.');
        if (record.title && record.title.length > 100) errors.push('Başlık en fazla 100 karakter olabilir.');
        
        if (record.description && record.description.length > 300) errors.push('Açıklama en fazla 300 karakter olabilir.');
        if (record.serviceCategory && record.serviceCategory.length > 50) errors.push('Kategori en fazla 50 karakter olabilir.');
        if (!record.requiredSkill) errors.push('Gerekli Yetkinlik (requiredSkill) zorunludur.');
        if (!record.priority) errors.push('Öncelik (priority) zorunludur.');
        if (!record.slaDeadline) errors.push('SLA Son Tarihi (slaDeadline) zorunludur.');
        if (!record.branchId) {
          errors.push('Şube ID (branchId) zorunludur.');
        } else {
          const bs = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
          if (!bs.some(b => b.id === record.branchId)) {
            errors.push(`Atanmak istenen Şube ID '${record.branchId}' sistemde bulunamadı.`);
          }
        }
        // Unique code check
        const requests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
        const requestCodeLower = String(record.code || '').toLowerCase();
        if (requests.some(r => r.code.toLowerCase() === requestCodeLower) ||
            (tempImportedList && tempImportedList.some(r => String(r.code || '').toLowerCase() === requestCodeLower))) {
          errors.push(`Bu talep kodu zaten kullanılıyor.`);
        }
        break;

      default:
        errors.push(`Bilinmeyen veri modeli tipi: ${entityType}`);
    }

    return errors;
  }

  importValidRecords(entityType: string, records: any[]): ImportResult {
    this.permission.assertPermission('IMPORT_EXECUTE');
    let storageKey = '';
    switch (entityType) {
      case 'BRANCH': storageKey = STORAGE_KEYS.BRANCHES; break;
      case 'TECHNICIAN': storageKey = STORAGE_KEYS.TECHNICIANS; break;
      case 'SPARE_PART': storageKey = STORAGE_KEYS.SPARE_PARTS; break;
      case 'VEHICLE': storageKey = STORAGE_KEYS.VEHICLES; break;
      case 'CUSTOMER': storageKey = STORAGE_KEYS.USERS; break; // Customers can be stored in users/customers collection
      case 'SERVICE_REQUEST': storageKey = STORAGE_KEYS.SERVICE_REQUESTS; break;
      default:
        throw new Error(`Gecersiz entityType: ${entityType}`);
    }

    const currentCollection = this.storage.getCollection<any>(storageKey);
    const importedRecords: any[] = [];
    const failedRecords: ImportFailedRecord[] = [];

    records.forEach((rec, index) => {
      const errors = this.validateImportedRecord(rec, entityType, importedRecords);
      if (errors.length > 0) {
        failedRecords.push({
          rowIndex: index + 1,
          data: rec,
          errors
        });
      } else {
        // Prepare record to save (generate ID and dates if missing)
        const newRecord = {
          ...rec,
          id: rec.id || `${entityType.toLowerCase()}-${Date.now()}-${index}`,
          createdAt: rec.createdAt || new Date().toISOString()
        };

        // Add additional default fields if missing
        if (entityType === 'BRANCH') {
          newRecord.isActive = newRecord.isActive !== undefined ? newRecord.isActive : true;
          newRecord.serviceAreas = newRecord.serviceAreas || [];
        } else if (entityType === 'TECHNICIAN') {
          newRecord.isActive = newRecord.isActive !== undefined ? newRecord.isActive : true;
          newRecord.isOnLeave = newRecord.isOnLeave !== undefined ? newRecord.isOnLeave : false;
          newRecord.performanceScore = newRecord.performanceScore || 100;
          newRecord.completedJobsCount = newRecord.completedJobsCount || 0;
          newRecord.skills = newRecord.skills || [];
          newRecord.workingDays = newRecord.workingDays || [1,2,3,4,5];
          newRecord.workingHoursStart = newRecord.workingHoursStart || '08:30';
          newRecord.workingHoursEnd = newRecord.workingHoursEnd || '17:30';
        } else if (entityType === 'SPARE_PART') {
          newRecord.isActive = newRecord.isActive !== undefined ? newRecord.isActive : true;
          newRecord.reservedQuantity = newRecord.reservedQuantity || 0;
          newRecord.minStockThreshold = newRecord.minStockThreshold || 10;
        } else if (entityType === 'VEHICLE') {
          newRecord.isActive = newRecord.isActive !== undefined ? newRecord.isActive : true;
          newRecord.fuelLevel = newRecord.fuelLevel !== undefined ? newRecord.fuelLevel : 100;
          newRecord.lastMaintenanceDate = newRecord.lastMaintenanceDate || new Date().toISOString();
        } else if (entityType === 'SERVICE_REQUEST') {
          newRecord.status = newRecord.status || 'NEW';
          newRecord.hasWarranty = newRecord.hasWarranty !== undefined ? newRecord.hasWarranty : false;
          newRecord.hasCustomerApproval = newRecord.hasCustomerApproval !== undefined ? newRecord.hasCustomerApproval : false;
        }

        currentCollection.push(newRecord);
        importedRecords.push(newRecord);
      }
    });

    if (importedRecords.length > 0) {
      this.storage.updateCollection(storageKey, currentCollection);
    }

    const total = records.length;
    const successCount = importedRecords.length;
    const failedCount = failedRecords.length;

    const result: ImportResult = {
      total,
      successCount,
      failedCount,
      importedRecords,
      failedRecords
    };

    let auditEntityType: 'BRANCH' | 'TECHNICIAN' | 'SPARE_PART' | 'SERVICE_REQUEST' | 'WORK_ORDER' | 'VEHICLE' | 'RULE' | 'SYSTEM' = 'SYSTEM';
    if (['BRANCH', 'TECHNICIAN', 'SPARE_PART', 'SERVICE_REQUEST', 'VEHICLE'].includes(entityType)) {
      auditEntityType = entityType as any;
    }

    // 1. Audit Log log
    this.auditLog.logAction({
      actionType: 'IMPORT',
      entityType: auditEntityType,
      entityId: `bulk-import-${Date.now()}`,
      oldValue: null,
      newValue: JSON.stringify({
        successCount,
        failedCount,
        total
      }),
      description: `${entityType} veri modeli içe aktarımı yapıldı. Başarılı: ${successCount}, Başarısız: ${failedCount}`
    });

    // 2. Notification trigger
    this.notification.createNotification({
      type: 'NEW_REQUEST',
      title: 'Veri İçe Aktarımı Tamamlandı',
      message: `${entityType} veri modeli için ${total} satır işlendi. ${successCount} kayıt başarılı şekilde yüklendi, ${failedCount} kayıt hatalı olduğu için atlandı.`,
      branchId: null,
      targetRole: 'SYSTEM_ADMIN',
      targetUserId: null,
      relatedEntityId: null
    });

    return result;
  }

  generateImportErrorReport(result: ImportResult): string {
    if (result.failedCount === 0) return 'Tüm kayıtlar başarıyla yüklendi.';
    
    let report = `Veri İçe Aktarım Hata Raporu (${result.failedCount} / ${result.total} Hatalı Kayıt):\n\n`;
    result.failedRecords.forEach(fail => {
      report += `Satır #${fail.rowIndex}: [Veri: ${JSON.stringify(fail.data)}]\n`;
      fail.errors.forEach(err => {
        report += `  - Hata Nedeni: ${err}\n`;
      });
      report += '\n';
    });

    return report;
  }

  stringifyRecord(rec: any): string {
    try {
      return JSON.stringify(rec);
    } catch {
      return String(rec);
    }
  }
}
