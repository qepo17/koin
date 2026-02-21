import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  OpenRouterClient,
  OpenRouterAPIError,
  OpenRouterValidationError,
  buildSystemPrompt,
  createOpenRouterClient,
} from "../src/lib/openrouter";
import type { CategoryContext, OpenRouterResponse } from "../src/types/ai";

describe("OpenRouter Client", () => {
  // Use valid UUIDs for test data
  const CAT_FOOD_ID = "11111111-1111-1111-1111-111111111111";
  const CAT_TRANSPORT_ID = "22222222-2222-2222-2222-222222222222";

  const mockCategories: CategoryContext[] = [
    { id: CAT_FOOD_ID, name: "Food", description: "Food and dining" },
    { id: CAT_TRANSPORT_ID, name: "Transport", description: null },
  ];

  describe("buildSystemPrompt", () => {
    it("should include categories in the prompt", () => {
      const prompt = buildSystemPrompt(mockCategories, "USD");

      expect(prompt).toContain("Currency: USD");
      expect(prompt).toContain(`"Food" (id: ${CAT_FOOD_ID})`);
      expect(prompt).toContain("Food and dining");
      expect(prompt).toContain(`"Transport" (id: ${CAT_TRANSPORT_ID})`);
    });

    it("should handle empty categories", () => {
      const prompt = buildSystemPrompt([], "EUR");

      expect(prompt).toContain("Currency: EUR");
      expect(prompt).toContain("No categories defined yet");
    });

    it("should include allowed operations", () => {
      const prompt = buildSystemPrompt(mockCategories, "USD");

      expect(prompt).toContain("UPDATE operations");
      expect(prompt).toContain("CANNOT");
      expect(prompt).toContain("Delete transactions");
    });
  });

  describe("OpenRouterClient", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should make a successful request", async () => {
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              interpretation: "Test interpretation",
              action: {
                type: "update_transactions",
                filters: { description_contains: "coffee" },
                changes: { categoryId: CAT_FOOD_ID },
              },
            }),
          },
          finish_reason: "stop",
        }],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
      });

      const result = await client.interpretPrompt("categorize coffee as food", mockCategories, "USD");

      expect(result.interpretation).toBe("Test interpretation");
      expect(result.action.type).toBe("update_transactions");
      expect(result.action.filters.description_contains).toBe("coffee");
      expect(result.action.changes.categoryId).toBe(CAT_FOOD_ID);
    });

    it("should handle rate limiting with retry", async () => {
      let callCount = 0;
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              interpretation: "Success after retry",
              action: {
                type: "update_transactions",
                filters: {},
                changes: { categoryId: CAT_FOOD_ID },
              },
            }),
          },
          finish_reason: "stop",
        }],
      };

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response(
            JSON.stringify({ error: { message: "Rate limited", type: "rate_limit" } }),
            { status: 429, headers: { "retry-after": "0", "content-type": "application/json" } }
          ));
        }
        return Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }));
      });

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
        maxRetries: 2,
      });

      const result = await client.interpretPrompt("test", [], "USD");

      expect(callCount).toBe(2);
      expect(result.interpretation).toBe("Success after retry");
    });

    it("should throw on invalid JSON response", async () => {
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "This is not valid JSON",
          },
          finish_reason: "stop",
        }],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
      });

      expect(client.interpretPrompt("test", [], "USD")).rejects.toBeInstanceOf(OpenRouterValidationError);
    });

    it("should throw on invalid schema response", async () => {
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              interpretation: "Missing action field",
              // action field missing
            }),
          },
          finish_reason: "stop",
        }],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
      });

      expect(client.interpretPrompt("test", [], "USD")).rejects.toBeInstanceOf(OpenRouterValidationError);
    });

    it("should throw on API errors", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(
          JSON.stringify({ error: { message: "Invalid API key", type: "invalid_api_key" } }),
          { status: 401, headers: { "content-type": "application/json" } }
        ))
      );

      const client = new OpenRouterClient({
        apiKey: "bad-key",
        model: "anthropic/claude-sonnet-4",
        maxRetries: 0,
      });

      try {
        await client.chat([{ role: "user", content: "test" }]);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OpenRouterAPIError);
        expect((error as OpenRouterAPIError).statusCode).toBe(401);
        expect((error as OpenRouterAPIError).isRetryable).toBe(false);
      }
    });

    it("should handle empty response", async () => {
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
      });

      expect(client.interpretPrompt("test", [], "USD")).rejects.toBeInstanceOf(OpenRouterValidationError);
    });

    it("should strip markdown code blocks from response", async () => {
      const mockResponse: OpenRouterResponse = {
        id: "test-id",
        model: "anthropic/claude-sonnet-4",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "```json\n" + JSON.stringify({
              interpretation: "With markdown",
              action: {
                type: "update_transactions",
                filters: {},
                changes: { categoryId: CAT_FOOD_ID },
              },
            }) + "\n```",
          },
          finish_reason: "stop",
        }],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
      });

      const result = await client.interpretPrompt("test", [], "USD");
      expect(result.interpretation).toBe("With markdown");
    });

    it("should throw on invalid Content-Type", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("<html>Error</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }))
      );

      const client = new OpenRouterClient({
        apiKey: "test-key",
        model: "anthropic/claude-sonnet-4",
        maxRetries: 0,
      });

      try {
        await client.chat([{ role: "user", content: "test" }]);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(OpenRouterAPIError);
        expect((error as OpenRouterAPIError).message).toContain("Content-Type");
      }
    });
  });

  describe("OpenRouterAPIError", () => {
    it("should identify rate limited errors", () => {
      const error = new OpenRouterAPIError("Rate limited", 429);
      expect(error.isRateLimited).toBe(true);
      expect(error.isRetryable).toBe(true);
    });

    it("should identify server errors as retryable", () => {
      const error = new OpenRouterAPIError("Server error", 500);
      expect(error.isRateLimited).toBe(false);
      expect(error.isRetryable).toBe(true);
    });

    it("should identify client errors as non-retryable", () => {
      const error = new OpenRouterAPIError("Bad request", 400);
      expect(error.isRateLimited).toBe(false);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe("createOpenRouterClient", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should throw if API key is missing", () => {
      delete process.env.OPENROUTER_API_KEY;

      expect(() => createOpenRouterClient()).toThrow("OPENROUTER_API_KEY");
    });

    it("should create client with default model", () => {
      process.env.OPENROUTER_API_KEY = "test-key";
      delete process.env.OPENROUTER_MODEL;

      const client = createOpenRouterClient();
      expect(client).toBeInstanceOf(OpenRouterClient);
    });

    it("should use custom model from env", () => {
      process.env.OPENROUTER_API_KEY = "test-key";
      process.env.OPENROUTER_MODEL = "openai/gpt-4o";

      const client = createOpenRouterClient();
      expect(client).toBeInstanceOf(OpenRouterClient);
    });
  });
});
