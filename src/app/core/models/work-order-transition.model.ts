import { WorkOrderStatus } from './work-order-status.model';

export interface WorkOrderTransition {
  from: WorkOrderStatus;
  to: WorkOrderStatus[];
}
