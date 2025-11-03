-- Migration script to change priority system from varchar to integer (1-10)
-- Current mapping: low -> 3, medium -> 6, high -> 9

-- First, add a new integer column for priority
ALTER TABLE tasks ADD COLUMN priority_new INTEGER;

-- Update existing records with the mapping
UPDATE tasks 
SET priority_new = CASE 
    WHEN priority = 'low' THEN 3
    WHEN priority = 'medium' THEN 6  
    WHEN priority = 'high' THEN 9
    ELSE 5 -- default for any null or unknown values
END;

-- Drop the old varchar priority column
ALTER TABLE tasks DROP COLUMN priority;

-- Rename the new column to priority
ALTER TABLE tasks RENAME COLUMN priority_new TO priority;

-- Set default value for new tasks
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 5;

-- Add check constraint to ensure priority is between 1 and 10
ALTER TABLE tasks ADD CONSTRAINT priority_range_check CHECK (priority >= 1 AND priority <= 10);