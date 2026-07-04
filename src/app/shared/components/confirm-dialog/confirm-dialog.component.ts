import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-backdrop" *ngIf="confirmService.state() as state">
      <div class="confirm-box">
        <h3>{{ state.title }}</h3>
        <p>{{ state.message }}</p>
        <div class="confirm-actions">
          <button (click)="cancel(state)" class="btn-cancel">{{ state.cancelText || 'Vazgeç' }}</button>
          <button (click)="confirm(state)" class="btn-confirm">{{ state.confirmText || 'Evet' }}</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmService);

  confirm(state: any) {
    if (state.resolve) state.resolve(true);
  }

  cancel(state: any) {
    if (state.resolve) state.resolve(false);
  }
}
