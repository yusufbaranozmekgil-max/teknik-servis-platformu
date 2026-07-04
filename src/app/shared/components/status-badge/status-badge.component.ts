import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  WORK_ORDER_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  TECHNICIAN_STATUS_LABELS,
  STOCK_STATUS_LABELS,
  NOTIFICATION_SEVERITY_LABELS,
  RESULT_LABELS,
  PRIORITY_LABELS
} from '../../../core/constants/labels.const';

// Yedek parça kategorileri (ayrı dosyada değil, burada)
const PART_CATEGORY_LABELS: Record<string, string> = {
  COMPRESSOR: 'Kompresör',
  BOARD_ELECTRONIC: 'Elektronik Kart',
  MOTOR: 'Motor',
  SENSOR: 'Sensör',
  SEAL_GASKET: 'Conta / Conta Seti',
  FILTER: 'Filtre',
  CABLE_CONNECTION: 'Kablo / Bağlantı',
  CONSUMABLES: 'Sarf Malzeme'
};

// Diğer ham sınıflar (eski hardcoded label'lar)
const LEGACY_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  ON_LEAVE: 'İzinli',
  CRITICAL: 'Kritik',
  SLA_OVERDUE: 'SLA Gecikmiş',
  SLA_WARNING: 'SLA Yaklaşıyor',
  CRITICAL_STOCK: 'Kritik Stok',
  LOW_FUEL: 'Yakıt Düşük',
  MAINTENANCE_OVERDUE: 'Bakım Gecikmiş'
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="statusClass">
      {{ statusLabel }}
    </span>
  `,
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status: string = '';

  get statusClass(): string {
    return (this.status || '').toLowerCase().replace(/\s+/g, '_');
  }

  get statusLabel(): string {
    const v = String(this.status || '').toUpperCase();
    if (!v) return '';
    // Önce merkezi label sözlüklerinde sırayla ara — ilk eşleşmeyi dön
    return (
      WORK_ORDER_STATUS_LABELS[v as keyof typeof WORK_ORDER_STATUS_LABELS] ??
      SERVICE_REQUEST_STATUS_LABELS[v] ??
      VEHICLE_STATUS_LABELS[v] ??
      TECHNICIAN_STATUS_LABELS[v] ??
      STOCK_STATUS_LABELS[v] ??
      PRIORITY_LABELS[v] ??
      NOTIFICATION_SEVERITY_LABELS[v] ??
      RESULT_LABELS[v] ??
      PART_CATEGORY_LABELS[v] ??
      LEGACY_LABELS[v] ??
      this.status
    );
  }
}
