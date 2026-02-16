-- Update user_profiles table to include business information fields
-- Run this SQL in your Supabase SQL Editor

-- Add new columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS contact_number_1 VARCHAR(15),
ADD COLUMN IF NOT EXISTS contact_number_2 VARCHAR(15),
ADD COLUMN IF NOT EXISTS business_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15),
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have mobile as contact_number_1 if not set
UPDATE user_profiles 
SET contact_number_1 = mobile 
WHERE contact_number_1 IS NULL AND mobile IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE user_profiles IS 'User business profile information for invoice generation';

-- Add comments to new columns
COMMENT ON COLUMN user_profiles.business_address IS 'Complete business address for invoices';
COMMENT ON COLUMN user_profiles.contact_number_1 IS 'Primary contact number (10 digits)';
COMMENT ON COLUMN user_profiles.contact_number_2 IS 'Secondary contact number (10 digits, optional)';
COMMENT ON COLUMN user_profiles.business_email IS 'Business email address for invoices';
COMMENT ON COLUMN user_profiles.gst_number IS 'GST identification number (15 characters, optional)';
COMMENT ON COLUMN user_profiles.upi_id IS 'UPI ID for payment QR code generation (optional)';
COMMENT ON COLUMN user_profiles.terms_conditions IS 'Default terms and conditions for invoices';
COMMENT ON COLUMN user_profiles.updated_at IS 'Last profile update timestamp';
