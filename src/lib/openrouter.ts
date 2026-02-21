import {
  type OpenRouterMessage,
  type OpenRouterResponse,
  type OpenRouterError,
  type CategoryContext,
  type AIInterpretation,
} from "../types/ai";
import {
  sanitizePrompt,
  detectInjection,
  validateAIOutput,
  buildSecureSystemPrompt,
  logAuditEntry,
} from "./ai-guardrails";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Config with defaults
interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxRetries?: number;
  timeoutMs?: number;
}

// Error types
export class OpenRouterAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public errorCode?: string
  ) {
    super(message);
    this.name = "OpenRouterAPIError";
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "OpenRouterValidationError";
  }
}

// Re-export buildSecureSystemPrompt as buildSystemPrompt for backward compatibility
export { buildSecureSystemPrompt as buildSystemPrompt } from "./ai-guardrails";

// Sleep helper for retries
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse retry-after header
function getRetryAfterMs(headers: Headers): number {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return INITIAL_RETRY_DELAY_MS;

  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  // Try parsing as date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return INITIAL_RETRY_DELAY_MS;
}

// Main client class
export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  // Make a chat completion request with retries
  async chat(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    let lastError: Error | null = null;
    let retryDelay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://koin.app",
            "X-Title": "Koin Finance Assistant",
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.1, // Low temperature for consistent structured output
            max_tokens: 1024,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Validate Content-Type before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          throw new OpenRouterAPIError(
            `Unexpected Content-Type: ${contentType}`,
            response.status
          );
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as OpenRouterError;
          const error = new OpenRouterAPIError(
            errorBody.error?.message || `HTTP ${response.status}`,
            response.status,
            errorBody.error?.type,
            errorBody.error?.code
          );

          if (error.isRetryable && attempt < this.maxRetries) {
            // Use retry-after header if rate limited
            if (error.isRateLimited) {
              retryDelay = getRetryAfterMs(response.headers);
            }
            lastError = error;
            await sleep(retryDelay);
            retryDelay *= 2; // Exponential backoff
            continue;
          }

          throw error;
        }

        return await response.json() as OpenRouterResponse;
      } catch (error) {
        clearTimeout(timeoutId); // Always clear timeout to prevent leaks

        if (error instanceof OpenRouterAPIError) {
          throw error;
        }

        // Handle network errors and timeouts
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            throw new OpenRouterAPIError("Request timeout", 408);
          }

          if (attempt < this.maxRetries) {
            lastError = error;
            await sleep(retryDelay);
            retryDelay *= 2;
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  // Interpret a user prompt and return structured action
  // Now integrated with security guardrails
  async interpretPrompt(
    prompt: string,
    categories: CategoryContext[],
    currency: string,
    userId?: string  // Optional for audit logging
  ): Promise<AIInterpretation> {
    // Step 1: Sanitize and check for injection
    const { sanitized, blockedPatterns } = sanitizePrompt(prompt);
    const injection = detectInjection(sanitized);

    // Log prompt received
    if (userId) {
      logAuditEntry({
        userId,
        action: "prompt_received",
        prompt: sanitized,
        blockedPatterns: blockedPatterns.length > 0 ? blockedPatterns : undefined,
        success: true,
      });
    }

    // Block obvious injection attempts
    if (injection.blocked) {
      if (userId) {
        logAuditEntry({
          userId,
          action: "injection_detected",
          prompt: sanitized,
          blockedPatterns: injection.reasons,
          success: false,
        });
      }
      throw new OpenRouterValidationError(
        "Request blocked: potential prompt injection detected",
        injection.reasons
      );
    }

    // Step 2: Build secure system prompt and call LLM
    const systemPrompt = buildSecureSystemPrompt(categories, currency);

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: sanitized },
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenRouterValidationError("Empty response from model");
    }

    // Step 3: Parse JSON response
    let parsed: unknown;
    try {
      // Handle potential markdown code blocks
      const jsonContent = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(jsonContent);
    } catch {
      if (userId) {
        logAuditEntry({
          userId,
          action: "validation_failed",
          prompt: sanitized,
          llmResponse: content,
          validationErrors: ["Invalid JSON"],
          success: false,
        });
      }
      throw new OpenRouterValidationError("Invalid JSON in model response", content);
    }

    // Step 4: Validate output with guardrails (strict schema + sanitization)
    const validation = validateAIOutput(parsed);
    if (!validation.valid) {
      if (userId) {
        logAuditEntry({
          userId,
          action: "validation_failed",
          prompt: sanitized,
          llmResponse: content,
          validationErrors: validation.errors,
          success: false,
        });
      }
      throw new OpenRouterValidationError(
        "Response failed security validation",
        validation.errors
      );
    }

    return {
      interpretation: validation.interpretation!,
      action: validation.action!,
    };
  }
}

// Create client from environment variables
export function createOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

  if (!apiKey) {
    throw new OpenRouterConfigError(
      "AI features are not configured. Please set OPENROUTER_API_KEY."
    );
  }

  return new OpenRouterClient({ apiKey, model });
}

// Validate environment on module load (lazy)
let envValidated = false;
export function validateOpenRouterEnv(): void {
  if (envValidated) return;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("Warning: OPENROUTER_API_KEY not set. AI features will be unavailable.");
  }

  envValidated = true;
}
