export type VehicleStatus = 'AVAILABLE' | 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface Vehicle {
  id: string;
  plateNumber: string;
  brand: string;
  model: string;
  vehicleType: string; // Araç Tipi
  branchId: string;
  status: VehicleStatus;
  fuelLevel: number;
  lastMaintenanceDate: string; // ISO
  equipments: string[];
  payloadCapacityKg: number;
  assignedTechnicianId: string | null; // Atanmış teknisyen/sürücü
  isActive: boolean;
  createdAt: string;
}
