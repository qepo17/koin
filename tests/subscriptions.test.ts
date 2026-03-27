import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables, getTestDb } from "./setup";
import { createApi, createTestUser } from "./helpers";
import { subscriptions, categories, transactions } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Subscriptions API", () => {
  let api: ReturnType<typeof createApi>;
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
    // Create a test user and get authenticated API
    const { token, response } = await createTestUser();
    userId = response.data?.data?.user?.id;
    api = createApi(token);
  });

  describe("POST /api/subscriptions", () => {
    it("should create a monthly subscription", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Netflix",
        amount: "54000.00",
        billingCycle: "monthly",
        billingDay: 15,
        description: "Premium plan",
        url: "https://netflix.com",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        name: "Netflix",
        amount: "54000.00",
        billingCycle: "monthly",
        billingDay: 15,
        description: "Premium plan",
        url: "https://netflix.com",
        status: "active",
        autoTrack: true,
        userId,
      });
      expect(data.data.id).toBeDefined();
      expect(data.data.nextBillingDate).toBeDefined();
      expect(new Date(data.data.nextBillingDate)).toBeInstanceOf(Date);
    });

    it("should create a weekly subscription", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Weekly Coffee",
        amount: "25000.00",
        billingCycle: "weekly",
        billingDay: 1, // Monday
      });

      expect(status).toBe(201);
      expect(data.data.billingCycle).toBe("weekly");
      expect(data.data.billingDay).toBe(1);
    });

    it("should create a yearly subscription", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Annual Software License",
        amount: "1200000.00",
        billingCycle: "yearly",
        billingDay: 31,
      });

      expect(status).toBe(201);
      expect(data.data.billingCycle).toBe("yearly");
    });

    it("should use start date's day as billing day if not specified", async () => {
      const startDate = "2026-03-15T00:00:00Z";
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Spotify",
        amount: "49000.00",
        billingCycle: "monthly",
        startDate,
      });

      expect(status).toBe(201);
      expect(data.data.billingDay).toBe(15); // Should use day from startDate
    });

    it("should default auto-track to true", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Default AutoTrack",
        amount: "10000.00",
        billingCycle: "monthly",
      });

      expect(status).toBe(201);
      expect(data.data.autoTrack).toBe(true);
    });

    it("should validate billing day for weekly subscriptions", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Invalid Weekly",
        amount: "10000.00",
        billingCycle: "weekly",
        billingDay: 8, // Invalid for weekly (must be 1-7)
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Weekly billing day must be 1-7");
    });

    it("should validate billing day for monthly subscriptions", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Invalid Monthly",
        amount: "10000.00",
        billingCycle: "monthly",
        billingDay: 32, // Invalid (must be 1-31)
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Billing day must be 1-31");
    });

    it("should require positive amount", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        name: "Invalid Amount",
        amount: "-10.00",
        billingCycle: "monthly",
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should validate required fields", async () => {
      const { status, data } = await api.post("/api/subscriptions", {
        amount: "10000.00",
        // Missing name and billingCycle
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/subscriptions", () => {
    beforeEach(async () => {
      // Create test subscriptions
      await api.post("/api/subscriptions", {
        name: "Netflix",
        amount: "54000.00",
        billingCycle: "monthly",
        billingDay: 15,
      });
      await api.post("/api/subscriptions", {
        name: "Spotify",
        amount: "49000.00",
        billingCycle: "monthly",
        billingDay: 1,
      });
      
      // Pause one subscription  
      const allSubs = await api.get("/api/subscriptions");
      const spotifyId = allSubs.data.data.find((s: any) => s.name === "Spotify")?.id;
      await api.post(`/api/subscriptions/${spotifyId}/pause`, {});
      
      await api.post("/api/subscriptions", {
        name: "Weekly Magazine",
        amount: "15000.00",
        billingCycle: "weekly",
        billingDay: 1,
      });
    });

    it("should list active subscriptions by default", async () => {
      const { status, data } = await api.get("/api/subscriptions");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(2); // Netflix and Weekly Magazine (active)
      data.data.forEach((sub: any) => {
        expect(sub.status).toBe("active");
      });
    });

    it("should filter by status", async () => {
      const { status, data } = await api.get("/api/subscriptions?status=paused");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Spotify");
      expect(data.data[0].status).toBe("paused");
    });

    it("should filter by billing cycle", async () => {
      const { status, data } = await api.get("/api/subscriptions?billingCycle=weekly");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Weekly Magazine");
      expect(data.data[0].billingCycle).toBe("weekly");
    });

    it("should show all subscriptions with status=all", async () => {
      const { status, data } = await api.get("/api/subscriptions?status=all");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(3); // All subscriptions
    });

    it("should include category name when subscription has category", async () => {
      // First create a category
      const categoryResp = await api.post("/api/categories", {
        name: "Entertainment",
        description: "Movies, music, etc.",
      });
      const categoryId = categoryResp.data.data.id;

      // Create subscription with category
      await api.post("/api/subscriptions", {
        name: "Disney+",
        amount: "65000.00",
        billingCycle: "monthly",
        categoryId,
      });

      const { status, data } = await api.get("/api/subscriptions");
      const disneySubscription = data.data.find((s: any) => s.name === "Disney+");

      expect(disneySubscription).toBeDefined();
      expect(disneySubscription.categoryId).toBe(categoryId);
      expect(disneySubscription.categoryName).toBe("Entertainment");
    });
  });

  describe("GET /api/subscriptions/:id", () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const response = await api.post("/api/subscriptions", {
        name: "Test Subscription",
        amount: "100000.00",
        billingCycle: "monthly",
        description: "Test description",
      });
      subscriptionId = response.data.data.id;
    });

    it("should get subscription by ID", async () => {
      const { status, data } = await api.get(`/api/subscriptions/${subscriptionId}`);

      expect(status).toBe(200);
      expect(data.data.id).toBe(subscriptionId);
      expect(data.data.name).toBe("Test Subscription");
      expect(data.data.amount).toBe("100000.00");
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";
      const { status, data } = await api.get(`/api/subscriptions/${fakeId}`);

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });

    it("should not return other user's subscriptions", async () => {
      // Create another user
      const { token: token2 } = await createTestUser();
      const api2 = createApi(token2);

      // Try to access first user's subscription with second user's token
      const { status, data } = await api2.get(`/api/subscriptions/${subscriptionId}`);

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });
  });

  describe("PATCH /api/subscriptions/:id", () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const response = await api.post("/api/subscriptions", {
        name: "Test Subscription",
        amount: "100000.00",
        billingCycle: "monthly",
        billingDay: 15,
      });
      subscriptionId = response.data.data.id;
    });

    it("should update subscription name and description", async () => {
      const { status, data } = await api.patch(`/api/subscriptions/${subscriptionId}`, {
        name: "Updated Subscription",
        description: "Updated description",
      });

      expect(status).toBe(200);
      expect(data.data.name).toBe("Updated Subscription");
      expect(data.data.description).toBe("Updated description");
    });

    it("should update amount and recalculate next billing date", async () => {
      const originalData = await api.get(`/api/subscriptions/${subscriptionId}`);
      const originalNextBilling = originalData.data.data.nextBillingDate;

      const { status, data } = await api.patch(`/api/subscriptions/${subscriptionId}`, {
        amount: "200000.00",
      });

      expect(status).toBe(200);
      expect(data.data.amount).toBe("200000.00");
      // Next billing date should be recalculated (different from original)
      expect(data.data.nextBillingDate).not.toBe(originalNextBilling);
    });

    it("should update billing cycle and recalculate next billing date", async () => {
      const { status, data } = await api.patch(`/api/subscriptions/${subscriptionId}`, {
        billingCycle: "quarterly",
      });

      expect(status).toBe(200);
      expect(data.data.billingCycle).toBe("quarterly");
      expect(data.data.nextBillingDate).toBeDefined();
    });

    it("should validate billing day when updating", async () => {
      const { status, data } = await api.patch(`/api/subscriptions/${subscriptionId}`, {
        billingCycle: "weekly",
        billingDay: 8, // Invalid for weekly
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Weekly billing day must be 1-7");
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";
      const { status, data } = await api.patch(`/api/subscriptions/${fakeId}`, {
        name: "Won't work",
      });

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });
  });

  describe("DELETE /api/subscriptions/:id", () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const response = await api.post("/api/subscriptions", {
        name: "To Be Deleted",
        amount: "50000.00",
        billingCycle: "monthly",
      });
      subscriptionId = response.data.data.id;
    });

    it("should soft delete subscription (set status to cancelled)", async () => {
      const { status, data } = await api.delete(`/api/subscriptions/${subscriptionId}`);

      expect(status).toBe(200);
      expect(data.data.status).toBe("cancelled");
      expect(data.data.endDate).toBeDefined();
      expect(new Date(data.data.endDate)).toBeInstanceOf(Date);
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";
      const { status, data } = await api.delete(`/api/subscriptions/${fakeId}`);

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });
  });

  describe("POST /api/subscriptions/:id/pause", () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const response = await api.post("/api/subscriptions", {
        name: "To Be Paused",
        amount: "75000.00",
        billingCycle: "monthly",
      });
      subscriptionId = response.data.data.id;
    });

    it("should pause subscription", async () => {
      const { status, data } = await api.post(`/api/subscriptions/${subscriptionId}/pause`, {});

      expect(status).toBe(200);
      expect(data.data.status).toBe("paused");
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";
      const { status, data } = await api.post(`/api/subscriptions/${fakeId}/pause`, {});

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });
  });

  describe("POST /api/subscriptions/:id/resume", () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const response = await api.post("/api/subscriptions", {
        name: "To Be Resumed",
        amount: "80000.00",
        billingCycle: "monthly",
      });
      subscriptionId = response.data.data.id;

      // Pause it first
      await api.post(`/api/subscriptions/${subscriptionId}/pause`, {});
    });

    it("should resume paused subscription and recalculate next billing date", async () => {
      const { status, data } = await api.post(`/api/subscriptions/${subscriptionId}/resume`, {});

      expect(status).toBe(200);
      expect(data.data.status).toBe("active");
      expect(data.data.nextBillingDate).toBeDefined();
      
      // Next billing date should be in the future (after now)
      const nextBilling = new Date(data.data.nextBillingDate);
      const now = new Date();
      expect(nextBilling > now).toBe(true);
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";
      const { status, data } = await api.post(`/api/subscriptions/${fakeId}/resume`, {});

      expect(status).toBe(404);
      expect(data.error).toBe("Subscription not found");
    });
  });

  describe("GET /api/subscriptions/summary", () => {
    beforeEach(async () => {
      // Create test subscriptions with different cycles
      await api.post("/api/subscriptions", {
        name: "Netflix Monthly",
        amount: "54000.00",
        billingCycle: "monthly",
      });
      await api.post("/api/subscriptions", {
        name: "Weekly Coffee",
        amount: "25000.00",
        billingCycle: "weekly",
      });
      await api.post("/api/subscriptions", {
        name: "Annual License",
        amount: "1200000.00",
        billingCycle: "yearly",
      });
      await api.post("/api/subscriptions", {
        name: "Paused Service",
        amount: "30000.00",
        billingCycle: "monthly",
      });
      // Pause the last one
      const pausedResponse = await api.get("/api/subscriptions");
      const pausedSub = pausedResponse.data.data.find((s: any) => s.name === "Paused Service");
      await api.post(`/api/subscriptions/${pausedSub.id}/pause`, {});
    });

    it("should return subscription summary with totals and breakdowns", async () => {
      const { status, data } = await api.get("/api/subscriptions/summary");

      expect(status).toBe(200);
      expect(data.data).toMatchObject({
        activeCount: 3, // Netflix, Coffee, Annual (Paused is excluded)
        monthlyTotal: expect.any(String),
        yearlyTotal: expect.any(String),
        upcomingThisWeek: expect.any(Array),
        byCategory: expect.any(Array),
        byCycle: {
          weekly: "25000.00",
          monthly: "54000.00",
          quarterly: "0.00",
          yearly: "1200000.00",
        },
      });

      // Check that monthly total is calculated correctly
      // 54000 (monthly) + 25000*4.33 (weekly ~= 108250) + 1200000/12 (yearly = 100000) = ~262250
      const monthlyTotal = parseFloat(data.data.monthlyTotal);
      expect(monthlyTotal).toBeCloseTo(262250, 0); // Within 1 unit

      // Check that yearly total is monthly * 12
      const yearlyTotal = parseFloat(data.data.yearlyTotal);
      expect(yearlyTotal).toBeCloseTo(monthlyTotal * 12, 0);
    });

    it("should include upcoming subscriptions this week", async () => {
      const { status, data } = await api.get("/api/subscriptions/summary");

      expect(status).toBe(200);
      expect(data.data.upcomingThisWeek).toBeInstanceOf(Array);
      // All our test subscriptions should be due within a week since they were just created
      expect(data.data.upcomingThisWeek.length).toBeGreaterThan(0);
      
      data.data.upcomingThisWeek.forEach((upcoming: any) => {
        expect(upcoming).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          amount: expect.any(String),
          nextBillingDate: expect.any(String),
        });
      });
    });
  });

  describe("POST /api/subscriptions/check-billing", () => {
    let subscriptionId: string;
    let categoryId: string;

    beforeEach(async () => {
      // Create a category first
      const categoryResponse = await api.post("/api/categories", {
        name: "Entertainment",
        description: "Streaming services",
      });
      categoryId = categoryResponse.data.data.id;

      // Create subscription that's due today
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await api.post("/api/subscriptions", {
        name: "Due Subscription",
        amount: "50000.00",
        billingCycle: "monthly",
        categoryId,
        startDate: yesterday.toISOString(),
        autoTrack: true,
      });
      subscriptionId = response.data.data.id;

      // Manually set next billing date to yesterday (so it's due)
      const db = getTestDb();
      await db
        .update(subscriptions)
        .set({ nextBillingDate: yesterday })
        .where(eq(subscriptions.id, subscriptionId));
    });

    it("should create transactions for due subscriptions", async () => {
      const { status, data } = await api.post("/api/subscriptions/check-billing", {});

      expect(status).toBe(200);
      expect(data.data.processed).toBe(1);
      expect(data.data.transactions).toHaveLength(1);
      expect(data.data.transactions[0]).toMatchObject({
        subscriptionId,
        subscriptionName: "Due Subscription",
        transactionId: expect.any(String),
        amount: "50000.00",
      });

      // Verify transaction was created
      const db = getTestDb();
      const createdTransaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, data.data.transactions[0].transactionId));

      expect(createdTransaction).toHaveLength(1);
      expect(createdTransaction[0]).toMatchObject({
        type: "expense",
        amount: "50000.00",
        description: "Due Subscription subscription",
        categoryId,
        userId,
      });
    });

    it("should advance next billing date after creating transaction", async () => {
      const db = getTestDb();
      
      // Get current next billing date
      const beforeBilling = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      const originalNextBilling = beforeBilling[0].nextBillingDate;

      await api.post("/api/subscriptions/check-billing", {});

      // Check that next billing date was advanced
      const afterBilling = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      const newNextBilling = afterBilling[0].nextBillingDate;

      expect(newNextBilling).not.toEqual(originalNextBilling);
      expect(newNextBilling > originalNextBilling).toBe(true);
    });

    it("should skip paused subscriptions", async () => {
      // Pause the subscription
      await api.post(`/api/subscriptions/${subscriptionId}/pause`, {});

      const { status, data } = await api.post("/api/subscriptions/check-billing", {});

      expect(status).toBe(200);
      expect(data.data.processed).toBe(0);
      expect(data.data.transactions).toHaveLength(0);
      expect(data.data.skipped).toHaveLength(1);
      expect(data.data.skipped[0]).toMatchObject({
        subscriptionId,
        subscriptionName: "Due Subscription",
        reason: "paused",
      });
    });

    it("should skip subscriptions with auto-track disabled", async () => {
      const db = getTestDb();
      
      // Disable auto-track
      await db
        .update(subscriptions)
        .set({ autoTrack: false })
        .where(eq(subscriptions.id, subscriptionId));

      const { status, data } = await api.post("/api/subscriptions/check-billing", {});

      expect(status).toBe(200);
      expect(data.data.processed).toBe(0);
      expect(data.data.transactions).toHaveLength(0);
    });

    it("should process billing for specific date", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1); // Tomorrow

      const { status, data } = await api.post("/api/subscriptions/check-billing", {
        date: targetDate.toISOString(),
      });

      expect(status).toBe(200);
      // Should still process since our test subscription was set to yesterday (before tomorrow)
      expect(data.data.processed).toBe(1);
    });
  });

  describe("User scoping", () => {
    let user1Token: string, user2Token: string;
    let user1Api: ReturnType<typeof createApi>, user2Api: ReturnType<typeof createApi>;

    beforeEach(async () => {
      // Create two different users
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      
      user1Token = user1.token;
      user2Token = user2.token;
      user1Api = createApi(user1Token);
      user2Api = createApi(user2Token);
    });

    it("should only show user's own subscriptions", async () => {
      // User 1 creates a subscription
      await user1Api.post("/api/subscriptions", {
        name: "User 1 Subscription",
        amount: "100000.00",
        billingCycle: "monthly",
      });

      // User 2 creates a subscription
      await user2Api.post("/api/subscriptions", {
        name: "User 2 Subscription",
        amount: "200000.00",
        billingCycle: "monthly",
      });

      // User 1 should only see their subscription
      const user1Response = await user1Api.get("/api/subscriptions");
      expect(user1Response.data.data).toHaveLength(1);
      expect(user1Response.data.data[0].name).toBe("User 1 Subscription");

      // User 2 should only see their subscription
      const user2Response = await user2Api.get("/api/subscriptions");
      expect(user2Response.data.data).toHaveLength(1);
      expect(user2Response.data.data[0].name).toBe("User 2 Subscription");
    });
  });
});