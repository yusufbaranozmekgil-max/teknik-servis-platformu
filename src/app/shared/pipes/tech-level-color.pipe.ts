import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'techLevelColor',
  standalone: true
})
export class TechLevelColorPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return 'badge-grey';
    
    const lvl = String(value).toUpperCase();
    switch (lvl) {
      case 'JUNIOR':
        return 'badge-blue';
      case 'MID':
        return 'badge-green';
      case 'SENIOR':
        return 'badge-orange';
      case 'EXPERT':
        return 'badge-critical';
      default:
        return 'badge-grey';
    }
  }
}
