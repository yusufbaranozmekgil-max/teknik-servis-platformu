export interface ValidationError {
  row: number;
  field: string;
  message: string;
  rawValue: string;
}
