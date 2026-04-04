-- Turso / SQLite: add Yahoo (or other provider) symbol override for holdings.
-- Apply once: `turso db shell <db-name> < migrations/001_add_holdings_provider_symbol.sql`
-- or paste into Turso SQL console.

ALTER TABLE holdings ADD COLUMN provider_symbol TEXT;
