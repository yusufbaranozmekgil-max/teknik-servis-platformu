import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ShiftAssignmentService } from '../../../../core/services/shift-assignment.service';
import { BranchService } from '../../../../core/services/branch.service';
import { TechnicianService } from '../../../../core/services/technician.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ShiftAssignment, ShiftTaskType } from '../../../../core/models/shift-assignment.model';
import { Branch } from '../../../../core/models/branch.model';
import { Technician } from '../../../../core/models/technician.model';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FIELD_LIMITS } from '../../../../core/constants/form-limits.const';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { SHIFT_TASK_TYPE_LABELS, SHIFT_STATUS_LABELS, PRIORITY_LABELS, SKILL_LABELS } from '../../../../core/constants/labels.const';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PermissionVisibilityDirective } from '../../../../shared/directives/permission-visibility.directive';

interface EligibleEntry {
  technician: Technician;
  reason: string | null;
}

@Component({
  selector: 'app-shift-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent, DataTableComponent, PermissionVisibilityDirective],
  template: `
    <div class="page-container">
      <div class="header-section">
        <div>
          <h2>Vardiya / Görev Atama Merkezi</h2>
          <p class="subtitle">Şube veya bölge için teknisyene vardiya / görev tanımlayın; atamalar yetkinlik, bölge ve müsaitlik kontrolünden geçer.</p>
        </div>
        <button
          *appPermissionVisibility="'SHIFT_CREATE'"
          (click)="toggleCreate()"
          class="primary-btn"
        >
          {{ showCreate ? 'Kapat' : '+ Yeni Vardiya' }}
        </button>
      </div>

      <!-- Create form -->
      <div class="card form-card animate-slide" *ngIf="showCreate">
        <h3>Yeni Vardiya / Görev Tanımla</h3>
        <form [formGroup]="createForm" (ngSubmit)="onCreate()">
          <div class="form-grid">
            <app-form-field
              label="Başlık"
              [control]="$any(createForm.get('title'))"
              [maxLength]="100"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Hafta sonu kombi periyodik bakım"
            ></app-form-field>

            <app-form-field
              label="Görev Tipi"
              type="select"
              [control]="$any(createForm.get('taskType'))"
              [required]="true"
            >
              <option value="" disabled>Görev tipi seçin</option>
              <option *ngFor="let opt of taskTypeOptions" [value]="opt.value">{{ opt.label }}</option>
            </app-form-field>

            <app-form-field
              label="Şube / Lokasyon"
              type="select"
              [control]="$any(createForm.get('branchId'))"
              [required]="true"
            >
              <option value="" disabled>Şube seçin</option>
              <option *ngFor="let b of branches" [value]="b.id">{{ b.name }} ({{ b.city }})</option>
            </app-form-field>

            <app-form-field
              label="Bölge / Saha"
              [control]="$any(createForm.get('region'))"
              [maxLength]="60"
              [required]="true"
              [showCounter]="true"
              placeholder="Örn: Anadolu Yakası, Çankaya, ..."
            ></app-form-field>

            <app-form-field
              label="Gerekli Yetkinlik"
              type="select"
              [control]="$any(createForm.get('requiredSkill'))"
              [required]="true"
            >
              <option value="WHITE_GOODS">Beyaz Eşya</option>
              <option value="HVAC">Klima / Soğutma</option>
              <option value="ELECTRIC">Elektrik Tesisatı</option>
              <option value="ELECTRONICS_MOTHERBOARD">Elektronik / Anakart</option>
              <option value="PLUMBING">Sıhhi Tesisat</option>
              <option value="BOILER_HEATING">Kombi / Isıtma</option>
            </app-form-field>

            <app-form-field
              label="Kişi Sayısı"
              type="number"
              [control]="$any(createForm.get('requiredHeadcount'))"
              [min]="1"
              [max]="50"
              [maxLength]="2"
              [showCounter]="true"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Başlangıç (Tarih + Saat)"
              type="datetime-local"
              [control]="$any(createForm.get('start'))"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Bitiş (Tarih + Saat)"
              type="datetime-local"
              [control]="$any(createForm.get('end'))"
              [required]="true"
            ></app-form-field>

            <app-form-field
              label="Öncelik"
              type="select"
              [control]="$any(createForm.get('priority'))"
              [required]="true"
            >
              <option value="STANDARD">Standart</option>
              <option value="URGENT">Acil</option>
              <option value="CRITICAL">Kritik</option>
            </app-form-field>

            <app-form-field
              label="Açıklama"
              [control]="$any(createForm.get('description'))"
              [maxLength]="300"
              [showCounter]="true"
              placeholder="Görev detayı (opsiyonel)"
            ></app-form-field>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <div class="form-actions">
            <button type="button" (click)="toggleCreate()" class="cancel-btn">Vazgeç</button>
            <button type="submit" [disabled]="createForm.invalid" class="save-btn">Vardiyayı Oluştur</button>
          </div>
        </form>
      </div>

      <!-- List -->
      <div class="card">
        <h3>Mevcut Vardiyalar</h3>
        <app-data-table
          [data]="shiftRows"
          [columns]="columns"
          [requiredEditPermission]="'SHIFT_ASSIGN'"
          [requiredDeletePermission]="'SHIFT_DELETE'"
          (editClick)="onEdit($event)"
          (deleteClick)="onDelete($event)"
        ></app-data-table>
      </div>

      <!-- Assign modal -->
      <div class="modal-backdrop" *ngIf="assignModalOpen && selectedShift">
        <div class="modal-box">
          <h3>Vardiyaya Teknisyen Ata — {{ selectedShift.code }}</h3>
          <p class="modal-sub">
            <strong>{{ selectedShift.title }}</strong> ·
            {{ taskTypeLabel(selectedShift.taskType) }} ·
            Yetkinlik: {{ skillLabel(selectedShift.requiredSkill) }} ·
            Bölge: {{ selectedShift.region }}<br>
            {{ formatDate(selectedShift.start) }} → {{ formatDate(selectedShift.end) }} ·
            Atanan: <strong>{{ selectedShift.assignedTechnicianIds.length }} / {{ selectedShift.requiredHeadcount }}</strong>
          </p>

          <div class="assigned-list" *ngIf="selectedShift.assignedTechnicianIds.length > 0">
            <h4>Şu an atanmış teknisyenler</h4>
            <div class="assigned-chip" *ngFor="let id of selectedShift.assignedTechnicianIds">
              <span>{{ technicianName(id) }}</span>
              <button class="chip-remove" (click)="onRemoveTechnician(id)" title="Çıkar">×</button>
            </div>
          </div>

          <h4>Aday Teknisyenler</h4>
          <table class="candidate-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Yetkinlik / Bölge</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of eligibleList">
                <td>{{ e.technician.fullName }}</td>
                <td>
                  <span class="badge">{{ skillsLabel(e.technician.skills) }}</span>
                  <small> · {{ e.technician.region }}</small>
                </td>
                <td>
                  <span class="status-tag ok" *ngIf="!e.reason">Uygun</span>
                  <span class="status-tag blocked" *ngIf="e.reason">{{ e.reason }}</span>
                </td>
                <td>
                  <button class="primary-btn small"
                    [disabled]="!!e.reason || atCapacity()"
                    (click)="onAssignTechnician(e.technician.id)"
                  >Ata</button>
                </td>
              </tr>
              <tr *ngIf="eligibleList.length === 0">
                <td colspan="4" class="empty">Listelenecek teknisyen yok.</td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="assignError" class="error-alert">{{ assignError }}</div>

          <div class="modal-actions">
            <button (click)="closeAssignModal()" class="cancel-btn">Kapat</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./shift-list.component.scss']
})
export class ShiftListComponent implements OnInit {
  private shiftService = inject(ShiftAssignmentService);
  private branchService = inject(BranchService);
  private technicianService = inject(TechnicianService);
  permissionService = inject(PermissionService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  shifts: ShiftAssignment[] = [];
  shiftRows: any[] = [];
  branches: Branch[] = [];
  technicians: Technician[] = [];

  showCreate = false;
  errorMessage: string | null = null;

  assignModalOpen = false;
  selectedShift: ShiftAssignment | null = null;
  eligibleList: EligibleEntry[] = [];
  assignError: string | null = null;

  readonly taskTypeOptions: { value: ShiftTaskType; label: string }[] = [
    { value: 'ROUTINE_MAINT', label: SHIFT_TASK_TYPE_LABELS['ROUTINE_MAINT'] },
    { value: 'ON_CALL', label: SHIFT_TASK_TYPE_LABELS['ON_CALL'] },
    { value: 'INSTALLATION', label: SHIFT_TASK_TYPE_LABELS['INSTALLATION'] },
    { value: 'INSPECTION', label: SHIFT_TASK_TYPE_LABELS['INSPECTION'] },
    { value: 'TRAINING', label: SHIFT_TASK_TYPE_LABELS['TRAINING'] },
    { value: 'OTHER', label: SHIFT_TASK_TYPE_LABELS['OTHER'] }
  ];

  columns: TableColumn[] = [
    { key: 'code', label: 'Kod', sortable: true, filterMaxLength: 15 },
    { key: 'title', label: 'Başlık', sortable: true, filterMaxLength: 30 },
    { key: 'taskTypeLabel', label: 'Görev Tipi', sortable: true, filterMaxLength: 20, filterInputMode: 'letters' },
    { key: 'branchName', label: 'Şube', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'region', label: 'Bölge', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'priorityLabel', label: 'Öncelik', sortable: true, filterMaxLength: 15, filterInputMode: 'letters' },
    { key: 'requiredSkillLabel', label: 'Yetkinlik', sortable: true, filterMaxLength: 25, filterInputMode: 'letters' },
    { key: 'fillStatus', label: 'Atama (Kişi)', sortable: true, filterMaxLength: 10 },
    { key: 'start', label: 'Başlangıç', sortable: true, type: 'date' },
    { key: 'end', label: 'Bitiş', sortable: true, type: 'date' },
    { key: 'statusLabel', label: 'Durum', sortable: true, filterMaxLength: 15, filterInputMode: 'letters' },
    { key: 'actions', label: 'İşlemler', type: 'actions' }
  ];

  createForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100), CustomValidators.noWhitespace()]],
    taskType: ['', [Validators.required]],
    branchId: ['', [Validators.required]],
    region: ['', [Validators.required, Validators.maxLength(60), CustomValidators.noWhitespace()]],
    requiredSkill: ['', [Validators.required]],
    requiredHeadcount: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
    start: ['', [Validators.required]],
    end: ['', [Validators.required]],
    priority: ['STANDARD', [Validators.required]],
    description: ['', [Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.loadBranches();
    this.loadTechnicians();
    this.loadShifts();
  }

  loadShifts(): void {
    try {
      this.shifts = this.shiftService.getAll();
      this.shiftRows = this.shifts.map(s => ({
        ...s,
        taskTypeLabel: SHIFT_TASK_TYPE_LABELS[s.taskType] || s.taskType,
        statusLabel: SHIFT_STATUS_LABELS[s.status] || s.status,
        priorityLabel: PRIORITY_LABELS[s.priority] || s.priority,
        requiredSkillLabel: SKILL_LABELS[s.requiredSkill] || s.requiredSkill,
        branchName: this.branchName(s.branchId),
        fillStatus: `${s.assignedTechnicianIds.length} / ${s.requiredHeadcount}`
      }));
    } catch (err: any) {
      this.toastService.showError('Vardiyalar yüklenemedi: ' + err.message);
    }
  }

  loadBranches(): void {
    try { this.branches = this.branchService.getBranches(); } catch {}
  }

  loadTechnicians(): void {
    try { this.technicians = this.technicianService.getTechnicians(); } catch {}
  }

  branchName(id: string): string {
    return this.branches.find(b => b.id === id)?.name || 'Bilinmeyen';
  }

  technicianName(id: string): string {
    return this.technicians.find(t => t.id === id)?.fullName || id;
  }

  taskTypeLabel(t: ShiftTaskType): string {
    return SHIFT_TASK_TYPE_LABELS[t] || t;
  }

  skillLabel(skill: string): string {
    return SKILL_LABELS[skill] || skill;
  }

  skillsLabel(skills: string[] | undefined): string {
    if (!skills || skills.length === 0) return '—';
    return skills.map(s => SKILL_LABELS[s] || s).join(', ');
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR');
  }

  toggleCreate(): void {
    this.showCreate = !this.showCreate;
    this.errorMessage = null;
    if (this.showCreate) {
      this.createForm.reset({
        title: '', taskType: '', branchId: '', region: '', requiredSkill: '',
        requiredHeadcount: 1, start: '', end: '', priority: 'STANDARD', description: ''
      });
    }
  }

  onCreate(): void {
    if (!this.createForm.valid) return;
    this.errorMessage = null;
    try {
      const val = this.createForm.value;
      const startIso = new Date(val.start).toISOString();
      const endIso = new Date(val.end).toISOString();
      this.shiftService.create({
        title: val.title.trim(),
        taskType: val.taskType,
        description: (val.description || '').trim(),
        branchId: val.branchId,
        region: val.region.trim(),
        requiredSkill: val.requiredSkill,
        requiredHeadcount: Number(val.requiredHeadcount),
        start: startIso,
        end: endIso,
        priority: val.priority,
        notes: null
      });
      this.toastService.showSuccess('Vardiya başarıyla oluşturuldu.');
      this.toggleCreate();
      this.loadShifts();
    } catch (err: any) {
      this.errorMessage = err.message || 'Vardiya oluşturulamadı.';
      this.toastService.showError(this.errorMessage!);
    }
  }

  onEdit(row: any): void {
    const shift = this.shifts.find(s => s.id === row.id);
    if (!shift) return;
    this.openAssignModal(shift);
  }

  async onDelete(row: any): Promise<void> {
    const shift = this.shifts.find(s => s.id === row.id);
    if (!shift) return;
    if (!this.permissionService.hasPermission('SHIFT_DELETE')) {
      this.toastService.showError('Vardiya silme yetkiniz yok.');
      return;
    }
    const ok = await this.confirmService.confirm(
      'Vardiyayı Sil',
      `${shift.code} (${shift.title}) silinsin mi? Bu işlem geri alınamaz.`
    );
    if (!ok) return;
    try {
      this.shiftService.delete(shift.id);
      this.toastService.showSuccess('Vardiya silindi.');
      this.loadShifts();
    } catch (err: any) {
      this.toastService.showError(err.message || 'Silme başarısız.');
    }
  }

  openAssignModal(shift: ShiftAssignment): void {
    if (!this.permissionService.hasPermission('SHIFT_ASSIGN')) {
      this.toastService.showError('Vardiyaya teknisyen atama yetkiniz yok.');
      return;
    }
    this.selectedShift = shift;
    this.eligibleList = this.shiftService.getEligibleTechnicians(shift.id);
    this.assignError = null;
    this.assignModalOpen = true;
  }

  closeAssignModal(): void {
    this.assignModalOpen = false;
    this.selectedShift = null;
    this.eligibleList = [];
    this.assignError = null;
    this.loadShifts();
  }

  atCapacity(): boolean {
    if (!this.selectedShift) return false;
    return this.selectedShift.assignedTechnicianIds.length >= this.selectedShift.requiredHeadcount;
  }

  onAssignTechnician(techId: string): void {
    if (!this.selectedShift) return;
    try {
      const updated = this.shiftService.assignTechnician(this.selectedShift.id, techId);
      this.selectedShift = updated;
      this.eligibleList = this.shiftService.getEligibleTechnicians(updated.id);
      this.assignError = null;
      this.toastService.showSuccess('Teknisyen vardiyaya atandı.');
    } catch (err: any) {
      this.assignError = err.message || 'Atama başarısız.';
    }
  }

  onRemoveTechnician(techId: string): void {
    if (!this.selectedShift) return;
    try {
      const updated = this.shiftService.removeTechnician(this.selectedShift.id, techId);
      this.selectedShift = updated;
      this.eligibleList = this.shiftService.getEligibleTechnicians(updated.id);
      this.assignError = null;
    } catch (err: any) {
      this.assignError = err.message || 'Çıkarma başarısız.';
    }
  }
}
