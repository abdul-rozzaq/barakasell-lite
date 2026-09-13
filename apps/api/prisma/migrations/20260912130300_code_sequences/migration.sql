-- Human-facing document codes (Sale.code "#4821", Receipt.code "K-000123", etc).
-- Sequences, not a counter row, so two concurrent posts never race on the same
-- row and a rolled-back transaction just leaves a gap instead of a retry loop.
CREATE SEQUENCE IF NOT EXISTS sale_code_seq START 4821;
CREATE SEQUENCE IF NOT EXISTS receipt_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS return_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS count_code_seq START 1;
