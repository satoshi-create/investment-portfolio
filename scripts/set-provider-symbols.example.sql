-- Example: set Yahoo Finance symbol for Japanese investment trusts (edit symbol + id).
-- After `migrations/001_add_holdings_provider_symbol.sql` on Turso.

-- Single row (replace Yahoo symbol with one that returns data in yahoo-finance2 chart):
-- UPDATE holdings SET provider_symbol = '06311181.T' WHERE id = 'hold-fang' AND ticker = '06311181';

-- Bulk by ticker pattern (digits-only JP codes):
-- UPDATE holdings SET provider_symbol = ticker || '.T' WHERE provider_symbol IS NULL AND ticker GLOB '[0-9]*';
