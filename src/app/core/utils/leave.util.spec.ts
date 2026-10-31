import { isOnLeaveDuring } from './leave.util';
import { Technician } from '../models/technician.model';

describe('isOnLeaveDuring', () => {
  const slot = { start: '2026-11-02T09:00:00', end: '2026-11-02T11:00:00' };
  const tech = (extra: Partial<Technician>) => ({ isOnLeave: true, ...extra } as Technician);

  it('izinli işaretli değilse engel yoktur', () => {
    expect(isOnLeaveDuring(tech({ isOnLeave: false }), slot)).toBeFalse();
  });

  it('kesişen izin engeldir', () => {
    expect(isOnLeaveDuring(tech({ leaveStart: '2026-11-01T00:00:00', leaveEnd: '2026-11-03T00:00:00' }), slot)).toBeTrue();
  });

  it('ileri tarihli izin bugünkü işi engellemez', () => {
    expect(isOnLeaveDuring(tech({ leaveStart: '2026-12-01T00:00:00', leaveEnd: '2026-12-05T00:00:00' }), slot)).toBeFalse();
  });

  it('tarihsiz izin engeldir', () => {
    expect(isOnLeaveDuring(tech({ leaveStart: null, leaveEnd: null } as Partial<Technician>), slot)).toBeTrue();
  });
});
