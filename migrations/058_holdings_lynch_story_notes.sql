-- ストーリーパネル: リンチ分析テキストの永続化（Notion キューとは別）
-- Apply: npm run db:apply -- migrations/058_holdings_lynch_story_notes.sql

ALTER TABLE holdings ADD COLUMN lynch_drivers_narrative TEXT;
ALTER TABLE holdings ADD COLUMN lynch_story_text TEXT;
