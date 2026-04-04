-- Scale factor for index / synthetic quotes: marketValueJpy uses qty * close * valuation_factor * FX.
ALTER TABLE holdings ADD COLUMN valuation_factor REAL NOT NULL DEFAULT 1;
