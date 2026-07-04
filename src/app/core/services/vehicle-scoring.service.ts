import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Vehicle } from '../models/vehicle.model';
import { ServiceRequest } from '../models/service-request.model';
import { TimeSlot } from '../models/time-slot.model';
import { WorkOrder } from '../models/work-order.model';
import { Branch } from '../models/branch.model';
import { SchedulingService } from './scheduling.service';
import { PermissionService } from './permission.service';

export interface VehicleScoreResult {
  vehicle: Vehicle;
  totalScore: number;
  eligible: boolean;
  ineligibleReason?: string;
  breakdown: {
    equipmentScore: number;
    capacityScore: number;
    proximityScore: number;
    maintenanceScore: number;
    fuelScore: number;
    availabilityScore: number;
  };
  explanation: string[];
}

@Injectable({
  providedIn: 'root'
})
export class VehicleScoringService {
  private storage = inject(StorageService);
  private schedulingService = inject(SchedulingService);
  private permissionService = inject(PermissionService);

  getEligibleVehicles(requestId: string, slot: TimeSlot): VehicleScoreResult[] {
    this.permissionService.assertPermission('VEHICLE_VIEW');

    const request = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, requestId);
    if (!request) {
      throw new Error('Hizmet talebi bulunamadı.');
    }

    const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
    const results: VehicleScoreResult[] = [];

    for (const vehicle of vehicles) {
      const scoreResult = this.calculateVehicleScore(vehicle, request, slot);
      results.push(scoreResult);
    }

    // Sort by eligibility first, then total score descending
    return results.sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.totalScore - a.totalScore;
    });
  }

  calculateVehicleScore(vehicle: Vehicle, request: ServiceRequest, slot: TimeSlot): VehicleScoreResult {
    this.permissionService.assertPermission('VEHICLE_VIEW');

    const explanation: string[] = [];
    let eligible = true;
    let ineligibleReason = '';

    // 1. Eligibility Filters
    if (!vehicle.isActive) {
      eligible = false;
      ineligibleReason = 'Araç aktif değil.';
    }

    if (eligible && vehicle.status === 'MAINTENANCE') {
      eligible = false;
      ineligibleReason = 'Araç bakımda.';
    }

    if (eligible && vehicle.status === 'OUT_OF_SERVICE') {
      eligible = false;
      ineligibleReason = 'Araç hizmet dışı.';
    }

    // Fuel level check
    if (eligible && vehicle.fuelLevel < 30) {
      eligible = false;
      ineligibleReason = `Yakıt seviyesi %30'un altında (Mevcut: %${vehicle.fuelLevel}).`;
    }

    // Maintenance day limit check (180 days)
    let daysSinceMaint = 0;
    if (eligible) {
      const maintDate = new Date(vehicle.lastMaintenanceDate).getTime();
      const diffMs = Date.now() - maintDate;
      daysSinceMaint = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSinceMaint > 180) {
        eligible = false;
        ineligibleReason = `Son bakımın üzerinden 180 günden fazla zaman geçti (${daysSinceMaint} gün).`;
      }
    }

    // Required Equipment Check
    const requiredEquip = this.getRequiredEquipment(request.requiredSkill);
    if (eligible) {
      const missing = requiredEquip.filter(eq => !vehicle.equipments.includes(eq));
      if (missing.length > 0) {
        eligible = false;
        ineligibleReason = `Gerekli ekipmanlar eksik: ${missing.join(', ')}`;
      }
    }

    // Payload Capacity Check
    const estimatedWeight = this.getEstimatedPayloadWeight(request.requiredSkill);
    if (eligible && vehicle.payloadCapacityKg < estimatedWeight) {
      eligible = false;
      ineligibleReason = `Yük kapasitesi yetersiz (Gereken: ${estimatedWeight} kg, Mevcut: ${vehicle.payloadCapacityKg} kg).`;
    }

    // Scheduling Overlap check
    if (eligible && this.schedulingService.vehicleHasConflict(vehicle.id, slot)) {
      eligible = false;
      ineligibleReason = 'Aracın bu saat diliminde başka bir görevi bulunuyor.';
    }

    if (!eligible) {
      return {
        vehicle,
        totalScore: 0,
        eligible: false,
        ineligibleReason,
        breakdown: {
          equipmentScore: 0,
          capacityScore: 0,
          proximityScore: 0,
          maintenanceScore: 0,
          fuelScore: 0,
          availabilityScore: 0
        },
        explanation: [ineligibleReason]
      };
    }

    // 2. Score Calculations (Max 100 points)
    const equipmentScore = 30; // Pre-filtered, so they have all required ones
    const capacityScore = this.calculateCapacityScore(vehicle, estimatedWeight);
    const proximityScore = this.calculateProximityScore(vehicle, request);
    const maintenanceScore = this.calculateMaintenanceScore(daysSinceMaint);
    const fuelScore = Math.round(vehicle.fuelLevel * 0.1);
    const availabilityScore = this.calculateAvailabilityScore(vehicle, slot.start.split('T')[0]);

    const totalScore = equipmentScore + capacityScore + proximityScore + maintenanceScore + fuelScore + availabilityScore;

    explanation.push(`Ekipman Seti Puanı: ${equipmentScore}/30 (Tüm gerekli aletler mevcut: ${requiredEquip.join(', ')})`);
    explanation.push(`Yük Kapasitesi Yeterlilik Puanı: ${capacityScore}/20 (Kapasite: ${vehicle.payloadCapacityKg} kg, Tahmini Yük: ${estimatedWeight} kg)`);
    explanation.push(this.describeProximity(proximityScore, vehicle, request));
    explanation.push(`Bakım Durumu Puanı: ${maintenanceScore}/15 (Son bakımdan beri ${daysSinceMaint} gün geçti)`);
    explanation.push(`Yakıt Seviyesi Puanı: ${fuelScore}/10 (Yakıt Seviyesi: %${vehicle.fuelLevel})`);
    explanation.push(`Zaman Planlaması Müsaitlik Puanı: ${availabilityScore}/10`);

    return {
      vehicle,
      totalScore,
      eligible: true,
      breakdown: {
        equipmentScore,
        capacityScore,
        proximityScore,
        maintenanceScore,
        fuelScore,
        availabilityScore
      },
      explanation
    };
  }

  private calculateProximityScore(vehicle: Vehicle, request: ServiceRequest): number {
    // Max 15 puan, kademe kademe yakınlık.
    if (vehicle.branchId === request.branchId) return 15;
    const reqBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, request.branchId);
    const vehBranch = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, vehicle.branchId);
    if (!reqBranch || !vehBranch) return 0;
    if (reqBranch.city && vehBranch.city && reqBranch.city.toLowerCase() === vehBranch.city.toLowerCase()) {
      return 10;
    }
    const reqAreas = (reqBranch.serviceAreas || []).map(s => s.toLowerCase());
    const vehAreas = (vehBranch.serviceAreas || []).map(s => s.toLowerCase());
    if (reqAreas.some(a => vehAreas.includes(a))) return 8;
    return 0;
  }

  private describeProximity(score: number, vehicle: Vehicle, request: ServiceRequest): string {
    const branchName = this.storage.getById<Branch>(STORAGE_KEYS.BRANCHES, request.branchId)?.name ?? request.branchId;
    if (score === 15) return `Şube Konum Yakınlığı: 15/15 (Talep şubesi: ${branchName})`;
    if (score === 10) return `Şube Konum Yakınlığı: 10/15 (Aynı şehir, farklı şube)`;
    if (score === 8)  return `Şube Konum Yakınlığı: 8/15 (Hizmet bölgesi kesişimi)`;
    return `Şube Konum Yakınlığı: 0/15 (Konum eşleşmesi yok)`;
  }

  getRequiredEquipment(skill: string): string[] {
    const equipMap: Record<string, string[]> = {
      WHITE_GOODS: ['HEAVY_LIFT_STRAPS', 'TOOLKIT_BASIC'],
      HVAC: ['VACUUM_PUMP', 'MANIFOLD_GAUGE'],
      ELECTRIC: ['MULTIMETER', 'INSULATED_TOOLS'],
      ELECTRONICS_MOTHERBOARD: ['SOLDERING_STATION', 'OSCILLOSCOPE'],
      PLUMBING: ['PIPE_WRENCH', 'DRAIN_SNAKE'],
      BOILER_HEATING: ['GAS_LEAK_DETECTOR', 'PRESSURE_GAUGE']
    };
    return equipMap[skill] || ['TOOLKIT_BASIC'];
  }

  getEstimatedPayloadWeight(skill: string): number {
    const weightMap: Record<string, number> = {
      WHITE_GOODS: 80,
      HVAC: 50,
      ELECTRIC: 20,
      ELECTRONICS_MOTHERBOARD: 15,
      PLUMBING: 40,
      BOILER_HEATING: 45
    };
    return weightMap[skill] || 20;
  }

  private calculateCapacityScore(vehicle: Vehicle, estimatedWeight: number): number {
    const ratio = vehicle.payloadCapacityKg / estimatedWeight;
    if (ratio >= 1.5 && ratio <= 3.0) {
      return 20; // Optimal vehicle size
    } else if (ratio > 3.0 && ratio <= 6.0) {
      return 16;
    } else if (ratio > 6.0) {
      return 12; // Over-sized vehicle (waste of fuel/space)
    } else {
      return 18; // Tight capacity
    }
  }

  private calculateMaintenanceScore(days: number): number {
    if (days <= 30) return 15;
    if (days <= 90) return 10;
    return 5;
  }

  private calculateAvailabilityScore(vehicle: Vehicle, date: string): number {
    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const count = workOrders.filter(wo => {
      if (wo.vehicleId !== vehicle.id) return false;
      if (wo.status === 'CANCELLED' || wo.status === 'FAILED') return false;
      if (!wo.plannedStart) return false;
      return wo.plannedStart.startsWith(date);
    }).length;

    if (count === 0) return 10;
    if (count === 1) return 6;
    if (count === 2) return 3;
    return 0;
  }
}
