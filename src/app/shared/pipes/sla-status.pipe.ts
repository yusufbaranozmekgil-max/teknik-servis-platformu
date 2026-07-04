import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'slaStatus',
  standalone: true
})
export class SlaStatusPipe implements PipeTransform {
  transform(deadlineIso: string | null | undefined): string {
    if (!deadlineIso) return 'Süre Sınırı Yok';
    
    const limit = new Date(deadlineIso).getTime();
    const now = Date.now();
    const diffMs = limit - now;
    
    if (diffMs < 0) {
      const pastHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
      return `Aşılmış (${pastHours} saat gecikme)`;
    }
    
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return `${diffMins} dakika kaldı`;
    }
    
    return `${diffHours} saat kaldı`;
  }
}
