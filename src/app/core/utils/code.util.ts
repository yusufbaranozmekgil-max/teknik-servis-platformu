/** Kayıt silinse bile çakışmayan sıradaki kodu üretir (örn. WO-2026-0031). */
export function nextCode(prefix: string, usedCodes: string[]): string {
  const used = new Set(usedCodes.map(code => code.toLowerCase()));
  const year = new Date().getFullYear();
  let sequence = usedCodes.length + 1;
  let code = `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  while (used.has(code.toLowerCase())) {
    sequence++;
    code = `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }
  return code;
}
