import { Rule } from './rule.model';

export interface RuleResult {
  rule: Rule;
  allowed: boolean;
  reason?: string;
  triggered?: boolean; // Kuralın koşulu bu context'te tetiklendi mi (sandbox/simülasyon için)
}
