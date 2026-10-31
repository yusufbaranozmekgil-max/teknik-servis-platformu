import { Component, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-toasts',
    imports: [],
    template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast) {
        <div
          class="toast-box"
          [class]="toast.type"
          (click)="toastService.remove(toast.id)"
          >
          <span class="icon">
            @switch (toast.type) {
              @case ('success') {
                <span></span>
              }
              @case ('error') {
                <span></span>
              }
              @case ('warning') {
                <span></span>
              }
              @case ('info') {
                <span></span>
              }
            }
          </span>
          <span class="message">{{ toast.message }}</span>
        </div>
      }
    </div>
    `,
    styleUrls: ['./toasts.component.scss']
})
export class ToastsComponent {
  toastService = inject(ToastService);
}
