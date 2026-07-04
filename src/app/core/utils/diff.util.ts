// Audit log için old/new değer karşılaştırması.
// Audit log oldValue/newValue alanları JSON string olarak saklanır; bu utility merkezi olarak
// parse + diff sorumluluğunu taşır, böylece servisler JSON.parse çağırmak zorunda kalmaz.

export interface DiffEntry {
  key: string;
  old: unknown;
  new: unknown;
}

const EXCLUDED_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

function safeParse(value: string | null | undefined): unknown {
  if (value === null || value === undefined || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function computeDiff(oldRaw: string | null, newRaw: string | null): DiffEntry[] {
  if (!oldRaw && !newRaw) return [];
  const oldObj = safeParse(oldRaw);
  const newObj = safeParse(newRaw);

  if (!isPlainObject(oldObj) && !isPlainObject(newObj)) {
    if (oldObj === newObj) return [];
    return [{ key: 'Değer', old: oldObj, new: newObj }];
  }

  const o = isPlainObject(oldObj) ? oldObj : {};
  const n = isPlainObject(newObj) ? newObj : {};
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
  const diffs: DiffEntry[] = [];

  for (const key of keys) {
    if (EXCLUDED_KEYS.has(key)) continue;
    const oVal = o[key];
    const nVal = n[key];
    if (!shallowEqual(oVal, nVal)) {
      diffs.push({ key, old: oVal, new: nVal });
    }
  }
  return diffs;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function prettyJson(value: string | null | undefined): string {
  const parsed = safeParse(value ?? null);
  if (parsed === null || parsed === undefined) return '{}';
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(value ?? '');
  }
}
