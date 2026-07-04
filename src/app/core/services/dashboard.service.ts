import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { AuthStateService } from '../auth/auth-state.service';
import { Branch } from '../models/branch.model';
import { WorkOrder } from '../models/work-order.model';
import { Technician } from '../models/technician.model';
import { Vehicle } from '../models/vehicle.model';
import { ServiceRequest } from '../models/service-request.model';
import { SparePart } from '../models/spare-part.model';

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate();
}

function isSlaApproaching(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const deadline = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = deadline - now;
  return diff > 0 && diff <= 24 * 60 * 60 * 1000; // 24 hours
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private storage = inject(StorageService);
  private authState = inject(AuthStateService);

  // Collections signals
  branchesSignal = signal<Branch[]>([]);
  workOrdersSignal = signal<WorkOrder[]>([]);
  techniciansSignal = signal<Technician[]>([]);
  vehiclesSignal = signal<Vehicle[]>([]);
  requestsSignal = signal<ServiceRequest[]>([]);
  sparePartsSignal = signal<SparePart[]>([]);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.branchesSignal.set(this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES));
    this.workOrdersSignal.set(this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS));
    this.techniciansSignal.set(this.storage.getCollection<Technician>(STORAGE_KEYS.TECHNICIANS));
    this.vehiclesSignal.set(this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES));
    this.requestsSignal.set(this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS));
    this.sparePartsSignal.set(this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS));
  }

  // Current User Branch ID & Override Signal
  userBranchId = computed(() => this.authState.currentUser()?.branchId);
  selectedBranchIdOverride = signal<string | null>(null);
  activeBranchId = computed(() => this.selectedBranchIdOverride() || this.userBranchId());

  // 1. Branch Manager Metrics
  branchManagerMetrics = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return null;

    const branches = this.branchesSignal();
    const workOrders = this.workOrdersSignal();
    const spareParts = this.sparePartsSignal();
    const requests = this.requestsSignal();

    const branch = branches.find(b => b.id === branchId);
    const capacity = branch ? branch.dailyCapacity : 0;

    // Daily occupancy rate: (Today's PLANNED, ON_THE_WAY, ON_SITE work orders / Branch Capacity) * 100
    const ACTIVE_LOAD_STATUSES = new Set(['PLANNED', 'ON_THE_WAY', 'ON_SITE']);
    const todayWorkOrders = workOrders.filter(w => w.branchId === branchId && w.plannedStart && isToday(w.plannedStart) && ACTIVE_LOAD_STATUSES.has(w.status));
    const occupancyRate = capacity > 0 ? Math.round((todayWorkOrders.length / capacity) * 100) : 0;

    // Critical parts
    const criticalParts = spareParts.filter(p => p.branchId === branchId && p.stockQuantity <= p.minStockThreshold && p.isActive);

    // Today's open work orders
    const todayOpenWorkOrders = workOrders.filter(w => w.branchId === branchId && w.plannedStart && isToday(w.plannedStart) && ['OPENED', 'PLANNED', 'ON_THE_WAY', 'ON_SITE', 'IN_PROGRESS'].includes(w.status));

    // Today's completed work orders
    const todayCompletedWorkOrders = workOrders.filter(w => w.branchId === branchId && w.plannedStart && isToday(w.plannedStart) && w.status === 'COMPLETED');

    // Planning ready requests (status = NEW)
    const readyRequests = requests.filter(r => r.branchId === branchId && r.status === 'NEW');

    // SLA approaching requests (within 24 hours, not closed/cancelled)
    const slaApproaching = requests.filter(r => r.branchId === branchId && r.status !== 'CLOSED' && r.status !== 'CANCELLED' && isSlaApproaching(r.slaDeadline));

    return {
      occupancyRate,
      activeCount: todayWorkOrders.length,
      capacity,
      criticalPartsCount: criticalParts.length,
      criticalParts,
      todayOpenWorkOrdersCount: todayOpenWorkOrders.length,
      todayOpenWorkOrders,
      todayCompletedWorkOrdersCount: todayCompletedWorkOrders.length,
      todayCompletedWorkOrders,
      readyRequestsCount: readyRequests.length,
      readyRequests,
      slaApproachingCount: slaApproaching.length,
      slaApproaching
    };
  });

  // 2. Dispatcher Metrics
  dispatcherMetrics = computed(() => {
    const branchId = this.activeBranchId();
    const workOrders = this.workOrdersSignal();
    const requests = this.requestsSignal();
    const technicians = this.techniciansSignal();

    const filteredRequests = branchId ? requests.filter(r => r.branchId === branchId) : requests;
    const filteredWorkOrders = branchId ? workOrders.filter(w => w.branchId === branchId) : workOrders;
    const filteredTechnicians = branchId ? technicians.filter(t => t.branchId === branchId) : technicians;

    // Open requests (status !== CLOSED and status !== CANCELLED)
    const openRequests = filteredRequests.filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED');

    // Critical or SLA approaching requests
    const criticalOrSlaApproaching = filteredRequests.filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED' && (r.priority === 'CRITICAL' || isSlaApproaching(r.slaDeadline)));

    // Unassigned work orders (no technician assigned)
    const unassignedWorkOrders = filteredWorkOrders.filter(w => !w.technicianId && w.status !== 'CANCELLED');

    // Delayed work orders (plannedEnd passed, not completed/cancelled/failed)
    const delayedWorkOrders = filteredWorkOrders.filter(w => w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && w.plannedEnd && new Date(w.plannedEnd).getTime() < Date.now());

    // Available technicians (isActive, not isOnLeave)
    const availableTechnicians = filteredTechnicians.filter(t => t.isActive && !t.isOnLeave);

    // Today's planned work orders
    const todayPlannedWorkOrders = filteredWorkOrders.filter(w => w.plannedStart && isToday(w.plannedStart) && ['PLANNED', 'OPENED'].includes(w.status));

    return {
      openRequestsCount: openRequests.length,
      openRequests,
      criticalOrSlaApproachingCount: criticalOrSlaApproaching.length,
      criticalOrSlaApproaching,
      unassignedWorkOrdersCount: unassignedWorkOrders.length,
      unassignedWorkOrders,
      delayedWorkOrdersCount: delayedWorkOrders.length,
      delayedWorkOrders,
      availableTechniciansCount: availableTechnicians.length,
      availableTechnicians,
      todayPlannedWorkOrdersCount: todayPlannedWorkOrders.length,
      todayPlannedWorkOrders
    };
  });

  // 3. Operation Manager Metrics
  operationManagerMetrics = computed(() => {
    const branches = this.branchesSignal();
    const workOrders = this.workOrdersSignal();
    const vehicles = this.vehiclesSignal();
    const technicians = this.techniciansSignal();

    // Şube yük dağılımı: yalnızca operasyonel olarak bugünkü AKTİF iş emirleri sayılır.
    // COMPLETED / PARTIALLY_COMPLETED / CANCELLED / FAILED kapasite doldurmaz.
    const ACTIVE_LOAD_STATUSES = new Set(['PLANNED', 'ON_THE_WAY', 'ON_SITE']);
    const loadDistribution = branches.map(b => {
      const activeCount = workOrders.filter(w => 
        w.branchId === b.id && 
        w.plannedStart && 
        isToday(w.plannedStart) && 
        ACTIVE_LOAD_STATUSES.has(w.status)
      ).length;
      const capacity = b.dailyCapacity || 0;
      const occupancyPercent = capacity > 0 ? Math.round((activeCount / capacity) * 100) : 0;
      return {
        branchId: b.id,
        branchName: b.name,
        count: activeCount,
        capacity,
        occupancyPercent,                                    // gerçek %, 100'ü aşabilir
        occupancyBarWidth: Math.min(100, occupancyPercent)   // bar görseli için 100 ile sınırlı
      };
    });

    // Vehicles count by status
    const activeVehicles = vehicles.filter(v => v.status === 'ACTIVE' && v.isActive).length;
    const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE' && v.isActive).length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'MAINTENANCE' && v.isActive).length;
    const outOfServiceVehicles = vehicles.filter(v => v.status === 'OUT_OF_SERVICE' && v.isActive).length;

    // Vehicles approaching maintenance (> 150 days since last maintenance)
    const approachingMaintVehicles = vehicles.filter(v => {
      if (!v.isActive || !v.lastMaintenanceDate) return false;
      const days = (Date.now() - new Date(v.lastMaintenanceDate).getTime()) / (1000 * 60 * 60 * 24);
      return days > 150;
    });

    // Low fuel vehicles (< 30%)
    const lowFuelVehicles = vehicles.filter(v => v.isActive && v.fuelLevel < 30);

    // Delayed work orders
    const delayedWorkOrders = workOrders.filter(w => w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && w.plannedEnd && new Date(w.plannedEnd).getTime() < Date.now());

    // Branch performance comparison: average performance score of technicians in each branch
    const branchPerformance = branches.map(b => {
      const branchTechs = technicians.filter(t => t.branchId === b.id && t.isActive);
      const totalScore = branchTechs.reduce((sum, t) => sum + (t.performanceScore || 0), 0);
      const avgPerformance = branchTechs.length > 0 ? Math.round(totalScore / branchTechs.length) : 0;
      return {
        branchId: b.id,
        branchName: b.name,
        avgPerformance
      };
    });

    return {
      loadDistribution,
      vehiclesStatus: {
        active: activeVehicles,
        available: availableVehicles,
        maintenance: maintenanceVehicles,
        outOfService: outOfServiceVehicles
      },
      approachingMaintVehiclesCount: approachingMaintVehicles.length,
      approachingMaintVehicles,
      lowFuelVehiclesCount: lowFuelVehicles.length,
      lowFuelVehicles,
      delayedWorkOrdersCount: delayedWorkOrders.length,
      delayedWorkOrders,
      branchPerformance
    };
  });

  // 4. Reporting User Metrics — organizasyon geneli özet (sadece raporlama yetkilisi için)
  reportingUserMetrics = computed(() => {
    const branches = this.branchesSignal();
    const workOrders = this.workOrdersSignal();
    const requests = this.requestsSignal();
    const technicians = this.techniciansSignal();
    const vehicles = this.vehiclesSignal();
    const spareParts = this.sparePartsSignal();

    const activeBranches = branches.filter(b => b.isActive).length;
    const activeTechnicians = technicians.filter(t => t.isActive).length;
    const activeVehiclesCount = vehicles.filter(v => v.isActive).length;

    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(w => w.status === 'COMPLETED').length;
    const inProgressWorkOrders = workOrders.filter(w => ['PLANNED', 'ON_THE_WAY', 'ON_SITE', 'IN_PROGRESS'].includes(w.status)).length;
    const cancelledWorkOrders = workOrders.filter(w => w.status === 'CANCELLED').length;
    const partiallyCompletedWorkOrders = workOrders.filter(w => w.status === 'PARTIALLY_COMPLETED').length;
    const failedWorkOrders = workOrders.filter(w => w.status === 'FAILED').length;

    const completionRate = totalWorkOrders > 0
      ? Math.round((completedWorkOrders / totalWorkOrders) * 100)
      : 0;

    const totalRequests = requests.length;
    const openRequests = requests.filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED').length;
    const slaBreached = requests.filter(r => {
      if (r.status === 'CLOSED' || r.status === 'CANCELLED' || !r.slaDeadline) return false;
      return new Date(r.slaDeadline).getTime() < Date.now();
    }).length;
    const slaApproaching = requests.filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED' && isSlaApproaching(r.slaDeadline)).length;

    const criticalPartsCount = spareParts.filter(p => p.isActive && p.stockQuantity <= p.minStockThreshold).length;

    const avgPerformance = (() => {
      const actives = technicians.filter(t => t.isActive);
      if (actives.length === 0) return 0;
      const sum = actives.reduce((s, t) => s + (t.performanceScore || 0), 0);
      return Math.round(sum / actives.length);
    })();

    const topBranches = branches.map(b => {
      const branchWO = workOrders.filter(w => w.branchId === b.id && w.status === 'COMPLETED').length;
      return { branchId: b.id, branchName: b.name, completedCount: branchWO };
    }).sort((a, b) => b.completedCount - a.completedCount).slice(0, 5);

    return {
      activeBranches,
      activeTechnicians,
      activeVehicles: activeVehiclesCount,
      totalWorkOrders,
      completedWorkOrders,
      inProgressWorkOrders,
      cancelledWorkOrders,
      partiallyCompletedWorkOrders,
      failedWorkOrders,
      completionRate,
      totalRequests,
      openRequests,
      slaBreached,
      slaApproaching,
      criticalPartsCount,
      avgPerformance,
      topBranches
    };
  });
}
