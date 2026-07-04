import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { AuthStateService } from './auth-state.service';
import { User } from '../models/user.model';
import { AuditLogService } from '../services/audit-log.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storage = inject(StorageService);
  private authState = inject(AuthStateService);
  private auditLog = inject(AuditLogService);
  private router = inject(Router);

  login(email: string, pass: string): boolean {
    if (pass !== '123456') {
      return false;
    }

    const users = this.storage.getCollection<User>(STORAGE_KEYS.USERS);
    const matched = users.find(u => u.email === email && u.isActive);

    if (matched) {
      this.authState.setCurrentUser(matched);
      
      this.auditLog.logAction({
        actionType: 'SYSTEM_EVENT',
        entityType: 'SYSTEM',
        entityId: matched.id,
        oldValue: null,
        newValue: JSON.stringify({ username: matched.username, role: matched.role }),
        description: `Kullanici (${matched.username}) basariyla giris yapti.`
      });

      return true;
    }

    return false;
  }

  logout(): void {
    const user = this.authState.currentUser();
    if (user) {
      this.auditLog.logAction({
        actionType: 'SYSTEM_EVENT',
        entityType: 'SYSTEM',
        entityId: user.id,
        oldValue: JSON.stringify({ username: user.username, role: user.role }),
        newValue: null,
        description: `Kullanici (${user.username}) oturumu kapatti.`
      });
    }

    this.authState.setCurrentUser(null);
    this.router.navigate(['/giris']);
  }

  createUser(user: Omit<User, 'id'>): User {
    const users = this.storage.getCollection<User>(STORAGE_KEYS.USERS);
    if (users.some(u => u.email.toLowerCase() === user.email.toLowerCase())) {
      throw new Error('Bu e-posta zaten kullanılıyor.');
    }
    const newUser = { ...user, id: `user-${Date.now()}` };
    this.storage.create<User>(STORAGE_KEYS.USERS, newUser);
    return newUser;
  }

  updateUser(id: string, user: Partial<User>): User {
    if (user.email) {
      const users = this.storage.getCollection<User>(STORAGE_KEYS.USERS);
      if (users.some(u => u.email.toLowerCase() === user.email!.toLowerCase() && u.id !== id)) {
        throw new Error('Bu e-posta zaten kullanılıyor.');
      }
    }
    return this.storage.update<User>(STORAGE_KEYS.USERS, id, user);
  }
}
