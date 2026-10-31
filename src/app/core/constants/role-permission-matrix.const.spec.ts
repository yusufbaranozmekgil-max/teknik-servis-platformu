import { ROLE_PERMISSION_MATRIX } from './role-permission-matrix.const';

describe('ROLE_PERMISSION_MATRIX', () => {
  it('planlama yapabilen her rol iş emri de oluşturabilir', () => {
    Object.entries(ROLE_PERMISSION_MATRIX).forEach(([role, permissions]) => {
      const list = permissions as string[];
      if (list.includes('WORK_ORDER_PLAN')) {
        expect(list).withContext(role).toContain('WORK_ORDER_CREATE');
      }
    });
  });
});
