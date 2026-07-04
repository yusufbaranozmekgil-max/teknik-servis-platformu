import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const reportingGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  if (permissionService.hasAnyRole(['SYSTEM_ADMIN', 'OPERATION_MANAGER', 'BRANCH_MANAGER', 'DISPATCHER', 'REPORTING_USER'])) {
    return true;
  }

  router.navigate(['/panel']);
  return false;
};
