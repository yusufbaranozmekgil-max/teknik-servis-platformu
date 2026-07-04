import { Pipe, PipeTransform } from '@angular/core';
import { ROLE_LABELS } from '../../core/constants/labels.const';
import { UserRole } from '../../core/models/user-role.model';

@Pipe({ name: 'roleLabel', standalone: true, pure: true })
export class RoleLabelPipe implements PipeTransform {
  transform(role: UserRole | string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABELS[role as UserRole] ?? String(role);
  }
}
