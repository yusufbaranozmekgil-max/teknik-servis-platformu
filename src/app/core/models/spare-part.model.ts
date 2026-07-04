export type PartCategory =
  | 'COMPRESSOR'
  | 'BOARD_ELECTRONIC'
  | 'MOTOR'
  | 'SENSOR'
  | 'SEAL_GASKET'
  | 'FILTER'
  | 'CABLE_CONNECTION'
  | 'CONSUMABLES';

export interface SparePart {
  id: string;
  code: string;
  name: string;
  category: PartCategory;
  branchId: string;
  compatibleDevices: string; // Uyumlu cihaz/marka
  unit: 'PCS' | 'METERS' | 'KG' | 'LITERS';
  stockQuantity: number;
  reservedQuantity: number;
  minStockThreshold: number;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
}
