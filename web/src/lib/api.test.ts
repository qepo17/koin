import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "./api";

// We test the ApiError class and the request function's logic
// The actual API functions are thin wrappers around fetch, so we mock fetch

describe("ApiError", () => {
  it("should store status and data", () => {
    const error = new ApiError(404, { error: "Not found" });
    expect(error.status).toBe(404);
    expect(error.data).toEqual({ error: "Not found" });
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("API Error: 404");
  });

  it("should be an instance of Error", () => {
    const error = new ApiError(500, {});
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("API client functions", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(status: number, data: unknown, ok?: boolean) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: ok ?? (status >= 200 && status < 300),
      status,
      json: () => Promise.resolve(data),
    });
  }

  it("should throw ApiError on non-ok response", async () => {
    mockFetch(401, { error: "Unauthorized" });

    const { auth, ApiError: ApiErr } = await import("./api");

    try {
      await auth.me();
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiErr);
      expect(e.status).toBe(401);
      expect(e.name).toBe("ApiError");
    }
  });

  it("should return data on successful response", async () => {
    mockFetch(200, { data: { id: "user-1", email: "test@example.com" } });

    const { auth } = await import("./api");
    const result = await auth.me();
    expect(result.data).toEqual({ id: "user-1", email: "test@example.com" });
  });

  it("should send POST with JSON body for login", async () => {
    mockFetch(200, { data: { user: {}, token: "abc" } });

    const { auth } = await import("./api");
    await auth.login({ email: "test@example.com", password: "pass123" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  it("should include credentials: include on all requests", async () => {
    mockFetch(200, { data: [] });

    const { transactions } = await import("./api");
    await transactions.list();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("should build query params for transactions.list", async () => {
    mockFetch(200, { data: [] });

    const { transactions } = await import("./api");
    await transactions.list({ type: "expense", startDate: "2026-01-01" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("type=expense"),
      expect.any(Object)
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("startDate=2026-01-01"),
      expect.any(Object)
    );
  });

  it("should build query params for summary.get", async () => {
    mockFetch(200, { data: {} });

    const { summary } = await import("./api");
    await summary.get("2026-01-01", "2026-01-31");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("from=2026-01-01"),
      expect.any(Object)
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("to=2026-01-31"),
      expect.any(Object)
    );
  });

  it("should build query params for summary.trend", async () => {
    mockFetch(200, { data: {} });

    const { summary } = await import("./api");
    await summary.trend({ period: "monthly", from: "2026-01-01" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("period=monthly"),
      expect.any(Object)
    );
  });

  it("should send DELETE for transactions.delete", async () => {
    mockFetch(200, { data: {} });

    const { transactions } = await import("./api");
    await transactions.delete("tx-1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/transactions/tx-1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("should send PATCH for categories.update", async () => {
    mockFetch(200, { data: {} });

    const { categories } = await import("./api");
    await categories.update("cat-1", { name: "Updated" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/cat-1"),
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("should handle skill.preview returning ok: true on success", async () => {
    mockFetch(200, { data: { baseUrl: "http://localhost:3000/api" } });

    const { skill } = await import("./api");
    const result = await skill.preview();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.baseUrl).toBe("http://localhost:3000/api");
    }
  });

  it("should handle skill.preview returning ok: false on error", async () => {
    mockFetch(500, { error: "Internal error" });

    const { skill } = await import("./api");
    const result = await skill.preview();

    expect(result.ok).toBe(false);
  });

  it("should send POST for ai.interpret", async () => {
    mockFetch(200, { data: {} });

    const { ai } = await import("./api");
    await ai.interpret("show my expenses");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ai/command"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
