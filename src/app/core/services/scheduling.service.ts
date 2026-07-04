import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { WorkOrder } from '../models/work-order.model';
import { Technician } from '../models/technician.model';
import { Vehicle } from '../models/vehicle.model';
import { Branch } from '../models/branch.model';
import { TimeSlot } from '../models/time-slot.model';
import { PermissionService } from './permission.service';
import { ServiceRequest } from '../models/service-request.model';

@Injectable({
  providedIn: 'root'
})
export class SchedulingService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);

  isOverlapping(slotA: TimeSlot, slotB: TimeSlot): boolean {
    const startA = new Date(slotA.start).getTime();
    const endA = new Date(slotA.end).getTime();
    const startB = new Date(slotB.start).getTime();
    const endB = new Date(slotB.end).getTime();
    return startA < endB && startB < endA;
  }

  technicianHasConflict(technicianId: string, slot: TimeSlot, excludeWorkOrderId?: string): boolean {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    return workOrders.some(wo => {
      if (wo.id === excludeWorkOrderId) return false;
      if (wo.technicianId !== technicianId) return false;
      // Yalnız aktif işler zaman dilimini işgal eder. Tamamlanan/kısmi/başarısız/iptal
      // iş emirleri teknisyenin slot'unu serbest bırakır (Şartname Bölüm 9).
      if (!SchedulingService.ACTIVE_STATUSES.has(wo.status)) return false;
      if (!wo.plannedStart || !wo.plannedEnd) return false;
      return this.isOverlapping(slot, { start: wo.plannedStart, end: wo.plannedEnd });
    });
  }

  vehicleHasConflict(vehicleId: string, slot: TimeSlot, excludeWorkOrderId?: string): boolean {
    this.permissionService.assertPermission('VEHICLE_VIEW');
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    return workOrders.some(wo => {
      if (wo.id === excludeWorkOrderId) return false;
      if (wo.vehicleId !== vehicleId) return false;
      // Yalnız aktif işler aracı işgal eder; tamamlanan/başarısız/iptal görev aracı serbest bırakır.
      if (!SchedulingService.ACTIVE_STATUSES.has(wo.status)) return false;
      if (!wo.plannedStart || !wo.plannedEnd) return false;
      return this.isOverlapping(slot, { start: wo.plannedStart, end: wo.plannedEnd });
    });
  }

  // Aktif (henüz bitmemiş) iş emri durumları kapasiteyi/zaman dilimini doldurur.
  // COMPLETED/PARTIALLY_COMPLETED/CANCELLED/FAILED sayılmaz.
  private static readonly ACTIVE_STATUSES = new Set(['PLANNED', 'ON_THE_WAY', 'ON_SITE']);

  branchCapacityExceeded(branchId: string, date: string): boolean {
    this.permissionService.assertPermission('BRANCH_VIEW');
    const branch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, branchId);
    if (!branch) return true;
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);

    const count = workOrders.filter(wo => {
      if (wo.branchId !== branchId) return false;
      if (!SchedulingService.ACTIVE_STATUSES.has(wo.status)) return false;
      if (!wo.plannedStart) return false;
      return wo.plannedStart.split('T')[0] === date;
    }).length;

    return count >= branch.dailyCapacity;
  }

  technicianDailyCapacityExceeded(technicianId: string, date: string): boolean {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    const cap = tech?.dailyCapacity ?? 4; // model alanı yoksa eski varsayılan
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const count = workOrders.filter(wo => {
      if (wo.technicianId !== technicianId) return false;
      if (!SchedulingService.ACTIVE_STATUSES.has(wo.status)) return false;
      if (!wo.plannedStart) return false;
      return wo.plannedStart.split('T')[0] === date;
    }).length;

    return count >= cap;
  }

  getTechnicianDailyCapacity(technicianId: string): number {
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    return tech?.dailyCapacity ?? 4;
  }

  isWithinTechnicianWorkingHours(technicianId: string, slot: TimeSlot): boolean {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) return false;

    const startDate = new Date(slot.start);
    const endDate = new Date(slot.end);
    
    const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
    if (!tech.workingDays.includes(dayOfWeek)) {
      return false;
    }

    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const endMin = endDate.getHours() * 60 + endDate.getMinutes();

    const [techStartH, techStartM] = tech.workingHoursStart.split(':').map(Number);
    const [techEndH, techEndM] = tech.workingHoursEnd.split(':').map(Number);
    const techStartMin = techStartH * 60 + techStartM;
    const techEndMin = techEndH * 60 + techEndM;

    return startMin >= techStartMin && endMin <= techEndMin;
  }

  isTechnicianAvailable(technicianId: string, slot: TimeSlot): boolean {
    this.permissionService.assertPermission('TECHNICIAN_VIEW');
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) return false;
    if (!tech.isActive) return false;

    if (tech.isOnLeave && tech.leaveStart && tech.leaveEnd) {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      const leaveStart = new Date(tech.leaveStart).getTime();
      const leaveEnd = new Date(tech.leaveEnd).getTime();
      if (slotStart < leaveEnd && leaveStart < slotEnd) {
        return false;
      }
    }

    if (!this.isWithinTechnicianWorkingHours(technicianId, slot)) {
      return false;
    }

    if (this.technicianHasConflict(technicianId, slot)) {
      return false;
    }

    const dateStr = slot.start.split('T')[0];
    if (this.technicianDailyCapacityExceeded(technicianId, dateStr)) {
      return false;
    }

    return true;
  }

  validateAssignmentAvailability(
    technicianId: string,
    vehicleId: string,
    slot: TimeSlot,
    branchId: string,
    excludeWorkOrderId?: string
  ): { valid: boolean; reason?: string } {
    this.permissionService.assertPermission('WORK_ORDER_PLAN');

    const branch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, branchId);
    if (!branch) {
      return { valid: false, reason: 'Şube bulunamadı.' };
    }
    if (!branch.isActive) {
      return { valid: false, reason: 'Şube aktif değil.' };
    }

    const startDate = new Date(slot.start);
    const endDate = new Date(slot.end);
    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const endMin = endDate.getHours() * 60 + endDate.getMinutes();
    const [bStartH, bStartM] = branch.workingHoursStart.split(':').map(Number);
    const [bEndH, bEndM] = branch.workingHoursEnd.split(':').map(Number);
    const bStartMin = bStartH * 60 + bStartM;
    const bEndMin = bEndH * 60 + bEndM;

    if (startMin < bStartMin || endMin > bEndMin) {
      return { valid: false, reason: `Seçilen saatler şube çalışma saatleri dışındadır (${branch.workingHoursStart} - ${branch.workingHoursEnd}).` };
    }

    const dateStr = slot.start.split('T')[0];
    if (this.branchCapacityExceeded(branchId, dateStr)) {
      return { valid: false, reason: 'Şubenin günlük iş kapasitesi aşılmıştır.' };
    }

    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) {
      return { valid: false, reason: 'Teknisyen bulunamadı.' };
    }
    if (!tech.isActive) {
      return { valid: false, reason: 'Teknisyen aktif değil.' };
    }

    // Verify technician skill compatibility
    if (excludeWorkOrderId) {
      const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, excludeWorkOrderId);
      if (wo) {
        const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
        if (req && !tech.skills.includes(req.requiredSkill)) {
          return { valid: false, reason: `Teknisyen yetkinliği yetersiz. Gerekli yetkinlik: ${req.requiredSkill}` };
        }
      }
    }
    if (tech.isOnLeave && tech.leaveStart && tech.leaveEnd) {
      const slotStart = startDate.getTime();
      const slotEnd = endDate.getTime();
      const leaveStart = new Date(tech.leaveStart).getTime();
      const leaveEnd = new Date(tech.leaveEnd).getTime();
      if (slotStart < leaveEnd && leaveStart < slotEnd) {
        return { valid: false, reason: 'Teknisyen belirtilen tarihte izinlidir.' };
      }
    }

    const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
    if (!tech.workingDays.includes(dayOfWeek)) {
      return { valid: false, reason: 'Seçilen gün teknisyenin çalışma günleri dışındadır.' };
    }

    const techStartMin = tech.workingHoursStart.split(':').map(Number).reduce((h, m) => h * 60 + m);
    const techEndMin = tech.workingHoursEnd.split(':').map(Number).reduce((h, m) => h * 60 + m);
    if (startMin < techStartMin || endMin > techEndMin) {
      return { valid: false, reason: `Seçilen saatler teknisyenin çalışma saatleri dışındadır (${tech.workingHoursStart} - ${tech.workingHoursEnd}).` };
    }

    if (this.technicianHasConflict(technicianId, slot, excludeWorkOrderId)) {
      return { valid: false, reason: 'Teknisyenin bu saat diliminde başka bir işi bulunmaktadır.' };
    }

    if (this.technicianDailyCapacityExceeded(technicianId, dateStr)) {
      const cap = this.getTechnicianDailyCapacity(technicianId);
      return { valid: false, reason: `Teknisyenin günlük maksimum iş kapasitesi (${cap} iş) aşılmıştır.` };
    }

    const vehicle = this.storage.getById<Vehicle>(STORAGE_KEYS.VEHICLES, vehicleId);
    if (!vehicle) {
      return { valid: false, reason: 'Araç bulunamadı.' };
    }
    if (vehicle.status === 'MAINTENANCE') {
      return { valid: false, reason: 'Araç bakımda olduğu için atanamaz.' };
    }
    if (vehicle.status === 'OUT_OF_SERVICE') {
      return { valid: false, reason: 'Araç hizmet dışı olduğu için atanamaz.' };
    }
    if (vehicle.fuelLevel < 30) {
      return { valid: false, reason: 'Aracın yakıt seviyesi %30 altındadır.' };
    }

    if (this.vehicleHasConflict(vehicleId, slot, excludeWorkOrderId)) {
      return { valid: false, reason: 'Aracın bu saat diliminde başka bir görevi bulunmaktadır.' };
    }

    return { valid: true };
  }
}
