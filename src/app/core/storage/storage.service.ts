import { Injectable } from '@angular/core';
import { validateSchema } from './storage-schema';
import { STORAGE_KEYS } from './storage-keys';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  // Audit log silinemez. Bu setteki anahtarlara delete/clear bloklanır.
  private static readonly IMMUTABLE_KEYS = new Set<string>([STORAGE_KEYS.AUDIT_LOGS]);

  validateSchema(key: string, data: any[]): boolean {
    return validateSchema(key, data);
  }

  // --- Single-value (non-collection) API ---
  // AuthStateService gibi tek değer saklayan tüketicilerin StorageService dışına çıkmaması için.
  getRaw(key: string): string | null {
    return localStorage.getItem(key);
  }

  setRaw(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        this.handleQuotaExceeded();
        throw new Error('Tarayıcı depolama kotası aşıldı.');
      }
      throw e;
    }
  }

  removeRaw(key: string): void {
    if (StorageService.IMMUTABLE_KEYS.has(key)) {
      throw new Error('Audit log kayıtları silinemez.');
    }
    localStorage.removeItem(key);
  }

  safeParse<T>(jsonString: string | null, key: string): T[] {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        console.warn(`Beklenen array yerine farkli bir veri tipi alindi (${key}). Yedekleniyor ve sifirlaniyor.`);
        this.backupAndResetKey(key, jsonString);
        return [];
      }
      
      if (!this.validateSchema(key, parsed)) {
        console.warn(`Sema dogrulamasi basarisiz oldu (${key}). Bozuk veriler kurtarilmaya calisiliyor.`);
        return this.recoverCorruptedData<T>(key, parsed);
      }

      return parsed;
    } catch (e) {
      console.error(`Bozuk JSON verisi tespit edildi (${key}). Yedekleniyor.`);
      this.backupAndResetKey(key, jsonString || '');
      return [];
    }
  }

  private backupAndResetKey(key: string, rawValue: string): void {
    try {
      const backupKey = `backup_corrupted_${key}_${Date.now()}`;
      localStorage.setItem(backupKey, rawValue);
      localStorage.setItem(key, JSON.stringify([]));
    } catch (e) {
      this.handleQuotaExceeded();
    }
  }

  recoverCorruptedData<T>(key: string, data: any[]): T[] {
    const backupKey = `backup_invalid_fields_${key}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, JSON.stringify(data));
    } catch(e) {
      this.handleQuotaExceeded();
    }

    return data.filter(item => {
      return item && typeof item === 'object' && typeof item.id === 'string';
    }) as T[];
  }

  getCollection<T>(key: string): T[] {
    const raw = localStorage.getItem(key);
    return this.safeParse<T>(raw, key);
  }

  setCollection<T>(key: string, data: T[]): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        this.handleQuotaExceeded();
        throw new Error('Tarayici depolama kotasi asildi. Lutfen gereksiz verileri veya eski loglari temizleyin.');
      }
      throw e;
    }
  }

  getById<T extends { id: string }>(key: string, id: string): T | null {
    const collection = this.getCollection<T>(key);
    return collection.find(item => item.id === id) || null;
  }

  create<T extends { id: string }>(key: string, item: T): T {
    const collection = this.getCollection<T>(key);
    collection.push(item);
    this.setCollection(key, collection);
    return item;
  }

  update<T extends { id: string }>(key: string, id: string, item: Partial<T>): T {
    const collection = this.getCollection<T>(key);
    const idx = collection.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Güncellenmek istenen kayıt bulunamadı.');
    
    collection[idx] = { ...collection[idx], ...item };
    this.setCollection(key, collection);
    return collection[idx];
  }

  delete<T extends { id: string }>(key: string, id: string): boolean {
    if (StorageService.IMMUTABLE_KEYS.has(key)) {
      // Audit log kayıtları silinemez (şartname gereği).
      throw new Error('Audit log kayıtları silinemez.');
    }
    const collection = this.getCollection<T>(key);
    const filtered = collection.filter(i => i.id !== id);
    if (collection.length === filtered.length) return false;
    this.setCollection(key, filtered);
    return true;
  }

  updateCollection<T extends { id: string }>(key: string, items: T[]): void {
    if (StorageService.IMMUTABLE_KEYS.has(key)) {
      // Audit log koleksiyonu toplu olarak da yeniden yazılamaz; sadece append (setCollection internal yol) kabul edilir.
      // setCollection için bu kısıt yok çünkü audit log append'i için gerekli.
      throw new Error('Audit log koleksiyonu dışarıdan yeniden yazılamaz.');
    }
    this.setCollection(key, items);
  }

  clearKey(key: string): void {
    if (StorageService.IMMUTABLE_KEYS.has(key)) {
      throw new Error('Audit log kayıtları silinemez.');
    }
    localStorage.removeItem(key);
  }

  backup(): string {
    const backupObj: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ts_')) {
        backupObj[key] = localStorage.getItem(key);
      }
    }
    return JSON.stringify(backupObj);
  }

  restore(backupData: string): boolean {
    try {
      const parsed = JSON.parse(backupData);
      if (typeof parsed !== 'object' || parsed === null) return false;
      
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ts_')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      Object.keys(parsed).forEach(key => {
        localStorage.setItem(key, parsed[key]);
      });
      return true;
    } catch (e) {
      console.error('Yedek geri yukleme hatasi:', e);
      return false;
    }
  }

  handleQuotaExceeded(): void {
    console.error("LocalStorage kota siniri asildi!");
    // En eski backup_ ile başlayan kayıtlardan ilk 5'ini temizle.
    const backupKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('backup_')) backupKeys.push(k);
    }
    backupKeys.sort().slice(0, 5).forEach(k => localStorage.removeItem(k));
  }
}
