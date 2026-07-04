import { Pipe, PipeTransform } from '@angular/core';
import { TECHNICIAN_LEVEL_LABELS } from '../../core/constants/labels.const';

@Pipe({
  name: 'techLevelLabel',
  standalone: true,
  pure: true
})
export class TechLevelLabelPipe implements PipeTransform {
  transform(level: string | null | undefined): string {
    if (!level) return '';
    return TECHNICIAN_LEVEL_LABELS[level] || level;
  }
}
