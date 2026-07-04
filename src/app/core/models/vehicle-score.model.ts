import { Vehicle } from './vehicle.model';
import { VehicleScoreBreakdown } from './score-breakdown.model';

export interface VehicleScore {
  vehicle: Vehicle;
  totalScore: number;
  breakdown: VehicleScoreBreakdown;
}
