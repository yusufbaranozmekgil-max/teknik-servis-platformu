export type RuleActionType = 'REQUIRE_APPROVAL' | 'BLOCK_ASSIGNMENT' | 'TRIGGER_ALERT' | 'AUTO_PRIORITIZE';

export interface Rule {
  id: string;
  name: string;
  description: string;
  evaluatorFnName?: string; // Kept for backwards compatibility
  trigger?: 'WORK_ORDER_PLAN' | 'SPARE_PART_CONSUMPTION' | 'SERVICE_REQUEST_CREATE' | 'SYSTEM_EVENT';
  conditions?: string;      // JSON string representing evaluation rules
  actions?: string;         // JSON string representing action parameters
  priority: number;         // Lower number = higher priority (e.g., 1 wins over 5)
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;

  // New fields for user-defined rules
  conditionField?: string;
  operator?: string;
  conditionValue?: string;
  actionType?: RuleActionType;
  actionValue?: string;
}
