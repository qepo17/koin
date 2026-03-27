-- Migration: 0014_subscription-tracker
-- Note: This migration was created manually due to drizzle-kit metadata conflicts
-- TODO: Regenerate using `bun run db:generate` after migration state is fixed

DO $$ BEGIN
  CREATE TYPE "billing_cycle" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "amount" decimal(12, 2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "billing_cycle" "billing_cycle" NOT NULL,
  "billing_day" integer NOT NULL,
  "category_id" uuid REFERENCES "categories"("id"),
  "description" text,
  "start_date" timestamp DEFAULT now() NOT NULL,
  "end_date" timestamp,
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "url" text,
  "auto_track" boolean NOT NULL DEFAULT true,
  "next_billing_date" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_category_id_idx" ON "subscriptions" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "subscriptions_next_billing_idx" ON "subscriptions" USING btree ("next_billing_date");
CREATE INDEX IF NOT EXISTS "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id", "status");