import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportExportService, ImportResult } from '../../../../core/services/import-export.service';
import { STORAGE_KEYS } from '../../../../core/storage/storage-keys';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';

interface ExportOption {
  key: string;
  name: string;
}

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="import-export-container">
      <header class="page-header animate-fade-in">
        <h1>Veri Transfer Merkezi</h1>
        <p>Sistem verilerini toplu olarak JSON/CSV formatında indirebilir veya JSON şablonları aracılığıyla veri yükleyebilirsiniz.</p>
      </header>

      <div class="panels-grid">
        <!-- ==================== EXPORT CARD ==================== -->
        <div class="transfer-card animate-card">
          <div class="card-header">
            <h3>Veri Dışa Aktarımı</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="export-model">Aktarılacak Veri Modeli</label>
              <select id="export-model" [value]="selectedExportKey" (change)="selectedExportKey = $any($event.target).value" class="select-input">
                <option *ngFor="let opt of exportOptions" [value]="opt.key">{{ opt.name }}</option>
              </select>
            </div>
            
            <p class="description-text">Seçilen koleksiyon verileri tarayıcınızın yerel depolama alanından okunur ve indirilmeye hazır hale getirilir.</p>

            <div class="action-buttons">
              <button (click)="handleExport('json')" class="btn-action json">JSON Olarak İndir</button>
              <button (click)="handleExport('csv')" class="btn-action csv">CSV Olarak İndir</button>
            </div>
          </div>
        </div>

        <!-- ==================== IMPORT CARD ==================== -->
        <div class="transfer-card animate-card">
          <div class="card-header">
            <h3>Veri İçe Aktarımı</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="import-model">Yüklenecek Model Tipi</label>
              <select id="import-model" [value]="selectedImportType" (change)="selectedImportType = $any($event.target).value" class="select-input">
                <option value="BRANCH">Şube</option>
                <option value="TECHNICIAN">Saha Teknisyeni</option>
                <option value="SPARE_PART">Yedek Parça</option>
                <option value="VEHICLE">Saha Aracı</option>
                <option value="SERVICE_REQUEST">Servis Talebi</option>
              </select>
            </div>

            <!-- Şablon indirme linkleri/butonları -->
            <div class="template-downloads">
              <button (click)="downloadTemplate('json')" class="btn-template">Örnek JSON Şablonu İndir</button>
              <button (click)="downloadTemplate('csv')" class="btn-template">Örnek CSV Şablonu İndir</button>
            </div>

            <div class="form-group">
              <label for="import-file">JSON Dosyası Seçin</label>
              <input 
                id="import-file" 
                type="file" 
                accept=".json" 
                (change)="onFileSelected($event)" 
                class="file-input"
              />
            </div>

            <p class="description-text info">[DİKKAT] İçe aktarılan veriler mevcut koleksiyona eklenir. Şema doğrulamasından geçemeyen kayıtlar atlanacak ve raporlanacaktır.</p>

            <button 
              [disabled]="!selectedFile || loading" 
              (click)="handleImport()" 
              class="btn-action import-execute"
            >
              {{ loading ? 'Aktarılıyor...' : 'Verileri İçe Aktar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== IMPORT RESULTS REPORT ==================== -->
      <div class="import-results-card animate-slide-in" *ngIf="importResult">
        <div class="card-header">
          <h3>İçe Aktarım Sonuç Özeti</h3>
          <span class="badge" [class.badge-green]="importResult.failedCount === 0" [class.badge-orange]="importResult.failedCount > 0">
            {{ importResult.failedCount === 0 ? 'TAMAMI BAŞARILI' : 'KISMI BAŞARILI' }}
          </span>
        </div>
        <div class="card-body">
          <div class="results-stats">
            <div class="stat-box">
              <span class="stat-label">Toplam İşlenen</span>
              <span class="stat-val">{{ importResult.total }}</span>
            </div>
            <div class="stat-box success">
              <span class="stat-label">Başarıyla Eklenen</span>
              <span class="stat-val">{{ importResult.successCount }}</span>
            </div>
            <div class="stat-box failed">
              <span class="stat-label">Hatalı / Atlanan</span>
              <span class="stat-val">{{ importResult.failedCount }}</span>
            </div>
          </div>

          <!-- Successful imports table -->
          <div class="success-log" *ngIf="importResult.successCount > 0">
            <h4>Yüklenen Kayıtlar ({{ importResult.successCount }} adet)</h4>
            <div class="log-rows-container">
              <div class="log-row" *ngFor="let rec of importResult.importedRecords">
                <strong>ID:</strong> <code>{{ rec.id }}</code> | 
                <strong>Bilgi:</strong> <span>{{ rec.name || rec.fullName || rec.plateNumber || rec.title || 'Kayıt detayı' }}</span>
              </div>
            </div>
          </div>

          <!-- Errors report table -->
          <div class="error-log" *ngIf="importResult.failedCount > 0">
            <h4>Hatalı Satırlar ve Nedenleri</h4>
            <button (click)="downloadErrorReport()" class="btn-download-report">Hata Raporunu İndir (.txt)</button>
            
            <div class="table-wrapper">
              <table class="error-table">
                <thead>
                  <tr>
                    <th>Satır No</th>
                    <th>Veri Hücresi / İçerik</th>
                    <th>Tespit Edilen Hatalar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let fail of importResult.failedRecords">
                    <td><strong>#{{ fail.rowIndex }}</strong></td>
                    <td class="cell-data"><code>{{ stringifyData(fail.data) }}</code></td>
                    <td>
                      <ul class="error-list">
                        <li *ngFor="let err of fail.errors">[HATA] {{ err }}</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent implements ComponentCanDeactivate {
  private service = inject(ImportExportService);
  private confirmService = inject(ConfirmService);
  private toastService = inject(ToastService);

  exportOptions: ExportOption[] = [
    { key: STORAGE_KEYS.BRANCHES, name: 'Şubeler (Branches)' },
    { key: STORAGE_KEYS.TECHNICIANS, name: 'Saha Teknisyenleri (Technicians)' },
    { key: STORAGE_KEYS.SPARE_PARTS, name: 'Yedek Parça Deposu (Spare Parts)' },
    { key: STORAGE_KEYS.VEHICLES, name: 'Saha Araçları (Vehicles)' },
    { key: STORAGE_KEYS.SERVICE_REQUESTS, name: 'Müşteri Talepleri (Service Requests)' },
    { key: STORAGE_KEYS.WORK_ORDERS, name: 'İş Emirleri (Work Orders)' },
    { key: STORAGE_KEYS.AUDIT_LOGS, name: 'Sistem Audit Günlükleri (Audit Logs)' },
    { key: STORAGE_KEYS.NOTIFICATIONS, name: 'Sistem Bildirimleri (Notifications)' }
  ];

  selectedExportKey = STORAGE_KEYS.BRANCHES;
  selectedImportType = 'BRANCH';
  selectedFile: File | null = null;
  importResult: ImportResult | null = null;
  loading = false;
  isSubmitted = false;

  canDeactivate(): boolean {
    if (this.selectedFile && !this.isSubmitted) {
      return confirm('Seçilen dosya henüz içe aktarılmadı. Sayfadan ayrılmak istediğinize emin misiniz?');
    }
    return true;
  }

  stringifyData(data: any): string {
    return this.service.stringifyRecord(data);
  }

  handleExport(format: 'json' | 'csv'): void {
    let content = '';
    let ext = '';
    let mime = '';

    if (format === 'json') {
      content = this.service.exportToJson(this.selectedExportKey);
      ext = 'json';
      mime = 'application/json';
    } else {
      content = this.service.exportToCsv(this.selectedExportKey);
      ext = 'csv';
      mime = 'text/csv';
    }

    if (!content) {
      this.toastService.showWarning('Seçilen koleksiyonda ihraç edilecek kayıt bulunamadı.');
      return;
    }

    const blob = new Blob([content], { type: mime });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `export-${this.selectedExportKey}-${Date.now()}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 0);

    this.toastService.showSuccess('Veri başarıyla ihraç edildi.');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.isSubmitted = false;
    } else {
      this.selectedFile = null;
    }
  }

  async handleImport(): Promise<void> {
    if (!this.selectedFile) return;

    const approved = await this.confirmService.confirm(
      'Veri İçe Aktarımı',
      'Seçilen dosyayı içe aktarmak istediğinize emin misiniz? Mevcut verilere eklenecektir.'
    );
    if (!approved) return;

    this.loading = true;

    try {
      const records = await this.service.parseJsonFile(this.selectedFile);
      this.importResult = this.service.importValidRecords(this.selectedImportType, records);
      this.isSubmitted = true;
      this.toastService.showSuccess(`İçe aktarım tamamlandı! Eklenen: ${this.importResult.successCount}, Hatalı/Atlanan: ${this.importResult.failedCount}`);
    } catch (err: any) {
      this.toastService.showError(`Hata: ${err.message}`);
    } finally {
      this.loading = false;
    }
  }

  downloadErrorReport(): void {
    if (!this.importResult) return;
    const reportText = this.service.generateImportErrorReport(this.importResult);
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `import-error-report-${Date.now()}.txt`;
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  downloadTemplate(format: 'json' | 'csv'): void {
    let content = '';
    const type = this.selectedImportType;
    let fileName = `sample-${type.toLowerCase()}-template`;

    if (format === 'json') {
      fileName += '.json';
      const sampleData: Record<string, any[]> = {
        BRANCH: [
          {
            "code": "SUBE-01",
            "name": "Kadıköy Merkez Şube",
            "city": "İstanbul",
            "district": "Kadıköy",
            "contactPerson": "Ahmet Yılmaz",
            "latitude": 40.9901,
            "longitude": 29.0201,
            "dailyCapacity": 5,
            "workingHoursStart": "09:00",
            "workingHoursEnd": "18:00",
            "isActive": true
          }
        ],
        TECHNICIAN: [
          {
            "fullName": "Mehmet Demir",
            "phone": "05551112233",
            "email": "mehmet@teknik.com",
            "branchId": "sube-ist-01",
            "region": "Kadıköy",
            "level": "SENIOR",
            "skills": ["HVAC", "PLUMBING"],
            "workingHoursStart": "08:30",
            "workingHoursEnd": "17:30",
            "workingDays": [1,2,3,4,5],
            "isActive": true,
            "performanceScore": 90
          }
        ],
        SPARE_PART: [
          {
            "code": "COMP-001",
            "name": "Kompresör Motoru 1.5HP",
            "category": "COMPRESSOR",
            "compatibleDevices": "Bulaşık ve Çamaşır Makineleri",
            "stockQuantity": 20,
            "minStockThreshold": 5,
            "unitPrice": 1200.50,
            "unit": "PCS",
            "branchId": "sube-ist-01"
          }
        ],
        VEHICLE: [
          {
            "plateNumber": "34ABC123",
            "brand": "Renault",
            "model": "Kangoo",
            "vehicleType": "Van",
            "fuelLevel": 100,
            "payloadCapacityKg": 800,
            "status": "AVAILABLE",
            "branchId": "sube-ist-01"
          }
        ],
        SERVICE_REQUEST: [
          {
            "code": "REQ-001",
            "customerId": "cust-1",
            "customerName": "Ahmet Kaya",
            "customerPhone": "05550009988",
            "title": "Bulaşık Makinesi Çalışmıyor",
            "description": "Cihaz su almıyor ve uyarı ışığı yanıp sönüyor.",
            "serviceCategory": "White Goods",
            "requiredSkill": "ELECTRICAL",
            "priority": "STANDARD",
            "slaDeadline": new Date(Date.now() + 24*3600*1000).toISOString(),
            "branchId": "sube-ist-01"
          }
        ]
      };
      content = JSON.stringify(sampleData[type] || [], null, 2);
    } else {
      fileName += '.csv';
      const sampleCsv: Record<string, string> = {
        BRANCH: `code,name,city,district,contactPerson,latitude,longitude,dailyCapacity,workingHoursStart,workingHoursEnd,isActive\nSUBE-01,Kadıköy Merkez Şube,İstanbul,Kadıköy,Ahmet Yılmaz,40.9901,29.0201,5,09:00,18:00,true`,
        TECHNICIAN: `fullName,phone,email,branchId,region,level,skills,workingHoursStart,workingHoursEnd,workingDays,isActive,performanceScore\nMehmet Demir,05551112233,mehmet@teknik.com,sube-ist-01,Kadıköy,SENIOR,"HVAC,PLUMBING",08:30,17:30,"1,2,3,4,5",true,90`,
        SPARE_PART: `code,name,category,compatibleDevices,stockQuantity,minStockThreshold,unitPrice,unit,branchId\nCOMP-001,Kompresör Motoru 1.5HP,COMPRESSOR,Bulaşık ve Çamaşır Makineleri,20,5,1200.50,PCS,sube-ist-01`,
        VEHICLE: `plateNumber,brand,model,vehicleType,fuelLevel,payloadCapacityKg,status,branchId\n34ABC123,Renault,Kangoo,Van,100,800,AVAILABLE,sube-ist-01`,
        SERVICE_REQUEST: `code,customerId,customerName,customerPhone,title,description,serviceCategory,requiredSkill,priority,slaDeadline,branchId\nREQ-001,cust-1,Ahmet Kaya,05550009988,Bulaşık Makinesi Çalışmıyor,Cihaz su almıyor ve uyarı ışığı yanıp sönüyor.,White Goods,ELECTRICAL,STANDARD,${new Date(Date.now() + 24*3600*1000).toISOString()},sube-ist-01`
      };
      content = sampleCsv[type] || '';
    }

    const blob = new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}
