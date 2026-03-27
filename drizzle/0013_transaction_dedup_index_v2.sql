-- Replace calendar-day dedup index with exact-timestamp match
DROP INDEX IF EXISTS idx_transactions_dedup;

CREATE UNIQUE INDEX idx_transactions_dedup
ON transactions (
  user_id,
  type,
  amount,
  date,
  COALESCE(description, '')
);
