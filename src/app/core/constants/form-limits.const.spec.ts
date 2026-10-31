import { toLocalDateISO, todayISO } from './form-limits.const';

describe('tarih yardımcıları', () => {
  afterEach(() => jasmine.clock().uninstall());

  it('gece yarısından hemen sonra yerel günü verir', () => {
    expect(toLocalDateISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });

  it('ay ve günü iki haneli yazar', () => {
    expect(toLocalDateISO(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05');
  });

  it('todayISO yerel takvim gününü kullanır', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 2, 0, 15));
    expect(todayISO()).toBe('2026-11-02');
  });
});
