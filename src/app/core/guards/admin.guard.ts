import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  if (permissionService.hasRole('SYSTEM_ADMIN')) {
    return true;
  }

  router.navigate(['/panel']);
  return false;
};
