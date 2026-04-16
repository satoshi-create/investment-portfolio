-- Seed structural themes for Notion migration (edit copy to taste).
-- Requires profiles row (e.g. user-satoshi) and migration 010_investment_themes.sql.

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO investment_themes (id, user_id, name, description, goal, created_at) VALUES
(
  'theme-seed-ai-datacenter',
  'user-satoshi',
  'AIデータセンター',
  '生成AI・クラウド需要の拡大に伴うデータセンター向け投資仮説。GPU/ネットワーク/電力/冷却など、供給制約と設備投資サイクルが収益に効くサプライチェーンを重視する。',
  'サテライト枠の一部をこのテーマに集中し、中長期の構造成長とボラティリティのバランスを取りながら積み上げる。',
  datetime('now')
),
(
  'theme-seed-de-oil',
  'user-satoshi',
  '非石油文明',
  '脱炭素とエネルギー転換（EV、再エネ、省エネ・分散化）へのシフトを前提とした投資仮説。従来の化石燃料依存度の高いポートフォリオとの相関を下げる。',
  'マイルストーン（実体経済・政策・技術コスト曲線）に合わせて配分を見直し、テーマ内でも銘柄分散を維持する。',
  datetime('now')
),
(
  'theme-seed-edo-circular',
  'user-satoshi',
  '江戸循環ネットワーク文明',
  '石油依存の「直線型消費」から、国内資源と知恵を活用した「循環型ネットワーク」への移行を捉える。地政学リスク（中東情勢など）によるエネルギー価格高騰に対し、自律的な資源還流（バイオ、CNF、漢方、リサイクル）で対抗する企業群に着目する。',
  '供給制約と高油価局面で強まる「循環の優位」を継続観測し、エネルギー還流・素材還流・生命還流の3層で分散を維持する。',
  datetime('now')
),
(
  'theme-seed-semiconductor-equipment',
  'user-satoshi',
  '半導体サプライチェーン',
  '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。',
  datetime('now')
);
