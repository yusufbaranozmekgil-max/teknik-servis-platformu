export type TechnicianLevel = 'JUNIOR' | 'MID' | 'SENIOR' | 'EXPERT';
export type SkillType = 'WHITE_GOODS' | 'HVAC' | 'ELECTRIC' | 'ELECTRONICS_MOTHERBOARD' | 'PLUMBING' | 'BOILER_HEATING';

import { SkillLevel } from './skill-type.model';

export interface Technician {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  branchId: string;
  region: string; // Bölge
  level: TechnicianLevel;
  skills: SkillType[];
  /** Her yetkinlik için seviye (Başlangıç / Orta / Uzman). Eski kayıtlarda olmayabilir. */
  skillLevels?: Partial<Record<SkillType, SkillLevel>>;
  workingHoursStart: string; // e.g., "08:30"
  workingHoursEnd: string; // e.g., "17:30"
  workingDays: number[]; // 1 = Mon, 7 = Sun
  isActive: boolean;
  isOnLeave: boolean;
  leaveStart: string | null;
  leaveEnd: string | null;
  performanceScore: number; // 0 - 100
  completedJobsCount: number; // Tamamladığı iş sayısı
  dailyCapacity: number; // Günlük üstlenebileceği maksimum iş sayısı (varsayılan 4)
  createdAt: string;
}
