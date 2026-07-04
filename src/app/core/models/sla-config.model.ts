import { ServicePriority } from './service-request.model';

export interface SLAConfig {
  priority: ServicePriority;
  resolutionTimeHours: number;
}
