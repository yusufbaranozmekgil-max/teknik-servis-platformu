import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const toast: ToastMessage = { id, type, message };
    this.toasts.update(list => [...list, toast]);

    setTimeout(() => {
      this.remove(id);
    }, 4000);
  }

  showSuccess(message: string) {
    this.show(message, 'success');
  }

  showError(message: string) {
    this.show(message, 'error');
  }

  showWarning(message: string) {
    this.show(message, 'warning');
  }

  showInfo(message: string) {
    this.show(message, 'info');
  }

  remove(id: string) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
