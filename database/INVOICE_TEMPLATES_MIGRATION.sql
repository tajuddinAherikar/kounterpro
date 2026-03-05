-- ============================================
-- INVOICE TEMPLATES & BRANDING MIGRATION
-- ============================================
-- This migration adds support for customizable invoice templates
-- Run this in Supabase SQL Editor

-- Add new columns to user_profiles table for invoice templates and branding
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS invoice_template VARCHAR(50) DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7) DEFAULT '#2845D6',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS logo_position VARCHAR(20) DEFAULT 'left',
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true;

-- Add check constraint for valid template types
ALTER TABLE user_profiles
ADD CONSTRAINT check_invoice_template 
CHECK (invoice_template IN ('classic', 'modern', 'gst_format', 'retail'));

-- Add check constraint for valid logo positions
ALTER TABLE user_profiles
ADD CONSTRAINT check_logo_position 
CHECK (logo_position IN ('left', 'center', 'right'));

-- Add check constraint for valid brand color (hex format)
ALTER TABLE user_profiles
ADD CONSTRAINT check_brand_color 
CHECK (brand_color ~* '^#[0-9A-Fa-f]{6}$');

-- Create storage bucket for business logos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policy: Users can upload their own logos
CREATE POLICY "Users can upload their own business logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Users can update their own logos
CREATE POLICY "Users can update their own business logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Users can delete their own logos
CREATE POLICY "Users can delete their own business logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Anyone can view logos (public bucket)
CREATE POLICY "Business logos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'business-logos');

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.invoice_template IS 'Invoice template type: classic, modern, gst_format, or retail';
COMMENT ON COLUMN user_profiles.brand_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN user_profiles.logo_url IS 'URL to business logo in Supabase Storage';
COMMENT ON COLUMN user_profiles.logo_position IS 'Logo position in invoice header: left, center, or right';
COMMENT ON COLUMN user_profiles.show_logo IS 'Whether to display logo on invoices';

-- Update existing records to have default template settings
UPDATE user_profiles
SET invoice_template = 'classic',
    brand_color = '#2845D6',
    show_logo = true,
    logo_position = 'left'
WHERE invoice_template IS NULL;

-- Create index for faster template lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_template ON user_profiles(invoice_template);

SELECT 'Invoice Templates migration completed successfully!' AS status;
