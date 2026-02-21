CREATE TYPE "public"."ai_command_status" AS ENUM('pending', 'confirmed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "ai_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"interpretation" text NOT NULL,
	"actions" text NOT NULL,
	"preview" text NOT NULL,
	"status" "ai_command_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp,
	"result" text
);
--> statement-breakpoint
ALTER TABLE "ai_commands" ADD CONSTRAINT "ai_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_commands_user_status_idx" ON "ai_commands" USING btree ("user_id","status");