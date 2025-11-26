-- Add user_id column to history table
ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create index for faster filtering by user
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);

-- Note: Existing records will have NULL user_id, which we treat as "Global/Legacy" data
