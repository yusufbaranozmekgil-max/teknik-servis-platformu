export interface DashboardMetric {
  title: string;
  value: string | number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  icon?: string;
}
