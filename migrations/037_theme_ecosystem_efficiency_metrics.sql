-- Extend theme_ecosystem_members for efficiency metrics (Rule of 40 / FCF Yield).
-- Apply: turso db shell <db> < migrations/037_theme_ecosystem_efficiency_metrics.sql

PRAGMA foreign_keys = ON;

-- YoY revenue growth (%) and FCF margin (%) are stored as percentage points (e.g. 12.3).
ALTER TABLE theme_ecosystem_members ADD COLUMN revenue_growth REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN fcf_margin REAL;

-- FCF amount (for unlisted yield estimation) and stored FCF yield (%) when available.
-- NOTE: `fcf` currency is not enforced; for unlisted it is assumed to match valuation unit (typically USD).
ALTER TABLE theme_ecosystem_members ADD COLUMN fcf REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN fcf_yield REAL;

