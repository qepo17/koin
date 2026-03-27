import { getDb, onDbReset } from "../db";
import { createRuleMatchingService, type RuleMatchingService } from "./rule-matching";
import { createDebtPaymentService, type DebtPaymentService } from "./debt-payment";

let _ruleMatchingService: RuleMatchingService | null = null;
let _debtPaymentService: DebtPaymentService | null = null;

export function getRuleMatchingService(): RuleMatchingService {
  if (!_ruleMatchingService) {
    _ruleMatchingService = createRuleMatchingService(getDb());
  }
  return _ruleMatchingService;
}

export function getDebtPaymentService(): DebtPaymentService {
  if (!_debtPaymentService) {
    _debtPaymentService = createDebtPaymentService(getDb());
  }
  return _debtPaymentService;
}

// Auto-reset when DB connection resets (e.g., between test files)
onDbReset(() => {
  _ruleMatchingService = null;
  _debtPaymentService = null;
});

export { type RuleMatchingService } from "./rule-matching";
export { type DebtPaymentService } from "./debt-payment";
