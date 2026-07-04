import { Rule } from './rule.model';

export interface RuleResult {
  rule: Rule;
  allowed: boolean;
  reason?: string;
}
