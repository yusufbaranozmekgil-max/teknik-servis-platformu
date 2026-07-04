import { Injectable } from '@angular/core';
import { ServicePriority } from '../models/service-request.model';

@Injectable({
  providedIn: 'root'
})
export class SlaService {

  calculateSlaDeadline(priority: ServicePriority, fromDate: Date = new Date()): string {
    const deadline = new Date(fromDate);
    switch (priority) {
      case 'CRITICAL':
        deadline.setHours(deadline.getHours() + 4);
        break;
      case 'URGENT':
        deadline.setHours(deadline.getHours() + 12);
        break;
      case 'STANDARD':
      default:
        deadline.setHours(deadline.getHours() + 48);
        break;
    }
    return deadline.toISOString();
  }

  isSlaApproaching(deadlineIso: string, thresholdHours: number = 2): boolean {
    const now = new Date().getTime();
    const limit = new Date(deadlineIso).getTime();
    const diffHours = (limit - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= thresholdHours;
  }

  isSlaOverdue(deadlineIso: string): boolean {
    return new Date().getTime() > new Date(deadlineIso).getTime();
  }
}
