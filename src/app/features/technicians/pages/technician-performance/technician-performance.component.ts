import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TechnicianService } from '../../../../core/services/technician.service';
import { Technician, SkillType } from '../../../../core/models/technician.model';
import { TechLevelLabelPipe } from '../../../../shared/pipes/tech-level-label.pipe';

@Component({
  selector: 'app-technician-performance',
  standalone: true,
  imports: [CommonModule, RouterModule, TechLevelLabelPipe],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/teknisyenler" class="back-link">← Teknisyenlere Dön</a>
          <h2>Teknisyen Performans Raporu</h2>
        </div>
      </div>

      <div class="tech-profile-card" *ngIf="technician">
        <div class="avatar-area">
          <span class="avatar-placeholder">{{ technician.fullName.charAt(0) }}</span>
        </div>
        <div class="profile-info">
          <h3>{{ technician.fullName }}</h3>
          <p>{{ technician.level | techLevelLabel }} | Çalıştığı Bölge: {{ technician.region }}</p>
        </div>
      </div>

      <div class="performance-grid" *ngIf="technician">
        <!-- Main Score Card -->
        <div class="performance-card score-card">
          <h4>Genel Performans Skoru</h4>
          <div class="score-display">
            <span class="score-num" [ngClass]="getScoreClass(technician.performanceScore)">
              {{ technician.performanceScore }}
            </span>
            <span class="score-max">/100</span>
          </div>
          <div class="score-bar-wrapper">
            <div class="score-bar" [style.width.%]="technician.performanceScore" [ngClass]="getScoreBarClass(technician.performanceScore)"></div>
          </div>
          <p class="score-rating">Değerlendirme: <strong>{{ getPerformanceRating(technician.performanceScore) }}</strong></p>
        </div>

        <!-- KPI Stats -->
        <div class="performance-card stats-card">
          <h4>Operasyonel Metrikler</h4>
          <div class="stats-list">
            <div class="stat-item">
              <span class="stat-label">Tamamlanan İş Sayısı</span>
              <span class="stat-val">{{ technician.completedJobsCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">SLA Zamanında Uyum Oranı</span>
              <span class="stat-val">%{{ getSlaRate() }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Müşteri Memnuniyeti (CSAT)</span>
              <span class="stat-val">4.8 / 5.0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">İlk Seferde Çözüm Oranı (FTFR)</span>
              <span class="stat-val">%{{ getFtfrRate() }}</span>
            </div>
          </div>
        </div>

        <!-- Skill matrix breakdown -->
        <div class="performance-card full-width">
          <h4>Yetkinlik Alanları ve Kıdem Katsayıları</h4>
          <div class="skills-grid">
            <div class="skill-meter" *ngFor="let skill of technician.skills">
              <span class="skill-name">{{ getSkillLabel(skill) }}</span>
              <div class="meter-bar-wrapper">
                <div class="meter-bar" [style.width.%]="getSkillProficiencyPercent(technician.level)" [ngClass]="getScoreBarClass(technician.performanceScore)"></div>
              </div>
              <span class="proficiency-text">{{ getLevelProficiencyText(technician.level) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="error-alert" *ngIf="errorMessage">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styleUrls: ['./technician-performance.component.scss']
})
export class TechnicianPerformancePage implements OnInit {
  private techService = inject(TechnicianService);
  private route = inject(ActivatedRoute);

  technician: Technician | null = null;
  errorMessage: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      try {
        const found = this.techService.getTechnicianById(id);
        if (found) {
          this.technician = found;
        } else {
          this.errorMessage = 'Teknisyen bulunamadı.';
        }
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
      }
    }
  }

  getSkillLabel(skill: SkillType): string {
    const labels: Record<SkillType, string> = {
      WHITE_GOODS: 'Beyaz Eşya',
      HVAC: 'Klima / Soğutma',
      ELECTRIC: 'Elektrik Tesisatı',
      ELECTRONICS_MOTHERBOARD: 'Elektronik / Anakart',
      PLUMBING: 'Sıhhi Tesisat',
      BOILER_HEATING: 'Kombi / Isıtma'
    };
    return labels[skill];
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warn';
    return 'bad';
  }

  getScoreBarClass(score: number): string {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warn';
    return 'bad';
  }

  getPerformanceRating(score: number): string {
    if (score >= 90) return 'Mükemmel (A+)';
    if (score >= 80) return 'Çok İyi (A)';
    if (score >= 70) return 'Başarılı (B)';
    if (score >= 60) return 'Orta (C)';
    return 'Geliştirilmesi Gereken (F)';
  }

  getSlaRate(): number {
    if (!this.technician) return 100;
    // Jenerik formül
    const score = this.technician.performanceScore;
    return Math.min(100, Math.round(score * 0.95 + 4));
  }

  getFtfrRate(): number {
    if (!this.technician) return 90;
    const score = this.technician.performanceScore;
    return Math.min(100, Math.round(score * 0.85 + 10));
  }

  getSkillProficiencyPercent(level: string): number {
    switch (level) {
      case 'EXPERT': return 100;
      case 'SENIOR': return 85;
      case 'MID': return 70;
      case 'JUNIOR':
      default:
        return 50;
    }
  }

  getLevelProficiencyText(level: string): string {
    switch (level) {
      case 'EXPERT': return 'Uzman (%100)';
      case 'SENIOR': return 'Kıdemli (%85)';
      case 'MID': return 'Orta (%70)';
      case 'JUNIOR':
      default:
        return 'Gelişmekte (%50)';
    }
  }
}
