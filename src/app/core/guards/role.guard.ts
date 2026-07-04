import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const allowedRoles = route.data['allowedRoles'];
  if (!allowedRoles || permissionService.hasAnyRole(allowedRoles)) {
    return true;
  }

  router.navigate(['/panel']);
  return false;
};
