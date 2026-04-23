-- Watchlist row lifecycle: prioritize `owned` in Koyomi tactical lane ordering / probes.
-- Apply after 052.

ALTER TABLE theme_ecosystem_members ADD COLUMN status TEXT CHECK (
  status IS NULL
  OR status IN ('owned', 'watch', 'research')
);
