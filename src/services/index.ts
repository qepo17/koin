import { getDb, onDbReset } from "../db";
import { createRuleMatchingService, type RuleMatchingService } from "./rule-matching";

let _ruleMatchingService: RuleMatchingService | null = null;

export function getRuleMatchingService(): RuleMatchingService {
  if (!_ruleMatchingService) {
    _ruleMatchingService = createRuleMatchingService(getDb());
  }
  return _ruleMatchingService;
}

// Auto-reset when DB connection resets (e.g., between test files)
onDbReset(() => {
  _ruleMatchingService = null;
});

export { type RuleMatchingService } from "./rule-matching";
