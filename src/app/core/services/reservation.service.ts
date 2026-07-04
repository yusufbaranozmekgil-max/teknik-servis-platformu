import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { PartReservation } from '../models/part-reservation.model';
import { SparePart } from '../models/spare-part.model';
import { RequiredPart, UsedPart, WorkOrder } from '../models/work-order.model';
import { ServiceRequest } from '../models/service-request.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  getAvailableQuantity(partId: string): number {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId);
    if (!part) return 0;
    return part.stockQuantity - part.reservedQuantity;
  }

  validateReservation(partId: string, quantity: number): boolean {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    if (quantity <= 0) return true;
    const available = this.getAvailableQuantity(partId);
    return available >= quantity;
  }

  reservePart(workOrderId: string, partId: string, quantity: number): PartReservation {
    this.permissionService.assertPermission('INVENTORY_RESERVE');
    if (quantity <= 0) {
      throw new Error('Rezervasyon miktarı 0\'dan büyük olmalıdır.');
    }

    // Şartname Kural 10: garanti dışı (ücretli) işlerde müşteri onayı alınmadan
    // parça rezerve / tüketimi yapılamaz. Service-side bağlayıcı kontrol.
    this.assertCustomerApprovalIfNeeded(workOrderId);

    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId);
    if (!part) {
      throw new Error(`Yedek parça bulunamadı (ID: ${partId}).`);
    }

    const available = part.stockQuantity - part.reservedQuantity;
    if (available < quantity) {
      throw new Error(`Yetersiz stok. Parça: ${part.name}, Mevcut: ${part.stockQuantity}, Rezerve: ${part.reservedQuantity}, İstenecek: ${quantity}`);
    }

    // 1. Create reservation
    const reservation: PartReservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      partId,
      workOrderId,
      quantity,
      status: 'ACTIVE',
      reservedAt: new Date().toISOString(),
      consumedAt: null,
      releasedAt: null
    };

    // 2. Save reservation
    this.storage.create<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, reservation);

    // 3. Update SparePart
    const oldPart = { ...part };
    part.reservedQuantity += quantity;
    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId, part);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SPARE_PART',
      entityId: partId,
      oldValue: JSON.stringify(oldPart),
      newValue: JSON.stringify(part),
      description: `Yedek parça rezerve edildi. Miktar: ${quantity}, İş Emri ID: ${workOrderId}`
    });

    return reservation;
  }

  reserveParts(workOrderId: string, requiredParts: RequiredPart[]): PartReservation[] {
    this.permissionService.assertPermission('INVENTORY_RESERVE');

    // Şartname Kural 10: garanti dışı + onaysız işlerde parça çıkışı engellenir.
    this.assertCustomerApprovalIfNeeded(workOrderId);

    // First pass: Validate all parts are available (Atomic check)
    for (const req of requiredParts) {
      if (req.quantity <= 0) continue;
      const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, req.partId);
      if (!part) {
        throw new Error(`Parça bulunamadı (ID: ${req.partId}).`);
      }
      const available = part.stockQuantity - part.reservedQuantity;
      if (available < req.quantity) {
        throw new Error(`Yetersiz stok. Parça: ${part.name}, Talep Edilen: ${req.quantity}, Kullanılabilir: ${available}`);
      }
    }

    // Second pass: Perform actual reservations
    const reservations: PartReservation[] = [];
    for (const req of requiredParts) {
      if (req.quantity <= 0) continue;
      const res = this.reservePart(workOrderId, req.partId, req.quantity);
      reservations.push(res);
    }

    return reservations;
  }

  /**
   * Kural 10 (service-side): garanti dışı işlerde müşteri onayı yoksa rezerve / tüketim reddedilir.
   * Audit log ve SECURITY_VIOLATION izi bırakır.
   */
  private assertCustomerApprovalIfNeeded(workOrderId: string): void {
    const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId);
    if (!wo) return; // Henüz oluşmamış / planlama öncesi — kontrolü bypass etme, üst akış zaten hata verir.
    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (!req) return;
    if (!req.hasWarranty && !req.hasCustomerApproval) {
      this.auditLog.logAction({
        actionType: 'SECURITY_VIOLATION',
        entityType: 'WORK_ORDER',
        entityId: workOrderId,
        oldValue: null,
        newValue: null,
        description: `Kural 10 ihlali engellendi: Garanti dışı işte (${req.code}) müşteri onayı alınmadan parça rezerve / tüketim talebi.`,
        result: 'FAILURE',
        failureReason: 'Garanti dışı işlerde müşteri onayı zorunludur.'
      });
      throw new Error('Garanti dışı işlerde parça çıkışı için müşteri onayı (hasCustomerApproval) zorunludur. Önce müşteri onayını işaretleyin.');
    }
  }

  consumeReservedPart(workOrderId: string, partId: string, usedQuantity: number): void {
    this.permissionService.assertPermission('INVENTORY_CONSUME');
    this.consumeReservedPartCore(workOrderId, partId, usedQuantity);
  }

  consumeReservedParts(workOrderId: string, usedParts: UsedPart[]): void {
    this.permissionService.assertPermission('INVENTORY_CONSUME');
    this.consumeReservedPartsCore(workOrderId, usedParts);
  }

  /**
   * WorkOrder lifecycle hooks (iptal/tamamla/kısmi/başarısız) tarafından çağrılan internal kullanım.
   * Permission kontrolü yapılmaz; bu metot service katmanı dışına PUBLIC API olarak açılmamalıdır.
   * Stok bütünlüğü garantisi consumeReservedPartCore tarafından aynı sıkılıkta uygulanır.
   */
  consumeReservedPartsInternal(workOrderId: string, usedParts: UsedPart[]): void {
    this.consumeReservedPartsCore(workOrderId, usedParts);
  }

  private consumeReservedPartsCore(workOrderId: string, usedParts: UsedPart[]): void {
    const reservations = this.storage.getCollection<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS);
    const activeReservations = reservations.filter(r => r.workOrderId === workOrderId && r.status === 'ACTIVE');

    // 1) Reserve edilmiş parçaları tüket (kullanım <= rezerve)
    for (const res of activeReservations) {
      const usedMatch = usedParts.find(up => up.partId === res.partId);
      const usedQty = usedMatch ? usedMatch.quantity : 0;
      this.consumeReservedPartCore(workOrderId, res.partId, usedQty);
    }

    // 2) Rezerve EDİLMEMİŞ parça kullanımı reddedilir; fallback yoktur.
    for (const up of usedParts) {
      const hasReservation = activeReservations.some(res => res.partId === up.partId);
      if (!hasReservation && up.quantity > 0) {
        throw new Error(`Bu iş emri için '${up.partId}' parçası rezerve edilmemiş. Önce rezervasyon oluşturun.`);
      }
    }
  }

  private consumeReservedPartCore(workOrderId: string, partId: string, usedQuantity: number): void {
    if (usedQuantity < 0) {
      throw new Error('Tüketilen miktar negatif olamaz.');
    }
    const reservations = this.storage.getCollection<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS);
    const res = reservations.find(r => r.workOrderId === workOrderId && r.partId === partId && r.status === 'ACTIVE');
    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId);
    if (!part) throw new Error(`Yedek parça bulunamadı (ID: ${partId}).`);
    if (!res)  throw new Error(`Bu iş emri için bu parça rezerve edilmemiş (partId=${partId}).`);

    const originalReservedQty = res.quantity;
    if (usedQuantity > originalReservedQty) {
      throw new Error(`Kullanılan parça miktarı rezerve edilen miktarı aşamaz. (Kullanılan: ${usedQuantity}, Rezerve: ${originalReservedQty})`);
    }
    if (part.reservedQuantity < originalReservedQty) {
      throw new Error(`Rezervasyon tutarsız: stokta gösterilen rezerve (${part.reservedQuantity}) bu rezervasyondan küçük.`);
    }
    if (part.stockQuantity < usedQuantity) {
      throw new Error(`Mevcut stok (${part.stockQuantity}) tüketilecek miktardan (${usedQuantity}) az.`);
    }

    res.status = 'CONSUMED';
    res.consumedAt = new Date().toISOString();
    this.storage.update<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, res.id, res);

    const oldPart = { ...part };
    part.reservedQuantity = part.reservedQuantity - originalReservedQty;
    part.stockQuantity = part.stockQuantity - usedQuantity;
    this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, partId, part);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'SPARE_PART',
      entityId: partId,
      oldValue: JSON.stringify(oldPart),
      newValue: JSON.stringify(part),
      description: `Rezerve parça tüketildi. Rezervasyon: ${originalReservedQty}, Kullanılan: ${usedQuantity}`
    });

    // Şartname Bölüm 6: Minimum eşik altına düşen parçalar için otomatik bildirim.
    // Sadece tüketim sonrası eşik altına geçtiğinde (önce üstündeyse) tetiklenir — gürültüyü önler.
    const wasAboveThreshold = oldPart.stockQuantity > oldPart.minStockThreshold;
    const isNowAtOrBelow = part.stockQuantity <= part.minStockThreshold;
    if (wasAboveThreshold && isNowAtOrBelow) {
      try {
        this.notificationService.createForRole(
          'WAREHOUSE_MANAGER',
          'LOW_STOCK',
          `Kritik Stok: ${part.name}`,
          `${part.name} (${part.code}) parçası kritik seviyenin altına düştü. Mevcut: ${part.stockQuantity}, Eşik: ${part.minStockThreshold}. İkmal gerekli.`,
          'WARNING',
          { type: 'SPARE_PART', id: part.id, link: '/stok' }
        );
      } catch {
        // Bildirim hatası ana akışı bloklamaz — sadece audit zaten yazıldı.
      }
    }
  }

  releaseReservation(reservationId: string): void {
    this.permissionService.assertPermission('INVENTORY_RESERVE');
    this.releaseReservationCore(reservationId);
  }

  releaseAllReservations(workOrderId: string): void {
    this.permissionService.assertPermission('INVENTORY_RESERVE');
    this.releaseAllReservationsCore(workOrderId);
  }

  /**
   * Internal cleanup — WorkOrder lifecycle hook'larından çağrılır.
   * Permission gerekmediği için TECHNICIAN gibi düşük yetkili rollerin iş emri iptali / başarısız işaretlemesi
   * sırasında rollback yapabilmesini sağlar. PUBLIC API olarak kullanılmamalıdır.
   */
  releaseAllReservationsInternal(workOrderId: string): void {
    this.releaseAllReservationsCore(workOrderId);
  }

  private releaseAllReservationsCore(workOrderId: string): void {
    const reservations = this.storage.getCollection<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS);
    const activeOnes = reservations.filter(r => r.workOrderId === workOrderId && r.status === 'ACTIVE');
    for (const res of activeOnes) this.releaseReservationCore(res.id);
  }

  private releaseReservationCore(reservationId: string): void {
    const res = this.storage.getById<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, reservationId);
    if (!res || res.status !== 'ACTIVE') return;
    const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, res.partId);
    if (part) {
      if (part.reservedQuantity < res.quantity) {
        throw new Error(`Rezervasyon serbest bırakılamaz; stok rezerve değeri (${part.reservedQuantity}) yetersiz.`);
      }
      const oldPart = { ...part };
      part.reservedQuantity = part.reservedQuantity - res.quantity;
      this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, part.id, part);
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'SPARE_PART',
        entityId: part.id,
        oldValue: JSON.stringify(oldPart),
        newValue: JSON.stringify(part),
        description: `Yedek parça rezervasyonu serbest bırakıldı. Miktar: ${res.quantity}`
      });
    }
    res.status = 'RELEASED';
    res.releasedAt = new Date().toISOString();
    this.storage.update<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS, res.id, res);
  }

  rollbackReservations(workOrderId: string): void {
    // WorkOrderService.planWorkOrder içinden çağrılır; planlama hata verirse rollback gerek.
    this.releaseAllReservationsCore(workOrderId);
  }

  getReservationsByWorkOrder(workOrderId: string): PartReservation[] {
    this.permissionService.assertPermission('INVENTORY_VIEW');
    const reservations = this.storage.getCollection<PartReservation>(STORAGE_KEYS.PART_RESERVATIONS);
    return reservations.filter(r => r.workOrderId === workOrderId);
  }
}
