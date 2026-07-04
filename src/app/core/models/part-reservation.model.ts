export interface PartReservation {
  id: string;
  partId: string;
  workOrderId: string;
  quantity: number;
  status: 'ACTIVE' | 'CONSUMED' | 'RELEASED';
  reservedAt: string;
  consumedAt: string | null;
  releasedAt: string | null;
}
