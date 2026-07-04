import { Component, Input, Output, EventEmitter, forwardRef, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * 3 ayrı input (Gün / Ay / Yıl) ile çalışan akıllı tarih giricisi.
 * - Her input type="text" + inputmode="numeric" — sadece rakam girilir, e/E/+/- bloklanır.
 * - Yıl 4 hane (1900-2099).
 * - Ay 01-12, eksikse mevcut yıl varsayılır.
 * - Gün anlık olarak o ay/yılın gerçek son gününe (28/29/30/31) clamp'lenir;
 *   yıl boşsa cari yıl referans alınır.
 * - Auto-tab: GG 2 haneye dolduğunda AA'ya, AA 2 haneye dolduğunda YYYY'ye odak atlar.
 * - Reactive Forms uyumlu (ControlValueAccessor). Değer: "YYYY-MM-DD" string ya da null.
 */
@Component({
  selector: 'app-smart-date-input',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmartDateInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="smart-date-wrapper" [class.disabled]="disabled">
      <input
        #dayInput
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="d-input day-input"
        [value]="dayStr"
        (keydown)="onKeyDown($event)"
        (input)="onDayInput($any($event.target).value, $any($event.target))"
        (blur)="onBlur()"
        maxlength="2"
        placeholder="GG"
        [attr.disabled]="disabled ? '' : null"
        title="Gün"
      />
      <span class="sep">/</span>
      <input
        #monthInput
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="d-input month-input"
        [value]="monthStr"
        (keydown)="onKeyDown($event)"
        (input)="onMonthInput($any($event.target).value, $any($event.target))"
        (blur)="onBlur()"
        maxlength="2"
        placeholder="AA"
        [attr.disabled]="disabled ? '' : null"
        title="Ay"
      />
      <span class="sep">/</span>
      <input
        #yearInput
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="d-input year-input"
        [value]="yearStr"
        (keydown)="onKeyDown($event)"
        (input)="onYearInput($any($event.target).value, $any($event.target))"
        (blur)="onBlur()"
        maxlength="4"
        placeholder="YYYY"
        [attr.disabled]="disabled ? '' : null"
        title="Yıl"
      />
    </div>
  `,
  styleUrls: ['./smart-date-input.component.scss']
})
export class SmartDateInputComponent implements ControlValueAccessor, OnChanges {
  @Input() minYear = 1900;
  @Input() maxYear = 2099;
  @Input() minDate?: string;
  @Input() maxDate?: string;
  /** Form dışı kullanım için: [value]="..." / (valueChange)="..." */
  @Input() value: string | null = null;
  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild('dayInput') dayInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('monthInput') monthInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('yearInput') yearInputRef?: ElementRef<HTMLInputElement>;

  // Stringler — kullanıcının ham yazdığı (henüz iki haneye tamamlanmamış olabilir)
  dayStr = '';
  monthStr = '';
  yearStr = '';
  disabled = false;

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  // ControlValueAccessor
  writeValue(value: string | null): void {
    this.applyExternalValue(value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.applyExternalValue(this.value);
    }
  }

  private applyExternalValue(value: string | null): void {
    if (!value) {
      this.dayStr = '';
      this.monthStr = '';
      this.yearStr = '';
      return;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (m) {
      this.yearStr = m[1];
      this.monthStr = m[2];
      this.dayStr = m[3];
    }
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  /** Sadece rakam ve navigasyon tuşlarına izin ver. */
  onKeyDown(ev: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(ev.key)) return;
    // Modifier kombinasyonları (Ctrl+A, Ctrl+C, Ctrl+V) serbest
    if (ev.ctrlKey || ev.metaKey) return;
    if (!/^\d$/.test(ev.key)) {
      ev.preventDefault();
    }
  }

  private digitsOnly(s: string): string { return (s || '').replace(/\D/g, ''); }

  /** Ay/yıl bağlamında son geçerli günü hesapla. Yıl boşsa cari yıl. */
  private lastDayOfMonth(month: number, year?: number | null): number {
    if (!month || month < 1 || month > 12) return 31;
    const y = (year && year >= 1900 && year <= 2099) ? year : new Date().getFullYear();
    return new Date(y, month, 0).getDate();
  }

  private currentMonth(): number | null {
    const m = parseInt(this.monthStr, 10);
    return isNaN(m) ? null : m;
  }
  private currentYear(): number | null {
    const y = parseInt(this.yearStr, 10);
    return isNaN(y) ? null : y;
  }

  /** Gün input: rakam temizliği + anlık clamp. */
  onDayInput(raw: string, target: HTMLInputElement): void {
    let s = this.digitsOnly(raw).slice(0, 2);
    if (s.length === 2) {
      let n = parseInt(s, 10);
      const last = this.lastDayOfMonth(this.currentMonth() ?? new Date().getMonth() + 1, this.currentYear());
      if (n > last) n = last;
      if (n < 1) n = 1;
      s = String(n).padStart(2, '0');
      // Tab to month (sadece dolduğunda)
      if (raw !== s) target.value = s;
      this.dayStr = s;
      this.monthInputRef?.nativeElement.focus();
    } else {
      this.dayStr = s;
      if (s !== raw) target.value = s;
    }
    this.emit();
  }

  /** Ay input: 1-12, dolunca yıla geç + gün clamp tetikle. */
  onMonthInput(raw: string, target: HTMLInputElement): void {
    let s = this.digitsOnly(raw).slice(0, 2);
    if (s.length === 2) {
      let n = parseInt(s, 10);
      if (n > 12) n = 12;
      if (n < 1) n = 1;
      s = String(n).padStart(2, '0');
      if (raw !== s) target.value = s;
      this.monthStr = s;
      this.clampDayToMonth();
      this.yearInputRef?.nativeElement.focus();
    } else {
      this.monthStr = s;
      if (s !== raw) target.value = s;
      this.clampDayToMonth();
    }
    this.emit();
  }

  /** Yıl input: 4 haneye varsa clamp, sonra gün clamp tetikle. */
  onYearInput(raw: string, target: HTMLInputElement): void {
    let s = this.digitsOnly(raw).slice(0, 4);
    if (s.length === 4) {
      let n = parseInt(s, 10);
      if (n > this.maxYear) n = this.maxYear;
      if (n < this.minYear) n = this.minYear;
      s = String(n).padStart(4, '0');
      if (raw !== s) target.value = s;
      this.yearStr = s;
      this.clampDayToMonth();
    } else {
      this.yearStr = s;
      if (s !== raw) target.value = s;
    }
    this.emit();
  }

  /** Mevcut günü, mevcut ay/yıla göre olası max güne clamp et. */
  private clampDayToMonth(): void {
    if (!this.dayStr) return;
    const day = parseInt(this.dayStr, 10);
    if (isNaN(day)) return;
    const month = this.currentMonth();
    if (!month) return;
    const last = this.lastDayOfMonth(month, this.currentYear());
    if (day > last) {
      this.dayStr = String(last).padStart(2, '0');
      // DOM'u da senkronize et
      if (this.dayInputRef?.nativeElement) {
        this.dayInputRef.nativeElement.value = this.dayStr;
      }
    }
  }

  onBlur(): void {
    this.onTouched();
    // Final clamp: tüm sınırları zorla
    if (this.yearStr) {
      let y = parseInt(this.yearStr, 10);
      if (!isNaN(y)) {
        if (y > this.maxYear) y = this.maxYear;
        if (y < this.minYear && this.yearStr.length === 4) y = this.minYear;
        this.yearStr = String(y).padStart(4, '0');
      }
    }
    if (this.monthStr) {
      let m = parseInt(this.monthStr, 10);
      if (!isNaN(m)) {
        if (m > 12) m = 12;
        if (m < 1 && this.monthStr.length >= 1) m = 1;
        this.monthStr = String(m).padStart(2, '0');
      }
    }
    if (this.dayStr) {
      let d = parseInt(this.dayStr, 10);
      if (!isNaN(d)) {
        const last = this.lastDayOfMonth(this.currentMonth() ?? 1, this.currentYear());
        if (d > last) d = last;
        if (d < 1) d = 1;
        this.dayStr = String(d).padStart(2, '0');
      }
    }
    this.emit();
  }

  private emit(): void {
    const d = parseInt(this.dayStr, 10);
    const m = parseInt(this.monthStr, 10);
    const y = parseInt(this.yearStr, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || this.yearStr.length < 4) {
      this.onChange(null);
      this.valueChange.emit(null);
      return;
    }
    let iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (this.minDate && iso < this.minDate) iso = this.minDate;
    if (this.maxDate && iso > this.maxDate) iso = this.maxDate;
    this.onChange(iso);
    this.valueChange.emit(iso);
  }
}
