-- Market event calendar (Koyomi) for patrol / glance prep. Global — not per-user.
-- Apply: turso db shell <db> < migrations/023_market_events.sql

CREATE TABLE IF NOT EXISTS market_events (
  id TEXT PRIMARY KEY,
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_market_events_date
  ON market_events(event_date ASC);

CREATE INDEX IF NOT EXISTS idx_market_events_date_importance
  ON market_events(event_date ASC, importance DESC);

-- Seed: April–May 2026 (illustrative dates; adjust in DB as needed)
INSERT OR IGNORE INTO market_events (id, event_date, title, category, importance, description) VALUES
  ('mev-nfp-2026-04', '2026-04-03', '米・雇用統計 (NFP)', 'Macro', 3, '労働市場の勢いが金利・リスク選好の潮目に直結。VOO 対比の当日ボラに注意。'),
  ('mev-cpi-2026-04', '2026-04-10', '米・CPI (消費者物価)', 'Macro', 3, 'コアの粘着性が Fed 観測を揺らす主要イベント。'),
  ('mev-jgb-2026-04', '2026-04-14', '日銀・国債買入れオペ結果', 'CentralBank', 2, '円金利・為替の短期ショック要因。'),
  ('mev-jpy-2026-04', '2026-04-17', '米財務省・為替報告書 (半年)', 'Geopolitics', 2, '監視国指定や口先介入のニュアンスを先読み。'),
  ('mev-msft-2026-04', '2026-04-29', 'Microsoft (MSFT) 決算', 'Earnings', 3, 'クラウド・AI CAPEX ガイダンスがハイテク全体のベータに波及。'),
  ('mev-meta-2026-04', '2026-04-30', 'Meta (META) 決算', 'Earnings', 2, '広告・Reels 牽引と Reality Labs 赤字幅の焦点。'),
  ('mev-apple-2026-05', '2026-05-01', 'Apple (AAPL) 決算', 'Earnings', 3, '中国需要・サービス成長が指数・サプライチェーンの温度計。'),
  ('mev-fomc-2026-05', '2026-05-07', '米・FOMC 声明・記者会見', 'CentralBank', 3, '利下げ時期・ドットのズレが最優先。パトロール前に必ず確認。'),
  ('mev-ism-2026-05', '2026-05-04', '米・ISM 製造業景況指数', 'Macro', 2, 'ソフトランディング期待の裏付け／崩れのサイン。'),
  ('mev-ppi-2026-05', '2026-05-14', '米・PPI (生産者物価)', 'Macro', 2, 'CPI 先行・マージ圧の読みに利用。'),
  ('mev-opec-2026-05', '2026-05-18', 'OPEC+ 会合 (予定)', 'Geopolitics', 2, '原油の供給カーブがエネルギー株・インフレ期待に波及。');
