// Merkezi Türkçe etiket sözlüğü.
// UI'da hiçbir yerde ham enum (ON_THE_WAY, WAREHOUSE_MANAGER, ...) görünmemesi için kullanılır.

import { UserRole } from '../models/user-role.model';
import { WorkOrderStatus } from '../models/work-order.model';

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPENED: 'Açıldı',
  PLANNED: 'Planlandı',
  ON_THE_WAY: 'Yolda',
  ON_SITE: 'Sahada / İşlemde',
  COMPLETED: 'Tamamlandı',
  PARTIALLY_COMPLETED: 'Kısmi Tamamlandı',
  FAILED: 'Başarısız',
  CANCELLED: 'İptal Edildi'
};

export const PRIORITY_LABELS: Record<string, string> = {
  STANDARD: 'Standart',
  URGENT: 'Acil',
  CRITICAL: 'Kritik'
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
  OPERATION_MANAGER: 'Operasyon Müdürü',
  BRANCH_MANAGER: 'Şube Sorumlusu',
  DISPATCHER: 'Planlama / Dispeçer',
  WAREHOUSE_MANAGER: 'Depo / Yedek Parça Sorumlusu',
  TECHNICIAN: 'Teknisyen',
  REPORTING_USER: 'Raporlama Yetkilisi'
};

// Şartname Bölüm 8 — 4 araç durumu: Müsait / Görevde / Bakımda / Pasif (Hizmet Dışı)
export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Müsait',
  ACTIVE: 'Görevde',
  MAINTENANCE: 'Bakımda',
  OUT_OF_SERVICE: 'Pasif'
};

export const TECHNICIAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  ON_LEAVE: 'İzinli',
  PASSIVE: 'Pasif'
};

// Teknisyen kıdem seviyesi etiketleri (Çırak / Kalfa / Usta üçlü gelenek + uzman dördüncü kademe).
export const TECHNICIAN_LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Çırak',
  MID: 'Kalfa',
  SENIOR: 'Usta',
  EXPERT: 'Uzman Usta'
};

// Vardiya / Görev tipi etiketleri (Şartname Bölüm 11).
export const SHIFT_TASK_TYPE_LABELS: Record<string, string> = {
  ROUTINE_MAINT: 'Periyodik Bakım',
  ON_CALL: 'Çağrı Üzerine Saha',
  INSTALLATION: 'Kurulum / Montaj',
  INSPECTION: 'Saha Denetimi',
  TRAINING: 'Eğitim / Tatbikat',
  OTHER: 'Diğer'
};

export const SHIFT_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Sürüyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi'
};

// Kural motoru tetikleyici etiketleri (Bölüm 12)
export const RULE_TRIGGER_LABELS: Record<string, string> = {
  WORK_ORDER_PLAN: 'İş Emri Planlama',
  SPARE_PART_CONSUMPTION: 'Parça Tüketimi',
  SERVICE_REQUEST_CREATE: 'Servis Talebi Oluşturma',
  SYSTEM_EVENT: 'Sistem Olayı'
};

// Yetkinlik (Skill) etiketleri — şartname Bölüm 4 yetkinlik örnekleri
export const SKILL_LABELS: Record<string, string> = {
  WHITE_GOODS: 'Beyaz Eşya',
  HVAC: 'Klima / Soğutma',
  ELECTRIC: 'Elektrik Tesisatı',
  ELECTRONICS_MOTHERBOARD: 'Elektronik / Anakart',
  PLUMBING: 'Sıhhi Tesisat',
  BOILER_HEATING: 'Kombi / Isıtma'
};

// Parça kategorisi etiketleri — şartname Bölüm 6
export const PART_CATEGORY_LABELS: Record<string, string> = {
  COMPRESSOR: 'Kompresör',
  BOARD_ELECTRONIC: 'Kart / Elektronik',
  MOTOR: 'Motor',
  SENSOR: 'Sensör',
  SEAL_GASKET: 'Conta / Sızdırmazlık',
  FILTER: 'Filtre',
  CABLE_CONNECTION: 'Kablo / Bağlantı',
  CONSUMABLES: 'Sarf Malzeme'
};

export const STOCK_STATUS_LABELS: Record<string, string> = {
  LOW_STOCK: 'Düşük Stok',
  CRITICAL_STOCK: 'Kritik Stok',
  RESERVED: 'Rezerve',
  CONSUMED: 'Kullanıldı',
  RELEASED: 'Serbest Bırakıldı',
  ACTIVE: 'Aktif'
};

export const STOCK_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Giriş',
  OUT: 'Çıkış',
  TRANSFER: 'Transfer',
  FIRE: 'Fire / Hasar',
  ADJUSTMENT: 'Sayım Düzeltmesi',
  RESERVE_HOLD: 'Rezerve Bloke',
  RESERVE_RELEASE: 'Rezerve Serbest',
  RESERVE_CONSUME: 'Rezerve Kullanım'
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  CREATE: 'Oluşturma',
  UPDATE: 'Güncelleme',
  DELETE: 'Silme',
  STATE_TRANSITION: 'Durum Geçişi',
  SECURITY_VIOLATION: 'Güvenlik İhlali',
  SYSTEM_EVENT: 'Sistem Olayı',
  IMPORT: 'İçe Aktarma'
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  BRANCH: 'Şube',
  TECHNICIAN: 'Teknisyen',
  SPARE_PART: 'Yedek Parça',
  SERVICE_REQUEST: 'Servis Talebi',
  WORK_ORDER: 'İş Emri',
  VEHICLE: 'Araç',
  RULE: 'İş Kuralı',
  SYSTEM: 'Sistem',
  PART_RESERVATION: 'Parça Rezervasyonu'
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni',
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'İşlemde',
  CLOSED: 'Kapatıldı',
  CANCELLED: 'İptal Edildi'
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  NEW_REQUEST: 'Yeni Talep',
  ASSIGNMENT_CREATED: 'Atama Yapıldı',
  LOW_STOCK: 'Düşük Stok',
  SLA_OVERDUE: 'SLA Aşıldı',
  SLA_APPROACHING: 'SLA Yaklaşıyor',
  VEHICLE_MAINTENANCE: 'Araç Bakımı',
  TECHNICIAN_ASSIGNED: 'Teknisyen Atandı',
  PARTIAL_COMPLETION: 'Kısmi Tamamlama',
  FAILED_WORK: 'Başarısız İş',
  CAPACITY_FULL: 'Kapasite Doldu',
  RULE_CONFLICT: 'Kural Çakışması',
  UNAUTHORIZED_ACTION: 'Yetkisiz İşlem',
  IMPORT_ERROR: 'İçe Aktarma Hatası',
  APPROVAL_REQUIRED: 'Onay Gerekli',
  APPROVAL_GRANTED: 'Onay Verildi'
};

export const NOTIFICATION_SEVERITY_LABELS: Record<string, string> = {
  INFO: 'Bilgi',
  WARNING: 'Uyarı',
  ERROR: 'Hata',
  CRITICAL: 'Kritik'
};

export const RESULT_LABELS: Record<string, string> = {
  SUCCESS: 'Başarılı',
  FAILURE: 'Başarısız'
};

export type FailureReasonCode =
  | 'PART_MISSING'
  | 'WRONG_PART'
  | 'CUSTOMER_ABSENT'
  | 'NO_ACCESS'
  | 'VEHICLE_BREAKDOWN'
  | 'ADDITIONAL_FAULT'
  | 'OTHER';

export const FAILURE_REASON_LABELS: Record<FailureReasonCode, string> = {
  PART_MISSING: 'Parça eksik',
  WRONG_PART: 'Yanlış parça',
  CUSTOMER_ABSENT: 'Müşteri yok',
  NO_ACCESS: 'Erişim sağlanamadı',
  VEHICLE_BREAKDOWN: 'Araç arızası',
  ADDITIONAL_FAULT: 'Ek arıza tespit edildi',
  OTHER: 'Diğer'
};

export const FAILURE_REASON_OPTIONS: { code: FailureReasonCode; label: string }[] =
  (Object.keys(FAILURE_REASON_LABELS) as FailureReasonCode[])
    .map(code => ({ code, label: FAILURE_REASON_LABELS[code] }));
