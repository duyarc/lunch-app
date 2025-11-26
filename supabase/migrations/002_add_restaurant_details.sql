-- Add details columns to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lat FLOAT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS long FLOAT;
