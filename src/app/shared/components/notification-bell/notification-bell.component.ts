import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification.model';

@Component({
    selector: 'app-notification-bell',
    imports: [CommonModule],
    template: `
    <div class="bell-container">
      <!-- Bell Icon and Badge -->
      <button class="bell-button" (click)="toggleDropdown($event)" title="Bildirimler">
        <svg class="bell-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/>
          <path d="M10.3 20a2 2 0 0 0 3.4 0"/>
        </svg>
        @if (unreadCount() > 0) {
          <span class="unread-badge">{{ unreadCount() }}</span>
        }
      </button>
    
      <!-- Dropdown Menu -->
      @if (isOpen) {
        <div class="dropdown-menu" (click)="$event.stopPropagation()">
          <div class="dropdown-header">
            <span>Bildirimler</span>
            <button class="mark-all-btn" (click)="markAllAsRead()">Tümünü Okundu Say</button>
          </div>
          <div class="dropdown-body">
            @for (n of userNotifications; track n) {
              <div
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
            }
            @if (userNotifications.length === 0) {
              <div class="no-notifications">
                Yeni bildirim bulunmuyor.
              </div>
            }
          </div>
          <div class="dropdown-footer">
            <button (click)="goToNotificationsCenter()">Tüm Bildirimleri Gör</button>
          </div>
        </div>
      }
    </div>
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
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
