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
      case 'JUNIOR':   // Çırak
        return 'badge-blue';
      case 'MID':      // Kalfa
        return 'badge-green';
      case 'SENIOR':   // Usta
        return 'badge-orange';
      default:
        return 'badge-grey';
    }
  }
}
