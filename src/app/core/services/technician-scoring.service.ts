import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Technician } from '../models/technician.model';
import { SKILL_LEVEL_WEIGHTS, SKILL_LEVEL_LABELS } from '../models/skill-type.model';
import { ServiceRequest } from '../models/service-request.model';
import { TimeSlot } from '../models/time-slot.model';
import { WorkOrder } from '../models/work-order.model';
import { Branch } from '../models/branch.model';
import { SchedulingService } from './scheduling.service';
import { PermissionService } from './permission.service';

export interface TechnicianScoreResult {
  technician: Technician;
  totalScore: number;
  eligible: boolean;
  ineligibleReason?: string;
  breakdown: {
    skillsScore: number;
    proximityScore: number;
    availabilityScore: number;
    workloadScore: number;
    performanceScore: number;
    slaUrgencyScore: number;
  };
  explanation: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TechnicianScoringService {
  private storage = inject(StorageService);
  private schedulingService = inject(SchedulingService);
  private permissionService = inject(PermissionService);

  getEligibleTechnicians(requestId: string, slot: TimeSlot): TechnicianScoreResult[] {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    
    const request = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, requestId);
    if (!request) {
      throw new Error('Hizmet talebi bulunamadı.');
    }

    const technicians = this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS);
    const results: TechnicianScoreResult[] = [];

    for (const tech of technicians) {
      const scoreResult = this.calculateTechnicianScore(tech, request, slot);
      results.push(scoreResult);
    }

    // Sort by eligibility first, then total score descending
    return results.sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.totalScore - a.totalScore;
    });
  }

  calculateTechnicianScore(tech: Technician, request: ServiceRequest, slot: TimeSlot): TechnicianScoreResult {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    
    const explanation: string[] = [];
    let eligible = true;
    let ineligibleReason = '';

    // 1. Eligibility Filters
    if (!tech.isActive) {
      eligible = false;
      ineligibleReason = 'Teknisyen aktif değil.';
    }

    // Leave check
    if (eligible && tech.isOnLeave && tech.leaveStart && tech.leaveEnd) {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      const leaveStart = new Date(tech.leaveStart).getTime();
      const leaveEnd = new Date(tech.leaveEnd).getTime();
      if (slotStart < leaveEnd && leaveStart < slotEnd) {
        eligible = false;
        ineligibleReason = 'Teknisyen belirtilen tarihte izinli.';
      }
    }

    // Skill check
    if (eligible && !tech.skills.includes(request.requiredSkill)) {
      eligible = false;
      ineligibleReason = `Teknisyen gerekli yetkinliğe (${request.requiredSkill}) sahip değil.`;
    }

    // Working hours & days check
    if (eligible) {
      const startDate = new Date(slot.start);
      const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
      if (!tech.workingDays.includes(dayOfWeek)) {
        eligible = false;
        ineligibleReason = 'Seçilen gün teknisyenin çalışma günleri dışındadır.';
      } else {
        const startMin = startDate.getHours() * 60 + startDate.getMinutes();
        const endDate = new Date(slot.end);
        const endMin = endDate.getHours() * 60 + endDate.getMinutes();

        const [tStartH, tStartM] = tech.workingHoursStart.split(':').map(Number);
        const [tEndH, tEndM] = tech.workingHoursEnd.split(':').map(Number);
        const techStartMin = tStartH * 60 + tStartM;
        const techEndMin = tEndH * 60 + tEndM;

        if (startMin < techStartMin || endMin > techEndMin) {
          eligible = false;
          ineligibleReason = `Çalışma saatleri dışında (${tech.workingHoursStart} - ${tech.workingHoursEnd}).`;
        }
      }
    }

    // Overlap check
    if (eligible && this.schedulingService.technicianHasConflict(tech.id, slot)) {
      eligible = false;
      ineligibleReason = 'Teknisyenin bu saat diliminde başka bir iş emri bulunuyor.';
    }

    if (!eligible) {
      return {
        technician: tech,
        totalScore: 0,
        eligible: false,
        ineligibleReason,
        breakdown: {
          skillsScore: 0,
          proximityScore: 0,
          availabilityScore: 0,
          workloadScore: 0,
          performanceScore: 0,
          slaUrgencyScore: 0
        },
        explanation: [ineligibleReason]
      };
    }

    // 2. Score Calculations (Max 100 points)
    const skillsScore = this.calculateSkillScore(tech, request);
    const proximityScore = this.calculateProximityScore(tech, request);
    const availabilityScore = this.calculateAvailabilityScore(tech, slot);
    const workloadScore = this.calculateDailyLoadScore(tech, slot.start.split('T')[0]);
    const performanceScore = this.calculatePerformanceScore(tech);
    const slaUrgencyScore = this.calculateSlaUrgencyScore(tech, request);

    const totalScore = skillsScore + proximityScore + availabilityScore + workloadScore + performanceScore + slaUrgencyScore;

    const reqSkillLevel = tech.skillLevels?.[request.requiredSkill];
    const skillLevelLabel = reqSkillLevel ? SKILL_LEVEL_LABELS[reqSkillLevel] : '–';
    explanation.push(`Yetkinlik ve Seviye Uyum Puanı: ${skillsScore}/30 (Kıdem: ${tech.level}, Yetkinlik seviyesi: ${skillLevelLabel})`);
    explanation.push(this.describeProximity(proximityScore, tech, request));

    explanation.push(`Zaman Müsaitlik Puanı: ${availabilityScore}/20`);
    explanation.push(`Günlük İş Yükü Puanı: ${workloadScore}/10`);
    explanation.push(`Teknisyen Performans Puanı: ${performanceScore}/10 (Mevcut Performans: ${tech.performanceScore})`);
    explanation.push(`SLA Aciliyet Puanı: ${slaUrgencyScore}/10 (Talep Önceliği: ${request.priority})`);

    return {
      technician: tech,
      totalScore,
      eligible: true,
      breakdown: {
        skillsScore,
        proximityScore,
        availabilityScore,
        workloadScore,
        performanceScore,
        slaUrgencyScore
      },
      explanation
    };
  }

  private calculateSkillScore(tech: Technician, request: ServiceRequest): number {
    // Toplam max 30 puan = kıdem (max 20) + bu yetkinlikteki seviye (max 10)
    const seniorityMap: Record<string, number> = {
      JUNIOR: 6,
      MID: 12,
      SENIOR: 16,
      EXPERT: 20
    };
    const seniorityPart = seniorityMap[tech.level] ?? 6;

    // Bu yetkinlik için seviye (Başlangıç/Orta/Uzman). Eski kayıtlarda yoksa Başlangıç sayılır.
    const reqSkillLevel = tech.skillLevels?.[request.requiredSkill] ?? 'BEGINNER';
    const skillWeight = SKILL_LEVEL_WEIGHTS[reqSkillLevel]; // 0.5 / 0.75 / 1.0
    const skillPart = Math.round(10 * skillWeight); // 5 / 8 / 10

    return seniorityPart + skillPart;
  }

  private calculateProximityScore(tech: Technician, request: ServiceRequest): number {
    // Max 20 puan. Talebin şubesi üzerinden gerçek şube bilgisine erişip,
    // teknisyenin şubesi/bölgesi/şehri ile karşılaştırılır.
    const requestBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, request.branchId);
    const techBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, tech.branchId);
    if (!requestBranch || !techBranch) return 0;

    // 1) Aynı şube → tam puan
    if (tech.branchId === request.branchId) return 20;

    // 2) Şube serviceAreas içinde teknisyen bölgesi geçiyor mu? → 15
    const techRegion = (tech.region || '').trim().toLowerCase();
    const reqServiceAreas = (requestBranch.serviceAreas || []).map(s => s.toLowerCase());
    if (techRegion && reqServiceAreas.includes(techRegion)) return 15;

    // 3) Aynı şehir → 10
    if (requestBranch.city && techBranch.city &&
        requestBranch.city.toLowerCase() === techBranch.city.toLowerCase()) {
      return 10;
    }

    // 4) Aynı bölge (region kelimesi ile)
    if (techRegion && requestBranch.district.toLowerCase() === techRegion) return 8;

    return 0;
  }

  private describeProximity(score: number, tech: Technician, request: ServiceRequest): string {
    const requestBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, request.branchId);
    const branchName = requestBranch?.name ?? request.branchId;
    if (score === 20) return `Bölge Uyum Puanı: 20/20 (Aynı şube: ${branchName})`;
    if (score === 15) return `Bölge Uyum Puanı: 15/20 (Teknisyen bölgesi şubenin hizmet alanında: ${tech.region})`;
    if (score === 10) return `Bölge Uyum Puanı: 10/20 (Aynı şehir, farklı şube)`;
    if (score === 8)  return `Bölge Uyum Puanı: 8/20 (Yakın bölge eşleşmesi)`;
    return 'Bölge Uyum Puanı: 0/20 (Eşleşme yok)';
  }

  private calculateAvailabilityScore(tech: Technician, slot: TimeSlot): number {
    // Max 20 points
    // Check buffer from other jobs on that day
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const dateStr = slot.start.split('T')[0];
    
    const techJobs = workOrders.filter(wo => {
      if (wo.technicianId !== tech.id) return false;
      if (wo.status === 'CANCELLED' || wo.status === 'FAILED') return false;
      if (!wo.plannedStart) return false;
      return wo.plannedStart.startsWith(dateStr);
    });

    if (techJobs.length === 0) {
      return 20; // 0 jobs today = perfect availability
    }

    // Check buffer duration
    const slotStart = new Date(slot.start).getTime();
    const slotEnd = new Date(slot.end).getTime();
    let minBufferMs = Infinity;

    for (const job of techJobs) {
      if (!job.plannedStart || !job.plannedEnd) continue;
      const jobStart = new Date(job.plannedStart).getTime();
      const jobEnd = new Date(job.plannedEnd).getTime();

      // Buffer before or after
      if (jobStart >= slotEnd) {
        minBufferMs = Math.min(minBufferMs, jobStart - slotEnd);
      } else if (slotStart >= jobEnd) {
        minBufferMs = Math.min(minBufferMs, slotStart - jobEnd);
      }
    }

    const minBufferMin = minBufferMs / (1000 * 60);
    if (minBufferMin >= 60) {
      return 20; // 60+ minutes buffer
    } else if (minBufferMin >= 30) {
      return 15; // 30-59 minutes buffer
    } else {
      return 10; // short buffer
    }
  }

  private calculateDailyLoadScore(tech: Technician, date: string): number {
    // Max 10 points
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const count = workOrders.filter(wo => {
      if (wo.technicianId !== tech.id) return false;
      if (wo.status === 'CANCELLED' || wo.status === 'FAILED') return false;
      if (!wo.plannedStart) return false;
      return wo.plannedStart.startsWith(date);
    }).length;

    if (count === 0) return 10;
    if (count === 1) return 7;
    if (count === 2) return 4;
    if (count === 3) return 1;
    return 0;
  }

  private calculatePerformanceScore(tech: Technician): number {
    // Max 10 points
    return Math.round(tech.performanceScore * 0.1);
  }

  private calculateSlaUrgencyScore(tech: Technician, request: ServiceRequest): number {
    // Max 10 points
    // Critical priority matches expert levels, Standard matches junior/mid
    if (request.priority === 'CRITICAL') {
      if (tech.level === 'EXPERT' || tech.level === 'SENIOR') return 10;
      if (tech.level === 'MID') return 6;
      return 2;
    } else if (request.priority === 'URGENT') {
      if (tech.level === 'SENIOR' || tech.level === 'MID') return 10;
      if (tech.level === 'EXPERT') return 8;
      return 4;
    } else {
      // STANDARD
      if (tech.level === 'MID' || tech.level === 'JUNIOR') return 10;
      return 6;
    }
  }
}
