-- Story Hub（ウォッチのみ）: holdings と同様のリンチ叙述・本文をテーマメンバーに保持
ALTER TABLE theme_ecosystem_members ADD COLUMN lynch_drivers_narrative TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN lynch_story_text TEXT;
