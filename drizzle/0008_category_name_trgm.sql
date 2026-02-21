-- Trigram index for fuzzy category name matching
-- Supports similarity-based filtering in AI commands

-- GIN index for category name search using trigrams
CREATE INDEX idx_categories_name_trgm ON categories 
  USING gin (name gin_trgm_ops);
