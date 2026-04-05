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
);
