export const FIELD_LIMITS = {
  username: 30,
  fullName: 50,
  email: 80,
  password: 50,
  branchCode: 20,
  branchName: 50,
  city: 30,
  district: 30,
  regionCode: 20,
  responsiblePerson: 50,
  address: 150,
  serviceArea: 50,
  latitudeStr: 10,
  longitudeStr: 11,
  phone: 15,
  skillItem: 40,
  notes: 250,
  requestCode: 20,
  customerName: 50,
  customerPhone: 15,
  customerAddress: 150,
  customerRegion: 50,
  deviceBrand: 40,
  deviceModel: 40,
  serialNumber: 40,
  faultDescription: 300,
  serviceCategory: 50,
  requiredSkill: 40,
  customerApprovalNote: 250,
  workOrderCode: 20,
  planningNote: 300,
  cancelReason: 200,
  failureReason: 200,
  partialCompleteNote: 300,
  completionNote: 300,
  followUpNote: 300,
  partCode: 20,
  partName: 70,
  categoryName: 50,
  compatibleDevice: 70,
  compatibleBrand: 40,
  unit: 10,
  stockMovementNote: 250,
  transferNote: 250,
  plate: 10,
  vehicleType: 40,
  brand: 40,
  model: 40,
  assignedDriver: 50,
  equipment: 50,
  maintenanceNote: 250,
  ruleName: 70,
  ruleDescription: 250,
  conditionField: 60,
  actionDescription: 250,
  notificationTitle: 70,
  notificationMessage: 250,
  importDescription: 250,
  fileName: 120,
  settingName: 70,
  settingDescription: 250
};

export const NUMERIC_LIMITS = {
  dailyCapacity: { min: 1, max: 10 },
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  completedJobCount: { min: 0, max: 10000 },
  performanceScore: { min: 0, max: 100 },
  techDailyCapacity: { min: 1, max: 20 },
  stockQuantity: { min: 0, max: 100000 },
  reservedQuantity: { min: 0, max: 100000 },
  minimumStockLevel: { min: 0, max: 100000 },
  unitCost: { min: 0, max: 1000000 },
  movementQuantity: { min: 1, max: 100000 },
  fuelLevel: { min: 0, max: 100 },
  vehicleCapacity: { min: 1, max: 10000 },
  vehicleYear: { min: 1990, max: 2027 }, // currentYear + 1 where current is 2026
  estimatedCost: { min: 0, max: 10000000 },
  actualCost: { min: 0, max: 10000000 },
  rulePriority: { min: 1, max: 999 },
  thresholdValue: { min: 0, max: 10000000 },
  slaHours: { min: 1, max: 720 }
};

/**
 * HTML `<input type="date">` min/max attribute'una verilecek YYYY-MM-DD sınırları.
 * Yıl 4 basamakla sınırlandırılır; browser otomatik olarak geçersiz takvim tarihlerini
 * (örn. Şubat 30) reddeder.
 */
export const DATE_LIMITS = {
  GENERAL_MIN: '1900-01-01',
  GENERAL_MAX: '2099-12-31',
  PAST_MIN: '2000-01-01',
  FUTURE_MAX: '2099-12-31'
};

// Bugünün ISO tarihi
export function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}
