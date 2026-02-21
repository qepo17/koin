import {
  type OpenRouterMessage,
  type OpenRouterResponse,
  type OpenRouterError,
  type CategoryContext,
  type AIInterpretation,
  aiInterpretationSchema,
} from "../types/ai";

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

export class OpenRouterValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "OpenRouterValidationError";
  }
}

// Sanitize user input to prevent prompt injection
function sanitizeForPrompt(input: string, maxLength: number = 100): string {
  return input
    .replace(/[\r\n]+/g, " ")           // Replace newlines with spaces
    .replace(/[#*`\[\]{}]/g, "")        // Remove markdown-like characters
    .replace(/\s+/g, " ")               // Collapse multiple spaces
    .trim()
    .slice(0, maxLength);               // Limit length
}

// Build system prompt with user context
export function buildSystemPrompt(categories: CategoryContext[], currency: string): string {
  const sanitizedCurrency = sanitizeForPrompt(currency, 10);
  const categoryList = categories.length > 0
    ? categories.map(c => {
        const name = sanitizeForPrompt(c.name, 50);
        const desc = c.description ? ` - ${sanitizeForPrompt(c.description, 100)}` : "";
        return `- "${name}" (id: ${c.id})${desc}`;
      }).join("\n")
    : "No categories defined yet.";

  return `You are a personal finance assistant for a user's expense tracking app.

## User Context
- Currency: ${sanitizedCurrency}
- Available Categories:
${categoryList}

## Your Task
Interpret the user's natural language request about their transactions and convert it into a structured action.

## Allowed Operations
You can ONLY help with UPDATE operations on transactions. You CANNOT:
- Create new transactions (user must do this manually)
- Delete transactions
- Access or modify budgets, settings, or other data

## Response Format
You MUST respond with valid JSON matching this schema:
{
  "interpretation": "A brief, human-readable explanation of what you understood",
  "action": {
    "type": "update_transactions",
    "filters": {
      "description_contains": "optional string to match in description",
      "amount_equals": "optional exact amount number",
      "amount_range": { "min": number, "max": number },
      "date_range": { "start": "ISO date", "end": "ISO date" },
      "category_name": "optional category name to match",
      "transaction_type": "income or expense"
    },
    "changes": {
      "categoryId": "uuid of category to assign",
      "amount": "new amount as string",
      "description": "new description",
      "type": "income or expense"
    }
  }
}

Only include filter fields that are relevant to the user's request. Only include change fields the user wants to modify.

## Examples

User: "Categorize all my coffee purchases as Food"
{
  "interpretation": "I'll find all transactions with 'coffee' in the description and assign them to the 'Food' category.",
  "action": {
    "type": "update_transactions",
    "filters": { "description_contains": "coffee" },
    "changes": { "categoryId": "<Food category id>" }
  }
}

User: "Change my Netflix subscription from $15 to $18"
{
  "interpretation": "I'll update the Netflix transaction amount from $15 to $18.",
  "action": {
    "type": "update_transactions",
    "filters": { "description_contains": "Netflix", "amount_equals": 15 },
    "changes": { "amount": "18" }
  }
}

IMPORTANT: Always respond with ONLY the JSON object, no additional text or markdown.`;
}

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
  async interpretPrompt(
    prompt: string,
    categories: CategoryContext[],
    currency: string
  ): Promise<AIInterpretation> {
    const systemPrompt = buildSystemPrompt(categories, currency);

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenRouterValidationError("Empty response from model");
    }

    // Parse and validate JSON response
    let parsed: unknown;
    try {
      // Handle potential markdown code blocks
      const jsonContent = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new OpenRouterValidationError("Invalid JSON in model response", content);
    }

    const result = aiInterpretationSchema.safeParse(parsed);
    if (!result.success) {
      throw new OpenRouterValidationError(
        "Response does not match expected schema",
        result.error.issues
      );
    }

    return result.data;
  }
}

// Create client from environment variables
export function createOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
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
