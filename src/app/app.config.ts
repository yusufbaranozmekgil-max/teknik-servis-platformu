import { ApplicationConfig, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MigrationService } from './core/storage/migration.service';
import { SeedService } from './core/storage/seed.service';

export function initializeApp(migrationService: MigrationService, seedService: SeedService) {
  return () => {
    migrationService.migrate();
    seedService.seedAll();
  };
}

/**
 * Yeni deploy sonrası tarayıcıda kalan eski index.html, artık olmayan lazy-chunk
 * dosyalarını isteyince "Failed to fetch dynamically imported module" hatası olur.
 * Bu durumda sayfayı bir kez otomatik yenileyerek güncel index.html + chunk'ları çekeriz.
 * Sonsuz döngüyü sessionStorage zaman damgasıyla engelleriz.
 */
export class ChunkReloadErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const msg = String(error?.message ?? error ?? '');
    const isChunkError =
      /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|MIME type of "text\/html"/i.test(msg);
    if (isChunkError) {
      try {
        const KEY = 'chunk_reload_at';
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage erişilemezse sessizce normal hata yoluna düş.
      }
    }
    console.error(error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: ChunkReloadErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [MigrationService, SeedService],
      multi: true
    }
  ]
};
