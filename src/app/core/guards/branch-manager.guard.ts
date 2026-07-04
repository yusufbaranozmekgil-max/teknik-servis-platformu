import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const branchManagerGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  if (permissionService.hasAnyRole(['SYSTEM_ADMIN', 'OPERATION_MANAGER', 'BRANCH_MANAGER'])) {
    return true;
  }

  router.navigate(['/panel']);
  return false;
};
