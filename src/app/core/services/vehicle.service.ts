import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Vehicle } from '../models/vehicle.model';
import { PermissionService } from './permission.service';
import { AuditLogService } from './audit-log.service';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private storage = inject(StorageService);
  private permissionService = inject(PermissionService);
  private auditLog = inject(AuditLogService);
  private authState = inject(AuthStateService);

  getVehicles(): Vehicle[] {
    this.permissionService.assertPermission('VEHICLE_VIEW');
    return this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
  }

  getVehicleById(id: string): Vehicle | null {
    this.permissionService.assertPermission('VEHICLE_VIEW');
    return this.storage.getById<Vehicle>(STORAGE_KEYS.VEHICLES, id);
  }

  private validateVehicle(vehicle: Partial<Vehicle>): void {
    if (vehicle.plateNumber !== undefined) {
      if (!vehicle.plateNumber || vehicle.plateNumber.trim().length === 0) throw new Error('Plaka numarası sadece boşluklardan oluşamaz.');
      if (vehicle.plateNumber.length > 10) throw new Error('Plaka numarası en fazla 10 karakter olabilir.');
      const cleanVal = vehicle.plateNumber.replace(/\s+/g, '').toUpperCase();
      const plateRegex = /^(0[1-9]|[1-7][0-9]|8[0-1])[A-Z]{1,3}[0-9]{2,4}$/;
      if (!plateRegex.test(cleanVal)) throw new Error('Geçersiz plaka formatı (Örn: 34ABC123).');
    }
    if (vehicle.vehicleType !== undefined) {
      if (!vehicle.vehicleType || vehicle.vehicleType.trim().length === 0) throw new Error('Araç tipi sadece boşluklardan oluşamaz.');
      if (vehicle.vehicleType.length > 40) throw new Error('Araç tipi en fazla 40 karakter olabilir.');
    }
    if (vehicle.brand !== undefined) {
      if (!vehicle.brand || vehicle.brand.trim().length === 0) throw new Error('Marka sadece boşluklardan oluşamaz.');
      if (vehicle.brand.length > 40) throw new Error('Marka en fazla 40 karakter olabilir.');
    }
    if (vehicle.model !== undefined) {
      if (!vehicle.model || vehicle.model.trim().length === 0) throw new Error('Model sadece boşluklardan oluşamaz.');
      if (vehicle.model.length > 40) throw new Error('Model en fazla 40 karakter olabilir.');
    }
    if (vehicle.fuelLevel !== undefined && vehicle.fuelLevel !== null) {
      const fl = Number(vehicle.fuelLevel);
      if (isNaN(fl) || fl < 0 || fl > 100) throw new Error('Yakıt seviyesi 0 ile 100 arasında olmalıdır.');
    }
    if (vehicle.payloadCapacityKg !== undefined && vehicle.payloadCapacityKg !== null) {
      const pc = Number(vehicle.payloadCapacityKg);
      if (isNaN(pc) || pc < 1 || pc > 10000) throw new Error('Kapasite 1 ile 10000 arasında olmalıdır.');
    }
    if (vehicle.equipments !== undefined && vehicle.equipments !== null) {
      for (const eq of vehicle.equipments) {
        if (eq.length > 50) throw new Error('Her bir ekipman adı en fazla 50 karakter olabilir.');
      }
    }
  }

  createVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt'>): Vehicle {
    this.permissionService.assertPermission('VEHICLE_CREATE');
    this.validateVehicle(vehicle);

    const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
    if (vehicles.some(v => v.plateNumber.toLowerCase() === vehicle.plateNumber.toLowerCase())) {
      throw new Error(`Bu plaka zaten kayıtlı.`);
    }

    const newVehicle: Vehicle = {
      ...vehicle,
      id: `vehicle-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const created = this.storage.create<Vehicle>(STORAGE_KEYS.VEHICLES, newVehicle);

    this.auditLog.logAction({
      actionType: 'CREATE',
      entityType: 'VEHICLE',
      entityId: created.id,
      oldValue: null,
      newValue: JSON.stringify(created),
      description: `Yeni Arac oluşturuldu: ${created.plateNumber}`
    });

    return created;
  }

  updateVehicle(id: string, vehicle: Partial<Vehicle>): Vehicle {
    this.permissionService.assertPermission('VEHICLE_UPDATE');
    this.validateVehicle(vehicle);
    const oldVehicle = this.storage.getById<Vehicle>(STORAGE_KEYS.VEHICLES, id);
    if (!oldVehicle) throw new Error('Güncellenecek araç bulunamadı.');

    if (vehicle.plateNumber) {
      const vehicles = this.storage.getCollection<Vehicle>(STORAGE_KEYS.VEHICLES);
      if (vehicles.some(v => v.plateNumber.toLowerCase() === vehicle.plateNumber!.toLowerCase() && v.id !== id)) {
        throw new Error(`Bu plaka zaten kayıtlı.`);
      }
    }

    const updated = this.storage.update<Vehicle>(STORAGE_KEYS.VEHICLES, id, vehicle);

    this.auditLog.logAction({
      actionType: 'UPDATE',
      entityType: 'VEHICLE',
      entityId: id,
      oldValue: JSON.stringify(oldVehicle),
      newValue: JSON.stringify(updated),
      description: `Arac güncellendi: ${updated.plateNumber}`
    });

    return updated;
  }

  deleteVehicle(id: string, forceDelete = false): boolean {
    this.permissionService.assertPermission('VEHICLE_DELETE');
    const oldVehicle = this.storage.getById<Vehicle>(STORAGE_KEYS.VEHICLES, id);
    if (!oldVehicle) throw new Error('Silinecek araç bulunamadı.');

    const isAdmin = this.authState.currentRole() === 'SYSTEM_ADMIN';

    if (forceDelete && isAdmin) {
      const success = this.storage.delete(STORAGE_KEYS.VEHICLES, id);
      if (success) {
        this.auditLog.logAction({
          actionType: 'DELETE',
          entityType: 'VEHICLE',
          entityId: id,
          oldValue: JSON.stringify(oldVehicle),
          newValue: null,
          description: `Arac silindi: ${oldVehicle.plateNumber}`
        });
      }
      return success;
    } else {
      // Soft delete -> deactivation
      const updated = { ...oldVehicle, isActive: false };
      this.storage.update<Vehicle>(STORAGE_KEYS.VEHICLES, id, updated);
      this.auditLog.logAction({
        actionType: 'UPDATE',
        entityType: 'VEHICLE',
        entityId: id,
        oldValue: JSON.stringify(oldVehicle),
        newValue: JSON.stringify(updated),
        description: 'Record deactivated'
      });
      return true;
    }
  }
}
