export const CURRENT_SCHEMA_VERSION = '1.0.0';

export function validateSchema(key: string, data: any[]): boolean {
  if (!Array.isArray(data)) return false;
  
  return data.every(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.id || typeof item.id !== 'string') return false;
    
    switch(key) {
      case 'ts_users':
        return typeof item.username === 'string' && typeof item.role === 'string';
      case 'ts_branches':
        return typeof item.code === 'string' && typeof item.name === 'string';
      case 'ts_technicians':
        return typeof item.fullName === 'string' && typeof item.branchId === 'string';
      case 'ts_spare_parts':
        return typeof item.code === 'string' && typeof item.stockQuantity === 'number';
      case 'ts_vehicles':
        return typeof item.plateNumber === 'string' && typeof item.status === 'string';
      case 'ts_work_orders':
        return typeof item.code === 'string' && typeof item.status === 'string';
      case 'ts_service_requests':
        return typeof item.code === 'string' && typeof item.status === 'string';
      case 'ts_shift_assignments':
        return typeof item.code === 'string' && typeof item.title === 'string' &&
               typeof item.start === 'string' && typeof item.end === 'string' &&
               Array.isArray(item.assignedTechnicianIds);
      default:
        return true;
    }
  });
}
