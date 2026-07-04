import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from './storage-keys';
import { CURRENT_SCHEMA_VERSION } from './storage-schema';

@Injectable({
  providedIn: 'root'
})
export class MigrationService {

  migrate(): void {
    const activeVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    if (!activeVersion) {
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
      console.log(`Veri tabani ilk kez baslatildi. Sema surumu: ${CURRENT_SCHEMA_VERSION}`);
      return;
    }

    if (activeVersion !== CURRENT_SCHEMA_VERSION) {
      console.log(`Sema surumu degisikligi algilandi: ${activeVersion} -> ${CURRENT_SCHEMA_VERSION}. Goc islemleri baslatiliyor.`);
      this.runMigrations(activeVersion, CURRENT_SCHEMA_VERSION);
    }
  }

  private runMigrations(fromVersion: string, toVersion: string): void {
    localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, toVersion);
    console.log(`Sema gocu basariyla tamamlandi.`);
  }
}
