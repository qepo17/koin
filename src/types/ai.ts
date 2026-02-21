import { z } from "zod";

// Filter schemas for AI actions
export const transactionFiltersSchema = z.object({
  description_contains: z.string().optional(),
  amount_equals: z.number().optional(),
  amount_range: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  date_range: z.object({
    start: z.string(), // ISO date
    end: z.string(),   // ISO date
  }).optional(),
  category_name: z.string().optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
});

// Changes that can be applied to transactions
export const transactionChangesSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
});

// AI action schema - only update_transactions for now
export const aiActionSchema = z.object({
  type: z.literal("update_transactions"),
  filters: transactionFiltersSchema,
  changes: transactionChangesSchema,
});

// Full AI interpretation response
export const aiInterpretationSchema = z.object({
  interpretation: z.string(), // Human-readable explanation
  action: aiActionSchema,
});

// Export types
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type TransactionChanges = z.infer<typeof transactionChangesSchema>;
export type AIAction = z.infer<typeof aiActionSchema>;
export type AIInterpretation = z.infer<typeof aiInterpretationSchema>;

// OpenRouter types
export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// Category context for system prompt
export interface CategoryContext {
  id: string;
  name: string;
  description?: string | null;
}
