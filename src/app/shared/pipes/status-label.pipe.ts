import { Pipe, PipeTransform } from '@angular/core';
import {
  WORK_ORDER_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  TECHNICIAN_STATUS_LABELS,
  STOCK_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  ENTITY_TYPE_LABELS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_SEVERITY_LABELS,
  RESULT_LABELS
} from '../../core/constants/labels.const';

export type LabelScope =
  | 'workOrder' | 'request' | 'vehicle' | 'technician' | 'stock'
  | 'action' | 'entity' | 'notification' | 'severity' | 'result' | 'auto';

@Pipe({ name: 'statusLabel', standalone: true, pure: true })
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, scope: LabelScope = 'auto'): string {
    if (!value) return '';
    const v = String(value);
    switch (scope) {
      case 'workOrder':    return WORK_ORDER_STATUS_LABELS[v as keyof typeof WORK_ORDER_STATUS_LABELS] ?? v;
      case 'request':      return SERVICE_REQUEST_STATUS_LABELS[v] ?? v;
      case 'vehicle':      return VEHICLE_STATUS_LABELS[v] ?? v;
      case 'technician':   return TECHNICIAN_STATUS_LABELS[v] ?? v;
      case 'stock':        return STOCK_STATUS_LABELS[v] ?? v;
      case 'action':       return ACTION_TYPE_LABELS[v] ?? v;
      case 'entity':       return ENTITY_TYPE_LABELS[v] ?? v;
      case 'notification': return NOTIFICATION_TYPE_LABELS[v] ?? v;
      case 'severity':     return NOTIFICATION_SEVERITY_LABELS[v] ?? v;
      case 'result':       return RESULT_LABELS[v] ?? v;
    }
    return (
      WORK_ORDER_STATUS_LABELS[v as keyof typeof WORK_ORDER_STATUS_LABELS] ??
      SERVICE_REQUEST_STATUS_LABELS[v] ??
      VEHICLE_STATUS_LABELS[v] ??
      TECHNICIAN_STATUS_LABELS[v] ??
      STOCK_STATUS_LABELS[v] ??
      ACTION_TYPE_LABELS[v] ??
      ENTITY_TYPE_LABELS[v] ??
      NOTIFICATION_TYPE_LABELS[v] ??
      NOTIFICATION_SEVERITY_LABELS[v] ??
      RESULT_LABELS[v] ??
      v
    );
  }
}
