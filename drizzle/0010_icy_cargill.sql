-- Unique functional index for duplicate transaction detection
-- Key: user_id + type + amount + calendar day + description (nulls treated as empty)
CREATE UNIQUE INDEX idx_transactions_dedup
ON transactions (
  user_id,
  type,
  amount,
  date_trunc('day', date),
  COALESCE(description, '')
);