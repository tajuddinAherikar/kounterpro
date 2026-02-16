-- Add date column to invoices table
-- Run this SQL in your Supabase SQL Editor

-- First, drop the column if it exists with wrong type
ALTER TABLE invoices DROP COLUMN IF EXISTS date;

-- Add date column as DATE type (not timestamp)
ALTER TABLE invoices 
ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update existing invoices to use created_at date (converted to date only)
UPDATE invoices 
SET date = (created_at AT TIME ZONE 'UTC')::date;

-- Add comment
COMMENT ON COLUMN invoices.date IS 'Invoice date (YYYY-MM-DD format, independent of timezone)';
