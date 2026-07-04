import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  // 1. Plate Number Validator (Turkish Plate formats)
  static plateNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const cleanVal = String(control.value).replace(/\s+/g, '').toUpperCase();
      const plateRegex = /^(0[1-9]|[1-7][0-9]|8[0-1])[A-Z]{1,3}[0-9]{2,4}$/;
      return plateRegex.test(cleanVal) ? null : { invalidPlate: true };
    };
  }

  // 2. Phone Number Validator (Turkish format)
  static phone(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const cleanVal = String(control.value).replace(/\D/g, '');
      const phoneRegex = /^(0?5[0-9]{9})$/;
      return phoneRegex.test(cleanVal) ? null : { invalidPhone: true };
    };
  }

  // 3. Prevent Negative Values Validator
  static preventNegative(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      const numVal = Number(control.value);
      return isNaN(numVal) || numVal >= 0 ? null : { negativeValue: true };
    };
  }

  // 4. Future Date Validator
  static futureDate(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const inputDate = new Date(control.value).getTime();
      const now = Date.now();
      return inputDate > now ? null : { pastDate: true };
    };
  }

  // 5. No Whitespace Validator
  static noWhitespace(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined) return null;
      const isWhitespace = String(control.value).trim().length === 0;
      return !isWhitespace ? null : { whitespace: true };
    };
  }

  // 6. Max Trimmed Length Validator
  static maxTrimmedLength(max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      return String(control.value).trim().length <= max ? null : { maxTrimmedLength: true };
    };
  }

  // 7. Min Number Validator
  static minNumber(min: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      return Number(control.value) >= min ? null : { minNumber: { required: min, actual: control.value } };
    };
  }

  // 8. Max Number Validator
  static maxNumber(max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      return Number(control.value) <= max ? null : { maxNumber: { required: max, actual: control.value } };
    };
  }

  // 9. Number Range Validator
  static numberRange(min: number, max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      const val = Number(control.value);
      return val >= min && val <= max ? null : { numberRange: { min, max, actual: val } };
    };
  }

  // 10. Positive Number Validator
  static positiveNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      return Number(control.value) > 0 ? null : { positiveNumber: true };
    };
  }

  // 11. Non-Negative Number Validator
  static nonNegativeNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      return Number(control.value) >= 0 ? null : { nonNegativeNumber: true };
    };
  }

  // 12. Date After Validator
  static dateAfter(startControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const parent = control.parent;
      if (!parent) return null;
      const startValue = parent.get(startControlName)?.value;
      if (!startValue) return null;
      const startTime = new Date(startValue).getTime();
      const endTime = new Date(control.value).getTime();
      return endTime > startTime ? null : { dateAfter: true };
    };
  }

  // 13. Coordinates (lat/lng range checks)
  static coordinates(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const val = Number(control.value);
      if (isNaN(val)) return { invalidCoordinates: true };
      return val >= -180 && val <= 180 ? null : { invalidCoordinates: true };
    };
  }

  // 14. Reserved Not Greater Than Stock
  static reservedNotGreaterThanStock(stockControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;
      const stock = parent.get(stockControlName)?.value;
      const reserved = control.value;
      if (stock === null || stock === undefined || reserved === null || reserved === undefined) return null;
      return Number(reserved) <= Number(stock) ? null : { reservedGreaterThanStock: true };
    };
  }

  // 15. Used Not Greater Than Reserved
  static usedNotGreaterThanReserved(reservedControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;
      const reserved = parent.get(reservedControlName)?.value;
      const used = control.value;
      if (reserved === null || reserved === undefined || used === null || used === undefined) return null;
      return Number(used) <= Number(reserved) ? null : { usedGreaterThanReserved: true };
    };
  }

  // 16. HH:mm format — saat 00-23, dakika 00-59
  static timeFormat(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = control.value;
      if (v === null || v === undefined || v === '') return null;
      const re = /^([01]\d|2[0-3]):[0-5]\d$/;
      return re.test(String(v)) ? null : { invalidTime: true };
    };
  }

  // 17b. Tarih aralığı: YYYY-MM-DD, yıl 1900-2099, geçerli takvim tarihi
  static dateRange(minDate?: string, maxDate?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = control.value;
      if (v === null || v === undefined || v === '') return null;
      const s = String(v).slice(0, 10); // input type="date" → "YYYY-MM-DD"
      const re = /^(\d{4})-(\d{2})-(\d{2})$/;
      const m = re.exec(s);
      if (!m) return { invalidDate: true };
      const year = +m[1], month = +m[2], day = +m[3];
      if (year < 1900 || year > 2099) return { dateOutOfRange: { reason: 'Yıl 1900–2099 arasında olmalıdır.' } };
      if (month < 1 || month > 12) return { dateOutOfRange: { reason: 'Ay 1–12 arasında olmalıdır.' } };
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        return { dateOutOfRange: { reason: 'Geçersiz takvim tarihi (örn: 30 Şubat).' } };
      }
      if (minDate && s < minDate) return { dateOutOfRange: { reason: `Tarih en erken ${minDate} olabilir.` } };
      if (maxDate && s > maxDate) return { dateOutOfRange: { reason: `Tarih en geç ${maxDate} olabilir.` } };
      return null;
    };
  }

  // 17. workingHoursEnd > workingHoursStart (FormGroup-level)
  static workingHoursRange(startKey: string, endKey: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const s = group.get(startKey)?.value;
      const e = group.get(endKey)?.value;
      if (!s || !e) return null;
      const re = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!re.test(String(s)) || !re.test(String(e))) return null; // timeFormat ayrı validate eder
      const [sh, sm] = String(s).split(':').map(Number);
      const [eh, em] = String(e).split(':').map(Number);
      return (eh * 60 + em) > (sh * 60 + sm) ? null : { workingHoursRange: true };
    };
  }
}
