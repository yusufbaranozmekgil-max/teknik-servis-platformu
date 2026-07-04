import { ValidationError } from './validation-error.model';

export interface ImportResult<T> {
  successCount: number;
  failureCount: number;
  importedRecords: T[];
  errors: ValidationError[];
}
