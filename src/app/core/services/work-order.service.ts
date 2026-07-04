import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { WorkOrder, WorkOrderStatus, RequiredPart, UsedPart } from '../models/work-order.model';
import { ServiceRequest } from '../models/service-request.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { SchedulingService } from './scheduling.service';
import { ReservationService } from './reservation.service';
import { NotificationService } from './notification.service';
import { TimeSlot } from '../models/time-slot.model';
import { Technician } from '../models/technician.model';
import { Vehicle } from '../models/vehicle.model';
import { SparePart } from '../models/spare-part.model';
import { InventoryService } from './inventory.service';

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPENED: ['PLANNED', 'CANCELLED'],
  PLANNED: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['ON_SITE', 'FAILED', 'CANCELLED'],
  ON_SITE: ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'],
  COMPLETED: [],
  PARTIALLY_COMPLETED: [],
  FAILED: [],
  CANCELLED: []
};

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private schedulingService = inject(SchedulingService);
  private reservationService = inject(ReservationService);
  private notificationService = inject(NotificationService);
  private inventoryService = inject(InventoryService);

  getWorkOrders(): WorkOrder[] {
    this.permissionService.assertPermission('WORK_ORDER_VIEW');
    return this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
  }

  getWorkOrderById(id: string): WorkOrder | null {
    this.permissionService.assertPermission('WORK_ORDER_VIEW');
    return this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, id);
  }

  createWorkOrderFromRequest(requestId: string): WorkOrder {
    this.permissionService.assertPermission('WORK_ORDER_CREATE');
    
    const request = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, requestId);
    if (!request) {
      throw new Error('Hizmet talebi bulunamadı.');
    }

    const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const existing = workOrders.find(wo => wo.serviceRequestId === requestId);
    if (existing) {
      return existing; // Return existing if already created
    }

    const code = `WO-${request.code.split('-')[1] || Date.now()}`;
    if (workOrders.some(wo => wo.code.toLowerCase() === code.toLowerCase())) {
      throw new Error('Bu iş emri kodu zaten kullanılıyor.');
    }

    const newWO: WorkOrder = {
      id: `wo-${Date.now()}`,
      code,
      serviceRequestId: requestId,
      branchId: request.branchId,
      technicianId: null,
      vehicleId: null,
      status: 'OPENED',
      plannedStart: null,
      plannedEnd: null,
      actualStart: null,
      actualEnd: null,
      requiredParts: [],
      usedParts: [],
      estimatedCost: 0,
      actualCost: 0,
      failureReason: null,
      notes: '',
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, newWO);

    // Update request status
    request.status = 'IN_PROGRESS';
    this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, requestId, request);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'WORK_ORDER',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Hizmet Talebinden (${request.code}) yeni İş Emri (${created.code}) oluşturuldu.`
    });

    return created;
  }

  planWorkOrder(
    workOrderId: string,
    technicianId: string,
    vehicleId: string,
    slot: TimeSlot,
    requiredParts: RequiredPart[]
  ): WorkOrder {
    // 1. Permission check
    this.permissionService.assertPermission('WORK_ORDER_PLAN');

    // Date validations
    const startTime = new Date(slot.start).getTime();
    const endTime = new Date(slot.end).getTime();
    if (isNaN(startTime) || isNaN(endTime)) {
      throw new Error('Geçersiz planlanan başlangıç veya bitiş tarihi.');
    }
    if (startTime <= Date.now()) {
      throw new Error('Planlanan başlangıç tarihi gelecekte olmalıdır.');
    }
    if (endTime <= startTime) {
      throw new Error('Planlanan bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
    }

    // Required parts availability validation
    for (const rp of requiredParts) {
      if (rp.quantity < 1) {
        throw new Error('Talep edilen parça miktarı en az 1 olmalıdır.');
      }
      const avail = this.inventoryService.getAvailableQuantity(rp.partId);
      if (rp.quantity > avail) {
        throw new Error(`Yetersiz stok. Talep edilen: ${rp.quantity}, Mevcut: ${avail}`);
      }
    }

    // 2. Work Order & Service Request check
    const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId);
    if (!wo) throw new Error('İş emri bulunamadı.');

    if (wo.status !== 'OPENED') {
      throw new Error(`İş emri planlanacak durumda değil. Mevcut durum: ${wo.status}`);
    }

    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (!req) throw new Error('Hizmet talebi bulunamadı.');

    // 3. Technician check
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) throw new Error('Teknisyen bulunamadı.');

    // 4. Technician active check
    if (!tech.isActive) {
      throw new Error('Teknisyen aktif değil.');
    }

    // 4b. Technician leave check (Kural 8 — izinli personel atanamaz)
    if (tech.isOnLeave) {
      throw new Error('Teknisyen izinli olduğu için atanamaz.');
    }

    // 5. Technician skill match check
    if (!tech.skills.includes(req.requiredSkill)) {
      throw new Error(`Teknisyen yetkinliği bu iş için yetersiz. Gerekli yetkinlik: ${req.requiredSkill}`);
    }

    // 5b. Kural 2 — 50.000 TL üzeri işler şube sorumlusu onayı olmadan planlanamaz.
    // Onay bekleyen iş için şube sorumlusuna aksiyon bildirimi düşer.
    if (wo.estimatedCost > 50000 && !wo.managerApproved) {
      this.notificationService.createForRole(
        'BRANCH_MANAGER',
        'APPROVAL_REQUIRED',
        'Yüksek Maliyetli İş Emri Onayı Bekleniyor',
        `${wo.code} nolu iş emrinin tahmini maliyeti ${wo.estimatedCost.toLocaleString('tr-TR')} TL. Planlanabilmesi için onayınız gerekiyor.`,
        'WARNING',
        { type: 'WORK_ORDER', id: wo.id, link: '/is-emirleri' }
      );
      throw new Error(`50.000 TL üzerindeki iş emirleri şube sorumlusu onayı gerektirir (Tahmini: ${wo.estimatedCost.toLocaleString('tr-TR')} TL). Şube sorumlusuna onay bildirimi gönderildi.`);
    }

    // 6. Technician working hours check
    if (!this.schedulingService.isWithinTechnicianWorkingHours(technicianId, slot)) {
      throw new Error('Seçilen saatler teknisyenin çalışma saatleri dışındadır.');
    }

    // 7. Technician time conflict check
    if (this.schedulingService.technicianHasConflict(technicianId, slot, workOrderId)) {
      throw new Error('Teknisyenin bu saat diliminde başka bir işi bulunmaktadır.');
    }

    // 8. Branch capacity check
    const dateStr = slot.start.split('T')[0];
    if (this.schedulingService.branchCapacityExceeded(wo.branchId, dateStr)) {
      throw new Error('Şubenin günlük iş kapasitesi aşılmıştır.');
    }

    // 9. Vehicle check (if assigned)
    const vehicle = this.storage.getById<Vehicle>(STORAGE_KEYS.VEHICLES, vehicleId);
    if (!vehicle) {
      throw new Error('Araç bulunamadı.');
    }
    if (vehicle.status === 'MAINTENANCE') {
      throw new Error('Araç bakımda olduğu için atanamaz.');
    }
    if (vehicle.status === 'OUT_OF_SERVICE') {
      throw new Error('Araç hizmet dışı olduğu için atanamaz.');
    }
    if (vehicle.fuelLevel < 30) {
      throw new Error('Aracın yakıt seviyesi %30 altındadır.');
    }
    if (this.schedulingService.vehicleHasConflict(vehicleId, slot, workOrderId)) {
      throw new Error('Aracın bu saat diliminde başka bir görevi bulunmaktadır.');
    }

    try {
      // 10. Required parts reservation
      this.reservationService.reserveParts(workOrderId, requiredParts);

      // 11. Success -> State PLANNED
      const oldWO = { ...wo };
      wo.technicianId = technicianId;
      wo.vehicleId = vehicleId;
      wo.plannedStart = slot.start;
      wo.plannedEnd = slot.end;
      wo.requiredParts = requiredParts;
      wo.status = 'PLANNED';

      this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId, wo);

      // Update service request status
      req.status = 'PLANNED';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, req.id, req);

      // 12. Audit Log
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'WORK_ORDER',
        entityId: workOrderId,
        oldValue: JSON.stringify(oldWO),
        newValue: JSON.stringify(wo),
        description: `İş Emri Planlandı: ${wo.code}, Teknisyen: ${technicianId}, Araç: ${vehicleId}`
      });

      // 13. Notification
      this.notificationService.createNotification({
        type: 'ASSIGNMENT_CREATED',
        title: 'İş Emri Planlandı',
        message: `${wo.code} nolu iş emri başarıyla planlandı.`,
        branchId: wo.branchId,
        targetRole: null,
        targetUserId: null,
        relatedEntityId: wo.id
      });

      return wo;
    } catch (err: any) {
      // Rollback reservations on any error
      this.reservationService.rollbackReservations(workOrderId);
      throw err;
    }
  }

  transitionWorkOrder(workOrderId: string, nextStatus: WorkOrderStatus, payload?: any): WorkOrder {
    this.permissionService.assertPermission('WORK_ORDER_UPDATE_STATUS');

    const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId);
    if (!wo) throw new Error('İş emri bulunamadı.');

    const currentStatus = wo.status;
    if (!this.validateTransition(currentStatus, nextStatus)) {
      // Log invalid attempt to audit log
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'WORK_ORDER',
        entityId: workOrderId,
        oldValue: JSON.stringify(wo),
        newValue: null,
        description: `GEÇERSİZ DURUM GEÇİŞ DENEMESİ: ${currentStatus} -> ${nextStatus}`
      });
      throw new Error(`Geçersiz durum geçişi: ${currentStatus} -> ${nextStatus}`);
    }

    if (nextStatus === 'CANCELLED') {
      this.permissionService.assertPermission('WORK_ORDER_CANCEL');
      this.cancelWorkOrderInternal(wo, payload?.reason || 'Belirtilmedi');
    } else if (nextStatus === 'FAILED') {
      this.failWorkOrderInternal(wo, payload?.failureReason || 'Belirtilmedi');
    } else if (nextStatus === 'COMPLETED') {
      this.permissionService.assertPermission('WORK_ORDER_COMPLETE');
      this.completeWorkOrderInternal(wo, payload?.usedParts || []);
    } else if (nextStatus === 'PARTIALLY_COMPLETED') {
      this.permissionService.assertPermission('WORK_ORDER_PARTIAL_COMPLETE');
      this.partiallyCompleteWorkOrderInternal(wo, payload?.usedParts || [], payload?.followUpNote || '');
    } else {
      // Standard transition e.g., PLANNED -> ON_THE_WAY -> ON_SITE
      const oldWO = { ...wo };
      wo.status = nextStatus;
      if (nextStatus === 'ON_THE_WAY') {
        wo.actualStart = new Date().toISOString();
      }
      this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId, wo);

      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'WORK_ORDER',
        entityId: workOrderId,
        oldValue: JSON.stringify(oldWO),
        newValue: JSON.stringify(wo),
        description: `İş Emri durumu güncellendi: ${currentStatus} -> ${nextStatus}`
      });

      this.notifyStatusChange(wo, nextStatus);
    }

    return wo;
  }

  /** Standart geçişler için bildirim üretir (PLANNED, ON_THE_WAY, ON_SITE).
   *  Final state'lerin bildirimleri zaten cancel/complete/partial/fail internal helper'larında üretilir. */
  private notifyStatusChange(wo: WorkOrder, status: WorkOrderStatus): void {
    let title = '';
    let message = '';
    switch (status) {
      case 'ON_THE_WAY':
        title = 'Teknisyen Yola Çıktı';
        message = `${wo.code} nolu iş emri için teknisyen yola çıktı.`;
        break;
      case 'ON_SITE':
        title = 'Teknisyen Sahada';
        message = `${wo.code} nolu iş emri için teknisyen sahaya ulaştı, çalışmaya başladı.`;
        break;
      case 'PLANNED':
        title = 'İş Emri Planlandı';
        message = `${wo.code} nolu iş emri planlandı.`;
        break;
      default:
        return;
    }
    this.notificationService.createNotification({
      type: 'TECHNICIAN_ASSIGNED',
      title,
      message,
      severity: 'INFO',
      branchId: wo.branchId,
      targetRole: 'BRANCH_MANAGER',
      targetUserId: null,
      relatedEntityType: 'WORK_ORDER' as any,
      relatedEntityId: wo.id,
      link: null
    } as any);
    if (wo.technicianId) {
      this.notificationService.createForUser(wo.technicianId, 'TECHNICIAN_ASSIGNED' as any, title, message, 'INFO' as any);
    }
  }

  /**
   * Bir iş emrini yanlışlıkla COMPLETED / PARTIALLY_COMPLETED / FAILED işaretlendiyse geri alır.
   * - Sadece WORK_ORDER_CANCEL yetkisi olan kullanıcı (Admin/Operasyon Müdürü) yapabilir.
   * - Sadece son 24 saat içinde kapatılmış kayıtlar için geçerli.
   * - Tüketilen parçalar varsa stoğa iade edilir (rezervasyon yeniden oluşturulur — PLANNED'a geçer).
   * - İlgili ServiceRequest tekrar PLANNED durumuna çekilir.
   * - Audit log + bildirim yazılır.
   */
  reopenWorkOrder(workOrderId: string, reason: string): WorkOrder {
    this.permissionService.assertPermission('WORK_ORDER_CANCEL');
    if (!reason || reason.trim().length === 0) {
      throw new Error('Geri alma nedeni zorunludur.');
    }
    if (reason.length > 200) {
      throw new Error('Geri alma nedeni en fazla 200 karakter olabilir.');
    }

    const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, workOrderId);
    if (!wo) throw new Error('İş emri bulunamadı.');

    const finalStatuses = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'];
    if (!finalStatuses.includes(wo.status)) {
      throw new Error('Sadece tamamlanmış, başarısız veya iptal edilmiş iş emirleri geri açılabilir.');
    }

    // 24 saat kuralı: actualEnd varsa kontrol et; yoksa (eski kayıt) izin ver.
    if (wo.actualEnd) {
      const hoursSince = (Date.now() - new Date(wo.actualEnd).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) {
        throw new Error('Bu iş emri 24 saatten daha eski kapatılmış; artık geri açılamaz.');
      }
    }

    const oldWO = { ...wo };
    const wasCancelled = wo.status === 'CANCELLED';

    // 1) Tüketilen parçaları stoğa iade et (varsa) — sadece COMPLETED/PARTIALLY için
    // CANCELLED'da parça zaten kullanılmamış (sadece rezerve serbest bırakılmıştı)
    if (wo.usedParts && wo.usedParts.length > 0) {
      for (const used of wo.usedParts) {
        if (used.quantity > 0) {
          const part = this.storage.getById<SparePart>(STORAGE_KEYS.SPARE_PARTS, used.partId);
          if (part) {
            this.storage.update<SparePart>(STORAGE_KEYS.SPARE_PARTS, part.id, {
              stockQuantity: part.stockQuantity + used.quantity
            });
            this.auditLog.logAction({
              actionType: 'UPDATE',
              entityType: 'SPARE_PART',
              entityId: part.id,
              oldValue: JSON.stringify({ stockQuantity: part.stockQuantity }),
              newValue: JSON.stringify({ stockQuantity: part.stockQuantity + used.quantity }),
              description: `İş emri ${wo.code} geri alındı: ${used.quantity} adet stoğa iade edildi.`
            });
          }
        }
      }
    }

    // 2) İş emrini uygun duruma geri çek:
    //    - CANCELLED ise: atama bilgileri zaten temizlendiğinden OPENED'a döner; yeniden planlanması gerekir.
    //    - Diğerleri (COMPLETED/PARTIALLY/FAILED): planlama bilgileri korunduğundan PLANNED'a döner.
    wo.status = wasCancelled ? 'OPENED' : 'PLANNED';
    wo.usedParts = [];
    wo.failureReason = null;
    wo.actualEnd = null;
    wo.notes = (wo.notes || '') + `\n[GERİ ALINDI] ${new Date().toISOString()} — Neden: ${reason}`;
    this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, wo.id, wo);

    // 3) ServiceRequest'i de uygun duruma çek:
    //    - CANCELLED'dan geri alındıysa IN_PROGRESS (iş emri tekrar açık ama planlanmamış)
    //    - Diğerlerinde PLANNED (iş emri zaten planlı durumda)
    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (req) {
      req.status = wasCancelled ? 'IN_PROGRESS' : 'PLANNED';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, req.id, req);
    }

    // 4) Audit log
    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(wo),
      description: `İş Emri GERİ ALINDI: ${oldWO.status} → PLANNED. Neden: ${reason}`
    });

    // 5) Notification
    this.notificationService.createNotification({
      type: 'ASSIGNMENT_CREATED',
      title: 'İş Emri Geri Alındı',
      message: `${wo.code} nolu iş emri "${oldWO.status}" durumundan geri alındı ve yeniden planlamaya açıldı.`,
      severity: 'WARNING',
      branchId: wo.branchId,
      targetRole: 'BRANCH_MANAGER',
      targetUserId: null,
      relatedEntityType: 'WORK_ORDER' as any,
      relatedEntityId: wo.id,
      link: null
    } as any);

    return wo;
  }

  cancelWorkOrder(workOrderId: string, reason: string): WorkOrder {
    return this.transitionWorkOrder(workOrderId, 'CANCELLED', { reason });
  }

  failWorkOrder(workOrderId: string, failureReason: string): WorkOrder {
    return this.transitionWorkOrder(workOrderId, 'FAILED', { failureReason });
  }

  completeWorkOrder(workOrderId: string, usedParts: UsedPart[]): WorkOrder {
    return this.transitionWorkOrder(workOrderId, 'COMPLETED', { usedParts });
  }

  partiallyCompleteWorkOrder(workOrderId: string, usedParts: UsedPart[], followUpNote: string): WorkOrder {
    return this.transitionWorkOrder(workOrderId, 'PARTIALLY_COMPLETED', { usedParts, followUpNote });
  }

  validateTransition(currentStatus: WorkOrderStatus, nextStatus: WorkOrderStatus): boolean {
    this.permissionService.assertPermission('WORK_ORDER_VIEW');
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
  }

  getAllowedTransitions(status: WorkOrderStatus): WorkOrderStatus[] {
    this.permissionService.assertPermission('WORK_ORDER_VIEW');
    return ALLOWED_TRANSITIONS[status] || [];
  }

  // Internal Helpers for Transitions
  private cancelWorkOrderInternal(wo: WorkOrder, reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('İptal nedeni sadece boşluklardan oluşamaz.');
    }
    if (reason.length > 200) {
      throw new Error('İptal nedeni en fazla 200 karakter olabilir.');
    }

    const oldWO = { ...wo };
    
    // Release reservations
    this.reservationService.releaseAllReservationsInternal(wo.id);

    // Free resources
    wo.status = 'CANCELLED';
    wo.technicianId = null;
    wo.vehicleId = null;
    wo.plannedStart = null;
    wo.plannedEnd = null;
    wo.actualEnd = new Date().toISOString(); // 24 saat içinde geri alma kontrolü için
    wo.notes = wo.notes ? `${wo.notes}\nİptal Nedeni: ${reason}` : `İptal Nedeni: ${reason}`;

    this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, wo.id, wo);

    // Set request back to NEW
    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (req) {
      req.status = 'NEW';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, req.id, req);
    }

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(wo),
      description: `İş Emri İPTAL Edildi. Nedeni: ${reason}. Takvim ve Stok rezervasyonları temizlendi.`
    });

    this.notificationService.createNotification({
      type: 'FAILED_WORK',
      title: 'İş Emri İptal Edildi',
      message: `${wo.code} nolu iş emri iptal edilmiştir.`,
      branchId: wo.branchId,
      targetRole: null,
      targetUserId: null,
      relatedEntityId: wo.id
    });
  }

  private failWorkOrderInternal(wo: WorkOrder, failureReason: string): void {
    if (!failureReason || failureReason.trim().length === 0) {
      throw new Error('Başarısızlık nedeni sadece boşluklardan oluşamaz.');
    }
    if (failureReason.length > 200) {
      throw new Error('Başarısızlık nedeni en fazla 200 karakter olabilir.');
    }

    const oldWO = { ...wo };

    // Release reservations (failed work orders did not consume parts)
    this.reservationService.releaseAllReservationsInternal(wo.id);

    wo.status = 'FAILED';
    wo.failureReason = failureReason;
    wo.actualEnd = new Date().toISOString();

    this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, wo.id, wo);

    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (req) {
      req.status = 'CLOSED';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, req.id, req);
    }

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(wo),
      description: `İş Emri BAŞARISIZ Oldu. Nedeni: ${failureReason}. Rezervasyonlar serbest bırakıldı.`
    });
  }

  private completeWorkOrderInternal(wo: WorkOrder, usedParts: UsedPart[]): void {
    for (const up of usedParts) {
      const reserved = wo.requiredParts?.find(rp => rp.partId === up.partId);
      const reservedQty = reserved ? reserved.quantity : 0;
      if (up.quantity > reservedQty) {
        throw new Error('Kullanılan parça miktarı rezerve edilen miktarı aşamaz.');
      }
    }

    const oldWO = { ...wo };

    // Consume parts
    this.reservationService.consumeReservedPartsInternal(wo.id, usedParts);

    wo.status = 'COMPLETED';
    wo.usedParts = usedParts;
    wo.actualEnd = new Date().toISOString();

    this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, wo.id, wo);

    // Update ServiceRequest status to CLOSED
    const req = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (req) {
      req.status = 'CLOSED';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, req.id, req);
    }

    // Şartname Bölüm 4: Tamamlama sonrası teknisyenin sayacı + performans puanı otomatik artar.
    this.bumpTechnicianPerformance(wo.technicianId, +1);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(wo),
      description: `İş Emri TAMAMLANDI. Kullanılan parçalar stoktan düşüldü.`
    });
  }

  /**
   * Teknisyen tamamlanan iş sayacını ve performans puanını günceller (0-100 arası clamp).
   * Tam tamamlanmada delta=+1, kısmi tamamlanmada delta=+0 (sayac artar, performans bonus yok).
   */
  private bumpTechnicianPerformance(technicianId: string | null | undefined, perfDelta: number): void {
    if (!technicianId) return;
    const tech = this.storage.getById<Technician>(STORAGE_KEYS.TECHNICIANS, technicianId);
    if (!tech) return;
    const newScore = Math.max(0, Math.min(100, (tech.performanceScore || 0) + perfDelta));
    this.storage.update<Technician>(STORAGE_KEYS.TECHNICIANS, tech.id, {
      completedJobsCount: (tech.completedJobsCount || 0) + 1,
      performanceScore: newScore
    });
  }

  private partiallyCompleteWorkOrderInternal(wo: WorkOrder, usedParts: UsedPart[], followUpNote: string): void {
    if (!followUpNote || followUpNote.trim().length === 0) {
      throw new Error('Takip notu sadece boşluklardan oluşamaz.');
    }
    if (followUpNote.length > 300) {
      throw new Error('Takip notu en fazla 300 karakter olabilir.');
    }

    for (const up of usedParts) {
      const reserved = wo.requiredParts?.find(rp => rp.partId === up.partId);
      const reservedQty = reserved ? reserved.quantity : 0;
      if (up.quantity > reservedQty) {
        throw new Error('Kullanılan parça miktarı rezerve edilen miktarı aşamaz.');
      }
    }

    const oldWO = { ...wo };

    // Consume used parts & release remaining
    this.reservationService.consumeReservedPartsInternal(wo.id, usedParts);

    wo.status = 'PARTIALLY_COMPLETED';
    wo.usedParts = usedParts;
    wo.actualEnd = new Date().toISOString();

    this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, wo.id, wo);

    // Kısmi tamamlanmada da iş sayacı artar (saha emeği harcandı), performans puanı dokunulmaz.
    this.bumpTechnicianPerformance(wo.technicianId, 0);

    // Update original ServiceRequest to CLOSED
    const oldRequest = this.storage.getById<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, wo.serviceRequestId);
    if (oldRequest) {
      oldRequest.status = 'CLOSED';
      this.storage.update<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, oldRequest.id, oldRequest);

      // Create new follow-up request in NEW status
      const followUpCode = `SR-FUP-${Date.now()}`;
      const followUpRequest: ServiceRequest = {
        id: `sr-${Date.now()}`,
        code: followUpCode,
        customerId: oldRequest.customerId,
        customerName: oldRequest.customerName,
        customerPhone: oldRequest.customerPhone,
        customerAddress: oldRequest.customerAddress,
        customerRegion: oldRequest.customerRegion,
        branchId: oldRequest.branchId,
        title: `${oldRequest.title} - Takip Talebi`,
        description: `Önceki iş emri (${wo.code}) kısmi tamamlandı. Takip Notu: ${followUpNote}\n\nOrijinal Açıklama: ${oldRequest.description}`,
        deviceBrandModel: oldRequest.deviceBrandModel,
        serviceCategory: oldRequest.serviceCategory,
        requiredSkill: oldRequest.requiredSkill,
        priority: oldRequest.priority,
        status: 'NEW',
        slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // standard 48 hours for follow-ups
        hasWarranty: oldRequest.hasWarranty,
        hasCustomerApproval: oldRequest.hasCustomerApproval,
        createdAt: new Date().toISOString()
      };
      this.storage.create<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS, followUpRequest);
    }

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(wo),
      description: `İş Emri KISMİ TAMAMLANDI. Takip talebi oluşturuldu. Takip Notu: ${followUpNote}`
    });
  }

  /**
   * Kural 2 onay akışı: 50.000 TL üzeri iş emrine şube sorumlusu (veya üst yönetim) onay verir.
   * Onay sonrası dispeçere "planlayabilirsiniz" bildirimi düşer.
   */
  approveWorkOrder(id: string): WorkOrder {
    if (!this.permissionService.hasAnyRole(['BRANCH_MANAGER', 'OPERATION_MANAGER', 'SYSTEM_ADMIN'])) {
      this.auditLog.logAction({
        actionType: 'SECURITY_VIOLATION',
        entityType: 'WORK_ORDER',
        entityId: id,
        oldValue: null,
        newValue: null,
        description: 'Yetkisiz kullanıcı yüksek maliyetli iş emrini onaylamaya çalıştı.',
        result: 'FAILURE',
        failureReason: 'Onay yetkisi sadece Şube Sorumlusu ve üst yönetimde bulunur.'
      });
      throw new Error('Yüksek maliyetli iş emri onayı yalnızca Şube Sorumlusu veya üst yönetim tarafından verilebilir.');
    }

    const wo = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, id);
    if (!wo) throw new Error('Onaylanacak iş emri bulunamadı.');
    if (wo.status !== 'OPENED') throw new Error('Sadece açık durumdaki iş emirleri onaylanabilir.');
    if (wo.estimatedCost <= 50000) throw new Error('Bu iş emri onay eşiğinin (50.000 TL) altında; onay gerektirmez.');
    if (wo.managerApproved) throw new Error('Bu iş emri zaten onaylanmış.');

    const oldWO = { ...wo };
    wo.managerApproved = true;
    const updated = this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, id, wo);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(updated),
      description: `Yüksek maliyetli iş emri onaylandı: ${wo.code} (${wo.estimatedCost.toLocaleString('tr-TR')} TL)`
    });

    this.notificationService.createForRole(
      'DISPATCHER',
      'APPROVAL_GRANTED',
      'İş Emri Onaylandı — Planlanabilir',
      `${wo.code} nolu yüksek maliyetli iş emri şube sorumlusu tarafından onaylandı. Artık planlama yapabilirsiniz.`,
      'INFO',
      { type: 'WORK_ORDER', id: wo.id, link: '/planlama' }
    );

    return updated;
  }

  updateWorkOrder(id: string, workOrder: Partial<WorkOrder>): WorkOrder {
    this.permissionService.assertPermission('WORK_ORDER_UPDATE_STATUS');
    const oldWO = this.storage.getById<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, id);
    if (!oldWO) throw new Error('Güncellenecek iş emri bulunamadı.');

    if (workOrder.code) {
      const workOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
      if (workOrders.some(wo => wo.code.toLowerCase() === workOrder.code!.toLowerCase() && wo.id !== id)) {
        throw new Error('Bu iş emri kodu zaten kullanılıyor.');
      }
    }

    const updated = this.storage.update<WorkOrder>(STORAGE_KEYS.WORK_ORDERS, id, workOrder);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: id,
      oldValue: JSON.stringify(oldWO),
      newValue: JSON.stringify(updated),
      description: `İs Emri guncellendi: ${updated.code}`
    });

    return updated;
  }
}
