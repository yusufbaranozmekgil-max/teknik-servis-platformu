export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  district: string;
  serviceAreas: string[]; // Hizmet verdiği bölgeler
  contactPerson: string; // Sorumlu kişi
  latitude: number;
  longitude: number;
  dailyCapacity: number;
  workingHoursStart: string; // e.g., "08:00"
  workingHoursEnd: string; // e.g., "18:00"
  isActive: boolean;
  createdAt: string;
}
