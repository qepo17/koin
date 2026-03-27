/**
 * AI Security Service
 *
 * Input sanitization and prompt-injection detection.
 * See: https://owasp.org/www-project-top-10-for-large-language-model-applications/
 */

// ============================================================================
// Constants
// ============================================================================

const MAX_PROMPT_LENGTH = 500;

/** Control characters to strip (preserving newlines which collapse separately) */
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Patterns that indicate injection / jailbreak attempts */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Instruction override
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i, label: "ignore previous instructions" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)/i, label: "disregard instructions" },
  { pattern: /forget\s+(all\s+)?(previous|prior|above)/i, label: "forget instructions" },
  { pattern: /new\s+instructions?:/i, label: "new instructions" },

  // System prompt extraction
  { pattern: /system\s*prompt/i, label: "system prompt reference" },
  { pattern: /reveal\s+(your\s+)?(system|instructions?|prompt)/i, label: "reveal instructions" },
  { pattern: /show\s+(me\s+)?(your\s+)?(system|instructions?|prompt)/i, label: "show instructions" },
  { pattern: /what\s+(are|is)\s+your\s+(system|instructions?|prompt)/i, label: "query instructions" },
  { pattern: /repeat\s+(your\s+)?(system|instructions?)/i, label: "repeat instructions" },

  // SQL keywords
  { pattern: /DELETE\s+FROM/i, label: "SQL DELETE" },
  { pattern: /DROP\s+TABLE/i, label: "SQL DROP TABLE" },
  { pattern: /INSERT\s+INTO/i, label: "SQL INSERT" },
  { pattern: /UPDATE\s+.*\s+SET/i, label: "SQL UPDATE SET" },
  { pattern: /;\s*--/, label: "SQL comment injection" },

  // Jailbreak attempts
  { pattern: /\bDAN\b/, label: "DAN jailbreak" },
  { pattern: /jailbreak/i, label: "jailbreak" },
  { pattern: /bypass\s+(security|restrictions?|rules?|filters?)/i, label: "bypass security" },
  { pattern: /\bsudo\b/i, label: "sudo" },
  { pattern: /admin\s*mode/i, label: "admin mode" },
  { pattern: /developer\s*mode/i, label: "developer mode" },
  { pattern: /debug\s*mode/i, label: "debug mode" },

  // Roleplay / impersonation
  { pattern: /act\s+as\s+(if\s+)?(you\s+)?(are|were)\s+(a|an|the)/i, label: "act as" },
  { pattern: /pretend\s+(you\s+)?(are|were)/i, label: "pretend" },
  { pattern: /roleplay/i, label: "roleplay" },

  // User-id manipulation
  { pattern: /user_id\s*[=:]/i, label: "user_id manipulation" },
  { pattern: /other\s*user/i, label: "other user reference" },
];

// ============================================================================
// Types
// ============================================================================

export interface SanitizeResult {
  sanitized: string;
  wasModified: boolean;
  blockedPatterns: string[];
}

export interface InjectionResult {
  safe: boolean;
  reason?: string;
  /** All individual reasons (useful for logging) */
  reasons: string[];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Sanitize user prompt before sending to LLM.
 *
 * 1. Strip control characters
 * 2. Collapse whitespace & trim
 * 3. Limit to MAX_PROMPT_LENGTH chars
 * 4. Report any injection-pattern matches
 */
export function sanitizePrompt(input: string): SanitizeResult {
  const blockedPatterns: string[] = [];
  let wasModified = false;

  // 1. Strip control characters
  let sanitized = input.replace(CONTROL_CHAR_REGEX, "");
  if (sanitized !== input) wasModified = true;

  // 2. Normalize whitespace
  const normalized = sanitized.replace(/\s+/g, " ").trim();
  if (normalized !== sanitized.trim()) wasModified = true;
  sanitized = normalized;

  // 3. Limit length
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_PROMPT_LENGTH);
    wasModified = true;
  }

  // 4. Check injection patterns
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      blockedPatterns.push(label);
    }
  }

  return { sanitized, wasModified, blockedPatterns };
}

/**
 * Detect prompt injection attempts.
 *
 * Returns `{ safe: false }` when **two or more** distinct patterns match
 * (a single match could be a false positive).
 */
export function detectInjection(input: string): InjectionResult {
  const reasons: string[] = [];

  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      reasons.push(`Matches pattern: ${label}`);
    }
  }

  // Block when >= 2 patterns match (high-confidence)
  const safe = reasons.length < 2;
  return {
    safe,
    reason: safe ? undefined : reasons.join("; "),
    reasons,
  };
}
