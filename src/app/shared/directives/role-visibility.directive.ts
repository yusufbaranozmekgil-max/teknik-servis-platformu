import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { UserRole } from '../../core/models/user-role.model';

@Directive({
  selector: '[appRoleVisibility]',
  standalone: true
})
export class RoleVisibilityDirective {
  private authState = inject(AuthStateService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private allowedRoles: UserRole[] = [];
  private hasView = false;

  @Input() set appRoleVisibility(roles: UserRole[] | UserRole) {
    this.allowedRoles = Array.isArray(roles) ? roles : [roles];
    this.updateView();
  }

  constructor() {
    // Keep template state in sync when user authentication state changes
    effect(() => {
      this.authState.currentUser();
      this.updateView();
    });
  }

  private updateView(): void {
    const role = this.authState.currentRole();
    const isAllowed = role ? this.allowedRoles.includes(role) : false;

    if (isAllowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isAllowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
