import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { Notification, NotificationType, NotificationSeverity } from '../models/notification.model';
import { UserRole } from '../models/user-role.model';
import { AuthStateService } from '../auth/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private storage = inject(StorageService);
  private authState = inject(AuthStateService);

  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);

  constructor() {
    this.loadNotifications();
  }

  loadNotifications(): void {
    const list = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    this.notifications.set(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    this.updateUnreadCount();
  }

  getNotificationsForCurrentUser(): Notification[] {
    const user = this.authState.currentUser();
    if (!user) return [];
    return this.notifications().filter(n => {
      if (n.targetUserId === user.id) return true;
      if (n.targetRole === user.role) return true;
      if (!n.targetUserId && !n.targetRole) return true;
      return false;
    });
  }

  getUnreadCount(): number {
    return this.getNotificationsForCurrentUser().filter(n => !n.isRead).length;
  }

  updateUnreadCount(): void {
    this.unreadCount.set(this.getUnreadCount());
  }

  createNotification(notif: Omit<Notification, 'id' | 'isRead' | 'createdAt'>): void {
    const list = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const newNotif: Notification = {
      ...notif,
      severity: notif.severity || 'INFO',
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    list.push(newNotif);
    this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, list);
    this.loadNotifications();
    console.log(`[Notification] ${newNotif.title}: ${newNotif.message}`);
  }

  createForRole(
    role: UserRole,
    type: NotificationType,
    title: string,
    message: string,
    severity: NotificationSeverity,
    relatedEntity?: { type: any; id: string; link: string }
  ): void {
    this.createNotification({
      type,
      title,
      message,
      severity,
      targetRole: role,
      targetUserId: null,
      relatedEntityType: relatedEntity ? relatedEntity.type : null,
      relatedEntityId: relatedEntity ? relatedEntity.id : null,
      link: relatedEntity ? relatedEntity.link : null
    });
  }

  createForUser(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    severity: NotificationSeverity,
    relatedEntity?: { type: any; id: string; link: string }
  ): void {
    this.createNotification({
      type,
      title,
      message,
      severity,
      targetRole: null,
      targetUserId: userId,
      relatedEntityType: relatedEntity ? relatedEntity.type : null,
      relatedEntityId: relatedEntity ? relatedEntity.id : null,
      link: relatedEntity ? relatedEntity.link : null
    });
  }

  markAsRead(id: string): void {
    const list = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list[idx].isRead = true;
      this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, list);
      this.loadNotifications();
    }
  }

  markAllAsRead(): void {
    const user = this.authState.currentUser();
    if (!user) return;
    const list = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    list.forEach(n => {
      if (n.targetUserId === user.id || n.targetRole === user.role || (!n.targetUserId && !n.targetRole)) {
        n.isRead = true;
      }
    });
    this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, list);
    this.loadNotifications();
  }

  deleteNotification(id: string): void {
    const list = this.storage.getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const filtered = list.filter(n => n.id !== id);
    this.storage.setCollection(STORAGE_KEYS.NOTIFICATIONS, filtered);
    this.loadNotifications();
  }
}
