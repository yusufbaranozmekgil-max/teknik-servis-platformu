export type WorkOrderStatus =
  | 'OPENED'
  | 'PLANNED'
  | 'ON_THE_WAY'
  | 'ON_SITE'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface RequiredPart {
  partId: string;
  quantity: number;
}

export interface UsedPart {
  partId: string;
  quantity: number;
}

export interface WorkOrder {
  id: string;
  code: string;
  serviceRequestId: string;
  branchId: string;
  technicianId: string | null;
  vehicleId: string | null;
  status: WorkOrderStatus;
  plannedStart: string | null; // ISO
  plannedEnd: string | null; // ISO
  actualStart: string | null; // ISO
  actualEnd: string | null; // ISO
  requiredParts: RequiredPart[];
  usedParts: UsedPart[];
  estimatedCost: number;
  actualCost: number;
  failureReason: string | null;
  notes: string;
  // Kural 2: 50.000 TL üzeri işlerde şube sorumlusu onayı — onay verildiğinde true olur.
  managerApproved?: boolean;
  createdAt: string;
}
