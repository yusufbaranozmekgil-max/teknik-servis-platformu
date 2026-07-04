export interface ReportFilter {
  startDate: string | null; // ISO
  endDate: string | null;   // ISO
  branchId: string | null;
  technicianId: string | null;
  priority: string | null;
  status: string | null;
}
