import { Pipe, PipeTransform } from '@angular/core';
import { PRIORITY_LABELS } from '../../core/constants/labels.const';

@Pipe({ name: 'priorityLabel', standalone: true, pure: true })
export class PriorityLabelPipe implements PipeTransform {
  transform(priority: string | null | undefined): string {
    if (!priority) return '';
    return PRIORITY_LABELS[String(priority)] ?? String(priority);
  }
}
