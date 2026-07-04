import { Injectable, signal, computed, inject } from '@angular/core';
import { User } from '../models/user.model';
import { UserRole } from '../models/user-role.model';
import { StorageService } from '../storage/storage.service';

const CURRENT_USER_KEY = 'ts_current_user';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private storage = inject(StorageService);

  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => this.currentUser() !== null);
  currentRole = computed<UserRole | null>(() => this.currentUser()?.role || null);

  constructor() {
    this.restoreSession();
  }

  setCurrentUser(user: User | null): void {
    this.currentUser.set(user);
    if (user) {
      this.storage.setRaw(CURRENT_USER_KEY, this.encode(user));
    } else {
      // CURRENT_USER_KEY immutable değil, removeRaw çağrılabilir.
      try { this.storage.removeRaw(CURRENT_USER_KEY); } catch { /* ignore */ }
    }
  }

  private restoreSession(): void {
    const saved = this.storage.getRaw(CURRENT_USER_KEY);
    if (!saved) return;
    const user = this.decode(saved);
    if (user) this.currentUser.set(user);
    else this.storage.removeRaw(CURRENT_USER_KEY);
  }

  // Tek noktalı encode/decode — JSON.parse riski sadece bu küçük yüzeyde.
  private encode(user: User): string {
    try { return JSON.stringify(user); } catch { return ''; }
  }
  private decode(raw: string): User | null {
    try { return JSON.parse(raw) as User; } catch { return null; }
  }
}
