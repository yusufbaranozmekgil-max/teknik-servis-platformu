import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RuleEngineService } from '../../../../core/services/rule-engine.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Rule, RuleActionType } from '../../../../core/models/rule.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-rule-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="header">
        <h2>{{ isEdit ? 'Kuralı Düzenle' : 'Yeni Kural Oluştur' }}</h2>
        <p class="subtitle">Tetikleyici, koşul ve aksiyon bilgilerini girerek özel iş kuralı tanımlayın.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form-card">
        <div class="grid">
          <div class="form-group">
            <label>Kural Adı *</label>
            <input type="text" formControlName="name" maxlength="70" class="form-control" placeholder="Kısa, açıklayıcı bir ad"/>
            <small class="err" *ngIf="form.controls['name'].touched && form.controls['name'].invalid">
              Kural adı zorunludur (en fazla 70 karakter, sadece boşluk olamaz).
            </small>
          </div>

          <div class="form-group">
            <label>Öncelik (1 = en güçlü) *</label>
            <input type="number" formControlName="priority" min="1" max="999" maxlength="3"
                   (keydown)="blockNumberKeys($event)"
                   (input)="onPriorityInput($any($event.target))"
                   class="form-control"/>
            <small class="err" *ngIf="form.controls['priority'].touched && form.controls['priority'].invalid">
              Öncelik 1 ile 999 arasında olmalı.
            </small>
          </div>

          <div class="form-group full">
            <label>Açıklama *</label>
            <textarea formControlName="description" maxlength="250" rows="2" class="form-control"></textarea>
          </div>

          <div class="form-group">
            <label>Tetikleyici *</label>
            <select formControlName="trigger" class="form-control">
              <option value="WORK_ORDER_PLAN">İş Emri Planlaması</option>
              <option value="SPARE_PART_CONSUMPTION">Yedek Parça Tüketimi</option>
              <option value="SERVICE_REQUEST_CREATE">Yeni Servis Talebi</option>
              <option value="SYSTEM_EVENT">Sistem Olayı</option>
            </select>
          </div>

          <div class="form-group">
            <label>Aksiyon Tipi *</label>
            <select formControlName="actionType" class="form-control">
              <option value="BLOCK_ASSIGNMENT">İşlemi Engelle</option>
              <option value="REQUIRE_APPROVAL">Onay Gerektir</option>
              <option value="TRIGGER_ALERT">Uyarı Üret</option>
              <option value="AUTO_PRIORITIZE">Otomatik Önceliklendir</option>
            </select>
          </div>

          <div class="form-group">
            <label>Koşul Alanı (örn: request.priority) *</label>
            <input type="text" formControlName="conditionField" maxlength="60" class="form-control" placeholder="request.priority"/>
          </div>

          <div class="form-group">
            <label>Operatör *</label>
            <select formControlName="operator" class="form-control">
              <option value="EQUALS">Eşit (=)</option>
              <option value="NOT_EQUALS">Eşit Değil (≠)</option>
              <option value="GREATER_THAN">Büyük (&gt;)</option>
              <option value="LESS_THAN">Küçük (&lt;)</option>
              <option value="CONTAINS">İçerir</option>
            </select>
          </div>

          <div class="form-group">
            <label>Koşul Değeri *</label>
            <input type="text" formControlName="conditionValue" maxlength="100" class="form-control"/>
          </div>

          <div class="form-group full">
            <label>Aksiyon Değeri (opsiyonel)</label>
            <input type="text" formControlName="actionValue" maxlength="250" class="form-control" placeholder="Bildirim metni / hedef değer"/>
          </div>

          <div class="form-group">
            <label class="check-label">
              <input type="checkbox" formControlName="isActive"/> Aktif
            </label>
          </div>
        </div>

        <div class="actions">
          <button type="button" (click)="cancel()" class="btn btn-secondary">Vazgeç</button>
          <button type="submit" [disabled]="form.invalid" class="btn btn-primary">
            {{ isEdit ? 'Güncelle' : 'Kaydet' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styleUrls: ['./rule-form.component.scss']
})
export class RuleFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private ruleService = inject(RuleEngineService);
  private permission = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  ruleId: string | null = null;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(70), CustomValidators.noWhitespace()]],
    description: ['', [Validators.required, Validators.maxLength(250), CustomValidators.noWhitespace()]],
    trigger: ['WORK_ORDER_PLAN', Validators.required],
    conditionField: ['', [Validators.required, Validators.maxLength(60), CustomValidators.noWhitespace()]],
    operator: ['EQUALS', Validators.required],
    conditionValue: ['', [Validators.required, Validators.maxLength(100)]],
    actionType: ['BLOCK_ASSIGNMENT' as RuleActionType, Validators.required],
    actionValue: ['', [Validators.maxLength(250)]],
    priority: [10, [Validators.required, Validators.min(1), Validators.max(999)]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.permission.assertPermission('RULE_MANAGE');
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.ruleId = id;
      const rule = this.ruleService.getRuleById(id);
      if (rule) this.form.patchValue(rule as any);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isEdit) {
      const ok = await this.confirmService.confirm('Kuralı Güncelle', 'Bu kuraldaki değişiklikleri kaydetmek istediğinize emin misiniz?');
      if (!ok) return;
    }

    try {
      if (this.isEdit && this.ruleId) {
        this.ruleService.updateRule(this.ruleId, this.form.value as Partial<Rule>);
        this.toast.showSuccess('Kural güncellendi.');
      } else {
        this.ruleService.createRule(this.form.value as Omit<Rule, 'id' | 'createdAt'>);
        this.toast.showSuccess('Kural oluşturuldu.');
      }
      this.router.navigate(['/kurallar']);
    } catch (e: any) {
      this.toast.showError(e?.message ?? 'Kural kaydedilemedi.');
    }
  }

  /** Priority alanı için e/E/+/- bloklanır. */
  blockNumberKeys(ev: KeyboardEvent): void {
    if (['e', 'E', '+', '-'].includes(ev.key)) ev.preventDefault();
  }

  /** Priority manuel kesim: max 3 basamak ve 1-999 arası. */
  onPriorityInput(target: HTMLInputElement): void {
    let v = (target.value ?? '').replace(/[eE+\-]/g, '');
    if (v.length > 3) v = v.slice(0, 3);
    let n = v === '' ? null : Number(v);
    if (n !== null && !isNaN(n)) {
      if (n > 999) n = 999;
      if (n < 1) n = 1;
      v = String(n);
    }
    if (v !== target.value) target.value = v;
    this.form.get('priority')?.setValue(n, { emitEvent: false });
    this.form.get('priority')?.markAsDirty();
  }

  cancel(): void {
    this.router.navigate(['/kurallar']);
  }
}
