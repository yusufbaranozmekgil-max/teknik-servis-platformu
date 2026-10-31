import { Rule } from '../models/rule.model';

/** Sistem kuralları. Motor kimliğe göre değerlendirdiği için id'ler değişmemelidir. */
export function createDefaultRules(): Rule[] {
  return [
  {
    id: 'rule-1',
    name: 'Kritik Talep Otomatik Önceliklendirme',
    description: 'Önceliği CRITICAL olan servis taleplerini otomatik en üst sıraya çeker.',
    trigger: 'SERVICE_REQUEST_CREATE',
    conditions: JSON.stringify({ priority: 'CRITICAL' }),
    actions: JSON.stringify({ action: 'AUTO_PRIORITIZE' }),
    priority: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-2',
    name: '50.000 TL Üzeri Harcama Onayı',
    description: 'Tahmini tutarı 50.000 TL üzerindeki iş emirleri için şube yöneticisi onayı gerektirir.',
    trigger: 'WORK_ORDER_PLAN',
    conditions: JSON.stringify({ estimatedCostGreaterThan: 50000 }),
    actions: JSON.stringify({ action: 'REQUIRE_APPROVAL' }),
    priority: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-3',
    name: 'Minimum Stok Seviyesi Uyarısı',
    description: 'Stok miktarı minimum kritik seviyenin altına düşen parçalar için uyarı bildirimi üretir.',
    trigger: 'SYSTEM_EVENT',
    conditions: JSON.stringify({ availableStockLessThanMin: true }),
    actions: JSON.stringify({ action: 'TRIGGER_ALERT', type: 'LOW_STOCK' }),
    priority: 5,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-4',
    name: 'SLA Süresi Aşım Uyarısı',
    description: 'SLA deadline süresini geçen açık talepleri gecikmiş olarak işaretler.',
    trigger: 'SYSTEM_EVENT',
    conditions: JSON.stringify({ nowGreaterThanSlaDeadline: true }),
    actions: JSON.stringify({ action: 'TRIGGER_ALERT', type: 'SLA_OVERDUE' }),
    priority: 2,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-5',
    name: 'SLA < 2 Saat Kalan Alarmı',
    description: 'SLA deadline dolmasına 2 saatten az süre kalan işleri acil olarak işaretler.',
    trigger: 'SYSTEM_EVENT',
    conditions: JSON.stringify({ hoursToSlaDeadlineLessThan: 2 }),
    actions: JSON.stringify({ action: 'AUTO_PRIORITIZE', priority: 'CRITICAL' }),
    priority: 2,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-6',
    name: 'Bakımsız Araç Engeli',
    description: 'Son bakım tarihinin üzerinden 180 gün geçen araçların iş emirlerine atanmasını engeller.',
    trigger: 'WORK_ORDER_PLAN',
    conditions: JSON.stringify({ daysSinceMaintenanceGreaterThan: 180 }),
    actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
    priority: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-7',
    name: 'Düşük Yakıt Seviyesi Engeli',
    description: 'Yakıt seviyesi %30 altındaki araçların görevlendirilmesini engeller.',
    trigger: 'WORK_ORDER_PLAN',
    conditions: JSON.stringify({ fuelLevelLessThan: 30 }),
    actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
    priority: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-8',
    name: 'İzinli/Pasif Teknisyen Engeli',
    description: 'İzinli veya pasif durumda olan teknisyenlerin planlamaya dahil edilmesini engeller.',
    trigger: 'WORK_ORDER_PLAN',
    conditions: JSON.stringify({ isOnLeaveOrInactive: true }),
    actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
    priority: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-9',
    name: 'Şube Günlük Kapasite Sınırı',
    description: 'Günlük planlanan iş sayısı şube kapasite sınırını aşan durumlarda yeni atamaları engeller.',
    trigger: 'WORK_ORDER_PLAN',
    conditions: JSON.stringify({ branchCapacityFull: true }),
    actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
    priority: 4,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'rule-10',
    name: 'Garanti Dışı İşlerde Müşteri Onayı',
    description: 'Garanti kapsamı dışındaki işlerde müşteri onayı yoksa yedek parça kullanımını engeller.',
    trigger: 'SPARE_PART_CONSUMPTION',
    conditions: JSON.stringify({ noWarrantyAndNoCustomerApproval: true }),
    actions: JSON.stringify({ action: 'BLOCK_ASSIGNMENT' }),
    priority: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
  ];
}
