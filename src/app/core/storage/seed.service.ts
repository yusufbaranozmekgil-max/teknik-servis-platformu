import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { STORAGE_KEYS } from './storage-keys';
import { User } from '../models/user.model';
import { Branch } from '../models/branch.model';
import { Technician } from '../models/technician.model';
import { SparePart } from '../models/spare-part.model';
import { PartCategory } from '../models/part-category.model';
import { ServiceRequest, ServicePriority, ServiceRequestStatus } from '../models/service-request.model';
import { WorkOrder, WorkOrderStatus, RequiredPart, UsedPart } from '../models/work-order.model';
import { Vehicle, VehicleStatus } from '../models/vehicle.model';
import { Rule } from '../models/rule.model';
import { Notification } from '../models/notification.model';
import { AuditLog } from '../models/audit-log.model';
import { PartReservation } from '../models/part-reservation.model';
import { ShiftAssignment } from '../models/shift-assignment.model';
import { StockMovement } from '../models/stock-movement.model';
import { SkillType } from '../models/skill-type.model';

@Injectable({
  providedIn: 'root'
})
export class SeedService {
  private storage = inject(StorageService);

  /** Demo veri sürümü — seed içeriği değiştiğinde artırılır; eski localStorage otomatik tazelenir. */
  private static readonly SEED_VERSION = '4';
  private static readonly SEED_VERSION_KEY = 'ts_seed_version';

  seedAll(): void {
    const storedVersion = this.storage.getRaw(SeedService.SEED_VERSION_KEY);
    const hasData = this.storage.getCollection(STORAGE_KEYS.USERS).length > 0;

    // Sürüm uyuşmazlığı: eski demo verisi yeni kurallara uymuyor olabilir — komple tazele.
    if (hasData && storedVersion !== SeedService.SEED_VERSION) {
      console.log(`Demo veri sürümü değişti (${storedVersion || 'yok'} → ${SeedService.SEED_VERSION}); veriler tazeleniyor...`);
      this.resetAll();
      this.storage.setRaw(SeedService.SEED_VERSION_KEY, SeedService.SEED_VERSION);
      return;
    }

    // Veri güncel — dokunma.
    if (hasData) {
      return;
    }

    console.log('Seed islemi baslatiliyor...');

    // 1. Şubeleri Seed Et
    const branches = this.seedBranches();
    
    // 2. Kullanıcıları Seed Et
    this.seedUsers(branches);

    // 3. Teknisyenleri Seed Et
    const technicians = this.seedTechnicians(branches);

    // 4. Yedek Parçaları Seed Et
    const spareParts = this.seedSpareParts(branches);

    // 5. Araçları Seed Et
    const vehicles = this.seedVehicles(branches);

    // 6. Kuralları Seed Et
    this.seedRules();

    // 7. Servis Taleplerini & İş Emirlerini Seed Et
    this.seedRequestsAndOrders(branches, technicians, vehicles, spareParts);

    // 8. Bildirimleri Seed Et
    this.seedNotifications();

    // 9. Örnek Vardiyaları Seed Et (Şartname Bölüm 11 için demo)
    this.seedShifts(branches, technicians);

    // 10. Stok hareketleri (5 tip) ve örnek denetim kayıtları
    this.seedStockMovements(spareParts);
    this.seedAuditLogs(branches, technicians);

    this.storage.setRaw(SeedService.SEED_VERSION_KEY, SeedService.SEED_VERSION);
    console.log('Seed islemi tamamlandi.');
  }

  resetAll(): void {
    console.log('Reset islemi baslatiliyor...');
    const keys = Object.values(STORAGE_KEYS);
    keys.forEach(key => {
      // Clear localStorage key
      this.storage.setCollection(key, []);
    });

    const branches = this.seedBranches();
    this.seedUsers(branches);
    const technicians = this.seedTechnicians(branches);
    const spareParts = this.seedSpareParts(branches);
    const vehicles = this.seedVehicles(branches);
    this.seedRules();
    this.seedRequestsAndOrders(branches, technicians, vehicles, spareParts);
    this.seedNotifications();
    this.seedShifts(branches, technicians);
    this.seedStockMovements(spareParts);
    this.seedAuditLogs(branches, technicians);
    this.storage.setRaw(SeedService.SEED_VERSION_KEY, SeedService.SEED_VERSION);
    console.log('Reset islemi tamamlandi.');
  }

  private seedBranches(): Branch[] {
    const branches: Branch[] = [
      {
        id: 'branch-1',
        code: 'SUBE-ANK-01',
        name: 'Ankara Cankaya Subesi',
        city: 'Ankara',
        district: 'Cankaya',
        serviceAreas: ['Cankaya', 'Kizilay', 'Balgat', 'Umitkoy'],
        contactPerson: 'Can Sorumlu',
        latitude: 39.9208,
        longitude: 32.8541,
        dailyCapacity: 8,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'branch-2',
        code: 'SUBE-ANK-02',
        name: 'Ankara Kecioren Subesi',
        city: 'Ankara',
        district: 'Kecioren',
        serviceAreas: ['Kecioren', 'Etlik', 'Baglum', 'Ovacik'],
        contactPerson: 'Ali Veli',
        latitude: 39.9772,
        longitude: 32.8624,
        dailyCapacity: 6,
        workingHoursStart: '08:30',
        workingHoursEnd: '17:30',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'branch-3',
        code: 'SUBE-IST-01',
        name: 'Istanbul Kadikoy Subesi',
        city: 'Istanbul',
        district: 'Kadikoy',
        serviceAreas: ['Kadikoy', 'Moda', 'Bostanci', 'Goztepe'],
        contactPerson: 'Ayse Sezgin',
        latitude: 40.9910,
        longitude: 29.0270,
        dailyCapacity: 10,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'branch-4',
        code: 'SUBE-IST-02',
        name: 'Istanbul Avrupa Subesi',
        city: 'Istanbul',
        district: 'Sisli',
        serviceAreas: ['Sisli', 'Besiktas', 'Mecidiyekoy', 'Levent'],
        contactPerson: 'Mehmet Kaya',
        latitude: 41.0602,
        longitude: 28.9877,
        dailyCapacity: 7,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
        isActive: false, // Pasif şube atama engeli testi için
        createdAt: new Date().toISOString()
      },
      {
        id: 'branch-5',
        code: 'SUBE-IZM-01',
        name: 'Izmir Konak Subesi',
        city: 'Izmir',
        district: 'Konak',
        serviceAreas: ['Konak', 'Alsancak', 'Karsiyaka', 'Bornova'],
        contactPerson: 'Zeynep Yurt',
        latitude: 38.4189,
        longitude: 27.1287,
        dailyCapacity: 5,
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.BRANCHES, branches);
    return branches;
  }

  private seedUsers(branches: Branch[]): void {
    const users: User[] = [
      {
        id: 'user-admin',
        username: 'admin@demo.com',
        fullName: 'Ahmet Yilmaz (Sistem Yöneticisi)',
        email: 'admin@demo.com',
        role: 'SYSTEM_ADMIN',
        branchId: null,
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-operation',
        username: 'operation@demo.com',
        fullName: 'Buse Tan (Operasyon Müdürü)',
        email: 'operation@demo.com',
        role: 'OPERATION_MANAGER',
        branchId: null,
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-branch',
        username: 'branch@demo.com',
        fullName: 'Can Kozan (Şube Sorumlusu)',
        email: 'branch@demo.com',
        role: 'BRANCH_MANAGER',
        branchId: 'branch-1',
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-dispatcher',
        username: 'dispatcher@demo.com',
        fullName: 'Deniz Simsek (Planlamaci)',
        email: 'dispatcher@demo.com',
        role: 'DISPATCHER',
        branchId: 'branch-1',
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-warehouse',
        username: 'warehouse@demo.com',
        fullName: 'Emre Aslan (Depo Sorumlusu)',
        email: 'warehouse@demo.com',
        role: 'WAREHOUSE_MANAGER',
        branchId: 'branch-1',
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-technician',
        username: 'technician@demo.com',
        fullName: 'Fatih Mert (Saha Teknisyeni)',
        email: 'technician@demo.com',
        role: 'TECHNICIAN',
        branchId: 'branch-1',
        technicianId: 'tech-1',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-report',
        username: 'report@demo.com',
        fullName: 'Gizem Can (Raporlama Kullanıcısı)',
        email: 'report@demo.com',
        role: 'REPORTING_USER',
        branchId: null,
        technicianId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.USERS, users);
  }

  private seedTechnicians(branches: Branch[]): Technician[] {
    const skills: SkillType[] = [
      'WHITE_GOODS',
      'HVAC',
      'ELECTRIC',
      'ELECTRONICS_MOTHERBOARD',
      'PLUMBING',
      'BOILER_HEATING'
    ];

    const technicians: Technician[] = [];
    const levels = ['JUNIOR', 'MID', 'SENIOR', 'EXPERT'] as const;

    // 15 teknisyen üretimi
    for (let i = 1; i <= 15; i++) {
      const branchIndex = (i - 1) % branches.length;
      const targetBranch = branches[branchIndex];
      const level = levels[(i - 1) % levels.length];
      
      // Her teknisyene 1 ana yetkinlik ve kıdeme göre ek yetkinlikler veriyoruz
      const primarySkill = skills[(i - 1) % skills.length];
      const techSkills = [primarySkill];
      if (level === 'SENIOR' || level === 'EXPERT') {
        const secondarySkill = skills[(i + 1) % skills.length];
        techSkills.push(secondarySkill);
      }

      // Bazı teknisyenleri izinli veya pasif yapalım
      const isOnLeave = i === 5 || i === 12; // 5 ve 12 nolu teknisyenler izinli
      const isActive = i !== 18; // 18 nolu teknisyen pasif
      
      const leaveStart = isOnLeave ? new Date().toISOString() : null;
      const leaveEnd = isOnLeave ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

      // Performans skorlarını çeşitlendiriyoruz
      let performanceScore = 60 + (i * 7) % 40; // 60 - 99
      if (i === 15) performanceScore = 35; // Test için özellikle düşük performanslı teknisyen

      // Skill seviyeleri: teknisyen kıdem'ine paralel + biraz çeşitlilik
      const skillLevels: any = {};
      const levelByRank = { JUNIOR: 'BEGINNER', MID: 'INTERMEDIATE', SENIOR: 'EXPERT', EXPERT: 'EXPERT' } as const;
      techSkills.forEach((sk, idx) => {
        // Ana skill kıdemle paralel, ikincil skill bir kademe altta
        if (idx === 0) {
          skillLevels[sk] = levelByRank[level];
        } else {
          skillLevels[sk] = level === 'JUNIOR' ? 'BEGINNER' : level === 'MID' ? 'BEGINNER' : 'INTERMEDIATE';
        }
      });

      technicians.push({
        id: `tech-${i}`,
        fullName: `Teknisyen Personel ${i}`,
        phone: `055500000${i.toString().padStart(2, '0')}`,
        email: `tech${i}@operasyon.com`,
        branchId: targetBranch.id,
        region: targetBranch.district,
        level: level,
        skills: techSkills,
        skillLevels: skillLevels,
        workingHoursStart: i % 2 === 0 ? '08:30' : '09:00',
        workingHoursEnd: i % 2 === 0 ? '17:30' : '18:00',
        workingDays: [1, 2, 3, 4, 5], // Pzt - Cuma
        isActive: isActive,
        isOnLeave: isOnLeave,
        leaveStart: leaveStart,
        leaveEnd: leaveEnd,
        performanceScore: performanceScore,
        completedJobsCount: i * 3 + 2,
        dailyCapacity: [3, 4, 5, 6][i % 4],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // spec'teki özel test senaryoları için ilk teknisyeni sabitleyelim
    technicians[0] = {
      id: 'tech-1',
      fullName: 'Ahmet Yilmaz',
      phone: '05550000001',
      email: 'ahmet.yilmaz@operasyon.com',
      branchId: 'branch-1',
      region: 'Cankaya',
      level: 'EXPERT',
      skills: ['HVAC', 'ELECTRIC'],
      skillLevels: { HVAC: 'EXPERT', ELECTRIC: 'INTERMEDIATE' },
      workingHoursStart: '08:00',
      workingHoursEnd: '18:00',
      workingDays: [1, 2, 3, 4, 5],
      isActive: true,
      isOnLeave: false,
      leaveStart: null,
      leaveEnd: null,
      performanceScore: 95,
      completedJobsCount: 120,
      dailyCapacity: 6,
      createdAt: new Date().toISOString()
    };

    this.storage.setCollection(STORAGE_KEYS.TECHNICIANS, technicians);
    return technicians;
  }

  private seedSpareParts(branches: Branch[]): SparePart[] {
    const categories: PartCategory[] = [
      'COMPRESSOR',
      'BOARD_ELECTRONIC',
      'MOTOR',
      'SENSOR',
      'SEAL_GASKET',
      'FILTER',
      'CABLE_CONNECTION',
      'CONSUMABLES'
    ];

    const spareParts: SparePart[] = [];

    // 20 yedek parça üretelim
    for (let i = 1; i <= 20; i++) {
      const branchIndex = (i - 1) % branches.length;
      const targetBranch = branches[branchIndex];
      const category = categories[(i - 1) % categories.length];

      // Stok seviyelerini farklılaştırıyoruz (bol, normal, kritik stok)
      let stockQuantity = 20 + (i % 30);
      let minStockThreshold = 10;
      let reservedQuantity = 0;

      if (i % 7 === 0) {
        // Kritik stokta parça
        stockQuantity = 5;
        minStockThreshold = 10;
      } else if (i % 11 === 0) {
        // Sıfıra yakın stokta parça
        stockQuantity = 1;
        minStockThreshold = 5;
      }

      spareParts.push({
        id: `part-${i}`,
        code: `PRT-${1000 + i}`,
        name: `${category.replace('_', ' ')} Parçası ${i}`,
        category: category,
        branchId: targetBranch.id,
        compatibleDevices: i % 2 === 0 ? 'Bosch / Siemens' : 'Arcelik / Beko',
        unit: i % 15 === 0 ? 'METERS' : 'PCS',
        stockQuantity: stockQuantity,
        reservedQuantity: reservedQuantity,
        minStockThreshold: minStockThreshold,
        unitPrice: 100 + (i * 25) % 1500,
        isActive: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Şartnamede yer alan 5 Özel Stok Test Senaryosu Parçalarını ekleyelim (branch-1 yani Çankaya için)
    const testParts: SparePart[] = [
      {
        id: 'test-part-1',
        code: 'TEST-PRT-01',
        name: 'Test Kablosu (Stok 10 / Rez 0)',
        category: 'CABLE_CONNECTION',
        branchId: 'branch-1',
        compatibleDevices: 'Genel Beyaz Esya',
        unit: 'PCS',
        stockQuantity: 10,
        reservedQuantity: 0,
        minStockThreshold: 5,
        unitPrice: 200,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'test-part-2',
        code: 'TEST-PRT-02',
        name: 'Test Sensörü (Stok 10 / Rez 3)',
        category: 'SENSOR',
        branchId: 'branch-1',
        compatibleDevices: 'Klima / HVAC',
        unit: 'PCS',
        stockQuantity: 10,
        reservedQuantity: 3,
        minStockThreshold: 5,
        unitPrice: 350,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'test-part-3',
        code: 'TEST-PRT-03',
        name: 'Test Kompresörü (Stok 5 / Rez 5)',
        category: 'COMPRESSOR',
        branchId: 'branch-1',
        compatibleDevices: 'Buzdolabi / Sogutucu',
        unit: 'PCS',
        stockQuantity: 5,
        reservedQuantity: 5,
        minStockThreshold: 2,
        unitPrice: 1500,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'test-part-4',
        code: 'TEST-PRT-04',
        name: 'Test Contası (Stok 2 / Rez 1)',
        category: 'SEAL_GASKET',
        branchId: 'branch-1',
        compatibleDevices: 'Camasir Makineleri',
        unit: 'PCS',
        stockQuantity: 2,
        reservedQuantity: 1,
        minStockThreshold: 1,
        unitPrice: 50,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'test-part-5',
        code: 'TEST-PRT-05',
        name: 'Test Motoru (Stok 0 / Rez 0)',
        category: 'MOTOR',
        branchId: 'branch-1',
        compatibleDevices: 'Kombi / Isitma',
        unit: 'PCS',
        stockQuantity: 0,
        reservedQuantity: 0,
        minStockThreshold: 1,
        unitPrice: 800,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    testParts.forEach(tp => {
      // Çakışma olmaması için varsa değiştiriyoruz, yoksa ekliyoruz
      const idx = spareParts.findIndex(p => p.id === tp.id);
      if (idx !== -1) {
        spareParts[idx] = tp;
      } else {
        spareParts.push(tp);
      }
    });

    this.storage.setCollection(STORAGE_KEYS.SPARE_PARTS, spareParts);
    return spareParts;
  }

  private seedVehicles(branches: Branch[]): Vehicle[] {
    const brands = ['Ford', 'Fiat', 'Renault', 'Volkswagen', 'Mercedes'];
    const models = ['Transit', 'Doblo', 'Kangoo', 'Caddy', 'Sprinter'];
    // VehicleScoringService'in skill bazlı beklediği ekipman tag'leri ile uyumlu:
    // HVAC → VACUUM_PUMP + MANIFOLD_GAUGE
    // ELECTRIC → MULTIMETER + INSULATED_TOOLS
    // PLUMBING → PIPE_WRENCH + DRAIN_SNAKE
    // BOILER_HEATING → GAS_LEAK_DETECTOR + PRESSURE_GAUGE
    // ELECTRONICS_MOTHERBOARD → SOLDERING_STATION + OSCILLOSCOPE
    // WHITE_GOODS → HEAVY_LIFT_STRAPS + TOOLKIT_BASIC
    const equipmentsList = [
      // 0: Tam donanımlı çok amaçlı (her skill için uygun)
      ['VACUUM_PUMP', 'MANIFOLD_GAUGE', 'MULTIMETER', 'INSULATED_TOOLS', 'PIPE_WRENCH', 'DRAIN_SNAKE',
       'GAS_LEAK_DETECTOR', 'PRESSURE_GAUGE', 'SOLDERING_STATION', 'OSCILLOSCOPE',
       'HEAVY_LIFT_STRAPS', 'TOOLKIT_BASIC', 'LADDER', 'GENERATOR'],
      // 1: HVAC + Elektrik
      ['VACUUM_PUMP', 'MANIFOLD_GAUGE', 'MULTIMETER', 'INSULATED_TOOLS', 'TOOLKIT_BASIC', 'LADDER'],
      // 2: Sıhhi Tesisat + Kombi
      ['PIPE_WRENCH', 'DRAIN_SNAKE', 'GAS_LEAK_DETECTOR', 'PRESSURE_GAUGE', 'TOOLKIT_BASIC'],
      // 3: Beyaz Eşya + Elektronik
      ['HEAVY_LIFT_STRAPS', 'TOOLKIT_BASIC', 'SOLDERING_STATION', 'OSCILLOSCOPE', 'MULTIMETER'],
      // 4: Ekipman seti eksik araç (uygunsuzluk testi için)
      ['TOOLKIT_BASIC']
    ];

    const vehicles: Vehicle[] = [];

    // 15 araç üretimi
    for (let i = 1; i <= 15; i++) {
      const branchIndex = (i - 1) % branches.length;
      const targetBranch = branches[branchIndex];
      const brandIndex = i % brands.length;

      let status: VehicleStatus = 'AVAILABLE';
      let fuelLevel = 40 + (i * 13) % 60; // %40 - %100
      let lastMaintenanceDaysAgo = (i * 9) % 200; // 0 - 200 gün
      
      // Farklı araç durumlarını simüle ediyoruz
      if (i === 4) status = 'MAINTENANCE';
      if (i === 9) status = 'OUT_OF_SERVICE';
      if (i === 14) fuelLevel = 25; // Yakıt seviyesi %30'un altında
      if (i === 22) lastMaintenanceDaysAgo = 195; // Bakım süresi 180 günü geçmiş

      const maintenanceDate = new Date(Date.now() - lastMaintenanceDaysAgo * 24 * 60 * 60 * 1000).toISOString();

      vehicles.push({
        id: `vehicle-${i}`,
        plateNumber: `06TS${i.toString().padStart(3, '0')}`,
        brand: brands[brandIndex] || 'Ford',
        model: models[brandIndex] || 'Transit',
        vehicleType: i % 2 === 0 ? 'Minivan' : 'Panelvan',
        branchId: targetBranch.id,
        status: status,
        fuelLevel: fuelLevel,
        lastMaintenanceDate: maintenanceDate,
        equipments: equipmentsList[i % equipmentsList.length] || [],
        payloadCapacityKg: 500 + (i * 50) % 1500, // 500 - 2000kg
        assignedTechnicianId: i <= 30 ? `tech-${i}` : null,
        isActive: i !== 35, // 35 nolu araç pasif
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    this.storage.setCollection(STORAGE_KEYS.VEHICLES, vehicles);
    return vehicles;
  }

  private seedRules(): void {
    const rules: Rule[] = [
      {
        id: 'rule-1',
        name: 'Garanti Disi Islerde Parca Kisiti',
        description: 'Garanti kapsamı dışındaki işlerde müşteri onayı alınmamışsa, iş emri tamamlanmadan önce parça tüketimi bloke edilir.',
        evaluatorFnName: 'evaluateWarrantyApproval',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 1,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-2',
        name: 'Mudur Onayi',
        description: 'Tahmini maliyeti 50.000 TL\'yi geçen işler Şube Sorumlusu onayı olmadan planlanamaz.',
        evaluatorFnName: 'evaluateHighCostApproval',
        actionType: 'REQUIRE_APPROVAL',
        priority: 2,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-3',
        name: 'Kritik Stok Uyari Motoru',
        description: 'Bir parçanın stoku kritik eşiğin altına inerse sistem otomatik olarak LOW_STOCK bildirimi üretir.',
        evaluatorFnName: 'evaluateCriticalStock',
        actionType: 'TRIGGER_ALERT',
        priority: 3,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-4',
        name: 'Arac Yakit Siniri',
        description: 'Yakıt seviyesi %30\'un altında olan araçlar işe atanamaz.',
        evaluatorFnName: 'evaluateVehicleFuel',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 4,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-5',
        name: 'Arac Bakim Zaman Asimi',
        description: 'Son bakım tarihi üzerinden 180 gün geçmiş saha araçları planlamada atanamaz.',
        evaluatorFnName: 'evaluateVehicleMaintenance',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 5,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-6',
        name: 'Izinli Personel Kisiti',
        description: 'Yıllık izin döneminde olan veya o gün pasif işaretlenen teknisyenler işe atanamaz.',
        evaluatorFnName: 'evaluateTechnicianLeave',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 6,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-7',
        name: 'SLA Acil Yukseltme',
        description: 'Çözümüne 2 saatten az süre kalan işlerin öncelik durumu otomatik olarak CRITICAL yapılır.',
        evaluatorFnName: 'evaluateSlaUrgency',
        actionType: 'AUTO_PRIORITIZE',
        priority: 7,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-8',
        name: 'Sube Kapasite Asimi',
        description: 'Şube günlük iş kapasitesi dolduğunda şubeye yeni iş ataması engellenir.',
        evaluatorFnName: 'evaluateBranchCapacity',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 8,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-9',
        name: 'Vardiya Disi Planlama Kisiti',
        description: 'Teknisyenlerin tanımlı mesai günleri ve saatleri dışında iş planlaması yapılamaz.',
        evaluatorFnName: 'evaluateShiftHours',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 9,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'rule-10',
        name: 'Kidem Eslesmesi',
        description: 'CRITICAL öncelikli işlere JUNIOR seviyesindeki teknisyenler atanamaz.',
        evaluatorFnName: 'evaluateJuniorAssignment',
        actionType: 'BLOCK_ASSIGNMENT',
        priority: 10,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.RULES, rules);
  }

  private seedRequestsAndOrders(
    branches: Branch[],
    technicians: Technician[],
    vehicles: Vehicle[],
    spareParts: SparePart[]
  ): void {
    // ================================================================
    // GERÇEKÇİ + KURAL UYUMLU SEED
    // Kural uyumlulukları:
    //  - Teknisyen yetkinliği talebin requiredSkill'i ile eşleşir
    //  - Teknisyenin şubesi talebin şubesiyle aynı olur
    //  - İzinli/pasif teknisyen ATANMAZ
    //  - Pasif/bakımdaki/yakıtı %30 altı araç ATANMAZ
    //  - Aynı teknisyen aynı zaman diliminde iki işe ATANMAZ (interval overlap)
    //  - Aynı araç aynı zaman diliminde iki işe ATANMAZ
    //  - Garanti dışı işlerde hasCustomerApproval = true (Kural 10)
    //  - CRITICAL öncelikli işlere JUNIOR teknisyen atanmaz (Kural 10 iç mantık)
    //  - Reservasyonlar SparePart.reservedQuantity'ı gerçekten günceller
    //  - Kullanılan parçalar SparePart.stockQuantity'dan gerçekten düşer
    // ================================================================

    const requests: ServiceRequest[] = [];
    const workOrders: WorkOrder[] = [];
    const reservations: PartReservation[] = [];
    // Referans map'i: parça id → SparePart (rezerve/tüketim güncellemeleri için)
    const partById = new Map<string, SparePart>();
    spareParts.forEach(p => partById.set(p.id, p));
    // Zaman çakışma önleme: teknisyen ve araç için işgal ettikleri slotlar
    const techSlots = new Map<string, { start: number; end: number }[]>();
    const vehicleSlots = new Map<string, { start: number; end: number }[]>();

    const activeBranches = branches.filter(b => b.isActive);
    const activeTechs = technicians.filter(t => t.isActive && !t.isOnLeave);
    const usableVehicles = vehicles.filter(v => v.isActive && v.status === 'AVAILABLE' && v.fuelLevel >= 30);

    // Talep şablonları: (yetkinlik, kategori, cihaz, açıklama, öncelik)
    const templates: Array<{
      skill: SkillType;
      category: string;
      device: string;
      title: string;
      description: string;
    }> = [
      { skill: 'HVAC', category: 'Klima / Soğutma', device: 'Beko ProCool Split Klima',
        title: 'Klima soğutmuyor', description: 'Cihaz açık olmasına rağmen soğutma yapmıyor, iç ünitede su damlıyor.' },
      { skill: 'WHITE_GOODS', category: 'Beyaz Eşya', device: 'Arçelik No-Frost Buzdolabı',
        title: 'Buzdolabı çalışmıyor', description: 'Dondurucu bölümü çalışmıyor, gıdalar erimiş halde.' },
      { skill: 'BOILER_HEATING', category: 'Kombi / Isıtma', device: 'Baymak Duotec Kombi',
        title: 'Kombi arıza kodu', description: 'Ekranda E-04 arıza kodu görünüyor, sıcak su gelmiyor.' },
      { skill: 'ELECTRIC', category: 'Elektrik Tesisatı', device: 'Elektrik panosu',
        title: 'Sigorta sürekli atıyor', description: 'Mutfakta priz kullanıldığında sigorta atıyor.' },
      { skill: 'PLUMBING', category: 'Sıhhi Tesisat', device: 'Musluk / Vana',
        title: 'Su sızıntısı', description: 'Banyoda musluk altından sürekli damlama var.' },
      { skill: 'ELECTRONICS_MOTHERBOARD', category: 'Elektronik', device: 'Bosch Çamaşır Makinesi',
        title: 'Ana kart arızası', description: 'Cihaz açılmıyor, gösterge ışıkları yanıp sönüyor.' }
    ];

    // Öncelik dağılımı (30 talep için) — 12 STANDARD, 12 URGENT, 6 CRITICAL
    const priorityDistribution: ServicePriority[] = [
      ...Array(12).fill('STANDARD'),
      ...Array(12).fill('URGENT'),
      ...Array(6).fill('CRITICAL')
    ];

    // Durum dağılımı — pipeline'ın her aşamasında iş olsun
    // 5 NEW, 5 OPENED, 6 PLANNED, 3 ON_THE_WAY, 3 ON_SITE, 5 COMPLETED, 1 PARTIALLY_COMPLETED, 1 FAILED, 1 CANCELLED
    const woStatusDistribution: WorkOrderStatus[] = [
      ...Array(5).fill('OPENED'),
      ...Array(6).fill('PLANNED'),
      ...Array(3).fill('ON_THE_WAY'),
      ...Array(3).fill('ON_SITE'),
      ...Array(5).fill('COMPLETED'),
      ...Array(1).fill('PARTIALLY_COMPLETED'),
      ...Array(1).fill('FAILED'),
      ...Array(1).fill('CANCELLED')
    ]; // toplam 25 — geri kalan 5 NEW için WO oluşturulmaz

    // Yardımcı: interval overlap testi
    const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
      a.start < b.end && b.start < a.end;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;

    let requestCounter = 0;
    let planIndex = 0; // sayaç: assign edilebilir iş sırası

    // 30 servis talebi üret
    for (let i = 0; i < 30; i++) {
      const templ = templates[i % templates.length];
      const branch = activeBranches[i % activeBranches.length];
      const priority = priorityDistribution[i];
      requestCounter++;

      // İş emri durumu — ilk 5 talep NEW, geri kalan 25 talep atanır
      const hasWorkOrder = i >= 5;
      const woStatus: WorkOrderStatus | null = hasWorkOrder ? woStatusDistribution[planIndex++] : null;

      // Reguest status — WO'ya göre türetilir
      let reqStatus: ServiceRequestStatus = 'NEW';
      if (woStatus === 'COMPLETED' || woStatus === 'PARTIALLY_COMPLETED') reqStatus = 'CLOSED';
      else if (woStatus === 'CANCELLED' || woStatus === 'FAILED') reqStatus = 'CANCELLED';
      else if (woStatus === 'OPENED') reqStatus = 'NEW';
      else if (woStatus) reqStatus = 'IN_PROGRESS';

      // SLA süresi — önceliğe göre
      const slaHoursMap: Record<ServicePriority, number> = { CRITICAL: 4, URGENT: 12, STANDARD: 48 };
      let slaOffset = slaHoursMap[priority] * hourMs;
      // 3 talep SLA gecikmiş, 2 talep SLA yaklaşan olsun (demo için)
      if (i === 8 || i === 15 || i === 22) slaOffset = -3 * hourMs; // aşımlı
      if (i === 11 || i === 18) slaOffset = 1.2 * hourMs;             // yaklaşıyor

      const createdOffset = (5 + (i % 5)) * dayMs;
      const createdAt = new Date(now - createdOffset).toISOString();
      const slaDeadline = new Date(now + slaOffset).toISOString();

      // Kural 10: Garanti dışı iş → müşteri onayı ZORUNLU (uyum)
      const hasWarranty = i % 3 !== 0; // 20 talep garanti, 10 talep ücretli
      const hasCustomerApproval = hasWarranty ? (i % 2 === 0) : true;

      const reqId = `req-${requestCounter}`;
      requests.push({
        id: reqId,
        code: `TALEP-2026-${requestCounter.toString().padStart(4, '0')}`,
        customerId: `cust-${requestCounter}`,
        customerName: this.pickCustomerName(i),
        customerPhone: `0553${(2000000 + i * 137).toString().slice(0, 7)}`,
        customerAddress: `${branch.city} / ${branch.district || ''} - ${this.pickStreet(i)} No: ${(i % 90) + 10}, Daire ${(i % 12) + 1}`,
        customerRegion: branch.serviceAreas[i % branch.serviceAreas.length] || branch.district || branch.city,
        branchId: branch.id,
        title: templ.title,
        description: templ.description,
        deviceBrandModel: templ.device,
        serviceCategory: templ.category,
        requiredSkill: templ.skill,
        priority: priority,
        status: reqStatus,
        slaDeadline: slaDeadline,
        hasWarranty: hasWarranty,
        hasCustomerApproval: hasCustomerApproval,
        createdAt: createdAt
      });

      // NEW ise iş emri oluşturma
      if (!hasWorkOrder || !woStatus) continue;

      // ============ Uygun teknisyen bul ============
      // 1. Aynı şube  2. requiredSkill'e sahip  3. Aktif + izinsiz  4. Kural 10: CRITICAL → SENIOR/EXPERT
      const candidateTechs = activeTechs.filter(t =>
        t.branchId === branch.id &&
        t.skills.includes(templ.skill) &&
        (priority !== 'CRITICAL' || t.level === 'SENIOR' || t.level === 'EXPERT')
      );

      // Uygun teknisyen yoksa iş emri OPENED durumunda kalsın (atanmadan)
      if (candidateTechs.length === 0) {
        workOrders.push({
          id: `wo-${requestCounter}`,
          code: `WO-2026-${requestCounter.toString().padStart(4, '0')}`,
          serviceRequestId: reqId,
          branchId: branch.id,
          technicianId: null,
          vehicleId: null,
          status: 'OPENED',
          plannedStart: null,
          plannedEnd: null,
          actualStart: null,
          actualEnd: null,
          requiredParts: [],
          usedParts: [],
          estimatedCost: 200 + (i * 55) % 3000,
          actualCost: 0,
          failureReason: null,
          notes: 'Uygun yetkinlikte teknisyen ataması bekleniyor.',
          createdAt: createdAt
        });
        continue;
      }

      // ============ Uygun araç bul ============
      const candidateVehicles = usableVehicles.filter(v => v.branchId === branch.id);

      // ============ Zaman slotu ata (çakışmasız) ============
      // Farklı günlere yayarak çakışma azalt, sonra çakışma kontrolü ile doğrula
      const dayOffset = -3 + (i % 10);  // -3 → +6 arası günler
      const startHour = 9 + (i % 6);    // 09:00 - 14:00 arası
      const baseStart = new Date(now + dayOffset * dayMs);
      baseStart.setHours(startHour, 0, 0, 0);
      const baseEnd = new Date(baseStart.getTime() + 2 * hourMs);

      // Teknisyenler arasında çakışmayan birini seç
      const chosenTech = candidateTechs.find(t => {
        const slots = techSlots.get(t.id) || [];
        return !slots.some(s => overlaps(s, { start: baseStart.getTime(), end: baseEnd.getTime() }));
      }) || candidateTechs[0];

      // Aracın çakışması varsa null ata (arçsız iş yasak değil)
      const chosenVehicle = candidateVehicles.find(v => {
        const slots = vehicleSlots.get(v.id) || [];
        return !slots.some(s => overlaps(s, { start: baseStart.getTime(), end: baseEnd.getTime() }));
      });

      // Slotları kaydet
      const techId = chosenTech.id;
      techSlots.set(techId, [...(techSlots.get(techId) || []), { start: baseStart.getTime(), end: baseEnd.getTime() }]);
      if (chosenVehicle) {
        vehicleSlots.set(chosenVehicle.id, [...(vehicleSlots.get(chosenVehicle.id) || []), { start: baseStart.getTime(), end: baseEnd.getTime() }]);
      }

      // ============ Parça rezervasyonu ============
      const reqPartsList: RequiredPart[] = [];
      const usedPartsList: UsedPart[] = [];

      // Sadece garanti veya onaylı işler için parça (Kural 10)
      const canReserveParts = hasWarranty || hasCustomerApproval;
      // Her 3 iş emrinden birine parça ekle
      if (canReserveParts && i % 3 === 0) {
        // Şubede stoğu yeterli aktif bir parça seç
        const partForBranch = spareParts.find(p =>
          p.branchId === branch.id &&
          p.isActive &&
          (p.stockQuantity - p.reservedQuantity) >= 2
        );
        if (partForBranch) {
          const qty = 1;
          reqPartsList.push({ partId: partForBranch.id, quantity: qty });

          if (woStatus === 'PLANNED' || woStatus === 'ON_THE_WAY' || woStatus === 'ON_SITE') {
            // Aktif rezervasyon
            reservations.push({
              id: `res-wo${requestCounter}-${partForBranch.id}`,
              partId: partForBranch.id,
              workOrderId: `wo-${requestCounter}`,
              quantity: qty,
              status: 'ACTIVE',
              reservedAt: createdAt,
              consumedAt: null,
              releasedAt: null
            });
            // Gerçekten reservedQuantity'i artır
            partForBranch.reservedQuantity += qty;
          } else if (woStatus === 'COMPLETED' || woStatus === 'PARTIALLY_COMPLETED') {
            // Tüketilmiş rezervasyon
            usedPartsList.push({ partId: partForBranch.id, quantity: qty });
            reservations.push({
              id: `res-wo${requestCounter}-${partForBranch.id}`,
              partId: partForBranch.id,
              workOrderId: `wo-${requestCounter}`,
              quantity: qty,
              status: 'CONSUMED',
              reservedAt: createdAt,
              consumedAt: new Date(baseEnd.getTime() + 30 * 60 * 1000).toISOString(),
              releasedAt: null
            });
            // Stoktan gerçekten düş
            partForBranch.stockQuantity = Math.max(0, partForBranch.stockQuantity - qty);
          }
        }
      }

      // Zaman alanları
      const isCompleted = woStatus === 'COMPLETED' || woStatus === 'PARTIALLY_COMPLETED';
      const isInProgress = woStatus === 'ON_THE_WAY' || woStatus === 'ON_SITE';
      const actualStart = (isCompleted || isInProgress) ? new Date(baseStart.getTime() + 15 * 60 * 1000).toISOString() : null;
      const actualEnd = isCompleted ? new Date(baseEnd.getTime() - 5 * 60 * 1000).toISOString() : null;

      const estimatedCost = 250 + (i * 73) % 3500;
      workOrders.push({
        id: `wo-${requestCounter}`,
        code: `WO-2026-${requestCounter.toString().padStart(4, '0')}`,
        serviceRequestId: reqId,
        branchId: branch.id,
        technicianId: chosenTech.id,
        vehicleId: chosenVehicle ? chosenVehicle.id : null,
        status: woStatus,
        plannedStart: baseStart.toISOString(),
        plannedEnd: baseEnd.toISOString(),
        actualStart: actualStart,
        actualEnd: actualEnd,
        requiredParts: reqPartsList,
        usedParts: usedPartsList,
        estimatedCost: estimatedCost,
        actualCost: isCompleted ? Math.round(estimatedCost * (0.85 + (i % 3) * 0.1)) : 0,
        failureReason: woStatus === 'FAILED' ? 'Müşteri yok' : (woStatus === 'CANCELLED' ? 'Müşteri talebi geri çekti' : null),
        notes: `${templ.title} — planlı ziyaret. Adres onaylandı.`,
        createdAt: createdAt
      });
    }

    // ============ Kural 2 demo senaryosu: 50.000 TL üzeri onay bekleyen iş ============
    const approvalBranch = activeBranches[0];
    const approvalReqId = 'req-yuksek-maliyet';
    requests.push({
      id: approvalReqId,
      code: 'TALEP-2026-9001',
      customerId: 'cust-9001',
      customerName: 'Kurumsal Müşteri A.Ş.',
      customerPhone: '05559990001',
      customerAddress: `${approvalBranch.city} - Sanayi Bölgesi, Fabrika Caddesi No: 12`,
      customerRegion: approvalBranch.district || approvalBranch.city,
      branchId: approvalBranch.id,
      title: 'Endüstriyel soğutma sistemi komple revizyon',
      description: 'Fabrika soğuk hava deposunun kompresör grubu ve elektronik kontrol ünitesi komple yenilenecek.',
      deviceBrandModel: 'Endüstriyel Soğutma Ünitesi X-9000',
      serviceCategory: 'Klima / Soğutma',
      requiredSkill: 'HVAC',
      priority: 'URGENT',
      status: 'NEW',
      slaDeadline: new Date(now + 12 * hourMs).toISOString(),
      hasWarranty: false,
      hasCustomerApproval: true,
      createdAt: new Date(now - 1 * dayMs).toISOString()
    });
    workOrders.push({
      id: 'wo-yuksek-maliyet',
      code: 'WO-2026-9001',
      serviceRequestId: approvalReqId,
      branchId: approvalBranch.id,
      technicianId: null,
      vehicleId: null,
      status: 'OPENED',
      plannedStart: null,
      plannedEnd: null,
      actualStart: null,
      actualEnd: null,
      requiredParts: [],
      usedParts: [],
      estimatedCost: 75000,
      actualCost: 0,
      failureReason: null,
      notes: 'Yüksek maliyetli iş — planlama öncesi şube sorumlusu onayı bekleniyor (Kural 2).',
      managerApproved: false,
      createdAt: new Date(now - 1 * dayMs).toISOString()
    });

    // Güncellenmiş parça stoklarını kalıcı yap
    this.storage.setCollection(STORAGE_KEYS.SPARE_PARTS, spareParts);
    this.storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, requests);
    this.storage.setCollection(STORAGE_KEYS.WORK_ORDERS, workOrders);
    this.storage.setCollection(STORAGE_KEYS.PART_RESERVATIONS, reservations);
  }

  private pickCustomerName(i: number): string {
    const names = [
      'Ayşe Yılmaz', 'Mehmet Kaya', 'Fatma Şahin', 'Ali Demir', 'Zeynep Çelik',
      'Mustafa Arslan', 'Elif Öztürk', 'Ahmet Yıldız', 'Selin Aydın', 'Emre Doğan',
      'Merve Koç', 'Burak Aslan', 'Gizem Polat', 'Onur Kurt', 'Deniz Erdoğan'
    ];
    return names[i % names.length];
  }

  private pickStreet(i: number): string {
    const streets = [
      'Atatürk Caddesi', 'Cumhuriyet Bulvarı', 'İnönü Sokak', 'Barış Mahallesi',
      'Gül Sokak', 'Menekşe Caddesi', 'Fatih Bulvarı', 'Şehit Ali Sokak'
    ];
    return streets[i % streets.length];
  }

  generateLargeDataset(): void {
    console.log('5.000+ Kayit Büyük Veri Simülasyonu baslatiliyor...');
    
    // Performans testleri için mevcut verileri temizlemeden üzerine 5000'er adet kayıt ekleyeceğiz
    const currentRequests = this.storage.getCollection<ServiceRequest>(STORAGE_KEYS.SERVICE_REQUESTS);
    const currentWorkOrders = this.storage.getCollection<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
    const stockMovements: StockMovement[] = this.storage.getCollection<StockMovement>(STORAGE_KEYS.STOCK_MOVEMENTS);
    const auditLogs: AuditLog[] = this.storage.getCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    const notifications: Notification[] = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);

    const branches = this.storage.getCollection<Branch>(STORAGE_KEYS.BRANCHES);
    const branchIds = branches.map(b => b.id);
    const priorities: ServicePriority[] = ['STANDARD', 'URGENT', 'CRITICAL'];
    const statuses: ServiceRequestStatus[] = ['NEW', 'PLANNED', 'IN_PROGRESS', 'CLOSED'];
    const woStatuses: WorkOrderStatus[] = ['OPENED', 'PLANNED', 'ON_THE_WAY', 'COMPLETED'];
    const skills: SkillType[] = ['WHITE_GOODS', 'HVAC', 'ELECTRIC', 'ELECTRONICS_MOTHERBOARD', 'PLUMBING', 'BOILER_HEATING'];

    // 1. 5000 adet Servis Talebi ve İş Emri Üretimi
    for (let i = 10001; i <= 15000; i++) {
      const branchId = branchIds[i % branchIds.length] || 'branch-1';
      const priority = priorities[i % priorities.length];
      const status = statuses[i % statuses.length];
      const skill = skills[i % skills.length];
      const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const reqId = `large-req-${i}`;
      currentRequests.push({
        id: reqId,
        code: `TALEP-SIM-${i}`,
        customerId: `large-cust-${i}`,
        customerName: `Simule Musteri ${i}`,
        customerPhone: `0530999${i}`,
        customerAddress: `Simule Adres ${i}. Sokak No: ${i}, Daire ${(i % 12) + 1}`,
        customerRegion: `Simule Bölge ${(i % 5) + 1}`,
        branchId: branchId,
        title: `Performans Test Talebi ${i}`,
        description: `Büyük veri yükleme testi için oluşturulmuş otomatik talep verisidir.`,
        deviceBrandModel: 'Simule Cihaz Marka/Model',
        serviceCategory: 'Simule Hizmet Kategorisi',
        requiredSkill: skill,
        priority: priority,
        status: status,
        slaDeadline: slaDeadline,
        hasWarranty: i % 2 === 0,
        hasCustomerApproval: true,
        createdAt: new Date().toISOString()
      });

      const woStatus = woStatuses[i % woStatuses.length];
      currentWorkOrders.push({
        id: `large-wo-${i}`,
        code: `WO-SIM-${i}`,
        serviceRequestId: reqId,
        branchId: branchId,
        technicianId: woStatus !== 'OPENED' ? 'tech-1' : null,
        vehicleId: woStatus !== 'OPENED' ? 'vehicle-1' : null,
        status: woStatus,
        plannedStart: new Date().toISOString(),
        plannedEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        actualStart: woStatus === 'COMPLETED' ? new Date().toISOString() : null,
        actualEnd: woStatus === 'COMPLETED' ? new Date().toISOString() : null,
        requiredParts: [],
        usedParts: [],
        estimatedCost: 100 + (i % 500),
        actualCost: woStatus === 'COMPLETED' ? 100 + (i % 500) : 0,
        failureReason: null,
        notes: `Büyük veri simüle notu ${i}`,
        createdAt: new Date().toISOString()
      });
    }

    // 2. 1000 adet Stok Hareketi Üretimi
    for (let i = 1; i <= 1000; i++) {
      stockMovements.push({
        id: `large-sm-${i}`,
        partId: `part-${1 + (i % 90)}`,
        quantity: 1 + (i % 10),
        type: i % 2 === 0 ? 'IN' : 'OUT',
        workOrderId: null,
        description: `Toplu simülasyon stok hareketi girdisi ${i}`,
        createdAt: new Date().toISOString()
      });
    }

    // 3. 500 adet Audit Log Üretimi
    for (let i = 1; i <= 500; i++) {
      auditLogs.push({
        id: `large-log-${i}`,
        userId: 'user-admin',
        username: 'admin@demo.com',
        userRole: 'SYSTEM_ADMIN',
        actionType: i % 3 === 0 ? 'CREATE' : 'UPDATE',
        entityType: 'WORK_ORDER',
        entityId: `large-wo-${10000 + i}`,
        oldValue: null,
        newValue: JSON.stringify({ status: 'PLANNED' }),
        description: `Büyük veri toplu planlama simülasyon kaydı ${i}`,
        simulatedIp: `192.168.1.${i % 255}`,
        createdAt: new Date().toISOString()
      });
    }

    // 4. 200 adet Notification Üretimi
    for (let i = 1; i <= 200; i++) {
      notifications.push({
        id: `large-notif-${i}`,
        type: 'LOW_STOCK',
        title: 'Toplu Stok Uyarısı',
        message: `Simülasyon kapsamındaki yedek parça ${i} kritik seviyenin altındadır.`,
        branchId: 'branch-1',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityId: `part-${i}`,
        isRead: i % 5 === 0,
        createdAt: new Date().toISOString()
      });
    }

    // Koleksiyonları yaz
    this.storage.setCollection(STORAGE_KEYS.SERVICE_REQUESTS, currentRequests);
    this.storage.setCollection(STORAGE_KEYS.WORK_ORDERS, currentWorkOrders);
    this.storage.setCollection(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);
    this.storage.setCollection(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
    this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, notifications);

    console.log('5.000+ Kayit Büyük Veri Simülasyonu basariyla tamamlandi.');
  }

  private seedNotifications(): void {
    const notifications: Notification[] = [
      // 0. Kural 2 — onay bekleyen yüksek maliyetli iş (aksiyonel bildirim)
      {
        id: 'notif-approval-1',
        type: 'APPROVAL_REQUIRED',
        severity: 'WARNING',
        title: 'Yüksek Maliyetli İş Emri Onayı Bekleniyor',
        message: 'WO-2026-9001 nolu iş emrinin tahmini maliyeti 75.000 TL. Planlanabilmesi için onayınız gerekiyor. İş emirleri sayfasından "Onayla" ile onay verebilirsiniz.',
        targetRole: 'BRANCH_MANAGER',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-yuksek-maliyet',
        link: '/is-emirleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      // 1. SYSTEM_ADMIN / OPERATION_MANAGER
      {
        id: 'notif-admin-1',
        type: 'RULE_CONFLICT',
        severity: 'WARNING',
        title: 'Kural Çakışması Çözüldü',
        message: 'Aynı iş emrinde iki kural çelişti; öncelik sırasına göre kazanan kural uygulandı. Detaylar denetim kayıtlarında.',
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'RULE',
        relatedEntityId: 'rule-2',
        link: '/kurallar',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-admin-2',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'Yeni Kurallar Sandbox Testi Onayı',
        message: 'Kural motoru sandbox ortamına yeni eklenen yakıt tasarrufu önceliklendirme kuralı test edilmeye hazırdır.',
        targetRole: 'OPERATION_MANAGER',
        targetUserId: null,
        relatedEntityType: 'RULE',
        relatedEntityId: 'rule-test',
        link: '/kurallar',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-admin-3',
        type: 'CAPACITY_FULL',
        severity: 'ERROR',
        title: 'Kapasite Aşım Riski Uyarısı',
        message: 'Ankara Çankaya Şubesinde bugün aktif iş sayısı (12), şube günlük kapasitesini (10) aşmıştır. Yeni atamalar kısıtlanacaktır.',
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'SYSTEM',
        relatedEntityId: null,
        link: '/subeler',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-admin-4',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'Sistem Audit Log Denetleme Talebi',
        message: 'Sistem ayarlarında yapılan son kritik güncellemeler denetimDiff günlüğüne kaydedilmiştir. İncelemeniz bekleniyor.',
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityType: 'SYSTEM',
        relatedEntityId: null,
        link: '/denetim-kayitlari',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-admin-5',
        type: 'IMPORT_ERROR',
        severity: 'ERROR',
        title: 'İçe Aktarım Hata Raporu',
        message: 'Son veri aktarımı sırasında 3 adet şube satırı koordinat validasyon sınırlarını aştığı için içe aktarılamadı.',
        targetRole: 'OPERATION_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SYSTEM',
        relatedEntityId: null,
        link: '/veri-transferi',
        isRead: false,
        createdAt: new Date().toISOString()
      },

      // 2. BRANCH_MANAGER / DISPATCHER
      {
        id: 'notif-bm-1',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'Yeni Servis Talebi: Müşteri Onayı Alındı',
        message: 'TALEP-201 nolu Bosch Çamaşır Makinesi arızası için garanti dışı kapsam kabul edilmiş ve müşteri onayı sisteme kaydedilmiştir.',
        targetRole: 'BRANCH_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SERVICE_REQUEST',
        relatedEntityId: 'req-201',
        link: '/servis-talepleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-bm-2',
        type: 'SLA_APPROACHING',
        severity: 'WARNING',
        title: 'SLA Yaklaşan İş Emri',
        message: 'Kadıköy Şubesine bağlı TALEP-202 nolu iş emrinin SLA süresinin dolmasına 3 saat kalmıştır. Hızlı aksiyon alınız.',
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-202',
        link: '/planlama',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-bm-3',
        type: 'RULE_CONFLICT',
        severity: 'ERROR',
        title: 'Teknisyen Çalışma Takvimi Çakışması',
        message: 'Fatih Mert adlı teknisyene çalışma saatleri (08:30-17:30) dışında bir planlama yapılmaya çalışıldı. Atama bloke edildi.',
        targetRole: 'BRANCH_MANAGER',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-203',
        link: '/kurallar',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-bm-4',
        type: 'VEHICLE_MAINTENANCE',
        severity: 'WARNING',
        title: 'Araç Bakım Zamanı Geldi',
        message: '34 ABC 123 plakalı saha aracının 150 gündür bakım kaydı bulunmuyor. Planlamada kullanımı askıya alınabilir.',
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: 'VEHICLE',
        relatedEntityId: 'vehicle-1',
        link: '/araclar',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-bm-5',
        type: 'TECHNICIAN_ASSIGNED',
        severity: 'INFO',
        title: 'Teknisyen Ataması Onay Uyarısı',
        message: 'İş emri atama skoru %65 olan junior teknisyene atama yapılmak isteniyor. Lütfen teyit ediniz.',
        targetRole: 'DISPATCHER',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-204',
        link: '/is-emirleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },

      // 3. WAREHOUSE_MANAGER
      {
        id: 'notif-wm-1',
        type: 'LOW_STOCK',
        severity: 'ERROR',
        title: 'Kritik Stok Seviyesi: Kompresör',
        message: 'Kadıköy Şubesi deposundaki \'Kompresör Motoru 1.5HP\' stoğu (1 adet), kritik limitin (5 adet) altına düşmüştür.',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: 'part-1',
        link: '/stok/kritik',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-wm-2',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'Parça Rezervasyon Talebi',
        message: 'WO-402 nolu iş emri için 3 adet Elektronik Kart deposundan rezerve edilmek üzere onay bekliyor.',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: 'part-2',
        link: '/stok/hareket',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-wm-3',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'Stok Giriş Hareketi Onayı',
        message: 'Yeni içe aktarılan 20 adet Filtre parçası stok kayıt onayına sunulmuştur.',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: 'part-3',
        link: '/stok',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-wm-4',
        type: 'RULE_CONFLICT',
        severity: 'ERROR',
        title: 'Garanti Dışı Parça Blokesi',
        message: 'TALEP-203 nolu garanti dışı iş emrinde müşteri onayı bulunmadığı için parça rezervasyonu bloke edilmiştir.',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: 'part-4',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-wm-5',
        type: 'ASSIGNMENT_CREATED',
        severity: 'INFO',
        title: 'Tüketilen Parça Bildirimi',
        message: 'Teknisyen Fatih Mert tarafından WO-399 nolu iş emrinde 1 adet Conta Seti başarıyla tüketildi.',
        targetRole: 'WAREHOUSE_MANAGER',
        targetUserId: null,
        relatedEntityType: 'SPARE_PART',
        relatedEntityId: 'part-5',
        isRead: false,
        createdAt: new Date().toISOString()
      },

      // 4. TECHNICIAN
      {
        id: 'notif-tech-1',
        type: 'ASSIGNMENT_CREATED',
        severity: 'INFO',
        title: 'Yeni İş Emri Atandı',
        message: 'Kadıköy Merkez Şubesinde Bosch Bulaşık Makinesi arızası (WO-405) size atanmıştır. SLA Kalan: 24 Saat.',
        targetRole: 'TECHNICIAN',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-405',
        link: '/is-emirleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-tech-2',
        type: 'PARTIAL_COMPLETION',
        severity: 'WARNING',
        title: 'Kısmi Tamamlama Bildirimi',
        message: 'WO-404 nolu iş emrinde parça eksikliği nedeniyle kısmi tamamlama notu sisteme girilmiştir.',
        targetRole: 'TECHNICIAN',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-404',
        link: '/is-emirleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-tech-3',
        type: 'FAILED_WORK',
        severity: 'ERROR',
        title: 'Başarısız Servis Uyarısı',
        message: 'Müşteri adreste bulunamadığı için WO-403 nolu iş emri \'Başarısız\' statüsüne çekilmiştir.',
        targetRole: 'TECHNICIAN',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-403',
        link: '/is-emirleri',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-tech-4',
        type: 'VEHICLE_MAINTENANCE',
        severity: 'WARNING',
        title: 'Araç Yakıt Seviyesi Düşük',
        message: 'Atandığınız 34 ABC 123 plakalı saha aracının yakıt seviyesi %15\'e düşmüştür. En yakın istasyona uğrayınız.',
        targetRole: 'TECHNICIAN',
        targetUserId: null,
        relatedEntityType: 'VEHICLE',
        relatedEntityId: 'vehicle-1',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-tech-5',
        type: 'NEW_REQUEST',
        severity: 'INFO',
        title: 'İş Emri Güncelleme İzni',
        message: 'SLA süresi geçmiş iş emri üzerinde durum değişikliği yapabilmeniz için merkez yöneticisi izni tanımlandı.',
        targetRole: 'TECHNICIAN',
        targetUserId: null,
        relatedEntityType: 'WORK_ORDER',
        relatedEntityId: 'wo-406',
        isRead: false,
        createdAt: new Date().toISOString()
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }

  private seedShifts(branches: Branch[], technicians: Technician[]): void {
    if (branches.length === 0) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const branch1 = branches[0];
    const branch2 = branches[1] || branches[0];
    const branch3 = branches[2] || branches[0];

    // Aday teknisyenleri yetkinliklere göre filtrele (uyumluluk garantili demo için)
    const hvacTech = technicians.find(t => t.skills?.includes('HVAC' as any) && t.isActive);
    const whiteTech = technicians.find(t => t.skills?.includes('WHITE_GOODS' as any) && t.isActive);

    const shifts: ShiftAssignment[] = [
      {
        id: 'shift-seed-1',
        code: 'VRD-2026-0001',
        title: 'Hafta Sonu Klima Periyodik Bakım Vardiyası',
        taskType: 'ROUTINE_MAINT',
        description: 'Anadolu yakası kurumsal müşteri klima ünitelerinin yıllık periyodik bakım çalışması.',
        branchId: branch1.id,
        region: branch1.district || branch1.city,
        requiredSkill: 'HVAC',
        requiredHeadcount: 3,
        start: new Date(now + 2 * dayMs).toISOString(),
        end: new Date(now + 2 * dayMs + 8 * 60 * 60 * 1000).toISOString(),
        priority: 'STANDARD',
        assignedTechnicianIds: hvacTech ? [hvacTech.id] : [],
        status: 'PLANNED',
        createdBy: null,
        createdAt: new Date(now - 1 * dayMs).toISOString(),
        notes: null
      },
      {
        id: 'shift-seed-2',
        code: 'VRD-2026-0002',
        title: 'Gece Çağrı Üzerine Saha Vardiyası',
        taskType: 'ON_CALL',
        description: 'Gece saatlerinde gelen acil arıza çağrılarını karşılayacak bekleme vardiyası.',
        branchId: branch2.id,
        region: branch2.district || branch2.city,
        requiredSkill: 'ELECTRIC',
        requiredHeadcount: 2,
        start: new Date(now + 1 * dayMs).toISOString(),
        end: new Date(now + 1 * dayMs + 12 * 60 * 60 * 1000).toISOString(),
        priority: 'URGENT',
        assignedTechnicianIds: [],
        status: 'PLANNED',
        createdBy: null,
        createdAt: new Date(now - 2 * dayMs).toISOString(),
        notes: null
      },
      {
        id: 'shift-seed-3',
        code: 'VRD-2026-0003',
        title: 'Yeni Mağaza Beyaz Eşya Kurulum Görevi',
        taskType: 'INSTALLATION',
        description: 'Yeni açılacak şube için toplu beyaz eşya kurulum + devreye alma çalışması.',
        branchId: branch3.id,
        region: branch3.district || branch3.city,
        requiredSkill: 'WHITE_GOODS',
        requiredHeadcount: 4,
        start: new Date(now + 5 * dayMs).toISOString(),
        end: new Date(now + 5 * dayMs + 10 * 60 * 60 * 1000).toISOString(),
        priority: 'CRITICAL',
        assignedTechnicianIds: whiteTech ? [whiteTech.id] : [],
        status: 'PLANNED',
        createdBy: null,
        createdAt: new Date(now - 3 * dayMs).toISOString(),
        notes: 'Müşteri kurulum saatlerine titizlikle riayet edilmeli.'
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.SHIFT_ASSIGNMENTS, shifts);
  }

  /**
   * Stok hareket geçmişi — şartname Bölüm 5'teki 5 hareket tipinin tamamı demo edilebilsin:
   * Giriş, Çıkış, Transfer (çift kayıt), Fire, Sayım Düzeltmesi.
   */
  private seedStockMovements(spareParts: SparePart[]): void {
    if (spareParts.length < 4) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const p = (i: number) => spareParts[i % spareParts.length];

    const movements: StockMovement[] = [
      // Giriş — tedarikçi alımı
      {
        id: 'smv-seed-1', partId: p(0).id, quantity: 25, type: 'IN', workOrderId: null,
        description: 'Ana tedarikçiden dönemsel alım (fatura no: FTR-2026-0142)',
        createdAt: new Date(now - 6 * dayMs).toISOString(),
        pairedMovementId: null, previousQuantity: null, newQuantity: null
      },
      {
        id: 'smv-seed-2', partId: p(1).id, quantity: 12, type: 'IN', workOrderId: null,
        description: 'İade edilen sağlam ürünlerin stoğa geri alınması',
        createdAt: new Date(now - 5 * dayMs).toISOString(),
        pairedMovementId: null, previousQuantity: null, newQuantity: null
      },
      // Çıkış — iş emrinde kullanım
      {
        id: 'smv-seed-3', partId: p(2).id, quantity: 3, type: 'OUT', workOrderId: 'wo-10',
        description: 'Saha iş emrinde kullanım (klima kompresör değişimi)',
        createdAt: new Date(now - 4 * dayMs).toISOString(),
        pairedMovementId: null, previousQuantity: null, newQuantity: null
      },
      // Transfer — şubeler arası (çift kayıt: çıkış + giriş)
      {
        id: 'smv-seed-4-out', partId: p(3).id, quantity: 5, type: 'TRANSFER', workOrderId: null,
        description: 'Transfer (Çıkış): Kadıköy şubesi stok takviyesi',
        createdAt: new Date(now - 3 * dayMs).toISOString(),
        pairedMovementId: 'smv-seed-4-in', previousQuantity: null, newQuantity: null
      },
      {
        id: 'smv-seed-4-in', partId: p(4).id, quantity: 5, type: 'TRANSFER', workOrderId: null,
        description: 'Transfer (Giriş): Ankara Çankaya şubesinden gelen takviye',
        createdAt: new Date(now - 3 * dayMs).toISOString(),
        pairedMovementId: 'smv-seed-4-out', previousQuantity: null, newQuantity: null
      },
      // Fire — hasar / kayıp
      {
        id: 'smv-seed-5', partId: p(5).id, quantity: 2, type: 'FIRE', workOrderId: null,
        description: 'Nakliye sırasında hasar gören ürünler fire olarak düşüldü',
        createdAt: new Date(now - 2 * dayMs).toISOString(),
        pairedMovementId: null, previousQuantity: 22, newQuantity: 20
      },
      // Sayım düzeltmesi
      {
        id: 'smv-seed-6', partId: p(6).id, quantity: 3, type: 'ADJUSTMENT', workOrderId: null,
        description: 'Yıl sonu fiziksel sayım farkı düzeltmesi (Eski: 30, Yeni: 33, Fark: +3)',
        createdAt: new Date(now - 1 * dayMs).toISOString(),
        pairedMovementId: null, previousQuantity: 30, newQuantity: 33
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  /**
   * Örnek denetim kayıtları — sayfa ilk açılışta boş kalmasın; diff modalı,
   * güvenlik ihlali rozeti ve durum geçişi kayıtları demo edilebilsin.
   */
  private seedAuditLogs(branches: Branch[], technicians: Technician[]): void {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const branch = branches[0];
    const tech = technicians[0];

    const logs: AuditLog[] = [
      {
        id: 'audit-seed-1',
        userId: 'user-admin', username: 'admin@demo.com', userRole: 'SYSTEM_ADMIN',
        actionType: 'CREATE', entityType: 'BRANCH', entityId: branch.id,
        oldValue: null,
        newValue: JSON.stringify({ name: branch.name, city: branch.city, dailyCapacity: branch.dailyCapacity }),
        description: `Yeni şube oluşturuldu: ${branch.name} (${branch.code})`,
        simulatedIp: '10.14.22.101', createdAt: new Date(now - 30 * hourMs).toISOString(), result: 'SUCCESS', failureReason: null
      },
      {
        id: 'audit-seed-2',
        userId: 'user-operation', username: 'operation@demo.com', userRole: 'OPERATION_MANAGER',
        actionType: 'UPDATE', entityType: 'TECHNICIAN', entityId: tech.id,
        oldValue: JSON.stringify({ performanceScore: 90, dailyCapacity: 5 }),
        newValue: JSON.stringify({ performanceScore: 95, dailyCapacity: 6 }),
        description: `Teknisyen güncellendi: ${tech.fullName} — performans ve kapasite artırıldı`,
        simulatedIp: '172.20.4.87', createdAt: new Date(now - 26 * hourMs).toISOString(), result: 'SUCCESS', failureReason: null
      },
      {
        id: 'audit-seed-3',
        userId: 'user-dispatcher', username: 'dispatcher@demo.com', userRole: 'DISPATCHER',
        actionType: 'STATE_TRANSITION', entityType: 'WORK_ORDER', entityId: 'wo-12',
        oldValue: JSON.stringify({ status: 'PLANNED' }),
        newValue: JSON.stringify({ status: 'ON_THE_WAY' }),
        description: 'İş emri durum geçişi: Planlandı → Yolda',
        simulatedIp: '192.168.7.44', createdAt: new Date(now - 20 * hourMs).toISOString(), result: 'SUCCESS', failureReason: null
      },
      {
        id: 'audit-seed-4',
        userId: 'user-technician', username: 'technician@demo.com', userRole: 'TECHNICIAN',
        actionType: 'SECURITY_VIOLATION', entityType: 'SYSTEM', entityId: 'user-technician',
        oldValue: null,
        newValue: JSON.stringify({ attemptedUrl: '/subeler' }),
        description: 'Kullanıcı (technician@demo.com) yetkisiz rotaya URL ile erişmeye çalıştı: /subeler',
        simulatedIp: '192.168.7.102', createdAt: new Date(now - 12 * hourMs).toISOString(),
        result: 'FAILURE', failureReason: 'Bu rol için rota erişimi kapalıdır.'
      },
      {
        id: 'audit-seed-5',
        userId: 'user-warehouse', username: 'warehouse@demo.com', userRole: 'WAREHOUSE_MANAGER',
        actionType: 'UPDATE', entityType: 'SPARE_PART', entityId: 'part-1',
        oldValue: JSON.stringify({ stockQuantity: 20, reservedQuantity: 0 }),
        newValue: JSON.stringify({ stockQuantity: 45, reservedQuantity: 0 }),
        description: 'Stok hareketi oluşturuldu (IN): 25 adet parça girişi',
        simulatedIp: '10.30.11.9', createdAt: new Date(now - 6 * hourMs).toISOString(), result: 'SUCCESS', failureReason: null
      },
      {
        id: 'audit-seed-6',
        userId: 'user-admin', username: 'admin@demo.com', userRole: 'SYSTEM_ADMIN',
        actionType: 'SYSTEM_EVENT', entityType: 'SYSTEM', entityId: 'seed',
        oldValue: null, newValue: null,
        description: 'Demo veri seti oluşturuldu (otomatik seed).',
        simulatedIp: '127.0.0.1', createdAt: new Date(now - 1 * hourMs).toISOString(), result: 'SUCCESS', failureReason: null
      }
    ];

    this.storage.setCollection(STORAGE_KEYS.AUDIT_LOGS, logs);
  }
}
