import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TechnicianService } from '../../../../core/services/technician.service';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch } from '../../../../core/models/branch.model';
import { SkillType, SkillLevel, SKILL_LEVEL_LABELS } from '../../../../core/models/skill-type.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS, NUMERIC_LIMITS } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-technician-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormFieldComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/teknisyenler" class="back-link">← Teknisyenlere Dön</a>
          <h2>Yeni Teknisyen Ekle</h2>
        </div>
      </div>

      <div class="card-content">
        <form [formGroup]="techForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <app-form-field
              label="Ad Soyad"
              [control]="$any(techForm.get('fullName'))"
              [maxLength]="FIELD_LIMITS.fullName"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Ahmet Yılmaz"
            ></app-form-field>

            <app-form-field
              label="Telefon"
              [control]="$any(techForm.get('phone'))"
              [maxLength]="FIELD_LIMITS.phone"
              [required]="true"
              [showCounter]="true"
              inputFilter="digits"
              placeholder="Örn: 05551234567"
            ></app-form-field>

            <app-form-field
              label="E-posta"
              [control]="$any(techForm.get('email'))"
              [maxLength]="FIELD_LIMITS.email"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: ahmet@operasyon.com"
            ></app-form-field>

            <app-form-field
              label="Bağlı Şube"
              type="select"
              [control]="$any(techForm.get('branchId'))"
              [required]="true"
            >
              <option value="" disabled selected>Şube Seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</option>
            </app-form-field>

            <app-form-field
              label="Çalıştığı Bölge (İlçe/Semt)"
              [control]="$any(techForm.get('region'))"
              [maxLength]="FIELD_LIMITS.regionCode"
              [required]="true"
              [showCounter]="true"
              inputFilter="letters"
              placeholder="Örn: Çankaya veya Kadıköy"
            ></app-form-field>

            <app-form-field
              label="Kıdem Seviyesi"
              type="select"
              [control]="$any(techForm.get('level'))"
              [required]="true"
            >
              <option value="JUNIOR">Çırak</option>
              <option value="MID">Kalfa</option>
              <option value="SENIOR">Usta</option>
              <option value="EXPERT">Uzman Usta</option>
            </app-form-field>

            <app-form-field
              label="Mesai Başlangıcı"
              type="time"
              [control]="$any(techForm.get('workingHoursStart'))"
              placeholder="08:30"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Mesai Bitişi"
              type="time"
              [control]="$any(techForm.get('workingHoursEnd'))"
              placeholder="17:30"
              [required]="true"
            ></app-form-field>

            <div class="error-alert" style="grid-column:1/-1" *ngIf="techForm.errors?.['workingHoursRange'] && (techForm.get('workingHoursStart')?.touched || techForm.get('workingHoursEnd')?.touched)">
              Mesai bitişi başlangıç saatinden sonra olmalıdır.
            </div>

            <app-form-field
              label="Performans Puanı (0 - 100)"
              type="number"
              [control]="$any(techForm.get('performanceScore'))"
              [min]="NUMERIC_LIMITS.performanceScore.min"
              [max]="NUMERIC_LIMITS.performanceScore.max"
              [maxLength]="3"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Tamamladığı İş Sayısı"
              type="number"
              [control]="$any(techForm.get('completedJobsCount'))"
              [min]="NUMERIC_LIMITS.completedJobCount.min"
              [max]="NUMERIC_LIMITS.completedJobCount.max"
              [maxLength]="10"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Günlük Maksimum İş Kapasitesi"
              type="number"
              [control]="$any(techForm.get('dailyCapacity'))"
              [min]="1"
              [max]="12"
              [maxLength]="10"
              [showCounter]="true"
              [required]="true"
              hint="Bir günde en fazla kaç iş üstlenebileceği (önerilen 3-6)"
            ></app-form-field>
          </div>

          <div class="form-group full-width">
            <label>Yetkinlikler / Uzmanlık Alanları (En az bir adet seçiniz)</label>
            <div class="skills-grid">
              <div *ngFor="let s of skillOptions" class="skill-row" [class.selected]="isSkillSelected(s)">
                <label class="skill-check">
                  <input type="checkbox" [checked]="isSkillSelected(s)" (change)="onSkillChange(s, $any($event.target).checked)" />
                  <span>{{ getSkillLabel(s) }}</span>
                </label>
                <select class="skill-level"
                        *ngIf="isSkillSelected(s)"
                        [value]="skillLevels[s] || 'BEGINNER'"
                        (change)="onSkillLevelChange(s, $any($event.target).value)">
                  <option *ngFor="let lvl of levelOptions" [value]="lvl" [selected]="(skillLevels[s] || 'BEGINNER') === lvl">
                    {{ levelLabel(lvl) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="error-text" *ngIf="skillsError">
              {{ skillsError }}
            </div>
          </div>

          <div class="form-group check-group">
            <label class="switch-label">
              <input type="checkbox" formControlName="isActive" />
              <span class="switch-text">Aktif Teknisyen</span>
            </label>
          </div>

          <div *ngIf="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button type="button" routerLink="/teknisyenler" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="techForm.invalid || loading" class="save-btn">
              {{ loading ? 'Kaydediliyor...' : 'Teknisyeni Kaydet' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./technician-create.component.scss']
})
export class TechnicianCreatePage implements OnInit, ComponentCanDeactivate {
  private techService = inject(TechnicianService);
  private branchService = inject(BranchService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  branches: Branch[] = [];
  selectedSkills: SkillType[] = [];
  skillLevels: Partial<Record<SkillType, SkillLevel>> = {};
  skillsError: string | null = null;
  errorMessage: string | null = null;
  loading = false;
  isSubmitted = false;

  FIELD_LIMITS = FIELD_LIMITS;
  NUMERIC_LIMITS = NUMERIC_LIMITS;

  skillOptions: SkillType[] = [
    'WHITE_GOODS',
    'HVAC',
    'ELECTRIC',
    'ELECTRONICS_MOTHERBOARD',
    'PLUMBING',
    'BOILER_HEATING'
  ];

  levelOptions: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];
  levelLabel(lvl: SkillLevel): string { return SKILL_LEVEL_LABELS[lvl]; }
  isSkillSelected(s: SkillType): boolean { return this.selectedSkills.includes(s); }
  onSkillLevelChange(s: SkillType, lvl: SkillLevel): void { this.skillLevels[s] = lvl; }

  techForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.fullName), CustomValidators.noWhitespace()]],
    phone: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.phone), CustomValidators.phone(), CustomValidators.noWhitespace()]],
    email: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.email), Validators.email]],
    branchId: ['', [Validators.required]],
    region: ['', [Validators.required, Validators.maxLength(FIELD_LIMITS.regionCode), CustomValidators.noWhitespace()]],
    level: ['MID', [Validators.required]],
    workingHoursStart: ['08:30', [Validators.required, CustomValidators.timeFormat()]],
    workingHoursEnd: ['17:30', [Validators.required, CustomValidators.timeFormat()]],
    performanceScore: [80, [Validators.required, Validators.min(NUMERIC_LIMITS.performanceScore.min), Validators.max(NUMERIC_LIMITS.performanceScore.max)]],
    completedJobsCount: [0, [Validators.required, Validators.min(NUMERIC_LIMITS.completedJobCount.min), Validators.max(NUMERIC_LIMITS.completedJobCount.max)]],
    dailyCapacity: [4, [Validators.required, Validators.min(1), Validators.max(12)]],
    isActive: [true]
  }, { validators: CustomValidators.workingHoursRange('workingHoursStart', 'workingHoursEnd') });

  ngOnInit(): void {
    try {
      this.branches = this.branchService.getBranches();
    } catch (err: any) {
      this.errorMessage = 'Şubeler yüklenemedi: ' + err.message;
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

  onSkillChange(skill: SkillType, checked: boolean): void {
    if (checked) {
      if (!this.selectedSkills.includes(skill)) this.selectedSkills.push(skill);
      // Varsayılan seviye: Başlangıç (kullanıcı sonra değiştirebilir)
      if (!this.skillLevels[skill]) this.skillLevels[skill] = 'BEGINNER';
    } else {
      this.selectedSkills = this.selectedSkills.filter(s => s !== skill);
      delete this.skillLevels[skill];
    }
    this.skillsError = this.selectedSkills.length === 0 ? 'En az 1 uzmanlık seçmelisiniz.' : null;
  }

  canDeactivate(): boolean {
    if (this.techForm.dirty && !this.isSubmitted) {
      return confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (this.selectedSkills.length === 0) {
      this.skillsError = 'En az 1 uzmanlık seçmelisiniz.';
      return;
    }

    if (this.techForm.valid) {
      const approved = await this.confirmService.confirm(
        'Teknisyen Kaydet',
        'Yeni teknisyen kaydını oluşturmak istediğinize emin misiniz?'
      );
      if (!approved) return;

      this.loading = true;
      this.errorMessage = null;

      try {
        const formVal = this.techForm.value;
        // Sadece seçili skill'lerin level kayıtlarını al
        const cleanLevels: Partial<Record<SkillType, SkillLevel>> = {};
        for (const s of this.selectedSkills) {
          cleanLevels[s] = this.skillLevels[s] || 'BEGINNER';
        }
        const payload = {
          ...formVal,
          skills: this.selectedSkills,
          skillLevels: cleanLevels,
          workingDays: [1, 2, 3, 4, 5],
          isOnLeave: false,
          leaveStart: null,
          leaveEnd: null
        };
        this.techService.createTechnician(payload);
        this.isSubmitted = true;
        this.toastService.showSuccess('Teknisyen başarıyla kaydedildi.');
        this.router.navigate(['/teknisyenler']);
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
        this.toastService.showError(this.errorMessage!);
      } finally {
        this.loading = false;
      }
    }
  }
}

