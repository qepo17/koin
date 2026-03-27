DO $$ BEGIN
  CREATE TYPE "debt_account_type" AS ENUM ('credit_card', 'loan', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "debt_account_status" AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "debt_type" AS ENUM ('installment', 'revolving', 'loan', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "debt_status" AS ENUM ('active', 'paid_off', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "debt_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "type" "debt_account_type" NOT NULL,
  "creditor" text,
  "credit_limit" decimal(12, 2),
  "billing_day" integer NOT NULL,
  "category_id" uuid REFERENCES "categories"("id"),
  "auto_track" boolean NOT NULL DEFAULT true,
  "status" "debt_account_status" NOT NULL DEFAULT 'active',
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "debts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "debt_accounts"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "type" "debt_type" NOT NULL,
  "total_amount" decimal(12, 2) NOT NULL,
  "monthly_amount" decimal(12, 2) NOT NULL,
  "interest_rate" decimal(5, 2),
  "installment_months" integer,
  "installment_start" timestamp,
  "description" text,
  "status" "debt_status" NOT NULL DEFAULT 'active',
  "paid_off_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "debt_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "debt_accounts"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "total_amount" decimal(12, 2) NOT NULL,
  "note" text,
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE CASCADE,
  "paid_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "debt_payment_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL REFERENCES "debt_payments"("id") ON DELETE CASCADE,
  "debt_id" uuid NOT NULL REFERENCES "debts"("id"),
  "amount" decimal(12, 2) NOT NULL,
  "principal" decimal(12, 2),
  "interest" decimal(12, 2)
);

CREATE INDEX IF NOT EXISTS "debt_accounts_user_id_idx" ON "debt_accounts" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "debt_accounts_category_id_idx" ON "debt_accounts" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "debts_account_id_idx" ON "debts" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "debts_user_id_idx" ON "debts" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "debt_payments_account_id_idx" ON "debt_payments" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "debt_payments_transaction_id_idx" ON "debt_payments" USING btree ("transaction_id");
