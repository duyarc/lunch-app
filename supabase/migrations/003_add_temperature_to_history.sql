-- Add temperature column to history table
ALTER TABLE history ADD COLUMN temperature numeric;

-- Comment on column
COMMENT ON COLUMN history.temperature IS 'Temperature in Celsius at the time of choice';
