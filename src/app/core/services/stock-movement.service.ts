import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StockMovement } from '../models/stock-movement.model';
import { SparePart } from '../models/spare-part.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);

  getStockMovements(): StockMovement[] {
    this.permissionService.assertPermission('STOCK_MOVEMENT_VIEW');
    return this.storage.getCollection<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS);
  }

  createStockMovement(movement: Omit<StockMovement, 'id' | 'createdAt'>): StockMovement {
    this.permissionService.assertPermission('STOCK_MOVEMENT_CREATE');

    if (movement.quantity < 1 || movement.quantity > 100000) {
      throw new Error('Miktar 1 ile 100000 arasında olmalıdır.');
    }
    if (movement.description) {
      if (movement.description.length > 250) {
        throw new Error('Açıklama en fazla 250 karakter olabilir.');
      }
      if (movement.description.trim().length === 0) {
        throw new Error('Açıklama sadece boşluklardan oluşamaz.');
      }
    }

    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, movement.partId);
    if (!part) throw new Error('Stok hareketi yapılacak yedek parça bulunamadı.');

    if (movement.type === 'OUT' || movement.type === 'RESERVE_CONSUME') {
      if (part.stockQuantity < movement.quantity) {
        throw new Error(`Yetersiz stok! Mevcut stok: ${part.stockQuantity}, Istenen: ${movement.quantity}`);
      }
      part.stockQuantity -= movement.quantity;
    } else if (movement.type === 'IN') {
      part.stockQuantity += movement.quantity;
    }

    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, part.id, {
      stockQuantity: part.stockQuantity
    });

    const newMovement: StockMovement = {
      ...movement,
      id: `sm-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS, newMovement);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SPARE_PART',
      entityId: part.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Stok hareketi oluşturuldu (${movement.type}): ${movement.quantity} adet ${part.name}`
    });

    return created;
  }

  /**
   * Şubeler arası transfer: kaynak parçanın stoğundan düşülür, hedef şubedeki
   * aynı kodlu parçanın stoğuna eklenir. Hedefte aynı kodlu parça yoksa reddedilir.
   * İki kayıt yazılır: kaynak için TRANSFER (negatif anlamlı), hedef için TRANSFER (pozitif anlamlı).
   */
  transferBetweenBranches(params: {
    sourcePartId: string;
    targetBranchId: string;
    quantity: number;
    description: string;
  }): { sourceMovement: StockMovement; targetMovement: StockMovement } {
    this.permissionService.assertPermission('STOCK_MOVEMENT_CREATE');

    if (params.quantity < 1 || params.quantity > 100000) {
      throw new Error('Transfer miktarı 1 ile 100000 arasında olmalıdır.');
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new Error('Transfer için açıklama (gerekçe) zorunludur.');
    }
    if (params.description.length > 250) {
      throw new Error('Açıklama en fazla 250 karakter olabilir.');
    }

    const sourcePart = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, params.sourcePartId);
    if (!sourcePart) throw new Error('Kaynak parça bulunamadı.');
    if (sourcePart.branchId === params.targetBranchId) {
      throw new Error('Aynı şubeye transfer yapılamaz.');
    }
    if (sourcePart.stockQuantity < params.quantity) {
      throw new Error(`Kaynak şubede yetersiz stok! Mevcut: ${sourcePart.stockQuantity}, Talep: ${params.quantity}`);
    }
    const reservedQty = sourcePart.reservedQuantity ?? 0;
    if (sourcePart.stockQuantity - reservedQty < params.quantity) {
      throw new Error(`Kullanılabilir stok yetersiz. Rezerve düşülmüş stok: ${sourcePart.stockQuantity - reservedQty}, Talep: ${params.quantity}`);
    }

    const allParts = this.storage.getCollection<SparePart>(STORAGE_KEYS.SPARE_PARTS);
    let targetPart = allParts.find(
      p => p.code === sourcePart.code && p.branchId === params.targetBranchId && p.isActive
    );
    if (!targetPart) {
      throw new Error(`Hedef şubede "${sourcePart.code}" kodlu aktif parça bulunamadı. Önce hedef şubede parça tanımlanmalıdır.`);
    }

    // Stok güncelle (her iki taraf)
    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, sourcePart.id, {
      stockQuantity: sourcePart.stockQuantity - params.quantity
    });
    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, targetPart.id, {
      stockQuantity: targetPart.stockQuantity + params.quantity
    });

    const ts = Date.now();
    const sourceId = `sm-${ts}-out`;
    const targetId = `sm-${ts}-in`;

    const sourceMovement = this.storage.create<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS, {
      id: sourceId,
      partId: sourcePart.id,
      quantity: params.quantity,
      type: 'TRANSFER',
      workOrderId: null,
      description: `Transfer (Çıkış): ${params.description}`,
      createdAt: new Date().toISOString(),
      pairedMovementId: targetId,
      previousQuantity: null,
      newQuantity: null
    });
    const targetMovement = this.storage.create<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS, {
      id: targetId,
      partId: targetPart.id,
      quantity: params.quantity,
      type: 'TRANSFER',
      workOrderId: null,
      description: `Transfer (Giriş): ${params.description}`,
      createdAt: new Date().toISOString(),
      pairedMovementId: sourceId,
      previousQuantity: null,
      newQuantity: null
    });

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SPARE_PART',
      entityId: sourcePart.id,
      oldValue: null,
      newValue: JSON.stringify({ sourceMovement, targetMovement }),
      description: `Şubeler arası transfer: ${params.quantity} adet ${sourcePart.name} (${sourcePart.branchId} → ${params.targetBranchId})`
    });

    return { sourceMovement, targetMovement };
  }

  /**
   * Fire / Hasar: parçanın stoğundan miktar düşülür, FIRE tipi hareket yazılır.
   */
  recordWaste(params: { partId: string; quantity: number; description: string }): StockMovement {
    this.permissionService.assertPermission('STOCK_MOVEMENT_CREATE');

    if (params.quantity < 1 || params.quantity > 100000) {
      throw new Error('Fire miktarı 1 ile 100000 arasında olmalıdır.');
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new Error('Fire / Hasar kaydı için açıklama zorunludur.');
    }
    if (params.description.length > 250) {
      throw new Error('Açıklama en fazla 250 karakter olabilir.');
    }

    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, params.partId);
    if (!part) throw new Error('Parça bulunamadı.');
    if (part.stockQuantity < params.quantity) {
      throw new Error(`Yetersiz stok! Mevcut: ${part.stockQuantity}, Fire kaydı: ${params.quantity}`);
    }

    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, part.id, {
      stockQuantity: part.stockQuantity - params.quantity
    });

    const movement = this.storage.create<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS, {
      id: `sm-${Date.now()}-fire`,
      partId: part.id,
      quantity: params.quantity,
      type: 'FIRE',
      workOrderId: null,
      description: params.description,
      createdAt: new Date().toISOString(),
      pairedMovementId: null,
      previousQuantity: part.stockQuantity,
      newQuantity: part.stockQuantity - params.quantity
    });

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'SPARE_PART',
      entityId: part.id,
      oldValue: null,
      newValue: JSON.stringify(movement),
      description: `Fire / Hasar kaydı: ${params.quantity} adet ${part.name}`
    });

    return movement;
  }

  /**
   * Sayım düzeltmesi: parçanın stoğu mutlak bir değere ayarlanır.
   * Düzeltme miktarı (delta) hareket kaydı olarak yazılır.
   */
  adjustStock(params: { partId: string; newQuantity: number; description: string }): StockMovement {
    this.permissionService.assertPermission('STOCK_MOVEMENT_CREATE');

    if (params.newQuantity < 0 || params.newQuantity > 1_000_000) {
      throw new Error('Sayım değeri 0 ile 1.000.000 arasında olmalıdır.');
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new Error('Sayım düzeltmesi için gerekçe zorunludur.');
    }
    if (params.description.length > 250) {
      throw new Error('Açıklama en fazla 250 karakter olabilir.');
    }

    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, params.partId);
    if (!part) throw new Error('Parça bulunamadı.');

    const previousQty = part.stockQuantity;
    const delta = params.newQuantity - previousQty;

    if (delta === 0) {
      throw new Error('Sayım değeri mevcut stoktan farklı olmalıdır.');
    }
    const reservedQty = part.reservedQuantity ?? 0;
    if (params.newQuantity < reservedQty) {
      throw new Error(`Yeni sayım (${params.newQuantity}) rezerve edilmiş miktardan (${reservedQty}) küçük olamaz.`);
    }

    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, part.id, {
      stockQuantity: params.newQuantity
    });

    const movement = this.storage.create<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS, {
      id: `sm-${Date.now()}-adj`,
      partId: part.id,
      quantity: Math.abs(delta),
      type: 'ADJUSTMENT',
      workOrderId: null,
      description: `${params.description} (Eski: ${previousQty}, Yeni: ${params.newQuantity}, Fark: ${delta > 0 ? '+' : ''}${delta})`,
      createdAt: new Date().toISOString(),
      pairedMovementId: null,
      previousQuantity: previousQty,
      newQuantity: params.newQuantity
    });

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SPARE_PART',
      entityId: part.id,
      oldValue: JSON.stringify({ stockQuantity: previousQty }),
      newValue: JSON.stringify({ stockQuantity: params.newQuantity }),
      description: `Sayım Düzeltmesi: ${part.name} stoğu ${previousQty} → ${params.newQuantity} olarak güncellendi`
    });

    return movement;
  }
}
