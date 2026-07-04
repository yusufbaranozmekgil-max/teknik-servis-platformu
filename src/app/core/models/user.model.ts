export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'OPERATION_MANAGER'
  | 'BRANCH_MANAGER'
  | 'DISPATCHER'
  | 'WAREHOUSE_MANAGER'
  | 'TECHNICIAN'
  | 'REPORTING_USER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  technicianId: string | null;
  isActive: boolean;
  createdAt: string;
}
