-- 取引履歴（実データサンプル）。user_id は holdings-seed / profiles と揃える。

PRAGMA foreign_keys = ON;

DELETE FROM trade_history WHERE user_id = 'user-satoshi';

INSERT INTO trade_history (
  id, user_id, trade_date, ticker, name, market, account_name, side,
  quantity, cost_jpy, proceeds_jpy, fees_jpy, realized_pnl_jpy, provider_symbol
) VALUES
('trade-20260122-fcx', 'user-satoshi', '2026-01-22', 'FCX', 'Freeport-McMoRan Inc', 'US', '特定', 'SELL',
 1, 9469, 9262, 45, -252, NULL),
('trade-20260126-9501', 'user-satoshi', '2026-01-26', '9501', '東京電力', 'JP', '特定', 'SELL',
 3, 2148, 2055, 52, -145, NULL),
('trade-20260127-apld', 'user-satoshi', '2026-01-27', 'APLD', 'Applied Digital Corp', 'US', '特定', 'SELL',
 1, 5377, 5920, 27, 516, NULL),
('trade-20260127-iren', 'user-satoshi', '2026-01-27', 'IREN', 'IREN Ltd', 'US', '特定', 'SELL',
 1, 8642, 8620, 41, -63, NULL),
('trade-20260127-uec', 'user-satoshi', '2026-01-27', 'UEC', 'Uranium Energy Corp.', 'US', '特定', 'SELL',
 1, 3094, 2959, 13, -148, NULL),
('trade-20260128-3436', 'user-satoshi', '2026-01-28', '3436', 'Sumco', 'JP', '特定', 'SELL',
 2, 3340, 2960, 52, -432, NULL),
('trade-20260225-apld', 'user-satoshi', '2026-02-25', 'APLD', 'Applied Digital Corp', 'US', '特定', 'SELL',
 2, 12514, 9509, 46, -3051, NULL),
('trade-20260225-btdr', 'user-satoshi', '2026-02-25', 'BTDR', 'Bitdeer Technologies Group', 'US', '特定', 'SELL',
 3, 6300, 3901, 18, -2417, NULL),
('trade-20260225-iren', 'user-satoshi', '2026-02-25', 'IREN', 'IREN Ltd', 'US', '特定', 'SELL',
 2, 17652, 14027, 69, -3694, NULL),
('trade-20260305-btdr', 'user-satoshi', '2026-03-05', 'BTDR', 'Bitdeer Technologies Group', 'US', 'NISA', 'SELL',
 1, 1367, 1226, 0, -141, NULL),
('trade-20260305-xyz', 'user-satoshi', '2026-03-05', 'XYZ', 'Block Inc', 'US', 'NISA', 'SELL',
 1, 10002, 9818, 0, -184, NULL),
('trade-20260323-orcl', 'user-satoshi', '2026-03-23', 'ORCL', 'Oracle Corp', 'US', 'NISA', 'SELL',
 1, 26254, 24316, 0, -1938, NULL),
('trade-20260324-1942', 'user-satoshi', '2026-03-24', '1942', '関電工', 'JP', 'NISA', 'SELL',
 2, 13070, 11934, 0, -1136, NULL),
('trade-20260324-5703', 'user-satoshi', '2026-03-24', '5703', '日軽金ＨＤ', 'JP', 'NISA', 'SELL',
 1, 2760, 2619, 52, -193, NULL);