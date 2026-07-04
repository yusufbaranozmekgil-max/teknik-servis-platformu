import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-group-wrapper">
      <div class="label-wrapper" *ngIf="label">
        <label [for]="id">
          {{ label }} <span class="required-star" *ngIf="required">*</span>
        </label>
        <span class="char-counter" 
              *ngIf="showCounter && maxLength && control"
              [class.warning-counter]="getValueLength() >= maxLength * 0.9"
              [class.danger-counter]="getValueLength() >= maxLength">
          {{ getValueLength() }} / {{ maxLength }}
        </span>
      </div>
      
      <ng-container [ngSwitch]="type">
        <!-- Textarea -->
        <textarea
          *ngSwitchCase="'textarea'"
          [id]="id"
          [formControl]="control"
          [attr.maxlength]="maxLength"
          [placeholder]="placeholder"
          class="form-control textarea-field"
        ></textarea>
        
        <!-- Select -->
        <select
          *ngSwitchCase="'select'"
          [id]="id"
          [formControl]="control"
          class="form-control select-field"
        >
          <ng-content></ng-content>
        </select>
        
        <!-- Default Input -->
        <input
          *ngSwitchDefault
          #defaultInput
          [id]="id"
          [type]="type"
          [formControl]="control"
          [attr.maxlength]="maxLength"
          [attr.min]="min"
          [attr.max]="max"
          [attr.step]="step"
          [placeholder]="placeholder"
          [readonly]="readonly"
          (keydown)="onKeyDown($event)"
          (input)="onNativeInput($any($event.target), defaultInput)"
          (change)="onNativeChange($any($event.target))"
          (blur)="onNativeBlur($any($event.target))"
          class="form-control"
        />
      </ng-container>

      <!-- Hata Mesajları -->
      <div class="error-text" *ngIf="control && control.touched && control.errors">
        <span *ngIf="control.errors['required']">
          {{ label || 'Bu alan' }} zorunludur.
        </span>
        <span *ngIf="control.errors['whitespace']">
          {{ label || 'Bu alan' }} sadece boşluklardan oluşamaz.
        </span>
        <span *ngIf="control.errors['maxlength']">
          En fazla {{ maxLength }} karakter girilebilir.
        </span>
        <span *ngIf="control.errors['min'] || control.errors['minNumber']">
          <ng-container *ngIf="label?.includes('Enlem')">Enlem -90 ile 90 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Boylam')">Boylam -180 ile 180 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Kapasite')">Günlük teknisyen kapasitesi 1 ile 10 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="!label?.includes('Enlem') && !label?.includes('Boylam') && !label?.includes('Kapasite')">En az {{ min }} olmalıdır.</ng-container>
        </span>
        <span *ngIf="control.errors['max'] || control.errors['maxNumber']">
          <ng-container *ngIf="label?.includes('Enlem')">Enlem -90 ile 90 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Boylam')">Boylam -180 ile 180 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Kapasite')">Günlük teknisyen kapasitesi 1 ile 10 arasında olmalıdır.</ng-container>
          <ng-container *ngIf="!label?.includes('Enlem') && !label?.includes('Boylam') && !label?.includes('Kapasite')">En fazla {{ max }} olmalıdır.</ng-container>
        </span>
        <span *ngIf="control.errors['numberRange']">
          <ng-container *ngIf="label?.includes('Enlem')">Enlem {{ control.errors['numberRange'].min }} ile {{ control.errors['numberRange'].max }} arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Boylam')">Boylam {{ control.errors['numberRange'].min }} ile {{ control.errors['numberRange'].max }} arasında olmalıdır.</ng-container>
          <ng-container *ngIf="label?.includes('Kapasite')">Günlük teknisyen kapasitesi {{ control.errors['numberRange'].min }} ile {{ control.errors['numberRange'].max }} arasında olmalıdır.</ng-container>
          <ng-container *ngIf="!label?.includes('Enlem') && !label?.includes('Boylam') && !label?.includes('Kapasite')">
            Değer {{ control.errors['numberRange'].min }} ile {{ control.errors['numberRange'].max }} arasında olmalıdır.
          </ng-container>
        </span>
        <span *ngIf="control.errors['invalidPlate']">
          Geçersiz plaka formatı (Örn: 34ABC123).
        </span>
        <span *ngIf="control.errors['invalidPhone']">
          Geçersiz telefon formatı (Örn: 05551234567).
        </span>
        <span *ngIf="control.errors['invalidTime']">
          Geçerli bir saat giriniz. Format HH:mm olmalıdır (00:00 – 23:59).
        </span>
        <span *ngIf="control.errors['invalidDate']">
          Geçerli bir tarih giriniz (YYYY-AA-GG).
        </span>
        <span *ngIf="control.errors['dateOutOfRange']">
          {{ control.errors['dateOutOfRange'].reason }}
        </span>
        <span *ngIf="control.errors['pastDate']">
          Geçmiş tarih seçilemez.
        </span>
        <span *ngIf="control.errors['dateAfter']">
          Geçersiz tarih aralığı.
        </span>
        <span *ngIf="control.errors['reservedGreaterThanStock']">
          Rezerve miktarı fiziksel stok miktarını aşamaz.
        </span>
        <span *ngIf="control.errors['usedGreaterThanReserved']">
          Kullanılan miktar rezerve edilen miktarı aşamaz.
        </span>
        <span *ngIf="control.errors['negativeValue']">
          Sayısal değer negatif olamaz.
        </span>
      </div>
    </div>
  `,
  styleUrls: ['./form-field.component.scss']
})
export class FormFieldComponent {
  @Input() id = 'field-' + Math.random().toString(36).substring(2, 9);
  @Input() label = '';
  @Input() control!: FormControl;
  @Input() maxLength?: number;
  // min/max hem sayı (number input için) hem string (date/time input için) olabilir.
  @Input() min?: number | string;
  @Input() max?: number | string;
  @Input() step?: string;
  @Input() type = 'text';
  @Input() required = false;
  @Input() placeholder = '';
  @Input() showCounter = false;
  @Input() readonly = false;
  @Input() hint = '';
  /** Tuş takip filtresi: 'letters' = sadece harf+boşluk (Türkçe dahil), 'digits' = sadece rakam, 'none' = serbest */
  @Input() inputFilter: 'letters' | 'digits' | 'none' = 'none';
  @Input() maxDecimals?: number;

  /**
   * HTML <input type="number"> maxlength attribute'unu tanımaz; bu yüzden manuel kesim yapıyoruz.
   * Aynı zamanda min/max numerik aralık dışı değerler tipe çevirmeden önce sınırlanır.
   */
  /**
   * type="number" inputlarında tarayıcı 'e', 'E', '+' karakterlerine izin verir (bilimsel gösterim).
   * Bu hem maxLength'i atlatır hem de büyük sayılar üretir; engelliyoruz.
   * '-' negatif sayılar için (latitude/longitude) korunur. '.' ondalık için korunur.
   */
  onKeyDown(ev: KeyboardEvent): void {
    if (this.type !== 'number') return;
    const blocked = ['e', 'E', '+'];
    if (blocked.includes(ev.key)) {
      ev.preventDefault();
    }
  }

  onNativeInput(target: HTMLInputElement, _ref: HTMLInputElement): void {
    let raw = target.value ?? '';

    // 0) type=number için e/E/+ yapıştırma yoluyla gelmişse temizle
    if (this.type === 'number') {
      const cleaned = raw.replace(/[eE+]/g, '');
      if (cleaned !== raw) { raw = cleaned; target.value = raw; }
    }

    if (this.type === 'number' && this.maxDecimals !== undefined && raw.includes('.')) {
      const parts = raw.split('.');
      if (parts[1] && parts[1].length > this.maxDecimals) {
        raw = parts[0] + '.' + parts[1].slice(0, this.maxDecimals);
        target.value = raw;
      }
    }

    // 1) Karakter sınıfı filtresi (sadece harf / sadece rakam)
    if (this.inputFilter === 'letters') {
      const cleaned = raw.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s'-]/g, '');
      if (cleaned !== raw) { raw = cleaned; target.value = raw; }
    } else if (this.inputFilter === 'digits') {
      const cleaned = raw.replace(/[^0-9]/g, '');
      if (cleaned !== raw) { raw = cleaned; target.value = raw; }
    }

    // 2) maxLength kesimi (özellikle type="number" maxlength'i yoksaydığı için)
    if (this.maxLength && raw.length > this.maxLength) {
      raw = raw.slice(0, this.maxLength);
      target.value = raw;
    }

    // 2b) type=number için min/max'a hard clamp (HTML min/max yalnızca uyarı verir, değeri zorla kısıtlamaz)
    if (this.type === 'number' && raw !== '' && raw !== '-') {
      let n = Number(raw);
      if (!isNaN(n)) {
        const maxNum = typeof this.max === 'number' ? this.max : (typeof this.max === 'string' ? Number(this.max) : NaN);
        const minNum = typeof this.min === 'number' ? this.min : (typeof this.min === 'string' ? Number(this.min) : NaN);
        let clamped = n;
        if (!isNaN(maxNum) && clamped > maxNum) clamped = maxNum;
        if (!isNaN(minNum) && clamped < minNum) clamped = minNum;
        if (clamped !== n) {
          raw = String(clamped);
          target.value = raw;
        }
      }
    }

    // 3) FormControl senkronizasyonu
    if (target.value !== (this.control?.value ?? '')) {
      if (this.type === 'number') {
        const n = raw === '' || raw === '-' ? null : Number(raw);
        this.control?.setValue(n, { emitEvent: false });
      } else if (this.inputFilter !== 'none') {
        this.control?.setValue(raw, { emitEvent: false });
      }
      this.control?.markAsDirty();
    }
  }

  getValueLength(): number {
    const v = this.control?.value;
    if (v === null || v === undefined) return 0;
    return String(v).length;
  }

  /**
   * type="date" change/blur olayında akıllı tarih düzeltmesi:
   *  - Yıl 4 basamağa sıkıştırılır (1900-2099 dışı clamp'lenir).
   *  - Geçersiz gün (ör. 30 Şubat) → o ayın son geçerli gününe (28/29/30/31) clamp'lenir.
   *  - Min/Max sınırı varsa onlara da clamp'lenir.
   */
  private clampDate(target: HTMLInputElement): void {
    if (this.type !== 'date') return;
    const raw = target.value ?? '';
    if (!raw) return;
    const m = /^(\d{1,5})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (!m) return;
    let year = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    let day = parseInt(m[3], 10);

    // Yıl 1900-2099'a clamp
    if (year < 1900) year = 1900;
    if (year > 2099) year = 2099;
    // Ay 1-12'ye clamp
    if (month < 1) month = 1;
    if (month > 12) month = 12;
    // Gün: o ay/yılın son gününe clamp (28/29/30/31)
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (day < 1) day = 1;
    if (day > lastDayOfMonth) day = lastDayOfMonth;

    let normalized = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Min/Max sınırına clamp
    if (typeof this.min === 'string' && this.min && normalized < this.min) normalized = this.min;
    if (typeof this.max === 'string' && this.max && normalized > this.max) normalized = this.max;

    if (normalized !== raw) {
      target.value = normalized;
      this.control?.setValue(normalized, { emitEvent: false });
      this.control?.markAsDirty();
    }
  }

  onNativeChange(target: HTMLInputElement): void {
    this.clampDate(target);
  }

  onNativeBlur(target: HTMLInputElement): void {
    this.clampDate(target);
  }
}
