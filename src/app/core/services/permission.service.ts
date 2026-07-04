import { Injectable, inject } from '@angular/core';
import { AuthStateService } from '../auth/auth-state.service';
import { Permission } from '../models/permission.model';
import { UserRole } from '../models/user-role.model';
import { ROLE_PERMISSION_MATRIX } from '../constants/role-permission-matrix.const';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private authState = inject(AuthStateService);
  private auditLog = inject(AuditLogService);
  private notification = inject(NotificationService);

  hasPermission(permission: Permission): boolean {
    const user = this.authState.currentUser();
    if (!user) return false;
    if (user.role === 'SYSTEM_ADMIN') return true;

    const permissions = ROLE_PERMISSION_MATRIX[user.role];
    return permissions ? permissions.includes(permission) : false;
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  hasRole(role: UserRole): boolean {
    return this.authState.currentRole() === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const role = this.authState.currentRole();
    return role ? roles.includes(role) : false;
  }

  assertPermission(permission: Permission): void {
    if (!this.hasPermission(permission)) {
      const user = this.authState.currentUser();
      const username = user ? user.username : 'GUEST';
      
      this.auditLog.logAction({
        actionType: 'SECURITY_VIOLATION',
        entityType: 'SYSTEM',
        entityId: user ? user.id : 'anonymous',
        oldValue: null,
        newValue: JSON.stringify({ attemptedPermission: permission }),
        description: `Kullanici (${username}) yetkisiz '${permission}' islemini yapmaya calisti.`
      });

      this.notification.createNotification({
        type: 'UNAUTHORIZED_ACTION',
        title: 'Yetkisiz Eylem Denemesi',
        message: `Kullanıcı (${username}) '${permission}' yetkisi gerektiren bir işlemi yapmaya çalıştı.`,
        branchId: user ? user.branchId : null,
        targetRole: 'SYSTEM_ADMIN',
        targetUserId: null,
        relatedEntityId: null
      });

      throw new Error(`Yetki Hatasi: Bu islemi yapmak icin '${permission}' yetkiniz bulunmamaktadir.`);
    }
  }

  getCurrentUserPermissions(): Permission[] {
    const role = this.authState.currentRole();
    if (!role) return [];
    return ROLE_PERMISSION_MATRIX[role] || [];
  }

  canAccessRoute(routeData: any): boolean {
    if (!routeData) return true;
    
    if (routeData.requiredPermission) {
      if (!this.hasPermission(routeData.requiredPermission)) {
        return false;
      }
    }

    if (routeData.allowedRoles) {
      if (!this.hasAnyRole(routeData.allowedRoles)) {
        return false;
      }
    }

    return true;
  }
}
