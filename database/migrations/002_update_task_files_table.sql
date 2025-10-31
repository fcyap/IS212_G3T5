-- Migration: Add file metadata columns to task_files table
-- This migration adds file_name, file_path, file_size, and file_type columns

-- Add new columns if they don't exist
ALTER TABLE task_files 
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_user_id ON task_files(user_id);
CREATE INDEX IF NOT EXISTS idx_task_files_created_at ON task_files(created_at);

-- Add comment to document the table
COMMENT ON TABLE task_files IS 'Stores file attachments for tasks with Supabase Storage URLs';

-- Add comments to columns
COMMENT ON COLUMN task_files.id IS 'Primary key';
COMMENT ON COLUMN task_files.task_id IS 'Foreign key to tasks table';
COMMENT ON COLUMN task_files.user_id IS 'Foreign key to users table - who uploaded the file';
COMMENT ON COLUMN task_files.file_url IS 'Public URL from Supabase Storage';
COMMENT ON COLUMN task_files.file_name IS 'Original filename uploaded by user';
COMMENT ON COLUMN task_files.file_path IS 'Storage path in Supabase bucket';
COMMENT ON COLUMN task_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN task_files.file_type IS 'MIME type of the file';
COMMENT ON COLUMN task_files.created_at IS 'Timestamp when file was uploaded';

-- Ensure foreign key constraints exist
ALTER TABLE task_files
  DROP CONSTRAINT IF EXISTS task_files_task_id_fkey,
  ADD CONSTRAINT task_files_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE task_files
  DROP CONSTRAINT IF EXISTS task_files_user_id_fkey,
  ADD CONSTRAINT task_files_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files from tasks they're assigned to
CREATE POLICY "Users can view task files they have access to" ON task_files
  FOR SELECT
  USING (
    auth.uid()::integer IN (
      SELECT unnest(assigned_to) FROM tasks WHERE id = task_files.task_id
    )
    OR
    auth.uid()::integer = user_id
  );

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload task files" ON task_files
  FOR INSERT
  WITH CHECK (auth.uid()::integer = user_id);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files" ON task_files
  FOR DELETE
  USING (auth.uid()::integer = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON task_files TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE task_files_id_seq TO authenticated;
