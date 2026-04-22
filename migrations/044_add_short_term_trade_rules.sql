-- Short-term self-discipline rules (stop / target / deadline / enable flag) on holdings.
-- Used by `generate-signals` and cockpit (HoldingsDetailTable / TradeEntryForm).

ALTER TABLE holdings ADD COLUMN stop_loss_pct REAL;
ALTER TABLE holdings ADD COLUMN target_profit_pct REAL;
ALTER TABLE holdings ADD COLUMN trade_deadline TEXT;
ALTER TABLE holdings ADD COLUMN exit_rule_enabled INTEGER NOT NULL DEFAULT 0;
