import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toastService.toasts()" 
        class="toast-box" 
        [class]="toast.type"
        (click)="toastService.remove(toast.id)"
      >
        <span class="icon">
          <ng-container [ngSwitch]="toast.type">
            <span *ngSwitchCase="'success'"></span>
            <span *ngSwitchCase="'error'"></span>
            <span *ngSwitchCase="'warning'"></span>
            <span *ngSwitchCase="'info'"></span>
          </ng-container>
        </span>
        <span class="message">{{ toast.message }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./toasts.component.scss']
})
export class ToastsComponent {
  toastService = inject(ToastService);
}
