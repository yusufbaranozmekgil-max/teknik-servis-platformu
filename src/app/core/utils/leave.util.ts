import { Technician } from '../models/technician.model';
import { TimeSlot } from '../models/time-slot.model';

/** İzin yalnız seçilen zamanla kesişiyorsa engel olur; tarihsiz izin her zaman engeldir. */
export function isOnLeaveDuring(tech: Technician, slot: TimeSlot): boolean {
  if (!tech.isOnLeave) return false;
  if (!tech.leaveStart || !tech.leaveEnd) return true;
  return new Date(slot.start).getTime() < new Date(tech.leaveEnd).getTime()
    && new Date(tech.leaveStart).getTime() < new Date(slot.end).getTime();
}
