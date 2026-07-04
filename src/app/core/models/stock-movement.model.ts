export type StockMovementType =
  | 'IN'
  | 'OUT'
  | 'RESERVE_HOLD'
  | 'RESERVE_RELEASE'
  | 'RESERVE_CONSUME'
  | 'TRANSFER'
  | 'FIRE'
  | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  partId: string;
  quantity: number;
  type: StockMovementType;
  workOrderId: string | null;
  description: string;
  createdAt: string;
  // Transfer için: hareket karşı tarafının parçası (iki kayıt: OUT-style + IN-style),
  // her iki kayıtta da paired hareketin id'si tutulur.
  pairedMovementId?: string | null;
  // Düzeltme için: önceki ve yeni miktar (delta = newQuantity - previousQuantity).
  previousQuantity?: number | null;
  newQuantity?: number | null;
}
