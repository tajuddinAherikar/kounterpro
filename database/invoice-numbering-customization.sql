-- ============================================
-- INVOICE NUMBERING CUSTOMIZATION MIGRATION
-- ============================================
-- Run this in Supabase SQL Editor
-- Adds customizable invoice prefix and starting number

-- Step 1: Add invoice numbering columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(20) DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS starting_invoice_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_invoice_counter INTEGER DEFAULT 0;

-- Step 2: Add check constraints
DO $$ 
BEGIN
    -- Check constraint for valid invoice prefix (alphanumeric and some special chars)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_invoice_prefix'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_invoice_prefix 
        CHECK (invoice_prefix ~ '^[A-Z0-9\-\_\/]+$' AND LENGTH(invoice_prefix) <= 20);
    END IF;

    -- Check constraint for positive starting number
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_starting_invoice_number'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_starting_invoice_number 
        CHECK (starting_invoice_number >= 1 AND starting_invoice_number <= 999999);
    END IF;

    -- Check constraint for current counter
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_current_invoice_counter'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_current_invoice_counter 
        CHECK (current_invoice_counter >= 0);
    END IF;
END $$;

-- Step 3: Update existing records with default values
UPDATE user_profiles
SET invoice_prefix = COALESCE(invoice_prefix, 'INV'),
    starting_invoice_number = COALESCE(starting_invoice_number, 1),
    current_invoice_counter = COALESCE(current_invoice_counter, 0)
WHERE invoice_prefix IS NULL 
   OR starting_invoice_number IS NULL 
   OR current_invoice_counter IS NULL;

-- Step 4: Create index for faster invoice number lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_number ON invoices(user_id, invoice_number);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN user_profiles.invoice_prefix IS 'Custom prefix for invoice numbers (e.g., INV, BILL, SHOP). Max 20 chars, uppercase alphanumeric with - _ /';
COMMENT ON COLUMN user_profiles.starting_invoice_number IS 'Starting number for invoice sequence (e.g., 1, 100, 1001). Range: 1-999999';
COMMENT ON COLUMN user_profiles.current_invoice_counter IS 'Current invoice counter for auto-increment. Incremented after each invoice generation';

-- Step 6: Create a function to get the next invoice number for a user
CREATE OR REPLACE FUNCTION get_next_invoice_number(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    prefix TEXT;
    start_num INTEGER;
    counter INTEGER;
    next_num INTEGER;
    invoice_num TEXT;
BEGIN
    -- Get user's invoice settings
    SELECT invoice_prefix, starting_invoice_number, current_invoice_counter
    INTO prefix, start_num, counter
    FROM user_profiles
    WHERE id = user_uuid;
    
    -- If user profile not found, return default
    IF prefix IS NULL THEN
        prefix := 'INV';
        start_num := 1;
        counter := 0;
    END IF;
    
    -- Calculate next number
    next_num := start_num + counter;
    
    -- Format invoice number with prefix
    invoice_num := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
    
    -- Increment counter for next invoice
    UPDATE user_profiles
    SET current_invoice_counter = current_invoice_counter + 1
    WHERE id = user_uuid;
    
    RETURN invoice_num;
END;
$$;

-- Step 7: Create a function to validate invoice number uniqueness
CREATE OR REPLACE FUNCTION validate_invoice_number_unique(
    invoice_num TEXT,
    user_uuid UUID,
    invoice_id_to_exclude UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Check if invoice number already exists for this user
    IF invoice_id_to_exclude IS NULL THEN
        SELECT COUNT(*)
        INTO existing_count
        FROM invoices
        WHERE invoice_number = invoice_num
        AND user_id = user_uuid;
    ELSE
        SELECT COUNT(*)
        INTO existing_count
        FROM invoices
        WHERE invoice_number = invoice_num
        AND user_id = user_uuid
        AND id != invoice_id_to_exclude;
    END IF;
    
    RETURN existing_count = 0;
END;
$$;

-- Step 8: Add helpful view for invoice numbering preview
CREATE OR REPLACE VIEW invoice_number_preview AS
SELECT 
    id,
    business_name,
    invoice_prefix,
    starting_invoice_number,
    current_invoice_counter,
    invoice_prefix || '-' || LPAD((starting_invoice_number + current_invoice_counter)::TEXT, 4, '0') AS next_invoice_number,
    invoice_prefix || '-' || LPAD((starting_invoice_number + current_invoice_counter + 1)::TEXT, 4, '0') AS preview_next_after
FROM user_profiles;

COMMENT ON VIEW invoice_number_preview IS 'Preview of next invoice numbers for all users';

SELECT 'Invoice numbering customization migration completed successfully!' AS status;
