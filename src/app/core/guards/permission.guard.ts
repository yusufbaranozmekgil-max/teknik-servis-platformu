import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { AuthStateService } from '../auth/auth-state.service';
import { AuditLogService } from '../services/audit-log.service';
import { UserRole } from '../models/user-role.model';

/**
 * Rota erişim koruyucusu.
 *  - `requiredPermission`: rol izin matrisinde bu izin yoksa erişim reddedilir.
 *  - `blockedRoles`: izin olsa bile bu rollerin rotaya URL ile girmesi engellenir
 *    (sidebar'da gizlenen sayfalar guard seviyesinde de kilitlenir — "sadece menü gizleme" yeterli değildir).
 * Her reddedilen deneme SECURITY_VIOLATION olarak denetim günlüğüne yazılır.
 */
export const permissionGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const authState = inject(AuthStateService);
  const auditLog = inject(AuditLogService);
  const router = inject(Router);

  const requiredPermission = route.data['requiredPermission'];
  const blockedRoles: UserRole[] = route.data['blockedRoles'] || [];
  const currentRole = authState.currentRole();
  const user = authState.currentUser();

  const deny = (reason: string): boolean => {
    auditLog.logAction({
      actionType: 'SECURITY_VIOLATION',
      entityType: 'SYSTEM',
      entityId: user ? user.id : 'anonymous',
      oldValue: null,
      newValue: JSON.stringify({ attemptedUrl: state.url, requiredPermission: requiredPermission || null }),
      description: `Kullanıcı (${user ? user.username : 'MİSAFİR'}) yetkisiz rotaya URL ile erişmeye çalıştı: ${state.url}. Neden: ${reason}`,
      result: 'FAILURE',
      failureReason: reason
    });
    router.navigate(['/panel']);
    return false;
  };

  if (currentRole && blockedRoles.includes(currentRole)) {
    return deny('Bu rol için rota erişimi kapalıdır.');
  }

  if (requiredPermission && !permissionService.hasPermission(requiredPermission)) {
    return deny(`'${requiredPermission}' yetkisi bulunmuyor.`);
  }

  return true;
};
