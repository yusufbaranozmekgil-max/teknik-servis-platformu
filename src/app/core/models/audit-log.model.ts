import { UserRole } from './user.model';

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  userRole: UserRole;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATE_TRANSITION' | 'SECURITY_VIOLATION' | 'SYSTEM_EVENT' | 'IMPORT';
  entityType: 'BRANCH' | 'TECHNICIAN' | 'SPARE_PART' | 'SERVICE_REQUEST' | 'WORK_ORDER' | 'VEHICLE' | 'RULE' | 'SYSTEM';
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  simulatedIp: string;
  createdAt: string;
  result?: 'SUCCESS' | 'FAILURE';
  failureReason?: string | null;
}
