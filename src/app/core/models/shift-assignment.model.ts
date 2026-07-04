import { SkillType } from './technician.model';
import { ServicePriority } from './service-request.model';

export type ShiftTaskType = 'ROUTINE_MAINT' | 'ON_CALL' | 'INSTALLATION' | 'INSPECTION' | 'TRAINING' | 'OTHER';

export type ShiftStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ShiftAssignment {
  id: string;
  code: string;
  title: string;
  taskType: ShiftTaskType;
  description: string;
  branchId: string;       // Şube / lokasyon
  region: string;         // Bölge / saha
  requiredSkill: SkillType;
  requiredHeadcount: number; // Kaç teknisyen lazım
  start: string;          // ISO başlangıç (tarih + saat)
  end: string;            // ISO bitiş (tarih + saat)
  priority: ServicePriority;
  assignedTechnicianIds: string[]; // Atanan teknisyenlerin id'leri
  status: ShiftStatus;
  createdBy: string | null;
  createdAt: string;
  notes: string | null;
}
