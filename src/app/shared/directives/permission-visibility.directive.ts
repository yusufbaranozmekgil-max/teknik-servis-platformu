import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import { Permission } from '../../core/models/permission.model';
import { AuthStateService } from '../../core/auth/auth-state.service';

@Directive({
  selector: '[appPermissionVisibility]',
  standalone: true
})
export class PermissionVisibilityDirective {
  private permissionService = inject(PermissionService);
  private authState = inject(AuthStateService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private requiredPermission?: Permission;
  private hasView = false;

  @Input() set appPermissionVisibility(permission: Permission | undefined) {
    this.requiredPermission = permission;
    this.updateView();
  }

  constructor() {
    effect(() => {
      this.authState.currentUser();
      this.updateView();
    });
  }

  private updateView(): void {
    if (!this.requiredPermission) {
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
      return;
    }

    const isAllowed = this.permissionService.hasPermission(this.requiredPermission);

    if (isAllowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isAllowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
