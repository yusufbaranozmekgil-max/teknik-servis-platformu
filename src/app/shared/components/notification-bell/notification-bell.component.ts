import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bell-container">
      <!-- Bell Icon and Badge -->
      <button class="bell-button" (click)="toggleDropdown($event)" title="Bildirimler">
        <span class="bell-emoji">🔔</span>
        <span class="unread-badge" *ngIf="unreadCount() > 0">{{ unreadCount() }}</span>
      </button>

      <!-- Dropdown Menu -->
      <div class="dropdown-menu" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <div class="dropdown-header">
          <span>Bildirimler</span>
          <button class="mark-all-btn" (click)="markAllAsRead()">Tümünü Okundu Say</button>
        </div>

        <div class="dropdown-body">
          <div 
            *ngFor="let n of userNotifications" 
            class="notification-item" 
            [class.unread]="!n.isRead"
            [class.info]="n.severity === 'INFO'"
            [class.warning]="n.severity === 'WARNING'"
            [class.error]="n.severity === 'ERROR'"
            (click)="onNotificationClick(n)"
          >
            <div class="item-header">
              <span class="severity-dot"></span>
              <span class="item-title">{{ n.title }}</span>
              <span class="item-time">{{ n.createdAt | date:'HH:mm' }}</span>
            </div>
            <div class="item-message">{{ n.message }}</div>
          </div>
          <div class="no-notifications" *ngIf="userNotifications.length === 0">
            Yeni bildirim bulunmuyor.
          </div>
        </div>

        <div class="dropdown-footer">
          <button (click)="goToNotificationsCenter()">Tüm Bildirimleri Gör</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./notification-bell.component.scss']
})
export class NotificationBellComponent implements OnInit {
  private notifService = inject(NotificationService);
  private router = inject(Router);

  isOpen = false;
  unreadCount = this.notifService.unreadCount;
  userNotifications: Notification[] = [];

  ngOnInit(): void {
    this.loadUserNotifications();
    
    // Auto-close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.isOpen = false;
    });
  }

  loadUserNotifications(): void {
    this.userNotifications = this.notifService.getNotificationsForCurrentUser().slice(0, 10); // show top 10
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.notifService.loadNotifications();
      this.loadUserNotifications();
    }
  }

  markAllAsRead(): void {
    this.notifService.markAllAsRead();
    this.loadUserNotifications();
  }

  onNotificationClick(notif: Notification): void {
    this.notifService.markAsRead(notif.id);
    this.isOpen = false;
    this.loadUserNotifications();
    
    if (notif.link) {
      this.router.navigateByUrl(notif.link);
    }
  }

  goToNotificationsCenter(): void {
    this.isOpen = false;
    this.router.navigate(['/bildirimler']);
  }
}
