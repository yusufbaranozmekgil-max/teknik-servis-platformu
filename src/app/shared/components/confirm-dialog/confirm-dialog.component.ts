import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
    selector: 'app-confirm-dialog',
    imports: [],
    template: `
    @if (confirmService.state(); as state) {
      <div class="confirm-backdrop">
        <div class="confirm-box">
          <h3>{{ state.title }}</h3>
          <p>{{ state.message }}</p>
          <div class="confirm-actions">
            <button (click)="cancel(state)" class="btn-cancel">{{ state.cancelText || 'Vazgeç' }}</button>
            <button (click)="confirm(state)" class="btn-confirm">{{ state.confirmText || 'Evet' }}</button>
          </div>
        </div>
      </div>
    }
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
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
