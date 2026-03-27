CREATE TYPE "public"."debt_account_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."debt_account_type" AS ENUM('credit_card', 'loan', 'other');--> statement-breakpoint
CREATE TYPE "public"."debt_status" AS ENUM('active', 'paid_off', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."debt_type" AS ENUM('installment', 'revolving', 'loan', 'other');--> statement-breakpoint
CREATE TABLE "debt_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "debt_account_type" NOT NULL,
	"creditor" text,
	"credit_limit" numeric(12, 2),
	"billing_day" integer NOT NULL,
	"category_id" uuid,
	"auto_track" boolean DEFAULT true NOT NULL,
	"status" "debt_account_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"debt_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"principal" numeric(12, 2),
	"interest" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"note" text,
	"transaction_id" uuid,
	"paid_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "debt_type" NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 2),
	"installment_months" integer,
	"installment_start" timestamp,
	"description" text,
	"status" "debt_status" DEFAULT 'active' NOT NULL,
	"paid_off_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"family" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "applied_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "debt_accounts" ADD CONSTRAINT "debt_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_accounts" ADD CONSTRAINT "debt_accounts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payment_allocations" ADD CONSTRAINT "debt_payment_allocations_payment_id_debt_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."debt_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payment_allocations" ADD CONSTRAINT "debt_payment_allocations_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_account_id_debt_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."debt_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_account_id_debt_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."debt_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_accounts_user_id_idx" ON "debt_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debt_accounts_category_id_idx" ON "debt_accounts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "debt_payment_allocations_payment_id_idx" ON "debt_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "debt_payments_account_id_idx" ON "debt_payments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "debt_payments_transaction_id_idx" ON "debt_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "debts_account_id_idx" ON "debts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "debts_user_id_idx" ON "debts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debts_account_id_status_idx" ON "debts" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_applied_rule_id_category_rules_id_fk" FOREIGN KEY ("applied_rule_id") REFERENCES "public"."category_rules"("id") ON DELETE set null ON UPDATE no action;