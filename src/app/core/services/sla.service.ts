import { Injectable } from '@angular/core';
import { ServicePriority } from '../models/service-request.model';
import { SkillType } from '../models/technician.model';

@Injectable({
  providedIn: 'root'
})
export class SlaService {

  // Öncelik bazlı temel SLA süresi (saat) — Şartname Bölüm 10 örnekleri.
  private static readonly BASE_HOURS: Record<ServicePriority, number> = {
    CRITICAL: 4,
    URGENT: 12,
    STANDARD: 48
  };

  // Hizmet kategorisi (yetkinlik) bazlı çarpan — Şartname Bölüm 10:
  // "SLA hedef süresi hizmet kategorisi VE önceliğe göre belirlenir."
  // Çarpan < 1 => daha acil kategori (kısa SLA). Referans: Beyaz eşya = 1.0.
  private static readonly CATEGORY_FACTOR: Record<string, number> = {
    BOILER_HEATING: 0.75,          // Kombi/ısıtma — özellikle kışın hayati, hızlı müdahale
    ELECTRIC: 0.75,                // Elektrik — güvenlik riski
    PLUMBING: 0.85,                // Tesisat — su kaçağı hasar riski
    HVAC: 0.9,                     // Klima/soğutma
    WHITE_GOODS: 1.0,             // Beyaz eşya — referans
    ELECTRONICS_MOTHERBOARD: 1.25 // Anakart/elektronik — parça tedariki/laboratuvar onarımı uzun
  };

  getCategoryFactor(category?: SkillType | string | null): number {
    if (!category) return 1.0;
    return SlaService.CATEGORY_FACTOR[category] ?? 1.0;
  }

  /**
   * SLA hedef tarihini öncelik + hizmet kategorisine göre hesaplar (Şartname Bölüm 10).
   * @param priority Talep önceliği (temel süreyi belirler)
   * @param category Hizmet kategorisi / gerekli yetkinlik (çarpanı belirler); yoksa 1.0
   * @param fromDate Başlangıç anı (varsayılan: şimdi)
   */
  calculateSlaDeadline(
    priority: ServicePriority,
    category?: SkillType | string | null,
    fromDate: Date = new Date()
  ): string {
    const baseHours = SlaService.BASE_HOURS[priority] ?? SlaService.BASE_HOURS.STANDARD;
    const factor = this.getCategoryFactor(category);
    const totalMinutes = Math.round(baseHours * factor * 60);
    const deadline = new Date(fromDate);
    deadline.setMinutes(deadline.getMinutes() + totalMinutes);
    return deadline.toISOString();
  }

  isSlaApproaching(deadlineIso: string, thresholdHours: number = 2): boolean {
    const now = new Date().getTime();
    const limit = new Date(deadlineIso).getTime();
    const diffHours = (limit - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= thresholdHours;
  }

  isSlaOverdue(deadlineIso: string): boolean {
    return new Date().getTime() > new Date(deadlineIso).getTime();
  }
}
