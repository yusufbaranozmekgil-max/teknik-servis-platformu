# Çok Şubeli Teknik Servis ve Saha Operasyon Yönetim Platformu

Saha operasyonlarının şube bazlı yönetimi, kaynak tahsisatı (teknisyen ve araçlar), envanter/stok takibi ve gerçek zamanlı kural/puanlama motorlarını entegre eden kurumsal düzeyde saha yönetim sistemidir.

> **Canlı Demo:** _(dağıtım sonrası Vercel adresi buraya eklenecek)_
>
> **Teknoloji:** Angular 17 · Signals · Reactive Forms · Chart.js · LocalStorage
> **Demo giriş:** `admin@demo.com` / `123456` (tüm roller aynı şifre)

---

## 1. Proje Adı
**Çok Şubeli Teknik Servis ve Saha Operasyon Yönetim Platformu**

---

## 2. Proje Özeti
Bu platform; çok şubeli bir teknik servis organizasyonunun tüm operasyon zincirini dijitalleştirmek üzere tasarlanmıştır. Saha ekiplerinin ve araçların planlanması, gelen müşteri arıza taleplerinin yönetilmesi, envanter/stok takibi, iş emri durum yönetimi, kural motoru sandbox testleri, zengin grafik raporlamaları ve kapsamlı veri içe/dışa aktarım mekanizmalarını içermektedir.

---

## 3. Bu Proje Neden Basit Bir CRUD Değildir?
Bu proje sıradan bir veri ekleme, okuma, güncelleme ve silme (CRUD) uygulaması değildir. Aşağıdaki karmaşık iş kuralları ve bütünlük mekanizmaları projeyi kurumsal bir operasyon motoruna dönüştürmektedir:
* **Çakışma Önleme**: Teknisyenlerin ve araçların takvimlerinde zaman çakışmaları matematiksel olarak engellenir.
* **Yetkinlik Kontrolü**: İş emrine atanacak teknisyenin uzmanlık alanı, hizmet talebinin konusu ile uyuşmak zorundadır; uyuşmayan atamalar servis düzeyinde reddedilir.
* **Stok Tahsisat Güvencesi**: Stoklar rezervasyon bazlı bloke edilir. Kullanılabilir envanter miktarı aşan yedek parça rezervasyonları kesinlikle engellenir.
* **Rollback Mekanizmaları**: İş iptallerinde veya kısmi tamamlanma durumlarında parça rezervasyonları ve teknisyen takvimleri otomatik olarak iş emri öncesi durumuna iade edilir.
* **Deterministik Kural Motoru**: Çelişen kurallar öncelik sırası ve yaş esasına göre otomatik olarak çözülerek loglanır.
* **Storage Bütünlüğü**: LocalStorage'a bozuk veri yazıldığında uygulama çökmez, veriyi izole ederek otomatik iyileştirme (self-healing) gerçekleştirir.

---

## 4. Kullanılan Teknolojiler
* **Framework**: Angular 17+ (Standalone Bileşen Mimarisi, Routing).
* **State Management**: Angular Signals & Computed (Dinamik reaktif veri akışı).
* **Forms**: Angular Reactive Forms (Strictly Typed form yapıları).
* **Grafik Kütüphanesi**: Chart.js (Asenkron CDN entegrasyonu).
* **Tasarım & CSS**: Premium Vanilla CSS (Özel HSL renk paleti, sleak dark mod, glassmorphism, mikro-animasyonlar).
* **Veri Depolama**: Tarayıcı LocalStorage (Servis sarmallı).

---

## 5. Kurulum
Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları takip edin:

1. Proje dizinine gidin:
   ```bash
   cd "staj proje 3"
   ```
2. Gerekli bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

---

## 6. Çalıştırma
Geliştirme sunucusunu başlatmak için:
```bash
npm start
```
Tarayıcınızda `http://localhost:4200/` adresini açarak uygulamaya erişebilirsiniz.

Projeyi production modunda derlemek için:
```bash
npm run build
```
Derleme çıktıları `dist/technical-service-app` dizininde yer alacaktır.

---

## 7. Demo Kullanıcıları
Sisteme giriş yapmak ve yetki matrislerini test etmek için aşağıdaki demo kullanıcı bilgilerini kullanabilirsiniz:

Tüm demo hesapların şifresi ortaktır: **`123456`**. Giriş ekranındaki hızlı erişim butonlarıyla da tek tıkla oturum açabilirsiniz.

| Kullanıcı Adı (E-posta) | Şifre | Rol | Açıklama |
| :--- | :--- | :--- | :--- |
| `admin@demo.com` | `123456` | **Sistem Yöneticisi** | Tüm sisteme ve tüm şubelere sınırsız erişim hakkı. |
| `operation@demo.com` | `123456` | **Operasyon Müdürü** | Genel operasyon yönetimi, araç ve şube analizleri. |
| `branch@demo.com` | `123456` | **Şube Sorumlusu** | Şubeye bağlı envanter, teknisyen ve doluluk takibi; yüksek maliyetli iş onayı. |
| `dispatcher@demo.com` | `123456` | **Planlama / Dispeçer** | Saha atamaları, zamanlama ve teknisyen planlama. |
| `warehouse@demo.com` | `123456` | **Depo Sorumlusu** | Yedek parça giriş/çıkış ve stok takibi. |
| `technician@demo.com` | `123456` | **Teknisyen** | Kendisine atanan iş emirlerini listeleme ve durum güncelleme. |
| `report@demo.com` | `123456` | **Raporlama Yetkilisi** | Analitik raporlara ve genel bakış paneline salt-okunur erişim. |

---

## 8. Rol Bazlı Yetki Sistemi
Sistemde her kullanıcının yetki alanı rol matrisine (`ROLE_PERMISSION_MATRIX`) göre sınırlandırılmıştır. Menüler ve düğmeler, aktif kullanıcının sahip olduğu izinlere göre dinamik olarak gizlenir veya gösterilir. route'lara girişler guards ile kilitlenmiştir.

---

## 9. Mimari Yapı
Proje **MVVM / Service-Driven Architecture** yaklaşımı ile tasarlanmıştır.
* **Component Katmanı (V/VM)**: Sadece arayüz sunumu, kullanıcı etkileşimi ve Reactive Forms tanımlarını içerir. Kesinlikle veritabanı veya localStorage erişimi yapmaz.
* **Service Katmanı (Model/Controller)**: İş kuralları, validasyonlar, yetki denetimleri ve storage veri manipülasyonlarının yapıldığı yegane katmandır.

---

## 10. Klasör Yapısı
```
src/app/
├── core/               # Tekil Örnekler (Singleton Services, Guards, Auth, Models)
│   ├── auth/           # Oturum yönetimi ve Auth State servisi
│   ├── constants/      # Rol yetki matrisleri ve statik sabitler
│   ├── guards/         # Rota erişim koruyucuları (AuthGuard, PermissionGuard)
│   ├── models/         # TypeScript tip tanımları ve arayüzler
│   ├── services/       # İş mantığı servisleri (Scheduling, Reservation, WorkOrder vb.)
│   └── storage/        # LocalStorage sarmalayıcısı, Şema doğrulama ve Seed verileri
├── shared/             # Yeniden Kullanılabilir Arayüzler (UI Components, Pipes, Directives)
│   ├── components/     # DataTable, Modal vb. ortak arayüz bileşenleri
│   ├── directives/     # appRoleVisibility, appPermissionVisibility, appTooltip
│   ├── pipes/          # timeAgo, categoryIcon, techLevelColor, slaStatus, fileSize
│   └── validators/     # Custom validators (plate, phone, workingHours vb.)
└── features/           # Sayfa Bazlı Dikey Özellik Modülleri (Lazy Loaded)
    ├── dashboard/      # Role-based dashboard sayfaları
    ├── reports/        # Raporlama ekranı ve Chart.js panelleri
    ├── import-export/  # JSON/CSV transfer merkezi
    └── simulation/     # Senaryo ve büyük veri simülatörü
```

---

## 11. Core Modüller
* `StorageService`: Güvenli veri okuma/yazma, yedekleme ve şema uyum analizi sağlar.
* `SeedService`: Sistem ilk açıldığında şubeleri, araçları, teknisyenleri ve kuralları otomatik doldurur.
* `AuthService` & `AuthStateService`: Giriş-çıkış işlemlerini ve aktif kullanıcı bilgisini yönetir.
* `PermissionService`: Rol-izin kontrollerini gerçekleştirir.

---

## 12. Feature Modüller
* **Branches / Technicians / Inventory / Vehicles**: Standart CRUD yönetimi sunan feature modülleridir.
* **Scheduling**: Sürükle-bırak takvim ve puanlama motorunu barındıran saha planlama modülüdür.
* **Rules**: Kuralların sandbox ortamında canlı simüle edildiği kural modülüdür.
* **Notifications / Audit Logs**: Sistem olaylarının ve audit diff çıktılarının takip edildiği izleme modülleridir.

---

## 13. localStorage Veri Mimarisi
Tüm koleksiyonlar localStorage üzerinde `ts_` ön ekiyle JSON formatında saklanır. Koleksiyon isimleri:
* `ts_users` (Kullanıcılar)
* `ts_branches` (Şubeler)
* `ts_technicians` (Saha Çalışanları)
* `ts_spare_parts` (Yedek Parçalar)
* `ts_stock_movements` (Stok Giriş/Çıkış Fişleri)
* `ts_service_requests` (Hizmet Talepleri)
* `ts_work_orders` (Saha İş Emirleri)
* `ts_part_reservations` (Stok Bloke Rezervasyonları)
* `ts_vehicles` (Saha Araçları)
* `ts_rules` (Sistem Kuralları)
* `ts_notifications` (Bildirimler)
* `ts_audit_logs` (Audit Takip Günlüğü)

---

## 14. Storage Güvenliği ve Migration Stratejisi
* **Bileşen İzolasyonu**: Component'lerin doğrudan `localStorage` objesine erişmesi kesinlikle yasaklanmıştır. Tüm veri okuma/yazma işlemleri `StorageService` üzerinden yapılır.
* **Şema Doğrulama (Self-Healing)**: `StorageSchema` tanımları yardımıyla okunan her veri satırı doğrulanır. Bozuk veri tespit edilirse silinmez; `backup_corrupted_...` etiketli yeni bir anahtara taşınarak yedeklenir. Orijinal koleksiyon sıfırlanarak uygulamanın kilitlenmesi engellenir.
* **Kota Sınırı Koruması**: Tarayıcı kotası dolduğunda (`QuotaExceededError`) hata yakalanır, log yazılır ve yöneticiye acil temizlik bildirimi gönderilir.

---

## 15. RBAC Mimarisi
Yetki kontrolü **Route Guard** (`permission.guard.ts`) seviyesinde başlayıp, **Servis Metotları** (`assertPermission()`) içerisinde sonlanır. Arayüzde ise yetkisiz butonlar `appPermissionVisibility` ve `appRoleVisibility` direktifleri ile DOM'dan tamamen kaldırılır.

---

## 16. İş Emri State-Machine
İş emirlerinin durum geçişleri `WorkOrderService` içerisindeki merkezi durum makinesi aracılığıyla yürütülür. Durum atamaları doğrudan yapılamaz. Geçersiz geçişler (Örn: `OPENED` durumundan doğrudan `COMPLETED` durumuna atlama) engellenerek `SECURITY_VIOLATION` olarak loglanır.

---

## 17. Zaman Çakışması Algoritması
Bir teknisyene veya araca çakışan zaman dilimlerinde iki iş emri atanması engellenir. Çakışma tespiti `SchedulingService.isOverlapping` metodunda aşağıdaki matematiksel modelle hesaplanır:
```typescript
isOverlapping(slotA: TimeSlot, slotB: TimeSlot): boolean {
  const startA = new Date(slotA.start).getTime();
  const endA = new Date(slotA.end).getTime();
  const startB = new Date(slotB.start).getTime();
  const endB = new Date(slotB.end).getTime();
  return startA < endB && startB < endA;
}
```

---

## 18. Stok Rezervasyon / Allocation Mantığı
Rezervasyon sistemi gerçek allocation mantığıyla çalışır. İş emri planlandığında gerekli parçalar `stockQuantity`'den düşülmez; `PartReservation` tablosunda `ACTIVE` olarak işaretlenip parçanın `reservedQuantity` alanına eklenir. Kullanılabilir stok miktarı `stockQuantity - reservedQuantity` formülü ile hesaplanır ve bu sınırı aşan rezervasyon talepleri atomik olarak reddedilir.

---

## 19. Rollback Doğruluğu
* **İş İptali (`CANCELLED`)**: İş emri iptal edildiğinde o iş emrine ait tüm aktif parça rezervasyonları serbest bırakılır (`RELEASED`). Teknisyen takvimi ve araç görevleri temizlenir.
* **Kısmi Tamamlanma (`PARTIALLY_COMPLETED`)**: Sahada kullanılan parça sayısı kadar miktar `stockQuantity`'den düşer. Kalan rezerve parçalar serbest bırakılarak tekrar kullanılabilir stoğa iade edilir.

---

## 20. Teknisyen Skor Algoritması
Teknisyen puanlamasında 0-100 puan normalizasyonu uygulanır. Puan dağılım kriterleri:
1. **Yetkinlik ve Seviye Uyum Puanı (30 Puan)**: İş emrinin uzmanlık alanı ile teknisyenin eşleşme kalitesi derecelendirilir.
2. **Bölge/Şehir Yakınlığı Puanı (20 Puan)** — kademeli karşılaştırma:
   * Aynı şube → **20 puan**
   * Teknisyenin `region` değeri, talep şubesinin `serviceAreas` listesinde geçiyorsa → **15 puan**
   * Aynı şehir, farklı şube → **10 puan**
   * Yakın bölge (`Branch.district === Technician.region`) → **8 puan**
   * Diğer → **0 puan**
3. **Zaman Müsaitliği Puanı (20 Puan)**: Günlük takvimdeki boş saat diliminin büyüklüğü değerlendirilir.
4. **Günlük Yük Dağılımı Puanı (10 Puan)**: İşlerin dengeli dağıtılması için günlük atanan iş sayısı az olan teknisyenler önceliklendirilir.
5. **Genel Performans Puanı (10 Puan)**: Teknisyenin geçmiş iş kapatma başarı ortalaması eklenir.
6. **SLA Aciliyet Puanı (10 Puan)**: SLA hedefi yaklaşan işlerde en uygun teknisyene ek puan verilerek hızlandırma sağlanır.

---

## 21. Araç Skor Algoritması
Saha aracı puanlamasında 0-100 puan normalizasyonu uygulanır. Kriterler:
1. **Ekipman Uygunluğu Puanı (30 Puan)**: İş için araçta zorunlu olan aletlerin bulunup bulunmamasıdır.
2. **Kapasite Yeterliliği Puanı (20 Puan)**: Taşınacak yük ağırlığının aracın taşıma kapasitesine verimlilik oranıdır.
3. **Bölge Yakınlığı Puanı (15 Puan)** — kademeli:
   * Aynı şube → **15**
   * Aynı şehir → **10**
   * Hizmet bölgesi kesişimi (`serviceAreas` örtüşmesi) → **8**
   * Diğer → **0**
4. **Bakım Durumu Puanı (15 Puan)**: Son bakımdan sonra geçen gün sayısı az olan araçlar yıpranmayı önlemek amacıyla önceliklendirilir.
5. **Yakıt Seviyesi Puanı (10 Puan)**: Depodaki yakıt miktarı yansıtılır. %30 altındaki araçlar elenir.
6. **Müsaitlik Puanı (10 Puan)**: Aracın günlük takvim doluluk durumudur.

---

## 21.A Skor Ağırlıklarının Gerekçesi
Toplam 100 puanlık bir normalize skor kullanılmasının sebebi; UI'da skor kırılımının doğrudan yüzde olarak okunabilmesi ve yöneticinin atama kararını sorgulayabilmesidir. Ağırlık dağılımı operasyonel risk hiyerarşisine göre belirlenmiştir:

### Teknisyen Skoru (Toplam 100 Puan)
| Kriter | Ağırlık | Neden Bu Ağırlık? |
|---|---|---|
| **Yetkinlik & Seviye Uyumu** | **30** | En kritik faktör. Yanlış yetkinlikteki teknisyen iş emrini tekrar etme, müşteri memnuniyetsizliği ve SLA aşımı doğurur. Servis düzeyinde *hard fail* yapılır; skor 0 olsa bile atama reddedilir. |
| **Bölge / Şehir Yakınlığı** | **20** | Saha operasyonunda 2. en önemli faktör. Yakın teknisyen = düşük ulaşım maliyeti + kısa müdahale süresi. Aynı şube/aynı şehir/hizmet bölgesi/yakın bölge şeklinde 4 kademe verilerek "ya hep ya hiç" cezasından kaçınılmıştır. |
| **Zaman Müsaitliği** | **20** | Boş saat dilimi olmadan atama yapılamaz; ancak müsaitlik tek başına yeterli değil — bu yüzden yetkinlik ile aynı ağırlık verilmemiştir. |
| **Günlük Yük Dağılımı** | **10** | Operasyonel adaleti sağlar (aynı kişiye sürekli iş yığılmasını önler). Düşük ağırlık çünkü hard kural değil, soft optimizasyon. |
| **Genel Performans Geçmişi** | **10** | Geçmiş kapatma oranı. Yüksek olsa zayıf yeni teknisyene asla iş düşmezdi — bu yüzden ağırlık sınırlandı. |
| **SLA Aciliyet Bonusu** | **10** | SLA hedefi yaklaştıkça en uygun teknisyene öncelik verir. Düşük tutuldu çünkü 30+20 = yetkinlik+yakınlık zaten doğal aciliyet çözücüsüdür. |

### Araç Skoru (Toplam 100 Puan)
| Kriter | Ağırlık | Neden Bu Ağırlık? |
|---|---|---|
| **Ekipman Uygunluğu** | **30** | İş için gerekli alet yoksa araç gönderilemez — teknisyen yetkinliğiyle simetrik en yüksek ağırlık. |
| **Kapasite Yeterliliği** | **20** | Taşınacak parça/yük araca sığmazsa iş başarısız olur. Yetkinlikten sonra 2. kritik faktör. |
| **Bölge Yakınlığı** | **15** | Teknisyen yakınlığından düşük: araç hareketlidir, gerekirse uzaktan da gönderilebilir; ancak yakıt+zaman maliyeti vardır. |
| **Bakım Durumu** | **15** | >150 gün bakım yapılmayan araç sahada arıza riski taşır. Yakınlıkla aynı ağırlık çünkü mekanik güvenilirlik = operasyonel sürdürülebilirlik. |
| **Yakıt Seviyesi** | **10** | %30 altı *hard fail* (eleme). Üstü için ağırlık düşük çünkü yakıt seviyesi anlık çözülebilir bir değişken. |
| **Müsaitlik** | **10** | Günlük takvim doluluğu. Düşük ağırlık çünkü zaten "müsait olmayan araç" listede gözükmez. |

**Toplam 30+20+20+10+10+10 = 100** ve **30+20+15+15+10+10 = 100** olacak şekilde normalize edilmiştir; kullanıcı planlama ekranında her kriterin katkısını breakdown panelinden görebilir ve atama kararını gerekçeli olarak sorgulayabilir.

**Ağırlıklar nereden değiştirilir?** Şu an ağırlıklar `TechnicianScoringService` ve `VehicleScoringService` içinde sabittir. İleride yönetilebilir kural haline getirilmek istenirse Rule Engine `RULE_ACTION_TYPE` enum'una `ADJUST_SCORING_WEIGHT` eylemi eklenmesi yeterlidir.

---

## 22. SLA Sistemi
Servis taleplerinin aciliyetine göre SLA süreleri belirlenir (`SlaService`):
* `CRITICAL`: 4 Saat içinde çözüm.
* `URGENT`: 12 Saat içinde çözüm.
* `STANDARD`: 48 Saat içinde çözüm.
SLA süresine 2 saatten az kalan işler otomatik olarak `CRITICAL` seviyeye yükseltilerek alarmlar tetiklenir.

---

## 23. Rule Engine
`RuleEngineService` sistem genelinde 10 ana kuralı denetler. Kurallar aktif/pasif hale getirilebilir ve öncelik sırasına göre kural sandbox ekranında test edilebilir.

---

## 24. Rule Conflict Çözüm Stratejisi
Aynı eylem için çelişen iki kural tetiklendiğinde deterministik çözüm stratejisi çalışır:
1. **Priority Sıralaması**: Daha düşük priority numarası olan kural kazanır (Örn: `priority=1`, `priority=3`'ü ezer).
2. **Yaş Fallback'i**: Öncelikler eşitse, sisteme ilk kayıt edilen (`createdAt` tarihi eski olan) kural kazanır.
3. **Loglama**: Kaybeden kuralın ezilme nedeni Audit Log'a yazılır ve yöneticiye `RULE_CONFLICT` tipinde bildirim gönderilir.

### Neden Bu Strateji?
* **Determinizmin sebebi**: Aynı girdi-bağlam ikilisi için sistem her seferinde aynı sonucu vermek zorundadır; aksi halde teknisyen "neden bu sefer kabul edildi, geçen sefer reddedildi?" sorusunu sorar ve sisteme güven kaybolur.
* **Priority önce gelmesinin sebebi**: Yönetici, kuralın ne kadar bağlayıcı olduğunu manuel ayarlayabilmelidir. Bu en doğal "kazanan kim?" sinyalidir.
* **createdAt tiebreaker'ın sebebi**: Eski kural daha çok test edilmiştir, üretimde *known-good* sayılır; yeni eklenen kural deneme olabilir. Ayrıca eski tarih zamanla değişmediği için tiebreaker stabil kalır.
* **Random / Last-write-wins yapılmamasının sebebi**: Random çözüm aynı senaryoda farklı sonuç verir → audit izlenemez. Last-write-wins ise yeni eklenen test kuralının prod kuralını ezmesine yol açabilir.

### Çakışma Çözüm Örneği
**Senaryo**: 60.000 TL tahmini maliyetli bir iş emri planlanıyor.

| ID | Kural | Trigger | Aksiyon | Priority | createdAt |
|---|---|---|---|---|---|
| R-A | "50.000 TL üstü işlerde Şube Müdürü onayı gerekir" | `WORK_ORDER_PLAN` | `REQUIRE_APPROVAL` | **2** | 2026-01-10 |
| R-B | "Acil işler onaysız geçer" | `WORK_ORDER_PLAN` | `ALLOW` | **5** | 2026-03-12 |
| R-C | "Yüksek değerli işlerde dispatcher uyarılır" | `WORK_ORDER_PLAN` | `NOTIFY` | **2** | 2026-02-01 |

**Çözüm akışı (`resolveConflicts`)**:
1. Tüm tetiklenen kurallar `priority asc` sıralanır → R-A (2), R-C (2), R-B (5)
2. R-A ile R-C priority eşit → tiebreaker `createdAt asc` → **R-A kazanır** (2026-01-10 < 2026-02-01)
3. R-B kaybeder çünkü priority=5 > 2
4. R-C kaybeder çünkü daha yeni (2026-02-01 > 2026-01-10)
5. **Sonuç**: İş emri planlanamaz, Şube Müdürü onayı gerekir. R-B ve R-C için `RULE_CONFLICT` audit log yazılır + dispatcher'a bildirim düşer.

Kaybeden kuralların ezilme nedeni audit log'da şu formatta tutulur:
```
[RULE_CONFLICT] Rule R-B (priority=5) was overridden by R-A (priority=2). Tiebreaker: priority asc.
[RULE_CONFLICT] Rule R-C (priority=2) was overridden by R-A (priority=2). Tiebreaker: createdAt asc.
```

---

## 25. Notification Sistemi
Sistem olayları sonrası ilgili rol veya kullanıcılara bildirim düşer. Bildirimler okunmuş/okunmamış durumlarına göre süzülür, toplu okundu yapılabilir veya silinebilir.

---

## 26. Audit Log Sistemi
Tüm yazma ve yetkisiz erişim eylemleri loglanır. Değişikliklerde eski nesne (`oldValue`) ve yeni nesne (`newValue`) arasındaki farklar satır bazlı görsel diff modalı ile gösterilir. Audit logların silinmesi veya düzenlenmesi kesinlikle engellenmiştir.

---

## 27. Import / Export Sistemi
* **JSON/CSV Export**: Tüm koleksiyonlar indirilebilir.
* **Kısmi JSON Import**: Hatalı satırlar atlanır ve hata nedenleri (satır numarasıyla birlikte) raporlanarak indirme linki sunulur. Geçerli satırlar ise başarıyla veritabanına eklenir.

---

## 27.A Vardiya / Görev Atama Modülü (Bölüm 11)
Şartname Bölüm 11 kapsamında saha vardiya ve görev atama modülü `/shifts` rotasında sunulur.

* **Model**: `ShiftAssignment` — başlık, görev tipi (Periyodik Bakım / Çağrı Üzerine / Kurulum / Denetim / Eğitim / Diğer), şube + bölge, gerekli yetkinlik, kişi sayısı, başlangıç-bitiş tarihi-saati, öncelik, atanan teknisyenler.
* **Servis**: `ShiftAssignmentService.assignTechnician` aşağıdaki kuralları zincirleme uygular:
  1. Teknisyen aktif ve izinli olmamalı.
  2. Yetkinlik eşleşmeli; uyuşmazsa atama reddedilir + `SECURITY_VIOLATION` audit log.
  3. Şube veya bölge uyumu (esnek): aynı şube ya da aynı `region` etiketi.
  4. Aynı zaman aralığında başka iş emri veya vardiya çakışması yasak.
  5. Aynı kişi aynı vardiyaya iki kez atanamaz.
  6. Toplam atanan teknisyen sayısı `requiredHeadcount`'u aşamaz.
* **UI**: `/shifts` sayfasında oluşturma formu, vardiya listesi (DataTable filtre + sayfalama) ve "aday teknisyen" modali — her aday için "Uygun" ya da neden uygunsuz olduğunu gösteren etiket bulunur (`'BÖLGE DIŞI'`, `'YETKİNLİK YOK'`, `'ÇAKIŞMA'` vb.).
* **Bildirim**: Atanan teknisyene `TECHNICIAN_ASSIGNED` tipinde bildirim düşer.
* **Sidebar menü**: "İş Akışı" grubu altında **Vardiya / Görev Atama** öğesi (Depo Sorumlusu hariç tüm rollere açık).

---

## 28. Simulation Modülü
Test süreçleri için 8 senaryo tetiklenebilir:
1. Rastgele Müşteri/Talep üret.
2. Rastgele stok hareketi oluştur.
3. Rastgele araç arızası simüle et.
4. SLA gecikmesi oluştur (SLA tarihi geçmişe çekilir).
5. Teknisyen zaman çakışması yarat (Aynı saatte iki iş atanır).
6. 5.000+ kayıt üret (Performans testi).
7. Bozuk localStorage test verisi üret (Self-healing doğrulaması).
8. Kota testi için büyük veri simülasyonu çalıştır (`QuotaExceededError` doğrulaması).

---

## 29. Dashboard ve Raporlar
* **Dashboard**: Şube doluluk oranları, kritik stoklar, SLA yaklaşan işler ve şube performans karşılaştırmaları grafikler ve kartlarla sunulur.
* **Raporlar**: 8 farklı kategoride (şube bazlı dağılım, envanter, SLA gecikmeleri vb.) dinamik filtreler ve Chart.js grafikleriyle veri raporlaması sunulur.

---

## 30. Büyük Veri Performans Stratejisi
Büyük veri simülasyonunda DataTable'ın donmaması için şu önlemler alınmıştır:
* **TrackBy Kullanımı**: Dom render yükü minimuma indirilmiştir.
* **Sanal Sayfalama (Virtual Pagination)**: Yalnızca aktif sayfadaki 10/25 kayıt DOM'a basılır.
* **Global Search ve Filtreler**: Arama ve filtreleme işlemleri doğrudan bellek üzerinde süzülerek arayüzün akıcı kalması sağlanır.

---

## 31. Test Checklist

- [x] Yetkinliği uymayan teknisyen atanamaz.
- [x] Teknisyen çakışan iki zaman dilimine atanamaz.
- [x] Kullanılabilir stoğu aşan parça rezervasyonu reddedilir.
- [x] İş emri iptal edilince stok ve takvim eski haline döner.
- [x] Kısmi tamamlanmada yalnızca kullanılan parça düşer, kalan rezerve iade edilir.
- [x] Geçersiz durum geçişleri engellenir.
- [x] Kural çakışmaları deterministik çözülür.
- [x] Bozuk localStorage verisi uygulamayı çökertmez.
- [x] localStorage kota aşım hatası yakalanır.
- [x] 5.000+ kayıtlı DataTable donmadan çalışır.

---

## 32. Bilinen Eksikler / Sınırlar

Bu proje, **şartname gereği backend tarafsız ve yalnızca tarayıcı tabanlı** bir demo olarak geliştirilmiştir. Aşağıdaki sınırlamalar tasarım kararıdır, eksiklik değildir:

* **Gerçek eşzamanlı transaction yok.** Backend bulunmadığı için iki kullanıcının aynı anda aynı parçayı rezerve etme yarışı simüle edilmez; tüm validasyon optimistic olarak `ReservationService` içinde yapılır. Production senaryoda bu kontroller server-side transaction'a taşınmalıdır.
* **Gerçek harita / rota API'si yok.** Yakınlık puanı (`TechnicianScoringService.calculateProximityScore`, `VehicleScoringService.calculateProximityScore`) gerçek mesafe değil; `Branch.serviceAreas`, `Branch.city`, `Technician.region` alanlarına göre kademeli simülasyon yapar.
* **Gerçek authentication token / refresh akışı yok.** Login `AuthService` üzerinden seed kullanıcılarına eşleşme ile gerçekleşir; oturum bilgisi `AuthStateService` aracılığıyla `StorageService.getRaw`/`setRaw` üzerinden saklanır. Token süresi simüle edilmez.
* **Chart, rapor ve dashboard verileri** seed + simulation verileri üzerinden çalışır; ileriye dönük tahmin (forecasting) yapmaz.
* **Çevrimdışı (Offline) destek yoktur** — Service Worker entegrasyonu yapılmamıştır.
* **Audit log silinemez.** `StorageService` `AUDIT_LOGS` anahtarını "immutable key" olarak işaretler; `delete`, `updateCollection`, `clearKey` çağrıları hata fırlatır. Bu kasıtlıdır (denetim güvenliği gereği).
* **Permission bypass denemeleri** hem `permissionGuard` (route) hem her servis metodunun başındaki `assertPermission()` ile yakalanır; her başarısız deneme `SECURITY_VIOLATION` türünde audit log'a düşer.

## 33. Performans Notları
* `data-table` component'i 5.000+ kayıt için `trackBy`, sayfalama ve global arama ile birlikte gelir.
* Çok büyük listeler için `cdk-virtual-scroll` entegrasyonu opsiyonel olarak eklenebilir.
* Build hatasız; lazy chunk'lar `app.routes.ts` üzerinden bölünmüştür (her feature ayrı chunk).

---

## 33. Demo Video
Uygulamanın kullanım senaryolarını ve simülatör testlerini gösteren tanıtım videosu proje teslim dosyasında `demo_video.mp4` olarak yer almaktadır.

---

## 34. Ekran Görüntüleri
Saha Planlama Ekranı, Raporlama Paneli, Kural Sandbox'ı ve Transfer Merkezi ekran görüntüleri teslim klasöründeki `/screenshots` dizininden incelenebilir.
