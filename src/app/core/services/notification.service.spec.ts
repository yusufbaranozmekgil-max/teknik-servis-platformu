import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { AuthStateService } from '../auth/auth-state.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { MockStorageService } from '../testing/mock-storage.service';

describe('NotificationService.createForTechnician', () => {
  it('bildirimi teknisyene bağlı kullanıcıya gönderir', () => {
    const storage = new MockStorageService();
    const user = { id: 'user-tech', role: 'TECHNICIAN', branchId: 'branch-1', technicianId: 'tech-1' };
    storage.setCollection(STORAGE_KEYS.USERS, [user]);
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: StorageService, useValue: storage },
        { provide: AuthStateService, useValue: { currentUser: () => user, currentRole: () => user.role } }
      ]
    });
    const service = TestBed.inject(NotificationService);

    service.createForTechnician('tech-1', 'TECHNICIAN_ASSIGNED' as any, 'Yeni iş', 'Mesaj', 'INFO' as any);

    expect(service.getNotificationsForCurrentUser().map(n => n.title)).toContain('Yeni iş');
  });

  it('hesabı olmayan teknisyen için bildirim üretmez', () => {
    const storage = new MockStorageService();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: StorageService, useValue: storage },
        { provide: AuthStateService, useValue: { currentUser: () => null, currentRole: () => null } }
      ]
    });
    TestBed.inject(NotificationService).createForTechnician('tech-9', 'TECHNICIAN_ASSIGNED' as any, 'Yeni iş', 'Mesaj', 'INFO' as any);
    expect(storage.getCollection(STORAGE_KEYS.NOTIFICATIONS)).toEqual([]);
  });
});
