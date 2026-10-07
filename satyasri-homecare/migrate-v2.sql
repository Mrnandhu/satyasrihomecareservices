-- ONLY needed if you already created the database with the older schema.sql.
-- Run once in the D1 Console, then also run schema.sql (it adds the reviews table).
ALTER TABLE enquiries ADD COLUMN caregiver TEXT NOT NULL DEFAULT '';
