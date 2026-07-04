import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'categoryIcon',
  standalone: true
})
export class CategoryIconPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return 'help_outline';
    
    const cat = String(value).toUpperCase();
    switch (cat) {
      case 'COMPRESSOR':
      case 'HVAC':
        return 'ac_unit';
      case 'BOARD_ELECTRONIC':
      case 'ELECTRONICS_MOTHERBOARD':
        return 'developer_board';
      case 'MOTOR':
        return 'settings';
      case 'SENSOR':
        return 'sensors';
      case 'SEAL_GASKET':
        return 'adjust';
      case 'FILTER':
        return 'filter_alt';
      case 'CABLE_CONNECTION':
      case 'ELECTRIC':
        return 'bolt';
      case 'PLUMBING':
        return 'plumbing';
      case 'BOILER_HEATING':
        return 'thermostat';
      case 'CONSUMABLES':
        return 'cleaning_services';
      default:
        return 'construction';
    }
  }
}
