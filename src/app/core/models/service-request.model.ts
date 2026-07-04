import { SkillType } from './technician.model';

export type ServicePriority = 'STANDARD' | 'URGENT' | 'CRITICAL';
export type ServiceRequestStatus = 'NEW' | 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';

export interface ServiceRequest {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerRegion: string;
  branchId: string;
  title: string;
  description: string;
  deviceBrandModel: string; // Cihaz Marka/Model
  serviceCategory: string; // Hizmet Kategorisi
  requiredSkill: SkillType;
  priority: ServicePriority;
  status: ServiceRequestStatus;
  slaDeadline: string; // ISO
  hasWarranty: boolean;
  hasCustomerApproval: boolean;
  createdAt: string;
}
