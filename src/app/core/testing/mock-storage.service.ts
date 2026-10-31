/** Testler için bellek içi StorageService; localStorage'a dokunmaz. */
export class MockStorageService {
  private store: Record<string, any[]> = {};

  getCollection<T>(key: string): T[] {
    return this.store[key] || [];
  }

  setCollection<T>(key: string, data: T[]): boolean {
    this.store[key] = JSON.parse(JSON.stringify(data));
    return true;
  }

  getById<T extends { id: string }>(key: string, id: string): T | null {
    return this.getCollection<T>(key).find(item => item.id === id) || null;
  }

  create<T extends { id: string }>(key: string, item: T): T {
    this.setCollection(key, [...this.getCollection<T>(key), item]);
    return item;
  }

  delete(key: string, id: string): boolean {
    const list = this.getCollection<{ id: string }>(key);
    this.setCollection(key, list.filter(item => item.id !== id));
    return list.some(item => item.id === id);
  }

  update<T extends { id: string }>(key: string, id: string, item: Partial<T>): T {
    const list = this.getCollection<T>(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Not found');
    list[idx] = { ...list[idx], ...item };
    this.setCollection(key, list);
    return list[idx];
  }
}
