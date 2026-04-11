-- 技術普及キャズム・ステージ（任意）と根拠テキスト（ツールチップ用）
-- Apply: turso db shell <db> < migrations/017_theme_ecosystem_adoption_stage.sql

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members ADD COLUMN adoption_stage TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN adoption_stage_rationale TEXT;

-- クオリプス（4894）: 臨床・規制・製造スケールの峡谷。Alpha はイベント駆動で振れやすい想定
UPDATE theme_ecosystem_members
SET
  adoption_stage = 'chasm',
  adoption_stage_rationale = 'iPS由来心筋シート等は第2相以降の治験・承認・製造キャパがボトルネックの峡谷帯。ニュースフローに Alpha が敏感で、普及曲線の「手前」の高ボラと相関しやすい。'
WHERE id = 'eco-edo-4894';
