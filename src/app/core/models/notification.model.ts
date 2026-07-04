import { UserRole } from './user.model';

export type NotificationType =
  | 'NEW_REQUEST'
  | 'ASSIGNMENT_CREATED'
  | 'LOW_STOCK'
  | 'SLA_OVERDUE'
  | 'SLA_APPROACHING'
  | 'VEHICLE_MAINTENANCE'
  | 'TECHNICIAN_ASSIGNED'
  | 'PARTIAL_COMPLETION'
  | 'FAILED_WORK'
  | 'CAPACITY_FULL'
  | 'RULE_CONFLICT'
  | 'UNAUTHORIZED_ACTION'
  | 'IMPORT_ERROR'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_GRANTED';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface Notification {
  id: string;
  type: NotificationType;
  severity?: NotificationSeverity; // Optional for backward compatibility
  title: string;
  message: string;
  targetRole: UserRole | null;
  targetUserId: string | null;
  branchId?: string | null; // Kept for backwards compatibility
  relatedEntityType?: 'SERVICE_REQUEST' | 'WORK_ORDER' | 'SPARE_PART' | 'VEHICLE' | 'RULE' | 'SYSTEM' | 'SHIFT' | null; // Optional
  relatedEntityId: string | null;
  link?: string | null; // Optional
  isRead: boolean;
  createdAt: string;
}
