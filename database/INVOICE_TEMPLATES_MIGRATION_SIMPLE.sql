-- ============================================
-- INVOICE TEMPLATES MIGRATION (Simplified)
-- ============================================
-- Run this in Supabase SQL Editor

-- Step 1: Add columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS invoice_template VARCHAR(50) DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7) DEFAULT '#2845D6',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS logo_position VARCHAR(20) DEFAULT 'left',
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true;

-- Step 2: Add check constraints
DO $$ 
BEGIN
    -- Check constraint for valid template types
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_invoice_template'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_invoice_template 
        CHECK (invoice_template IN ('classic', 'modern', 'gst_format', 'retail'));
    END IF;

    -- Check constraint for valid logo positions
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_logo_position'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_logo_position 
        CHECK (logo_position IN ('left', 'center', 'right'));
    END IF;

    -- Check constraint for valid brand color
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_brand_color'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT check_brand_color 
        CHECK (brand_color ~* '^#[0-9A-Fa-f]{6}$');
    END IF;
END $$;

-- Step 3: Update existing records
UPDATE user_profiles
SET invoice_template = COALESCE(invoice_template, 'classic'),
    brand_color = COALESCE(brand_color, '#2845D6'),
    show_logo = COALESCE(show_logo, true),
    logo_position = COALESCE(logo_position, 'left')
WHERE invoice_template IS NULL 
   OR brand_color IS NULL 
   OR show_logo IS NULL 
   OR logo_position IS NULL;

-- Step 4: Create index for faster template lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_template ON user_profiles(invoice_template);

-- Step 5: Add comments
COMMENT ON COLUMN user_profiles.invoice_template IS 'Invoice template type: classic, modern, gst_format, or retail';
COMMENT ON COLUMN user_profiles.brand_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN user_profiles.logo_url IS 'URL to business logo in Supabase Storage';
COMMENT ON COLUMN user_profiles.logo_position IS 'Logo position in invoice header: left, center, or right';
COMMENT ON COLUMN user_profiles.show_logo IS 'Whether to display logo on invoices';

SELECT 'Invoice Templates migration completed successfully! Now create the storage bucket via UI.' AS status;
