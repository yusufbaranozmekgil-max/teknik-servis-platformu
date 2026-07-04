import { Technician } from './technician.model';
import { ScoreBreakdown } from './score-breakdown.model';

export interface TechnicianScore {
  technician: Technician;
  totalScore: number;
  breakdown: ScoreBreakdown;
}
