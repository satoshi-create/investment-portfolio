-- デモ用サンプル（金額は例示。本番データに差し替えてください）
-- user_id は holdings-seed と同じプロファイル向け

PRAGMA foreign_keys = ON;

DELETE FROM trade_history WHERE user_id = 'user-satoshi';

INSERT INTO trade_history (
  id, user_id, trade_date, ticker, name, market, account_name, side,
  quantity, cost_jpy, proceeds_jpy, fees_jpy, realized_pnl_jpy, provider_symbol
) VALUES
('trade-fcx-1', 'user-satoshi', '2025-11-18', 'FCX', 'Freeport-McMoRan Inc', 'US', '特定', 'SELL',
 1, 850000, 926200, 500, 76200, NULL),
('trade-9501-1', 'user-satoshi', '2025-10-01', '9501', '東京電力ホールディングス', 'JP', '特定', 'SELL',
 100, 500000, 646000, 0, 146000, NULL),
('trade-apld-1', 'user-satoshi', '2025-09-15', 'APLD', 'Applied Digital Corp', 'US', '特定', 'SELL',
 1, 720000, 592000, 500, -128500, NULL),
('trade-iren-1', 'user-satoshi', '2025-08-20', 'IREN', 'IREN Ltd', 'US', '特定', 'SELL',
 50, 4500000, 5200000, 800, 699200, NULL),
('trade-uec-1', 'user-satoshi', '2025-07-10', 'UEC', 'Uranium Energy Corp', 'US', '特定', 'SELL',
 200, 1800000, 2100000, 1200, 298800, NULL),
('trade-3436-1', 'user-satoshi', '2025-06-05', '3436', 'SUMCO Corp', 'JP', '特定', 'SELL',
 100, 1200000, 1350000, 0, 150000, NULL),
('trade-apld-2', 'user-satoshi', '2025-02-25', 'APLD', 'Applied Digital Corp', 'US', '特定', 'SELL',
 2, 1100000, 980000, 600, -121600, NULL);
