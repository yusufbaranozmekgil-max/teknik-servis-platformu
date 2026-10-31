import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { StatusLabelPipe } from '../../../../shared/pipes/status-label.pipe';

@Component({
    selector: 'app-vehicle-maintenance',
    imports: [CommonModule, RouterModule, StatusLabelPipe],
    template: `
    <div class="page-container">
      <div class="header-section">
        <div class="title-area">
          <a routerLink="/araclar" class="back-link">← Araçlara Dön</a>
          <h2>Araç Bakım ve Durum Yönetimi</h2>
        </div>
      </div>
    
      @if (vehicle) {
        <div class="card-content">
          <div class="vehicle-header">
            <span class="plate-badge">{{ vehicle.plateNumber }}</span>
            <h3>{{ vehicle.brand }} {{ vehicle.model }}</h3>
            <span class="status-pill" [class.maintenance]="vehicle.status === 'MAINTENANCE'" [class.available]="vehicle.status === 'AVAILABLE'">
              {{ vehicle.status | statusLabel:'vehicle' }}
            </span>
          </div>
          <div class="info-details">
            <div class="info-row">
              <strong>Son Bakım Tarihi:</strong>
              <span>{{ vehicle.lastMaintenanceDate | date:'dd.MM.yyyy HH:mm' }}</span>
            </div>
            <div class="info-row">
              <strong>Kalan Bakım Süresi:</strong>
              <span [class.text-danger]="isMaintenanceOverdue()">
                {{ getMaintenanceDeadlineText() }}
              </span>
            </div>
            <div class="info-row">
              <strong>Mevcut Yakıt Seviyesi:</strong>
              <span [class.text-danger]="vehicle.fuelLevel < 30">%{{ vehicle.fuelLevel }}</span>
            </div>
            <div class="info-row">
              <strong>Ekipman Seti:</strong>
              <span>{{ vehicle.equipments.join(', ') || 'Ekipman bulunmuyor' }}</span>
            </div>
          </div>
          @if (vehicle.isActive) {
            <div class="maintenance-actions">
              <h4>Bakım İşlemleri</h4>
              <div class="buttons-grid">
                @if (vehicle.status !== 'MAINTENANCE') {
                  <button
                    (click)="putInMaintenance()"
                    class="maintenance-btn"
                    >
                    Aracı Bakıma Al (Bloke Et)
                  </button>
                }
                <button
                  (click)="completeMaintenance()"
                  class="complete-btn"
                  >
                  Bakımı Tamamlandı Olarak İşle (Tarihi Güncelle)
                </button>
              </div>
            </div>
          }
          @if (errorMessage) {
            <div class="error-alert" style="margin-top: 1rem;">
              {{ errorMessage }}
            </div>
          }
        </div>
      }
    
      @if (!vehicle && !errorMessage) {
        <div class="error-alert">
          Araç yükleniyor veya bulunamadı...
        </div>
      }
    </div>
    `,
    styleUrls: ['./vehicle-maintenance.component.scss']
})
export class VehicleMaintenancePage implements OnInit {
  private vehicleService = inject(VehicleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  vehicle: Vehicle | null = null;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadVehicle();
  }

  loadVehicle(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      try {
        const found = this.vehicleService.getVehicleById(id);
        if (found) {
          this.vehicle = found;
        } else {
          this.errorMessage = 'Araç bulunamadı.';
        }
      } catch (err: any) {
        this.errorMessage = err.message || 'Bir hata oluştu.';
      }
    }
  }

  isMaintenanceOverdue(): boolean {
    if (!this.vehicle) return false;
    const maintenanceDate = new Date(this.vehicle.lastMaintenanceDate).getTime();
    const diffDays = (Date.now() - maintenanceDate) / (1000 * 60 * 60 * 24);
    return diffDays > 180;
  }

  getMaintenanceDeadlineText(): string {
    if (!this.vehicle) return '';
    const maintenanceDate = new Date(this.vehicle.lastMaintenanceDate).getTime();
    const diffDays = (Date.now() - maintenanceDate) / (1000 * 60 * 60 * 24);
    const remaining = Math.round(180 - diffDays);
    if (remaining < 0) {
      return `Bakım süresi ${Math.abs(remaining)} gün geçmiş!`;
    }
    return `Sonraki bakıma ${remaining} gün kaldı.`;
  }

  putInMaintenance(): void {
    if (this.vehicle) {
      try {
        this.vehicleService.updateVehicle(this.vehicle.id, {
          status: 'MAINTENANCE'
        });
        this.loadVehicle();
      } catch (err: any) {
        this.errorMessage = err.message || 'Hata oluştu.';
      }
    }
  }

  completeMaintenance(): void {
    if (this.vehicle) {
      try {
        this.vehicleService.updateVehicle(this.vehicle.id, {
          status: 'AVAILABLE',
          lastMaintenanceDate: new Date().toISOString()
        });
        this.loadVehicle();
      } catch (err: any) {
        this.errorMessage = err.message || 'Hata oluştu.';
      }
    }
  }
}
