import { Technician } from './technician.model';
import { Vehicle } from './vehicle.model';

export interface ScoreBreakdown {
  skillsScore: number;
  proximityScore: number;
  availabilityScore: number;
  workloadScore: number;
  performanceScore: number;
  slaUrgencyScore: number;
}

export interface TechnicianScore {
  technician: Technician;
  totalScore: number;
  breakdown: ScoreBreakdown;
}

export interface VehicleScoreBreakdown {
  equipmentScore: number;
  capacityScore: number;
  proximityScore: number;
  maintenanceScore: number;
  fuelScore: number;
  availabilityScore: number;
}

export interface VehicleScore {
  vehicle: Vehicle;
  totalScore: number;
  breakdown: VehicleScoreBreakdown;
}
