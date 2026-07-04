export interface ChartSeries {
  name: string;
  value: number;
}

export interface ChartData {
  name: string;
  value?: number;
  series?: ChartSeries[];
}
