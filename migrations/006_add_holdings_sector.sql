-- Explicit sector label per holding (GICS-style or custom). Falls back to structure_tags[1] in app when NULL/empty.
-- Apply: turso db shell <db> < migrations/006_add_holdings_sector.sql

ALTER TABLE holdings ADD COLUMN sector TEXT;
ｑ