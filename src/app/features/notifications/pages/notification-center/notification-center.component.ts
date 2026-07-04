import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { Notification } from '../../../../core/models/notification.model';
import { StatusLabelPipe } from '../../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h2>Bildirim Merkezi</h2>
        <p class="subtitle">Platform genelindeki önemli gelişmeleri, atamaları, stok alarmlarını ve SLA uyarılarını takip edin.</p>
      </div>

      <!-- İşlem Çubuğu -->
      <div class="action-bar card">
        <div class="left-actions">
          <button (click)="markAllAsRead()" class="btn btn-secondary">Tümünü Okundu İşaretle</button>
        </div>
        <div class="right-actions">
          <label>Filtrele</label>
          <select [value]="filterOption" (change)="filterOption = $any($event.target).value; applyFilter()" class="form-control">
            <option value="all">Tüm Bildirimler</option>
            <option value="unread">Okunmamışlar</option>
            <option value="read">Okunmuşlar</option>
          </select>
        </div>
      </div>

      <!-- Bildirim Listesi -->
      <div class="notifications-list">
        <div 
          *ngFor="let n of filteredNotifications" 
          class="notification-card card" 
          [class.unread]="!n.isRead"
          [class.info]="n.severity === 'INFO'"
          [class.warning]="n.severity === 'WARNING'"
          [class.error]="n.severity === 'ERROR'"
        >
          <div class="card-indicator"></div>
          <div class="card-content">
            <div class="card-header">
              <span class="badge severity-badge">{{ n.severity | statusLabel:'severity' }}</span>
              <span class="badge type-badge">{{ n.type | statusLabel:'notification' }}</span>
              <span class="date-text">{{ n.createdAt | date:'dd.MM.yyyy HH:mm:ss' }}</span>
            </div>
            <h3 class="notif-title">{{ n.title }}</h3>
            <p class="notif-message">{{ n.message }}</p>
            
            <div class="card-actions">
              <button *ngIf="n.link" (click)="openDetail(n)" class="btn btn-primary btn-sm">Detaya Git</button>
              <button *ngIf="!n.isRead" (click)="markAsRead(n.id)" class="btn btn-secondary btn-sm">Okundu İşaretle</button>
              <button (click)="deleteNotif(n.id)" class="btn btn-danger btn-sm">Sil</button>
            </div>
          </div>
        </div>

        <div class="no-notifications card" *ngIf="filteredNotifications.length === 0">
          <p>Herhangi bir bildirim bulunmuyor.</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./notification-center.component.scss']
})
export class NotificationCenterComponent implements OnInit {
  private notifService = inject(NotificationService);
  private router = inject(Router);
  private confirmService = inject(ConfirmService);

  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  filterOption = 'all';

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.notifications = this.notifService.getNotificationsForCurrentUser();
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.filterOption === 'unread') {
      this.filteredNotifications = this.notifications.filter(n => !n.isRead);
    } else if (this.filterOption === 'read') {
      this.filteredNotifications = this.notifications.filter(n => n.isRead);
    } else {
      this.filteredNotifications = [...this.notifications];
    }
  }

  markAllAsRead(): void {
    this.notifService.markAllAsRead();
    this.loadNotifications();
  }

  markAsRead(id: string): void {
    this.notifService.markAsRead(id);
    this.loadNotifications();
  }

  async deleteNotif(id: string): Promise<void> {
    const ok = await this.confirmService.confirm(
      'Bildirim Sil',
      'Bu bildirimi silmek istediğinize emin misiniz?'
    );
    if (ok) {
      this.notifService.deleteNotification(id);
      this.loadNotifications();
    }
  }

  navigate(link: string): void {
    this.router.navigateByUrl(link);
  }

  /** "Detaya Git" — bildirim otomatik okundu işaretlenir, sonra ilgili sayfaya gidilir. */
  openDetail(n: { id: string; link?: string | null; isRead: boolean }): void {
    if (!n.isRead) {
      this.notifService.markAsRead(n.id);
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }
}
