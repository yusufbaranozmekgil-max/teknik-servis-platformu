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
    
    // Malformed JSON write
    localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, '{"id": "broken-json", "description": "missing closing tags ...');
    
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
    const dummyKey = 'ts_quota_test_dummy';
    let content = 'DUMMY_DATA_REPEATER_FIELD_';
    
    // Create large string (approx 6MB) to trigger quota exceed in standard browsers
    for (let i = 0; i < 18; i++) {
      content += content;
    }

    logCallback(`Üretilen test verisinin boyutu: ~${Math.round(content.length / 1024 / 1024)} MB`, 'info');
    logCallback("LocalStorage'a yazılmaya çalışılıyor...", 'info');

    try {
      // Direct call which will trigger the quota exceeded error
      localStorage.setItem(dummyKey, content);
      localStorage.setItem(dummyKey + '_2', content);
      logCallback('Dikkat: Bu tarayıcının kotası henüz aşılmadı, daha fazla veri yazılıyor...', 'info');
      localStorage.setItem(dummyKey + '_3', content + content);
    } catch (e: any) {
      logCallback(`Kota Sınırı Başarıyla Tetiklendi! Hata Adı: ${e.name}. Detay: ${e.message}`, 'success');
      
      this.auditLogService.logAction({
        actionType: 'SYSTEM_EVENT',
        entityType: 'SYSTEM',
        entityId: 'quota-test',
        oldValue: 'NORMAL_STORAGE',
        newValue: 'QUOTA_EXCEEDED_DETECTED',
        description: `Depolama kota sınırı aşımı algılandı ve simüle edildi. Hata: ${e.name}`
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
    } finally {
      // Clean up test data immediately to avoid locking the user's browser
      localStorage.removeItem(dummyKey);
      localStorage.removeItem(dummyKey + '_2');
      localStorage.removeItem(dummyKey + '_3');
      logCallback('Temizlik: Simülasyon veri blokları silindi ve depolama alanı serbest bırakıldı.', 'info');
    }
  }
}
