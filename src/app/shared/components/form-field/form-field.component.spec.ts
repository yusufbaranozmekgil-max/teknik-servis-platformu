import { describe, expect, it } from "vitest";
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
    const type = (control: FormControl, inputType: string, value: string) => {
        const fixture = TestBed.createComponent(FormFieldComponent);
        fixture.componentInstance.control = control;
        fixture.componentInstance.type = inputType;
        fixture.detectChanges();
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = value;
        input.dispatchEvent(new Event('input'));
    };

    it('sayı alanı forma metin değil sayı yazar', () => {
        const control = new FormControl<number | null>(1);
        type(control, 'number', '25');
        expect(control.value).toBe(25);
    });

    it('boş bırakılan sayı alanı null olur', () => {
        const control = new FormControl<number | null>(1);
        type(control, 'number', '');
        expect(control.value).toBeNull();
    });

    it('metin alanı metin olarak kalır', () => {
        const control = new FormControl<string>('');
        type(control, 'text', '25');
        expect(control.value).toBe('25');
    });
});
