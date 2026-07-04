import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [MigrationService, SeedService],
      multi: true
    }
  ]
};
