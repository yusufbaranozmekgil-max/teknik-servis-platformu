import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../core/services/permission.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { Permission } from '../../core/models/permission.model';
import { UserRole } from '../../core/models/user-role.model';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { RoleLabelPipe } from '../../shared/pipes/role-label.pipe';

interface MenuItem {
  label: string;
  route: string;
  permission: Permission;
  /** Bu rollerde menü öğesi gizlenir (yetkisi olsa bile sidebar'da görünmez). */
  hideForRoles?: UserRole[];
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationBellComponent, RoleLabelPipe],
  template: `
    <div class="layout-container">
      <header class="app-header">
        <div class="header-left">
          <button class="sidebar-toggle" type="button" (click)="toggleSidebar()" [title]="collapsed() ? 'Menüyü aç' : 'Menüyü kapat'">
            {{ collapsed() ? '☰' : '✕' }}
          </button>
          <div class="logo">Saha Operasyon Yönetimi</div>
        </div>
        <div class="user-profile" *ngIf="authState.currentUser() as user">
          <button (click)="toggleDarkMode()" class="dark-mode-toggle" [title]="isDarkMode() ? 'Açık Tema' : 'Karanlık Tema'">
            {{ isDarkMode() ? '☀️' : '🌙' }}
          </button>
          <app-notification-bell></app-notification-bell>
          <span class="user-info">{{ user.fullName }} ({{ user.role | roleLabel }})</span>
          <button (click)="logout()" class="logout-btn">Çıkış Yap</button>
        </div>
      </header>
      <div class="layout-body">
        <!-- Mobile sidebar backdrop — tıklayınca menüyü kapat -->
        <div class="sidebar-backdrop"
             *ngIf="!collapsed() && isMobile()"
             (click)="toggleSidebar()"
             aria-hidden="true"></div>
        <aside class="sidebar" [class.collapsed]="collapsed()">
          <nav>
            <!-- Ana Panel (her zaman görünür, tek satır) -->
            <a routerLink="/panel" routerLinkActive="active-link" class="single-link" title="Ana Panel">
              <span class="label">Ana Panel</span>
            </a>

            <!-- Gruplar -->
            <ng-container *ngFor="let group of menuGroups">
              <div class="group" *ngIf="visibleItems(group).length > 0">
                <button class="group-header" type="button" (click)="toggle(group.id)" [title]="group.label">
                  <span class="group-left">
                    <span class="label">{{ group.label }}</span>
                  </span>
                  <span class="chevron" [class.open]="isOpen(group.id) || collapsed()">▾</span>
                </button>
                <ul class="group-items" [class.collapsed]="!isOpen(group.id) && !collapsed()">
                  <li *ngFor="let item of visibleItems(group)">
                    <a [routerLink]="item.route" routerLinkActive="active-link" [title]="item.label">
                      <span class="label">{{ item.label }}</span>
                    </a>
                  </li>
                </ul>
              </div>
            </ng-container>
          </nav>
        </aside>
        <main class="main-content">
          <div class="content-container">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  permissionService = inject(PermissionService);
  authState = inject(AuthStateService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private static readonly OPEN_STORAGE_KEY = 'ts_sidebar_open_groups';
  private static readonly COLLAPSED_STORAGE_KEY = 'ts_sidebar_collapsed';
  private static readonly MOBILE_BREAKPOINT = 768;
  openGroups = signal<Set<string>>(this.loadOpenState());
  // Mobile cihazlarda sidebar varsayılan olarak kapalı başlasın — content'i bloklamasın.
  collapsed = signal<boolean>(this.initialCollapsedState());
  isMobile = signal<boolean>(this.detectMobile());

  menuGroups: MenuGroup[] = [
    {
      id: 'operations',
      label: 'Operasyon',
      items: [
        // TECHNICIAN ve REPORTING_USER şube/teknisyen/araç listelerine erişmesin
        { label: 'Şubeler', route: '/subeler', permission: 'BRANCH_VIEW',
          hideForRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER', 'WAREHOUSE_MANAGER'] },
        { label: 'Teknisyenler', route: '/teknisyenler', permission: 'TECHNICIAN_VIEW',
          hideForRoles: ['TECHNICIAN', 'REPORTING_USER'] },
        { label: 'Araçlar', route: '/araclar', permission: 'VEHICLE_VIEW',
          hideForRoles: ['TECHNICIAN', 'REPORTING_USER', 'DISPATCHER'] },
      ]
    },
    {
      id: 'workflow',
      label: 'İş Akışı',
      items: [
        { label: 'Servis Talepleri', route: '/servis-talepleri', permission: 'SERVICE_REQUEST_VIEW',
          hideForRoles: ['TECHNICIAN'] },
        { label: 'İş Emirleri', route: '/is-emirleri', permission: 'WORK_ORDER_VIEW',
          hideForRoles: ['WAREHOUSE_MANAGER'] },
        { label: 'Planlama Tahtası', route: '/planlama', permission: 'WORK_ORDER_PLAN' },
        { label: 'Vardiya / Görev Atama', route: '/vardiyalar', permission: 'SHIFT_VIEW',
          hideForRoles: ['WAREHOUSE_MANAGER'] },
      ]
    },
    {
      id: 'inventory',
      label: 'Stok',
      items: [
        { label: 'Stok ve Parçalar', route: '/stok', permission: 'INVENTORY_VIEW' },
      ]
    },
    {
      id: 'automation',
      label: 'Kurallar & Otomasyon',
      items: [
        { label: 'Kural Motoru', route: '/kurallar', permission: 'RULE_VIEW',
          hideForRoles: ['TECHNICIAN'] },
        { label: 'Simülasyon', route: '/simulasyon', permission: 'SIMULATION_RUN' },
      ]
    },
    {
      id: 'communication',
      label: 'İletişim',
      items: [
        { label: 'Bildirimler', route: '/bildirimler', permission: 'NOTIFICATION_VIEW' },
      ]
    },
    {
      id: 'reporting',
      label: 'Raporlar & Yönetim',
      items: [
        { label: 'Raporlar', route: '/raporlar', permission: 'REPORT_VIEW' },
        { label: 'Denetim Kayıtları', route: '/denetim-kayitlari', permission: 'AUDIT_LOG_VIEW' },
      ]
    }
  ];

  visibleItems(group: MenuGroup): MenuItem[] {
    const role = this.authState.currentRole();
    return group.items.filter(i => {
      if (!this.permissionService.hasPermission(i.permission)) return false;
      if (role && i.hideForRoles && i.hideForRoles.includes(role)) return false;
      return true;
    });
  }

  isOpen(groupId: string): boolean {
    return this.openGroups().has(groupId);
  }

  toggle(groupId: string): void {
    // Sidebar daraltılmışken grup başlığına tıklayınca önce sidebar'ı aç
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.persistCollapsedState(false);
    }
    const next = new Set(this.openGroups());
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    this.openGroups.set(next);
    this.persistOpenState(next);
  }

  toggleSidebar(): void {
    const newVal = !this.collapsed();
    this.collapsed.set(newVal);
    this.persistCollapsedState(newVal);
  }

  logout(): void {
    this.authService.logout();
  }

  isDarkMode = signal<boolean>(false);

  ngOnInit(): void {
    const saved = localStorage.getItem('ts_dark_mode') === '1';
    this.isDarkMode.set(saved);
    this.applyTheme(saved);

    // Mobilde sayfa değişince sidebar'ı otomatik kapat (UX: link'e tıklayıp ekranı geri görsün)
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile() && !this.collapsed()) {
          this.collapsed.set(true);
        }
      });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const nowMobile = this.detectMobile();
    if (nowMobile !== this.isMobile()) {
      this.isMobile.set(nowMobile);
      // Mobile'a geçince sidebar'ı varsayılan kapalı, masaüstüne dönünce kayıtlı state'i geri yükle.
      if (nowMobile) {
        this.collapsed.set(true);
      } else {
        this.collapsed.set(this.loadCollapsedState());
      }
    }
  }

  private detectMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MainLayoutComponent.MOBILE_BREAKPOINT;
  }

  private initialCollapsedState(): boolean {
    // Mobile cihazlarda her zaman kapalı başla; masaüstünde kullanıcı tercihini koru.
    if (this.detectMobile()) return true;
    return this.loadCollapsedState();
  }

  toggleDarkMode(): void {
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);
    localStorage.setItem('ts_dark_mode', next ? '1' : '0');
    this.applyTheme(next);
  }

  private applyTheme(dark: boolean): void {
    if (dark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  private loadCollapsedState(): boolean {
    try {
      return localStorage.getItem(MainLayoutComponent.COLLAPSED_STORAGE_KEY) === '1';
    } catch { return false; }
  }
  private persistCollapsedState(val: boolean): void {
    try { localStorage.setItem(MainLayoutComponent.COLLAPSED_STORAGE_KEY, val ? '1' : '0'); } catch { /* ignore */ }
  }

  private loadOpenState(): Set<string> {
    try {
      const raw = localStorage.getItem(MainLayoutComponent.OPEN_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch { /* ignore */ }
    // Varsayılan: tüm gruplar açık başlasın
    return new Set(['operations', 'workflow', 'inventory', 'automation', 'communication', 'reporting']);
  }

  private persistOpenState(set: Set<string>): void {
    try {
      localStorage.setItem(MainLayoutComponent.OPEN_STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch { /* ignore */ }
  }
}
