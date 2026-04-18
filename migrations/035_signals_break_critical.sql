-- Extend `signals.signal_type` with structural break tiers (σ-based immediate alerts).
--
-- Apply: turso db shell <db> < migrations/035_signals_break_critical.sql

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE signals_new (
  id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'WARN', 'BREAK', 'CRITICAL')),
  alpha_at_signal REAL NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  detected_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  performance_after_30d REAL,
  alpha_day TEXT,
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
);

INSERT INTO signals_new (
  id,
  holding_id,
  signal_type,
  alpha_at_signal,
  is_resolved,
  detected_at,
  performance_after_30d,
  alpha_day
)
SELECT
  id,
  holding_id,
  signal_type,
  alpha_at_signal,
  is_resolved,
  detected_at,
  performance_after_30d,
  alpha_day
FROM signals;

DROP TABLE signals;
ALTER TABLE signals_new RENAME TO signals;

CREATE INDEX idx_signals_holding_id ON signals(holding_id);
CREATE INDEX idx_signals_detected_at ON signals(detected_at);
CREATE INDEX idx_signals_unresolved ON signals(is_resolved, detected_at);
CREATE INDEX IF NOT EXISTS idx_signals_alpha_day ON signals(alpha_day);

COMMIT;

PRAGMA foreign_keys = ON;
