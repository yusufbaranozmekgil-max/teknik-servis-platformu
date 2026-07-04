import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { FIELD_LIMITS } from '../../../../core/constants/form-limits.const';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent],
  template: `
    <div class="login-page">
      <div class="login-wrapper">
        <!-- Sol Bölüm: Logo ve Tanıtım -->
        <div class="intro-section">
          <div class="logo-box">
            <span class="logo-icon" aria-hidden="true">👷</span>
          </div>
          <h1>Teknik Servis Operasyon Platformu</h1>
          <p class="subtitle">Çok şubeli saha operasyon, stok ve iş emri yönetimi</p>
          
          <div class="glass-feature-list">
            <div class="feature-item">
              
              <span>Dinamik Kaynak Skorlama & Planlama</span>
            </div>
            <div class="feature-item">
              
              <span>RBAC Yetkilendirme & İş Kuralları</span>
            </div>
            <div class="feature-item">
              
              <span>Gerçek Zamanlı Audit Log Diff Takibi</span>
            </div>
          </div>
        </div>

        <!-- Sağ Bölüm: Login Formu -->
        <div class="login-card">
          <div class="card-header">
            <h2>Giriş Yap</h2>
            <p>Devam etmek için bilgilerinizi girin.</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <app-form-field
              label="E-posta"
              type="email"
              [control]="$any(loginForm.get('email'))"
              [maxLength]="FIELD_LIMITS.email"
              [required]="true"
              placeholder="ornek@demo.com"
            ></app-form-field>
            
            <app-form-field
              label="Şifre"
              type="password"
              [control]="$any(loginForm.get('password'))"
              [maxLength]="FIELD_LIMITS.password"
              [required]="true"
              placeholder="123456"
            ></app-form-field>

            <div *ngIf="errorMessage" class="general-error">
              {{ errorMessage }}
            </div>

            <button type="submit" [disabled]="loginForm.invalid" class="login-btn">Giriş Yap</button>
          </form>

          <div class="demo-accounts-section">
            <p class="demo-title"> Demo Kullanıcıları (Şifre: 123456)</p>
            <div class="demo-pills">
              <button type="button" (click)="fillDemo('admin@demo.com')" class="demo-pill">Sistem Yöneticisi</button>
              <button type="button" (click)="fillDemo('operation@demo.com')" class="demo-pill">Operasyon Müdürü</button>
              <button type="button" (click)="fillDemo('branch@demo.com')" class="demo-pill">Şube Sorumlusu</button>
              <button type="button" (click)="fillDemo('dispatcher@demo.com')" class="demo-pill">Planlama / Dispeçer</button>
              <button type="button" (click)="fillDemo('warehouse@demo.com')" class="demo-pill">Depo Sorumlusu</button>
              <button type="button" (click)="fillDemo('technician@demo.com')" class="demo-pill">Teknisyen</button>
              <button type="button" (click)="fillDemo('report@demo.com')" class="demo-pill">Raporlama Yetkilisi</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  FIELD_LIMITS = FIELD_LIMITS;

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(FIELD_LIMITS.email)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(FIELD_LIMITS.password)]]
  });

  errorMessage: string | null = null;

  fillDemo(email: string): void {
    this.loginForm.patchValue({
      email,
      password: '123456'
    });
    this.loginForm.markAsDirty();
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      const success = this.authService.login(email, password);
      
      if (success) {
        this.errorMessage = null;
        this.router.navigate(['/panel']);
      } else {
        this.errorMessage = 'E-posta veya şifre hatalı ya da kullanıcı hesabı aktif değil.';
      }
    }
  }
}
