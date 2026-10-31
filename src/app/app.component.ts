import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { ToastsComponent } from './shared/components/toasts/toasts.component';
import { StorageService } from './core/storage/storage.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ConfirmDialogComponent, ToastsComponent],
    templateUrl: './app.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'technical-service-app';

  private storage = inject(StorageService);

  ngOnInit(): void {
    // Kaydedilmiş tema tercihi uygulama açılışında uygulanır.
    // Giriş sayfası MainLayout dışında olduğu için tema burada yüklenmezse
    // karanlık modda giriş ekranı açık tema ile açılıyordu.
    if (this.storage.getRaw('ts_dark_mode') === '1') {
      document.body.classList.add('dark-theme');
    }
  }
}
