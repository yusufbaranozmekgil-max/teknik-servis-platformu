import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  state = signal<ConfirmOptions | null>(null);

  confirm(title: string, message: string, confirmText = 'Evet', cancelText = 'Vazgeç'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        title,
        message,
        confirmText,
        cancelText,
        resolve: (val) => {
          this.state.set(null);
          resolve(val);
        }
      });
    });
  }
}
