import { describe, expect, it } from 'vitest';
import { nextCode } from './code.util';

describe('nextCode', () => {
  const year = new Date().getFullYear();

  it('kayıt sayısından sonraki numarayı verir', () => {
    expect(nextCode('WO', [`WO-${year}-0001`])).toBe(`WO-${year}-0002`);
  });

  it('silinen kayıttan sonra kullanılan koda çakışmaz', () => {
    expect(nextCode('TALEP', [`TALEP-${year}-0001`, `TALEP-${year}-0003`])).toBe(`TALEP-${year}-0004`);
  });
});
