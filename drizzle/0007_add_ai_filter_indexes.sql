-- Indexes for AI transaction filtering (Issue #35)
-- These indexes optimize the filter patterns used by the AI assistant

-- Composite index for user + date filtering (most common query pattern)
-- Supports: date_range filters, default ordering by date
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Composite index for user + amount filtering
-- Supports: amount_equals, amount_range filters
CREATE INDEX idx_transactions_user_amount ON transactions(user_id, amount);

-- Composite index for user + type filtering
-- Supports: transaction_type filter
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);

-- Composite index for user + category (for category_name filter via JOIN)
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);

-- Enable pg_trgm extension for fuzzy text search (ILIKE '%term%')
-- This is optional but significantly improves description_contains performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for description search using trigrams
-- Supports: description_contains filter with ILIKE
-- Note: Only indexes non-null descriptions to save space
CREATE INDEX idx_transactions_description_trgm ON transactions 
  USING gin (description gin_trgm_ops)
  WHERE description IS NOT NULL;
