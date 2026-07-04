import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { WorkOrder } from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private storage = inject(StorageService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  runCorruptStorageSim(): { logs: { text: string; type: 'info' | 'success' | 'error' | 'default' }[]; recoveredCount: number } {
    const logs: { text: string; type: 'info' | 'success' | 'error' | 'default' }[] = [];
    
    // Malformed JSON write (ham erişim StorageService içinde kapsüllü)
    this.storage.simulateCorruptCollection(STORAGE_KEYS.WORK_ORDERS);

    logs.push({ text: "LocalStorage'a kasıtlı olarak bozuk veri (kesilmiş JSON) yazıldı.", type: 'info' });
    logs.push({ text: "Veriyi güvenli şekilde çekmeyi deniyoruz (StorageService.getCollection)...", type: 'info' });

    // Call getCollection to trigger safeParse and error recovery
    const list = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    
    logs.push({ text: `Sonuç: StorageService bozuk yapıyı tespit etti ve yedekledi. Kurtarılan kayıt adedi: ${list.length}`, type: 'success' });
    logs.push({ text: 'Bozuk ham veri yedekleme amaçlı "backup_corrupted_ts_work_orders_..." anahtarına taşınmıştır.', type: 'info' });

    this.auditLogService.logAction({
      actionType: 'SYSTEM_EVENT',
      entityType: 'SYSTEM',
      entityId: 'storage-healer',
      oldValue: 'CORRUPTED_JSON',
      newValue: 'RECOVERED_EMPTY_ARRAY',
      description: 'Bozuk localStorage veri kurtarma testi başarıyla simüle edildi ve veri bütünlüğü korundu.'
    });

    return { logs, recoveredCount: list.length };
  }

  runQuotaExceededSim(logCallback: (msg: string, type: 'info' | 'success' | 'error' | 'default') => void): void {
    // Ham localStorage erişimi + temizlik StorageService.probeQuotaLimit içinde kapsüllü.
    const result = this.storage.probeQuotaLimit();

    logCallback(`Üretilen test verisinin boyutu: ~${result.sizeMB} MB`, 'info');
    logCallback("LocalStorage'a yazılmaya çalışıldı...", 'info');

    if (result.triggered) {
      logCallback(`Kota Sınırı Başarıyla Tetiklendi! Hata Adı: ${result.errorName}. Detay: ${result.errorMessage}`, 'success');

      this.auditLogService.logAction({
        actionType: 'SYSTEM_EVENT',
        entityType: 'SYSTEM',
        entityId: 'quota-test',
        oldValue: 'NORMAL_STORAGE',
        newValue: 'QUOTA_EXCEEDED_DETECTED',
        description: `Depolama kota sınırı aşımı algılandı ve simüle edildi. Hata: ${result.errorName}`
      });

      this.notificationService.createNotification({
        type: 'IMPORT_ERROR',
        title: 'Depolama Kotası Uyarısı',
        message: `Local envanter veri depolama kotası dolmak üzere veya aşıldı! Hatalı veri kaybını önlemek için temizlik yapın.`,
        branchId: null,
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'SYSTEM',
        relatedEntityId: 'quota-limit',
        link: '/ayarlar'
      });
    } else {
      logCallback('Bu tarayıcının kotası bu veri boyutunda aşılmadı; test blokları temizlendi.', 'info');
    }

    logCallback('Temizlik: Simülasyon veri blokları silindi ve depolama alanı serbest bırakıldı.', 'info');
  }
}
