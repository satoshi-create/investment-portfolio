-- 対象プロファイルに合わせて変更すること
-- .exit しないでそのまま実行可
--
-- alpha_history は user_id + ticker で保持される（migrations/008）。保有だけ消しても履歴は残るため、
-- ここでは holdings のみ DELETE すればよい（alpha_history を消す必要はない）。

PRAGMA foreign_keys = ON;

DELETE FROM holdings WHERE user_id = 'user-satoshi';

INSERT INTO holdings (id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category, provider_symbol, valuation_factor, created_at) VALUES
('hold-nflx', 'user-satoshi', 'NFLX', 'Netflix Inc', 2, 96.21, '["グロース","ソフトウェア"]', 'ソフトウェア', 'Satellite', NULL, 1, datetime('now')),
('hold-nvda', 'user-satoshi', 'NVDA', 'NVIDIA Corp', 1, 178, '["グロース","ソフトウェア"]', 'ソフトウェア', 'Satellite', NULL, 1, datetime('now')),
('hold-cop', 'user-satoshi', 'COP', 'ConocoPhillips', 1, 125, '["エネルギー","エネルギー"]', 'エネルギー', 'Satellite', NULL, 1, datetime('now')),
('hold-fang', 'user-satoshi', '06311181', 'ｉＦｒｅｅＮＥＸＴ ＦＡＮＧ＋', 389, 77121, '["FANG+","ソフトウェア"]', 'ソフトウェア', 'Satellite', NULL, 1, datetime('now')),
('hold-nio', 'user-satoshi', 'NIO', 'Nio Inc - ADR', 1, 5.47, '["EV","ソフトウェア"]', 'ソフトウェア', 'Satellite', NULL, 1, datetime('now')),
('hold-enph', 'user-satoshi', 'ENPH', 'Enphase Energy Inc', 1, 38.27, '["再エネ","エネルギー"]', 'エネルギー', 'Satellite', NULL, 1, datetime('now')),
('hold-wmt', 'user-satoshi', 'WMT', 'Walmart Inc', 1, 124.86, '["実体経済","小売"]', '小売', 'Satellite', NULL, 1, datetime('now'));